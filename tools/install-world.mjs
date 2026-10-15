/** Safe and repeatable M2 world route installer. Supports LF and CRLF sources. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const paths = {
  server: path.join(root, 'index.js'),
  test: path.join(root, 'tests/integration/security.test.cjs'),
  syntax: path.join(root, 'scripts/check-syntax.cjs'),
};
const requiredFiles = [
  'world.html', 'css/world.css', 'js/world/world-core.mjs',
  'js/world/world-main.mjs', 'tests/unit/world-core.test.cjs',
];
for (const file of [...Object.values(paths), ...requiredFiles.map(f => path.join(root, f))]) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Missing required file: ${file}. Nothing modified.`);
  }
}
const branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim();
if (branch !== 'feat/m2-world-vertical-slice') {
  throw new Error(`Expected feat/m2-world-vertical-slice; got '${branch}'. Nothing modified.`);
}

const source = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const normalized = Object.fromEntries(Object.entries(source).map(([key, text]) => [key, text.replace(/\r\n/g, '\n')]));
const replacements = {
  server: {
    before: '// Redirección de la raíz a mokepon.html\napp.get("/", (_req, res) => {\n  res.redirect("/mokepon.html");\n});',
    after: '// M2 playable world route (classic remains available at /mokepon.html).\napp.get("/world.html", (_req, res) => {\n  res.sendFile(path.join(__dirname, "world.html"));\n});\n\napp.get("/", (_req, res) => {\n  res.redirect("/world.html");\n});',
    done: 'app.get("/world.html", (_req, res) => {',
  },
  test: {
    before: '  // root redirects to /mokepon.html\n  const rootRes = await fetch(`${server.url}/`, { redirect: "manual" });\n  assert.equal(rootRes.status, 302);\n  assert.equal(rootRes.headers.get("location"), "/mokepon.html");',
    after: '  // World entry point is public; existing classic page remains available.\n  const worldRes = await fetch(`${server.url}/world.html`);\n  assert.equal(worldRes.status, 200);\n  assert.ok((await worldRes.text()).includes("Animal Combat World"));\n\n  const rootRes = await fetch(`${server.url}/`, { redirect: "manual" });\n  assert.equal(rootRes.status, 302);\n  assert.equal(rootRes.headers.get("location"), "/world.html");',
    done: 'const worldRes = await fetch(`${server.url}/world.html`);',
  },
  syntax: {
    before: '  "js/rules/index.cjs",',
    after: '  "js/rules/index.cjs",\n  "js/world/world-core.mjs",\n  "js/world/world-main.mjs",\n  "tools/install-world.mjs",\n  "tests/unit/world-core.test.cjs",',
    done: '"js/world/world-core.mjs"',
  },
};
const newContent = {};
for (const [key, change] of Object.entries(replacements)) {
  const text = normalized[key];
  if (text.includes(change.done)) {
    if (key !== "syntax" && text.includes(change.before)) throw new Error(`Inconsistent partially installed state in ${key}; nothing modified.`);
    newContent[key] = text;
    continue;
  }
  if (!text.includes(change.before)) {
    throw new Error(`Unexpected ${key} source, required anchor absent. Nothing modified.`);
  }
  newContent[key] = text.replace(change.before, change.after);
}

const changes = Object.keys(paths).filter(key => newContent[key] !== normalized[key]);
if (changes.length === 0) {
  console.log('M2 world routes, tests, and syntax entries already installed. No changes needed.');
  process.exit(0);
}

// Preserve each file's original newline style, and roll back all changed files if any write fails.
const wrote = [];
try {
  for (const key of changes) {
    const eol = source[key].includes('\r\n') ? '\r\n' : '\n';
    fs.writeFileSync(paths[key], newContent[key].replace(/\n/g, eol), 'utf8');
    wrote.push(key);
  }
} catch (error) {
  for (const key of wrote.reverse()) fs.writeFileSync(paths[key], source[key], 'utf8');
  throw error;
}
console.log(`M2 world installed successfully (${changes.join(', ')}). Classic route preserved.`);
console.log('Run: node --test tests/unit/world-core.test.cjs && pnpm test && pnpm run gate:m0');
