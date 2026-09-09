import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location("record_release", Path(__file__).with_name("record-release.py"))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ReleaseLedgerTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.history = self.root / "published" / "history.json"
        self.catalog = self.root / "changelog.json"
        self.seed = self.root / "seed.json"
        self.write(self.catalog, {"head": "b" * 40, "days": []})

    def write(self, path, value):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value), encoding="utf-8")

    def record(self, tag="20260909-next", commit="a" * 40):
        return {"id": tag, "commit": commit, "releasedAt": "2026-09-09T08:22:05Z", "kind": "site"}

    def test_keeps_history_merges_seed_and_records_actual_utc(self):
        old = self.record("older")
        seed = self.record("seeded")
        self.write(self.history, {"version": 1, "releases": [old]})
        self.write(self.seed, {"version": 1, "releases": [old, seed, seed]})
        before = MODULE.datetime.now(MODULE.timezone.utc)
        ledger = MODULE.record_release(self.history, self.catalog, "current", self.seed)
        after = MODULE.datetime.now(MODULE.timezone.utc)
        self.assertEqual(ledger["releases"][:2], [old, seed])
        current = ledger["releases"][2]
        self.assertEqual(current["commit"], "b" * 40)
        self.assertTrue(current["releasedAt"].endswith("Z"))
        actual = MODULE.datetime.fromisoformat(current["releasedAt"].replace("Z", "+00:00"))
        self.assertLessEqual(before.replace(microsecond=0), actual)
        self.assertLessEqual(actual, after)
        self.assertEqual(json.loads(self.history.read_text()), ledger)
        self.assertEqual(self.history.stat().st_mode & 0o777, 0o644)

    def test_repeated_tag_and_commit_preserve_time_and_file(self):
        old = self.record("current", "b" * 40)
        self.write(self.history, {"version": 1, "releases": [old]})
        contents = self.history.read_bytes()
        with patch.object(MODULE, "atomic_write") as writer:
            result = MODULE.record_release(self.history, self.catalog, "current")
        writer.assert_not_called()
        self.assertEqual(result["releases"], [old])
        self.assertEqual(self.history.read_bytes(), contents)

    def test_conflicting_tag_in_current_or_seed_does_not_overwrite(self):
        self.write(self.history, {"version": 1, "releases": [self.record("current")]})
        original = self.history.read_bytes()
        with self.assertRaises(ValueError):
            MODULE.record_release(self.history, self.catalog, "current")
        self.write(self.seed, {"version": 1, "releases": [self.record("current", "c" * 40)]})
        with self.assertRaises(ValueError):
            MODULE.record_release(self.history, self.catalog, "new", self.seed)
        self.assertEqual(self.history.read_bytes(), original)

    def test_corrupt_history_is_never_replaced(self):
        self.history.parent.mkdir()
        invalid_values = ["{broken", '{"version":1,"version":1,"releases":[]}',
                          json.dumps({"version": 1, "releases": [{**self.record(), "releasedAt": "yesterday"}]})]
        for invalid in invalid_values:
            with self.subTest(invalid=invalid):
                self.history.write_text(invalid)
                with self.assertRaises(ValueError):
                    MODULE.record_release(self.history, self.catalog, "current")
                self.assertEqual(self.history.read_text(), invalid)

    def test_invalid_tag_and_noncanonical_head_leave_no_ledger(self):
        for tag in ["", "../release", ".", "two words", "a/child", "a..b", "a" * 129]:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                MODULE.record_release(self.history, self.catalog, tag)
        for commit in ["abc1234", "B" * 40, "g" * 40, None]:
            self.write(self.catalog, {"head": commit, "days": []})
            with self.subTest(commit=commit), self.assertRaises(ValueError):
                MODULE.record_release(self.history, self.catalog, "safe")
        self.assertFalse(self.history.exists())

    def test_failed_atomic_replace_preserves_existing_history_and_cleans_temp(self):
        self.write(self.history, {"version": 1, "releases": [self.record("old")]})
        original = self.history.read_bytes()
        with patch.object(MODULE.os, "replace", side_effect=OSError("disk failure")):
            with self.assertRaises(OSError):
                MODULE.record_release(self.history, self.catalog, "current")
        self.assertEqual(self.history.read_bytes(), original)
        self.assertEqual(list(self.history.parent.iterdir()), [self.history])


if __name__ == "__main__":
    unittest.main()
