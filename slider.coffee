l = require './linkedlist'
_u = require './underscore'

exports.solve = (row_count, column_count, puzzle) ->
  if puzzle.length != row_count * column_count
    return

  frontier = [ [ puzzle ] ]
  explored = [ ]

  loop
    if frontier.length == 0
      return "ERROR: Puzzle cannot be solved"
    path = removeChoice frontier, row_count, column_count
    s = path[path.length - 1]
    explored[explored.length] = s

    if isGoal s, row_count, column_count
      return path

    for a in getActions s, row_count, column_count
      result = takeAction s, a, row_count, column_count
      if not _u.any explored, ((s) -> (areStatesEqual s, result))
        found = false
        for f in frontier
          if _u.any f, ((s) -> (areStatesEqual s, result))
            found = true
            break
        if not found
          new_path = path.slice()
          new_path[new_path.length] = result
          frontier[frontier.length] = new_path

# choses the path on the frontier with the minimal heuristic cost. this path is
# removed from the frontier and returned, along with that cose
# tested and passed: 24/10/2011
removeChoice = (frontier, rows, columns) ->
  foldl = (memo, path) ->
    state = path[path.length - 1]
    h = heuristic(state, rows, columns) + path.length - 1
    if h < memo[0] or memo[0] == -1
      [h, path]
    else
      memo

  [h, best_state] = _u.reduce frontier, foldl, [-1, null]
  n = frontier.indexOf best_state
  frontier.splice n, 1
  best_state

isGoal = (state, rows, columns) ->
  0 == getNumberOfDisplacedPieces state, rows, columns

# returns the possible movements of the blank (0) tile in the puzzle. returns a
# list of these actions
# tested and passed: 24/10/2011
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

# given action [r1,c1, r2,c2] and state, such that state[r1,c1] = 0, switch the
# positions (r1,c1) and (r2,c2) in the state and return the new state. Do not
# modify the original state
# tested and passed: 24/10/2011
takeAction = (state, action, rows, columns) ->
  if state[action[0]*columns + action[1]] != 0
    return "Invalid action given the state"
  new_state = state.slice()
  new_state[columns * action[0] + action[1]] = state[columns * action[2] + action[3]]
  new_state[columns * action[2] + action[3]] = 0
  new_state

heuristic = (state, rows, columns) ->
  getSumDistanceOfDisplacedPieces state, rows, columns

# returns the number of pieces in the puzzle not in their correct positions
# tested and passed: 24/10/2011
getNumberOfDisplacedPieces = (state, rows, columns) ->
  displaced_pieces = 0
  expected_piece = 1
  for row in [0..(rows-1)]
    for column in [0..(columns-1)]
      if state[row * columns + column] != expected_piece
        ++displaced_pieces
      expected_piece = (expected_piece + 1) % (rows * columns)
  displaced_pieces

# returns the total sum of the Manhattan distance of each piece from its correct
# location
# tested and passed: 24/10/2011
getSumDistanceOfDisplacedPieces = (state, rows, columns) ->
  sum_distance = 0
  expected_piece = 1
  for row in [0..(rows-1)]
    for column in [0..(columns-1)]
      cell = row * columns + column
      if state[cell] != expected_piece
        piece = if state[cell] == 0 then rows*columns else state[cell]
        expected_row = Math.floor((piece-1) / columns)
        expected_column = Math.floor((piece-1) % columns)
        sum_distance += Math.abs(expected_row - row) +
          Math.abs(expected_column - column)
      expected_piece = (expected_piece + 1) % (rows*columns)
  sum_distance

areStatesEqual = (s1, s2) ->
  if s1.length != s2.length
    return "Mismatched state lengths"
  for n in [0..(s1.length-1)]
    if s1[n] != s2[n]
      return false
  return true

#console.log "puzzle #1: "
#console.log solve(2,2,[1,2,3,0])
#console.log "puzzle #2: "
#console.log solve(2,2,[1,0,3,2])
#console.log "puzzle #3: "
#console.log solve(3,3,[4,8,1,7,3,5,6,2,0])
#console.log "puzzle #4: "
#console.log solve(3,3,[4,8,1,7,3,5,6,2,0])
