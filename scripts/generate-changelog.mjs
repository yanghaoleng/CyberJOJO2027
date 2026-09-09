import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { commitBaseUrlFromRemote, createChangelog, parseGitCommitLog } from './changelog-data.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const head = git('rev-parse', 'HEAD').trim();
// A merge appears once on the main line; side-branch history is not presented as separate releases.
const commits = parseGitCommitLog(git('log', '--first-parent', '-z', '--format=%H%x00%s%x00%cI', head));
const commitBaseUrl = commitBaseUrlFromRemote(git('remote', 'get-url', 'origin'));
const notesFile = path.join(repositoryRoot, 'src/changelog/notes.json');
let notes = {};
try {
  notes = JSON.parse(await readFile(notesFile, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Unable to read src/changelog/notes.json', { cause: error });
}
const changelog = createChangelog({ head, commits, notes, commitBaseUrl });
const output = path.join(repositoryRoot, 'public/changelog.json');
const temporary = `${output}.${process.pid}.tmp`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(temporary, `${JSON.stringify(changelog, null, 2)}\n`);
await rename(temporary, output);
console.log(`Changelog: ${changelog.days.length} days, ${changelog.days.reduce((sum, day) => sum + day.commits.length, 0)} main-line commits, HEAD ${head.slice(0, 7)}`);
