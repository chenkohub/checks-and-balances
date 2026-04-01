/**
 * validate-schemas.js
 * Validates all data files against their expected schemas.
 * Run: node scripts/validate-schemas.js
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let errorCount = 0;
let warnCount = 0;

function error(file, id, msg) {
  console.error(`  ❌ [${file}] ${id ? `(${id}) ` : ''}${msg}`);
  errorCount++;
}

function warn(file, id, msg) {
  console.warn(`  ⚠️  [${file}] ${id ? `(${id}) ` : ''}${msg}`);
  warnCount++;
}

function loadJSON(relPath) {
  const full = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch (e) {
    error(relPath, null, `Failed to parse: ${e.message}`);
    return null;
  }
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

// ── Scenario Validation ──────────────────────────────────────────────

const VALID_BRANCHES = new Set(['judiciary', 'congress', 'president', 'executive']);
const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);
const VALID_STEP_TYPES = new Set(['multiple_choice', 'argument_builder', 'counter_argument']);
const VALID_CORRECT = new Set([true, false, 'correct', 'incorrect', 'partial']);

function validateChoice(choice, stepLabel, file) {
  const cid = choice.id || '(missing id)';
  if (!isNonEmptyString(choice.id)) error(file, `${stepLabel}/${cid}`, 'choice missing id');
  if (!isNonEmptyString(choice.text)) error(file, `${stepLabel}/${cid}`, 'choice missing text');
  if (typeof choice.points !== 'number') error(file, `${stepLabel}/${cid}`, 'choice.points must be a number');
  if (!VALID_CORRECT.has(choice.correct)) error(file, `${stepLabel}/${cid}`, `choice.correct must be one of: ${[...VALID_CORRECT].join(', ')}`);
  if (!isNonEmptyString(choice.explanation)) error(file, `${stepLabel}/${cid}`, 'choice missing explanation');
  if (choice.trapOnly !== undefined && typeof choice.trapOnly !== 'boolean') warn(file, `${stepLabel}/${cid}`, 'trapOnly should be boolean');
  if (choice.whyTempting !== undefined && typeof choice.whyTempting !== 'string') warn(file, `${stepLabel}/${cid}`, 'whyTempting should be string');
  if (choice.distinguishingPrinciple !== undefined && typeof choice.distinguishingPrinciple !== 'string') warn(file, `${stepLabel}/${cid}`, 'distinguishingPrinciple should be string');
  if (choice.setsPrecedent !== undefined && (typeof choice.setsPrecedent !== 'object' || choice.setsPrecedent === null)) warn(file, `${stepLabel}/${cid}`, 'setsPrecedent should be an object');
}

function validateHypo(hypo, scenarioId, file) {
  const hid = hypo.id || '(missing id)';
  const label = `${scenarioId}/hypo:${hid}`;
  if (!isNonEmptyString(hypo.id)) error(file, label, 'hypo missing id');
  if (!isNonEmptyString(hypo.prompt)) error(file, label, 'hypo missing prompt');
  if (!Array.isArray(hypo.choices) || hypo.choices.length < 2) {
    error(file, label, 'hypo must have at least 2 choices');
  } else {
    for (const c of hypo.choices) {
      if (!isNonEmptyString(c.text)) error(file, label, 'hypo choice missing text');
      if (c.correct === undefined) error(file, label, 'hypo choice missing correct');
      if (!isNonEmptyString(c.explanation)) error(file, label, 'hypo choice missing explanation');
      if (c.points !== undefined && typeof c.points !== 'number') error(file, label, 'hypo choice points must be a number');
    }
  }
}

function validateScenarios(scenarios, file) {
  if (!Array.isArray(scenarios)) {
    error(file, null, 'Expected top-level array');
    return new Set();
  }

  const ids = new Set();
  const duplicateIds = new Set();

  for (const s of scenarios) {
    const sid = s.id || '(missing id)';

    if (!isNonEmptyString(s.id)) { error(file, sid, 'missing id'); continue; }
    if (ids.has(s.id)) { duplicateIds.add(s.id); error(file, sid, 'duplicate scenario id'); }
    ids.add(s.id);

    if (!isNonEmptyString(s.title)) error(file, sid, 'missing title');
    if (!VALID_BRANCHES.has(s.branch)) error(file, sid, `branch "${s.branch}" not in: ${[...VALID_BRANCHES].join(', ')}`);
    if (!isNonEmptyString(s.doctrineArea)) error(file, sid, 'missing doctrineArea');
    if (!VALID_DIFFICULTIES.has(s.difficulty)) error(file, sid, `difficulty "${s.difficulty}" not in: ${[...VALID_DIFFICULTIES].join(', ')}`);
    if (!isNonEmptyString(s.description)) error(file, sid, 'missing description');

    if (!Array.isArray(s.steps) || s.steps.length === 0) {
      error(file, sid, 'steps must be a non-empty array');
      continue;
    }

    for (const step of s.steps) {
      const stepLabel = `${sid}/step-${step.number ?? '?'}`;
      if (typeof step.number !== 'number') error(file, stepLabel, 'step missing number');
      if (!VALID_STEP_TYPES.has(step.type)) error(file, stepLabel, `step.type "${step.type}" not in: ${[...VALID_STEP_TYPES].join(', ')}`);
      if (!isNonEmptyString(step.prompt)) error(file, stepLabel, 'step missing prompt');

      if (step.type === 'argument_builder') {
        if (!Array.isArray(step.argumentOptions) || step.argumentOptions.length === 0) {
          error(file, stepLabel, 'argument_builder step must have non-empty argumentOptions');
        }
      } else {
        // multiple_choice or counter_argument
        if (!Array.isArray(step.choices) || step.choices.length < 2) {
          error(file, stepLabel, 'step must have at least 2 choices');
        } else {
          for (const c of step.choices) {
            validateChoice(c, stepLabel, file);
          }
        }
      }
    }

    // Optional: hypoVariations
    if (s.hypoVariations !== undefined) {
      if (!Array.isArray(s.hypoVariations)) {
        error(file, sid, 'hypoVariations must be an array');
      } else {
        for (const h of s.hypoVariations) {
          validateHypo(h, sid, file);
        }
      }
    }
  }

  return ids;
}

// ── Cases Validation ─────────────────────────────────────────────────

function validateCases(cases, file) {
  if (!Array.isArray(cases)) {
    error(file, null, 'Expected top-level array');
    return new Set();
  }

  const ids = new Set();

  for (const c of cases) {
    const cid = c.id || '(missing id)';
    if (!isNonEmptyString(c.id)) { error(file, cid, 'missing id'); continue; }
    if (ids.has(c.id)) error(file, cid, 'duplicate case id');
    ids.add(c.id);

    if (!isNonEmptyString(c.name)) error(file, cid, 'missing name');
    if (c.year !== null && typeof c.year !== 'number') error(file, cid, 'year must be a number or null');
    if (!isNonEmptyString(c.citation)) error(file, cid, 'missing citation');
    if (!isNonEmptyString(c.holding)) error(file, cid, 'missing holding');
    if (!isNonEmptyString(c.significance)) error(file, cid, 'missing significance');
    if (!Array.isArray(c.doctrineAreas)) error(file, cid, 'doctrineAreas must be an array');
    // keyQuote can be empty string for some cases
    if (typeof c.keyQuote !== 'string') error(file, cid, 'keyQuote must be a string');
  }

  return ids;
}

// ── Campaign Validation ──────────────────────────────────────────────

function validateCampaign(campaign, scenarioIds, file) {
  if (typeof campaign !== 'object' || campaign === null) {
    error(file, null, 'Expected top-level object');
    return;
  }

  if (!Array.isArray(campaign.regions)) {
    error(file, null, 'missing regions array');
  }

  if (!Array.isArray(campaign.nodes)) {
    error(file, null, 'missing nodes array');
    return;
  }

  const nodeIds = new Set();

  for (const node of campaign.nodes) {
    const nid = node.id || '(missing id)';
    if (!isNonEmptyString(node.id)) { error(file, nid, 'missing node id'); continue; }
    if (nodeIds.has(node.id)) error(file, nid, 'duplicate node id');
    nodeIds.add(node.id);

    if (!isNonEmptyString(node.scenarioId)) {
      error(file, nid, 'missing scenarioId');
    } else if (!scenarioIds.has(node.scenarioId)) {
      error(file, nid, `scenarioId "${node.scenarioId}" not found in scenarios.json`);
    }

    for (const req of (node.requiresAll || [])) {
      // We validate after all nodes are collected
    }
  }

  // Validate prerequisites reference valid node IDs
  for (const node of campaign.nodes) {
    for (const req of (node.requiresAll || [])) {
      if (!nodeIds.has(req)) error(file, node.id, `requiresAll references unknown node "${req}"`);
    }
    for (const req of (node.requiresAny || [])) {
      if (!nodeIds.has(req)) error(file, node.id, `requiresAny references unknown node "${req}"`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────

console.log('Validating data files...\n');

console.log('📄 data/scenarios.json');
const scenarios = loadJSON('data/scenarios.json');
const scenarioIds = scenarios ? validateScenarios(scenarios, 'scenarios.json') : new Set();
if (scenarios) console.log(`   ${scenarioIds.size} scenarios checked`);

console.log('\n📄 data/cases.json');
const cases = loadJSON('data/cases.json');
const caseIds = cases ? validateCases(cases, 'cases.json') : new Set();
if (cases) console.log(`   ${caseIds.size} cases checked`);

console.log('\n📄 data/campaigns.json');
const campaign = loadJSON('data/campaigns.json');
if (campaign) validateCampaign(campaign, scenarioIds, 'campaigns.json');

console.log('\n' + '─'.repeat(50));
if (errorCount > 0) {
  console.error(`\n❌ Validation failed: ${errorCount} error(s), ${warnCount} warning(s)`);
  process.exit(1);
} else {
  console.log(`\n✅ All data files valid. ${warnCount > 0 ? `${warnCount} warning(s).` : 'No warnings.'}`);
  process.exit(0);
}
