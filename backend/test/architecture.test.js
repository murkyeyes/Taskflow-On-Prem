const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const sourceRoot = path.resolve(__dirname, '../src');
const layerNames = ['routes', 'controllers', 'services', 'repositories'];

function listJavaScriptFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listJavaScriptFiles(entryPath)
      : entry.name.endsWith('.js') ? [entryPath] : [];
  });
}

function layerFor(filePath) {
  const relativeParts = path.relative(sourceRoot, filePath).split(path.sep);
  return layerNames.includes(relativeParts[0]) ? relativeParts[0] : null;
}

test('layer imports do not bypass the routes-controller-service-repository flow', () => {
  const forbiddenTargets = {
    routes: new Set(['services', 'repositories']),
    controllers: new Set(['routes', 'repositories']),
    services: new Set(['routes', 'controllers']),
    repositories: new Set(['routes', 'controllers', 'services']),
  };
  const violations = [];

  for (const sourceLayer of layerNames) {
    const directory = path.join(sourceRoot, sourceLayer);
    for (const filePath of listJavaScriptFiles(directory)) {
      const source = fs.readFileSync(filePath, 'utf8');
      const imports = [...source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)];

      for (const match of imports) {
        const targetPath = path.resolve(path.dirname(filePath), match[1]);
        const targetLayer = layerFor(targetPath);
        if (targetLayer && forbiddenTargets[sourceLayer].has(targetLayer)) {
          violations.push(`${path.relative(sourceRoot, filePath)} -> ${targetLayer}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('business SQL is confined to repositories', () => {
  const sqlPattern = /(?:`|'|")\s*(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i;
  const violations = listJavaScriptFiles(sourceRoot)
    .filter((filePath) => layerFor(filePath) !== 'repositories')
    .filter((filePath) => sqlPattern.test(fs.readFileSync(filePath, 'utf8')))
    .map((filePath) => path.relative(sourceRoot, filePath));

  assert.deepEqual(violations, []);
});
