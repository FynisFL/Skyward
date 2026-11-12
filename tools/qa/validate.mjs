import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const passed = [];
const failed = [];
const warnings = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const check = (name, fn) => {
  try { fn(); passed.push(name); }
  catch (error) { failed.push({ name, message: error.message }); }
};

check('HTML entry point and local Three.js runtime exist', () => {
  assert.ok(exists('index.html'));
  assert.ok(exists('vendor/three.min.js'));
  assert.ok(exists('app/src/main/assets/game/index.html'));
});

check('HTML and CSS web/Android mirrors are byte-identical', () => {
  assert.equal(read('index.html'), read('app/src/main/assets/game/index.html'));
  assert.equal(read('css/style.css'), read('app/src/main/assets/game/css/style.css'));
});

const html = read('index.html');
const scriptPaths = [...html.matchAll(/<script\s+src=["']([^"']+)["']/gi)].map((m) => m[1]);
check('All HTML script dependencies resolve locally', () => {
  assert.ok(scriptPaths.length >= 10, `Expected at least 10 script tags; found ${scriptPaths.length}`);
  for (const src of scriptPaths) {
    assert.ok(!/^https?:\/\//i.test(src), `External runtime script is not allowed: ${src}`);
    assert.ok(exists(src), `Missing local script: ${src}`);
  }
});

check('HTML element IDs are unique', () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(relative);
    else if (entry.isFile() && relative.endsWith('.js')) jsFiles.push(relative);
  }
}
walk('js');

check('All game JavaScript files pass node --check', () => {
  for (const file of jsFiles) {
    const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.stdout}`);
  }
});

check('Every web JavaScript file has an identical Android mirror', () => {
  for (const file of jsFiles) {
    const mirror = path.posix.join('app/src/main/assets/game', file);
    assert.ok(exists(mirror), `Missing Android mirror: ${mirror}`);
    assert.equal(read(file), read(mirror), `Mirror mismatch: ${file}`);
  }
});

const main = read('js/main.js');
const enemies = read('js/enemies.js');
const world = read('js/world.js');
const weapons = read('js/weapons.js');
const readme = read('README.md');

check('Runtime exposes p50/p95/p99 performance diagnostics', () => {
  for (const token of ['p50', 'p95', 'p99', 'getPerformanceSnapshot']) {
    assert.ok(main.includes(token), `Missing metric/API token: ${token}`);
  }
});

check('Read-only browser QA handle exposes core game state', () => {
  for (const token of ['window.__SKYWARD__', 'G: G', 'player: player', 'waves: waves', 'getPerformanceSnapshot']) {
    assert.ok(main.includes(token), `Missing QA handle field: ${token}`);
  }
});

check('Core gameplay contracts remain present', () => {
  for (const token of ['Blackout Offensive', 'Endless Protocol']) assert.ok(readme.includes(token), `README missing ${token}`);
  for (const token of ['class WaveManager', 'start(mods)', 'updateProjectiles']) assert.ok(enemies.includes(token), `Enemy contract missing ${token}`);
  for (const token of ['isEnemyBlocked', 'isEnemyProjectileBlocked', 'validateNavigationRoutes']) assert.ok(world.includes(token), `World contract missing ${token}`);
  for (const token of ['tryFire', 'throwGrenade', 'callSuper', 'reset()']) assert.ok(weapons.includes(token), `Weapon contract missing ${token}`);
});

check('Android CI runs QA before building the APK', () => {
  const workflow = read('.github/workflows/build-android-apk.yml');
  assert.ok(workflow.includes('node tools/qa/validate.mjs'));
  assert.ok(workflow.includes('assembleDebug'));
});

check('All runtime JavaScript randomness uses seeded named streams', () => {
  const offenders = jsFiles.filter((file) => /\bMath\.random\s*\(/.test(read(file)));
  assert.deepEqual(offenders, [], 'Unseeded Math.random() remains in: ' + offenders.join(', '));
});

check('Phase 7 RNG, event and replay modules are loaded', () => {
  for (const file of ['js/rng.js', 'js/events.js', 'js/replay.js']) {
    assert.ok(exists(file), 'Missing ' + file);
    assert.ok(html.includes(file), 'HTML does not load ' + file);
  }
});

check('Phase 7 unit tests pass', () => {
  const result = spawnSync(process.execPath, ['tools/qa/phase7.test.mjs'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

const randomCount = (main.match(/Math\.random\(/g) || []).length +
  (enemies.match(/Math\.random\(/g) || []).length +
  (weapons.match(/Math\.random\(/g) || []).length;
if (randomCount) warnings.push(`${randomCount} Math.random() calls remain in core gameplay; seeded replay determinism is not guaranteed.`);

console.log('SKYWARD QA VALIDATION');
for (const name of passed) console.log(`PASS  ${name}`);
for (const item of failed) console.error(`FAIL  ${item.name}: ${item.message}`);
for (const warning of warnings) console.warn(`WARN  ${warning}`);
console.log(`RESULT: ${passed.length} passed, ${failed.length} failed, ${warnings.length} warnings`);
if (failed.length) process.exit(1);
