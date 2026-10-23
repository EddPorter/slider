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

console.log('\n' + passed + ' tests passed');
