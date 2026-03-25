/**
 * analytics.js
 * Session-history storage and Performance Dashboard helpers.
 */

const ANALYTICS_STORAGE_KEY = 'cb-sim-analytics-v1';

function safeParse(jsonText, fallback) {
  try {
    return JSON.parse(jsonText);
  } catch (_error) {
    return fallback;
  }
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function loadAnalyticsHistory() {
  const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveAnalyticsHistory(history) {
  localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(history));
}

/**
 * Stores a completed session record.
 *
 * @param {object} sessionSummary
 */
export function recordCompletedSession(sessionSummary) {
  const history = loadAnalyticsHistory();
  history.unshift({
    sessionId:
      sessionSummary.sessionId
      || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playedAt: sessionSummary.playedAt || new Date().toISOString(),
    mode: sessionSummary.mode || 'standard',
    difficulty: sessionSummary.difficulty || 'all',
    finalScore: toNumber(sessionSummary.finalScore),
    maxScore: toNumber(sessionSummary.maxScore),
    percentage: toNumber(sessionSummary.percentage),
    grade: sessionSummary.grade || { letter: 'F', title: 'Overruled' },
    totalTimeMs: toNumber(sessionSummary.totalTimeMs),
    scenarios: Array.isArray(sessionSummary.scenarios) ? sessionSummary.scenarios : []
  });
  saveAnalyticsHistory(history);
  return history[0];
}

export function clearAnalyticsHistory() {
  localStorage.removeItem(ANALYTICS_STORAGE_KEY);
}

export function getAnalyticsSummary(history = loadAnalyticsHistory()) {
  const sessions = Array.isArray(history) ? history : [];
  const totalSessions = sessions.length;
  const totalScore = sessions.reduce((sum, session) => sum + toNumber(session.percentage), 0);
  const bestScore = sessions.reduce((best, session) => Math.max(best, toNumber(session.percentage)), 0);
  const averageScore = totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0;

  return { totalSessions, averageScore, bestScore };
}

export function getDoctrineBreakdown(history = loadAnalyticsHistory()) {
  const doctrineMap = new Map();

  (Array.isArray(history) ? history : []).forEach((session) => {
    (session.scenarios || []).forEach((scenario) => {
      const doctrine = scenario.doctrineArea || 'Uncategorized';
      const current = doctrineMap.get(doctrine) || {
        doctrineArea: doctrine,
        earned: 0,
        possible: 0,
        attempts: 0,
        scenarioIds: new Set()
      };

      current.earned += toNumber(scenario.scoreEarned);
      current.possible += Math.max(0, toNumber(scenario.maxScore));
      current.attempts += 1;
      if (scenario.scenarioId) {
        current.scenarioIds.add(scenario.scenarioId);
      }
      doctrineMap.set(doctrine, current);
    });
  });

  return [...doctrineMap.values()]
    .map((entry) => ({
      doctrineArea: entry.doctrineArea,
      accuracy: entry.possible > 0 ? Math.round((entry.earned / entry.possible) * 100) : 0,
      attempts: entry.attempts,
      scenarioIds: [...entry.scenarioIds]
    }))
    .sort((a, b) => a.accuracy - b.accuracy || a.doctrineArea.localeCompare(b.doctrineArea));
}

export function getWeakestDoctrines(history = loadAnalyticsHistory(), limit = 3) {
  return getDoctrineBreakdown(history).slice(0, Math.max(0, limit));
}

export function buildAnalyticsCsv(history = loadAnalyticsHistory()) {
  const rows = [[
    'Session ID',
    'Played At',
    'Mode',
    'Difficulty',
    'Final Score',
    'Max Score',
    'Percentage',
    'Grade',
    'Total Time (ms)',
    'Scenario ID',
    'Scenario Title',
    'Doctrine Area',
    'Scenario Score',
    'Scenario Max',
    'Choice Outcomes'
  ]];

  (Array.isArray(history) ? history : []).forEach((session) => {
    (session.scenarios || []).forEach((scenario) => {
      const outcomes = (scenario.choices || [])
        .map((choice) => `${choice.stepNumber}:${choice.outcome}`)
        .join(' | ');

      rows.push([
        session.sessionId,
        session.playedAt,
        session.mode,
        session.difficulty,
        session.finalScore,
        session.maxScore,
        session.percentage,
        session.grade?.letter || '',
        session.totalTimeMs,
        scenario.scenarioId,
        scenario.title,
        scenario.doctrineArea,
        scenario.scoreEarned,
        scenario.maxScore,
        outcomes
      ]);
    });
  });

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export function downloadAnalyticsCsv(filename = 'checks-and-balances-results.csv') {
  const csv = buildAnalyticsCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(isoString) {
  try {
    return new Date(isoString).toLocaleString();
  } catch (_error) {
    return isoString;
  }
}

function formatDuration(ms) {
  const safeMs = Math.max(0, toNumber(ms));
  const totalSeconds = Math.round(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Populates the dashboard screen.
 *
 * @param {Array<object>} scenarioCatalog
 */
export function renderDashboard(scenarioCatalog = []) {
  const history = loadAnalyticsHistory();
  const emptyState = document.getElementById('dashboard-empty-state');
  const content = document.getElementById('dashboard-content');
  const summary = getAnalyticsSummary(history);
  const doctrines = getDoctrineBreakdown(history);
  const weakest = getWeakestDoctrines(history, 4);

  if (!Array.isArray(history) || history.length === 0) {
    if (emptyState) {
      emptyState.classList.remove('hidden');
      emptyState.innerHTML = `
        <div class="dashboard-empty-card">
          <h3>No saved progress yet</h3>
          <p>Complete a session to start tracking doctrine-by-doctrine performance, session history, and replay recommendations.</p>
        </div>
      `;
    }
    if (content) {
      content.classList.add('hidden');
    }
    return;
  }

  if (emptyState) {
    emptyState.classList.add('hidden');
  }
  if (content) {
    content.classList.remove('hidden');
  }

  const totalSessionsEl = document.getElementById('dashboard-total-sessions');
  const averageScoreEl = document.getElementById('dashboard-average-score');
  const bestScoreEl = document.getElementById('dashboard-best-score');

  if (totalSessionsEl) totalSessionsEl.textContent = String(summary.totalSessions);
  if (averageScoreEl) averageScoreEl.textContent = `${summary.averageScore}%`;
  if (bestScoreEl) bestScoreEl.textContent = `${summary.bestScore}%`;

  const doctrineBreakdownEl = document.getElementById('dashboard-doctrine-breakdown');
  if (doctrineBreakdownEl) {
    doctrineBreakdownEl.innerHTML = doctrines
      .map((entry) => `
        <div class="doctrine-row">
          <div class="doctrine-row-main">
            <strong>${entry.doctrineArea}</strong>
            <span>${entry.attempts} attempt${entry.attempts === 1 ? '' : 's'}</span>
          </div>
          <div class="doctrine-meter" aria-label="${entry.doctrineArea} average accuracy ${entry.accuracy}%">
            <span class="doctrine-meter-fill" style="width: ${entry.accuracy}%;"></span>
          </div>
          <div class="doctrine-score">${entry.accuracy}%</div>
        </div>
      `)
      .join('');
  }

  const weakestEl = document.getElementById('dashboard-weakest-doctrines');
  if (weakestEl) {
    weakestEl.innerHTML = weakest
      .map((entry) => {
        const relatedTitles = scenarioCatalog
          .filter((scenario) => (entry.scenarioIds || []).includes(scenario.id))
          .map((scenario) => scenario.title)
          .slice(0, 3);

        const recommendation = relatedTitles.length > 0
          ? `Replay: ${relatedTitles.join('; ')}`
          : `Replay scenarios tagged ${entry.doctrineArea}.`;

        return `
          <li class="weakness-item">
            <strong>${entry.doctrineArea}</strong>
            <span>${entry.accuracy}% average accuracy</span>
            <p>${recommendation}</p>
          </li>
        `;
      })
      .join('');
  }

  const tableBody = document.getElementById('dashboard-session-history-body');
  if (tableBody) {
    tableBody.innerHTML = history
      .map((session) => `
        <tr>
          <td>${formatDate(session.playedAt)}</td>
          <td>${session.mode}</td>
          <td>${session.finalScore}/${session.maxScore}</td>
          <td>${session.percentage}%</td>
          <td>${session.grade?.letter || ''}</td>
          <td>${formatDuration(session.totalTimeMs)}</td>
        </tr>
      `)
      .join('');
  }
}
