import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const header = fs.readFileSync(path.join(root, 'userscript-header.txt'), 'utf8');
const modules = [
  'src/config.js',
  'src/00-config-and-helpers.js',
  'src/10-hiveos-dom.js',
  'src/20-oc-history.js',
  'src/ui/30-metrics.js',
  'src/ui/40-overlays.js',
  'src/50-app.js',
];
const body = modules.map((file) => {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing source module: ${file}`);
  return `\n/* ===== ${file} ===== */\n` + fs.readFileSync(fullPath, 'utf8');
}).join('\n');
const output = `${header}\n(function () {\n'use strict';\n${body}\n})();\n`;
const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'HiveOS_Additional_Information.user.js');
fs.writeFileSync(outFile, output);
console.log(`Built ${path.relative(root, outFile)} (${Buffer.byteLength(output)} bytes)`);
