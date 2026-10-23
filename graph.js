/**
 * Graph Generator & Data Structure for Dijkstra's Algorithm
 * Generates 10 vertices (A through J) with exactly 20 random weighted edges.
 * Strictly guarantees that the graph is ALWAYS fully connected.
 */

class Graph {
  constructor() {
    this.vertices = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    this.edges = [];
    this.adj = new Map();
    this.positions = new Map();
    this.unitSize = 25;
  }

  /**
   * Generates a guaranteed connected graph with 10 vertices and 20 edges.
   * Uses spanning tree initiation first to ensure connectivity, then adds 11 random distinct edges.
   */
  generateRandomConnected(canvasWidth = 700, canvasHeight = 450) {
    this.width = canvasWidth;
    this.height = canvasHeight;
    this.bounds = { left: 40, right: canvasWidth - 40, top: 40, bottom: canvasHeight - 65 };
    this.edges = [];
    this.adj.clear();
    this.vertices.forEach(v => this.adj.set(v, []));

    // 1. Arrange 10 vertices around an elliptical layout with slight organic jitter
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const rx = Math.min(canvasWidth * 0.40, 280);
    const ry = Math.min(canvasHeight * 0.38, 175);
    const n = this.vertices.length;

    // Place A in a prominent left/start position
    this.vertices.forEach((v, i) => {
      const angle = Math.PI + (i * 2 * Math.PI / n);
      const jitterX = Math.sin(i * 3.7) * 18;
      const jitterY = Math.cos(i * 2.3) * 16;
      this.positions.set(v, this.clampPosition({
        x: Math.round(cx + rx * Math.cos(angle) + jitterX),
        y: Math.round(cy + ry * Math.sin(angle) + jitterY)
      }));
    });

    // 2. Guarantee Connectivity via a Random Spanning Tree (n - 1 = 9 edges)
    const connected = [this.vertices[0]];
    const unconnected = [...this.vertices.slice(1)];
    const edgeKeySet = new Set();

    while (unconnected.length > 0) {
      const u = connected[Math.floor(Math.random() * connected.length)];
      const vIndex = Math.floor(Math.random() * unconnected.length);
      const v = unconnected.splice(vIndex, 1)[0];
      connected.push(v);

      this.addEdge(u, v, 0);
      edgeKeySet.add(this.edgeKey(u, v));
    }

    // 3. Add remaining (20 - 9 = 11) distinct random edges
    const allPossiblePairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = this.vertices[i];
        const v = this.vertices[j];
        if (!edgeKeySet.has(this.edgeKey(u, v))) {
          allPossiblePairs.push([u, v]);
        }
      }
    }

    // Shuffle candidate pairs
    for (let i = allPossiblePairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPossiblePairs[i], allPossiblePairs[j]] = [allPossiblePairs[j], allPossiblePairs[i]];
    }

    const needed = 20 - this.edges.length;
    for (let k = 0; k < needed && k < allPossiblePairs.length; k++) {
      const [u, v] = allPossiblePairs[k];
      this.addEdge(u, v, 0);
      edgeKeySet.add(this.edgeKey(u, v));
    }

    this.syncDistanceWeights();
    return this;
  }

  clampPosition(position) {
    const b = this.bounds;
    return {
      x: Math.max(b.left, Math.min(b.right, position.x)),
      y: Math.max(b.top, Math.min(b.bottom, position.y))
    };
  }

  coordinates(vertex) {
    const p = this.positions.get(vertex);
    return { x: (p.x - this.bounds.left) / this.unitSize, y: (this.bounds.bottom - p.y) / this.unitSize };
  }

  syncDistanceWeights() {
    this.vertices.forEach(v => this.adj.set(v, []));
    this.edges.forEach(edge => {
      const a = this.positions.get(edge.u);
      const b = this.positions.get(edge.v);
      edge.weight = Number((Math.hypot(b.x - a.x, b.y - a.y) / this.unitSize).toFixed(2));
      this.adj.get(edge.u).push({ neighbor: edge.v, weight: edge.weight });
      this.adj.get(edge.v).push({ neighbor: edge.u, weight: edge.weight });
    });
  }

  get maxEdgeWeight() {
    const b = this.bounds;
    // Round down so the largest displayed value is also feasible.
    return Math.floor(Math.hypot(b.right - b.left, b.bottom - b.top) / this.unitSize * 100) / 100;
  }

  setEdgeDistance(edgeId, weight) {
    const edge = this.edges.find(item => item.id === edgeId);
    if (!edge || !Number.isFinite(weight) || weight < 0.01 || weight > this.maxEdgeWeight) {
      throw new RangeError(`Enter a distance from 0.01 to ${this.maxEdgeWeight}.`);
    }
    if (weight === edge.weight) return;

    const a = this.positions.get(edge.u);
    const b = this.positions.get(edge.v);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const length = weight * this.unitSize;
    const bounds = this.bounds;

    // For any direction, the optimal midpoint is the original midpoint projected
    // into the feasible rectangle. Minimize the sum of squared endpoint movement.
    const candidate = angle => {
      const dx = Math.cos(angle) * length / 2;
      const dy = Math.sin(angle) * length / 2;
      const left = bounds.left + Math.abs(dx);
      const right = bounds.right - Math.abs(dx);
      const top = bounds.top + Math.abs(dy);
      const bottom = bounds.bottom - Math.abs(dy);
      if (left > right + 1e-8 || top > bottom + 1e-8) return null;
      const x = Math.max(left, Math.min(right, mid.x));
      const y = Math.max(top, Math.min(bottom, mid.y));
      const nextA = { x: x - dx, y: y - dy };
      const nextB = { x: x + dx, y: y + dy };
      const cost = (nextA.x - a.x) ** 2 + (nextA.y - a.y) ** 2
        + (nextB.x - b.x) ** 2 + (nextB.y - b.y) ** 2;
      return { angle, nextA, nextB, cost };
    };
    let best = candidate(Math.atan2(b.y - a.y, b.x - a.x));
    const consider = angle => {
      const option = candidate(angle);
      if (option && (!best || option.cost < best.cost)) best = option;
    };
    for (let i = 0; i < 720; i++) consider(i * Math.PI / 360);
    // Include feasible interval boundaries even for almost-diagonal full lengths.
    const horizontalLimit = Math.acos(Math.min(1, (bounds.right - bounds.left) / length));
    const verticalLimit = Math.asin(Math.min(1, (bounds.bottom - bounds.top) / length));
    [horizontalLimit, verticalLimit].forEach(angle => {
      [angle, Math.PI - angle, Math.PI + angle, 2 * Math.PI - angle].forEach(consider);
    });
    let increment = Math.PI / 360;
    for (let i = 0; i < 36; i++) {
      const angle = best.angle;
      consider(angle - increment);
      consider(angle + increment);
      increment /= 2;
    }
    this.positions.set(edge.u, best.nextA);
    this.positions.set(edge.v, best.nextB);
    this.syncDistanceWeights();
  }

  edgeKey(u, v) {
    return u < v ? `${u}-${v}` : `${v}-${u}`;
  }

  addEdge(u, v, weight) {
    if (u === v || !this.adj.has(u) || !this.adj.has(v) || this.edges.some(edge => edge.key === this.edgeKey(u, v))) return null;
    const id = `edge_${this.edgeKey(u, v)}`;
    this.edges.push({ id, u, v, weight, key: this.edgeKey(u, v) });
    this.adj.get(u).push({ neighbor: v, weight });
    this.adj.get(v).push({ neighbor: u, weight });
    return id;
  }

  addVertex(position) {
    let index = 0;
    let label;
    do {
      let value = ++index;
      label = '';
      while (value > 0) {
        label = String.fromCharCode(65 + (value - 1) % 26) + label;
        value = Math.floor((value - 1) / 26);
      }
    } while (this.positions.has(label));
    this.vertices.push(label);
    this.positions.set(label, this.clampPosition(position));
    this.adj.set(label, []);
    return label;
  }

  connectVertices(u, v) {
    const id = this.addEdge(u, v, 0);
    if (id) this.syncDistanceWeights();
    return id;
  }

  removeEdge(id) {
    this.edges = this.edges.filter(edge => edge.id !== id);
    this.syncDistanceWeights();
  }

  removeVertex(vertex) {
    this.vertices = this.vertices.filter(v => v !== vertex);
    this.edges = this.edges.filter(edge => edge.u !== vertex && edge.v !== vertex);
    this.positions.delete(vertex);
    this.adj.delete(vertex);
    this.syncDistanceWeights();
  }

  getNeighbors(u) {
    return this.adj.get(u) || [];
  }
}
