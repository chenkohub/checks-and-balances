/**
 * scripts/bump-build.js
 * Updates the MAP_UI_BUILD stamp in index.html and the CSS version query
 * string to a fresh timestamp-based token. Run before every deployment.
 *
 * Usage: node scripts/bump-build.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Build token: date + short random suffix for uniqueness
const now = new Date();
const datePart = now.toISOString().slice(0, 10); // e.g. 2026-03-31
const rand = Math.random().toString(36).slice(2, 6); // e.g. k7qx
const newBuild = `${datePart}-r${rand}`;

let html = readFileSync(resolve(root, 'index.html'), 'utf8');

// Replace the MAP_UI_BUILD string literal
html = html.replace(
  /const MAP_UI_BUILD = '[^']*'/,
  `const MAP_UI_BUILD = '${newBuild}'`
);

// Replace the CSS query string version
html = html.replace(
  /styles\.css\?v=[^\s"']*/g,
  `styles.css?v=${newBuild}`
);

// Replace the JS query string version
html = html.replace(
  /game\.js\?v=[^\s"']*/g,
  `game.js?v=${newBuild}`
);

writeFileSync(resolve(root, 'index.html'), html, 'utf8');
console.log(`✅ Build stamp updated to: ${newBuild}`);
