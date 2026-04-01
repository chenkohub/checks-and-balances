/**
 * split-css.js — One-time script to split styles.css into logical modules.
 * Run: node scripts/split-css.js
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const cssDir = resolve(ROOT, 'css');

mkdirSync(cssDir, { recursive: true });

const content = readFileSync(resolve(ROOT, 'styles.css'), 'utf8');
const lines = content.split('\n');

// Define sections by their starting line numbers (1-indexed from grep results)
// and which output file they belong to.
// Lines are inclusive start, exclusive end.
const sections = [
  // variables.css: Custom Properties (lines 1-86)
  { file: 'variables.css', start: 1, end: 87 },
  // reset.css: Reset & Base (lines 87-149)
  { file: 'reset.css', start: 87, end: 150 },
  // layout.css: Screen Management + Keyframe Animations (lines 150-246)
  { file: 'layout.css', start: 150, end: 247 },
  // landing.css: Landing Screen + Dark-mode toggle in header (lines 247-490)
  { file: 'landing.css', start: 247, end: 491 },
  // game.css: Game Header + Branch Badge + Progress Bar + Scenario Area + Choice Buttons + Argument Builder + Counter-argument (lines 491-1056)
  { file: 'game.css', start: 491, end: 1057 },
  // feedback.css: Feedback Modal + Enhanced Feedback Panel (lines 1057-1446)
  { file: 'feedback.css', start: 1057, end: 1447 },
  // results.css: End-of-game screen (lines 1447-1638)
  { file: 'results.css', start: 1447, end: 1639 },
  // components.css: Case Popup + Utility Hidden (lines 1639-1739)
  { file: 'components.css', start: 1639, end: 1740 },
  // responsive.css: Tablet + Small Phone + Mode Selector + Timer + Game Layout + Precedent Tracker + Exam Review + SR-only + Responsive Adjustments (lines 1740-2284)
  { file: 'responsive.css', start: 1740, end: 2285 },
  // dark-mode.css: Dark Mode + Phase 6 Dark Mode + Reduced Motion (lines 2285-2487)
  { file: 'dark-mode.css', start: 2285, end: 2488 },
  // app-shell.css: Accessibility + UI Completion Patch (lines 2488-3043)
  { file: 'app-shell.css', start: 2488, end: 3044 },
  // surfaces.css: App Shell + Career Mode Surfaces (lines 3044-3290)
  { file: 'surfaces.css', start: 3044, end: 3291 },
  // dashboard.css: Dashboard (lines 3291-3411)
  { file: 'dashboard.css', start: 3291, end: 3412 },
  // map.css: Map (lines 3412-3727)
  { file: 'map.css', start: 3412, end: 3728 },
  // library.css: Library (lines 3728-3809)
  { file: 'library.css', start: 3728, end: 3810 },
  // codex.css: Codex (lines 3810-3859)
  { file: 'codex.css', start: 3810, end: 3860 },
  // extras.css: Results+Toasts, Route Context, Responsive, P0, P1, Danger Zone, Settings Drawer (lines 3860-end)
  { file: 'extras.css', start: 3860, end: lines.length + 1 },
];

let totalLinesWritten = 0;

for (const section of sections) {
  // Convert from 1-indexed to 0-indexed
  const sectionLines = lines.slice(section.start - 1, section.end - 1);
  const text = sectionLines.join('\n');
  writeFileSync(resolve(cssDir, section.file), text + '\n', 'utf8');
  totalLinesWritten += sectionLines.length;
  console.log(`  ✅ css/${section.file} — ${sectionLines.length} lines`);
}

console.log(`\nTotal lines written: ${totalLinesWritten} (original: ${lines.length})`);

// Generate the @import file
const imports = sections.map(s => `@import './css/${s.file}';`).join('\n');
const stylesContent = `/* styles.css — Import hub for all CSS modules */\n${imports}\n`;
writeFileSync(resolve(ROOT, 'styles.css'), stylesContent, 'utf8');
console.log('\n✅ styles.css rewritten with @import statements.');
console.log(`   ${sections.length} CSS modules created in css/`);
