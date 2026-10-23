const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { join } = require('node:path');

const source = ['graph.js', 'dijkstra.js'].map(file => readFileSync(join(__dirname, '..', file), 'utf8')).join('\n');
const { Graph, DijkstraSolver } = runInNewContext(`${source}\n;({ Graph, DijkstraSolver });`);
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const copyPositions = graph => new Map([...graph.positions].map(([v, p]) => [v, { ...p }]));

function verifyWeights(graph) {
  for (const edge of graph.edges) {
    const a = graph.positions.get(edge.u);
    const b = graph.positions.get(edge.v);
    const expected = Number((Math.hypot(a.x - b.x, a.y - b.y) / graph.unitSize).toFixed(2));
    assert.equal(edge.weight, expected);
    assert.equal(graph.getNeighbors(edge.u).find(item => item.neighbor === edge.v).weight, expected);
    assert.equal(graph.getNeighbors(edge.v).find(item => item.neighbor === edge.u).weight, expected);
  }
}

test('generated graphs stay connected with geometric weights and Cartesian coordinates', () => {
  const graph = new Graph().generateRandomConnected(700, 500);
  assert.equal(graph.edges.length, 20);
  assert.equal(new Set(graph.edges.map(edge => edge.key)).size, 20);
  verifyWeights(graph);
  graph.positions.set('A', { x: graph.bounds.left, y: graph.bounds.bottom });
  near(graph.coordinates('A').x, 0);
  near(graph.coordinates('A').y, 0);
  graph.syncDistanceWeights();
  const final = new DijkstraSolver(graph).generateExecutionTrace().at(-1);
  assert.equal(final.visited.size, 10);
  assert.ok(Object.values(final.dist).every(Number.isFinite));
});

test('distance editing shares movement equally and leaves unrelated vertices and edges unchanged', () => {
  const graph = new Graph().generateRandomConnected(700, 500);
  const edge = graph.edges[0];
  graph.positions.set(edge.u, { x: 200, y: 200 });
  graph.positions.set(edge.v, { x: 400, y: 200 });
  graph.syncDistanceWeights();
  const before = copyPositions(graph);
  const weights = new Map(graph.edges.map(item => [item.id, item.weight]));
  graph.setEdgeDistance(edge.id, 6);
  near(graph.positions.get(edge.u).x, 225);
  near(graph.positions.get(edge.v).x, 375);
  near(graph.positions.get(edge.u).y, 200);
  near(graph.positions.get(edge.v).y, 200);
  for (const v of graph.vertices) {
    if (v !== edge.u && v !== edge.v) {
      near(graph.positions.get(v).x, before.get(v).x);
      near(graph.positions.get(v).y, before.get(v).y);
    }
  }
  for (const item of graph.edges) {
    if (![item.u, item.v].some(v => v === edge.u || v === edge.v)) assert.equal(item.weight, weights.get(item.id));
  }
  assert.equal(edge.weight, 6);
  verifyWeights(graph);
});

test('large, small and repeated edits remain in bounds with exact requested distances', () => {
  for (const [width, height] of [[600, 450], [700, 500], [1100, 450], [600, 900]]) {
    const graph = new Graph().generateRandomConnected(width, height);
    const requests = [0.01, graph.maxEdgeWeight, 1, Number((graph.maxEdgeWeight - 0.01).toFixed(2)), 7.23];
    for (const weight of requests) {
      for (const edge of graph.edges) {
        graph.setEdgeDistance(edge.id, weight);
        assert.equal(edge.weight, weight);
        for (const p of graph.positions.values()) {
          assert.ok(p.x >= graph.bounds.left - 1e-6 && p.x <= graph.bounds.right + 1e-6);
          assert.ok(p.y >= graph.bounds.top - 1e-6 && p.y <= graph.bounds.bottom + 1e-6);
        }
        verifyWeights(graph);
      }
    }
  }
});

test('invalid edits do not mutate the graph', () => {
  const graph = new Graph().generateRandomConnected();
  const before = JSON.stringify([...graph.positions]);
  for (const weight of [NaN, Infinity, -1, 0, graph.maxEdgeWeight + 0.01]) {
    assert.throws(() => graph.setEdgeDistance(graph.edges[0].id, weight), { name: 'RangeError' });
    assert.equal(JSON.stringify([...graph.positions]), before);
  }
});

test('after moving a node, Dijkstra agrees with independent Bellman-Ford distances', () => {
  const graph = new Graph().generateRandomConnected();
  graph.positions.set('A', graph.clampPosition({ x: 320, y: 240 }));
  graph.syncDistanceWeights();
  verifyWeights(graph);
  const dist = Object.fromEntries(graph.vertices.map(v => [v, v === 'A' ? 0 : Infinity]));
  for (let i = 0; i < graph.vertices.length - 1; i++) {
    for (const edge of graph.edges) {
      dist[edge.v] = Math.min(dist[edge.v], Math.round((dist[edge.u] + edge.weight) * 100) / 100);
      dist[edge.u] = Math.min(dist[edge.u], Math.round((dist[edge.v] + edge.weight) * 100) / 100);
    }
  }
  const final = new DijkstraSolver(graph).generateExecutionTrace().at(-1);
  for (const v of graph.vertices) assert.equal(final.dist[v], dist[v]);
});

test('painting, connecting and erasing keep adjacency and topology consistent', () => {
  const graph = new Graph().generateRandomConnected();
  const vertex = graph.addVertex({ x: 300, y: 250 });
  assert.equal(vertex, 'K');
  assert.equal(graph.getNeighbors(vertex).length, 0);
  assert.equal(new DijkstraSolver(graph).generateExecutionTrace().at(-1).dist.K, Infinity);
  const id = graph.connectVertices('A', vertex);
  assert.ok(id);
  assert.equal(graph.connectVertices('A', vertex), null);
  assert.equal(graph.connectVertices(vertex, vertex), null);
  verifyWeights(graph);
  assert.ok(Number.isFinite(new DijkstraSolver(graph).generateExecutionTrace().at(-1).dist.K));
  graph.removeEdge(id);
  assert.equal(graph.getNeighbors(vertex).length, 0);
  graph.connectVertices('A', vertex);
  graph.removeVertex('A');
  assert.ok(!graph.positions.has('A') && !graph.adj.has('A'));
  assert.ok(graph.edges.every(edge => edge.u !== 'A' && edge.v !== 'A'));
  assert.equal(new DijkstraSolver(graph, vertex).generateExecutionTrace().at(-1).dist[vertex], 0);
  for (const v of [...graph.vertices]) graph.removeVertex(v);
  assert.equal(graph.vertices.length, 0);
  assert.equal(graph.edges.length, 0);
  assert.equal(new DijkstraSolver(graph).generateExecutionTrace().length, 0);
  assert.equal(graph.addVertex({ x: 100, y: 100 }), 'A');
  assert.equal(new DijkstraSolver(graph).generateExecutionTrace().at(-1).dist.A, 0);
});
