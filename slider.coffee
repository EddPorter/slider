l = require './linkedlist'
_u = require './underscore'

solve = (row_count, column_count, puzzle) ->
  if puzzle.length != row_count * column_count
    return

  frontier = [ [ puzzle ] ]
  explored = [ ]

  loop
    if frontier.length == 0
      return "ERROR: Puzzle cannot be solved"
    console.log "picking next best path on the frontier"
    console.log "pre-frontier count: " + frontier.length
    path = removeChoice frontier, row_count, column_count
    console.log "path length: " + path.length + ", frontiers: " + frontier.length
    s = path[path.length - 1]
    explored[explored.length] = s

    if isGoal s, row_count, column_count
      console.log "reached the goal"
      return path

    console.log "exploring possible actions"
    console.log explored
    for a in getActions s, row_count, column_count
      result = takeAction s, a, row_count, column_count
      console.log explored.indexOf result
      if -1 == explored.indexOf result
        found = false
        for f in frontier
          if -1 != f.indexOf result
            found = true
            break
        if not found
          console.log "found new unexplored path"
          new_path = [ path ]
          new_path[new_path.length] = result
          frontier[frontier.length] = new_path

removeChoice = (frontier, rows, columns) ->
  foldl = (memo, path) ->
    state = path[path.length - 1]
    h = heuristic(state, rows, columns) + path.length
    if h < memo[0] or memo[0] = -1
      [h, path]
    else
      memo

  [h, best_state] = _u.reduce frontier, foldl, [-1, null]
  console.log "best heuristic: " + h
  n = frontier.indexOf best_state
  frontier.splice n, 1
  best_state

isGoal = (state, rows, columns) ->
  0 == getNumberOfDisplacedPieces state, rows, columns

getActions = (state, rows, columns) ->
  actions = []

  zr = zc = 0
  found = false
  for zr in [0..(rows-1)]
    for zc in [0..(columns-1)]
      if state[zr * columns + zc] == 0
        found = true
        break
    if found
      break
  if not found
    return "State contains to 0 square!"

  if zr != 0
    actions[actions.length] = [zr, zc, zr - 1, zc]
  if zr != (rows - 1)
    actions[actions.length] = [zr, zc, zr + 1, zc]
  if zc != 0
    actions[actions.length] = [zr, zc, zr, zc - 1]
  if zc != (columns - 1)
    actions[actions.length] = [zr, zc, zr, zc + 1]
  actions

takeAction = (state, action, rows, columns) ->
  new_state = state.slice()
  console.log new_state.length
  new_state[rows * action[2] + action[3]] = 0
  new_state[rows * action[0] + action[1]] = state[rows * action[2] + action[3]]
  new_state

heuristic = (state, rows, columns) ->
  getSumDistanceOfDisplacedPieces state, rows, columns

getNumberOfDisplacedPieces = (state, rows, columns) ->
  displaced_pieces = 0
  expected_piece = 1
  for row in [0..(rows-1)]
    for column in [0..(columns-1)]
      if state[row * columns + column] != expected_piece
        ++displaced_pieces
      expected_piece = (expected_piece + 1) % (rows * columns)
  displaced_pieces

getSumDistanceOfDisplacedPieces = (state, rows, columns) ->
  sum_distance = 0
  expected_piece = 1
  for row in [0..(rows-1)]
    for column in [0..(columns-1)]
      cell = row * columns + column
      if state[cell] != expected_piece
        piece = if state[cell] == 0 then state.length else state[cell]
        expected_row = (piece - 1) / columns
        expected_column = (piece - 1) / rows
        sum_distance += Math.abs(expected_row - row) + Math.abs(expected_column - column)
      expected_piece = (expected_piece + 1) % (rows * columns)
  console.log "sum: " + sum_distance
  sum_distance

console.log "puzzle #1: " + solve(2,2,[1,2,3,0])
console.log "puzzle #2: " + solve(2,2,[1,0,3,2])
