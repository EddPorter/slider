(function () {
  'use strict';

  var els = {
    board: document.getElementById('board'),
    moves: document.getElementById('moves'),
    status: document.getElementById('status'),
    shuffle: document.getElementById('shuffle'),
    hint: document.getElementById('hint'),
    solve: document.getElementById('solve'),
    cancel: document.getElementById('cancel'),
    size: document.getElementById('size'),
    modes: document.querySelectorAll('input[name="mode"]')
  };

  var MAX_OPTIMAL_SIZE = 4;

  var size = Number(els.size.value);
  var board = Slider.goalBoard(size, size);
  var tiles = {};          // tile number -> element
  var moveCount = 0;
  var inPlay = false;      // true between a shuffle and the board being solved
  var plan = null;         // { moves, step, optimal }: a route from the current board
  var search = null;       // the running search, { cancel }
  var autoTimer = null;

  function mode() {
    for (var i = 0; i < els.modes.length; i++) if (els.modes[i].checked) return els.modes[i].value;
  }

  function setStatus(text) { els.status.textContent = text; }

  /* ---------- drawing ---------- */

  function build() {
    els.board.textContent = '';
    els.board.style.setProperty('--n', size);
    tiles = {};
    for (var t = 1; t < size * size; t++) {
      var el = document.createElement('button');
      el.type = 'button';
      el.className = 'tile';
      el.textContent = t;
      el.setAttribute('aria-label', 'Tile ' + t);
      el.dataset.tile = t;
      el.addEventListener('click', onTileClick);
      els.board.appendChild(el);
      tiles[t] = el;
    }
    draw();
  }

  function draw() {
    for (var i = 0; i < board.length; i++) {
      var t = board[i];
      if (t === 0) continue;
      tiles[t].style.setProperty('--r', Math.floor(i / size));
      tiles[t].style.setProperty('--c', i % size);
      tiles[t].classList.toggle('home', t === i + 1);
    }
    els.moves.textContent = moveCount;
  }

  function clearHint() {
    var hinted = els.board.querySelector('.hint');
    if (hinted) hinted.classList.remove('hint');
  }

  function showHint() {
    clearHint();
    if (plan && plan.step < plan.moves.length) {
      tiles[board[plan.moves[plan.step]]].classList.add('hint');
    }
  }

  /* ---------- playing ---------- */

  // Slides the tile at `cell` into the gap, if it is next to it.
  function move(cell) {
    var next = Slider.applyMove(board, cell, size, size);
    if (!next) return false;
    board = next;
    moveCount++;
    clearHint();
    if (plan && plan.moves[plan.step] === cell) plan.step++;
    else plan = null;
    draw();
    if (inPlay && Slider.isSolved(board)) {
      inPlay = false;
      stopAuto();
      setStatus('Solved in ' + moveCount + ' ' + (moveCount === 1 ? 'move' : 'moves') + '.');
    }
    return true;
  }

  // Slides every tile between the gap and `cell`, which must share its row
  // or column.
  function slideTowards(cell) {
    var blank = board.indexOf(0);
    var dr = Math.floor(cell / size) - Math.floor(blank / size);
    var dc = (cell % size) - (blank % size);
    if ((dr !== 0 && dc !== 0) || cell === blank) return;
    var step = dr !== 0 ? Math.sign(dr) * size : Math.sign(dc);
    for (var c = blank + step; ; c += step) {
      move(c);
      if (c === cell) break;
    }
  }

  function onTileClick(event) {
    interrupt();
    slideTowards(board.indexOf(Number(event.currentTarget.dataset.tile)));
  }

  document.addEventListener('keydown', function (event) {
    var active = document.activeElement;
    if (active && active !== document.body && !els.board.contains(active)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var blank = board.indexOf(0), row = Math.floor(blank / size), col = blank % size, cell = -1;
    // The tile moves in the direction of the arrow.
    switch (event.key) {
      case 'ArrowUp':    if (row < size - 1) cell = blank + size; break;
      case 'ArrowDown':  if (row > 0) cell = blank - size; break;
      case 'ArrowLeft':  if (col < size - 1) cell = blank + 1; break;
      case 'ArrowRight': if (col > 0) cell = blank - 1; break;
      default: return;
    }
    event.preventDefault();
    interrupt();
    if (cell >= 0) move(cell);
  });

  /* ---------- finding routes ---------- */

  function setBusy(busy) {
    [els.shuffle, els.hint, els.solve, els.size].forEach(function (el) { el.disabled = busy; });
    els.cancel.hidden = !busy;
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // Stops anything in progress, such as a search or an animated solution.
  function interrupt() {
    stopAuto();
    if (search) { search.cancel(); search = null; setBusy(false); setStatus('Cancelled.'); }
  }

  // Runs the solver in a Web Worker. Browsers refuse to start workers from
  // file:// pages, so in that case it runs on the main thread, which freezes
  // the page and cannot be cancelled until it finishes.
  function runSearch(job, onProgress, onDone) {
    var cancelled = false, worker = null;
    function finish(result) { if (!cancelled) onDone(result); }
    function inline() {
      setTimeout(function () {
        finish(Slider.solve(job.board, job.rows, job.cols, job.mode));
      }, 30);
    }
    try {
      worker = new Worker('worker.js');
      worker.onmessage = function (event) {
        if (event.data.type === 'progress') { if (!cancelled) onProgress(event.data); }
        else { worker.terminate(); finish(event.data.result); }
      };
      worker.onerror = function (event) {
        event.preventDefault();
        worker.terminate();
        worker = null;
        inline();
      };
      worker.postMessage(job);
    } catch (e) {
      worker = null;
      inline();
    }
    return { cancel: function () { cancelled = true; if (worker) worker.terminate(); } };
  }

  // Makes sure `plan` is a route from the current board, then calls back.
  function withPlan(then) {
    if (Slider.isSolved(board)) { setStatus('Already solved.'); return; }
    if (plan) { then(); return; }
    var wanted = mode(), started = Date.now();
    setBusy(true);
    setStatus('Searching…');
    search = runSearch(
      { board: board, rows: size, cols: size, mode: wanted },
      function (p) {
        var seconds = Math.round((Date.now() - started) / 1000);
        setStatus(wanted === 'optimal'
          ? 'Searching… the shortest route needs at least ' + p.bound + ' moves (' +
            (p.nodes / 1e6).toFixed(1) + 'M positions checked, ' + seconds + ' s).'
          : 'Searching… ' + (p.nodes / 1e3).toFixed(0) + 'k positions.');
      },
      function (result) {
        search = null;
        setBusy(false);
        if (!result) { setStatus('No route found within the search limit.'); return; }
        plan = { moves: result.moves, step: 0, optimal: result.optimal };
        setStatus(result.optimal
          ? 'Shortest route: ' + result.moves.length + ' moves.'
          : 'Found a route of ' + result.moves.length + ' moves (not necessarily the shortest).');
        then();
      });
  }

  function onHint() {
    interrupt();
    withPlan(showHint);
  }

  function onSolve() {
    interrupt();
    withPlan(function () {
      stopAuto();
      var delay = plan.moves.length > 80 ? 40 : 150;
      autoTimer = setInterval(function () {
        if (!plan || plan.step >= plan.moves.length) { stopAuto(); return; }
        move(plan.moves[plan.step]);
      }, delay);
    });
  }

  function onShuffle() {
    interrupt();
    plan = null;
    clearHint();
    board = Slider.randomBoard(size, size);
    moveCount = 0;
    inPlay = true;
    draw();
    setStatus('Slide the tiles into order.');
  }

  function onSizeChange() {
    interrupt();
    size = Number(els.size.value);
    board = Slider.goalBoard(size, size);
    plan = null;
    var optimalRadio = document.querySelector('input[name="mode"][value="optimal"]');
    var quickRadio = document.querySelector('input[name="mode"][value="quick"]');
    optimalRadio.disabled = size > MAX_OPTIMAL_SIZE;
    if (size > MAX_OPTIMAL_SIZE) quickRadio.checked = true;
    build();
    onShuffle();
  }

  for (var i = 0; i < els.modes.length; i++) {
    els.modes[i].addEventListener('change', function () { interrupt(); plan = null; clearHint(); });
  }
  els.shuffle.addEventListener('click', onShuffle);
  els.hint.addEventListener('click', onHint);
  els.solve.addEventListener('click', onSolve);
  els.cancel.addEventListener('click', interrupt);
  els.size.addEventListener('change', onSizeChange);

  build();
  onShuffle();
})();
