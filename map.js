/**
 * map.js
 * Campaign map rendering and node detail handling.
 * Two-level UI: region overview → zoomed region view with sub-region shading.
 */

import { loadCampaignData, computeCompletionSummary, isScenarioUnlocked, getScenarioProgress } from './progress.js';
import { getMapMentorContent } from './character.js';
import { renderMentorPanel } from './ui.js';

let lastRenderContext = null;
let viewState = {
  mode: 'overview',        // 'overview' | 'region'
  activeRegionId: null,    // set when mode === 'region'
  selectedNodeId: null,
  emphasizeConnected: true
};

/* ── Utilities ─────────────────────────────────────────────────────── */

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getScenarioById(scenarioCatalog, scenarioId) {
  return scenarioCatalog.find((scenario) => scenario.id === scenarioId) || null;
}

function getNodeById(campaignData, nodeId) {
  return (campaignData?.nodes || []).find((node) => node.id === nodeId) || null;
}

function getRegionById(campaignData, regionId) {
  return (campaignData?.regions || []).find((region) => region.id === regionId) || null;
}

function joinWithConjunction(items = [], conjunction = 'and') {
  if (items.length <= 1) {
    return items[0] || '';
  }

  if (items.length === 2) {
    return `${items[0]} ${conjunction} ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

function getNodeTitle(nodeId, campaignData, scenarioCatalog) {
  const node = getNodeById(campaignData, nodeId);
  const scenario = node ? getScenarioById(scenarioCatalog, node.scenarioId) : null;
  return getShortNodeLabel(scenario?.title || nodeId);
}

export function computeNodeState(profile, node, options = {}) {
  const unlocked = (profile?.campaign?.unlockedNodeIds || []).includes(node.id);
  const completed = (profile?.campaign?.completedNodeIds || []).includes(node.id);
  const progress = getScenarioProgress(profile, node.scenarioId);
  const mastered = Number(progress.stars || 0) >= 3;
  const active = profile?.campaign?.currentNodeId === node.id;
  const practiceOnly = !unlocked && Boolean(profile?.settings?.sandboxEnabled) && Boolean(options.allowSandboxPractice);

  return {
    unlocked,
    completed,
    mastered,
    active,
    practiceOnly,
    statusLabel: completed
      ? (mastered ? 'Mastered' : 'Completed')
      : unlocked
        ? (active ? 'Active node' : 'Unlocked')
        : practiceOnly
          ? 'Practice only'
          : 'Locked'
  };
}

function buildNodeGraph(campaignData) {
  const nodes = campaignData?.nodes || [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const parentsById = new Map(nodes.map((node) => [node.id, new Set()]));
  const childrenById = new Map(nodes.map((node) => [node.id, new Set()]));

  const linkNodes = (fromId, toId) => {
    if (!nodeById.has(fromId) || !nodeById.has(toId)) {
      return;
    }
    childrenById.get(fromId)?.add(toId);
    parentsById.get(toId)?.add(fromId);
  };

  (campaignData?.edges || []).forEach((edge) => {
    linkNodes(edge.from, edge.to);
  });

  nodes.forEach((node) => {
    [...(node.requiresAll || []), ...(node.requiresAny || [])].forEach((parentId) => {
      linkNodes(parentId, node.id);
    });
  });

  const adjacentById = new Map();
  nodeById.forEach((_, nodeId) => {
    adjacentById.set(nodeId, new Set([
      ...(parentsById.get(nodeId) || []),
      ...(childrenById.get(nodeId) || [])
    ]));
  });

  return {
    nodeById,
    parentsById,
    childrenById,
    adjacentById
  };
}

function getConnectedNodeIds(campaignData, selectedNodeId) {
  if (!selectedNodeId) {
    return new Set();
  }

  const graph = buildNodeGraph(campaignData);
  const connected = new Set([selectedNodeId]);

  (graph.parentsById.get(selectedNodeId) || new Set()).forEach((nodeId) => connected.add(nodeId));
  (graph.childrenById.get(selectedNodeId) || new Set()).forEach((nodeId) => connected.add(nodeId));

  return connected;
}

function isMainPathConnection(edge, mainPath = []) {
  const fromIndex = mainPath.indexOf(edge.from);
  const toIndex = mainPath.indexOf(edge.to);

  if (fromIndex === -1 || toIndex === -1) {
    return false;
  }

  return Math.abs(fromIndex - toIndex) === 1;
}

function getShortNodeLabel(title) {
  const normalized = String(title || '').replace(/^The\s+/i, '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= 24) {
    return normalized;
  }

  const primarySegment = normalized.split(/[:\-–—]/).map((segment) => segment.trim()).find(Boolean);
  if (primarySegment && primarySegment.length <= 24) {
    return primarySegment;
  }

  return `${normalized.slice(0, 21).trimEnd()}…`;
}

/* ── Visual state helpers ──────────────────────────────────────────── */

function computeVisualClasses(node, state, currentViewState, campaignData) {
  const connectedNodeIds = currentViewState.emphasizeConnected
    ? getConnectedNodeIds(campaignData, currentViewState.selectedNodeId)
    : new Set();
  const selectedNodeId = currentViewState.selectedNodeId;
  const isSelected = selectedNodeId === node.id;
  const isConnected = Boolean(
    currentViewState.emphasizeConnected
      && selectedNodeId
      && node.id !== selectedNodeId
      && connectedNodeIds.has(node.id)
  );
  const isMainPath = (campaignData?.mainPath || []).includes(node.id);

  let isDimmed = false;

  if (
    currentViewState.emphasizeConnected
    && selectedNodeId
    && connectedNodeIds.size > 0
    && !connectedNodeIds.has(node.id)
  ) {
    isDimmed = true;
  }

  return [
    state.unlocked ? 'is-unlocked' : 'is-locked',
    state.completed ? 'is-completed' : '',
    state.mastered ? 'is-mastered' : '',
    state.active ? 'is-active' : '',
    state.practiceOnly ? 'is-practice-only' : '',
    isSelected ? 'is-selected' : '',
    isConnected ? 'is-connected' : '',
    isMainPath ? 'is-main-path' : '',
    isDimmed ? 'is-dimmed' : ''
  ].filter(Boolean);
}

function shouldShowNodeLabel(node, state, currentViewState, campaignData) {
  if (currentViewState.selectedNodeId === node.id) {
    return true;
  }

  if (state.active) {
    return true;
  }

  const hasPinnedContext = Boolean(currentViewState.selectedNodeId || state.active);
  if (hasPinnedContext) {
    return false;
  }

  return (campaignData?.mainPath || []).slice(0, 4).includes(node.id);
}

function getPreferredNodeIdForRegion(campaignData, profile, regionId) {
  const nodes = (campaignData?.nodes || []).filter((node) => node.regionId === regionId);

  if (!nodes.length) {
    return (campaignData?.nodes || [])[0]?.id || null;
  }

  const activeNode = nodes.find((node) => profile?.campaign?.currentNodeId === node.id);
  if (activeNode) {
    return activeNode.id;
  }

  const unlockedNode = nodes.find((node) => (profile?.campaign?.unlockedNodeIds || []).includes(node.id));
  if (unlockedNode) {
    return unlockedNode.id;
  }

  return nodes[0]?.id || null;
}

/* ── Coordinate rescaling ──────────────────────────────────────────── */

function computeRegionBounds(campaignData, regionId) {
  const regionNodes = (campaignData?.nodes || []).filter((n) => n.regionId === regionId);
  if (!regionNodes.length) {
    return { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  }

  const xs = regionNodes.map((n) => n.x);
  const ys = regionNodes.map((n) => n.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
}

function rescaleCoord(value, min, max, padding) {
  const range = max - min;
  if (range === 0) return 50;
  return padding + ((value - min) / range) * (100 - 2 * padding);
}

/* ── Color helpers (hex → rgba, no color-mix needed) ───────────────── */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function tileStyleVars(hex) {
  return [
    `--tile-bg:${rgba(hex, 0.08)}`,
    `--tile-border:${rgba(hex, 0.30)}`,
    `--tile-hover-bg:${rgba(hex, 0.14)}`,
    `--tile-hover-border:${rgba(hex, 0.60)}`,
    `--tile-glow:${rgba(hex, 0.10)}`,
    `--region-color:${hex}`,
    `--tile-bar-color:${hex}`
  ].join(';');
}

function regionWashVars(hex) {
  return [
    `--region-wash-strong:${rgba(hex, 0.18)}`,
    `--region-wash-mid:${rgba(hex, 0.12)}`,
    `--region-wash-light:${rgba(hex, 0.04)}`
  ].join(';');
}

/* ── Overview rendering ────────────────────────────────────────────── */

function getRegionProgress(campaignData, profile, regionId) {
  const regionNodes = (campaignData?.nodes || []).filter((n) => n.regionId === regionId);
  const total = regionNodes.length;
  const completed = regionNodes.filter((n) => {
    return profile?.scenarioProgress?.[n.scenarioId]?.completed;
  }).length;
  return { completed, total };
}

function renderOverview(campaignData, profile) {
  const overviewLayer = document.getElementById('map-overview-layer');
  const svgLayer = document.getElementById('map-svg-layer');
  const nodeLayer = document.getElementById('map-node-layer');
  const subregionLayer = document.getElementById('map-subregion-layer');
  const breadcrumb = document.getElementById('map-breadcrumb');

  if (!overviewLayer) return;

  // Show overview, hide region layers
  overviewLayer.classList.remove('hidden');
  if (svgLayer) svgLayer.classList.add('hidden');
  if (nodeLayer) nodeLayer.classList.add('hidden');
  if (subregionLayer) subregionLayer.classList.add('hidden');
  if (breadcrumb) breadcrumb.classList.add('hidden');

  const regions = campaignData?.regions || [];

  overviewLayer.innerHTML = regions.map((region, index) => {
    const progress = getRegionProgress(campaignData, profile, region.id);
    const color = region.color || '#475569';
    const progressPct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

    return `
      <button
        type="button"
        class="map-region-tile"
        data-region-id="${escapeHtml(region.id)}"
        style="${tileStyleVars(color)}"
        aria-label="${escapeHtml(region.label)} — ${progress.completed} of ${progress.total} complete"
      >
        <span class="map-region-tile-label">${escapeHtml(region.label)}</span>
        <span class="map-region-tile-progress">${progress.completed}/${progress.total}</span>
        <div class="map-region-tile-bar">
          <div class="map-region-tile-bar-fill" style="width: ${progressPct}%;"></div>
        </div>
      </button>
    `;
  }).join('');

  // Bind click handlers
  overviewLayer.querySelectorAll('.map-region-tile').forEach((tile) => {
    tile.addEventListener('click', async () => {
      const regionId = tile.dataset.regionId;
      viewState.mode = 'region';
      viewState.activeRegionId = regionId;
      viewState.selectedNodeId = getPreferredNodeIdForRegion(campaignData, profile, regionId);
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  });
}

/* ── Region view rendering (nodes, edges, sub-regions) ─────────────── */

function renderSubRegionZones(campaignData, regionId, bounds) {
  const subregionLayer = document.getElementById('map-subregion-layer');
  if (!subregionLayer) return;

  const region = getRegionById(campaignData, regionId);
  const subRegions = region?.subRegions || [];

  if (!subRegions.length) {
    subregionLayer.innerHTML = '';
    return;
  }

  const padding = 8; // match the node rescaling padding

  subregionLayer.innerHTML = subRegions.map((sr) => {
    // Find the bounding box of nodes in this sub-region
    const srNodes = (campaignData?.nodes || []).filter((n) => sr.nodeIds.includes(n.id));
    if (!srNodes.length) return '';

    const xs = srNodes.map((n) => rescaleCoord(n.x, bounds.minX, bounds.maxX, padding));
    const ys = srNodes.map((n) => rescaleCoord(n.y, bounds.minY, bounds.maxY, padding));

    const zonePad = 4; // extra visual padding around the group
    const left = Math.max(0, Math.min(...xs) - zonePad);
    const top = Math.max(0, Math.min(...ys) - zonePad);
    const right = Math.min(100, Math.max(...xs) + zonePad);
    const bottom = Math.min(100, Math.max(...ys) + zonePad);

    return `
      <div
        class="map-subregion-zone"
        style="left:${left}%; top:${top}%; width:${right - left}%; height:${bottom - top}%; background:${sr.color};"
        aria-hidden="true"
      >
        <span class="map-subregion-zone-label">${escapeHtml(sr.label)}</span>
      </div>
    `;
  }).join('');
}

function renderRegionEdges(campaignData, profile, regionId, bounds) {
  const svg = document.getElementById('map-svg-layer');
  if (!svg) return;

  const padding = 8;
  const graph = buildNodeGraph(campaignData);
  const regionNodeIds = new Set(
    (campaignData?.nodes || []).filter((n) => n.regionId === regionId).map((n) => n.id)
  );
  const connectedNodeIds = viewState.emphasizeConnected
    ? getConnectedNodeIds(campaignData, viewState.selectedNodeId)
    : new Set();

  // Only render edges where both endpoints are in this region
  const regionEdges = (campaignData?.edges || []).filter((edge) => {
    return regionNodeIds.has(edge.from) && regionNodeIds.has(edge.to);
  });

  svg.innerHTML = regionEdges.map((edge) => {
    const from = graph.nodeById.get(edge.from);
    const to = graph.nodeById.get(edge.to);
    if (!from || !to) return '';

    const x1 = rescaleCoord(from.x, bounds.minX, bounds.maxX, padding);
    const y1 = rescaleCoord(from.y, bounds.minY, bounds.maxY, padding);
    const x2 = rescaleCoord(to.x, bounds.minX, bounds.maxX, padding);
    const y2 = rescaleCoord(to.y, bounds.minY, bounds.maxY, padding);

    const isConnected = Boolean(
      viewState.emphasizeConnected
        && viewState.selectedNodeId
        && connectedNodeIds.has(edge.from)
        && connectedNodeIds.has(edge.to)
    );
    const isMainPathEdge = isMainPathConnection(edge, campaignData?.mainPath || []);

    let isDimmed = false;
    if (viewState.emphasizeConnected && viewState.selectedNodeId && !isConnected) {
      isDimmed = true;
    }

    const edgeClasses = [
      'campaign-edge',
      isMainPathEdge ? 'is-main-path' : '',
      isConnected ? 'is-connected' : '',
      isDimmed ? 'is-dimmed' : ''
    ].filter(Boolean).join(' ');

    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${edgeClasses}" />`;
  }).join('');
}

function renderRegionNodes(campaignData, profile, scenarioCatalog, regionId, bounds, onPlay, onViewInLibrary) {
  const layer = document.getElementById('map-node-layer');
  if (!layer) return;

  const padding = 8;
  const regionNodes = (campaignData?.nodes || []).filter((n) => n.regionId === regionId);

  layer.innerHTML = regionNodes.map((node) => {
    const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
    const state = computeNodeState(profile, node, { allowSandboxPractice: true });
    const progress = getScenarioProgress(profile, node.scenarioId);
    const starCount = Number(progress.stars || 0);
    const showLabel = shouldShowNodeLabel(node, state, viewState, campaignData);
    const shortTitle = getShortNodeLabel(scenario?.title || node.id);
    const classes = ['campaign-node', ...computeVisualClasses(node, state, viewState, campaignData), showLabel ? 'show-label' : '']
      .filter(Boolean)
      .join(' ');

    const rx = rescaleCoord(node.x, bounds.minX, bounds.maxX, padding);
    const ry = rescaleCoord(node.y, bounds.minY, bounds.maxY, padding);

    return `
      <button
        type="button"
        class="${classes}"
        data-node-id="${escapeHtml(node.id)}"
        data-region-id="${escapeHtml(node.regionId)}"
        style="left:${rx}%; top:${ry}%;"
        aria-label="${escapeHtml(scenario?.title || node.id)} — ${escapeHtml(state.statusLabel)} — ${starCount} stars"
        aria-pressed="${String(viewState.selectedNodeId === node.id)}"
      >
        <span class="campaign-node-core" aria-hidden="true">
          <span class="campaign-node-dot"></span>
          ${starCount > 0 ? `<span class="campaign-node-star-badge">${'★'.repeat(starCount)}</span>` : ''}
        </span>
        <span class="campaign-node-label">${escapeHtml(shortTitle)}</span>
      </button>
    `;
  }).join('');

  layer.querySelectorAll('.campaign-node').forEach((button) => {
    button.addEventListener('click', async () => {
      viewState.selectedNodeId = button.dataset.nodeId;
      await renderCampaignMap({ profile, scenarioCatalog, onPlay, onViewInLibrary });
    });
  });
}

function renderRegionView(campaignData, profile, scenarioCatalog, regionId, onPlay, onViewInLibrary) {
  const overviewLayer = document.getElementById('map-overview-layer');
  const svgLayer = document.getElementById('map-svg-layer');
  const nodeLayer = document.getElementById('map-node-layer');
  const subregionLayer = document.getElementById('map-subregion-layer');
  const breadcrumb = document.getElementById('map-breadcrumb');
  const breadcrumbRegion = document.getElementById('map-breadcrumb-region');
  const canvas = document.getElementById('map-canvas');

  // Hide overview, show region layers
  if (overviewLayer) overviewLayer.classList.add('hidden');
  if (svgLayer) svgLayer.classList.remove('hidden');
  if (nodeLayer) nodeLayer.classList.remove('hidden');
  if (subregionLayer) subregionLayer.classList.remove('hidden');

  // Show breadcrumb
  if (breadcrumb) breadcrumb.classList.remove('hidden');
  const region = getRegionById(campaignData, regionId);
  if (breadcrumbRegion) {
    breadcrumbRegion.textContent = region?.label || regionId;
  }

  // Set region color wash on the canvas
  if (canvas && region?.color) {
    const washStyle = regionWashVars(region.color);
    washStyle.split(';').forEach((pair) => {
      const [prop, val] = pair.split(':');
      if (prop && val) canvas.style.setProperty(prop.trim(), val.trim());
    });
    canvas.classList.add('has-active-region');
  }

  const bounds = computeRegionBounds(campaignData, regionId);
  renderSubRegionZones(campaignData, regionId, bounds);
  renderRegionEdges(campaignData, profile, regionId, bounds);
  renderRegionNodes(campaignData, profile, scenarioCatalog, regionId, bounds, onPlay, onViewInLibrary);
}

/* ── Legend and toolbar ─────────────────────────────────────────────── */

function renderLegend(campaignData, profile, scenarioCatalog) {
  const legend = document.getElementById('map-region-list');
  if (!legend) return;

  legend.innerHTML = (campaignData?.regions || []).map((region) => {
    const total = (campaignData?.nodes || []).filter((node) => node.regionId === region.id).length;
    const completed = (campaignData?.nodes || []).filter((node) => {
      return node.regionId === region.id && profile?.scenarioProgress?.[node.scenarioId]?.completed;
    }).length;
    const dotColor = region.color || '#94a3b8';
    return `
      <li class="region-legend-item">
        <span><i class="legend-dot" style="background:${dotColor};"></i> <strong>${escapeHtml(region.label)}</strong></span>
        <span>${completed}/${total}</span>
      </li>
    `;
  }).join('');

  const completion = computeCompletionSummary(profile, scenarioCatalog);
  const summary = document.getElementById('map-summary-count');
  if (summary) {
    summary.textContent = `${completion.completed}/${completion.total} complete`;
  }
}

function populateRegionFilter(campaignData) {
  const regionFilter = document.getElementById('map-region-filter');
  if (!regionFilter) return;

  // In the two-level map, the region filter acts as a jump-to shortcut
  const regionOptions = (campaignData?.regions || []).map((region) => {
    return `<option value="${escapeHtml(region.id)}">${escapeHtml(region.label)}</option>`;
  }).join('');

  regionFilter.innerHTML = `
    <option value="all">All Regions</option>
    ${regionOptions}
  `;

  regionFilter.value = viewState.mode === 'region' ? viewState.activeRegionId : 'all';

  const emphasizeToggle = document.getElementById('map-emphasize-toggle');
  if (emphasizeToggle) {
    emphasizeToggle.checked = Boolean(viewState.emphasizeConnected);
  }
}

function bindMapControls() {
  const regionFilter = document.getElementById('map-region-filter');
  const emphasizeToggle = document.getElementById('map-emphasize-toggle');
  const backBtn = document.getElementById('map-back-btn');

  if (regionFilter && !regionFilter.dataset.bound) {
    regionFilter.dataset.bound = 'true';
    regionFilter.addEventListener('change', async (event) => {
      const value = event.target.value;
      if (value === 'all') {
        viewState.mode = 'overview';
        viewState.activeRegionId = null;
        viewState.selectedNodeId = null;
      } else {
        viewState.mode = 'region';
        viewState.activeRegionId = value;
        if (lastRenderContext) {
          const cd = await loadCampaignData();
          viewState.selectedNodeId = getPreferredNodeIdForRegion(cd, lastRenderContext.profile, value);
        }
      }
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  }

  if (emphasizeToggle && !emphasizeToggle.dataset.bound) {
    emphasizeToggle.dataset.bound = 'true';
    emphasizeToggle.addEventListener('change', async (event) => {
      viewState.emphasizeConnected = Boolean(event.target.checked);
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  }

  if (backBtn && !backBtn.dataset.bound) {
    backBtn.dataset.bound = 'true';
    backBtn.addEventListener('click', async () => {
      viewState.mode = 'overview';
      viewState.activeRegionId = null;
      viewState.selectedNodeId = null;
      const canvas = document.getElementById('map-canvas');
      if (canvas) {
        canvas.classList.remove('has-active-region');
        canvas.style.removeProperty('--region-wash-strong');
        canvas.style.removeProperty('--region-wash-mid');
        canvas.style.removeProperty('--region-wash-light');
      }
      if (lastRenderContext) {
        await renderCampaignMap(lastRenderContext);
      }
    });
  }
}

/* ── Node detail panel ─────────────────────────────────────────────── */

function summarizeRequirements(node, campaignData, profile, scenarioCatalog) {
  if (!node) return '';

  const state = computeNodeState(profile, node, { allowSandboxPractice: true });
  if (state.unlocked || state.completed) return 'Unlocked';

  if (state.practiceOnly) return 'Campaign locked · Sandbox practice available';

  const parts = [];
  const requiredAllTitles = (node.requiresAll || []).map((nodeId) => getNodeTitle(nodeId, campaignData, scenarioCatalog));
  const requiredAnyTitles = (node.requiresAny || []).map((nodeId) => getNodeTitle(nodeId, campaignData, scenarioCatalog));
  const requiredStars = Number(node.requiresMinStarsInRegion || 0);
  const regionLabel = getRegionById(campaignData, node.regionId)?.label || 'this region';

  if (requiredAllTitles.length > 0) {
    parts.push(`complete ${joinWithConjunction(requiredAllTitles, 'and')}`);
  }

  if (requiredAnyTitles.length > 0) {
    parts.push(`complete one of ${joinWithConjunction(requiredAnyTitles, 'or')}`);
  }

  if (requiredStars > 0) {
    parts.push(`${requiredStars} star${requiredStars === 1 ? '' : 's'} in ${regionLabel}`);
  }

  if (!parts.length) return 'Unlocked';

  return `Requires: ${parts.join(' · ')}`;
}

function summarizeNextUnlock(node, campaignData, profile, scenarioCatalog, state) {
  const graph = buildNodeGraph(campaignData);
  const childNodes = [...(graph.childrenById.get(node.id) || new Set())]
    .map((nodeId) => graph.nodeById.get(nodeId))
    .filter(Boolean);

  if (!childNodes.length) {
    return state.completed
      ? 'This node closes out the current branch.'
      : 'This node is a branch endpoint.';
  }

  const lockedChildren = childNodes.filter((childNode) => {
    return !isScenarioUnlocked(profile, childNode.scenarioId, campaignData);
  });
  const targetNodes = lockedChildren.length ? lockedChildren : childNodes;
  const targetTitle = getShortNodeLabel(
    getScenarioById(scenarioCatalog, targetNodes[0]?.scenarioId)?.title || targetNodes[0]?.id || ''
  );

  if (!targetTitle) return 'Choose a node to see details.';

  if (lockedChildren.length) {
    if (lockedChildren.length === 1) {
      return state.completed
        ? `Next unlock: ${targetTitle}`
        : `Clearing this node advances toward ${targetTitle}`;
    }
    return state.completed
      ? `Next unlocks: ${targetTitle} + ${lockedChildren.length - 1} more`
      : `Clearing this node advances ${lockedChildren.length} downstream nodes`;
  }

  if (childNodes.length === 1) return `Leads to: ${targetTitle}`;

  return `Leads to: ${targetTitle} + ${childNodes.length - 1} more`;
}

async function renderSelectedNode() {
  if (!lastRenderContext) return;

  const { campaignData, profile, scenarioCatalog, onPlay, onViewInLibrary } = lastRenderContext;

  // Only render detail panel in region view
  if (viewState.mode !== 'region' || !viewState.activeRegionId) {
    // Clear the detail panel in overview mode
    const titleEl = document.getElementById('map-selected-title');
    if (titleEl) titleEl.textContent = 'Select a region to explore';
    const metaEl = document.getElementById('map-selected-meta');
    if (metaEl) metaEl.textContent = '';
    const hintEl = document.getElementById('map-selected-hint');
    if (hintEl) hintEl.textContent = 'Click a region tile on the map to zoom in and see its scenarios.';
    const playBtn = document.getElementById('map-play-btn');
    if (playBtn) playBtn.disabled = true;
    return;
  }

  const defaultNodeId = getPreferredNodeIdForRegion(campaignData, profile, viewState.activeRegionId);
  const node = getNodeById(campaignData, viewState.selectedNodeId) || getNodeById(campaignData, defaultNodeId) || campaignData?.nodes?.[0];
  if (!node) return;

  viewState.selectedNodeId = node.id;

  const scenario = getScenarioById(scenarioCatalog, node.scenarioId);
  const progress = getScenarioProgress(profile, node.scenarioId);
  const state = computeNodeState(profile, node, { allowSandboxPractice: true });
  const mentor = await getMapMentorContent(profile, state.unlocked ? 'ready' : 'locked');
  const region = getRegionById(campaignData, node.regionId);

  const titleEl = document.getElementById('map-selected-title');
  const metaEl = document.getElementById('map-selected-meta');
  const statusEl = document.getElementById('map-selected-status');
  const rewardsEl = document.getElementById('map-selected-rewards');
  const hintEl = document.getElementById('map-selected-hint');
  const starsEl = document.getElementById('map-selected-stars');
  const playBtn = document.getElementById('map-play-btn');
  const libraryBtn = document.getElementById('map-view-library-btn');
  const practiceLabel = document.getElementById('map-practice-only-label');
  const requirementsEl = document.getElementById('map-selected-requirements');
  const regionEl = document.getElementById('map-selected-region');

  if (titleEl) titleEl.textContent = scenario?.title || node.id;
  if (metaEl) metaEl.textContent = `${scenario?.doctrineArea || 'Uncategorized'} · ${scenario?.branch || 'judiciary'} · ${scenario?.difficulty || 'medium'}`;
  if (statusEl) statusEl.textContent = state.statusLabel;
  if (rewardsEl) {
    rewardsEl.textContent = state.completed
      ? 'Rewards claimed · Replay for review or a higher star total.'
      : 'Rewards: XP + stars + unlock progress';
  }
  if (hintEl) hintEl.textContent = summarizeNextUnlock(node, campaignData, profile, scenarioCatalog, state);
  if (starsEl) starsEl.innerHTML = '★'.repeat(Number(progress.stars || 0)).padEnd(3, '☆');
  if (regionEl) {
    regionEl.textContent = region ? `Region: ${region.label}` : '';
  }
  if (requirementsEl) {
    requirementsEl.textContent = summarizeRequirements(node, campaignData, profile, scenarioCatalog);
  }
  if (practiceLabel) {
    practiceLabel.classList.toggle('hidden', !state.practiceOnly);
    practiceLabel.textContent = state.practiceOnly ? 'Practice Only' : '';
  }

  if (playBtn) {
    const canPlay = state.unlocked || state.practiceOnly;
    playBtn.disabled = !canPlay;
    playBtn.textContent = state.practiceOnly ? 'Practice Scenario' : 'Play';
    playBtn.onclick = () => {
      if (!canPlay) return;
      if (typeof onPlay === 'function') {
        onPlay(node, {
          practiceOnly: state.practiceOnly,
          source: 'campaign'
        });
      }
    };
  }

  if (libraryBtn) {
    libraryBtn.onclick = () => {
      if (typeof onViewInLibrary === 'function') {
        onViewInLibrary(node);
      }
    };
  }

  renderMentorPanel('map-mentor-panel', mentor);
}

/* ── Main render entry point ───────────────────────────────────────── */

export async function renderCampaignMap({ profile, scenarioCatalog = [], onPlay, onViewInLibrary } = {}) {
  const campaignData = await loadCampaignData();
  lastRenderContext = { campaignData, profile, scenarioCatalog, onPlay, onViewInLibrary };

  populateRegionFilter(campaignData);
  bindMapControls();
  renderLegend(campaignData, profile, scenarioCatalog);

  if (viewState.mode === 'overview') {
    renderOverview(campaignData, profile);
  } else if (viewState.mode === 'region' && viewState.activeRegionId) {
    renderRegionView(campaignData, profile, scenarioCatalog, viewState.activeRegionId, onPlay, onViewInLibrary);
  }

  await renderSelectedNode();
  return campaignData;
}

export const __testHooks = {
  getSelectedNodeId() {
    return viewState.selectedNodeId;
  },
  setSelectedNodeId(nodeId) {
    viewState.selectedNodeId = nodeId;
  },
  getViewState() {
    return { ...viewState };
  },
  setViewState(newState) {
    Object.assign(viewState, newState);
  },
  clear() {
    lastRenderContext = null;
    viewState = {
      mode: 'overview',
      activeRegionId: null,
      selectedNodeId: null,
      emphasizeConnected: true
    };
  }
};
