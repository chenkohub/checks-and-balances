import { initGame, __testHooks, SAVE_STORAGE_KEY } from '../game.js';
import { test, assert, equal, includes, wait } from './test-utils.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mountAppShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <div id="aria-live-region" aria-live="polite" aria-atomic="true"></div>

    <section id="landing-screen" class="screen active" aria-hidden="false"></section>

    <section id="game-screen" class="screen hidden" aria-hidden="true">
      <header class="game-header">
        <span id="branch-badge" class="branch-badge"></span>
        <div id="timer-display" class="timer-display hidden"><span id="timer-time">00:00</span></div>
        <div id="score-value">0</div>
        <button id="save-quit-btn" type="button">Save &amp; Quit</button>
        <button id="dark-mode-toggle" type="button">🌙</button>
      </header>

      <div class="progress-container" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
        <div id="progress-bar"></div>
        <span id="progress-label"></span>
      </div>

      <div id="timer-controls" class="hidden">
        <button id="timer-pause-btn" type="button">Pause</button>
        <button id="timer-resume-btn" class="hidden" type="button">Resume</button>
        <button id="timer-extend-btn" type="button">Extend</button>
      </div>

      <div id="scenario-title"></div>
      <div id="difficulty-badge"></div>
      <div id="doctrine-tag"></div>
      <div id="step-indicator"></div>
      <div id="scenario-description"></div>
      <div id="scenario-prompt"></div>
      <div id="choices-container"></div>
      <div id="argument-builder-container" class="hidden"></div>
      <div id="counter-argument-container" class="hidden"></div>

      <aside id="precedent-tracker" class="hidden">
        <ul class="precedent-list"><li class="precedent-empty">No precedents</li></ul>
      </aside>
    </section>

    <section id="dashboard-screen" class="screen hidden" aria-hidden="true">
      <button id="dashboard-back-btn" type="button">Back</button>
      <button id="export-csv-btn" type="button">Export</button>
      <button id="clear-history-btn" type="button">Clear</button>
      <div id="dashboard-empty-state"></div>
      <div id="dashboard-content" class="hidden"></div>
      <div id="dashboard-total-sessions"></div>
      <div id="dashboard-average-score"></div>
      <div id="dashboard-best-score"></div>
      <div id="dashboard-doctrine-breakdown"></div>
      <ul id="dashboard-weakest-doctrines"></ul>
      <table><tbody id="dashboard-session-history-body"></tbody></table>
    </section>

    <section id="end-screen" class="screen hidden" aria-hidden="true">
      <div id="end-total-score"></div>
      <div id="end-max-score"></div>
      <div id="end-percentage"></div>
      <div id="end-grade-badge"></div>
      <div id="end-grade-description"></div>
      <div id="end-breakdown"></div>
      <div id="exam-review-container" class="hidden"></div>
      <button id="restart-btn" type="button">Restart</button>
    </section>

    <div id="feedback-modal" class="modal-overlay hidden" aria-hidden="true">
      <button id="feedback-close-btn" type="button">Close</button>
      <div id="feedback-content"></div>
    </div>

    <div id="app-modal" class="modal-overlay hidden" aria-hidden="true">
      <button id="app-modal-close-btn" type="button">Close</button>
      <div id="app-modal-title"></div>
      <div id="app-modal-body"></div>
      <div id="app-modal-actions"></div>
    </div>

    <div id="case-popup" class="case-popup hidden" aria-hidden="true"></div>
  `;

  return root;
}

function baseScenario(overrides = {}) {
  return {
    id: 'alpha',
    title: 'Alpha Scenario',
    branch: 'judiciary',
    doctrineArea: 'Doctrine Alpha',
    difficulty: 'easy',
    description: 'Alpha description.',
    steps: [
      {
        type: 'multiple_choice',
        prompt: 'Choose the strongest answer.',
        choices: [
          {
            id: 'alpha-1',
            text: 'Correct answer',
            points: 10,
            correct: 'correct',
            explanation: 'Correct explanation.'
          },
          {
            id: 'alpha-2',
            text: 'Incorrect answer',
            points: 0,
            correct: 'incorrect',
            explanation: 'Incorrect explanation.'
          }
        ]
      }
    ],
    overallExplanation: 'Overall doctrinal explanation.',
    caseReferences: [],
    professorNote: '',
    analyticalLens: 'both',
    otherSide: '',
    ...overrides
  };
}

function prepareEnvironment() {
  localStorage.clear();
  mountAppShell();
  __testHooks.clearSavedStateForTests();
}

async function clickFirstChoiceAndWait() {
  const button = document.querySelector('.choice-btn');
  assert(button, 'Expected a rendered choice button.');
  button.click();
  await wait(550);
}

test('Starting a new standard game loads the first scenario and shows the game screen.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'all', timerMinutes: 30 }
  });

  assert(document.getElementById('game-screen').classList.contains('active'), 'Game screen should be active.');
  equal(document.getElementById('scenario-title').textContent, 'Alpha Scenario');
  equal(__testHooks.getStateSnapshot().mode, 'standard');
});

test('Making a correct choice updates the score and saves state to localStorage.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();

  equal(document.getElementById('score-value').textContent, '10');
  const savedState = JSON.parse(localStorage.getItem(SAVE_STORAGE_KEY));
  equal(savedState.legitimacyPoints, 10);
  equal(savedState.history.length, 1);
});

test('Completing a scenario and continuing advances to the next scenario.', async () => {
  prepareEnvironment();
  const scenarios = [
    baseScenario(),
    baseScenario({
      id: 'beta',
      title: 'Beta Scenario',
      doctrineArea: 'Doctrine Beta',
      description: 'Beta description.'
    })
  ];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha', 'beta'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(50);

  equal(document.getElementById('scenario-title').textContent, 'Beta Scenario');
  equal(__testHooks.getStateSnapshot().currentScenarioIndex, 1);
});

test('Campaign precedent flags are set and applied to later scenarios.', async () => {
  prepareEnvironment();
  const scenarios = [
    baseScenario({
      id: 'first-campaign',
      title: 'First Campaign Scenario',
      choices: undefined,
      steps: [
        {
          type: 'multiple_choice',
          prompt: 'Set a precedent.',
          choices: [
            {
              id: 'campaign-1',
              text: 'Create precedent',
              points: 10,
              correct: 'correct',
              explanation: 'Precedent created.',
              setsPrecedent: { sampleFlag: true }
            }
          ]
        }
      ]
    }),
    baseScenario({
      id: 'second-campaign',
      title: 'Second Campaign Scenario',
      description: 'Second scenario baseline description.',
      precedentConditions: [
        {
          precedent: 'sampleFlag',
          value: true,
          descriptionAppend: 'Precedent note is now active.',
          stepModifications: [
            {
              stepIndex: 0,
              choiceIndex: 0,
              textAppend: 'Adjusted by precedent.'
            }
          ]
        }
      ]
    })
  ];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['first-campaign', 'second-campaign'],
    selections: { mode: 'campaign', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(50);

  const state = __testHooks.getStateSnapshot();
  assert(state.precedentState.sampleFlag === true, 'Expected precedent flag to be saved in state.');
  includes(document.getElementById('scenario-description').textContent, 'Precedent note is now active.');
  includes(document.querySelector('.choice-btn').textContent, 'Adjusted by precedent.');
});

test('Exam Prep mode starts the timer and counts down.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'examPrep', difficulty: 'easy', timerMinutes: 0.05 }
  });

  assert(!document.getElementById('timer-display').classList.contains('hidden'), 'Timer should be visible in Exam Prep mode.');
  const initial = __testHooks.getStateSnapshot().timerRemainingSeconds;
  await wait(1100);
  const afterTick = __testHooks.getStateSnapshot().timerRemainingSeconds;
  assert(afterTick < initial, `Expected timer to count down from ${initial}, received ${afterTick}.`);
});

test('Finishing the last scenario displays the final score and grade.', async () => {
  prepareEnvironment();
  const scenarios = [baseScenario()];

  await initGame({
    skipTransition: true,
    scenarioData: clone(scenarios),
    orderedScenarioIds: ['alpha'],
    selections: { mode: 'standard', difficulty: 'easy', timerMinutes: 30 }
  });

  await clickFirstChoiceAndWait();
  document.getElementById('feedback-continue-btn').click();
  await wait(600);

  assert(document.getElementById('end-screen').classList.contains('active'), 'End screen should be active.');
  equal(document.getElementById('end-total-score').textContent, '10');
  equal(document.getElementById('end-percentage').textContent, '100%');
  equal(document.querySelector('#end-grade-badge .grade-letter').textContent, 'A');
});
