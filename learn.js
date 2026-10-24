/* The interactive parts of the explainer page. The searches themselves live in
   solver.js (the puzzle) and gridsearch.js (the grid); this file only draws
   them and responds to clicks. */
(function () {
  'use strict';

  var S = window.Slider, G = window.GridSearch;
  var nf = new Intl.NumberFormat('en-GB');

  function $(selector) { return document.querySelector(selector); }

  function make(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // 7.76 × 10²⁴, as markup.
  function scientific(x) {
    var parts = x.toExponential(2).split('e'), fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(parts[0] + ' × 10'));
    fragment.appendChild(make('sup', null, String(parseInt(parts[1], 10))));
    return fragment;
  }

  function text(s) { return document.createTextNode(s); }

  /* ---------- 1. How many positions ---------- */

  function factorial(n) {
    var result = 1n;
    for (var i = 2n; i <= BigInt(n); i++) result *= i;
    return result;
  }

  function duration(seconds) {
    var fragment = document.createDocumentFragment();
    if (seconds < 1) { fragment.appendChild(text('less than a second')); return fragment; }
    var minutes = seconds / 60, hours = minutes / 60, days = hours / 24, years = days / 365.25;
    if (seconds < 60) fragment.appendChild(text(Math.round(seconds) + ' seconds'));
    else if (minutes < 60) fragment.appendChild(text(Math.round(minutes) + ' minutes'));
    else if (hours < 24) fragment.appendChild(text(Math.round(hours) + ' hours'));
    else if (days < 365) fragment.appendChild(text('about ' + Math.round(days) + ' days'));
    else if (years < 1e6) fragment.appendChild(text('about ' + nf.format(Math.round(years)) + ' years'));
    else if (years < 1e9) fragment.appendChild(text('about ' + (years / 1e6).toFixed(1) + ' million years'));
    else if (years < 1e12) fragment.appendChild(text('about ' + nf.format(Math.round(years / 1e9)) + ' billion years'));
    else { fragment.appendChild(scientific(years)); fragment.appendChild(text(' years')); }
    return fragment;
  }

  function stateTable() {
    var body = $('#state-table tbody');
    if (!body) return;
    [2, 3, 4, 5, 6].forEach(function (n) {
      var positions = Number(factorial(n * n) / 2n);
      var row = make('tr');
      row.appendChild(make('th', null, n + ' × ' + n)).scope = 'row';
      var count = make('td', 'num');
      if (positions < 1e15) count.textContent = nf.format(positions);
      else count.appendChild(scientific(positions));
      row.appendChild(count);
      var time = make('td');
      time.appendChild(duration(positions / 1e6));
      row.appendChild(time);
      body.appendChild(row);
    });
  }

  /* ---------- small boards for display ---------- */

  // A miniature 3 × 3 board. `moved` is the cell of a tile to outline.
  function mini(board, moved) {
    var el = make('div', 'mini');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Board: ' + board.map(function (t) { return t === 0 ? 'gap' : t; }).join(' '));
    board.forEach(function (t, i) {
      var cell = make('span', t === 0 ? 'blank' : (i === moved ? 'moved' : ''), t === 0 ? '' : String(t));
      el.appendChild(cell);
    });
    return el;
  }

  function inversions(board) {
    var count = 0;
    for (var i = 0; i < board.length; i++) {
      for (var j = i + 1; j < board.length; j++) {
        if (board[i] !== 0 && board[j] !== 0 && board[i] > board[j]) count++;
      }
    }
    return count;
  }

  /* ---------- the puzzle playgrounds ---------- */

  function Playground(root) {
    var features = (root.dataset.features || '').split(/\s+/);
    function has(name) { return features.indexOf(name) >= 0; }

    var N = 3, board = S.goalBoard(N, N), moves = 0, tiles = {};
    var justMoved = -1;   // cell now holding the tile that was slid last; sliding it back undoes the move

    var main = make('div', 'pg-main');
    var boardEl = make('div', 'board' + (has('distances') ? ' show-d' : ''));
    boardEl.setAttribute('role', 'group');
    boardEl.setAttribute('aria-label', 'Puzzle board');
    boardEl.style.setProperty('--n', N);
    for (var t = 1; t < N * N; t++) {
      var tile = make('button', 'tile', String(t));
      tile.type = 'button';
      tile.setAttribute('aria-label', 'Tile ' + t);
      tile.dataset.tile = t;
      tile.addEventListener('click', onTile);
      boardEl.appendChild(tile);
      tiles[t] = tile;
    }
    main.appendChild(boardEl);

    var controls = make('div', 'pg-controls');
    function button(label, handler) {
      var b = make('button', null, label);
      b.type = 'button';
      b.addEventListener('click', handler);
      controls.appendChild(b);
    }
    button('Shuffle', shuffle);
    button('Reset', reset);
    if (has('swap')) button('Swap two tiles', swap);
    if (has('conflict')) button('Load a board with conflicts', conflictExample);
    if (has('distances')) {
      var label = make('label');
      var box = make('input');
      box.type = 'checkbox';
      box.checked = true;
      box.addEventListener('change', function () { boardEl.classList.toggle('show-d', box.checked); });
      label.appendChild(box);
      label.appendChild(text(' Show distances'));
      controls.appendChild(label);
    }
    main.appendChild(controls);

    var side = make('div', 'pg-side');
    var solvableEl = has('solvable') ? side.appendChild(make('div', 'pg-status')) : null;
    var breakdownEl = has('breakdown') ? side.appendChild(make('div', 'pg-status')) : null;
    var successorsEl = has('successors') ? side.appendChild(make('div', 'pg-status')) : null;
    if (solvableEl) solvableEl.setAttribute('aria-live', 'polite');

    root.appendChild(main);
    root.appendChild(side);

    function move(cell) {
      var next = S.applyMove(board, cell, N, N);
      if (!next) return;
      justMoved = board.indexOf(0);
      board = next;
      moves++;
      draw();
    }

    function onTile(event) { move(board.indexOf(Number(event.currentTarget.dataset.tile))); }

    function reset() { board = S.goalBoard(N, N); moves = 0; justMoved = -1; draw(); }

    function shuffle() {
      var b = S.goalBoard(N, N), previous = -1;
      for (var i = 0; i < 16; i++) {
        var blank = b.indexOf(0);
        var options = S.neighbours(blank, N, N).filter(function (c) { return c !== previous; });
        var cell = options[Math.floor(Math.random() * options.length)];
        previous = blank;
        b = S.applyMove(b, cell, N, N);
      }
      if (S.isSolved(b)) return shuffle();
      board = b;
      moves = 0;
      justMoved = -1;
      draw();
    }

    function swap() {
      var a = board.indexOf(1), b = board.indexOf(2);
      board[a] = 2;
      board[b] = 1;
      draw();
    }

    function conflictExample() {
      board = [2, 1, 3, 4, 5, 6, 8, 7, 0];
      moves = 0;
      justMoved = -1;
      draw();
    }

    function line(label, value, className) {
      var p = make('p');
      p.appendChild(text(label));
      p.appendChild(make('span', className || '', value));
      return p;
    }

    function draw() {
      var info = S.heuristicBreakdown(board, N, N);
      var inConflict = {};
      info.conflictCells.forEach(function (c) { inConflict[c] = true; });

      board.forEach(function (t, i) {
        if (t === 0) return;
        var el = tiles[t];
        el.style.setProperty('--r', Math.floor(i / N));
        el.style.setProperty('--c', i % N);
        el.classList.toggle('home', t === i + 1);
        el.classList.toggle('conflict', has('breakdown') && !!inConflict[i]);
        if (info.distance[i] > 0) el.dataset.d = info.distance[i];
        else delete el.dataset.d;
      });

      if (solvableEl) {
        var count = inversions(board), solvable = S.isSolvable(board, N, N);
        solvableEl.textContent = '';
        solvableEl.appendChild(line('Inversions: ', count + (count % 2 === 0 ? ' (even)' : ' (odd)')));
        solvableEl.appendChild(solvable
          ? line('', 'This board can be solved.', 'ok')
          : line('', 'No sequence of moves can ever solve this board.', 'bad'));
      }

      if (breakdownEl) {
        breakdownEl.textContent = '';
        if (S.isSolved(board)) {
          breakdownEl.appendChild(line('', 'Solved, so h = 0.', 'ok'));
        } else {
          var parts = [];
          info.rowExtra.forEach(function (x, i) { if (x) parts.push('row ' + (i + 1)); });
          info.colExtra.forEach(function (x, i) { if (x) parts.push('column ' + (i + 1)); });
          breakdownEl.appendChild(line('Manhattan distance: ', String(info.manhattan)));
          breakdownEl.appendChild(line('Linear conflicts: ',
            info.extra ? '+' + info.extra + ' (' + parts.join(', ') + ')' : 'none'));
          breakdownEl.appendChild(line('Estimate of moves left, h: ', String(info.total), 'ok'));
        }
      }

      if (successorsEl) drawSuccessors();
    }

    function drawSuccessors() {
      successorsEl.textContent = '';
      successorsEl.appendChild(make('p', null, 'Moves so far, g = ' + moves + '. Positions you could move to next:'));
      var blank = board.indexOf(0);
      var options = S.neighbours(blank, N, N).map(function (cell) {
        var next = S.applyMove(board, cell, N, N);
        var h = S.heuristicBreakdown(next, N, N).total;
        return { cell: cell, board: next, h: h, f: moves + 1 + h, tile: board[cell] };
      });
      // A* never goes back to the position it has just come from, so sliding the
      // last tile back is shown but is not a candidate for "lowest f".
      options.forEach(function (o) { o.undo = o.cell === justMoved; });
      var candidates = options.filter(function (o) { return !o.undo; });
      var lowest = Math.min.apply(null, candidates.map(function (o) { return o.f; }));
      var list = make('div', 'successors');
      options.forEach(function (o) {
        var best = !o.undo && o.f === lowest;
        var b = make('button', 'succ' + (best ? ' best' : ''));
        b.type = 'button';
        b.setAttribute('aria-label', 'Slide tile ' + o.tile + '. g ' + (moves + 1) + ', h ' + o.h + ', f ' + o.f +
                       (best ? ', lowest f' : '') + (o.undo ? ', undoes your last move' : ''));
        b.appendChild(mini(o.board, blank));
        b.appendChild(make('span', null, (moves + 1) + ' + ' + o.h + ' = ' + o.f));
        b.appendChild(make('span', 'tag', best ? 'lowest f' : (o.undo ? 'goes back' : '')));
        b.addEventListener('click', function () { move(o.cell); });
        list.appendChild(b);
      });
      successorsEl.appendChild(list);
      successorsEl.appendChild(make('p', null, 'Each box reads g + h = f.'));
    }

    shuffle();
  }

  /* ---------- 5. A* on a grid ---------- */

  function GridDemo() {
    var canvas = $('#gd-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var layoutSelect = $('#gd-layout'), weightInput = $('#gd-weight'), weightLabel = $('#gd-weight-label');
    var speedSelect = $('#gd-speed'), statusEl = $('#gd-status'), readout = $('#gd-readout');
    var runButton = $('#gd-run'), tableBody = $('#gd-table tbody');

    var COLS = G.COLS, ROWS = G.ROWS;
    var WEIGHTS = [0, 0.5, 1, 1.5, 2, 3, 5, 10, 100];
    var SPEEDS = { slow: { delay: 140, steps: 1 }, medium: { delay: 45, steps: 1 }, fast: { delay: 25, steps: 3 } };

    var walls, start, goal, search, timer = null, cell = 20, dragging = null, shortest;
    var rows = {};

    function weight() { return WEIGHTS[Number(weightInput.value)]; }
    function weightName(w) { return w === 100 ? '∞' : String(w); }

    function describeWeight(w) {
      if (w === 0) return 'w = 0: ignores the goal (breadth-first)';
      if (w === 1) return 'w = 1: A*';
      if (w === 100) return 'w = ∞: greedy best-first';
      return 'w = ' + w + ': weighted A*';
    }

    WEIGHTS.forEach(function (w) {
      var tr = make('tr');
      var th = make('th', null, w === 0 ? '0 (breadth-first)' : w === 1 ? '1 (A*)' : w === 100 ? '∞ (greedy)' : String(w));
      th.scope = 'row';
      tr.appendChild(th);
      var expanded = tr.appendChild(make('td', 'num', '–')), length = tr.appendChild(make('td', 'num', '–'));
      tableBody.appendChild(tr);
      rows[w] = { tr: tr, expanded: expanded, length: length };
    });

    function clearResults() {
      WEIGHTS.forEach(function (w) { rows[w].expanded.textContent = '–'; rows[w].length.textContent = '–'; });
    }

    function markCurrentRow() {
      WEIGHTS.forEach(function (w) { rows[w].tr.classList.toggle('current', w === weight()); });
    }

    function newSearch(w) {
      return G.create({ cols: COLS, rows: ROWS, walls: walls, start: start, goal: goal, weight: w });
    }

    function shortestLength() {
      if (shortest === undefined) {
        var r = newSearch(1).run();
        shortest = r.path ? r.path.length - 1 : -1;
      }
      return shortest;
    }

    function loadLayout(name) {
      var layout = G.layouts[name]();
      walls = layout.walls;
      start = layout.start;
      goal = layout.goal;
      layoutChanged();
    }

    function layoutChanged() {
      shortest = undefined;
      clearResults();
      resetSearch();
    }

    function resetSearch() {
      stopRun();
      search = newSearch(weight());
      weightLabel.textContent = describeWeight(weight());
      markCurrentRow();
      draw();
      updateStatus();
    }

    /* drawing */

    function fit() {
      var width = canvas.clientWidth;
      if (!width) return;
      cell = width / COLS;
      var height = cell * ROWS, ratio = window.devicePixelRatio || 1;
      canvas.style.height = height + 'px';
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    }

    function draw() {
      if (!canvas.clientWidth || !search) return;
      var css = getComputedStyle(document.documentElement);
      function colour(name) { return css.getPropertyValue(name).trim(); }
      var width = cell * COLS, height = cell * ROWS, i, x, y;

      ctx.fillStyle = colour('--gd-bg');
      ctx.fillRect(0, 0, width, height);

      for (i = 0; i < COLS * ROWS; i++) {
        x = (i % COLS) * cell;
        y = Math.floor(i / COLS) * cell;
        if (walls[i]) ctx.fillStyle = colour('--gd-wall');
        else if (search.state[i] === G.CLOSED) ctx.fillStyle = colour('--gd-expanded');
        else if (search.state[i] === G.OPEN) ctx.fillStyle = colour('--gd-frontier');
        else continue;
        ctx.fillRect(x, y, cell, cell);
      }

      ctx.strokeStyle = colour('--gd-grid');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (x = 0; x <= COLS; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, height); }
      for (y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(width, y * cell + 0.5); }
      ctx.stroke();

      if (search.path) {
        ctx.strokeStyle = colour('--gd-route');
        ctx.lineWidth = cell * 0.28;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        search.path.forEach(function (c, k) {
          var px = (c % COLS + 0.5) * cell, py = (Math.floor(c / COLS) + 0.5) * cell;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.stroke();
      } else if (search.status === 'searching' && search.current >= 0) {
        ctx.strokeStyle = colour('--gd-route');
        ctx.lineWidth = 2;
        ctx.strokeRect((search.current % COLS) * cell + 1, Math.floor(search.current / COLS) * cell + 1, cell - 2, cell - 2);
      }

      [[start, '--gd-start', 'S'], [goal, '--gd-goal', 'G']].forEach(function (m) {
        var cx = (m[0] % COLS + 0.5) * cell, cy = (Math.floor(m[0] / COLS) + 0.5) * cell;
        ctx.fillStyle = colour(m[1]);
        ctx.beginPath();
        ctx.arc(cx, cy, cell * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colour('--gd-bg');
        ctx.font = '700 ' + Math.round(cell * 0.5) + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(m[2], cx, cy + 1);
      });
    }

    function updateStatus() {
      var s = search, message;
      if (s.status === 'found') {
        var length = s.path.length - 1, best = shortestLength();
        message = 'Found a route of ' + length + ' steps after expanding ' + s.expanded + ' squares. ' +
          (length === best ? 'That is the shortest possible.'
                           : 'The shortest possible is ' + best + ', so this route is ' + (length - best) + ' longer.');
      } else if (s.status === 'none') {
        message = 'There is no route: the goal is walled off. The search expanded ' + s.expanded + ' squares before giving up.';
      } else if (s.expanded === 0) {
        message = 'Ready. Press Step or Run.';
      } else {
        var waiting = 0;
        for (var i = 0; i < s.state.length; i++) if (s.state[i] === G.OPEN) waiting++;
        message = 'Expanded ' + s.expanded + ' squares; ' + waiting + ' waiting in the frontier.';
      }
      statusEl.textContent = message;
    }

    /* running */

    function stopRun() {
      if (timer) { clearTimeout(timer); timer = null; }
      runButton.textContent = 'Run';
    }

    function tick() {
      var speed = SPEEDS[speedSelect.value] || SPEEDS.medium;
      for (var k = 0; k < speed.steps; k++) if (!search.step()) break;
      draw();
      updateStatus();
      if (search.status === 'searching') timer = setTimeout(tick, speed.delay);
      else stopRun();
    }

    function toggleRun() {
      if (timer) { stopRun(); return; }
      if (search.status !== 'searching') resetSearch();
      if (speedSelect.value === 'instant') {
        search.run();
        draw();
        updateStatus();
        return;
      }
      runButton.textContent = 'Pause';
      tick();
    }

    function stepOnce() {
      stopRun();
      if (search.status !== 'searching') resetSearch();
      search.step();
      draw();
      updateStatus();
    }

    function compareAll() {
      var best = shortestLength();
      WEIGHTS.forEach(function (w) {
        var r = newSearch(w).run(), row = rows[w];
        row.expanded.textContent = nf.format(r.expanded);
        if (!r.path) { row.length.textContent = 'no route'; return; }
        var length = r.path.length - 1;
        row.length.textContent = length + (length > best ? ' (+' + (length - best) + ')' : '');
      });
    }

    /* pointer: draw walls, drag the start and goal */

    function cellAt(event) {
      var rect = canvas.getBoundingClientRect();
      var x = Math.floor((event.clientX - rect.left) / rect.width * COLS);
      var y = Math.floor((event.clientY - rect.top) / rect.height * ROWS);
      return x < 0 || y < 0 || x >= COLS || y >= ROWS ? -1 : y * COLS + x;
    }

    function paint(i) {
      if (i < 0 || i === start || i === goal) return;
      var value = dragging === 'draw' ? 1 : 0;
      if (walls[i] !== value) { walls[i] = value; layoutChanged(); }
    }

    function showReadout(i) {
      if (i < 0) { readout.textContent = 'Point at a square to see its scores.'; return; }
      var column = i % COLS, row = Math.floor(i / COLS), where = 'Square (' + (column + 1) + ', ' + (row + 1) + '): ';
      if (walls[i]) { readout.textContent = where + 'wall.'; return; }
      var h = search.h(i);
      if (search.state[i] === G.UNSEEN) { readout.textContent = where + 'not reached yet. h = ' + h + '.'; return; }
      var f = Math.round(search.f(i) * 10) / 10;
      readout.textContent = where + (search.state[i] === G.CLOSED ? 'expanded' : 'in the frontier') +
        '. g = ' + search.g[i] + ', h = ' + h + ', f = g + ' + weightName(weight()) + ' × h = ' + f + '.';
    }

    canvas.addEventListener('pointerdown', function (event) {
      var i = cellAt(event);
      if (i < 0) return;
      canvas.setPointerCapture(event.pointerId);
      if (i === start) dragging = 'start';
      else if (i === goal) dragging = 'goal';
      else { dragging = walls[i] ? 'erase' : 'draw'; paint(i); }
      event.preventDefault();
    });

    canvas.addEventListener('pointermove', function (event) {
      var i = cellAt(event);
      if (dragging === 'start' || dragging === 'goal') {
        if (i >= 0 && !walls[i] && i !== start && i !== goal) {
          if (dragging === 'start') start = i; else goal = i;
          layoutChanged();
        }
      } else if (dragging) {
        paint(i);
      }
      showReadout(i);
    });

    function endDrag() { dragging = null; }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', function () { if (!dragging) showReadout(-1); });

    /* controls */

    layoutSelect.addEventListener('change', function () { loadLayout(layoutSelect.value); });
    weightInput.addEventListener('input', resetSearch);
    $('#gd-step').addEventListener('click', stepOnce);
    runButton.addEventListener('click', toggleRun);
    $('#gd-reset').addEventListener('click', resetSearch);
    $('#gd-clear').addEventListener('click', function () { walls.fill(0); layoutChanged(); });
    $('#gd-random').addEventListener('click', function () {
      for (var i = 0; i < walls.length; i++) walls[i] = i !== start && i !== goal && Math.random() < 0.28 ? 1 : 0;
      layoutChanged();
    });
    $('#gd-compare').addEventListener('click', compareAll);

    window.addEventListener('resize', fit);
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
    }

    loadLayout(layoutSelect.value);
    fit();
  }

  /* ---------- 9. All the strategies on one board ---------- */

  function Compare() {
    var tbody = $('#cmp-table tbody');
    if (!tbody) return;
    var boardEl = $('#cmp-board'), idaEl = $('#cmp-ida');
    var weightInput = $('#cmp-weight'), weightOutput = $('#cmp-weight-label');
    var HARDEST = [8, 6, 7, 2, 5, 4, 3, 0, 1];

    function weight() { return Number(weightInput.value); }

    var strategies = [
      { name: 'Breadth-first search',
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'none', weight: 1, maxNodes: 4e5 }); } },
      { name: 'A*, misplaced tiles',
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'misplaced', weight: 1 }); } },
      { name: 'A*, Manhattan distance',
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'manhattan', weight: 1 }); } },
      { name: 'A*, Manhattan + linear conflicts',
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'conflict', weight: 1 }); } },
      { name: function () { return 'Weighted A*, w = ' + weight(); },
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'conflict', weight: weight() }); } },
      { name: 'Greedy best-first (w = ∞)',
        run: function (b) { return S.search(b, 3, 3, { heuristic: 'conflict', weight: 100 }); } },
      { name: 'IDA*, Manhattan + linear conflicts',
        run: function (b) { return S.solveOptimal(b, 3, 3); } }
    ];
    var WEIGHTED = 4, REFERENCE = 3;

    var rows = strategies.map(function (strategy) {
      var tr = make('tr');
      var th = tr.appendChild(make('th', null, typeof strategy.name === 'function' ? strategy.name() : strategy.name));
      th.scope = 'row';
      var row = {
        tr: tr, name: th,
        expanded: tr.appendChild(make('td', 'num', '')),
        bar: tr.appendChild(make('td', 'bar-cell')),
        moves: tr.appendChild(make('td', 'num', '')),
        versus: tr.appendChild(make('td', null, ''))
      };
      row.bar.appendChild(make('span', 'bar'));
      row.bar.firstChild.style.width = '0';
      tbody.appendChild(tr);
      return row;
    });

    var board, token = 0, results = [], shortest = null;

    function setBoard(b) {
      board = b;
      boardEl.textContent = '';
      boardEl.appendChild(mini(b));
      runAll();
    }

    function showRow(i) {
      var r = results[i], row = rows[i];
      row.name.textContent = typeof strategies[i].name === 'function' ? strategies[i].name() : strategies[i].name;
      if (!r) {
        row.expanded.textContent = 'gave up';
        row.moves.textContent = '–';
        row.versus.textContent = '';
        return;
      }
      row.expanded.textContent = nf.format(r.nodes);
      row.moves.textContent = String(r.moves.length);
    }

    function showVersus(i) {
      var r = results[i];
      if (!r || shortest === null) { rows[i].versus.textContent = ''; return; }
      var extra = r.moves.length - shortest;
      rows[i].versus.textContent = extra === 0 ? 'shortest'
        : '+' + extra + ' moves (' + Math.round(100 * extra / shortest) + '% longer)';
    }

    function showBars() {
      var most = 1;
      results.forEach(function (r) { if (r && r.nodes > most) most = r.nodes; });
      rows.forEach(function (row, i) {
        var r = results[i];
        row.bar.firstChild.style.width = r ? Math.max(1, 100 * Math.log10(1 + r.nodes) / Math.log10(1 + most)) + '%' : '0';
      });
    }

    function showIterations() {
      var r = results[strategies.length - 1];
      idaEl.textContent = '';
      if (!r) return;
      idaEl.appendChild(make('p', null, 'IDA* took ' + r.iterations.length + ' ' +
        (r.iterations.length === 1 ? 'pass' : 'passes') + ' on this board. Each pass searches depth-first up to a limit, and the limit rises until the goal fits:'));
      var table = make('table', 'data');
      var head = make('tr');
      ['Pass', 'Depth limit', 'Positions visited'].forEach(function (h, k) {
        var th = make('th', k ? 'num' : null, h);
        th.scope = 'col';
        head.appendChild(th);
      });
      table.appendChild(make('thead')).appendChild(head);
      var body = table.appendChild(make('tbody'));
      r.iterations.forEach(function (it, k) {
        var tr = make('tr');
        tr.appendChild(make('td', null, String(k + 1)));
        tr.appendChild(make('td', 'num', String(it.bound)));
        tr.appendChild(make('td', 'num', nf.format(it.nodes)));
        body.appendChild(tr);
      });
      idaEl.appendChild(table);
    }

    function runAll() {
      var mine = ++token, i = 0;
      results = [];
      shortest = null;
      idaEl.textContent = '';
      rows.forEach(function (row, k) {
        row.expanded.textContent = '…';
        row.moves.textContent = '';
        row.versus.textContent = '';
        row.bar.firstChild.style.width = '0';
        row.name.textContent = typeof strategies[k].name === 'function' ? strategies[k].name() : strategies[k].name;
      });

      // One strategy at a time, so the page can repaint between them.
      function next() {
        if (mine !== token) return;
        if (i >= strategies.length) {
          var reference = results[REFERENCE] || results[strategies.length - 1];
          shortest = reference ? reference.moves.length : null;
          rows.forEach(function (row, k) { showVersus(k); });
          showBars();
          showIterations();
          return;
        }
        setTimeout(function () {
          if (mine !== token) return;
          results[i] = strategies[i].run(board);
          showRow(i);
          showBars();
          i++;
          next();
        }, 20);
      }
      next();
    }

    weightInput.addEventListener('input', function () {
      weightOutput.textContent = 'w = ' + weight();
      if (!results[WEIGHTED]) return;
      results[WEIGHTED] = strategies[WEIGHTED].run(board);
      showRow(WEIGHTED);
      showVersus(WEIGHTED);
      showBars();
    });

    $('#cmp-new').addEventListener('click', function () { setBoard(S.randomBoard(3, 3)); });
    $('#cmp-hard').addEventListener('click', function () { setBoard(HARDEST.slice()); });

    weightOutput.textContent = 'w = ' + weight();
    setBoard(S.randomBoard(3, 3));
  }

  stateTable();
  Array.prototype.forEach.call(document.querySelectorAll('.playground'), Playground);
  GridDemo();
  Compare();
})();
