/**
 * Dijkstra's Algorithm Step Generator
 * Produces discrete visual execution frames for line-by-line stepping,
 * highlighting the active pseudocode line, live variables, queue, and graph topology.
 *
 * Pseudocode Line Mapping:
 * Line 1:  function Dijkstra(Graph, source='A'):
 * Line 2:    for each vertex v in Graph.Vertices:
 * Line 3:      dist[v] <- infinity, prev[v] <- null
 * Line 4:    dist[source] <- 0
 * Line 5:    Q <- copy of all vertices in Graph
 * Line 6:    while Q is not empty:
 * Line 7:      u <- vertex in Q with min dist[u]
 * Line 8:      remove u from Q
 * Line 9:      for each unvisited neighbor v of u:
 * Line 10:       alt <- dist[u] + weight(u, v)
 * Line 11:       if alt < dist[v]:
 * Line 12:         dist[v] <- alt, prev[v] <- u
 * Line 13:   return dist, prev
 */

class DijkstraSolver {
  constructor(graph, source = 'A') {
    this.graph = graph;
    this.source = source;
  }

  generateExecutionTrace() {
    const steps = [];
    const dist = {};
    const prev = {};
    const visited = new Set();
    const Q = new Set();
    const sptEdges = new Set();

    if (!this.graph.vertices.includes(this.source)) return [];

    const snapshot = (line, u = null, v = null, w = null, alt = null) => ({
      line,
      u,
      v,
      w,
      alt,
      dist: { ...dist },
      prev: { ...prev },
      visited: new Set(visited),
      Q: new Set(Q),
      sptEdges: new Set(sptEdges)
    });

    // Step 0: Initial call
    steps.push(snapshot(1));

    // Lines 2-3: Init dist and prev
    for (const v of this.graph.vertices) {
      dist[v] = Infinity;
      prev[v] = null;
    }
    steps.push(snapshot(3));

    // Line 4: dist[source] <- 0
    dist[this.source] = 0;
    steps.push(snapshot(4, this.source, null, null, 0));

    // Line 5: Q <- all vertices
    for (const v of this.graph.vertices) {
      Q.add(v);
    }
    steps.push(snapshot(5));

    // Line 6: while Q is not empty
    while (Q.size > 0) {
      steps.push(snapshot(6));

      // Line 7: u <- vertex in Q with min dist[u]
      let minNode = null;
      let minDist = Infinity;
      for (const node of Q) {
        if (dist[node] < minDist) {
          minDist = dist[node];
          minNode = node;
        }
      }

      if (minNode === null || minDist === Infinity) {
        break;
      }

      const u = minNode;
      steps.push(snapshot(7, u));

      // Line 8: remove u from Q
      Q.delete(u);
      visited.add(u);
      steps.push(snapshot(8, u));

      // Line 9: for each unvisited neighbor v of u
      const neighbors = this.graph.getNeighbors(u);
      for (const edge of neighbors) {
        const v = edge.neighbor;
        const weight = edge.weight;

        if (visited.has(v)) {
          continue;
        }

        steps.push(snapshot(9, u, v, weight));

        // Line 10: alt <- dist[u] + weight(u, v)
        const alt = Math.round((dist[u] + weight) * 100) / 100;
        steps.push(snapshot(10, u, v, weight, alt));

        // Line 11: if alt < dist[v]
        if (alt < dist[v]) {
          steps.push(snapshot(11, u, v, weight, alt));

          // Line 12: dist[v] <- alt, prev[v] <- u
          if (prev[v] !== null) {
            sptEdges.delete(this.graph.edgeKey(prev[v], v));
          }
          dist[v] = alt;
          prev[v] = u;
          sptEdges.add(this.graph.edgeKey(u, v));

          steps.push(snapshot(12, u, v, weight, alt));
        } else {
          steps.push(snapshot(11, u, v, weight, alt));
        }
      }
    }

    // Line 13: return dist, prev
    steps.push(snapshot(13));

    return steps;
  }
}
