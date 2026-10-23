# Dijkstra's Algorithm Visualizer

An interactive, real-time web application to explore and visualize Dijkstra's Single-Source Shortest Path algorithm on weighted graphs.

The application presents a synchronized three-panel workbench featuring step-by-step pseudocode tracing, dynamic SVG graph topology visualization, and real-time execution state tracking.

---

## Features

- **Guaranteed Connected Graph Generation**:
  - Generates 10 vertices (`A` through `J`) with 20 random edges, weighted by their straight-line distances.
  - Automatically initializes with a spanning tree to guarantee the graph is always fully connected.
- **Interactive Three-Panel Workbench**:
  - **Left Panel (Algorithm Execution)**: Highlights the active pseudocode line during each step of execution.
  - **Middle Panel (Graph Topology & Shortest Path Tree)**:
    - Interactive SVG canvas with draggable vertices to customize layout.
    - Coordinate grid with a bottom-left origin and one unit per square. Each vertex displays its `(x, y)` coordinates.
    - Drag a vertex to update its coordinates, connected edge weights, and shortest paths live. Weights use grid units, rounded to two decimal places.
    - Click an edge weight (or focus it and press Enter) to edit its distance. Apply moves the two endpoints to minimize their total squared movement, keeps the other vertices fixed, and updates connected edge weights. Layout bounds are respected; constrained directions are optimized numerically.
    - Edits pause playback and show recalculated shortest paths immediately. Use Step or Find Shortest Paths to replay the updated graph. Reset clears execution while keeping the edited layout.
    - **Vertex paint**: Click the grid or drag across empty space to create vertices. **Connect edges**: Click two vertices to join them, with a preview while choosing the second endpoint. **Eraser**: Click or drag across vertices and edges to delete them.
    - Choose any vertex as the source. Deleting the source picks another remaining vertex; disconnected vertices display as unreachable. An empty graph can be rebuilt with Vertex paint.
    - Responsive panels use the available viewport height on desktop and stack on smaller screens, with wrapping toolbars and scrollable code and tables.
    - Color-coded node and edge states: Source (`A`), Current node (`u`), Evaluating neighbor (`v`), Settled vertices, and Shortest Path Tree (SPT) edges.
    - Smooth path transition overlay upon algorithm completion.
  - **Right Panel (Execution State & Live Memory)**:
    - **Scalar Registers**: Live display of current node $u$, evaluated neighbor $v$, edge weight $w(u, v)$, and alternative path distance $\text{dist}[u] + w$.
    - **Active Priority Queue ($Q$)**: Visual representation of unsettled vertices ordered by current distance.
    - **Distance & Predecessor Table**: Real-time record of $\text{dist}[v]$, predecessor $\text{prev}[v]$, and settlement status with active row highlighting.
- **Interactive Playback Controls**:
  - **Find Shortest Paths**: Auto-plays the algorithm execution.
  - **Step**: Advances execution one discrete step forward.
  - **Instant Complete**: Computes and highlights all shortest paths immediately.
  - **Reset**: Reverts the current graph to its initial state.
  - **Randomize Graph**: Generates a new random connected graph.
  - **Speed Slider**: Configurable animation speed from 100ms to 1000ms.
  - **Dark / Light Theme Toggle**: Seamless switching between dark and light modes.
  - **Resizable Panels**: Splitter dividers to adjust panel widths dynamically.

---

## File Structure

```text
├── index.html     # Semantic HTML5 layout and 3-panel UI structure
├── style.css      # Design system, glassmorphism styles, responsive layout & themes
├── graph.js       # Graph data structure and guaranteed connected graph generator
├── dijkstra.js    # Discrete execution frame generator for Dijkstra's algorithm
├── app.js         # UI controller, event handlers, animations, and SVG rendering
└── README.md      # Project documentation
```

---

## Getting Started

No build tools or package managers are required. The project is built entirely with vanilla HTML, CSS, and modern JavaScript.

### Running Locally

1. Clone or download this repository:
   ```bash
   git clone https://github.com/amanalex2006/AlgoViewer-Graph-Editor.git
   ```
2. Open [index.html](index.html) directly in any modern web browser:
   - Double-click `index.html` in your file explorer, or
   - Use a lightweight local server (such as VS Code Live Server or `npx serve`):
     ```bash
     npx serve .
     ```

---

## Algorithm Details

Dijkstra's algorithm finds the shortest path from a starting source node (vertex `A`) to all other vertices in a weighted graph with non-negative edge weights:

1. **Initialization**: Set $\text{dist}[\text{source}] = 0$ and $\text{dist}[v] = \infty$ for all other vertices $v$. Set $\text{prev}[v] = \text{null}$. Add all vertices to queue $Q$.
2. **Vertex Extraction**: Extract the vertex $u \in Q$ with the minimum $\text{dist}[u]$.
3. **Edge Relaxation**: For each unvisited neighbor $v$ of $u$, calculate $\text{alt} = \text{dist}[u] + \text{weight}(u, v)$. If $\text{alt} < \text{dist}[v]$, update $\text{dist}[v] \leftarrow \text{alt}$ and $\text{prev}[v] \leftarrow u$.
4. **Termination**: Repeat until $Q$ is empty or all reachable vertices are settled.

---

## Technologies Used

- **HTML5**: Semantic tags, accessible layout, SVG graphics.
- **CSS3**: Custom properties (CSS variables), Flexbox, CSS Grid, smooth transitions, dark/light theme support.
- **JavaScript (ES6+)**: Custom Graph data structure, discrete step generator, SVG DOM manipulation.

## Checks

Run `node --test tests/graph.test.cjs` to verify geometric weights, minimal endpoint movement, bounds, input validation, and shortest-path correctness after edits.

## Original Project

Based on [sahil-mss/AlgoViewer](https://github.com/sahil-mss/AlgoViewer), extended with geometric weights, coordinate grids, interactive graph editing, and responsive sizing.
