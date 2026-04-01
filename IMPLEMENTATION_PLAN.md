# Checks & Balances — Implementation Plan

This plan covers every improvement identified during the codebase analysis. Items are organized into six phases by priority and dependency order. Each item specifies the exact files to touch, the functions to add or modify, and any schema changes required.

---

## Phase 1 — Quick Wins (no schema changes, isolated)

These are self-contained changes that can each be completed in a single sitting and have no downstream dependencies.

---

### 1.1 Persist Dark Mode Preference

**Problem:** The dark-mode class toggle in `ui.js` reads from `localStorage` on `initDarkModeToggle()` but the toggle button does not save the new value when clicked.

**Files:** `ui.js`

**Changes:**
- In `initDarkModeToggle()`, locate the click handler on `#dark-mode-toggle`.
- After applying or removing the `dark` class on `document.documentElement`, add:
  ```js
  localStorage.setItem('cb-dark-mode', document.documentElement.classList.contains('dark'));
  ```
- Confirm the read path at the top of `initDarkModeToggle()` already does:
  ```js
  if (localStorage.getItem('cb-dark-mode') === 'true') { … }
  ```
  If it does, no further change needed there.

**LocalStorage key involved:** `cb-dark-mode` (already exists, just not written on toggle)

**Complexity:** XS — one line of code.

---

### 1.2 Cap Analytics History to Prevent LocalStorage Overflow

**Problem:** `analytics.js` prepends every completed session to an unbounded array stored under `cb-sim-analytics-v1`. Heavy users will eventually exceed the ~5 MB localStorage limit.

**Files:** `analytics.js`

**Changes:**
- Define a constant at the top of the file:
  ```js
  const MAX_STORED_SESSIONS = 100;
  ```
- In `recordCompletedSession(sessionSummary)`, after the `unshift` call, add:
  ```js
  if (history.length > MAX_STORED_SESSIONS) {
    history.splice(MAX_STORED_SESSIONS);
  }
  ```
- No UI change required. The CSV export already works from the in-memory array.

**Complexity:** XS — three lines.

---

### 1.3 Add Explicit Error State for Failed Data Loads

**Problem:** If `scenarios.json`, `campaigns.json`, or `cases.json` fail to fetch, the game renders a blank screen with no user-facing message.

**Files:** `game.js`, `ui.js`, `index.html`

**Changes:**

*index.html* — Add a hidden error screen element inside `<main>`:
```html
<section id="error-screen" class="screen" hidden aria-live="assertive">
  <div class="error-card">
    <h2>Something went wrong</h2>
    <p id="error-message">Could not load game data. Please refresh the page.</p>
    <button id="error-retry-btn" class="btn-primary">Try Again</button>
  </div>
</section>
```

*ui.js* — Export a new function:
```js
export function showError(message) {
  setText('error-message', message ?? 'Could not load game data. Please refresh.');
  showScreen('error-screen');
}
```

*game.js* — Wrap the top-level `init()` (or equivalent bootstrap) in a try/catch:
```js
try {
  const scenarios = await loadScenarioData();
  // … rest of init
} catch (err) {
  showError('Could not load scenario data — please check your connection and refresh.');
  document.getElementById('error-retry-btn')?.addEventListener('click', () => location.reload());
}
```

Apply the same pattern wherever `loadCampaignData()` and `loadCaseData()` are called.

**Complexity:** S — ~30 lines across three files.

---

### 1.4 Fix Service Worker Cache Versioning

**Problem:** The `MAP_UI_BUILD` string in `index.html` must be updated manually after every asset change, making stale-cache bugs likely.

**Files:** `package.json` (new), `scripts/bump-build.js` (new), `index.html`

**Changes:**

Create `scripts/bump-build.js`:
```js
import { readFileSync, writeFileSync } from 'fs';
const html = readFileSync('index.html', 'utf8');
const newBuild = Date.now().toString(36);
const updated = html.replace(
  /MAP_UI_BUILD\s*=\s*'[^']*'/,
  `MAP_UI_BUILD = '${newBuild}'`
);
writeFileSync('index.html', updated);
console.log(`Build stamp updated to: ${newBuild}`);
```

Create `package.json` (if not already present):
```json
{
  "name": "checks-and-balances",
  "type": "module",
  "scripts": {
    "build": "node scripts/bump-build.js",
    "serve": "python3 -m http.server 8080"
  }
}
```

Add a note to `CONTRIBUTING.md` to run `npm run build` before deploying.

**Complexity:** S — new file, no logic changes.

---

## Phase 2 — UX Improvements

These changes improve the experience without altering game mechanics or data schemas.

---

### 2.1 Make the Campaign Precedent System Visible

**Problem:** The campaign precedent system dynamically reframes later scenarios based on earlier choices, but players never receive any indication that this is happening. The mechanic is invisible and its educational value is lost.

**Files:** `game.js`, `scenarios.js`, `ui.js`, `index.html`, `styles.css`

**Approach:** When a scenario's content has been modified by an active precedent, display a "precedent banner" above the scenario description.

**Changes:**

*index.html* — Add a banner element inside the `#game-screen`, above `#scenario-description`:
```html
<div id="precedent-banner" class="precedent-banner" hidden>
  <span class="precedent-icon">⚖️</span>
  <p id="precedent-banner-text"></p>
</div>
```

*styles.css* — Add styling:
```css
.precedent-banner {
  background: var(--color-accent-light);
  border-left: 3px solid var(--color-accent);
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
```

*game.js* — When applying `precedentConditions` to a scenario, collect the triggered conditions into an array. Pass the list to the renderer:
```js
// Existing precedent application loop — already produces a modified scenario clone.
// Add: collect human-readable labels for each matched condition.
const triggeredPrecedents = [];
for (const cond of scenario.precedentConditions ?? []) {
  if (gameState.precedentState[cond.key] === cond.value) {
    triggeredPrecedents.push(cond.label ?? `Your earlier ruling on ${cond.key} applies here.`);
  }
}
// Pass to renderer:
renderScenario(modifiedScenario, stepIndex, onChoice, { triggeredPrecedents });
```

*scenarios.js* — Accept the new option in `renderScenario`:
```js
export function renderScenario(scenario, stepIndex, onChoiceCallback, options = {}) {
  const { triggeredPrecedents = [] } = options;
  const banner = document.getElementById('precedent-banner');
  if (triggeredPrecedents.length > 0) {
    setText('precedent-banner-text', triggeredPrecedents.join(' · '));
    banner?.removeAttribute('hidden');
  } else {
    banner?.setAttribute('hidden', '');
  }
  // … rest of existing render logic
}
```

*data/scenarios.json* — For each `precedentCondition` entry, add an optional `"label"` string:
```json
{
  "key": "strongExecutiveAuthority",
  "value": true,
  "label": "Your earlier ruling established broad executive authority."
}
```
This is additive and backward-compatible — the `??` fallback handles missing labels.

**Complexity:** M — touches 5 files, but each change is small and localized.

---

### 2.2 Add Onboarding for First-Time Users

**Problem:** The landing screen immediately presents mode/difficulty choices with no explanation of what the game is or how it works.

**Files:** `index.html`, `ui.js`, `progress.js`, `styles.css`

**Approach:** Show a one-time "welcome" modal on the first visit. After dismissal, set a flag so it never appears again.

**Changes:**

*index.html* — Add a welcome modal (can reuse the existing `#app-modal` pattern):
```html
<!-- Welcome modal content template (injected via JS) -->
```

*progress.js* — Add a `firstVisit` boolean to the profile skeleton:
```js
// In buildProfileSkeleton():
firstVisit: true,
```
On profile load, if `profile.firstVisit` is true, set to false and save.

*ui.js* — Export a `showWelcomeModal()` function that calls `populateAppModal` with:
- Title: "Welcome to Checks & Balances"
- Body: 2–3 sentence pitch + a "How to Play" accordion with the three modes explained
- Confirm text: "Start Playing"

*game.js* — In the boot sequence, after loading the profile:
```js
if (profile.firstVisit) {
  showWelcomeModal();
}
```

**Complexity:** M — new modal content, one profile field, ~50 lines total.

---

### 2.3 Visual Progress Indicator for Standard Mode

**Problem:** Standard mode shows "Scenario 3 of 10" as a text string. The campaign has a map, but standard mode has no equivalent visual orientation.

**Files:** `index.html`, `ui.js`, `styles.css`

**Approach:** Add a doctrine-area stepper above the scenario in standard/exam mode. Each segment represents a scenario, colored by branch (judiciary/president/congress) and filled in as completed.

**Changes:**

The `updateProgressBar` function in `ui.js` already renders progress segments in `#progress-bar`. Extend it to also render a doctrine label below each completed segment when hovering:

```js
// In updateProgressBar(), add data attributes to each segment:
segment.dataset.doctrineArea = history[i]?.doctrineArea ?? '';
segment.title = history[i]?.doctrineArea ?? 'Upcoming';
```

Add a CSS tooltip via `[data-doctrine-area]::after` that shows the doctrine area on hover. This requires no new HTML elements.

For a richer version (Phase 3+ scope), replace the bar with a horizontal stepper where each node is a branch icon — but the tooltip approach is a quick win that adds meaningful context.

**Complexity:** S — augments existing `updateProgressBar`, ~20 lines + CSS.

---

### 2.4 Mobile Argument Builder Improvements

**Problem:** The argument builder step type renders a list of checkboxes that becomes cramped on small screens. The submit button may be off-screen.

**Files:** `scenarios.js`, `styles.css`

**Changes:**

*styles.css* — Add responsive rules:
```css
@media (max-width: 640px) {
  .argument-option-label {
    font-size: 0.9rem;
    padding: 0.6rem;
  }
  #argument-builder-container {
    gap: 0.5rem;
  }
  .argument-submit-btn {
    position: sticky;
    bottom: 1rem;
    width: 100%;
  }
}
```

*scenarios.js* — In `renderArgumentBuilder`, add a sticky-positioned submit button wrapper:
```js
const stickyWrap = document.createElement('div');
stickyWrap.className = 'argument-submit-sticky';
stickyWrap.appendChild(submitBtn);
container.appendChild(stickyWrap);
```

Also add a "Jump to choices" anchor link at the top of long scenario descriptions on mobile:
```js
// In renderScenario, if description > 300 chars, add:
const jumpLink = document.createElement('a');
jumpLink.href = '#choices-container';
jumpLink.className = 'jump-to-choices sr-only-mobile';
jumpLink.textContent = 'Jump to answer choices ↓';
```

**Complexity:** S — CSS + minor JS changes.

---

## Phase 3 — Gameplay Mechanics

These changes alter how the game plays, requiring more care around state and scoring.

---

### 3.1 Reframe Difficulty as Content-Level Differentiation

**Problem:** Easy/Medium/Hard difficulty currently only changes the score multiplier (`DIFFICULTY_MULTIPLIERS`). This is not educationally meaningful — a student choosing "Easy" gets the same questions with less scoring pressure.

**Proposed model:**
- **Easy:** Doctrine tag shown above scenario title (already partially done via `#doctrine-tag`). Distractors in choices are clearly wrong. Hint available.
- **Medium:** Doctrine tag hidden. All distractors are plausible. No hint.
- **Hard:** Doctrine tag hidden. One additional "trap" choice added per step. Explanation is shown only after all steps are complete (not per-step).

**Files:** `data/scenarios.json`, `scenarios.js`, `game.js`, `ui.js`, `scoring.js`

**Schema change — scenarios.json:** Add optional `trapChoice` field to each step:
```json
{
  "id": "choice-trap-1",
  "text": "The President's emergency powers under Article II are plenary and override Congress in all wartime contexts.",
  "points": 0,
  "correct": "incorrect",
  "explanation": "This overstates the Youngstown framework's Zone 1. Even Zone 1 authority has constitutional limits.",
  "trapOnly": true
}
```

*scenarios.js* — In `renderScenario`, filter choices by difficulty:
```js
const effectiveDifficulty = options.difficulty ?? 'medium';
const choices = step.choices.filter(c =>
  effectiveDifficulty === 'hard' ? true : !c.trapOnly
);
```

*ui.js* — Hide `#doctrine-tag` on medium and hard:
```js
export function applyDifficultyPresentation(difficulty) {
  const doctrineTag = document.getElementById('doctrine-tag');
  if (doctrineTag) {
    doctrineTag.hidden = difficulty !== 'easy';
  }
}
```

*game.js* — Call `applyDifficultyPresentation(gameState.difficulty)` when rendering each scenario.

For the hard-mode deferred per-step feedback: in `game.js`, where the feedback modal is triggered after each step, add a condition:
```js
const deferFeedback = gameState.difficulty === 'hard' && gameState.mode !== 'examPrep';
if (!deferFeedback) {
  showFeedbackModal(…);
} else {
  // Record choice silently and advance
  advanceStep();
}
```
At scenario end on hard mode, show a combined feedback view similar to `renderExamReview`.

**Complexity:** L — touches 5 files, requires new JSON fields, new render logic path, and a combined feedback view.

---

### 3.2 Add "Hypo Variation" Follow-Up Questions

**Problem:** The game plays through scenarios linearly. Law professors teach through variations — "what if the facts were slightly different?" — and this mechanic is missing.

**Approach:** After each scenario's feedback modal is dismissed, optionally display 1–2 quick single-step "variation" scenarios that reuse the same doctrine context but change one fact.

**Files:** `data/scenarios.json`, `scenarios.js`, `game.js`

**Schema change — scenarios.json:** Add an optional `hypoVariations` array to any scenario:
```json
"hypoVariations": [
  {
    "id": "hypo-youngstown-1",
    "prompt": "What if Congress had passed a statute explicitly authorizing the President's seizure action?",
    "choices": [
      {
        "text": "The seizure would clearly be constitutional — this would be Zone 1 authority.",
        "correct": true,
        "explanation": "Correct. With congressional authorization, the President acts at the apex of constitutional power under the Youngstown framework."
      },
      {
        "text": "The constitutional analysis wouldn't change — the President's Article II power is independent.",
        "correct": "incorrect",
        "explanation": "This misreads Youngstown. Congressional authorization moves the action from Zone 2 (or 3) to Zone 1."
      }
    ]
  }
]
```

*game.js* — Add `pendingHypos` to game state. After a scenario completes and feedback is dismissed:
```js
// After renderFeedback onContinue callback:
const hypos = currentScenario.hypoVariations ?? [];
if (hypos.length > 0 && !gameState.practiceOnly) {
  gameState.pendingHypos = [...hypos];
  showNextHypo();
} else {
  advanceScenario();
}
```

Add `showNextHypo()`:
```js
function showNextHypo() {
  const hypo = gameState.pendingHypos.shift();
  if (!hypo) { advanceScenario(); return; }
  renderHypoVariation(hypo, (wasCorrect) => {
    announce(wasCorrect ? 'Correct variation analysis!' : 'Review the explanation and continue.');
    showNextHypo();
  });
}
```

*scenarios.js* — Add `renderHypoVariation(hypo, onComplete)`: a lightweight single-step render (no scoring impact, purely educational). Use existing `renderScenario` patterns but render to a distinct `#hypo-container` with a "Hypo Check" header.

**Complexity:** L — new JSON schema, new state field, new render function, ~100 lines.

---

### 3.3 Spaced Repetition / Weak Spots Mode

**Problem:** The game has no mechanism to resurface scenarios a player consistently struggles with.

**Files:** `analytics.js`, `progress.js`, `game.js`, `index.html`, `styles.css`

**Approach:** Add a "Weak Spots" mode option on the landing screen that builds a scenario queue from the player's worst-performing doctrine areas.

**Changes:**

*analytics.js* — `getWeakestDoctrines(history, limit)` already exists. Add:
```js
export function getWeakScenarioIds(history, threshold = 0.65) {
  // Group by scenarioId, compute average accuracy
  const byScenario = {};
  for (const session of history) {
    for (const s of session.scenarios) {
      if (!byScenario[s.scenarioId]) byScenario[s.scenarioId] = { total: 0, attempts: 0 };
      byScenario[s.scenarioId].total += s.scoreEarned / (s.maxScore || 1);
      byScenario[s.scenarioId].attempts += 1;
    }
  }
  return Object.entries(byScenario)
    .filter(([, v]) => v.attempts >= 2 && (v.total / v.attempts) < threshold)
    .map(([id]) => id);
}
```

*index.html* — Add a "Weak Spots" button to the mode selector on the landing screen. Grey it out if `getWeakScenarioIds` returns an empty array (first-time users have no data yet):
```html
<button id="weak-spots-btn" class="mode-btn" data-mode="weakSpots">
  Weak Spots <span class="badge">Review</span>
</button>
```

*game.js* — Handle `mode === 'weakSpots'` in `startGame()`:
```js
if (gameState.mode === 'weakSpots') {
  const history = await loadAnalyticsHistory();
  const weakIds = getWeakScenarioIds(history);
  if (weakIds.length === 0) {
    showError('Play at least 2 sessions first to unlock Weak Spots mode.');
    return;
  }
  gameState.orderedScenarioIds = weakIds.slice(0, 10); // cap at 10
  gameState.totalScenarios = gameState.orderedScenarioIds.length;
}
```

**Complexity:** M — new utility function, new mode, ~60 lines.

---

## Phase 4 — Content Expansion

These changes require subject-matter expertise in constitutional law. The implementation scaffolding is described here; the actual content (question text, case citations, explanations) must be authored by a constitutional law expert.

---

### 4.1 Add Constitutional Rights Scenarios (First, Fourth, Fourteenth Amendments)

**Problem:** The game covers separation of powers and federalism well but omits individual rights doctrines that appear on every con law exam.

**Files:** `data/scenarios.json`

**Approach:** Add a new `doctrineArea` category for each amendment area. No code changes are needed — the rendering pipeline is fully data-driven.

**Suggested new scenarios (12 total):**
- First Amendment (5): Free speech (content vs. conduct), Establishment Clause (Lemon test → *Kennedy v. Bremerton*), Free Exercise (*Employment Division v. Smith*, RFRA), prior restraint
- Fourth Amendment (4): Reasonable expectation of privacy (*Katz*), third-party doctrine (*Carpenter*), exigent circumstances, standing to challenge searches
- Fourteenth Amendment (3): Substantive due process tiers, equal protection strict/intermediate/rational basis, incorporation doctrine

**Schema:** No changes needed. Use existing `branch: "judiciary"` for all new scenarios.

**Campaign integration:** Add a new region `"individual-rights"` to `data/campaigns.json` with nodes for each new scenario. Add appropriate `requiresAll` unlock gates.

---

### 4.2 Add Post-2020 Landmark Cases

**Problem:** The case library and scenarios don't reflect the most recent major decisions.

**Files:** `data/cases.json`, `data/scenarios.json`

**Cases to add to `cases.json`:**
- *West Virginia v. EPA* (2022) — Major questions doctrine
- *Seila Law v. CFPB* (2020) — Removal power, unitary executive
- *Trump v. United States* (2024) — Presidential immunity
- *Dobbs v. Jackson Women's Health* (2022) — Substantive due process
- *303 Creative v. Elenis* (2023) — Free speech, compelled speech
- *Kennedy v. Bremerton School District* (2022) — Free Exercise/Establishment
- *Bruen* (2022) — Second Amendment (historical test)

Each case entry follows the existing schema in `cases.json`:
```json
{
  "id": "west-virginia-v-epa",
  "shortName": "West Virginia v. EPA",
  "fullName": "West Virginia v. Environmental Protection Agency",
  "citation": "597 U.S. 697 (2022)",
  "holding": "…",
  "significance": "…",
  "doctrineAreas": ["administrative-state", "non-delegation"],
  "keyQuote": "…"
}
```

Then add or update scenarios in `scenarios.json` to reference these cases in their `caseReferences` arrays and explanations.

---

### 4.3 Improve Feedback Explanation Quality

**Problem:** Post-answer explanations are often a single sentence stating the rule. They don't explain why wrong answers are tempting or how to distinguish close calls.

**Files:** `data/scenarios.json`

**Schema change:** Add two new optional fields to each `choice`:
```json
{
  "explanation": "The existing one-line explanation.",
  "whyTempting": "This answer is appealing because it correctly identifies that the President has Article II authority — but it misses the Youngstown limitation when Congress has spoken to the contrary.",
  "distinguishingPrinciple": "The key is whether this falls in Zone 2 (congressional silence) or Zone 3 (congressional prohibition)."
}
```

*scenarios.js* — In `renderFeedback`, check for these fields and render them as expandable "Why is this tempting?" sections below the main explanation:
```js
if (choice.whyTempting) {
  html += `<details class="why-tempting">
    <summary>Why is this answer tempting?</summary>
    <p>${escapeHtml(choice.whyTempting)}</p>
  </details>`;
}
```

This is additive and backward-compatible — existing scenarios without these fields are unaffected.

**Complexity:** S (code) + L (content authoring for all 39 scenarios).

---

## Phase 5 — Metagame & Engagement

---

### 5.1 Doctrine-Specific Achievements

**Problem:** Achievements are generic (streaks, completion counts). They don't reinforce specific doctrinal learning.

**Files:** `data/achievements.json`, `achievements.js`

**New achievement rule type:** Add `doctrineAccuracy` to `achievements.js`'s switch statement:
```js
case 'doctrineAccuracy': {
  const dm = profile.doctrineMastery[buildDoctrineId(rule.doctrineArea)];
  return dm && dm.attempts >= rule.minAttempts && dm.accuracy >= rule.threshold;
}
```

**New achievement entries in `achievements.json`:**
```json
[
  {
    "id": "youngstown-master",
    "title": "Steel Seizure Scholar",
    "description": "Achieved 90%+ accuracy on Youngstown-framework scenarios (minimum 3 attempts).",
    "type": "doctrineAccuracy",
    "doctrineArea": "Youngstown Framework",
    "threshold": 0.9,
    "minAttempts": 3,
    "icon": "⚙️"
  },
  {
    "id": "commerce-master",
    "title": "Commerce Clause Expert",
    "description": "Achieved 85%+ accuracy on Commerce Clause scenarios (minimum 3 attempts).",
    "type": "doctrineAccuracy",
    "doctrineArea": "Commerce Clause",
    "threshold": 0.85,
    "minAttempts": 3,
    "icon": "🏪"
  }
]
```

Add similar entries for: Non-Delegation, Anti-Commandeering, Spending Power, Standing, Political Question, Foreign Affairs.

---

### 5.2 Show Previous Best Score Before Starting a Scenario

**Problem:** Players have no replay motivation when starting a previously-played scenario from the library.

**Files:** `library.js`, `progress.js`, `styles.css`

**Changes:**

*library.js* — When rendering a scenario card, check `profile.scenarioProgress[scenario.id]`:
```js
const progress = profile.scenarioProgress?.[scenario.id];
if (progress?.completed) {
  const bestPct = Math.round(progress.bestPercent);
  card.innerHTML += `<p class="best-score">Your best: ${bestPct}% · ${'★'.repeat(progress.stars)}${'☆'.repeat(3 - progress.stars)}</p>`;
}
```

In the scenario detail view (if one exists) or directly on the card, show a "Beat your best" callout when the card is hovered/focused.

**Complexity:** S — augments existing card render logic, ~15 lines.

---

### 5.3 Instructor Dashboard (Read-Only Aggregate View)

**Problem:** There is no way for an instructor to understand how a class of students is performing.

**Approach (Phase A — client-only):** Add an "Export Class Report" button to the analytics dashboard that generates a structured JSON export. Students share this file with the instructor, who can open it in a separate "Instructor Import" view.

**Approach (Phase B — future backend):** If a backend is ever added, this becomes a real-time dashboard. Phase A is all client-side.

**Files:** `analytics.js`, `dashboard.js`, `index.html`

**Changes — Phase A:**

*analytics.js* — Add `exportClassReport()`:
```js
export function exportClassReport(history) {
  const breakdown = getDoctrineBreakdown(history);
  return {
    exportedAt: new Date().toISOString(),
    totalSessions: history.length,
    overallAccuracy: getAnalyticsSummary(history).averageScore,
    byDoctrine: breakdown,
    weakestDoctrines: getWeakestDoctrines(history, 5),
  };
}
```

*dashboard.js* — Add an "Export Report" button that calls `exportClassReport`, serializes to JSON, and triggers a download.

*index.html* — Add an `<input type="file">` on the dashboard screen for instructors to import a report JSON and view it (renders the same dashboard charts but for the imported data).

**Complexity:** M — new utility + file import/export UI, ~80 lines.

---

### 5.4 Cross-Link Codex Cases with Scenarios

**Problem:** The case codex is a static reference that isn't connected to the scenario where each case appears.

**Files:** `cases.js`, `library.js`, `data/cases.json`

**Schema change — cases.json:** Add `scenarioIds` array to each case entry:
```json
{
  "id": "youngstown-sheet-tube",
  "scenarioIds": ["scenario-001", "scenario-014"]
}
```
(This can be auto-generated by a script that scans `scenarios.json` for `caseReferences` entries.)

*cases.js* — In the case popup renderer, add a "Appears in scenarios:" section:
```js
if (caseData.scenarioIds?.length > 0) {
  html += `<div class="case-scenarios"><strong>Appears in:</strong> `;
  html += caseData.scenarioIds.map(id =>
    `<button class="case-scenario-link" data-scenario-id="${id}">${id}</button>`
  ).join(', ');
  html += '</div>';
}
```

Wire the button click to navigate to that scenario in the library view.

**Complexity:** S (code) + S (script to populate `scenarioIds`).

---

## Phase 6 — Technical Debt & Infrastructure

---

### 6.1 Add Headless CI Test Runner

**Problem:** Tests only run in-browser via `tests/index.html`. There is no automated check on pull/push.

**Files:** `package.json`, `scripts/run-tests.js` (new), `.github/workflows/test.yml` (new)

**Approach:** Use Playwright to load `tests/index.html` in a headless browser and scrape the test results.

*scripts/run-tests.js:*
```js
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
// Serve locally first (use http-server or serve)
await page.goto('http://localhost:8080/tests/index.html');
await page.waitForSelector('#test-complete'); // Add this ID to tests/index.html when all tests finish
const failures = await page.$$eval('.test-fail', els => els.map(e => e.textContent));
await browser.close();
if (failures.length > 0) {
  console.error('Test failures:', failures);
  process.exit(1);
}
```

*.github/workflows/test.yml:*
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm install
      - run: npx playwright install chromium
      - run: npm test
```

**Complexity:** M — new tooling, no game logic changes.

---

### 6.2 Lazy-Load Scenario Data by Region

**Problem:** `scenarios.json` is 437 KB loaded synchronously at startup. As content grows this will hurt perceived performance.

**Files:** `data/scenarios.json` (split), `scenarios.js`, `game.js`

**Approach:** Split `scenarios.json` into per-doctrine-area files:
```
data/scenarios/executive-power.json
data/scenarios/administrative-state.json
data/scenarios/federalism.json
data/scenarios/foreign-affairs.json
data/scenarios/justiciability.json
data/scenarios/index.json  ← manifest listing available files + scenario IDs per file
```

*scenarios.js* — Change `loadScenarioData()` to:
1. Fetch `data/scenarios/index.json` (tiny, ~2 KB)
2. Fetch only the files needed for the current mode/difficulty on demand
3. Cache fetched files in a module-level Map

```js
const scenarioCache = new Map();

export async function loadScenariosForIds(ids) {
  const index = await loadScenarioIndex(); // fetches index.json
  const neededFiles = new Set(ids.map(id => index.fileForId[id]));
  await Promise.all([...neededFiles].map(async file => {
    if (!scenarioCache.has(file)) {
      const res = await fetch(`./data/scenarios/${file}`);
      const data = await res.json();
      data.forEach(s => scenarioCache.set(s.id, s));
    }
  }));
  return ids.map(id => scenarioCache.get(id));
}
```

*sw.js* — Update `APP_SHELL` to list the new per-file paths instead of the monolithic file.

**Complexity:** L — requires splitting the data file (scriptable) and updating the fetch layer, but no game logic changes.

---

## Implementation Order Summary

| Phase | Item | Complexity | Priority |
|-------|------|------------|----------|
| 1 | 1.1 Persist dark mode | XS | P0 |
| 1 | 1.2 Cap analytics storage | XS | P0 |
| 1 | 1.3 Error state for failed loads | S | P0 |
| 1 | 1.4 Build stamp automation | S | P1 |
| 2 | 2.1 Precedent banner | M | P0 |
| 2 | 2.2 First-visit onboarding | M | P1 |
| 2 | 2.3 Standard mode stepper | S | P1 |
| 2 | 2.4 Mobile argument builder | S | P1 |
| 3 | 3.1 Difficulty differentiation | L | P1 |
| 3 | 3.2 Hypo variation system | L | P1 |
| 3 | 3.3 Weak spots mode | M | P1 |
| 4 | 4.1 Constitutional rights scenarios | L (content) | P2 |
| 4 | 4.2 Post-2020 cases | M (content) | P2 |
| 4 | 4.3 Richer feedback explanations | S+L (content) | P1 |
| 5 | 5.1 Doctrine achievements | M | P2 |
| 5 | 5.2 Previous best score in library | S | P1 |
| 5 | 5.3 Instructor dashboard | M | P2 |
| 5 | 5.4 Codex ↔ scenario cross-links | S | P2 |
| 6 | 6.1 Headless CI tests | M | P2 |
| 6 | 6.2 Lazy scenario loading | L | P3 |

**P0** = Fix immediately (bugs / data integrity)
**P1** = High value, implement next sprint
**P2** = Important but not blocking
**P3** = Future optimization
