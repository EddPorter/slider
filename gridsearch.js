/*
 * Weighted A* on a grid, one expansion at a time, for the interactive demo on
 * the explainer page. Moves are up, right, down and left, each costing 1, and
 * the heuristic is Manhattan distance, which never overestimates on such a grid.
 *
 * Cells are numbered in reading order: index = row * cols + col.
 *
 * Works in the browser and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GridSearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var UNSEEN = 0, OPEN = 1, CLOSED = 2;

  // weight 0 ignores the goal (Dijkstra, which is breadth-first search on a
  // grid), 1 is ordinary A*, and a very large weight is greedy best-first.
  function create(options) {
    var cols = options.cols, rows = options.rows, n = cols * rows;
    var walls = options.walls, start = options.start, goal = options.goal;
    var weight = options.weight === undefined ? 1 : options.weight;

    var g = new Float64Array(n).fill(Infinity);
    var parent = new Int32Array(n).fill(-1);
    var state = new Uint8Array(n);
    var heap = [];
    var goalRow = Math.floor(goal / cols), goalCol = goal % cols;

    function h(i) {
      return Math.abs(Math.floor(i / cols) - goalRow) + Math.abs((i % cols) - goalCol);
    }

    // Lowest f first; among equals, the cell nearest the goal.
    function before(a, b) { return a.f < b.f || (a.f === b.f && a.h < b.h); }

    function push(i) {
      var entry = { i: i, g: g[i], h: h(i), f: g[i] + weight * h(i) };
      var k = heap.length;
      heap.push(entry);
      while (k > 0) {
        var p = (k - 1) >> 1;
        if (!before(entry, heap[p])) break;
        heap[k] = heap[p];
        k = p;
      }
      heap[k] = entry;
    }

    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length > 0) {
        var k = 0, len = heap.length;
        for (;;) {
          var l = 2 * k + 1, r = l + 1, m = l;
          if (l >= len) break;
          if (r < len && before(heap[r], heap[l])) m = r;
          if (!before(heap[m], last)) break;
          heap[k] = heap[m];
          k = m;
        }
        heap[k] = last;
      }
      return top;
    }

    g[start] = 0;
    state[start] = OPEN;
    push(start);

    var search = {
      cols: cols,
      rows: rows,
      g: g,
      state: state,
      parent: parent,
      h: h,
      status: 'searching',   // 'searching', 'found' or 'none'
      expanded: 0,
      current: -1,           // the cell expanded by the latest step
      path: null,            // start to goal, once found

      f: function (i) { return g[i] + weight * h(i); },

      // Expands one cell. Returns false once the search has finished.
      step: function () {
        if (search.status !== 'searching') return false;
        var entry;
        // A cell can sit in the heap more than once if a cheaper way to it
        // turned up; only the entry that matches its best known cost is live.
        do {
          if (heap.length === 0) { search.status = 'none'; return false; }
          entry = pop();
        } while (entry.g !== g[entry.i] || state[entry.i] === CLOSED);

        var i = entry.i;
        state[i] = CLOSED;
        search.expanded++;
        search.current = i;

        if (i === goal) {
          var path = [];
          for (var c = goal; c !== -1; c = parent[c]) path.push(c);
          search.path = path.reverse();
          search.status = 'found';
          return false;
        }

        var row = Math.floor(i / cols), col = i % cols, next = [];
        if (row > 0) next.push(i - cols);
        if (col < cols - 1) next.push(i + 1);
        if (row < rows - 1) next.push(i + cols);
        if (col > 0) next.push(i - 1);
        for (var k = 0; k < next.length; k++) {
          var nb = next[k];
          if (walls[nb]) continue;
          var cost = g[i] + 1;
          if (cost < g[nb]) {
            g[nb] = cost;
            parent[nb] = i;
            state[nb] = OPEN;   // also reopens a closed cell, which weights above 1 can need
            push(nb);
          }
        }
        return true;
      },

      run: function () {
        while (search.step()) { /* keep going */ }
        return search;
      }
    };
    return search;
  }

  var COLS = 24, ROWS = 14;

  // Starting layouts for the demo. Each returns { walls, start, goal }.
  var layouts = {
    // Nothing in the way.
    open: function () {
      return { walls: new Uint8Array(COLS * ROWS), start: 7 * COLS + 3, goal: 7 * COLS + 20 };
    },
    // A long wall with a gap at the bottom.
    wall: function () {
      var walls = new Uint8Array(COLS * ROWS);
      for (var r = 0; r <= 9; r++) walls[r * COLS + 12] = 1;
      return { walls: walls, start: 4 * COLS + 4, goal: 4 * COLS + 20 };
    },
    // Scattered obstacles, the same every time (a fixed pseudo-random pattern).
    // Chosen because a search that trusts the goal direction too much commits to
    // a route before it has seen the shorter one.
    scatter: function () {
      var walls = new Uint8Array(COLS * ROWS), seed = 60;
      for (var i = 0; i < walls.length; i++) {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        walls[i] = seed / 4294967296 < 0.3 ? 1 : 0;
      }
      var start = 7 * COLS + 3, goal = 7 * COLS + 20;
      walls[start] = walls[goal] = 0;
      return { walls: walls, start: start, goal: goal };
    }
  };

  return { create: create, layouts: layouts, COLS: COLS, ROWS: ROWS,
           UNSEEN: UNSEEN, OPEN: OPEN, CLOSED: CLOSED };
});
