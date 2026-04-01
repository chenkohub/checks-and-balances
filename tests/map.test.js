import { loadCampaignData, unlockAvailableNodes } from '../progress.js';
import { renderCampaignMap, __testHooks, computeNodeState } from '../map.js';
import { test, assert, equal, wait } from './test-utils.js';

const scenarioCatalog = [
  {
    id: 'youngstown-steel-seizure',
    title: 'The Steel Seizure Crisis',
    doctrineArea: 'Youngstown Framework / Separation of Powers',
    branch: 'judiciary',
    difficulty: 'medium'
  },
  {
    id: 'ins-v-chadha-legislative-veto',
    title: 'The Legislative Veto Showdown',
    doctrineArea: 'Bicameralism and Presentment / Legislative Veto',
    branch: 'judiciary',
    difficulty: 'easy'
  },
  {
    id: 'the-frozen-accounts',
    title: 'The Frozen Accounts',
    doctrineArea: 'Youngstown Zone 2 / Frankfurter Historical Practice Test',
    branch: 'judiciary',
    difficulty: 'medium'
  }
];

function mountMapShell() {
  const root = document.getElementById('fixture-root');
  root.innerHTML = `
    <div class="map-toolbar">
      <div class="map-toolbar-group">
        <label for="map-region-filter">Region</label>
        <select id="map-region-filter">
          <option value="all">All Regions</option>
        </select>
      </div>
      <div class="map-toolbar-group">
        <label class="toggle-row" for="map-emphasize-toggle">
          <span>Highlight related nodes</span>
          <input id="map-emphasize-toggle" type="checkbox" checked />
        </label>
      </div>
      <div class="map-toolbar-summary">
        <span id="map-summary-count"></span>
      </div>
    </div>
    <details class="map-legend-details">
      <summary>Region Progress</summary>
      <ul id="map-region-list"></ul>
      <div class="map-legend-key"></div>
    </details>
    <nav id="map-breadcrumb" class="map-breadcrumb hidden">
      <button id="map-back-btn" type="button">&larr; All Regions</button>
      <span id="map-breadcrumb-region"></span>
    </nav>
    <div id="map-canvas" class="map-canvas">
      <div id="map-overview-layer" class="map-overview-layer"></div>
      <div id="map-subregion-layer" class="map-subregion-layer"></div>
      <svg id="map-svg-layer"></svg>
      <div id="map-node-layer"></div>
    </div>
    <div id="map-selected-title"></div>
    <div id="map-selected-meta"></div>
    <div id="map-selected-region"></div>
    <div id="map-selected-requirements"></div>
    <div id="map-selected-status"></div>
    <div id="map-selected-rewards"></div>
    <div id="map-selected-hint"></div>
    <div id="map-selected-stars"></div>
    <button id="map-play-btn" type="button"></button>
    <button id="map-view-library-btn" type="button"></button>
    <div id="map-practice-only-label" class="hidden"></div>
    <div id="map-mentor-panel"></div>
  `;
}

function baseProfile() {
  return {
    settings: { mentorCharacterId: 'chief-clerk', sandboxEnabled: true },
    scenarioProgress: {
      'youngstown-steel-seizure': { unlocked: true, completed: true, stars: 3 },
      'ins-v-chadha-legislative-veto': { unlocked: true, completed: false, stars: 0 },
      'the-frozen-accounts': { unlocked: false, completed: false, stars: 0 }
    },
    campaign: {
      currentNodeId: 'ins-v-chadha-legislative-veto',
      unlockedNodeIds: ['youngstown-steel-seizure', 'ins-v-chadha-legislative-veto'],
      completedNodeIds: ['youngstown-steel-seizure'],
      discoveredRegionIds: ['executive-power', 'separation-of-powers']
    }
  };
}

/** Helper: set viewState to region mode for a specific region before rendering. */
function enterRegionMode(regionId, selectedNodeId) {
  const vs = __testHooks.getViewState();
  __testHooks.setViewState({
    ...vs,
    mode: 'region',
    activeRegionId: regionId,
    selectedNodeId: selectedNodeId || null
  });
}

test('Overview renders region tiles for each region.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const tiles = document.querySelectorAll('.map-region-tile');
  assert(tiles.length >= 8, 'Overview should render a tile for each of the 8 regions.');
  assert(document.querySelector('[data-region-id="executive-power"]'), 'Executive power region tile should exist.');
  assert(document.querySelector('[data-region-id="equal-protection"]'), 'Equal protection region tile should exist.');
});

test('Map node state classes render correctly in region view.', async () => {
  mountMapShell();
  __testHooks.clear();
  enterRegionMode('executive-power', 'youngstown-steel-seizure');
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const completedNode = document.querySelector('[data-node-id="youngstown-steel-seizure"]');

  assert(completedNode.classList.contains('is-completed'), 'Completed node should be marked completed.');
  assert(completedNode.classList.contains('is-mastered'), 'Three-star node should be marked mastered.');
});

test('Selected nodes show labels while unrelated side-path nodes stay hidden.', async () => {
  mountMapShell();
  __testHooks.clear();
  enterRegionMode('executive-power', 'the-frozen-accounts');
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const selectedNode = document.querySelector('[data-node-id="the-frozen-accounts"]');
  const unrelatedNode = document.querySelector('[data-node-id="the-subpoenaed-tapes"]');

  assert(selectedNode.classList.contains('show-label'), 'Selected nodes should surface their label.');
  assert(!unrelatedNode.classList.contains('show-label'), 'Unrelated non-main-path nodes should keep labels hidden.');
});

test('Selecting a node updates the sidebar detail panel.', async () => {
  mountMapShell();
  __testHooks.clear();
  enterRegionMode('separation-of-powers', 'ins-v-chadha-legislative-veto');
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const activeNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');
  activeNode.click();
  await wait(60);

  equal(document.getElementById('map-selected-title').textContent, 'The Legislative Veto Showdown');
  assert(document.getElementById('map-selected-status').textContent.includes('Active') || document.getElementById('map-selected-status').textContent.includes('Unlocked'), 'Sidebar status should update for the selected node.');
  assert(document.getElementById('map-selected-region').textContent.includes('Region:'), 'Sidebar should include region context.');
  assert(document.getElementById('map-selected-requirements').textContent.length > 0, 'Sidebar should include requirement context.');
});

test('Region filter switches to region view.', async () => {
  mountMapShell();
  __testHooks.clear();
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const regionFilter = document.getElementById('map-region-filter');
  regionFilter.value = 'executive-power';
  regionFilter.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(60);

  const executiveNode = document.querySelector('[data-node-id="youngstown-steel-seizure"]');
  assert(executiveNode, 'Filtering to executive-power should render executive-power nodes.');

  const breadcrumb = document.getElementById('map-breadcrumb');
  assert(!breadcrumb.classList.contains('hidden'), 'Breadcrumb should be visible in region view.');
});

test('Selected nodes highlight adjacent edges in region view.', async () => {
  mountMapShell();
  __testHooks.clear();
  enterRegionMode('executive-power', 'the-frozen-accounts');
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const connectedEdges = document.querySelectorAll('.campaign-edge.is-connected');
  assert(connectedEdges.length >= 1, 'The selected node should emphasize at least one connected edge.');
});

test('Nodes render pin markup instead of star text blocks.', async () => {
  mountMapShell();
  __testHooks.clear();
  enterRegionMode('executive-power', 'youngstown-steel-seizure');
  await renderCampaignMap({ profile: baseProfile(), scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const node = document.querySelector('[data-node-id="youngstown-steel-seizure"]');
  assert(node.querySelector('.campaign-node-dot'), 'Node pins should render a compact dot.');
  assert(!node.querySelector('.campaign-node-stars'), 'Legacy star text blocks should not render inside nodes.');
});

test('Completed nodes unlock expected children on the map.', async () => {
  mountMapShell();
  __testHooks.clear();
  const campaignData = await loadCampaignData();
  const profile = baseProfile();
  profile.campaign.unlockedNodeIds = ['youngstown-steel-seizure'];
  profile.campaign.completedNodeIds = ['youngstown-steel-seizure'];

  const newUnlocks = unlockAvailableNodes(profile, campaignData);
  assert(newUnlocks.includes('ins-v-chadha-legislative-veto'), 'The next main-path node should unlock after Youngstown.');

  enterRegionMode('separation-of-powers');
  await renderCampaignMap({ profile, scenarioCatalog, onPlay: () => {}, onViewInLibrary: () => {} });

  const childNode = document.querySelector('[data-node-id="ins-v-chadha-legislative-veto"]');
  assert(childNode.classList.contains('is-unlocked'), 'Unlocked child node should render with the unlocked class.');
});

test('computeNodeState marks sandbox-only scenarios without changing unlock state.', () => {
  const node = {
    id: 'the-frozen-accounts',
    scenarioId: 'the-frozen-accounts'
  };

  const state = computeNodeState(baseProfile(), node, { allowSandboxPractice: true });
  assert(state.practiceOnly, 'Locked nodes should be marked practice-only when sandbox is enabled.');
  assert(!state.unlocked, 'Practice-only nodes should remain locked for campaign progression.');
});
