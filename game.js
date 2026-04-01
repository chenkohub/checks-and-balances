/**
 * game.js
 * App bootstrap plus current-run orchestration.
 */

import {
  loadScenarioData,
  renderScenario,
  renderArgumentBuilder,
  renderCounterArgument,
  renderFeedback,
  renderHypoVariation,
  renderEndGame,
  renderExamReview
} from './scenarios.js';
import {
  normalizeOutcome,
  calculateChoicePoints,
  calculateArgumentBuilderPoints,
  calculateGrade,
  getScenarioMaxPoints
} from './scoring.js';
import {
  showScreen,
  updateBranchIndicator,
  updateProgressBar,
  updateScore,
  updateTimerDisplay,
  flashChoiceResult,
  initDarkModeToggle,
  populateAppModal,
  hideModal,
  announce,
  showToast,
  setAppShellContext,
  renderMentorPanel,
  animateRewardStrip
} from './ui.js';
import {
  startTimer,
  restoreTimer,
  pauseTimer,
  resumeTimer,
  extendTimer,
  getTimerState,
  stopTimer
} from './timer.js';
import {
  recordCompletedSession,
  downloadAnalyticsCsv,
  clearAnalyticsHistory,
  loadAnalyticsHistory,
  getWeakScenarioIds
} from './analytics.js';
import {
  loadPlayerProfile,
  loadCampaignData,
  applySessionProgress,
  computeCompletionSummary,
  getScenarioProgress,
  setSandboxEnabled,
  clearPlayerProfile,
  savePlayerProfile,
  setMentorCharacter
} from './progress.js';
import { renderDashboard } from './dashboard.js';
import { renderCampaignMap } from './map.js';
import { renderLibrary } from './library.js';
import { markAchievementsSeen, loadAchievementDefinitions } from './achievements.js';
import {
  getHomeMentorContent,
  getResultsMentorContent,
  getCodexMentorContent,
  loadCharacterData
} from './character.js';
import { loadCaseData, getAllCases } from './cases.js';
import { initRouter, navigate, getCurrentRoute, registerScreen } from './router.js';

export const SAVE_STORAGE_KEY = 'cb-sim-session-v1';
export const PREFERENCES_STORAGE_KEY = 'cb-sim-preferences-v1';

export const campaignOrder = Object.freeze([
  'youngstown-steel-seizure',
  'the-subpoenaed-tapes',
  'presidential-immunity-framework',
  'ins-v-chadha-legislative-veto',
  'nondelegation-intelligible-principle',
  'epa-carbon-major-questions',
  'removal-independent-agency-head',
  'mcculloch-modern-bank',
  'spending-clause-coercion',
  'the-school-zone-statute',
  'the-home-garden-prohibition',
  'the-purchase-mandate',
  'the-waste-disposal-directive',
  'state-wine-shipping-ban',
  'dormant-commerce-clause-flow-control',
  'the-foreign-arms-embargo',
  'the-hostage-crisis-executive-agreement',
  'the-unilateral-bombing-campaign',
  'environmental-standing',
  'the-partisan-gerrymander-challenge',
  'president-refuses-court-order',
  'equal-protection-scrutiny-framework',
  'school-admissions-test-disparate-impact',
  'male-parental-leave-discrimination',
  'food-truck-licensing-ban',
  'disparate-impact-intent-framework',
  'grand-jury-incorporation',
  'post-dobbs-six-week-ban'
]);

export const PRECEDENT_METADATA = Object.freeze({
  strongExecutiveAuthority: {
    name: 'Executive Authority',
    trueLabel: 'Broad unilateral executive power recognized',
    falseLabel: 'Executive power constrained by legislative structure'
  },
  permissiveNonDelegation: {
    name: 'Non-Delegation',
    trueLabel: 'Permissive delegation view adopted',
    falseLabel: 'Delegation skepticism strengthened'
  },
  strongUnitaryExecutive: {
    name: 'Unitary Executive',
    trueLabel: 'Strong presidential removal power embraced',
    falseLabel: 'Agency independence preserved'
  },
  strictBicameralismPresentment: {
    name: 'Article I Procedure',
    trueLabel: 'Strict bicameralism and presentment enforced',
    falseLabel: 'Functional congressional shortcuts tolerated'
  },
  broadCommerceClause: {
    name: 'Commerce Clause',
    trueLabel: 'Broad federal commerce power recognized',
    falseLabel: 'Commerce power meaningfully limited'
  },
  expansiveSpendingPower: {
    name: 'Conditional Spending',
    trueLabel: 'Expansive spending leverage accepted',
    falseLabel: 'Coercive spending constrained'
  },
  strongAntiCommandeering: {
    name: 'Anti-Commandeering',
    trueLabel: 'Federal commands to states sharply limited',
    falseLabel: 'More room for federal direction of states'
  },
  expansivePresidentialImmunity: {
    name: 'Presidential Immunity',
    trueLabel: 'Broad immunity precedent established',
    falseLabel: 'Unofficial-act accountability preserved'
  },
  strongExecutiveConfidentiality: {
    name: 'Executive Confidentiality',
    trueLabel: 'Confidentiality interests prioritized',
    falseLabel: 'Criminal justice interests prioritized'
  },
  broadWarPowers: {
    name: 'War Powers',
    trueLabel: 'Broad unilateral war powers emphasized',
    falseLabel: 'Congressional war role emphasized'
  },
  robustPoliticalQuestionDoctrine: {
    name: 'Political Question',
    trueLabel: 'Judicial restraint in political questions expanded',
    falseLabel: 'Courts remain willing to reach the merits'
  },
  strongForeignAffairsDeference: {
    name: 'Foreign Affairs Deference',
    trueLabel: 'Deference to crisis-management authority strengthened',
    falseLabel: 'Textual limits on foreign-affairs authority emphasized'
  },
  heightenedScrutinyForRace: {
    name: 'Racial Scrutiny',
    trueLabel: 'Strict scrutiny applied to racial classifications',
    falseLabel: 'Lower scrutiny applied to racial classifications'
  },
  intentRequiredForEP: {
    name: 'Discriminatory Intent',
    trueLabel: 'Discriminatory intent required for EP violation',
    falseLabel: 'Disparate impact alone may trigger EP concerns'
  },
  animusInvalidatesLaw: {
    name: 'Legislative Animus',
    trueLabel: 'Courts probe actual legislative purpose for animus',
    falseLabel: 'Facial rational-basis justifications accepted'
  },
  geduldigPregnancyRule: {
    name: 'Pregnancy Classification',
    trueLabel: 'Pregnancy classifications are not sex-based (Geduldig)',
    falseLabel: 'Pregnancy classifications treated as sex-based'
  },
  selectiveIncorporation: {
    name: 'Incorporation Doctrine',
    trueLabel: 'Selective incorporation under McDonald applied',
    falseLabel: 'Alternative incorporation framework adopted'
  }
});

const MODE_DESCRIPTIONS = Object.freeze({
  standard:
    'Play through a shuffled set of scenarios with immediate feedback after each crisis.',
  examPrep:
    'Timed exam simulation. Feedback is deferred until the end. Exam Prep always uses hard-mode scoring and includes pause/extend controls for accessibility.',
  campaign:
    'Play the classic fixed campaign queue. Earlier rulings create precedents that reframe later crises.',
  freePlay:
    'Launch one scenario directly from the campaign map or library.',
  weakSpots:
    'Focus on scenarios where you score below 65%. Requires at least 2 recorded attempts per scenario before it qualifies.'
});

const FIRST_VISIT_KEY = 'cb-first-visit';

function isFirstVisit() {
  try {
    return !localStorage.getItem(FIRST_VISIT_KEY);
  } catch (_error) {
    return false;
  }
}

function showWelcomeModal() {
  if (!isFirstVisit()) {
    return;
  }
  try {
    localStorage.setItem(FIRST_VISIT_KEY, '1');
  } catch (_error) {
    // localStorage unavailable — skip modal
    return;
  }

  populateAppModal({
    title: '⚖️ Welcome to Checks & Balances',
    bodyHtml: `
      <p>This is an interactive constitutional law simulation. You'll work through real-world crisis scenarios and build doctrine-by-doctrine expertise in separation of powers, federalism, and structural constitutional law.</p>
      <details class="welcome-how-to-play" open>
        <summary><strong>How to play</strong></summary>
        <ul class="welcome-mode-list">
          <li><strong>Standard</strong> — Shuffled scenarios with immediate feedback. Good for exploring new doctrine.</li>
          <li><strong>Exam Prep</strong> — Timed simulation with deferred feedback. Mirrors bar exam conditions.</li>
          <li><strong>Campaign</strong> — A fixed sequence where earlier rulings reshape later scenarios. The full experience.</li>
          <li><strong>Weak Spots</strong> — Resurfaces scenarios you consistently struggle with, once you have play history.</li>
        </ul>
      </details>
      <p class="welcome-tip">Tip: Start with the <strong>Campaign</strong> to see how precedents compound across doctrine areas.</p>
    `,
    confirmText: 'Start Playing',
    closeOnOverlay: false
  });
}

function createInitialGameState() {
  return {
    sessionId: null,
    activeSession: false,
    mode: 'standard',
    difficulty: 'all',
    examTimerMinutes: 60,
    timerRemainingSeconds: 0,
    timerPaused: false,
    currentScenarioIndex: 0,
    currentStepIndex: 0,
    totalScenarios: 0,
    orderedScenarioIds: [],
    legitimacyPoints: 0,
    history: [],
    completedScenarioIds: [],
    precedentState: {},
    currentScenarioChoices: [],
    currentScenarioPoints: 0,
    currentScenarioMaxPoints: 0,
    elapsedMs: 0,
    startedAt: null,
    analyticsRecorded: false,
    launchContext: null,
    practiceOnly: false,
    resultsPayload: null,
    pendingHypos: []
  };
}

export const gameState = createInitialGameState();

let scenarioCatalog = [];
let campaignData = null;
let currentProfile = null;
let activeScenario = null;
let sessionClockId = null;
let bootstrapComplete = false;
let savedSessionPrompted = false;

function deepClone(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function currentScoreDifficulty() {
  return gameState.mode === 'examPrep' ? 'hard' : gameState.difficulty;
}

function sessionIsActive() {
  return Boolean(gameState.activeSession && gameState.orderedScenarioIds.length > 0);
}

function getPreferences() {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) || '{}');
  } catch (_error) {
    return {};
  }
}

function savePreferences() {
  const difficultySelect = document.getElementById('difficulty-select');
  const modeSelect = document.getElementById('mode-select');
  const timerSelect = document.getElementById('timer-select');

  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
    difficulty: difficultySelect?.value || 'all',
    mode: modeSelect?.value || 'standard',
    timerMinutes: Number(timerSelect?.value || 60)
  }));
}

function applyPreferencesToControls() {
  const preferences = getPreferences();
  const difficultySelect = document.getElementById('difficulty-select');
  const modeSelect = document.getElementById('mode-select');
  const timerSelect = document.getElementById('timer-select');

  if (difficultySelect && preferences.difficulty) {
    difficultySelect.value = preferences.difficulty;
  }
  if (modeSelect && preferences.mode) {
    modeSelect.value = preferences.mode;
  }
  if (timerSelect && preferences.timerMinutes) {
    timerSelect.value = String(preferences.timerMinutes);
  }
}

function readCurrentSelections() {
  return {
    difficulty: document.getElementById('difficulty-select')?.value || 'all',
    mode: document.getElementById('mode-select')?.value || 'standard',
    timerMinutes: Math.max(1, Number(document.getElementById('timer-select')?.value || 60))
  };
}

function showModeDescription() {
  const mode = document.getElementById('mode-select')?.value || 'standard';
  const timerGroup = document.getElementById('timer-group');
  const description = document.getElementById('mode-description');
  if (timerGroup) {
    timerGroup.classList.toggle('hidden', mode !== 'examPrep');
  }
  if (description) {
    description.textContent = MODE_DESCRIPTIONS[mode] || '';
  }
}

function saveSessionState() {
  if (!sessionIsActive()) {
    return;
  }

  if (gameState.mode === 'examPrep') {
    const timerState = getTimerState();
    gameState.timerRemainingSeconds = timerState.totalSeconds;
    gameState.timerPaused = Boolean(timerState.paused);
  }

  localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(gameState));
}

function loadSavedSessionState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY) || 'null');
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function clearSavedSessionState() {
  localStorage.removeItem(SAVE_STORAGE_KEY);
}

/**
 * Full game reset: wipes the player profile, active session, and analytics
 * history, then reloads the page so the app boots with a clean slate.
 * Deliberately preserves UI preferences (difficulty, mode, dark mode).
 */
function resetAllGameData() {
  stopSessionClock();
  stopTimer();
  clearSavedSessionState();
  clearPlayerProfile();
  clearAnalyticsHistory();
  // Reset the first-visit flag so the welcome modal shows again.
  try { localStorage.removeItem(FIRST_VISIT_KEY); } catch (_e) { /* ignore */ }
  location.reload();
}

function resetGameState() {
  const fresh = createInitialGameState();
  Object.keys(gameState).forEach((key) => delete gameState[key]);
  Object.assign(gameState, fresh);
  activeScenario = null;
}

async function ensureScenarioCatalog(overrideData) {
  if (Array.isArray(overrideData)) {
    scenarioCatalog = deepClone(overrideData);
    return scenarioCatalog;
  }
  if (scenarioCatalog.length > 0) {
    return scenarioCatalog;
  }
  scenarioCatalog = await loadScenarioData();
  return scenarioCatalog;
}

async function ensureProgressData() {
  await ensureScenarioCatalog();
  campaignData = campaignData || await loadCampaignData();
  currentProfile = await loadPlayerProfile({ scenarioCatalog, campaignData });
  return { scenarioCatalog, campaignData, profile: currentProfile };
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildSessionScenarioIds(catalog, mode, difficulty, options = {}) {
  const allScenarios = Array.isArray(catalog) ? catalog : [];

  if (mode === 'freePlay' && options.scenarioId) {
    return [options.scenarioId].filter((id) => allScenarios.some((scenario) => scenario.id === id));
  }

  if (mode === 'campaign') {
    return campaignOrder.filter((id) => allScenarios.some((scenario) => scenario.id === id));
  }

  const filtered = difficulty === 'all'
    ? allScenarios
    : allScenarios.filter((scenario) => scenario.difficulty === difficulty);

  if (options.shuffle === false) {
    return filtered.map((scenario) => scenario.id);
  }

  return shuffleArray(filtered).map((scenario) => scenario.id);
}

function getScenarioById(id) {
  return scenarioCatalog.find((scenario) => scenario.id === id) || null;
}

function getCurrentScenarioId() {
  return gameState.orderedScenarioIds[gameState.currentScenarioIndex] || null;
}

function updatePrecedentTracker() {
  const tracker = document.getElementById('precedent-tracker');
  const list = tracker?.querySelector('.precedent-list');
  if (!tracker || !list) {
    return;
  }

  if (gameState.mode !== 'campaign') {
    tracker.classList.add('hidden');
    return;
  }

  tracker.classList.remove('hidden');

  const entries = Object.entries(gameState.precedentState);
  if (entries.length === 0) {
    list.innerHTML = '<li class="precedent-empty">No precedents established yet. Your decisions will shape the legal landscape.</li>';
    return;
  }

  list.innerHTML = entries.map(([key, value]) => {
    const meta = PRECEDENT_METADATA[key] || {
      name: key,
      trueLabel: 'Established',
      falseLabel: 'Rejected'
    };
    return `
      <li class="precedent-item ${value ? 'precedent-affirmed' : 'precedent-denied'}">
        <span class="precedent-icon" aria-hidden="true">${value ? '✅' : '⚠️'}</span>
        <div class="precedent-detail">
          <span class="precedent-name">${meta.name}</span>
          <span class="precedent-label">${value ? meta.trueLabel : meta.falseLabel}</span>
        </div>
      </li>
    `;
  }).join('');
}

function applyPrecedentConditionsToScenario(scenario) {
  const conditions = Array.isArray(scenario.precedentConditions) ? scenario.precedentConditions : [];
  const triggeredLabels = [];

  conditions.forEach((condition) => {
    if (gameState.precedentState[condition.precedent] !== condition.value) {
      return;
    }

    const meta = PRECEDENT_METADATA[condition.precedent];
    if (meta) {
      const label = condition.value ? meta.trueLabel : meta.falseLabel;
      if (label && !triggeredLabels.includes(label)) {
        triggeredLabels.push(label);
      }
    }

    if (condition.descriptionAppend) {
      scenario.description = `${scenario.description}\n\n${condition.descriptionAppend}`.trim();
    }

    if (!Array.isArray(condition.stepModifications)) {
      return;
    }

    condition.stepModifications.forEach((modification) => {
      const step = scenario.steps?.[modification.stepIndex];
      const choice = step?.choices?.[modification.choiceIndex];
      if (!step || !choice) {
        return;
      }

      if (modification.promptAppend) {
        step.prompt = `${step.prompt} ${modification.promptAppend}`.trim();
      }
      if (modification.textAppend) {
        choice.text = `${choice.text} ${modification.textAppend}`.trim();
      }
      if (modification.textOverride) {
        choice.text = modification.textOverride;
      }
      if (modification.explanationAppend) {
        choice.explanation = `${choice.explanation} ${modification.explanationAppend}`.trim();
      }
      if (modification.explanationOverride) {
        choice.explanation = modification.explanationOverride;
      }
      if (typeof modification.pointsOverride === 'number') {
        choice.points = modification.pointsOverride;
      }
      if (typeof modification.pointsDelta === 'number') {
        choice.points += modification.pointsDelta;
      }
      if (typeof modification.correctOverride === 'string') {
        choice.correct = modification.correctOverride;
      }
    });
  });

  scenario._triggeredPrecedents = triggeredLabels;
}

function setScenarioChrome(scenario) {
  updateBranchIndicator(scenario.branch || 'judiciary');
  updateProgressBar(gameState.currentScenarioIndex, gameState.totalScenarios, gameState.history);

  const banner = document.getElementById('precedent-banner');
  const bannerText = document.getElementById('precedent-banner-text');
  const triggered = Array.isArray(scenario._triggeredPrecedents) ? scenario._triggeredPrecedents : [];

  if (banner && bannerText) {
    if (triggered.length > 0 && gameState.mode === 'campaign') {
      bannerText.textContent = `Your earlier rulings apply here: ${triggered.join(' · ')}`;
      banner.classList.remove('hidden');
      announce(`Precedent in effect: ${triggered.join(', ')}.`);
    } else {
      banner.classList.add('hidden');
    }
  }
}

function loadActiveScenario({ preserveProgress = false } = {}) {
  const scenarioId = getCurrentScenarioId();
  const baseScenario = getScenarioById(scenarioId);

  if (!baseScenario) {
    displayError(`The scenario "${scenarioId}" could not be found.`);
    return;
  }

  activeScenario = deepClone(baseScenario);
  applyPrecedentConditionsToScenario(activeScenario);

  if (!preserveProgress) {
    gameState.currentStepIndex = 0;
    gameState.currentScenarioChoices = [];
    gameState.currentScenarioPoints = 0;
  }

  gameState.currentScenarioMaxPoints = getScenarioMaxPoints(activeScenario, currentScoreDifficulty());
  setScenarioChrome(activeScenario);
  renderCurrentStep();
}

function renderCurrentStep() {
  if (!activeScenario) {
    return;
  }

  const step = activeScenario.steps?.[gameState.currentStepIndex];
  if (!step) {
    completeScenario();
    return;
  }

  if (step.type === 'argument_builder') {
    renderArgumentBuilder(step, handleArgumentSubmit);
    return;
  }

  if (step.type === 'counter_argument') {
    renderCounterArgument(step, handleChoice);
    return;
  }

  renderScenario(activeScenario, gameState.currentStepIndex, handleChoice, { difficulty: currentScoreDifficulty() });
}

function beginSessionClock() {
  stopSessionClock();
  sessionClockId = window.setInterval(() => {
    if (!sessionIsActive()) {
      return;
    }
    gameState.elapsedMs += 1000;
    if (gameState.mode !== 'examPrep' && gameState.elapsedMs % 5000 === 0) {
      saveSessionState();
    }
  }, 1000);
}

function stopSessionClock() {
  if (sessionClockId !== null) {
    window.clearInterval(sessionClockId);
    sessionClockId = null;
  }
}

function syncExamTimerControls() {
  const controls = document.getElementById('timer-controls');
  const pauseButton = document.getElementById('timer-pause-btn');
  const resumeButton = document.getElementById('timer-resume-btn');
  const extendButton = document.getElementById('timer-extend-btn');

  if (!controls || !pauseButton || !resumeButton || !extendButton) {
    return;
  }

  if (gameState.mode !== 'examPrep') {
    controls.classList.add('hidden');
    return;
  }

  controls.classList.remove('hidden');
  pauseButton.classList.toggle('hidden', gameState.timerPaused);
  resumeButton.classList.toggle('hidden', !gameState.timerPaused);
  extendButton.disabled = false;
}

function syncModeSpecificChrome() {
  const timerDisplay = document.getElementById('timer-display');
  const precedentTracker = document.getElementById('precedent-tracker');
  const examReviewContainer = document.getElementById('exam-review-container');

  if (timerDisplay) {
    timerDisplay.classList.toggle('hidden', gameState.mode !== 'examPrep');
  }
  if (precedentTracker) {
    precedentTracker.classList.toggle('hidden', gameState.mode !== 'campaign');
  }
  if (examReviewContainer) {
    examReviewContainer.classList.add('hidden');
    examReviewContainer.innerHTML = '';
  }

  syncExamTimerControls();
  updatePrecedentTracker();
}

function onTimerTick(timerState) {
  gameState.timerRemainingSeconds = timerState.totalSeconds;
  gameState.timerPaused = Boolean(timerState.paused);
  updateTimerDisplay(timerState, true);
  syncExamTimerControls();
  saveSessionState();
}

function onTimerExpire() {
  announce('Time has expired. Ending the exam session now.', true);
  completeScenario({ timedOut: true, skipFeedback: true });
}

function startExamTimer(minutes) {
  startTimer(minutes, onTimerTick, onTimerExpire);
  gameState.timerPaused = false;
  gameState.timerRemainingSeconds = Math.round(minutes * 60);
  syncExamTimerControls();
}

function restoreExamTimer() {
  restoreTimer(gameState.timerRemainingSeconds, onTimerTick, onTimerExpire, gameState.timerPaused);
  syncExamTimerControls();
}

function applyChoicePrecedent(choice) {
  if (gameState.mode !== 'campaign' || !choice?.setsPrecedent) {
    return;
  }

  Object.assign(gameState.precedentState, choice.setsPrecedent);
  updatePrecedentTracker();
}

function disableVisibleChoiceButtons() {
  document.querySelectorAll('.choice-btn').forEach((button) => {
    button.disabled = true;
  });
}

export async function handleChoice(choiceIndex, buttonElement) {
  if (!activeScenario) {
    return;
  }

  const step = activeScenario.steps?.[gameState.currentStepIndex];
  const choice = step?.choices?.[choiceIndex];
  if (!step || !choice) {
    return;
  }

  disableVisibleChoiceButtons();

  const outcome = normalizeOutcome(choice.correct);
  const points = calculateChoicePoints(choice, step, currentScoreDifficulty());

  gameState.legitimacyPoints += points;
  gameState.currentScenarioPoints += points;
  updateScore(gameState.legitimacyPoints);

  gameState.currentScenarioChoices.push({
    stepIndex: gameState.currentStepIndex,
    stepNumber: gameState.currentStepIndex + 1,
    choiceIndex,
    choiceId: choice.id,
    choiceText: choice.text,
    outcome,
    points,
    explanation: choice.explanation || ''
  });

  applyChoicePrecedent(choice);
  saveSessionState();

  await flashChoiceResult(buttonElement, outcome);

  gameState.currentStepIndex += 1;
  if (gameState.currentStepIndex >= activeScenario.steps.length) {
    completeScenario();
    return;
  }

  saveSessionState();
  renderCurrentStep();
}

export function handleArgumentSubmit(result) {
  const rawPoints = Number(result?.rawPoints || 0);
  const points = calculateArgumentBuilderPoints(rawPoints, currentScoreDifficulty());
  const outcome = points > 0 ? 'correct' : points === 0 ? 'partial' : 'incorrect';

  gameState.legitimacyPoints += points;
  gameState.currentScenarioPoints += points;
  updateScore(gameState.legitimacyPoints);

  gameState.currentScenarioChoices.push({
    stepIndex: gameState.currentStepIndex,
    stepNumber: gameState.currentStepIndex + 1,
    choiceIndex: -1,
    choiceId: 'argument-builder',
    choiceText: `Argument builder: ${(result?.feedbackItems || []).length} selected argument(s)`,
    outcome,
    points,
    explanation: (result?.feedbackItems || []).map((item) => item.feedback).join(' ')
  });

  gameState.currentStepIndex += 1;
  saveSessionState();

  if (gameState.currentStepIndex >= (activeScenario?.steps?.length || 0)) {
    completeScenario();
  } else {
    renderCurrentStep();
  }
}

function buildScenarioRecord({ timedOut = false } = {}) {
  return {
    scenarioId: activeScenario.id,
    title: activeScenario.title,
    branch: activeScenario.branch,
    doctrineArea: activeScenario.doctrineArea,
    difficulty: activeScenario.difficulty,
    pointsEarned: gameState.currentScenarioPoints,
    maxPoints: gameState.currentScenarioMaxPoints,
    choicesMade: deepClone(gameState.currentScenarioChoices),
    overallExplanation: activeScenario.overallExplanation || '',
    caseReferences: activeScenario.caseReferences || [],
    professorNote: activeScenario.professorNote || '',
    analyticalLens: activeScenario.analyticalLens || '',
    otherSide: activeScenario.otherSide || '',
    timerExpired: timedOut
  };
}

function clearCurrentScenarioProgress() {
  gameState.currentStepIndex = 0;
  gameState.currentScenarioChoices = [];
  gameState.currentScenarioPoints = 0;
  gameState.currentScenarioMaxPoints = 0;
  activeScenario = null;
}

function completeScenario({ timedOut = false, skipFeedback = false } = {}) {
  if (!activeScenario) {
    return;
  }

  const record = buildScenarioRecord({ timedOut });
  if (record.choicesMade.length > 0 || timedOut) {
    gameState.history.push(record);
    if (!gameState.completedScenarioIds.includes(record.scenarioId)) {
      gameState.completedScenarioIds.push(record.scenarioId);
    }
  }

  saveSessionState();

  if (timedOut) {
    clearCurrentScenarioProgress();
    showEndGame();
    return;
  }

  // Hard mode (standard) defers all scenario feedback to the end, mirroring exam prep.
  const hardModeDeferred = gameState.difficulty === 'hard' && gameState.mode === 'standard';
  if (gameState.mode === 'examPrep' || hardModeDeferred || skipFeedback) {
    advanceToNextScenario();
    return;
  }

  // Capture hypo variations before clearing activeScenario
  const pendingHypos = [...(activeScenario.hypoVariations ?? [])];

  renderFeedback({
    scenario: activeScenario,
    choicesMade: record.choicesMade,
    pointsEarned: record.pointsEarned,
    maxPoints: record.maxPoints,
    onContinue: () => {
      hideModal('feedback-modal');
      if (pendingHypos.length > 0) {
        gameState.pendingHypos = pendingHypos;
        gameState.totalHypos = pendingHypos.length;
        processNextHypo();
      } else {
        advanceToNextScenario();
      }
    }
  });
}

function processNextHypo() {
  const hypo = gameState.pendingHypos.shift();
  if (!hypo) {
    advanceToNextScenario();
    return;
  }

  const hypoIndex = gameState.totalHypos - gameState.pendingHypos.length - 1;
  const totalHypos = gameState.totalHypos;

  renderHypoVariation(hypo, (_wasCorrect, pointsAwarded) => {
    if (typeof pointsAwarded === 'number' && pointsAwarded > 0) {
      gameState.legitimacyPoints = (gameState.legitimacyPoints || 0) + pointsAwarded;
    }
    processNextHypo();
  }, { hypoIndex, totalHypos });
}

function advanceToNextScenario() {
  gameState.currentScenarioIndex += 1;
  clearCurrentScenarioProgress();
  gameState.pendingHypos = [];

  if (gameState.currentScenarioIndex >= gameState.totalScenarios) {
    showEndGame();
    return;
  }

  saveSessionState();
  loadActiveScenario({ preserveProgress: false });
}

function buildFinalResults() {
  const totalPoints = gameState.legitimacyPoints;
  const maxPoints = gameState.history.reduce((sum, record) => sum + record.maxPoints, 0);
  const grade = calculateGrade(totalPoints, maxPoints);

  return {
    sessionId: gameState.sessionId,
    totalPoints,
    maxPoints,
    percentage: grade.percentage,
    grade,
    scenarioResults: deepClone(gameState.history),
    mode: gameState.mode,
    difficulty: gameState.difficulty,
    totalTimeMs: gameState.elapsedMs,
    playedAt: new Date().toISOString(),
    practiceOnly: gameState.practiceOnly,
    launchContext: deepClone(gameState.launchContext)
  };
}

function recordAnalytics(results) {
  if (gameState.analyticsRecorded) {
    return;
  }

  recordCompletedSession({
    sessionId: results.sessionId,
    playedAt: results.playedAt,
    mode: results.mode,
    difficulty: results.difficulty,
    finalScore: results.totalPoints,
    maxScore: results.maxPoints,
    percentage: results.percentage,
    grade: results.grade,
    totalTimeMs: results.totalTimeMs,
    scenarios: results.scenarioResults.map((scenario) => ({
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      doctrineArea: scenario.doctrineArea,
      scoreEarned: scenario.pointsEarned,
      maxScore: scenario.maxPoints,
      choices: scenario.choicesMade.map((choice) => ({
        stepNumber: choice.stepNumber,
        outcome: choice.outcome,
        points: choice.points
      }))
    }))
  });

  gameState.analyticsRecorded = true;
}

function displayError(message) {
  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = message ?? 'An error occurred. Please refresh the page.';
  }

  showScreen('error-screen');

  const retryBtn = document.getElementById('error-retry-btn');
  if (retryBtn && !retryBtn.dataset.wired) {
    retryBtn.dataset.wired = '1';
    retryBtn.addEventListener('click', () => location.reload());
  }
}

function validateSavedState(savedState) {
  return savedState
    && typeof savedState === 'object'
    && Array.isArray(savedState.orderedScenarioIds)
    && savedState.orderedScenarioIds.length > 0
    && typeof savedState.currentScenarioIndex === 'number';
}

function hydrateSavedState(savedState) {
  resetGameState();
  Object.assign(gameState, createInitialGameState(), savedState, {
    history: Array.isArray(savedState.history) ? savedState.history : [],
    completedScenarioIds: Array.isArray(savedState.completedScenarioIds) ? savedState.completedScenarioIds : [],
    orderedScenarioIds: Array.isArray(savedState.orderedScenarioIds) ? savedState.orderedScenarioIds : [],
    precedentState: savedState.precedentState && typeof savedState.precedentState === 'object'
      ? savedState.precedentState
      : {},
    currentScenarioChoices: Array.isArray(savedState.currentScenarioChoices) ? savedState.currentScenarioChoices : [],
    launchContext: savedState.launchContext || null,
    practiceOnly: Boolean(savedState.practiceOnly)
  });
}

function enterGameScreen(routeParams = {}) {
  showScreen('game-screen');
  setAppShellContext('game');
  navigate('game', routeParams);
}

function updateTimerButtonsAfterPauseState() {
  gameState.timerPaused = getTimerState().paused;
  syncExamTimerControls();
  saveSessionState();
}

function buildGameRouteParams(options = {}) {
  const singleScenarioId = gameState.orderedScenarioIds.length === 1 ? gameState.orderedScenarioIds[0] : options.scenarioId;
  return {
    scenario: singleScenarioId || '',
    mode: gameState.mode || options.mode || '',
    practiceOnly: gameState.practiceOnly ? 1 : ''
  };
}

export async function initGame(options = {}) {
  try {
    const selections = options.selections || readCurrentSelections();
    savePreferences();

    const catalog = await ensureScenarioCatalog(options.scenarioData);
    let orderedScenarioIds = options.orderedScenarioIds
      || buildSessionScenarioIds(catalog, selections.mode, selections.difficulty, options);

    // Weak Spots mode: override orderedScenarioIds with the player's worst-performing scenarios.
    if (selections.mode === 'weakSpots') {
      const history = loadAnalyticsHistory();
      const weakIds = getWeakScenarioIds(history);
      const weakInCatalog = catalog.filter((s) => weakIds.includes(s.id)).slice(0, 10);

      if (weakInCatalog.length === 0) {
        displayError(
          'No weak spots identified yet. Complete at least 2 attempts on several scenarios so we can identify areas for improvement. Each scenario needs at least 2 plays with an average accuracy below 65% to qualify.'
        );
        return;
      }

      orderedScenarioIds = weakInCatalog.map((s) => s.id);
      showToast(`${weakInCatalog.length} weak spot${weakInCatalog.length === 1 ? '' : 's'} queued for review.`, { type: 'info' });
    }

    if (!orderedScenarioIds.length) {
      displayError('No scenarios matched the current settings. Try choosing “All Levels.”');
      return;
    }

    resetGameState();
    Object.assign(gameState, {
      sessionId: `session-${Date.now()}`,
      activeSession: true,
      mode: selections.mode,
      difficulty: selections.difficulty,
      examTimerMinutes: selections.timerMinutes,
      orderedScenarioIds,
      totalScenarios: orderedScenarioIds.length,
      startedAt: new Date().toISOString(),
      timerRemainingSeconds: Math.round(selections.timerMinutes * 60),
      timerPaused: false,
      launchContext: options.launchContext || null,
      practiceOnly: Boolean(options.practiceOnly)
    });

    enterGameScreen({
      scenario: options.scenarioId || (orderedScenarioIds.length === 1 ? orderedScenarioIds[0] : ''),
      mode: selections.mode,
      practiceOnly: gameState.practiceOnly ? 1 : ''
    });

    updateScore(gameState.legitimacyPoints, false);
    syncModeSpecificChrome();
    beginSessionClock();

    if (gameState.mode === 'examPrep') {
      startExamTimer(gameState.examTimerMinutes);
    } else {
      stopTimer();
    }

    saveSessionState();
    loadActiveScenario({ preserveProgress: false });
  } catch (error) {
    console.error(error);
    displayError(error.message || 'The game could not be initialized.');
  }
}

async function resumeSavedSession(savedState) {
  await ensureScenarioCatalog();
  hydrateSavedState(savedState);
  gameState.activeSession = true;

  enterGameScreen(buildGameRouteParams({ scenarioId: getCurrentScenarioId() }));
  updateScore(gameState.legitimacyPoints, false);
  syncModeSpecificChrome();
  beginSessionClock();

  if (gameState.mode === 'examPrep') {
    restoreExamTimer();
  }

  loadActiveScenario({ preserveProgress: true });
  updatePrecedentTracker();
  announce('Previous session resumed.');
}

function promptToResumeSavedSession() {
  const savedState = loadSavedSessionState();
  if (!validateSavedState(savedState) || savedSessionPrompted) {
    return;
  }

  savedSessionPrompted = true;
  populateAppModal({
    title: 'Resume your previous session?',
    bodyHtml: `
      <p>Your earlier game progress is still saved on this device.</p>
      <p><strong>Mode:</strong> ${savedState.mode}<br />
      <strong>Progress:</strong> Crisis ${savedState.currentScenarioIndex + 1} of ${savedState.totalScenarios}</p>
    `,
    confirmText: 'Resume Session',
    cancelText: 'Start Fresh',
    onConfirm: () => resumeSavedSession(savedState),
    onCancel: () => {
      clearSavedSessionState();
      announce('Saved session discarded.');
    }
  });
}

async function refreshProfile() {
  await ensureProgressData();
  return currentProfile;
}

function getCampaignNodeScenario(nodeId) {
  const node = (campaignData?.nodes || []).find((entry) => entry.id === nodeId);
  return node ? getScenarioById(node.scenarioId) : null;
}

function latestSessionSummary() {
  return loadAnalyticsHistory()[0] || null;
}

async function renderHomeScreen() {
  await refreshProfile();

  const completion = computeCompletionSummary(currentProfile, scenarioCatalog);
  const currentNode = (campaignData?.nodes || []).find((node) => node.id === currentProfile?.campaign?.currentNodeId);
  const currentScenario = currentNode ? getScenarioById(currentNode.scenarioId) : null;
  const latestSession = latestSessionSummary();
  const achievementDefs = await loadAchievementDefinitions();
  const latestAchievementId = currentProfile?.achievements?.earnedIds?.slice(-1)[0] || null;
  const latestAchievement = achievementDefs.find((entry) => entry.id === latestAchievementId) || null;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  };

  setText('home-level-value', String(currentProfile?.level || 1));
  setText('home-streak-value', `${currentProfile?.streak?.currentDays || 0} day${Number(currentProfile?.streak?.currentDays || 0) === 1 ? '' : 's'}`);
  setText('home-completion-value', `${completion.percent}%`);
  setText('home-continue-copy', currentScenario ? `Node: ${currentScenario.title}` : 'Campaign complete');
  setText('home-continue-progress', `${completion.percent}% map complete`);
  setText('home-achievement-summary', latestAchievement ? `Latest achievement: ${latestAchievement.title}` : 'No achievements earned yet.');
  setText('home-run-summary', latestSession ? `Latest run: ${latestSession.percentage}% in ${latestSession.mode}` : 'Complete your first scenario to start the campaign record.');

  const continueButton = document.getElementById('continue-campaign-btn');
  if (continueButton) {
    continueButton.disabled = !currentScenario;
  }

  // Update Weak Spots option with count badge
  const weakCount = getWeakScenarioIds(loadAnalyticsHistory()).length;
  const weakOption = document.querySelector('#mode-select option[value="weakSpots"]');
  if (weakOption) {
    weakOption.textContent = weakCount > 0 ? `Weak Spots (${weakCount})` : 'Weak Spots';
  }

  const mentor = await getHomeMentorContent(currentProfile);
  renderMentorPanel('home-mentor-panel', mentor);

  showWelcomeModal();
}

async function renderDashboardScreen() {
  await refreshProfile();
  await renderDashboard(currentProfile, scenarioCatalog);
}

async function renderMapScreen() {
  await refreshProfile();
  await renderCampaignMap({
    profile: currentProfile,
    scenarioCatalog,
    onPlay: async (node, options = {}) => {
      const scenario = getScenarioById(node.scenarioId);
      if (!scenario) {
        return;
      }
      await launchFreePlayScenario(scenario.id, options);
    },
    onViewInLibrary: (node) => {
      navigate('library', { search: node.scenarioId });
    }
  });
}

async function renderLibraryScreen(routeParams = {}) {
  await refreshProfile();
  if (routeParams?.sandbox === '1') {
    currentProfile.settings.sandboxEnabled = true;
    await setSandboxEnabled(true, { scenarioCatalog, campaignData });
  }
  if (routeParams?.search) {
    const searchEl = document.getElementById('library-search');
    if (searchEl) {
      searchEl.value = routeParams.search;
    }
  }
  await renderLibrary({
    scenarioCatalog,
    profile: currentProfile,
    onPlay: async (entry, options = {}) => {
      await launchFreePlayScenario(entry.id, options);
    }
  });
}

function buildCodexCaseMarkup(cases = []) {
  return `
    <div class="codex-list">
      ${cases.slice(0, 18).map((record) => `
        <article class="codex-entry">
          <h3>${record.name}</h3>
          <p><strong>${record.citation || ''}</strong> ${record.year ? `(${record.year})` : ''}</p>
          <p>${record.holding}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function buildCodexDoctrineMarkup() {
  const doctrineMap = new Map();
  scenarioCatalog.forEach((scenario) => {
    const current = doctrineMap.get(scenario.doctrineArea) || [];
    current.push(scenario);
    doctrineMap.set(scenario.doctrineArea, current);
  });
  return `
    <div class="codex-list">
      ${[...doctrineMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([doctrine, scenarios]) => `
        <article class="codex-entry">
          <h3>${doctrine}</h3>
          <p>${scenarios.length} scenario${scenarios.length === 1 ? '' : 's'} in the library.</p>
          <p>${scenarios.slice(0, 3).map((scenario) => scenario.title).join(' · ')}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function buildCodexPrecedentMarkup() {
  return `
    <div class="codex-list">
      ${Object.values(PRECEDENT_METADATA).map((entry) => `
        <article class="codex-entry">
          <h3>${entry.name}</h3>
          <p>${entry.trueLabel}</p>
          <p>${entry.falseLabel}</p>
        </article>
      `).join('')}
    </div>
  `;
}

async function buildCodexMentorNotesMarkup() {
  const mentor = await getCodexMentorContent(currentProfile);
  return `
    <div class="codex-list">
      ${(mentor?.notes || []).map((note) => `
        <article class="codex-entry">
          <p>${note}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function setCodexTab(activeTab) {
  document.querySelectorAll('.codex-tab').forEach((button) => {
    const isActive = button.dataset.codexTab === activeTab;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  document.querySelectorAll('.codex-panel').forEach((panel) => {
    const isActive = panel.dataset.codexPanel === activeTab;
    panel.classList.toggle('hidden', !isActive);
    panel.classList.toggle('is-active', isActive);
  });
}

async function renderCodexScreen() {
  await refreshProfile();
  await loadCaseData();
  const panels = {
    cases: document.querySelector('[data-codex-panel="cases"]'),
    doctrines: document.querySelector('[data-codex-panel="doctrines"]'),
    precedents: document.querySelector('[data-codex-panel="precedents"]'),
    'mentor-notes': document.querySelector('[data-codex-panel="mentor-notes"]')
  };

  if (panels.cases) {
    panels.cases.innerHTML = buildCodexCaseMarkup(getAllCases());
  }
  if (panels.doctrines) {
    panels.doctrines.innerHTML = buildCodexDoctrineMarkup();
  }
  if (panels.precedents) {
    panels.precedents.innerHTML = buildCodexPrecedentMarkup();
  }
  if (panels['mentor-notes']) {
    panels['mentor-notes'].innerHTML = await buildCodexMentorNotesMarkup();
  }
  setCodexTab('cases');
}

async function launchFreePlayScenario(scenarioId, options = {}) {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    return;
  }
  await initGame({
    scenarioId,
    orderedScenarioIds: [scenarioId],
    selections: {
      mode: 'freePlay',
      difficulty: scenario.difficulty || 'medium',
      timerMinutes: readCurrentSelections().timerMinutes
    },
    practiceOnly: Boolean(options.practiceOnly),
    launchContext: {
      source: options.source || 'library',
      scenarioId
    }
  });
}

async function launchCurrentCampaignNode() {
  await refreshProfile();
  const currentNode = (campaignData?.nodes || []).find((node) => node.id === currentProfile?.campaign?.currentNodeId);
  if (!currentNode) {
    navigate('campaign');
    return;
  }
  await launchFreePlayScenario(currentNode.scenarioId, { source: 'campaign', practiceOnly: false });
}

async function returnHome() {
  stopSessionClock();
  stopTimer();
  savedSessionPrompted = true;
  navigate('home');
}

async function saveAndQuit() {
  if (!sessionIsActive()) {
    navigate('home');
    return;
  }

  if (gameState.mode === 'examPrep') {
    pauseTimer();
    gameState.timerPaused = true;
  }
  saveSessionState();
  stopSessionClock();
  navigate('home');
  announce('Session saved. You can resume it later from this device.');
}

function showAchievementToasts(achievements = []) {
  achievements.forEach((achievement) => {
    showToast(achievement.title, {
      title: 'Achievement unlocked',
      variant: 'success'
    });
  });
}

async function renderResultsChrome(results) {
  const rewards = results.rewards || {};
  const starDelta = (rewards.starUpdates || []).reduce((sum, entry) => sum + (entry.currentStars - entry.previousStars), 0);
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = String(value);
    }
  };

  setText('results-xp-earned', rewards.xpEarned || 0);
  setText('results-stars-earned', starDelta);
  setText('results-unlocks-earned', (rewards.unlockedNodeIds || []).length);
  setText('results-achievements-earned', (rewards.achievements || []).length);
  animateRewardStrip('results-reward-strip');

  const mentor = await getResultsMentorContent(results, currentProfile);
  renderMentorPanel('results-mentor-panel', mentor);

  const continueButton = document.getElementById('results-continue-campaign-btn');
  if (continueButton) {
    continueButton.toggleAttribute('disabled', !(currentProfile?.campaign?.currentNodeId));
    continueButton.onclick = launchCurrentCampaignNode;
  }

  const mapButton = document.getElementById('results-open-map-btn');
  if (mapButton) {
    mapButton.onclick = () => navigate('campaign');
  }

  const libraryButton = document.getElementById('results-open-library-btn');
  if (libraryButton) {
    libraryButton.onclick = () => navigate('library');
  }

  const replayButton = document.getElementById('results-replay-btn');
  if (replayButton) {
    replayButton.onclick = () => {
      const replayScenarioId = results?.launchContext?.scenarioId || results?.scenarioResults?.[0]?.scenarioId;
      if (!replayScenarioId) {
        navigate('home');
        return;
      }
      launchFreePlayScenario(replayScenarioId, {
        source: results?.launchContext?.source || 'results',
        practiceOnly: Boolean(results?.practiceOnly)
      });
    };
  }

  showAchievementToasts(rewards.achievements || []);
  if ((rewards.unlockedNodeIds || []).length > 0) {
    showToast(`${rewards.unlockedNodeIds.length} new node${rewards.unlockedNodeIds.length === 1 ? '' : 's'} unlocked.`, {
      title: 'Campaign progress',
      variant: 'info'
    });
  }
}

export async function showEndGame() {
  stopSessionClock();
  if (gameState.mode === 'examPrep') {
    stopTimer();
  }

  const results = buildFinalResults();
  recordAnalytics(results);
  const progressOutcome = await applySessionProgress(results, {
    scenarioCatalog,
    campaignData,
    practiceOnly: gameState.practiceOnly,
    launchContext: gameState.launchContext,
    mode: gameState.mode,
    analyticsHistory: loadAnalyticsHistory()
  });
  currentProfile = progressOutcome.profile;
  results.rewards = progressOutcome.rewards;
  renderEndGame(results);

  const showDeferredReview = results.mode === 'examPrep'
    || (results.mode === 'standard' && results.difficulty === 'hard');
  if (showDeferredReview) {
    renderExamReview(results.scenarioResults);
  }

  await renderResultsChrome(results);
  clearSavedSessionState();
  gameState.activeSession = false;
  gameState.resultsPayload = results;

  showScreen('end-screen');
  setAppShellContext('results');
  navigate('results', {
    scenario: results?.launchContext?.scenarioId || results?.scenarioResults?.[0]?.scenarioId || '',
    practiceOnly: results.practiceOnly ? 1 : ''
  });
  announce(`Simulation complete. Final grade ${results.grade.letter}.`);
}

async function handleRouteChange(event) {
  const route = event?.detail || getCurrentRoute();
  setAppShellContext(route.routeName);

  try {
    switch (route.routeName) {
      case 'home':
        showScreen('landing-screen');
        await renderHomeScreen();
        if (!savedSessionPrompted) {
          promptToResumeSavedSession();
        }
        break;
      case 'campaign':
        showScreen('map-screen');
        await renderMapScreen();
        break;
      case 'library':
        showScreen('library-screen');
        await renderLibraryScreen(route.params || {});
        break;
      case 'dashboard':
        showScreen('dashboard-screen');
        await renderDashboardScreen();
        await markAchievementsSeen(currentProfile?.achievements?.earnedIds || []);
        break;
      case 'codex':
        showScreen('codex-screen');
        await renderCodexScreen();
        break;
      case 'game':
        if (sessionIsActive()) {
          showScreen('game-screen');
          setAppShellContext('game');
          break;
        }
        if (route.params?.scenario) {
          await ensureScenarioCatalog();
          const scenario = getScenarioById(route.params.scenario);
          if (scenario) {
            await launchFreePlayScenario(scenario.id, {
              practiceOnly: route.params.practiceOnly === '1',
              source: route.params.source || 'route'
            });
            break;
          }
        }
        navigate('home');
        break;
      case 'results':
        if (gameState.resultsPayload) {
          showScreen('end-screen');
          setAppShellContext('results');
          break;
        }
        navigate('home');
        break;
      default:
        navigate('home');
        break;
    }
  } catch (error) {
    console.error(error);
    displayError(error.message || 'Unable to render this screen.');
  }
}

// ---------------------------------------------------------------------------
// Settings Drawer
// ---------------------------------------------------------------------------

function openSettingsDrawer() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  const btn = document.getElementById('settings-btn');
  if (!drawer) {
    return;
  }
  syncSettingsDrawer();
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  overlay?.classList.remove('hidden');
  overlay?.removeAttribute('aria-hidden');
  btn?.setAttribute('aria-expanded', 'true');
  // Move focus into drawer
  drawer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
}

function closeSettingsDrawer() {
  const drawer = document.getElementById('settings-drawer');
  const overlay = document.getElementById('settings-overlay');
  const btn = document.getElementById('settings-btn');
  if (!drawer) {
    return;
  }
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  overlay?.classList.add('hidden');
  overlay?.setAttribute('aria-hidden', 'true');
  btn?.setAttribute('aria-expanded', 'false');
  btn?.focus();
}

function syncSettingsTimerRow() {
  const modeEl = document.getElementById('settings-mode');
  const timerRow = document.getElementById('settings-timer-row');
  if (timerRow) {
    timerRow.classList.toggle('hidden', modeEl?.value !== 'examPrep');
  }
}

function syncSettingsDarkModeBtn() {
  const isDark = document.documentElement.classList.contains('dark-mode');
  const btn = document.getElementById('settings-dark-mode-btn');
  if (btn) {
    btn.textContent = isDark ? 'On' : 'Off';
    btn.setAttribute('aria-pressed', String(isDark));
  }
}

async function populateSettingsMentorSelect() {
  const select = document.getElementById('settings-mentor');
  if (!select) {
    return;
  }
  try {
    const data = await loadCharacterData();
    const characters = data?.characters || [];
    if (characters.length > 0) {
      select.innerHTML = characters
        .map((c) => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    }
  } catch (_e) {
    // Keep the default option already in the HTML
  }
}

function syncSettingsDrawer() {
  const prefs = getPreferences();

  // Gameplay
  const diffEl = document.getElementById('settings-difficulty');
  const modeEl = document.getElementById('settings-mode');
  const timerEl = document.getElementById('settings-timer');
  if (diffEl) {
    diffEl.value = prefs.difficulty || 'all';
  }
  if (modeEl) {
    modeEl.value = prefs.mode || 'standard';
  }
  if (timerEl) {
    timerEl.value = String(prefs.timerMinutes || 60);
  }
  syncSettingsTimerRow();

  // Display
  syncSettingsDarkModeBtn();
  const mentorEl = document.getElementById('settings-mentor');
  if (mentorEl && currentProfile?.settings?.mentorCharacterId) {
    mentorEl.value = currentProfile.settings.mentorCharacterId;
  }
}

function applyDrawerPrefs() {
  // Mirror drawer values into landing-screen selects so savePreferences() works correctly
  const diffEl = document.getElementById('settings-difficulty');
  const modeEl = document.getElementById('settings-mode');
  const timerEl = document.getElementById('settings-timer');

  const landingDiff = document.getElementById('difficulty-select');
  const landingMode = document.getElementById('mode-select');
  const landingTimer = document.getElementById('timer-select');

  if (diffEl && landingDiff) {
    landingDiff.value = diffEl.value;
  }
  if (modeEl && landingMode) {
    landingMode.value = modeEl.value;
    showModeDescription();
  }
  if (timerEl && landingTimer) {
    landingTimer.value = timerEl.value;
  }
  savePreferences();
}

function bindSettingsDrawer() {
  const settingsBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('settings-close-btn');
  const overlay = document.getElementById('settings-overlay');

  settingsBtn?.addEventListener('click', openSettingsDrawer);
  closeBtn?.addEventListener('click', closeSettingsDrawer);
  overlay?.addEventListener('click', closeSettingsDrawer);

  // Close on Escape (only if no other modal is open)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const drawer = document.getElementById('settings-drawer');
      const appModal = document.getElementById('app-modal');
      const feedbackModal = document.getElementById('feedback-modal');
      const appModalOpen = appModal && !appModal.classList.contains('hidden');
      const feedbackOpen = feedbackModal && !feedbackModal.classList.contains('hidden');
      if (!appModalOpen && !feedbackOpen && drawer?.classList.contains('is-open')) {
        closeSettingsDrawer();
      }
    }
  });

  // Gameplay controls
  document.getElementById('settings-difficulty')?.addEventListener('change', applyDrawerPrefs);
  document.getElementById('settings-mode')?.addEventListener('change', () => {
    syncSettingsTimerRow();
    applyDrawerPrefs();
  });
  document.getElementById('settings-timer')?.addEventListener('change', applyDrawerPrefs);

  // Dark mode mirror
  document.getElementById('settings-dark-mode-btn')?.addEventListener('click', () => {
    // Reuse the existing dark-mode-toggle logic by programmatically clicking it
    document.getElementById('dark-mode-toggle')?.click();
    syncSettingsDarkModeBtn();
  });

  // Mentor character
  document.getElementById('settings-mentor')?.addEventListener('change', async (event) => {
    const characterId = event.target.value;
    if (currentProfile) {
      currentProfile.settings = currentProfile.settings || {};
      currentProfile.settings.mentorCharacterId = characterId;
      savePlayerProfile(currentProfile);
    }
    await setMentorCharacter(characterId, { scenarioCatalog, campaignData });
    showToast('Mentor updated.');
  });

  // Reset
  document.getElementById('settings-reset-btn')?.addEventListener('click', () => {
    populateAppModal({
      title: '⚠️ Reset all game data?',
      bodyHtml: `
        <p>This will permanently delete:</p>
        <ul class="reset-confirm-list">
          <li>All XP, levels, and star ratings</li>
          <li>All campaign progress and unlocked nodes</li>
          <li>All achievements</li>
          <li>All session history and analytics</li>
        </ul>
        <p class="reset-confirm-warning">Your difficulty and mode preferences will be kept. <strong>This cannot be undone.</strong></p>
      `,
      confirmText: 'Reset Everything',
      cancelText: 'Cancel',
      onConfirm: resetAllGameData,
      closeOnOverlay: false
    });
  });

  // Populate mentor select asynchronously
  populateSettingsMentorSelect();
}

function bindControls() {
  document.getElementById('begin-btn')?.addEventListener('click', () => initGame());
  document.getElementById('continue-campaign-btn')?.addEventListener('click', launchCurrentCampaignNode);
  document.getElementById('my-progress-btn')?.addEventListener('click', () => navigate('dashboard'));
  document.getElementById('open-map-btn')?.addEventListener('click', () => navigate('campaign'));
  document.getElementById('open-library-btn')?.addEventListener('click', () => navigate('library'));
  document.getElementById('open-codex-btn')?.addEventListener('click', () => navigate('codex'));
  document.getElementById('dashboard-back-btn')?.addEventListener('click', () => navigate('home'));
  document.getElementById('restart-btn')?.addEventListener('click', returnHome);

  document.querySelectorAll('[data-route]').forEach((element) => {
    if (element.classList.contains('campaign-node')) {
      return;
    }
    element.addEventListener('click', () => {
      const route = element.getAttribute('data-route');
      if (route) {
        navigate(route);
      }
    });
  });

  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    downloadAnalyticsCsv();
    announce('CSV export started.');
  });

  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    populateAppModal({
      title: 'Clear saved analytics history?',
      bodyHtml: '<p>This removes your session history and CSV export data. Campaign unlocks, XP, and stars remain in your profile.</p>',
      confirmText: 'Clear History',
      cancelText: 'Cancel',
      onConfirm: async () => {
        clearAnalyticsHistory();
        await renderDashboardScreen();
        announce('Analytics history cleared.');
      }
    });
  });

  document.getElementById('save-quit-btn')?.addEventListener('click', saveAndQuit);
  document.getElementById('timer-pause-btn')?.addEventListener('click', () => {
    pauseTimer();
    updateTimerButtonsAfterPauseState();
    announce('Exam timer paused.');
  });
  document.getElementById('timer-resume-btn')?.addEventListener('click', () => {
    resumeTimer();
    updateTimerButtonsAfterPauseState();
    announce('Exam timer resumed.');
  });
  document.getElementById('timer-extend-btn')?.addEventListener('click', () => {
    extendTimer(5);
    onTimerTick(getTimerState());
    announce('Five minutes added to the exam timer.');
  });

  document.getElementById('mode-select')?.addEventListener('change', () => {
    showModeDescription();
    savePreferences();
  });
  document.getElementById('difficulty-select')?.addEventListener('change', savePreferences);
  document.getElementById('timer-select')?.addEventListener('change', savePreferences);

  document.querySelectorAll('.codex-tab').forEach((button) => {
    button.addEventListener('click', () => setCodexTab(button.dataset.codexTab));
  });

  window.addEventListener('beforeunload', () => {
    if (sessionIsActive()) {
      saveSessionState();
    }
  });

  document.addEventListener('cb:routechange', handleRouteChange);

  bindSettingsDrawer();
}

export function bootstrapApp() {
  if (bootstrapComplete) {
    return;
  }
  bootstrapComplete = true;

  applyPreferencesToControls();
  showModeDescription();
  initDarkModeToggle();

  registerScreen('landing-screen', 'home');
  registerScreen('map-screen', 'campaign');
  registerScreen('library-screen', 'library');
  registerScreen('dashboard-screen', 'dashboard');
  registerScreen('codex-screen', 'codex');
  registerScreen('game-screen', 'game');
  registerScreen('end-screen', 'results');
  registerScreen('error-screen', 'error');

  bindControls();
  initRouter();
}

export const __testHooks = {
  getStateSnapshot: () => deepClone(gameState),
  getActiveScenario: () => deepClone(activeScenario),
  async loadProfileForTests() {
    return refreshProfile();
  },
  setScenarioCatalogForTests(catalog) {
    scenarioCatalog = deepClone(catalog || []);
  },
  clearSavedStateForTests() {
    clearSavedSessionState();
    resetGameState();
    stopSessionClock();
    stopTimer();
    savedSessionPrompted = true;
  },
  loadScenarioDirectly() {
    loadActiveScenario({ preserveProgress: false });
  },
  applyConditionsForTests(scenario, precedentState) {
    const previous = deepClone(gameState.precedentState);
    gameState.precedentState = deepClone(precedentState || {});
    const clone = deepClone(scenario);
    applyPrecedentConditionsToScenario(clone);
    gameState.precedentState = previous;
    return clone;
  },
  async renderHomeForTests() {
    await renderHomeScreen();
  },
  async renderMapForTests() {
    await renderMapScreen();
  },
  async renderLibraryForTests() {
    await renderLibraryScreen();
  },
  async renderDashboardForTests() {
    await renderDashboardScreen();
  },
  async renderCodexForTests() {
    await renderCodexScreen();
  }
};

if (typeof window !== 'undefined' && !window.__CB_DISABLE_BOOTSTRAP__) {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
}
