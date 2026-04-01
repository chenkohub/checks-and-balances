/**
 * generate-cross-links.js
 * Populates scenarioIds on each case in cases.json based on scenario caseReferences.
 * caseReferences are full citation strings (e.g. "Youngstown Sheet & Tube Co. v. Sawyer, 343 U.S. 579 (1952)")
 * so we fuzzy-match against case names.
 * Run: node scripts/generate-cross-links.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const scenariosPath = resolve(ROOT, 'data/scenarios.json');
const casesPath = resolve(ROOT, 'data/cases.json');

const scenarios = JSON.parse(readFileSync(scenariosPath, 'utf8'));
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

// Normalize a string for fuzzy matching: lowercase, strip punctuation, collapse whitespace
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Build lookup structures from cases
// Match by: case name appearing in the reference string, or case id
const caseMatchers = cases.map(c => ({
  id: c.id,
  normalizedName: normalize(c.name),
  // Also try matching just the short case name (before "v.")
  nameTokens: normalize(c.name).split(' ')
}));

// Map: caseId -> Set of scenarioIds
const caseToScenarios = new Map();

for (const scenario of scenarios) {
  const refs = scenario.caseReferences || [];
  for (const ref of refs) {
    const refStr = typeof ref === 'string' ? ref : ref?.id || '';
    if (!refStr) continue;
    const normalizedRef = normalize(refStr);

    // Try to match against each case
    for (const matcher of caseMatchers) {
      // Match if the case name appears in the reference string, or vice versa
      if (normalizedRef.includes(matcher.normalizedName) || matcher.normalizedName.includes(normalizedRef)) {
        if (!caseToScenarios.has(matcher.id)) caseToScenarios.set(matcher.id, new Set());
        caseToScenarios.get(matcher.id).add(scenario.id);
      }
    }
  }
}

// Update each case with scenarioIds
let updatedCount = 0;
for (const c of cases) {
  const scenarioIds = caseToScenarios.get(c.id);
  c.scenarioIds = scenarioIds ? [...scenarioIds].sort() : [];
  if (c.scenarioIds.length > 0) updatedCount++;
}

writeFileSync(casesPath, JSON.stringify(cases, null, 2) + '\n', 'utf8');

console.log(`✅ Updated ${updatedCount} of ${cases.length} cases with cross-links.`);
