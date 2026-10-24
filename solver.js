/*
 * Sliding-tile puzzle logic and solvers.
 *
 * A board is an array of rows * cols numbers in reading order. Tile t (1 to
 * rows * cols - 1) belongs at index t - 1, and 0 is the blank, which belongs
 * in the last cell. A move is the index of the tile that slides into the blank,
 * so a solution is simply the list of cells to click, in order.
 *
 * Works unchanged in the browser, in a Web Worker (importScripts) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Slider = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function goalBoard(rows, cols) {
    var n = rows * cols, b = [];
    for (var i = 1; i < n; i++) b.push(i);
    b.push(0);
    return b;
  }

  function isSolved(board) {
    var n = board.length;
    for (var i = 0; i < n - 1; i++) if (board[i] !== i + 1) return false;
    return board[n - 1] === 0;
  }

  // Indices of the cells next to `cell`.
  function neighbours(cell, rows, cols) {
    var r = (cell / cols) | 0, c = cell % cols, out = [];
    if (r > 0) out.push(cell - cols);
    if (r < rows - 1) out.push(cell + cols);
    if (c > 0) out.push(cell - 1);
    if (c < cols - 1) out.push(cell + 1);
    return out;
  }

  // Slide the tile at `cell` into the blank, returning a new board, or null if
  // the tile is not next to the blank.
  function applyMove(board, cell, rows, cols) {
    var blank = board.indexOf(0);
    if (neighbours(blank, rows, cols).indexOf(cell) < 0) return null;
    var next = board.slice();
    next[blank] = next[cell];
    next[cell] = 0;
    return next;
  }

  // A board is reachable from the goal exactly when its permutation has the
  // right parity. With an odd width, that is an even number of inversions.
  // With an even width, each vertical move of the blank also flips the parity,
  // so the blank's row has to be taken into account.
  function isSolvable(board, rows, cols) {
    var inv = 0, n = board.length;
    for (var i = 0; i < n; i++) {
      if (board[i] === 0) continue;
      for (var j = i + 1; j < n; j++) {
        if (board[j] !== 0 && board[i] > board[j]) inv++;
      }
    }
    if (cols % 2 === 1) return inv % 2 === 0;
    var blankRow = (board.indexOf(0) / cols) | 0;
    return (inv + blankRow) % 2 === (rows - 1) % 2;
  }

  // Uniformly random solvable board (never already solved, unless 1 x 1).
  function randomBoard(rows, cols, random) {
    random = random || Math.random;
    var b;
    do {
      b = goalBoard(rows, cols);
      for (var i = b.length - 1; i > 0; i--) {
        var j = Math.floor(random() * (i + 1)), t = b[i];
        b[i] = b[j];
        b[j] = t;
      }
      if (!isSolvable(b, rows, cols)) {
        // Swapping any two tiles flips the parity.
        var x = b[0] === 0 ? 1 : 0, y = x + 1 + (b[x + 1] === 0 ? 1 : 0);
        var s = b[x];
        b[x] = b[y];
        b[y] = s;
      }
    } while (isSolved(b) && b.length > 1);
    return b;
  }

  /* ---------- heuristic: Manhattan distance plus linear conflicts ---------- */

  function Geometry(rows, cols) {
    var n = rows * cols;
    this.rows = rows;
    this.cols = cols;
    this.n = n;
    this.goalRow = new Int8Array(n);
    this.goalCol = new Int8Array(n);
    this.nbrs = [];
    for (var t = 1; t < n; t++) {
      this.goalRow[t] = ((t - 1) / cols) | 0;
      this.goalCol[t] = (t - 1) % cols;
    }
    for (var i = 0; i < n; i++) this.nbrs.push(neighbours(i, rows, cols));
  }

  // Tiles that must leave a line to resolve its conflicts, counted by the usual
  // greedy rule: repeatedly remove the tile in the most reversed pairs. Each
  // removed tile costs two extra moves, so the caller multiplies by two.
  // `line` is a row (isRow) or a column of the board.
  var scratchTile = new Int8Array(64), scratchGoal = new Int8Array(64),
      scratchCount = new Int8Array(64);

  function lineConflicts(g, b, index, isRow) {
    var len = isRow ? g.cols : g.rows, k = 0, i, j;
    for (i = 0; i < len; i++) {
      var cell = isRow ? index * g.cols + i : i * g.cols + index;
      var t = b[cell];
      if (t === 0) continue;
      if ((isRow ? g.goalRow[t] : g.goalCol[t]) !== index) continue;
      scratchGoal[k++] = isRow ? g.goalCol[t] : g.goalRow[t];
    }
    if (k < 2) return 0;
    for (i = 0; i < k; i++) scratchCount[i] = 0;
    var total = 0;
    for (i = 0; i < k; i++) {
      for (j = i + 1; j < k; j++) {
        if (scratchGoal[i] > scratchGoal[j]) {
          scratchCount[i]++;
          scratchCount[j]++;
          total++;
        }
      }
    }
    var removed = 0;
    while (total > 0) {
      var worst = 0;
      for (i = 1; i < k; i++) if (scratchCount[i] > scratchCount[worst]) worst = i;
      for (j = 0; j < k; j++) {
        if (j === worst || scratchGoal[j] < 0) continue;
        if ((worst < j) ? scratchGoal[worst] > scratchGoal[j]
                        : scratchGoal[j] > scratchGoal[worst]) scratchCount[j]--;
      }
      total -= scratchCount[worst];
      scratchCount[worst] = 0;
      scratchGoal[worst] = -1; // removed; never conflicts again
      removed++;
    }
    return removed;
  }

  function manhattan(g, b) {
    var sum = 0;
    for (var i = 0; i < g.n; i++) {
      var t = b[i];
      if (t === 0) continue;
      sum += Math.abs(g.goalRow[t] - ((i / g.cols) | 0)) +
             Math.abs(g.goalCol[t] - (i % g.cols));
    }
    return sum;
  }

  function fullHeuristic(g, b) {
    var h = manhattan(g, b), i;
    for (i = 0; i < g.rows; i++) h += 2 * lineConflicts(g, b, i, true);
    for (i = 0; i < g.cols; i++) h += 2 * lineConflicts(g, b, i, false);
    return h;
  }

  function misplaced(g, b) {
    var count = 0;
    for (var i = 0; i < g.n; i++) if (b[i] !== 0 && b[i] !== i + 1) count++;
    return count;
  }

  // The heuristics, from weakest to strongest. Each is a lower bound on the
  // number of moves remaining, so each is safe to use for shortest routes.
  var HEURISTICS = {
    none: function () { return 0; },
    misplaced: misplaced,
    manhattan: manhattan,
    conflict: fullHeuristic
  };

  function heuristicValue(name, board, rows, cols) {
    return HEURISTICS[name](new Geometry(rows, cols), board);
  }

  // Splits the "conflict" heuristic into its parts, for showing to people:
  // each tile's Manhattan distance, the extra moves each line's conflicts add,
  // and the tiles that are in a conflict.
  function heuristicBreakdown(board, rows, cols) {
    var g = new Geometry(rows, cols), i, j;
    var distance = [], manhattanTotal = 0, rowExtra = [], colExtra = [], extra = 0;
    for (i = 0; i < g.n; i++) {
      var t = board[i];
      var d = t === 0 ? 0 : Math.abs(g.goalRow[t] - ((i / cols) | 0)) +
                            Math.abs(g.goalCol[t] - (i % cols));
      distance.push(d);
      manhattanTotal += d;
    }
    for (i = 0; i < rows; i++) { rowExtra.push(2 * lineConflicts(g, board, i, true)); extra += rowExtra[i]; }
    for (i = 0; i < cols; i++) { colExtra.push(2 * lineConflicts(g, board, i, false)); extra += colExtra[i]; }

    // A tile is "in a conflict" if it shares a line with another tile that
    // belongs in that line but sits in the opposite order.
    var inConflict = {};
    function mark(isRow, index) {
      var len = isRow ? cols : rows, cells = [];
      for (var k = 0; k < len; k++) {
        var cell = isRow ? index * cols + k : k * cols + index, tile = board[cell];
        if (tile !== 0 && (isRow ? g.goalRow[tile] : g.goalCol[tile]) === index) cells.push(cell);
      }
      for (var a = 0; a < cells.length; a++) {
        for (var c = a + 1; c < cells.length; c++) {
          var ta = board[cells[a]], tc = board[cells[c]];
          if ((isRow ? g.goalCol[ta] > g.goalCol[tc] : g.goalRow[ta] > g.goalRow[tc])) {
            inConflict[cells[a]] = inConflict[cells[c]] = true;
          }
        }
      }
    }
    for (i = 0; i < rows; i++) mark(true, i);
    for (j = 0; j < cols; j++) mark(false, j);

    return {
      distance: distance,
      manhattan: manhattanTotal,
      rowExtra: rowExtra,
      colExtra: colExtra,
      extra: extra,
      total: manhattanTotal + extra,
      conflictCells: Object.keys(inConflict).map(Number)
    };
  }

  /* ---------- optimal search: IDA* ---------- */

  // Returns { moves, nodes } with a shortest solution. `options.onProgress`
  // is called with ({ bound, nodes }) each time the depth limit increases and
  // every so often during a deep iteration.
  function solveOptimal(board, rows, cols, options) {
    options = options || {};
    var g = new Geometry(rows, cols);
    var b = board.slice();
    var blank = b.indexOf(0);
    var rowLC = new Int8Array(rows), colLC = new Int8Array(cols);
    var h = manhattan(g, b), i;
    for (i = 0; i < rows; i++) { rowLC[i] = lineConflicts(g, b, i, true); h += 2 * rowLC[i]; }
    for (i = 0; i < cols; i++) { colLC[i] = lineConflicts(g, b, i, false); h += 2 * colLC[i]; }

    var path = [], nodes = 0, FOUND = -1;

    // Depth-first search to f <= bound. Each move updates the cached
    // line-conflict counts for the lines it touches, and restores them on
    // backtracking. Returns FOUND, or the smallest f that exceeded the bound.
    function search(gCost, hCost, bound, prevBlank) {
      var f = gCost + hCost;
      if (f > bound) return f;
      if (hCost === 0) return FOUND;
      if ((++nodes & 0xfffff) === 0 && options.onProgress) {
        options.onProgress({ bound: bound, nodes: nodes });
      }
      var min = Infinity, list = g.nbrs[blank], oldBlank = blank;
      for (var k = 0; k < list.length; k++) {
        var cell = list[k];
        if (cell === prevBlank) continue;
        var t = b[cell];
        var r1 = (cell / cols) | 0, c1 = cell % cols;
        var r2 = (oldBlank / cols) | 0, c2 = oldBlank % cols;

        // Manhattan change for the moved tile.
        var dm = Math.abs(g.goalRow[t] - r2) + Math.abs(g.goalCol[t] - c2) -
                 Math.abs(g.goalRow[t] - r1) - Math.abs(g.goalCol[t] - c1);

        b[oldBlank] = t;
        b[cell] = 0;
        var oldA, oldB, oldC, newH;
        if (r1 === r2) {
          // Horizontal move: the row, and the two columns involved, change.
          oldA = rowLC[r1]; oldB = colLC[c1]; oldC = colLC[c2];
          rowLC[r1] = lineConflicts(g, b, r1, true);
          colLC[c1] = lineConflicts(g, b, c1, false);
          colLC[c2] = lineConflicts(g, b, c2, false);
          newH = hCost + dm + 2 * ((rowLC[r1] - oldA) + (colLC[c1] - oldB) + (colLC[c2] - oldC));
        } else {
          oldA = colLC[c1]; oldB = rowLC[r1]; oldC = rowLC[r2];
          colLC[c1] = lineConflicts(g, b, c1, false);
          rowLC[r1] = lineConflicts(g, b, r1, true);
          rowLC[r2] = lineConflicts(g, b, r2, true);
          newH = hCost + dm + 2 * ((colLC[c1] - oldA) + (rowLC[r1] - oldB) + (rowLC[r2] - oldC));
        }
        blank = cell;
        path.push(cell);

        var result = search(gCost + 1, newH, bound, oldBlank);
        if (result === FOUND) return FOUND;
        if (result < min) min = result;

        path.pop();
        blank = oldBlank;
        b[cell] = t;
        b[oldBlank] = 0;
        if (r1 === r2) { rowLC[r1] = oldA; colLC[c1] = oldB; colLC[c2] = oldC; }
        else { colLC[c1] = oldA; rowLC[r1] = oldB; rowLC[r2] = oldC; }
      }
      return min;
    }

    // `iterations` records each pass: the depth limit and positions visited.
    var bound = h, iterations = [];
    for (;;) {
      if (options.onProgress) options.onProgress({ bound: bound, nodes: nodes });
      var before = nodes;
      var result = search(0, h, bound, -1);
      iterations.push({ bound: bound, nodes: nodes - before });
      if (result === FOUND) {
        return { moves: path.slice(), nodes: nodes, optimal: true, iterations: iterations };
      }
      if (result === Infinity) return null;
      bound = result;
    }
  }

  /* ---------- fast search: weighted A* ---------- */

  function Heap() { this.items = []; }
  Heap.prototype.push = function (node) {
    var a = this.items, i = a.length;
    a.push(node);
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p].f <= node.f) break;
      a[i] = a[p];
      i = p;
    }
    a[i] = node;
  };
  Heap.prototype.pop = function () {
    var a = this.items, top = a[0], last = a.pop();
    if (a.length > 0) {
      var i = 0, n = a.length;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = l;
        if (l >= n) break;
        if (r < n && a[r].f < a[l].f) m = r;
        if (a[m].f >= last.f) break;
        a[i] = a[m];
        i = m;
      }
      a[i] = last;
    }
    return top;
  };

  function stateKey(b) {
    return String.fromCharCode.apply(null, b);
  }

  // One weighted A* pass: f = g + weight * h, with h given by `heuristic`, a
  // function of (geometry, board). Gives up after `maxNodes` expansions and
  // returns null. With weight 1 and an admissible h the route is shortest.
  function weightedAStar(board, rows, cols, weight, maxNodes, onProgress, nodesBefore, heuristic) {
    var g = new Geometry(rows, cols);
    var seen = new Map(), heap = new Heap(), nodes = 0;
    var start = { b: board.slice(), g: 0, f: 0, parent: null, cell: -1, blank: board.indexOf(0) };
    start.f = weight * heuristic(g, start.b);
    seen.set(stateKey(start.b), 0);
    heap.push(start);

    while (heap.items.length > 0) {
      var cur = heap.pop();
      if (isSolved(cur.b)) {
        var moves = [];
        for (var n = cur; n.parent; n = n.parent) moves.push(n.cell);
        return { moves: moves.reverse(), nodes: nodesBefore + nodes, optimal: false };
      }
      if (++nodes > maxNodes) return null;
      if ((nodes & 0xffff) === 0 && onProgress) onProgress({ nodes: nodesBefore + nodes });
      var blank = cur.blank, list = g.nbrs[blank];
      for (var k = 0; k < list.length; k++) {
        var cell = list[k];
        if (cur.parent && cell === cur.parent.blank) continue;
        var nb = cur.b.slice();
        nb[blank] = nb[cell];
        nb[cell] = 0;
        var key = stateKey(nb), cost = cur.g + 1;
        if (seen.has(key) && seen.get(key) <= cost) continue;
        seen.set(key, cost);
        heap.push({ b: nb, g: cost, f: cost + weight * heuristic(g, nb),
                    parent: cur, cell: cell, blank: cell });
      }
    }
    return null;
  }

  // A single weighted A* pass with a chosen heuristic ('none', 'misplaced',
  // 'manhattan' or 'conflict'), for experiments. Unlike solveQuick it does not
  // retry. The result's `nodes` is the number of positions expanded.
  function searchWith(board, rows, cols, options) {
    options = options || {};
    var weight = options.weight === undefined ? 1 : options.weight;
    return weightedAStar(board, rows, cols, weight, options.maxNodes || 1.2e6,
                         options.onProgress, 0, HEURISTICS[options.heuristic || 'conflict']);
  }

  // Finds a solution, not necessarily a shortest one. A larger weight finds
  // answers faster and longer; if a pass runs out of nodes it is retried with
  // double the weight, twice at most. Boards beyond 6 x 6 are not supported.
  function solveQuick(board, rows, cols, options) {
    options = options || {};
    var cells = rows * cols;
    var weight = options.weight || (cells <= 9 ? 2 : cells <= 16 ? 3 : cells <= 25 ? 4 : 6);
    var maxNodes = options.maxNodes || 1.2e6, spent = 0;
    for (var attempt = 0; attempt < 3; attempt++, weight *= 2) {
      var r = weightedAStar(board, rows, cols, weight, maxNodes, options.onProgress, spent,
                            fullHeuristic);
      if (r) return r;
      spent += maxNodes;
    }
    return null;
  }

  // Convenience entry point. mode is 'optimal' or 'quick'.
  function solve(board, rows, cols, mode, options) {
    if (!isSolvable(board, rows, cols)) return null;
    if (isSolved(board)) return { moves: [], nodes: 0, optimal: true };
    return mode === 'quick' ? solveQuick(board, rows, cols, options)
                            : solveOptimal(board, rows, cols, options);
  }

  return {
    goalBoard: goalBoard,
    isSolved: isSolved,
    isSolvable: isSolvable,
    neighbours: neighbours,
    applyMove: applyMove,
    randomBoard: randomBoard,
    solve: solve,
    solveOptimal: solveOptimal,
    solveQuick: solveQuick,
    search: searchWith,
    heuristicValue: heuristicValue,
    heuristicBreakdown: heuristicBreakdown
  };
});
