const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});
const fullSha = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const uniqueText = (values) => [...new Set(values.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))];

export function commitDateInShanghai(committedAt) {
  if (typeof committedAt !== 'string' || !Number.isFinite(Date.parse(committedAt))) {
    throw new Error('A commit has an invalid committedAt value');
  }
  const parts = Object.fromEntries(shanghaiDate.formatToParts(new Date(committedAt)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Git's -z record terminator plus two NUL field separators gives triples. */
export function parseGitCommitLog(value) {
  const fields = value.split('\0');
  if (fields.at(-1) === '') fields.pop();
  if (fields.length % 3 !== 0) throw new Error('Unexpected git log field count');
  const commits = [];
  for (let index = 0; index < fields.length; index += 3) {
    commits.push({ sha: fields[index], subject: fields[index + 1], committedAt: fields[index + 2] });
  }
  return commits;
}

export function commitBaseUrlFromRemote(remote) {
  let value = remote.trim();
  if (/^[^@\s]+@[^:\s]+:/.test(value)) value = value.replace(/^[^@\s]+@([^:\s]+):/, 'https://$1/');
  const url = new URL(value);
  if (!['https:', 'http:', 'ssh:'].includes(url.protocol)) throw new Error('An HTTP or SSH repository origin is required');
  const repositoryPath = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '');
  if (!/^\/[^/]+\/[^/]+$/.test(repositoryPath)) throw new Error('Expected an owner/repository origin path');
  // Credentials, query parameters and fragments never enter the public artifact.
  return `https://${url.host}${repositoryPath}/commit`;
}

export function createChangelog({ head, commits, notes = {}, commitBaseUrl, generatedAt = new Date().toISOString() }) {
  if (!fullSha.test(head)) throw new Error('A complete HEAD SHA is required');
  if (!Array.isArray(commits)) throw new Error('Commits must be an array');
  if (typeof commitBaseUrl !== 'string' || !/^https?:\/\//.test(commitBaseUrl)) throw new Error('A commit URL base is required');
  const seen = new Set();
  const groups = new Map();
  for (const commit of commits) {
    if (!fullSha.test(commit.sha)) throw new Error('A commit has an invalid full SHA');
    if (seen.has(commit.sha)) continue;
    seen.add(commit.sha);
    const date = commitDateInShanghai(commit.committedAt);
    if (typeof commit.subject !== 'string') throw new Error('A commit subject must be a string');
    const entry = {
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      subject: commit.subject,
      committedAt: commit.committedAt,
      url: `${commitBaseUrl.replace(/\/+$/, '')}/${commit.sha}`,
    };
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(entry);
  }
  const days = [...groups.keys()].sort().reverse().map((date) => {
    const dailyCommits = groups.get(date).sort((a, b) => Date.parse(b.committedAt) - Date.parse(a.committedAt));
    const note = notes?.days?.[date];
    const commitSubjects = note?.commitSubjects && typeof note.commitSubjects === 'object' ? note.commitSubjects : {};
    const localizedCommits = dailyCommits.map((commit) => {
      const localized = commitSubjects[commit.sha];
      return typeof localized === 'string' && localized.trim() ? { ...commit, subject: localized.trim() } : commit;
    });
    const title = typeof note?.title === 'string' && note.title.trim() ? note.title.trim() : '更新记录';
    const suppliedItems = Array.isArray(note?.items) ? uniqueText(note.items) : [];
    const items = suppliedItems.length ? suppliedItems : uniqueText(localizedCommits.map((commit) => commit.subject));
    return { date, title, items, commits: localizedCommits };
  });
  return { version: 1, generatedAt, head, days };
}
