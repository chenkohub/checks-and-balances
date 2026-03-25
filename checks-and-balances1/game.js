/**
 * game.js
 * Core game controller for Checks & Balances: The Simulation.
 *
 * Responsibilities:
 * - session state and persistence
 * - mode selection and scenario ordering
 * - campaign precedent tracking and downstream effects
 * - exam timer coordination
 * - end-of-game analytics recording
 */

import {
  loadScenarioData,
  renderScenario,
  renderArgumentBuilder,
  renderCounterArgument,
  renderFeedback,
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
  animateScreenTransition,
  updateBranchIndicator,
  updateProgressBar,
  updateScore,
  updateTimerDisplay,
  flashChoiceResult,
  initDarkModeToggle,
  populateAppModal,
  hideModal,
  announce
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
  renderDashboard,
  downloadAnalyticsCsv,
  clearAnalyticsHistory
} from './analytics.js';

export const SAVE_STORAGE_KEY = 'cb-sim-session-v1';
export const PREFERENCES_STORAGE_KEY = 'cb-sim-preferences-v1';

export const campaignOrder = Object.freeze([
  'youngstown-steel-seizure',
  'ins-v-chadha-legislative-veto',
  'nondelegation-intelligible-principle',
  'removal-independent-agency-head',
  'removal-multi-member-commission',
  'spending-clause-coercion',
  'scenario_021',
  'scenario_022',
  'scenario_026',
  'presidential-immunity-framework',
  'scenario_009',
  'scenario_032',
  'scenario_033',
  'scenario_029',
  'scenario_030'
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
  }
});

const MODE_DESCRIPTIONS = Object.freeze({
  standard:
    'Play through a shuffled set of scenarios with immediate feedback after each crisis.',
  examPrep:
    'Timed exam simulation. Feedback is deferred until the end. Exam Prep always uses hard-mode scoring and includes pause/extend controls for accessibility.',
  campaign:
    'Play the fixed campaign sequence. Earlier rulings create precedents that reframe later crises. Difficulty changes scoring, not the campaign order.'
});

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
    analyticsRecorded: false
  };
}

export const gameState = createInitialGameState();

let scenarioCatalog = [];
let activeScenario = null;
let sessionClockId = null;
let bootstrapComplete = false;

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

  const preferences = {
    difficulty: difficultySelect?.value || 'all',
    mode: modeSelect?.value || 'standard',
    timerMinutes: Number(timerSelect?.value || 60)
  };

  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
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
  const difficultySelect = document.getElementById('difficulty-select');
  const modeSelect = document.getElementById('mode-select');
  const timerSelect = document.getElementById('timer-select');

  return {
    difficulty: difficultySelect?.value || 'all',
    mode: modeSelect?.value || 'standard',
    timerMinutes: Math.max(1, Number(timerSelect?.value || 60))
  };
}

function showModeDescription() {
  const modeSelect = document.getElementById('mode-select');
  const timerGroup = document.getElementById('timer-group');
  const modeDescription = document.getElementById('mode-description');
  const mode = modeSelect?.value || 'standard';

  if (timerGroup) {
    timerGroup.classList.toggle('hidden', mode !== 'examPrep');
  }
  if (modeDescription) {
    modeDescription.textContent = MODE_DESCRIPTIONS[mode] || '';
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

  list.innerHTML = entries
    .map(([key, value]) => {
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
    })
    .join('');
}

function applyPrecedentConditionsToScenario(scenario) {
  const conditions = Array.isArray(scenario.precedentConditions) ? scenario.precedentConditions : [];
  conditions.forEach((condition) => {
    if (gameState.precedentState[condition.precedent] !== condition.value) {
      return;
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
}

function setScenarioChrome(scenario) {
  updateBranchIndicator(scenario.branch || 'judiciary');
  updateProgressBar(gameState.currentScenarioIndex, gameState.totalScenarios, gameState.history);
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

  renderScenario(activeScenario, gameState.currentStepIndex, handleChoice);
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

  if (gameState.mode === 'examPrep' || skipFeedback) {
    advanceToNextScenario();
    return;
  }

  renderFeedback({
    scenario: activeScenario,
    choicesMade: record.choicesMade,
    pointsEarned: record.pointsEarned,
    maxPoints: record.maxPoints,
    onContinue: () => {
      hideModal('feedback-modal');
      advanceToNextScenario();
    }
  });
}

function advanceToNextScenario() {
  gameState.currentScenarioIndex += 1;
  clearCurrentScenarioProgress();

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
    playedAt: new Date().toISOString()
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

export async function showEndGame() {
  stopSessionClock();
  if (gameState.mode === 'examPrep') {
    stopTimer();
  }

  const results = buildFinalResults();
  recordAnalytics(results);
  renderEndGame(results);

  if (gameState.mode === 'examPrep') {
    renderExamReview(results.scenarioResults);
  }

  clearSavedSessionState();
  gameState.activeSession = false;

  await animateScreenTransition('game-screen', 'end-screen');
  announce(`Simulation complete. Final grade ${results.grade.letter}.`);
}

function displayError(message) {
  const target = document.getElementById('landing-screen') || document.body;
  const errorBox = document.createElement('div');
  errorBox.className = 'error-message';
  errorBox.setAttribute('role', 'alert');
  errorBox.innerHTML = `<strong>Unable to continue.</strong><p>${message}</p>`;
  target.appendChild(errorBox);
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
    currentScenarioChoices: Array.isArray(savedState.currentScenarioChoices) ? savedState.currentScenarioChoices : []
  });
}

async function enterGameScreen(skipTransition = false) {
  if (skipTransition) {
    showScreen('game-screen');
    return;
  }
  await animateScreenTransition('landing-screen', 'game-screen');
}

function updateTimerButtonsAfterPauseState() {
  gameState.timerPaused = getTimerState().paused;
  syncExamTimerControls();
  saveSessionState();
}

export async function initGame(options = {}) {
  try {
    const selections = options.selections || readCurrentSelections();
    savePreferences();

    const catalog = await ensureScenarioCatalog(options.scenarioData);
    const orderedScenarioIds = options.orderedScenarioIds
      || buildSessionScenarioIds(catalog, selections.mode, selections.difficulty, options);

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
      timerPaused: false
    });

    await enterGameScreen(Boolean(options.skipTransition));
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

  await enterGameScreen(false);
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
  if (!validateSavedState(savedState)) {
    return;
  }

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

async function openDashboardScreen() {
  await ensureScenarioCatalog();
  renderDashboard(scenarioCatalog);
  await animateScreenTransition('landing-screen', 'dashboard-screen');
}

async function returnToLanding(fromScreenId = 'end-screen') {
  stopSessionClock();
  stopTimer();
  await animateScreenTransition(fromScreenId, 'landing-screen');
  showModeDescription();
}

async function saveAndQuit() {
  if (!sessionIsActive()) {
    returnToLanding('game-screen');
    return;
  }

  if (gameState.mode === 'examPrep') {
    pauseTimer();
    gameState.timerPaused = true;
  }
  saveSessionState();
  stopSessionClock();
  await animateScreenTransition('game-screen', 'landing-screen');
  announce('Session saved. You can resume it later from this device.');
}

function bindControls() {
  document.getElementById('begin-btn')?.addEventListener('click', () => initGame());
  document.getElementById('restart-btn')?.addEventListener('click', async () => {
    clearSavedSessionState();
    resetGameState();
    await returnToLanding('end-screen');
  });
  document.getElementById('my-progress-btn')?.addEventListener('click', openDashboardScreen);
  document.getElementById('dashboard-back-btn')?.addEventListener('click', async () => {
    await animateScreenTransition('dashboard-screen', 'landing-screen');
  });
  document.getElementById('export-csv-btn')?.addEventListener('click', () => {
    downloadAnalyticsCsv();
    announce('CSV export started.');
  });
  document.getElementById('clear-history-btn')?.addEventListener('click', () => {
    populateAppModal({
      title: 'Clear all saved history?',
      bodyHtml: '<p>This will erase every stored session from the Performance Dashboard. Your current in-progress game will not be affected.</p>',
      confirmText: 'Clear History',
      cancelText: 'Cancel',
      onConfirm: async () => {
        clearAnalyticsHistory();
        await ensureScenarioCatalog();
        renderDashboard(scenarioCatalog);
        announce('Performance history cleared.');
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

  window.addEventListener('beforeunload', () => {
    if (sessionIsActive()) {
      saveSessionState();
    }
  });
}

export function bootstrapApp() {
  if (bootstrapComplete) {
    return;
  }
  bootstrapComplete = true;

  applyPreferencesToControls();
  showModeDescription();
  initDarkModeToggle();
  bindControls();
  showScreen('landing-screen');
  promptToResumeSavedSession();
}

export const __testHooks = {
  getStateSnapshot: () => deepClone(gameState),
  getActiveScenario: () => deepClone(activeScenario),
  setScenarioCatalogForTests(catalog) {
    scenarioCatalog = deepClone(catalog || []);
  },
  clearSavedStateForTests() {
    clearSavedSessionState();
    resetGameState();
    stopSessionClock();
    stopTimer();
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
  }
};

if (typeof window !== 'undefined' && !window.__CB_DISABLE_BOOTSTRAP__) {
  document.addEventListener('DOMContentLoaded', bootstrapApp);
}
