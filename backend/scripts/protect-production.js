const fs = require('node:fs');
const path = require('node:path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const bytenode = require('bytenode');

const sourceRoot = path.resolve(__dirname, '..', 'src');
const outputRoot = path.resolve(__dirname, '..', 'dist-protected');
const sensitive = path.join('services', 'auth.service.js');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

async function main() {
  fs.rmSync(outputRoot, { recursive: true, force: true }); fs.mkdirSync(outputRoot, { recursive: true });
  const files = walk(sourceRoot).filter((file) => file.endsWith('.js'));
  for (const file of files) {
    const relative = path.relative(sourceRoot, file); const target = path.join(outputRoot, relative); fs.mkdirSync(path.dirname(target), { recursive: true });
    if (relative === sensitive) { await bytenode.compileFile({ filename: file, output: target.replace(/\.js$/, '.jsc') }); continue; }
    const result = JavaScriptObfuscator.obfuscate(fs.readFileSync(file, 'utf8'), { compact: true, controlFlowFlattening: false, stringArray: true });
    fs.writeFileSync(target, result.getObfuscatedCode());
  }
  fs.writeFileSync(path.join(outputRoot, 'README.txt'), 'Protected production artifact. Do not edit.\n');
  console.log(`Protected ${files.length} backend modules`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
