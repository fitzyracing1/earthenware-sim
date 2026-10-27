// Run fitzyracing1/fakegreen over Earthenware's own source as a tripwire:
// a computer whose headline result is "5*9=15" had better not be passing its tests by faking them.
// Scans the full tree (empty tree -> working tree, incl. untracked) so every test file is inspected.
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cli = process.env.FAKEGREEN_CLI || path.join(root, 'vendor', 'fakegreen', 'dist', 'cli.js');
if (!fs.existsSync(cli)) {
  console.error(`fakegreen not built at ${cli}\n  git clone https://github.com/fitzyracing1/fakegreen vendor/fakegreen && (cd vendor/fakegreen && npm ci && npm run build)`);
  process.exit(2);
}
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const empty = git('hash-object', '-t', 'tree', '/dev/null').trim();
git('add', '-A', '--intent-to-add');
const diff = git('diff', empty, '--', '.', ':!vendor', ':!package-lock.json');
const r = spawnSync(process.execPath, [cli, '--diff', '-', '--fail-on', 'medium', ...process.argv.slice(2)], { cwd: root, input: diff, stdio: ['pipe', 'inherit', 'inherit'] });
process.exit(r.status ?? 2);
