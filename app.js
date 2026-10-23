/**
 * Main Application Controller for Dijkstra Visualizer
 * Connects Graph rendering, Dijkstra step execution, and synchronized 3-bar UI updates.
 */

// Application State
let graph = null;
let solver = null;
let steps = [];
let currentStepIndex = -1;
let isPlaying = false;
let playInterval = null;
let currentSpeedMs = 500;
let draggingNode = null;
let dragOffset = { x: 0, y: 0 };
let editingEdgeId = null;
let sourceVertex = 'A';
let activeTool = 'move';
let connectionStart = null;
let isPainting = false;
let lastPaintPoint = null;

// DOM Elements
const graphSvg = document.getElementById('graphSvg');
const canvasContainer = document.getElementById('canvasContainer');
const startBtn = document.getElementById('startBtn');
const stepBtn = document.getElementById('stepBtn');
const skipEndBtn = document.getElementById('skipEndBtn');
const resetBtn = document.getElementById('resetBtn');
const generateGraphBtn = document.getElementById('generateGraphBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const speedSlider = document.getElementById('speedSlider');
const speedVal = document.getElementById('speedVal');
const statusDot = document.getElementById('statusDot');
const statusMessage = document.getElementById('statusMessage');
const stepCounter = document.getElementById('stepCounter');
const visitedCounter = document.getElementById('visitedCounter');
const codeLines = document.querySelectorAll('.code-line');
const regU = document.getElementById('regU');
const regV = document.getElementById('regV');
const regW = document.getElementById('regW');
const regAlt = document.getElementById('regAlt');
const queueChips = document.getElementById('queueChips');
const queueCount = document.getElementById('queueCount');
const varTableBody = document.getElementById('varTableBody');
const edgeEditor = document.getElementById('edgeEditor');
const edgeWeightInput = document.getElementById('edgeWeightInput');
const edgeEditorError = document.getElementById('edgeEditorError');
const coordinateReadout = document.getElementById('coordinateReadout');

// Path Transition Loading Screen & Path Selection State
const pathTransitionOverlay = document.getElementById('pathTransitionOverlay');
let hasAutoShownSelectedPaths = false;
let isShowingSelectedPaths = false;
let selectedTargetNode = null;
let pathTransitionTimeout = null;

// Resizer Bars
const resizer1 = document.getElementById('resizer1');
const resizer2 = document.getElementById('resizer2');
const panelLeft = document.getElementById('panelLeft');
const panelRight = document.getElementById('panelRight');

/**
 * Initialize Application
 */
function initApp() {
  setupSplitters();
  setupEventListeners();
  createNewGraph();
}

/**
 * Creates and renders a new guaranteed connected 10-vertex 20-edge graph
 */
function createNewGraph() {
  closeEdgeEditor();
  coordinateReadout.textContent = 'Drag a vertex to see coordinates';
  stopPlayback();
  if (pathTransitionTimeout) {
    clearTimeout(pathTransitionTimeout);
    pathTransitionTimeout = null;
  }
  hasAutoShownSelectedPaths = false;
  isShowingSelectedPaths = false;
  selectedTargetNode = null;
  pathTransitionOverlay.style.display = 'none';
  graphSvg.classList.remove('isolated-mode');
  document.querySelectorAll('.in-isolated-path').forEach(el => {
    el.classList.remove('in-isolated-path');
  });
  document.querySelectorAll('.selected-target').forEach(el => {
    el.classList.remove('selected-target');
  });
  document.querySelectorAll('.selected-path-row').forEach(el => {
    el.classList.remove('selected-path-row');
  });

  graph = new Graph();
  graph.generateRandomConnected(700, 500);
  sourceVertex = 'A';
  connectionStart = null;
  updateGraphControls();

  solver = new DijkstraSolver(graph, sourceVertex);
  steps = solver.generateExecutionTrace();
  currentStepIndex = -1;

  renderGraphTopology();
  initVariableTable();
  resetRegisters();
  resetQueueDisplay();
  highlightCodeLine(null);

  setStatus('Ready with 10 vertices and 20 edges. Press "Find Shortest Paths" or "Step".', 'ready');
  stepCounter.textContent = '0';
  visitedCounter.textContent = `0 / ${graph.vertices.length}`;
}

/**
 * Setup draggable splitters for horizontal panels
 */
function setupSplitters() {
  let activeResizer = null;

  const onMouseDown = (e, resizer) => {
    activeResizer = resizer;
    resizer.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  resizer1.addEventListener('mousedown', (e) => onMouseDown(e, resizer1));
  resizer2.addEventListener('mousedown', (e) => onMouseDown(e, resizer2));

  window.addEventListener('mousemove', (e) => {
    if (!activeResizer) return;
    const containerRect = document.querySelector('.workbench-layout').getBoundingClientRect();
    const clientX = e.clientX;

    if (activeResizer === resizer1) {
      const maxLeftWidth = containerRect.width - panelRight.getBoundingClientRect().width - 350;
      const newLeftWidth = Math.max(200, Math.min(clientX - containerRect.left, maxLeftWidth));
      panelLeft.style.width = `${newLeftWidth}px`;
      panelLeft.style.flex = 'none';
    } else if (activeResizer === resizer2) {
      const maxRightWidth = containerRect.width - panelLeft.getBoundingClientRect().width - 350;
      const newRightWidth = Math.max(240, Math.min(containerRect.right - clientX, maxRightWidth));
      panelRight.style.width = `${newRightWidth}px`;
      panelRight.style.flex = 'none';
    }
  });

  window.addEventListener('mouseup', () => {
    if (activeResizer) {
      activeResizer.classList.remove('dragging');
      activeResizer = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      renderGraphTopology();
    }
  });
}

/**
 * Setup user controls & event listeners
 */
function setupEventListeners() {
  startBtn.addEventListener('click', togglePlay);
  stepBtn.addEventListener('click', () => {
    if (currentStepIndex === steps.length - 1) resetSolverState();
    stepForward();
  });
  skipEndBtn.addEventListener('click', jumpToFinish);
  resetBtn.addEventListener('click', resetSolverState);
  generateGraphBtn.addEventListener('click', createNewGraph);
  setupDrawingTools();
  document.getElementById('cancelEdgeEdit').addEventListener('click', closeEdgeEditor);
  edgeEditor.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEdgeEditor();
  });
  edgeWeightInput.addEventListener('input', () => { edgeEditorError.textContent = ''; });
  edgeEditor.addEventListener('submit', e => {
    e.preventDefault();
    try {
      const edge = graph.edges.find(item => item.id === editingEdgeId);
      const weight = Number(edgeWeightInput.value);
      graph.setEdgeDistance(editingEdgeId, weight);
      closeEdgeEditor();
      refreshAfterGraphEdit();
      renderGraphTopology();
      coordinateReadout.textContent = `${edge.u} ${formatCoordinates(edge.u)} · ${edge.v} ${formatCoordinates(edge.v)}`;
      setStatus(`Edge ${edge.u}–${edge.v}: ${formatNumber(edge.weight)} units. Connected weights and shortest paths updated.`, 'finished');
    } catch (error) {
      edgeEditorError.textContent = error.message;
    }
  });

  themeToggleBtn.addEventListener('click', () => {
    const root = document.documentElement;
    root.setAttribute('data-theme', root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  speedSlider.addEventListener('input', (e) => {
    currentSpeedMs = parseInt(e.target.value, 10);
    speedVal.textContent = `${currentSpeedMs}ms`;
    if (isPlaying) {
      clearInterval(playInterval);
      playInterval = setInterval(stepForward, currentSpeedMs);
    }
  });

  window.addEventListener('resize', () => {
    const width = document.querySelector('.workbench-layout').clientWidth;
    if (window.innerWidth > 1150 && panelLeft.offsetWidth + panelRight.offsetWidth > width - 350) {
      panelLeft.style.width = panelLeft.style.flex = '';
      panelRight.style.width = panelRight.style.flex = '';
    }
    renderGraphTopology();
  });

  canvasContainer.addEventListener('click', (e) => {
    if (activeTool !== 'move') return;
    // If user clicked the canvas background (not a node), reset to showing all paths
    if (e.target === canvasContainer || e.target === graphSvg || e.target.closest('#gridGroup') || (e.target && (e.target.id === 'edgesGroup' || e.target.id === 'labelsGroup'))) {
      if (isShowingSelectedPaths && selectedTargetNode) {
        showSelectedShortestPaths(null);
      }
    }
  });

  pathTransitionOverlay.addEventListener('click', () => {
    if (pathTransitionTimeout) {
      clearTimeout(pathTransitionTimeout);
      pathTransitionTimeout = null;
    }
    pathTransitionOverlay.style.display = 'none';
    showSelectedShortestPaths(selectedTargetNode);
  });
}

/**
 * Toggle auto-play / pause
 */
function togglePlay() {
  if (!steps.length) return;
  if (isPlaying) {
    stopPlayback();
  } else {
    if (currentStepIndex >= steps.length - 1) {
      resetSolverState();
    }
    startPlayback();
  }
}

function startPlayback() {
  isPlaying = true;
  startBtn.classList.add('btn-running');
  startBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
    <span>Pause</span>
  `;
  stepBtn.disabled = true;
  setStatus('Executing Dijkstra\'s algorithm step-by-step...', 'busy');

  playInterval = setInterval(() => {
    const hasMore = stepForward();
    if (!hasMore) {
      stopPlayback();
    }
  }, currentSpeedMs);
}

function stopPlayback() {
  isPlaying = false;
  if (playInterval) {
    clearInterval(playInterval);
    playInterval = null;
  }
  startBtn.classList.remove('btn-running');
  startBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
    <span>Find Shortest Paths</span>
  `;
  stepBtn.disabled = !graph || !graph.vertices.length;
  if (steps.length && currentStepIndex >= steps.length - 1) {
    setStatus(`Finished! Shortest paths computed from vertex ${sourceVertex}.`, 'finished');
    if (!hasAutoShownSelectedPaths) {
      hasAutoShownSelectedPaths = true;
      triggerPathTransition();
    } else {
      showSelectedShortestPaths(selectedTargetNode);
    }
  } else {
    setStatus('Paused. Click "Find Shortest Paths" or "Step" to resume.', 'ready');
  }
}

/**
 * Loading screen transition that reveals only the selected shortest paths
 */
function triggerPathTransition() {
  if (pathTransitionTimeout) {
    clearTimeout(pathTransitionTimeout);
  }
  pathTransitionOverlay.style.display = 'flex';
  pathTransitionTimeout = setTimeout(() => {
    pathTransitionTimeout = null;
    pathTransitionOverlay.style.display = 'none';
    showSelectedShortestPaths(selectedTargetNode);
  }, 900);
}

/**
 * Advance one step in Dijkstra's algorithm trace
 */
function stepForward() {
  if (!steps.length) return false;
  if (currentStepIndex + 1 < steps.length) {
    currentStepIndex++;
    applyState(steps[currentStepIndex]);
    if (currentStepIndex === steps.length - 1) {
      stopPlayback();
    }
    return true;
  } else {
    stopPlayback();
    return false;
  }
}

/**
 * Instantly jump to the final completed step and reveal the shortest paths
 */
function jumpToFinish() {
  if (!steps.length) return;
  stopPlayback();
  if (pathTransitionTimeout) {
    clearTimeout(pathTransitionTimeout);
    pathTransitionTimeout = null;
    pathTransitionOverlay.style.display = 'none';
  }
  currentStepIndex = steps.length - 1;
  applyState(steps[currentStepIndex]);
  setStatus(`Finished! Shortest paths computed from vertex ${sourceVertex}.`, 'finished');
  if (!hasAutoShownSelectedPaths) {
    hasAutoShownSelectedPaths = true;
    triggerPathTransition();
  } else {
    showSelectedShortestPaths(selectedTargetNode);
  }
}

/**
 * Reset execution state back to step 0
 */
function resetSolverState() {
  stopPlayback();
  if (pathTransitionTimeout) {
    clearTimeout(pathTransitionTimeout);
    pathTransitionTimeout = null;
  }
  currentStepIndex = -1;
  hasAutoShownSelectedPaths = false;
  isShowingSelectedPaths = false;
  selectedTargetNode = null;
  pathTransitionOverlay.style.display = 'none';
  graphSvg.classList.remove('isolated-mode');
  document.querySelectorAll('.in-isolated-path').forEach(el => {
    el.classList.remove('in-isolated-path');
  });
  document.querySelectorAll('.selected-target').forEach(el => {
    el.classList.remove('selected-target');
  });
  document.querySelectorAll('.selected-path-row').forEach(el => {
    el.classList.remove('selected-path-row');
  });
  resetRegisters();
  initVariableTable();
  resetQueueDisplay();
  highlightCodeLine(null);
  stepCounter.textContent = '0';
  visitedCounter.textContent = `0 / ${graph.vertices.length}`;
  setStatus('Reset complete. Press "Find Shortest Paths" or "Step".', 'ready');
  renderGraphTopology();
}

/**
 * Apply a snapshot step state to all 3 UI bars simultaneously
 */
function applyState(state) {
  // 1. LEFT BAR: Highlight active pseudocode line
  highlightCodeLine(state.line);

  // 2. RIGHT BAR: Scalar registers
  regU.textContent = state.u || '—';
  regV.textContent = state.v || '—';
  regW.textContent = state.w !== null ? state.w : '—';
  regAlt.textContent = state.alt !== null ? state.alt : '—';

  // Queue Display
  renderQueueChips(state.Q, state.dist, state.u);

  // Variable & Status Table
  updateVariableTable(state);

  // Status Ribbons & Counters
  stepCounter.textContent = `${currentStepIndex + 1} / ${steps.length}`;
  visitedCounter.textContent = `${state.visited.size} / ${graph.vertices.length}`;

  // 3. MIDDLE BAR: Graph SVG updates
  updateGraphVisuals(state);
}

/**
 * Highlight line in the pseudocode viewer
 */
function highlightCodeLine(lineNum) {
  codeLines.forEach(line => {
    const l = parseInt(line.dataset.line, 10);
    if (l === lineNum) {
      line.classList.add('active');
      if (line.dataset.line !== highlightCodeLine.previousLine) {
        line.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    } else {
      line.classList.remove('active');
    }
  });
  highlightCodeLine.previousLine = String(lineNum);
}

/**
 * Reset scalar registers
 */
function resetRegisters() {
  regU.textContent = '—';
  regV.textContent = '—';
  regW.textContent = '—';
  regAlt.textContent = '—';
}

/**
 * Initialize variable table
 */
function initVariableTable() {
  varTableBody.innerHTML = '';
  graph.vertices.forEach(v => {
    const tr = document.createElement('tr');
    tr.id = `row_${v}`;
    tr.title = `Click to highlight shortest path from vertex ${sourceVertex} to ${v}`;
    tr.innerHTML = `
      <td><strong>${v}</strong></td>
      <td class="col-dist">${v === sourceVertex ? '0' : '∞'}</td>
      <td class="col-prev">—</td>
      <td class="col-status"><span class="badge-status badge-unvisited">In Queue</span></td>
    `;
    tr.addEventListener('click', () => onVertexClicked(v));
    varTableBody.appendChild(tr);
  });
}

/**
 * Update variable table based on step state
 */
function updateVariableTable(state) {
  graph.vertices.forEach(v => {
    const row = document.getElementById(`row_${v}`);
    if (!row) return;

    const distVal = state.dist[v];
    const prevVal = state.prev[v];
    const isVisited = state.visited.has(v);
    const isCurrent = state.u === v;
    const isNeighbor = state.v === v;

    row.className = '';
    if (isCurrent) row.classList.add('active-row');
    else if (isNeighbor) row.classList.add('neighbor-row');
    else if (isVisited) row.classList.add('settled-row');

    row.querySelector('.col-dist').textContent = distVal === undefined ? (v === sourceVertex ? '0' : '∞') : formatNumber(distVal);
    row.querySelector('.col-prev').textContent = prevVal || '—';

    const colStatus = row.querySelector('.col-status');
    if (state.line === 13 && distVal === Infinity) {
      colStatus.innerHTML = '<span class="badge-status badge-unvisited">Unreachable</span>';
    } else if (isCurrent) {
      colStatus.innerHTML = '<span class="badge-status badge-current">Active (u)</span>';
    } else if (isNeighbor) {
      colStatus.innerHTML = '<span class="badge-status badge-evaluating">Neighbor (v)</span>';
    } else if (isVisited) {
      colStatus.innerHTML = v === sourceVertex
        ? '<span class="badge-status badge-source">Source (Settled)</span>'
        : '<span class="badge-status badge-settled">Settled</span>';
    } else {
      colStatus.innerHTML = v === sourceVertex
        ? '<span class="badge-status badge-source">Source</span>'
        : '<span class="badge-status badge-unvisited">In Queue</span>';
    }
  });
}

/**
 * Render priority queue Q chips
 */
function resetQueueDisplay() {
  queueChips.innerHTML = '';
  graph.vertices.forEach(v => {
    const chip = document.createElement('span');
    chip.className = 'q-chip';
    chip.innerHTML = `${v} <span class="q-dist">${v === sourceVertex ? '0' : '∞'}</span>`;
    queueChips.appendChild(chip);
  });
  queueCount.textContent = `${graph.vertices.length} items remaining`;
}

function renderQueueChips(QSet, distMap, currentMinU) {
  queueChips.innerHTML = '';
  const arr = Array.from(QSet);
  queueCount.textContent = `${arr.length} item${arr.length === 1 ? '' : 's'} remaining`;

  arr.sort((a, b) => (distMap[a] ?? Infinity) - (distMap[b] ?? Infinity));

  arr.forEach(node => {
    const chip = document.createElement('span');
    chip.className = 'q-chip';
    if (node === currentMinU) {
      chip.classList.add('min-candidate');
    }
    const d = distMap[node];
    chip.innerHTML = `${node} <span class="q-dist">${d === Infinity ? '∞' : d}</span>`;
    queueChips.appendChild(chip);
  });
}

/**
 * Status ribbon helper
 */
function setStatus(msg, type = 'ready') {
  statusMessage.textContent = msg;
  statusDot.className = 'status-indicator';
  if (type === 'busy') statusDot.classList.add('busy');
  else if (type === 'finished') statusDot.classList.add('finished');
}

/**
 * SVG Graph Topology Rendering
 */
function renderGraphTopology() {
  if (!graph) return;
  graphSvg.innerHTML = '';
  graphSvg.setAttribute('viewBox', `0 0 ${graph.width} ${graph.height}`);
  renderCoordinateGrid();

  const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  edgesGroup.id = 'edgesGroup';
  const labelsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelsGroup.id = 'labelsGroup';
  const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  nodesGroup.id = 'nodesGroup';

  // Mount in strict SVG stacking order: edges at back, weight labels in front of edges, nodes on top
  graphSvg.appendChild(edgesGroup);
  graphSvg.appendChild(labelsGroup);
  graphSvg.appendChild(nodesGroup);

  // Draw Edges
  graph.edges.forEach(edge => {
    const p1 = graph.positions.get(edge.u);
    const p2 = graph.positions.get(edge.v);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.id = `svg_${edge.id}`;
    line.setAttribute('x1', p1.x);
    line.setAttribute('y1', p1.y);
    line.setAttribute('x2', p2.x);
    line.setAttribute('y2', p2.y);
    line.className.baseVal = 'graph-edge';
    edgesGroup.appendChild(line);
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    hit.id = `hit_${edge.id}`;
    ['x1', 'y1', 'x2', 'y2'].forEach(attr => hit.setAttribute(attr, line.getAttribute(attr)));
    hit.setAttribute('class', 'edge-hit');
    hit.dataset.edgeId = edge.id;
    hit.addEventListener('click', e => {
      e.stopPropagation();
      if (activeTool === 'erase') eraseGraphItem({ edgeId: edge.id });
      else if (activeTool === 'move') openEdgeEditor(edge);
    });
    edgesGroup.appendChild(hit);

    // Edge Weight Badge
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const labelG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    labelG.id = `label_${edge.id}`;
    labelG.className.baseVal = 'edge-label-group';
    labelG.dataset.edgeId = edge.id;
    labelG.setAttribute('role', 'button');
    labelG.setAttribute('tabindex', '0');
    labelG.setAttribute('aria-label', `Edit distance ${edge.u} to ${edge.v}: ${formatNumber(edge.weight)} units`);
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${edge.u}–${edge.v}: ${formatNumber(edge.weight)} units. Click to edit.`;
    labelG.appendChild(title);
    labelG.addEventListener('click', e => {
      e.stopPropagation();
      if (activeTool === 'erase') eraseGraphItem({ edgeId: edge.id });
      else if (activeTool === 'move') openEdgeEditor(edge);
    });
    labelG.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeTool === 'erase') eraseGraphItem({ edgeId: edge.id });
        else if (activeTool === 'move') openEdgeEditor(edge);
      }
    });

    const rectEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const badgeWidth = Math.max(32, formatNumber(edge.weight).length * 7 + 12);
    rectEl.setAttribute('x', midX - badgeWidth / 2);
    rectEl.setAttribute('y', midY - 10);
    rectEl.setAttribute('width', badgeWidth);
    rectEl.setAttribute('height', 20);

    const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', midX);
    textEl.setAttribute('y', midY);
    textEl.textContent = formatNumber(edge.weight);

    labelG.appendChild(rectEl);
    labelG.appendChild(textEl);
    labelsGroup.appendChild(labelG);
  });

  // Draw Nodes
  graph.vertices.forEach(v => {
    const pos = graph.positions.get(v);

    const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeG.id = `node_${v}`;
    nodeG.dataset.vertex = v;
    nodeG.className.baseVal = 'graph-node';
    nodeG.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', 20);
    circle.className.baseVal = 'node-circle';

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('y', 0);
    text.className.baseVal = 'node-text';
    text.textContent = v;

    const distBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    distBadge.setAttribute('y', 33);
    distBadge.className.baseVal = 'node-dist-badge';
    distBadge.textContent = v === sourceVertex ? 'd: 0' : 'd: ∞';

    nodeG.appendChild(circle);
    nodeG.appendChild(text);
    nodeG.appendChild(distBadge);
    const coords = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    coords.setAttribute('y', -29);
    coords.classList.add('node-coordinates');
    coords.textContent = formatCoordinates(v);
    nodeG.appendChild(coords);
    if (v === sourceVertex) nodeG.classList.add('state-source');
    if (v === connectionStart) nodeG.classList.add('connection-start');
    nodesGroup.appendChild(nodeG);

    nodeG.addEventListener('pointerdown', (e) => {
      if (activeTool !== 'move') return;
      startNodeDrag(e, v);
    });
    nodeG.setAttribute('tabindex', '0');
    nodeG.setAttribute('role', 'button');
    nodeG.setAttribute('aria-label', `Vertex ${v}`);
    nodeG.addEventListener('click', e => {
      e.stopPropagation();
      if (activeTool === 'connect') connectVertex(v);
    });
    nodeG.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (activeTool === 'connect') connectVertex(v);
        else if (activeTool === 'erase') eraseGraphItem({ vertex: v });
        else if (activeTool === 'move') onVertexClicked(v);
      }
    });
  });

  if (currentStepIndex >= 0 && currentStepIndex < steps.length) {
    updateGraphVisuals(steps[currentStepIndex]);
  }

  // Preserve shortest paths highlighting across re-renders (splitter drags, window resize)
  if (isShowingSelectedPaths) {
    showSelectedShortestPaths(selectedTargetNode);
  }
  markConnectionStart();
}

/**
 * Updates graph SVG elements according to active step
 */
function updateGraphVisuals(state) {
  graph.edges.forEach(edge => {
    const line = document.getElementById(`svg_${edge.id}`);
    const label = document.getElementById(`label_${edge.id}`);
    if (!line) return;

    line.className.baseVal = 'graph-edge';
    if (label) label.className.baseVal = 'edge-label-group';

    if (state.sptEdges && state.sptEdges.has(edge.key)) {
      line.classList.add('edge-spt');
    }

    const isEvaluating = (state.u === edge.u && state.v === edge.v) ||
                         (state.u === edge.v && state.v === edge.u);
    if (isEvaluating) {
      line.classList.add('edge-active');
      if (label) label.classList.add('active');
    }
  });

  graph.vertices.forEach(v => {
    const nodeG = document.getElementById(`node_${v}`);
    if (!nodeG) return;

    nodeG.className.baseVal = 'graph-node';

    if (v === sourceVertex) {
      nodeG.classList.add('state-source');
    }

    if (state.visited.has(v)) {
      nodeG.classList.add('state-visited');
    }

    if (state.u === v) {
      nodeG.classList.remove('state-visited');
      nodeG.classList.add('state-current');
    } else if (state.v === v) {
      nodeG.classList.add('state-evaluating');
    }

    const badge = nodeG.querySelector('.node-dist-badge');
    if (badge) {
      const d = state.dist[v];
      badge.textContent = `d: ${d === undefined ? (v === sourceVertex ? '0' : '∞') : formatNumber(d)}`;
    }
  });
}

/**
 * Node Draggable Logic for rearranging graph & click-to-highlight path
 */
let dragStartClient = { x: 0, y: 0 };
let nodeDidDrag = false;

function startNodeDrag(e, vertex) {
  if (e.button !== 0 || draggingNode) return;
  e.preventDefault();
  e.stopPropagation();
  closeEdgeEditor();
  draggingNode = vertex;
  nodeDidDrag = false;
  dragStartClient = { x: e.clientX, y: e.clientY };
  const pos = graph.positions.get(vertex);
  const pt = getSvgPoint(e);
  dragOffset = { x: pt.x - pos.x, y: pt.y - pos.y };

  e.currentTarget.setPointerCapture(e.pointerId);
  window.addEventListener('pointermove', onNodeDrag);
  window.addEventListener('pointerup', endNodeDrag);
  window.addEventListener('pointercancel', endNodeDrag);
}

function onNodeDrag(e) {
  if (!draggingNode) return;
  if (Math.hypot(e.clientX - dragStartClient.x, e.clientY - dragStartClient.y) > 4) {
    nodeDidDrag = true;
  }
  if (!nodeDidDrag) return;
  const pt = getSvgPoint(e);
  const position = graph.clampPosition({ x: pt.x - dragOffset.x, y: pt.y - dragOffset.y });
  const newX = position.x;
  const newY = position.y;

  graph.positions.set(draggingNode, { x: newX, y: newY });

  const nodeG = document.getElementById(`node_${draggingNode}`);
  if (nodeG) {
    nodeG.setAttribute('transform', `translate(${newX}, ${newY})`);
    nodeG.querySelector('.node-coordinates').textContent = formatCoordinates(draggingNode);
  }
  graph.syncDistanceWeights();
  refreshAfterGraphEdit();
  coordinateReadout.textContent = `${draggingNode} ${formatCoordinates(draggingNode)}`;

  graph.edges.forEach(edge => {
    if (edge.u === draggingNode || edge.v === draggingNode) {
      const p1 = graph.positions.get(edge.u);
      const p2 = graph.positions.get(edge.v);

      const line = document.getElementById(`svg_${edge.id}`);
      if (line) {
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', p2.x);
        line.setAttribute('y2', p2.y);
        const hit = document.getElementById(`hit_${edge.id}`);
        ['x1', 'y1', 'x2', 'y2'].forEach(attr => hit.setAttribute(attr, line.getAttribute(attr)));
      }

      const label = document.getElementById(`label_${edge.id}`);
      if (label) {
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const rect = label.querySelector('rect');
        const text = label.querySelector('text');
        const badgeWidth = Math.max(32, formatNumber(edge.weight).length * 7 + 12);
        rect.setAttribute('x', midX - badgeWidth / 2);
        rect.setAttribute('y', midY - 10);
        rect.setAttribute('width', badgeWidth);
        rect.setAttribute('height', 20);
        text.setAttribute('x', midX);
        text.setAttribute('y', midY);
        text.textContent = formatNumber(edge.weight);
        label.setAttribute('aria-label', `Edit distance ${edge.u} to ${edge.v}: ${formatNumber(edge.weight)} units`);
        label.querySelector('title').textContent = `${edge.u}–${edge.v}: ${formatNumber(edge.weight)} units. Click to edit.`;
      }
    }
  });
}

function endNodeDrag(e) {
  const releasedVertex = draggingNode;
  const wasClick = !nodeDidDrag;
  draggingNode = null;
  window.removeEventListener('pointermove', onNodeDrag);
  window.removeEventListener('pointerup', endNodeDrag);
  window.removeEventListener('pointercancel', endNodeDrag);

  if (wasClick && releasedVertex) {
    onVertexClicked(releasedVertex);
  }
}

function onVertexClicked(vertex) {
  // Allow toggling shortest path to this vertex once algorithm is complete
  if (steps.length && currentStepIndex >= steps.length - 1) {
    if (selectedTargetNode === vertex) {
      showSelectedShortestPaths(null);
    } else {
      showSelectedShortestPaths(vertex);
    }
  }
}

function getSvgPoint(e) {
  const pt = graphSvg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  return pt.matrixTransform(graphSvg.getScreenCTM().inverse());
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : '∞';
}

function formatCoordinates(vertex) {
  const p = graph.coordinates(vertex);
  return `(${formatNumber(p.x)}, ${formatNumber(p.y)})`;
}

function closeEdgeEditor() {
  edgeEditor.hidden = true;
  editingEdgeId = null;
  edgeEditorError.textContent = '';
}

function openEdgeEditor(edge) {
  stopPlayback();
  // Avoid the completion overlay covering the edge being edited.
  clearTimeout(pathTransitionTimeout);
  pathTransitionTimeout = null;
  pathTransitionOverlay.style.display = 'none';
  editingEdgeId = edge.id;
  document.getElementById('edgeEditorLabel').textContent = `Distance ${edge.u}–${edge.v} (units)`;
  edgeWeightInput.max = graph.maxEdgeWeight;
  edgeWeightInput.value = edge.weight;
  edgeEditorError.textContent = '';
  edgeEditor.hidden = false;
  edgeWeightInput.focus();
  edgeWeightInput.select();
}

function refreshAfterGraphEdit() {
  const target = graph.vertices.includes(selectedTargetNode) ? selectedTargetNode : null;
  if (isPlaying) stopPlayback();
  clearTimeout(pathTransitionTimeout);
  pathTransitionTimeout = null;
  pathTransitionOverlay.style.display = 'none';
  solver = new DijkstraSolver(graph, sourceVertex);
  steps = solver.generateExecutionTrace();
  if (!steps.length) {
    currentStepIndex = -1;
    isShowingSelectedPaths = false;
    selectedTargetNode = null;
    graphSvg.classList.remove('isolated-mode');
    resetRegisters();
    resetQueueDisplay();
    highlightCodeLine(null);
    stepCounter.textContent = '0';
    visitedCounter.textContent = '0 / 0';
    setStatus('Graph is empty. Use Vertex paint to add vertices.', 'ready');
    return;
  }
  currentStepIndex = steps.length - 1;
  hasAutoShownSelectedPaths = true;
  applyState(steps[currentStepIndex]);
  showSelectedShortestPaths(target);
}

function renderCoordinateGrid() {
  const ns = 'http://www.w3.org/2000/svg';
  const grid = document.createElementNS(ns, 'g');
  grid.id = 'gridGroup';
  grid.setAttribute('aria-hidden', 'true');
  const b = graph.bounds;
  const addLine = (x1, y1, x2, y2, axis = false) => {
    const line = document.createElementNS(ns, 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([key, value]) => line.setAttribute(key, value));
    line.setAttribute('class', axis ? 'grid-axis' : 'grid-line');
    grid.appendChild(line);
  };
  const addText = (x, y, value, anchor = 'middle') => {
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', x);
    label.setAttribute('y', y);
    label.setAttribute('text-anchor', anchor);
    label.textContent = value;
    grid.appendChild(label);
  };
  for (let x = b.left, i = 0; x <= b.right; x += graph.unitSize, i++) {
    addLine(x, b.top, x, b.bottom, i === 0);
    if (i % 2 === 0) addText(x, b.bottom + 20, i);
  }
  for (let y = b.bottom, i = 0; y >= b.top; y -= graph.unitSize, i++) {
    addLine(b.left, y, b.right, y, i === 0);
    if (i > 0 && i % 2 === 0) addText(b.left - 10, y + 4, i, 'end');
  }
  addText(b.right + 15, b.bottom + 4, 'x');
  addText(b.left, b.top - 15, 'y');
  graphSvg.appendChild(grid);
}

function updateGraphControls() {
  if (!graph.vertices.includes(sourceVertex)) sourceVertex = graph.vertices[0] || null;
  const sourceSelect = document.getElementById('sourceSelect');
  sourceSelect.replaceChildren(...graph.vertices.map(v => new Option(v, v)));
  sourceSelect.value = sourceVertex || '';
  sourceSelect.disabled = !graph.vertices.length;
  document.getElementById('vertexCount').textContent = graph.vertices.length;
  document.getElementById('edgeCount').textContent = graph.edges.length;
  document.getElementById('emptyGraphHint').hidden = graph.vertices.length > 0;
  startBtn.disabled = skipEndBtn.disabled = stepBtn.disabled = !graph.vertices.length;
  startBtn.title = `Find shortest paths from vertex ${sourceVertex || '—'}`;
  document.querySelector('.code-line[data-line="1"] .val').textContent = `'${sourceVertex || '—'}'`;
}

function commitTopologyEdit() {
  closeEdgeEditor();
  updateGraphControls();
  initVariableTable();
  refreshAfterGraphEdit();
  renderGraphTopology();
}

function setGraphTool(tool) {
  if (isPlaying) stopPlayback();
  clearTimeout(pathTransitionTimeout);
  pathTransitionTimeout = null;
  pathTransitionOverlay.style.display = 'none';
  closeEdgeEditor();
  activeTool = tool;
  connectionStart = null;
  graphSvg.dataset.tool = tool;
  document.querySelectorAll('[data-tool].tool-btn').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  });
  const hints = {
    move: 'Drag vertices to move them. Click an edge weight to edit its distance.',
    vertex: 'Click the grid to add a vertex, or drag to paint several. Leave space between vertices.',
    connect: 'Click a starting vertex, then another vertex to connect them. Escape cancels.',
    erase: 'Click or drag across vertices and edges to erase them. Erasing a vertex removes its edges.'
  };
  document.getElementById('toolHint').textContent = hints[tool];
  markConnectionStart();
}

function markConnectionStart() {
  document.querySelectorAll('.connection-start').forEach(node => node.classList.remove('connection-start'));
  if (connectionStart) document.getElementById(`node_${connectionStart}`)?.classList.add('connection-start');
  document.getElementById('connectionPreview')?.remove();
}

function connectVertex(vertex) {
  if (!connectionStart) {
    connectionStart = vertex;
    markConnectionStart();
    document.getElementById('toolHint').textContent = `Connect ${vertex} to: click another vertex. Escape cancels.`;
    return;
  }
  if (vertex === connectionStart) {
    connectionStart = null;
    markConnectionStart();
    document.getElementById('toolHint').textContent = 'Connection cancelled. Click a starting vertex.';
    return;
  }
  const from = connectionStart;
  connectionStart = null;
  if (graph.connectVertices(from, vertex)) {
    commitTopologyEdit();
    document.getElementById('toolHint').textContent = `Connected ${from}–${vertex}. Click a starting vertex for another edge.`;
  } else {
    markConnectionStart();
    document.getElementById('toolHint').textContent = `${from}–${vertex} already exists. Click a starting vertex.`;
  }
}

function eraseGraphItem({ vertex, edgeId }) {
  if (vertex && graph.positions.has(vertex)) {
    graph.removeVertex(vertex);
    if (connectionStart === vertex) connectionStart = null;
  } else if (edgeId && graph.edges.some(edge => edge.id === edgeId)) {
    graph.removeEdge(edgeId);
  } else return;
  commitTopologyEdit();
}

function paintVertex(point) {
  const b = graph.bounds;
  if (point.x < b.left || point.x > b.right || point.y < b.top || point.y > b.bottom) return;
  if (lastPaintPoint && Math.hypot(point.x - lastPaintPoint.x, point.y - lastPaintPoint.y) < 65) return;
  if ([...graph.positions.values()].some(p => Math.hypot(point.x - p.x, point.y - p.y) < 55)) return;
  const vertex = graph.addVertex(point);
  lastPaintPoint = { x: point.x, y: point.y };
  commitTopologyEdit();
  coordinateReadout.textContent = `${vertex} ${formatCoordinates(vertex)}`;
}

function setupDrawingTools() {
  document.querySelectorAll('.tool-btn').forEach(button => {
    button.addEventListener('click', () => setGraphTool(button.dataset.tool));
  });
  document.getElementById('sourceSelect').addEventListener('change', e => {
    sourceVertex = e.target.value;
    commitTopologyEdit();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && edgeEditor.hidden) setGraphTool('move');
  });
  graphSvg.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !['vertex', 'erase'].includes(activeTool)) return;
    e.preventDefault();
    isPainting = true;
    lastPaintPoint = null;
    graphSvg.setPointerCapture(e.pointerId);
    if (activeTool === 'vertex') paintVertex(getSvgPoint(e));
    else eraseGraphItem(e.target.closest('[data-vertex], [data-edge-id]')?.dataset || {});
  });
  graphSvg.addEventListener('pointermove', e => {
    const point = getSvgPoint(e);
    if (isPainting) {
      if (activeTool === 'vertex') paintVertex(point);
      else if (activeTool === 'erase') {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-vertex], [data-edge-id]');
        if (hit && graphSvg.contains(hit)) eraseGraphItem(hit.dataset);
      }
    } else if (activeTool === 'connect' && connectionStart) {
      let line = document.getElementById('connectionPreview');
      if (!line) {
        line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.id = 'connectionPreview';
        graphSvg.appendChild(line);
      }
      const start = graph.positions.get(connectionStart);
      Object.entries({ x1: start.x, y1: start.y, x2: point.x, y2: point.y }).forEach(([key, value]) => line.setAttribute(key, value));
    }
  });
  const stopPainting = () => { isPainting = false; lastPaintPoint = null; };
  graphSvg.addEventListener('pointerup', stopPainting);
  graphSvg.addEventListener('pointercancel', stopPainting);
  setGraphTool('move');
}

/**
 * Displays only the selected shortest paths on the graph (non-path edges dimmed out).
 * If targetNode is specified, highlights the unique shortest path from A to targetNode.
 * Otherwise, highlights the entire Shortest Path Tree.
 */
function showSelectedShortestPaths(targetNode = null) {
  const finalState = steps[steps.length - 1];
  if (!finalState) return;

  isShowingSelectedPaths = true;
  selectedTargetNode = targetNode;

  // Apply isolated mode styling to SVG elements (dims all non-path edges)
  graphSvg.classList.add('isolated-mode');

  // Clear previous isolated path marks and target selections
  document.querySelectorAll('.in-isolated-path').forEach(el => {
    el.classList.remove('in-isolated-path');
  });
  document.querySelectorAll('.selected-target').forEach(el => {
    el.classList.remove('selected-target');
  });
  document.querySelectorAll('.selected-path-row').forEach(el => {
    el.classList.remove('selected-path-row');
  });

  if (targetNode && targetNode !== sourceVertex) {
    if (finalState.dist[targetNode] === Infinity) {
      document.getElementById(`node_${targetNode}`)?.classList.add('in-isolated-path', 'selected-target');
      document.getElementById(`row_${targetNode}`)?.classList.add('selected-path-row');
      setStatus(`${targetNode} is unreachable from ${sourceVertex}. Use Connect edges to join its component.`, 'ready');
      return;
    }
    // Reconstruct the selected path using the current source and predecessor map.
    const pathNodes = new Set();
    const pathEdges = new Set();
    let curr = targetNode;
    pathNodes.add(curr);

    const pathSequence = [curr];
    while (curr && finalState.prev[curr]) {
      const p = finalState.prev[curr];
      pathEdges.add(graph.edgeKey(p, curr));
      curr = p;
      pathNodes.add(curr);
      pathSequence.unshift(curr);
    }

    // Highlight the source and nodes along the path.
    pathNodes.forEach(v => {
      const nodeEl = document.getElementById(`node_${v}`);
      if (nodeEl) {
        nodeEl.classList.add('in-isolated-path');
        if (v === targetNode) {
          nodeEl.classList.add('selected-target');
        }
      }
    });

    // Highlight only the edges belonging to this specific shortest path
    graph.edges.forEach(edge => {
      if (pathEdges.has(edge.key)) {
        const lineEl = document.getElementById(`svg_${edge.id}`);
        const labelEl = document.getElementById(`label_${edge.id}`);
        if (lineEl) lineEl.classList.add('in-isolated-path');
        if (labelEl) labelEl.classList.add('in-isolated-path');
      }
    });

    // Highlight corresponding table row
    const rowEl = document.getElementById(`row_${targetNode}`);
    if (rowEl) rowEl.classList.add('selected-path-row');

    const totalDistance = finalState.dist[targetNode];
    setStatus(`Selected shortest path to ${targetNode}: ${pathSequence.join(' → ')} (Distance: ${totalDistance === Infinity ? '∞' : totalDistance}). Click again to show all paths.`, 'finished');
  } else {
    // Keep all vertices clearly visible
    graph.vertices.forEach(v => {
      const nodeEl = document.getElementById(`node_${v}`);
      if (nodeEl) nodeEl.classList.add('in-isolated-path');
    });

    // Highlight only the edges belonging to the shortest path tree
    graph.edges.forEach(edge => {
      if (finalState.sptEdges && finalState.sptEdges.has(edge.key)) {
        const lineEl = document.getElementById(`svg_${edge.id}`);
        const labelEl = document.getElementById(`label_${edge.id}`);
        if (lineEl) lineEl.classList.add('in-isolated-path');
        if (labelEl) labelEl.classList.add('in-isolated-path');
      }
    });

    const unreachable = graph.vertices.filter(v => finalState.dist[v] === Infinity).length;
    setStatus(`Shortest paths from ${sourceVertex} updated.${unreachable ? ` ${unreachable} unreachable vertices.` : ''} Click a vertex to show its path.`, 'finished');
  }
}

// Kick off when DOM is ready
window.addEventListener('DOMContentLoaded', initApp);
