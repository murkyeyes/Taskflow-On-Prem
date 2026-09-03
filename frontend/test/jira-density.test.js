import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../src/styles.css', import.meta.url);

test('keeps the Jira desktop density in shared CSS without visual scaling', async () => {
  const css = await readFile(cssUrl, 'utf8');

  assert.match(css, /font-size:\s*14px/);
  assert.match(css, /line-height:\s*20px/);
  assert.match(css, /\.topbar\s*\{[^}]*height:\s*48px/);
  assert.match(css, /\.jira-sidebar\s*\{[^}]*width:\s*304px[^}]*flex:\s*0 0 304px/);
  assert.match(css, /\.button\s*\{[^}]*min-height:\s*32px/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*zoom\s*:/m);
  assert.doesNotMatch(css, /transform\s*:\s*scale\s*\(/);
});
