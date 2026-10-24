# Slider

Slider is an interactive sliding-tile puzzle (2 × 2 to 6 × 6) with
shortest-route finding, hints and auto-solve. It runs in the browser with no
dependencies, and covers the 8-puzzle, the 15-puzzle and their relatives.

## Running it

It is a static page with no dependencies and no build step. Serve the folder
with any web server and open it:

    python3 -m http.server 8000

Then visit <http://localhost:8000>. The solver runs in a Web Worker, which
browsers will not start from a `file://` address. If you open `index.html`
directly it still works, but the page freezes while it searches.

## Publishing

`.github/workflows/pages.yml` runs the tests and publishes the page to GitHub
Pages whenever `master` changes. Pages must be switched on once, under Settings,
Pages, with the source set to GitHub Actions.

## Playing

Click a tile to slide it. Clicking a tile in line with the gap slides everything
between them. The arrow keys move the tile in the direction of the arrow.
Shuffle always produces a board that can be solved, as half of all arrangements
cannot be.

Boards run from 2 × 2 to 6 × 6.

## Finding routes

**Hint** highlights the next tile to move, and **Solve** plays the whole route.
Both use the chosen route-finding mode.

* **Shortest** uses IDA\* with the Manhattan-distance heuristic plus linear
  conflicts, so the route has the fewest moves possible. It uses very little
  memory. A random 3 × 3 is instant, and a random 4 × 4 takes from a fraction of
  a second to about ten seconds in Node, with the worst boards taking longer, so
  there is a Cancel button. It is not offered beyond 4 × 4.
* **Quick** uses weighted A\*, which trades optimality for speed. Routes are
  around 35 to 50 per cent longer than the shortest at 4 × 4. A random 6 × 6
  usually takes well under a second.

If you play on after asking for a hint, the route is kept for as long as you
follow it.

## Learning how it works

[`explain.html`](explain.html) is a page for people who want to understand the
algorithms rather than just use them. It builds up from the idea of a puzzle as a
maze of positions to A\*, weighted A\* and IDA\*, with interactive demos:
a puzzle where you can see each heuristic's estimate and the scores A\* would
give each move, a grid where you can draw walls and watch A\* run with any
weight, and a table that solves one board with every strategy side by side. It
ends with references.

## Layout

| File | Purpose |
| --- | --- |
| `solver.js` | Board logic, solvability test, heuristics and both solvers. No browser dependencies, so it also runs in Node. |
| `worker.js` | Runs the solver off the main thread. |
| `app.js`, `index.html`, `style.css` | The puzzle interface. |
| `explain.html`, `learn.js`, `learn.css` | The explainer page and its interactive demos. |
| `gridsearch.js` | A\* on a grid, one step at a time, for the explainer's demo. |
| `test.js` | Tests. Run with `node test.js`. |

The tests check the solvability rule against exhaustive breadth-first search on
every board up to 3 × 3, and check that the shortest-route solver agrees with
breadth-first search on 2 × 3 and 3 × 3 boards, including the hardest 3 × 3
positions, which take 31 moves. They also check that none of the four heuristics
ever overestimates on any of the 181,440 positions of a 3 × 3 board, that
weighted search stays within its guaranteed bound, and that the grid search finds
shortest routes.

## History

This began in 2011 as a CoffeeScript and Express solver for boards up to 3 × 3.
It was rewritten from scratch as a client-side app. The original is in the git
history.

## Licence

Free for any non-commercial use, under the
[PolyForm Noncommercial Licence 1.0.0](LICENSE). That covers personal use,
study, hobby projects and use by charities and educational institutions. It does
not cover selling the software or using it for commercial gain. Note that this
is a source-available licence, not an open-source one in the Open Source
Initiative's sense, because it restricts commercial use.
