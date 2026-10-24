/*
 * The way people solve sliding puzzles by hand, as a program.
 *
 * Solve the top row, then the left column, locking each as it is finished, so
 * the part still in play is a smaller puzzle of the same kind. Keep going until
 * a 2 x 2 block is left, and finish that by turning the tiles round the gap.
 * The last two tiles of a line cannot simply be put in place one after the
 * other, because the second would knock the first out, so they are placed
 * together using the "corner trick".
 *
 * Two methods are offered, under the names solvers use for them (see the
 * Speedsolving.com wiki's 15 puzzle page):
 *   'lbl'     layer by layer: solve whole rows from the top until two rows
 *             remain, then solve the rest two tiles at a time, a column at a
 *             time;
 *   'fringe'  take the top row, then the left column, alternately, so a square
 *             board shrinks by one in each direction every time (solving an
 *             n x n puzzle by reducing it to an (n-1) x (n-1) one).
 *
 * A person memorises a short pattern of moves for each situation. This code
 * finds each tile's route with a tiny search over just the tile and the gap,
 * which is what the memorised patterns amount to, so the stages are the same
 * but the individual moves can differ from a particular book's.
 *
 * Moves use the convention of solver.js: a move is the index of the cell whose
 * tile slides into the gap. Works in the browser and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Human = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function neighbourTable(rows, cols) {
    var table = [];
    for (var cell = 0; cell < rows * cols; cell++) {
      var r = (cell / cols) | 0, c = cell % cols, list = [];
      if (r > 0) list.push(cell - cols);
      if (r < rows - 1) list.push(cell + cols);
      if (c > 0) list.push(cell - 1);
      if (c < cols - 1) list.push(cell + 1);
      table.push(list);
    }
    return table;
  }

  // Returns { moves, stages, order, method }.
  //   stages: [{ title, detail, layer, tiles, start, end, substeps, lockedBefore, lockedAfter }]
  //           where moves[start..end) belong to the stage, and locked* are lists
  //           of cell indices that are finished before and after it.
  //   order:  for each cell, the number of the line it was finished in (1, 2, ...)
  // Throws if the board cannot be solved.
  function solve(board, rows, cols, method) {
    method = method || 'lbl';
    var n = rows * cols, b = board.slice(), nbrs = neighbourTable(rows, cols);
    var locked = new Uint8Array(n), moves = [], stages = [], order = new Array(n).fill(0);
    var free = { r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 }, layer = 0;

    function lockedList() {
      var list = [];
      for (var i = 0; i < n; i++) if (locked[i]) list.push(i);
      return list;
    }

    function slide(cell) {
      var blank = b.indexOf(0);
      b[blank] = b[cell];
      b[cell] = 0;
      moves.push(cell);
    }

    // Moves `tile` to `target`, never entering a locked cell, in as few moves
    // as possible. The search is over (where the tile is, where the gap is).
    function routeTile(tile, target) {
      var tilePos = b.indexOf(tile), blank = b.indexOf(0);
      if (tilePos === target) return;
      var start = tilePos * n + blank, previous = new Int32Array(n * n).fill(-1);
      var via = new Int16Array(n * n), queue = [start], found = -1;
      previous[start] = start;
      for (var q = 0; q < queue.length && found < 0; q++) {
        var s = queue[q], tp = (s / n) | 0, bp = s % n, list = nbrs[bp];
        for (var k = 0; k < list.length; k++) {
          var nb = list[k];
          if (locked[nb]) continue;
          var next = (nb === tp ? bp : tp) * n + nb;
          if (previous[next] !== -1) continue;
          previous[next] = s;
          via[next] = nb;
          if (((next / n) | 0) === target) { found = next; break; }
          queue.push(next);
        }
      }
      if (found < 0) throw new Error('no route for tile ' + tile);
      var path = [];
      for (var s2 = found; s2 !== start; s2 = previous[s2]) path.push(via[s2]);
      for (var i = path.length - 1; i >= 0; i--) slide(path[i]);
    }

    // Moves the gap to `target` without entering a locked cell.
    function routeBlank(target) {
      var blank = b.indexOf(0);
      if (blank === target) return;
      var previous = new Int16Array(n).fill(-1), queue = [blank];
      previous[blank] = blank;
      for (var q = 0; q < queue.length && previous[target] === -1; q++) {
        var list = nbrs[queue[q]];
        for (var k = 0; k < list.length; k++) {
          if (locked[list[k]] || previous[list[k]] !== -1) continue;
          previous[list[k]] = queue[q];
          queue.push(list[k]);
        }
      }
      if (previous[target] === -1) throw new Error('the gap cannot reach cell ' + target);
      var path = [];
      for (var c = target; c !== blank; c = previous[c]) path.push(c);
      for (var i = path.length - 1; i >= 0; i--) slide(path[i]);
    }

    // Moves two tiles at once, `ta` to `homeA` and `tz` to `homeZ`, never
    // entering a locked cell. Needed when the tiles are in each other's way,
    // as when one sits in a dead end that the other must pass. The search is
    // over (where each tile is, where the gap is).
    function routePair(ta, tz, homeA, homeZ) {
      var pa = b.indexOf(ta), pb = b.indexOf(tz), blank = b.indexOf(0);
      var start = (pa * n + pb) * n + blank, previous = new Int32Array(n * n * n).fill(-1);
      var via = new Int16Array(n * n * n), queue = [start], found = -1;
      previous[start] = start;
      for (var q = 0; q < queue.length && found < 0; q++) {
        var st = queue[q], bp = st % n, tb = ((st / n) | 0) % n, ta2 = (st / (n * n)) | 0, list = nbrs[bp];
        for (var k = 0; k < list.length; k++) {
          var nb = list[k];
          if (locked[nb]) continue;
          var na = nb === ta2 ? bp : ta2, nbb = nb === tb ? bp : tb, next = (na * n + nbb) * n + nb;
          if (previous[next] !== -1) continue;
          previous[next] = st;
          via[next] = nb;
          if (na === homeA && nbb === homeZ) { found = next; break; }
          queue.push(next);
        }
      }
      if (found < 0) throw new Error('no route for tiles ' + ta + ' and ' + tz);
      var path = [];
      for (var s2 = found; s2 !== start; s2 = previous[s2]) path.push(via[s2]);
      for (var i = path.length - 1; i >= 0; i--) slide(path[i]);
    }

    function lineName(kind) {
      return kind === 'row' ? 'Row ' + (free.r0 + 1) : 'Column ' + (free.c0 + 1);
    }

    function addStage(stage, before) {
      stage.end = moves.length;
      stage.lockedBefore = before;
      stage.lockedAfter = lockedList();
      if (stage.end > stage.start) stages.push(stage);
    }

    // Finishes the top row (kind 'row') or left column (kind 'col') of the part
    // still in play, then locks it.
    function solveLine(kind) {
      var cells = [], inner, i;
      if (kind === 'row') {
        for (i = free.c0; i <= free.c1; i++) cells.push(free.r0 * cols + i);
        inner = cols;
      } else {
        for (i = free.r0; i <= free.r1; i++) cells.push(i * cols + free.c0);
        inner = 1;
      }
      var L = cells.length, name = lineName(kind);
      layer++;

      // All but the last two tiles go straight to their homes.
      for (i = 0; i < L - 2; i++) {
        var before = lockedList(), tile = cells[i] + 1;
        var stage = { title: 'Place tile ' + tile, layer: name, tiles: [tile], start: moves.length,
          detail: 'Walk the gap round tile ' + tile + ' and push it into its home, keeping clear of the finished tiles.' };
        routeTile(tile, cells[i]);
        locked[cells[i]] = 1;
        order[cells[i]] = layer;
        addStage(stage, before);
      }

      // The last two go in together.
      var a = cells[L - 2], z = cells[L - 1], ta = a + 1, tz = z + 1;
      var beforePair = lockedList();
      if (b[a] !== ta || b[z] !== tz) {
        var pair = { title: 'Place tiles ' + ta + ' and ' + tz + ' together', layer: name, tiles: [ta, tz],
          start: moves.length, substeps: [],
          detail: 'The corner trick: the two tiles cannot be placed one after the other, so park them side by side and slip them in together.' };
        function step(label) { pair.substeps.push({ label: label, start: moves.length }); }

        // Usually one tile is parked and then the other. Sometimes the second
        // is stuck in a dead end behind the first; then both are moved together.
        var savedBoard = b.slice(), savedMoves = moves.length;
        try {
          step('Park tile ' + ta + ' in the corner where tile ' + tz + ' belongs.');
          routeTile(ta, z);
          locked[z] = 1;
          step('Park tile ' + tz + ' next to it, on the side away from the edge.');
          routeTile(tz, z + inner);
          locked[z + inner] = 1;
        } catch (e) {
          for (var j = 0; j < n; j++) b[j] = savedBoard[j];
          moves.length = savedMoves;
          locked[z] = locked[z + inner] = 0;
          pair.substeps = [];
          step('The tiles are in each other\'s way, so bring them to the corner and the spot beside it together.');
          routePair(ta, tz, z, z + inner);
          locked[z] = locked[z + inner] = 1;
        }
        step('Bring the gap round to the home of tile ' + ta + '.');
        routeBlank(a);
        step('Slide tile ' + ta + ' into its home, then tile ' + tz + ' into its own.');
        slide(z);
        slide(z + inner);
        locked[z + inner] = 0;
        pair.substeps.forEach(function (s, k) { s.end = k + 1 < pair.substeps.length ? pair.substeps[k + 1].start : moves.length; });
        locked[a] = 1;
        order[a] = layer;
        locked[z] = 1;
        order[z] = layer;
        addStage(pair, beforePair);
      } else {
        locked[a] = locked[z] = 1;
        order[a] = order[z] = layer;
      }

      if (kind === 'row') free.r0++; else free.c0++;
    }

    function freeRows() { return free.r1 - free.r0 + 1; }
    function freeCols() { return free.c1 - free.c0 + 1; }

    while (freeRows() > 2 || freeCols() > 2) {
      if (method === 'fringe') {
        if (freeRows() > 2) solveLine('row');
        if (freeCols() > 2) solveLine('col');
      } else if (freeRows() > 2) {
        solveLine('row');
      } else {
        solveLine('col');
      }
    }

    // What is left is 2 x 2. Turn the tiles round the gap until they fit.
    var corner = [free.r0 * cols + free.c0, free.r0 * cols + free.c1,
                  free.r1 * cols + free.c0, free.r1 * cols + free.c1];
    function target(cell) { return cell === n - 1 ? 0 : cell + 1; }
    function key() { return corner.map(function (c) { return b[c]; }).join(','); }
    function isDone() { return corner.every(function (c) { return b[c] === target(c); }); }

    layer++;
    var beforeFinal = lockedList(), finalStage = { title: 'Finish the last 2 × 2 block', layer: 'Last block',
      tiles: corner.map(target).filter(Boolean), start: moves.length,
      detail: 'Three tiles and the gap are left. Keep turning them round the gap, like a tiny roundabout, until they are in order.' };
    var seen = new Set([key()]), queue = [{ board: b.slice(), path: [] }], solution = null;
    for (var q = 0; q < queue.length && !solution; q++) {
      var state = queue[q], blank = state.board.indexOf(0);
      if (corner.every(function (c) { return state.board[c] === target(c); })) { solution = state.path; break; }
      nbrs[blank].forEach(function (nb) {
        if (corner.indexOf(nb) < 0) return;
        var next = state.board.slice();
        next[blank] = next[nb];
        next[nb] = 0;
        var k = corner.map(function (c) { return next[c]; }).join(',');
        if (seen.has(k)) return;
        seen.add(k);
        queue.push({ board: next, path: state.path.concat(nb) });
      });
    }
    if (!solution) throw new Error('this board cannot be solved');
    solution.forEach(slide);
    if (!isDone()) throw new Error('internal error: last block not finished');
    corner.forEach(function (c) { locked[c] = 1; order[c] = layer; });
    addStage(finalStage, beforeFinal);

    return { moves: moves, stages: stages, order: order, method: method };
  }

  return { solve: solve };
});
