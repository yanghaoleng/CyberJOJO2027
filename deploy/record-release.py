#!/usr/bin/env python3
"""Record a successfully checked deployment; never infer releases from directories.

Call only after deployment health checks pass. The catalog supplies the exact
built Git revision; this tool supplies the current UTC release time.
"""

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import tempfile


SHA_PATTERN = re.compile(r"[0-9a-f]{40}\Z")
TAG_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
TIME_PATTERN = re.compile(
    r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})\Z"
)
RELEASE_FIELDS = {"id", "commit", "releasedAt", "kind"}


def validate_tag(tag):
    if not isinstance(tag, str) or not TAG_PATTERN.fullmatch(tag) or ".." in tag:
        raise ValueError("Release tag must be 1–128 safe characters, start with a letter or digit, and contain no '..'.")
    return tag


def validate_commit(commit):
    if not isinstance(commit, str) or not SHA_PATTERN.fullmatch(commit):
        raise ValueError("Commit must be a canonical lowercase 40-character Git SHA.")
    return commit


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_json(path):
    with Path(path).open("r", encoding="utf-8") as source:
        return json.load(source, object_pairs_hook=unique_object)


def validate_ledger(value, label):
    if (
        not isinstance(value, dict)
        or type(value.get("version")) is not int
        or value["version"] != 1
        or not isinstance(value.get("releases"), list)
    ):
        raise ValueError(f"{label} must be a version 1 release ledger.")
    records = []
    for record in value["releases"]:
        if not isinstance(record, dict) or set(record) != RELEASE_FIELDS:
            raise ValueError(f"{label} contains an invalid release record.")
        validate_tag(record["id"])
        validate_commit(record["commit"])
        if record["kind"] != "site":
            raise ValueError(f"{label} contains an unsupported release kind.")
        released_at = record["releasedAt"]
        if not isinstance(released_at, str) or not TIME_PATTERN.fullmatch(released_at):
            raise ValueError(f"{label} contains a release time without a valid ISO 8601 timezone.")
        # Validate real calendar dates and offsets, while retaining historical text.
        datetime.fromisoformat(released_at.replace("Z", "+00:00"))
        records.append(dict(record))
    return records


def merge_records(*groups):
    records = {}
    for group in groups:
        for record in group:
            previous = records.get(record["id"])
            if previous and previous["commit"] != record["commit"]:
                raise ValueError(f"Release tag {record['id']} already belongs to a different commit.")
            if previous is None:
                records[record["id"]] = record
    return list(records.values())


def atomic_write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent,
            prefix=f".{path.name}.", suffix=".tmp", delete=False,
        ) as temporary:
            temporary_path = Path(temporary.name)
            json.dump(value, temporary, ensure_ascii=False, indent=2)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
        # The ledger is public site metadata; Nginx must be able to read it.
        os.chmod(temporary_path, 0o644)
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def record_release(history, catalog, tag, seed=None):
    validate_tag(tag)
    catalog_value = read_json(catalog)
    if not isinstance(catalog_value, dict) or not isinstance(catalog_value.get("days"), list):
        raise ValueError("Catalog must contain a Git head and a days array.")
    commit = validate_commit(catalog_value.get("head"))
    history_path = Path(history)
    try:
        history_value = read_json(history_path)
    except FileNotFoundError:
        # A dangling symlink is broken existing history, not a new ledger.
        if history_path.is_symlink():
            raise
        history_value = {"version": 1, "releases": []}
    history_records = validate_ledger(history_value, "History")
    seed_records = validate_ledger(read_json(seed), "Seed") if seed is not None else []
    records = merge_records(history_records, seed_records)
    previous = next((record for record in records if record["id"] == tag), None)
    if previous is not None and previous["commit"] != commit:
        raise ValueError(f"Release tag {tag} already belongs to a different commit.")
    if previous is None:
        records.append({
            "id": tag,
            "commit": commit,
            "releasedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "kind": "site",
        })
    ledger = {"version": 1, "releases": records}
    if ledger != history_value or not history_path.exists():
        atomic_write(history_path, ledger)
    return ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--history", required=True, type=Path)
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--seed", type=Path)
    args = parser.parse_args()
    ledger = record_release(args.history, args.catalog, args.tag, args.seed)
    record = next(item for item in ledger["releases"] if item["id"] == args.tag)
    print(f"Recorded {record['id']} at {record['releasedAt']} ({record['commit']})")


if __name__ == "__main__":
    main()
