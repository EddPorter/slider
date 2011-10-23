var getActions, getNumberOfDisplacedPieces, getSumDistanceOfDisplacedPieces, heuristic, isGoal, l, removeChoice, solve, takeAction, _u;
l = require('./linkedlist');
_u = require('./underscore');
solve = function(row_count, column_count, puzzle) {
  var a, explored, f, found, frontier, new_path, path, result, s, _results;
  if (puzzle.length !== row_count * column_count) {
    return;
  }
  frontier = [[puzzle]];
  explored = [];
  _results = [];
  while (true) {
    if (frontier.length === 0) {
      return "ERROR: Puzzle cannot be solved";
    }
    console.log("picking next best path on the frontier");
    console.log("pre-frontier count: " + frontier.length);
    path = removeChoice(frontier, row_count, column_count);
    console.log("path length: " + path.length + ", frontiers: " + frontier.length);
    s = path[path.length - 1];
    explored[explored.length] = s;
    if (isGoal(s, row_count, column_count)) {
      console.log("reached the goal");
      return path;
    }
    console.log("exploring possible actions");
    console.log(explored);
    _results.push((function() {
      var _i, _len, _ref, _results2;
      _ref = getActions(s, row_count, column_count);
      _results2 = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        a = _ref[_i];
        result = takeAction(s, a, row_count, column_count);
        console.log(explored.indexOf(result));
        _results2.push((function() {
          var _j, _len2;
          if (-1 === explored.indexOf(result)) {
            found = false;
            for (_j = 0, _len2 = frontier.length; _j < _len2; _j++) {
              f = frontier[_j];
              if (-1 !== f.indexOf(result)) {
                found = true;
                break;
              }
            }
            if (!found) {
              console.log("found new unexplored path");
              new_path = [path];
              new_path[new_path.length] = result;
              return frontier[frontier.length] = new_path;
            }
          }
        })());
      }
      return _results2;
    })());
  }
  return _results;
};
removeChoice = function(frontier, rows, columns) {
  var best_state, foldl, h, n, _ref;
  foldl = function(memo, path) {
    var h, state;
    state = path[path.length - 1];
    h = heuristic(state, rows, columns) + path.length;
    if (h < memo[0] || (memo[0] = -1)) {
      return [h, path];
    } else {
      return memo;
    }
  };
  _ref = _u.reduce(frontier, foldl, [-1, null]), h = _ref[0], best_state = _ref[1];
  console.log("best heuristic: " + h);
  n = frontier.indexOf(best_state);
  frontier.splice(n, 1);
  return best_state;
};
isGoal = function(state, rows, columns) {
  return 0 === getNumberOfDisplacedPieces(state, rows, columns);
};
getActions = function(state, rows, columns) {
  var actions, found, zc, zr, _ref, _ref2;
  actions = [];
  zr = zc = 0;
  found = false;
  for (zr = 0, _ref = rows - 1; 0 <= _ref ? zr <= _ref : zr >= _ref; 0 <= _ref ? zr++ : zr--) {
    for (zc = 0, _ref2 = columns - 1; 0 <= _ref2 ? zc <= _ref2 : zc >= _ref2; 0 <= _ref2 ? zc++ : zc--) {
      if (state[zr * columns + zc] === 0) {
        found = true;
        break;
      }
    }
    if (found) {
      break;
    }
  }
  if (!found) {
    return "State contains to 0 square!";
  }
  if (zr !== 0) {
    actions[actions.length] = [zr, zc, zr - 1, zc];
  }
  if (zr !== (rows - 1)) {
    actions[actions.length] = [zr, zc, zr + 1, zc];
  }
  if (zc !== 0) {
    actions[actions.length] = [zr, zc, zr, zc - 1];
  }
  if (zc !== (columns - 1)) {
    actions[actions.length] = [zr, zc, zr, zc + 1];
  }
  return actions;
};
takeAction = function(state, action, rows, columns) {
  var new_state;
  new_state = state.slice();
  console.log(new_state.length);
  new_state[rows * action[2] + action[3]] = 0;
  new_state[rows * action[0] + action[1]] = state[rows * action[2] + action[3]];
  return new_state;
};
heuristic = function(state, rows, columns) {
  return getSumDistanceOfDisplacedPieces(state, rows, columns);
};
getNumberOfDisplacedPieces = function(state, rows, columns) {
  var column, displaced_pieces, expected_piece, row, _ref, _ref2;
  displaced_pieces = 0;
  expected_piece = 1;
  for (row = 0, _ref = rows - 1; 0 <= _ref ? row <= _ref : row >= _ref; 0 <= _ref ? row++ : row--) {
    for (column = 0, _ref2 = columns - 1; 0 <= _ref2 ? column <= _ref2 : column >= _ref2; 0 <= _ref2 ? column++ : column--) {
      if (state[row * columns + column] !== expected_piece) {
        ++displaced_pieces;
      }
      expected_piece = (expected_piece + 1) % (rows * columns);
    }
  }
  return displaced_pieces;
};
getSumDistanceOfDisplacedPieces = function(state, rows, columns) {
  var cell, column, expected_column, expected_piece, expected_row, piece, row, sum_distance, _ref, _ref2;
  sum_distance = 0;
  expected_piece = 1;
  for (row = 0, _ref = rows - 1; 0 <= _ref ? row <= _ref : row >= _ref; 0 <= _ref ? row++ : row--) {
    for (column = 0, _ref2 = columns - 1; 0 <= _ref2 ? column <= _ref2 : column >= _ref2; 0 <= _ref2 ? column++ : column--) {
      cell = row * columns + column;
      if (state[cell] !== expected_piece) {
        piece = state[cell] === 0 ? state.length : state[cell];
        expected_row = (piece - 1) / columns;
        expected_column = (piece - 1) / rows;
        sum_distance += Math.abs(expected_row - row) + Math.abs(expected_column - column);
      }
      expected_piece = (expected_piece + 1) % (rows * columns);
    }
  }
  return sum_distance;
};
console.log("puzzle #1: " + solve(2, 2, [1, 2, 3, 0]));
console.log("puzzle #2: " + solve(2, 2, [1, 0, 3, 2]));
