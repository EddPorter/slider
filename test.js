// Run with: node test.js
'use strict';
var assert = require('assert');
var S = require('./solver');

var passed = 0;
function test(name, fn) {
  var t = Date.now();
  fn();
  passed++;
  console.log('ok - ' + name + ' (' + (Date.now() - t) + ' ms)');
}

// Seeded generator so failures are reproducible.
function rng(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Plays a solution and checks that every move is legal and the end is solved.
function replay(board, moves, rows, cols) {
  moves.forEach(function (cell) {
    board = S.applyMove(board, cell, rows, cols);
    assert(board, 'illegal move ' + cell);
  });
  assert(S.isSolved(board), 'solution does not solve the board');
}

// Breadth-first search outwards from the goal: distance to every reachable board.
function distances(rows, cols) {
  var start = S.goalBoard(rows, cols), dist = new Map([[start.join(), 0]]), queue = [start];
  for (var q = 0; q < queue.length; q++) {
    var b = queue[q], d = dist.get(b.join());
    S.neighbours(b.indexOf(0), rows, cols).forEach(function (cell) {
      var next = S.applyMove(b, cell, rows, cols), key = next.join();
      if (!dist.has(key)) { dist.set(key, d + 1); queue.push(next); }
    });
  }
  return dist;
}

function permutations(items) {
  if (items.length <= 1) return [items];
  var out = [];
  items.forEach(function (x, i) {
    permutations(items.slice(0, i).concat(items.slice(i + 1))).forEach(function (p) {
      out.push([x].concat(p));
    });
  });
  return out;
}

[[2, 2], [2, 3], [3, 2], [3, 3]].forEach(function (size) {
  var rows = size[0], cols = size[1];
  test('isSolvable matches reachability on ' + rows + 'x' + cols, function () {
    var reachable = distances(rows, cols), count = 0;
    var all = permutations(S.goalBoard(rows, cols));
    if (all.length > 400000) return;
    all.forEach(function (p) {
      assert.strictEqual(S.isSolvable(p, rows, cols), reachable.has(p.join()), p.join());
      if (S.isSolvable(p, rows, cols)) count++;
    });
    assert.strictEqual(count, all.length / 2);
  });
});

test('isSolvable on 4x4 known cases', function () {
  assert(S.isSolvable(S.goalBoard(4, 4), 4, 4));
  // The classic unsolvable position: 14 and 15 swapped.
  var b = S.goalBoard(4, 4);
  b[13] = 15; b[14] = 14;
  assert(!S.isSolvable(b, 4, 4));
});

test('randomBoard is solvable, unsolved and a permutation', function () {
  var random = rng(7);
  [[2, 2], [3, 3], [4, 4], [5, 5], [3, 4]].forEach(function (size) {
    for (var i = 0; i < 50; i++) {
      var b = S.randomBoard(size[0], size[1], random);
      assert(S.isSolvable(b, size[0], size[1]));
      assert(!S.isSolved(b));
      assert.deepStrictEqual(b.slice().sort(function (a, c) { return a - c; }),
                             S.goalBoard(size[0], size[1]).slice().sort(function (a, c) { return a - c; }));
    }
  });
});

test('applyMove rejects tiles that are not next to the blank', function () {
  var b = S.goalBoard(3, 3);
  assert.strictEqual(S.applyMove(b, 0, 3, 3), null);
  assert.deepStrictEqual(S.applyMove(b, 7, 3, 3), [1, 2, 3, 4, 5, 6, 7, 0, 8]);
});

test('optimal solver matches breadth-first search on every 2x3 board', function () {
  var dist = distances(2, 3);
  dist.forEach(function (d, key) {
    var b = key.split(',').map(Number), r = S.solve(b, 2, 3, 'optimal');
    assert.strictEqual(r.moves.length, d, key);
    replay(b, r.moves, 2, 3);
  });
});

test('optimal solver matches breadth-first search on 3x3 samples', function () {
  var dist = distances(3, 3), keys = Array.from(dist.keys()), random = rng(42);
  var longest = Array.from(dist.entries()).filter(function (e) { return e[1] === 31; });
  assert(longest.length > 0, 'expected boards at the known maximum depth of 31');
  var picks = longest.slice(0, 3).map(function (e) { return e[0]; });
  for (var i = 0; i < 60; i++) picks.push(keys[Math.floor(random() * keys.length)]);
  picks.forEach(function (key) {
    var b = key.split(',').map(Number), r = S.solve(b, 3, 3, 'optimal');
    assert.strictEqual(r.moves.length, dist.get(key), key);
    replay(b, r.moves, 3, 3);
  });
});

test('optimal solver solves scrambled 4x4 boards within the scramble length', function () {
  var random = rng(99);
  for (var i = 0; i < 5; i++) {
    var b = S.goalBoard(4, 4), last = -1, steps = 28;
    for (var s = 0; s < steps; s++) {
      var blank = b.indexOf(0);
      var options = S.neighbours(blank, 4, 4).filter(function (c) { return c !== last; });
      var cell = options[Math.floor(random() * options.length)];
      last = blank;
      b = S.applyMove(b, cell, 4, 4);
    }
    var r = S.solve(b, 4, 4, 'optimal');
    assert(r.moves.length <= steps, 'longer than the scramble');
    assert.strictEqual(r.moves.length % 2, steps % 2, 'parity of move count');
    replay(b, r.moves, 4, 4);
  }
});

test('quick solver solves random boards, 3x3 to 5x5', function () {
  var random = rng(5);
  [[3, 3, 20], [4, 4, 10], [5, 5, 5]].forEach(function (c) {
    for (var i = 0; i < c[2]; i++) {
      var b = S.randomBoard(c[0], c[1], random), r = S.solve(b, c[0], c[1], 'quick');
      assert(r, 'no solution for ' + b.join());
      replay(b, r.moves, c[0], c[1]);
    }
  });
});

test('unsolvable and already-solved boards', function () {
  var b = S.goalBoard(3, 3);
  b[0] = 2; b[1] = 1;
  assert.strictEqual(S.solve(b, 3, 3, 'optimal'), null);
  assert.deepStrictEqual(S.solve(S.goalBoard(3, 3), 3, 3, 'optimal').moves, []);
});


/* ---------- heuristics and instrumented search ---------- */

var HEURISTIC_NAMES = ['none', 'misplaced', 'manhattan', 'conflict'];

test('every heuristic is admissible, and each is at least as strong as the last (all 181,440 3x3 boards)', function () {
  var dist = distances(3, 3);
  dist.forEach(function (d, key) {
    var b = key.split(',').map(Number), previous = 0;
    HEURISTIC_NAMES.forEach(function (name) {
      var h = S.heuristicValue(name, b, 3, 3);
      assert(h <= d, name + ' overestimates on ' + key + ': ' + h + ' > ' + d);
      assert(h >= previous, name + ' is weaker than the one before on ' + key);
      previous = h;
    });
  });
});

test('heuristicBreakdown explains the conflict heuristic', function () {
  var solved = S.heuristicBreakdown(S.goalBoard(3, 3), 3, 3);
  assert.strictEqual(solved.total, 0);
  assert.deepStrictEqual(solved.conflictCells, []);

  // Two reversed pairs, each in its own row: tiles 1 and 2, then 7 and 8.
  var b = [2, 1, 3, 4, 5, 6, 8, 7, 0], r = S.heuristicBreakdown(b, 3, 3);
  assert.strictEqual(r.manhattan, 4);
  assert.strictEqual(r.extra, 4);
  assert.strictEqual(r.total, 8);
  assert.deepStrictEqual(r.rowExtra, [2, 0, 2]);
  assert.deepStrictEqual(r.colExtra, [0, 0, 0]);
  assert.deepStrictEqual(r.conflictCells.sort(function (x, y) { return x - y; }), [0, 1, 6, 7]);
  assert.deepStrictEqual(r.distance, [1, 1, 0, 0, 0, 0, 1, 1, 0]);

  var random = rng(11);
  for (var i = 0; i < 100; i++) {
    var x = S.randomBoard(4, 4, random);
    assert.strictEqual(S.heuristicBreakdown(x, 4, 4).total, S.heuristicValue('conflict', x, 4, 4));
  }
});

test('search with weight 1 finds shortest routes for every admissible heuristic', function () {
  var dist = distances(3, 3), random = rng(21), expanded = {};
  HEURISTIC_NAMES.forEach(function (name) { expanded[name] = 0; });
  for (var i = 0; i < 25; i++) {
    var b = S.randomBoard(3, 3, random), want = dist.get(b.join());
    HEURISTIC_NAMES.forEach(function (name) {
      var r = S.search(b, 3, 3, { heuristic: name, weight: 1 });
      assert.strictEqual(r.moves.length, want, name + ' on ' + b.join());
      replay(b, r.moves, 3, 3);
      expanded[name] += r.nodes;
    });
  }
  // Better estimates mean fewer positions looked at, summed over the sample.
  assert(expanded.none > expanded.misplaced, JSON.stringify(expanded));
  assert(expanded.misplaced > expanded.manhattan, JSON.stringify(expanded));
  assert(expanded.manhattan > expanded.conflict, JSON.stringify(expanded));
});

test('weighted search stays within weight x shortest, and looks at fewer positions', function () {
  var dist = distances(3, 3), random = rng(33), exact = 0, weighted = 0;
  for (var i = 0; i < 25; i++) {
    var b = S.randomBoard(3, 3, random), want = dist.get(b.join());
    var a = S.search(b, 3, 3, { weight: 1 }), w = S.search(b, 3, 3, { weight: 3 });
    assert(w.moves.length <= 3 * want, 'w = 3 broke its bound on ' + b.join());
    replay(b, w.moves, 3, 3);
    exact += a.nodes;
    weighted += w.nodes;
  }
  assert(weighted < exact, weighted + ' >= ' + exact);
});

test('search gives up at maxNodes', function () {
  var b = [8, 6, 7, 2, 5, 4, 3, 0, 1];
  assert.strictEqual(S.search(b, 3, 3, { heuristic: 'none', maxNodes: 50 }), null);
});

test('IDA* reports each pass, and the passes add up', function () {
  var hardest = [8, 6, 7, 2, 5, 4, 3, 0, 1];
  var r = S.solve(hardest, 3, 3, 'optimal');
  assert.strictEqual(r.moves.length, 31);
  var total = 0;
  r.iterations.forEach(function (it, i) {
    total += it.nodes;
    if (i > 0) assert(it.bound > r.iterations[i - 1].bound, 'bounds must increase');
  });
  assert.strictEqual(total, r.nodes);
  assert.strictEqual(r.iterations[r.iterations.length - 1].bound, 31);
});

/* ---------- grid search (the explainer's demo) ---------- */

var GridSearch = require('./gridsearch');

function gridBFS(cols, rows, walls, start, goal) {
  var d = new Array(cols * rows).fill(-1), queue = [start];
  d[start] = 0;
  for (var q = 0; q < queue.length; q++) {
    var i = queue[q], r = Math.floor(i / cols), c = i % cols, next = [];
    if (r > 0) next.push(i - cols);
    if (r < rows - 1) next.push(i + cols);
    if (c > 0) next.push(i - 1);
    if (c < cols - 1) next.push(i + 1);
    next.forEach(function (n) {
      if (!walls[n] && d[n] < 0) { d[n] = d[i] + 1; queue.push(n); }
    });
  }
  return d[goal];
}

function gridRun(layout, weight) {
  return GridSearch.create({ cols: GridSearch.COLS, rows: GridSearch.ROWS, walls: layout.walls,
                             start: layout.start, goal: layout.goal, weight: weight }).run();
}

test('grid search: weights 0 and 1 find shortest paths, weight 1 expands no more', function () {
  var cols = 12, rows = 8, random = rng(3), found = 0, none = 0;
  for (var t = 0; t < 200; t++) {
    var walls = new Uint8Array(cols * rows);
    for (var i = 0; i < walls.length; i++) walls[i] = random() < 0.28 ? 1 : 0;
    var start = 0, goal = cols * rows - 1;
    walls[start] = walls[goal] = 0;
    var want = gridBFS(cols, rows, walls, start, goal);
    var run = function (w) {
      return GridSearch.create({ cols: cols, rows: rows, walls: walls, start: start, goal: goal, weight: w }).run();
    };
    var dijkstra = run(0), astar = run(1);
    if (want < 0) {
      assert.strictEqual(dijkstra.status, 'none');
      assert.strictEqual(astar.status, 'none');
      none++;
      continue;
    }
    found++;
    assert.strictEqual(dijkstra.path.length - 1, want);
    assert.strictEqual(astar.path.length - 1, want);
    assert(astar.expanded <= dijkstra.expanded, 'A* expanded more than Dijkstra');
    // A path is a chain of neighbouring, open cells from start to goal.
    astar.path.forEach(function (cell, k) {
      assert(!walls[cell]);
      if (k > 0) {
        var a = astar.path[k - 1], dr = Math.abs(Math.floor(cell / cols) - Math.floor(a / cols)),
            dc = Math.abs((cell % cols) - (a % cols));
        assert.strictEqual(dr + dc, 1);
      }
    });
    var w3 = run(3);
    assert(w3.path.length - 1 <= 3 * want, 'weight 3 broke its bound');
  }
  assert(found > 50 && none > 5, found + ' found, ' + none + ' unreachable');
});

test('grid search demo layouts show the trade-off between effort and route length', function () {
  var open = GridSearch.layouts.open(), scatter = GridSearch.layouts.scatter();
  assert.strictEqual(gridRun(open, 1).path.length - 1, 17);
  assert(gridRun(open, 0).expanded > 10 * gridRun(open, 1).expanded);

  var optimal = gridRun(scatter, 1), greedy = gridRun(scatter, 100);
  assert.strictEqual(optimal.path.length - 1, 31);
  assert(greedy.path.length > optimal.path.length, 'greedy should take a longer route here');
  assert(greedy.expanded < optimal.expanded, 'greedy should look at fewer cells here');
  assert(gridRun(scatter, 0).expanded > optimal.expanded);

  var wall = GridSearch.layouts.wall();
  assert.strictEqual(gridRun(wall, 1).status, 'found');
});

test('grid search: stepping one cell at a time matches running to the end', function () {
  var layout = GridSearch.layouts.scatter();
  var stepped = GridSearch.create({ cols: GridSearch.COLS, rows: GridSearch.ROWS, walls: layout.walls,
                                    start: layout.start, goal: layout.goal, weight: 2 });
  var steps = 0;
  while (stepped.step()) steps++;
  var whole = gridRun(layout, 2);
  assert.deepStrictEqual(stepped.path, whole.path);
  assert.strictEqual(stepped.expanded, whole.expanded);
  assert.strictEqual(stepped.step(), false, 'a finished search stays finished');
});


/* ---------- the human method ---------- */

var Human = require('./human');

// Plays a human-method solution and checks every move is legal and the board
// ends solved. Returns the number of moves.
function humanSolves(board, rows, cols, method) {
  var r = Human.solve(board, rows, cols, method), b = board.slice();
  r.moves.forEach(function (cell) {
    b = S.applyMove(b, cell, rows, cols);
    assert(b, 'illegal move ' + cell + ' on ' + board.join());
  });
  assert(S.isSolved(b), 'not solved: ' + board.join());
  return r.moves.length;
}

[[2, 2], [2, 3], [3, 2], [2, 4], [4, 2]].forEach(function (size) {
  test('human method solves every solvable ' + size[0] + 'x' + size[1] + ' board, in both orders', function () {
    var count = 0;
    permutations(S.goalBoard(size[0], size[1])).forEach(function (p) {
      if (!S.isSolvable(p, size[0], size[1])) return;
      humanSolves(p, size[0], size[1], 'rows');
      humanSolves(p, size[0], size[1], 'peel');
      count++;
    });
    assert(count > 0);
  });
});

test('human method solves every solvable 3x3 board (181,440), and both orders agree there', function () {
  var count = 0, sampler = rng(2);
  distances(3, 3).forEach(function (d, key) {
    var b = key.split(',').map(Number);
    humanSolves(b, 3, 3, 'rows');
    if (sampler() < 0.01) {
      assert.deepStrictEqual(Human.solve(b, 3, 3, 'rows').moves, Human.solve(b, 3, 3, 'peel').moves);
    }
    count++;
  });
  assert.strictEqual(count, 181440);
});

test('human method solves random boards of many shapes, in both orders', function () {
  var random = rng(77);
  [[3, 4], [4, 3], [2, 6], [6, 2], [2, 9], [7, 3], [4, 4], [5, 5], [6, 6], [8, 8]].forEach(function (size) {
    var runs = size[0] * size[1] <= 25 ? 300 : 60;
    for (var i = 0; i < runs; i++) {
      var b = S.randomBoard(size[0], size[1], random);
      humanSolves(b, size[0], size[1], 'rows');
      humanSolves(b, size[0], size[1], 'peel');
    }
  });
});

test('human method refuses an unsolvable board', function () {
  var b = S.goalBoard(4, 4);
  b[13] = 15; b[14] = 14;
  assert.throws(function () { Human.solve(b, 4, 4, 'rows'); }, /cannot be solved/);
});

test('human stages cover every move once, in order, and lock more cells as they go', function () {
  var random = rng(8);
  [[4, 4, 'rows'], [4, 4, 'peel'], [5, 3, 'rows'], [3, 5, 'peel']].forEach(function (c) {
    var b = S.randomBoard(c[0], c[1], random), r = Human.solve(b, c[0], c[1], c[2]), at = 0;
    r.stages.forEach(function (stage) {
      assert.strictEqual(stage.start, at, 'stages must be contiguous');
      assert(stage.end > stage.start);
      at = stage.end;
      stage.lockedBefore.forEach(function (cell) { assert(stage.lockedAfter.indexOf(cell) >= 0); });
      assert(stage.lockedAfter.length > stage.lockedBefore.length);
      if (stage.substeps) {
        assert.strictEqual(stage.substeps[0].start, stage.start);
        assert.strictEqual(stage.substeps[stage.substeps.length - 1].end, stage.end);
      }
    });
    assert.strictEqual(at, r.moves.length, 'stages must cover every move');
    assert(r.order.every(function (k) { return k >= 1; }), 'every cell belongs to a line');
  });
});

test('human orders: rows then column pairs, or peel an L', function () {
  var rows = Human.solve(S.goalBoard(5, 5), 5, 5, 'rows').order;
  var peel = Human.solve(S.goalBoard(5, 5), 5, 5, 'peel').order;
  // Rows: the first three lines are whole rows, then two column pairs, then 2 x 2.
  assert.deepStrictEqual(rows, [1,1,1,1,1, 2,2,2,2,2, 3,3,3,3,3, 4,5,6,7,7, 4,5,6,7,7]);
  // Peel: a row, a column, a row, a column, then 2 x 2.
  assert.deepStrictEqual(peel, [1,1,1,1,1, 2,3,3,3,3, 2,4,5,5,5, 2,4,6,7,7, 2,4,6,7,7]);
});

test('peeling an L is shorter on average than rows on 5x5 boards, as the page says', function () {
  var random = rng(123), rows = 0, peel = 0, runs = 300;
  for (var i = 0; i < runs; i++) {
    var b = S.randomBoard(5, 5, random);
    rows += Human.solve(b, 5, 5, 'rows').moves.length;
    peel += Human.solve(b, 5, 5, 'peel').moves.length;
  }
  assert(peel < rows, 'peel ' + peel / runs + ' vs rows ' + rows / runs);
});

test('the two boards shown on the human page demonstrate what the page says they do', function () {
  // Keep these in step with ORDINARY and AWKWARD in human-page.js.
  var ordinary = [3, 10, 5, 14, 12, 1, 4, 8, 7, 13, 15, 11, 9, 0, 2, 6];
  var awkward = [0, 8, 1, 2, 7, 13, 10, 4, 11, 9, 14, 15, 6, 3, 12, 5];
  function pairStage(board) {
    var r = Human.solve(board, 4, 4, 'rows');
    return r.stages.filter(function (st) { return st.layer === 'Row 1' && st.tiles.length === 2; })[0];
  }
  var a = pairStage(ordinary), b = pairStage(awkward);
  assert.strictEqual(a.substeps.length, 4, 'ordinary: park, park, bring the gap, slide');
  assert.deepStrictEqual(a.substeps.map(function (s) { return s.end - s.start; }), [4, 9, 1, 2]);
  assert.strictEqual(b.substeps.length, 3, 'awkward: untangle, bring the gap, slide');
  assert(/in each other/.test(b.substeps[0].label));
  assert.deepStrictEqual(b.substeps.map(function (s) { return s.end - s.start; }), [19, 1, 2]);
});


/* ---------- the pages themselves ---------- */

test('every in-page link on the explainer and human pages points at an element that exists', function () {
  var fs = require('fs');
  ['explain.html', 'human.html'].forEach(function (file) {
    var html = fs.readFileSync(__dirname + '/' + file, 'utf8');
    var ids = {};
    html.replace(/\bid="([^"]+)"/g, function (m, id) { ids[id] = true; });
    var missing = [];
    html.replace(/href="#([^"]+)"/g, function (m, id) { if (!ids[id]) missing.push(id); });
    assert.deepStrictEqual(missing, [], file + ' links to missing ids');
  });
});

test('links between the pages point at files that exist', function () {
  var fs = require('fs');
  ['index.html', 'explain.html', 'human.html'].forEach(function (file) {
    var html = fs.readFileSync(__dirname + '/' + file, 'utf8');
    html.replace(/(?:href|src)="([a-z-]+\.(?:html|js|css))(?:#[^"]*)?"/g, function (m, target) {
      assert(fs.existsSync(__dirname + '/' + target), file + ' refers to missing ' + target);
    });
  });
});

console.log('\n' + passed + ' tests passed');
