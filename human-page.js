/* The interactive parts of the "solving it by hand" page. The method itself is
   in human.js; this file draws it and responds to clicks. */
(function () {
  'use strict';

  var S = window.Slider, H = window.Human;
  var nf = new Intl.NumberFormat('en-GB');

  function $(selector) { return document.querySelector(selector); }

  function make(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // A miniature board of any size. `marked` lists tile numbers to outline.
  function mini(board, rows, cols, marked) {
    var el = make('div', 'mini');
    el.style.gridTemplateColumns = 'repeat(' + cols + ', 1.35rem)';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Board, row by row: ' +
      board.map(function (t) { return t === 0 ? 'gap' : t; }).join(' '));
    board.forEach(function (t) {
      var isMarked = marked && marked.indexOf(t) >= 0 && t !== 0;
      el.appendChild(make('span', t === 0 ? 'blank' : (isMarked ? 'moved' : ''), t === 0 ? '' : String(t)));
    });
    return el;
  }

  function replay(board, moves, rows, cols) {
    var b = board.slice();
    moves.forEach(function (cell) { b = S.applyMove(b, cell, rows, cols); });
    return b;
  }

  /* ---------- 1. The order lines are finished in ---------- */

  function orderMap(container, size, method) {
    var result = H.solve(S.goalBoard(size, size), size, size, method);
    var last = Math.max.apply(null, result.order);
    var map = make('div', 'omap');
    map.style.gridTemplateColumns = 'repeat(' + size + ', 1fr)';
    map.setAttribute('role', 'img');
    map.setAttribute('aria-label', 'Order in which each line is finished, row by row: ' + result.order.join(' '));
    result.order.forEach(function (k) {
      var cell = make('span', null, String(k));
      cell.style.setProperty('--k', k);
      cell.style.setProperty('--of', last);
      map.appendChild(cell);
    });
    container.appendChild(map);
  }

  /* ---------- 4. The corner trick, frame by frame ---------- */

  // Shows a board at the start of the "last two tiles of the first row" stage
  // and after each of its sub-steps.
  function frames(container, board) {
    var result = H.solve(board, 4, 4, 'rows');
    var stage = result.stages.filter(function (s) { return s.layer === 'Row 1' && s.tiles.length === 2; })[0];
    if (!stage) return;
    var current = replay(board, result.moves.slice(0, stage.start), 4, 4);
    function add(caption, b, count) {
      var figure = make('figure');
      figure.appendChild(mini(b, 4, 4, stage.tiles));
      figure.appendChild(make('figcaption', null, caption + (count === undefined ? '' : ' (' + count + (count === 1 ? ' move)' : ' moves)'))));
      container.appendChild(figure);
    }
    add('Before: 1 and 2 are home', current);
    stage.substeps.forEach(function (sub, i) {
      current = replay(current, result.moves.slice(sub.start, sub.end), 4, 4);
      add((i + 1) + '. ' + sub.label, current, sub.end - sub.start);
    });
  }

  /* ---------- 3. The trainer ---------- */

  function Trainer() {
    var boardEl = $('#tr-board');
    if (!boardEl) return;
    var sizeSelect = $('#tr-size'), methodSelect = $('#tr-method'), playButton = $('#tr-play');
    var countEl = $('#tr-count'), titleEl = $('#tr-title'), detailEl = $('#tr-detail');
    var subEl = $('#tr-sub'), layersEl = $('#tr-layers');

    var size, board, plan, step, tiles, timer = null, replanned = false;

    function build() {
      size = Number(sizeSelect.value);
      boardEl.textContent = '';
      boardEl.style.setProperty('--n', size);
      tiles = {};
      for (var t = 1; t < size * size; t++) {
        var tile = make('button', 'tile', String(t));
        tile.type = 'button';
        tile.setAttribute('aria-label', 'Tile ' + t);
        tile.dataset.tile = t;
        tile.addEventListener('click', onTile);
        boardEl.appendChild(tile);
        tiles[t] = tile;
      }
    }

    function replan() {
      plan = H.solve(board, size, size, methodSelect.value);
      step = 0;
    }

    function shuffle() {
      stop();
      board = S.randomBoard(size, size);
      replanned = false;
      replan();
      draw();
    }

    function stageAt(i) {
      for (var k = 0; k < plan.stages.length; k++) if (plan.stages[k].end > i) return plan.stages[k];
      return null;
    }

    function draw() {
      var stage = stageAt(step), done = step >= plan.moves.length;
      var locked = {};
      if (done) board.forEach(function (t, i) { locked[i] = true; });
      else stage.lockedBefore.forEach(function (c) { locked[c] = true; });

      board.forEach(function (t, i) {
        if (t === 0) return;
        var el = tiles[t];
        el.style.setProperty('--r', Math.floor(i / size));
        el.style.setProperty('--c', i % size);
        el.classList.toggle('locked', !!locked[i]);
        el.classList.toggle('hint', !done && stage.tiles.indexOf(t) >= 0 && !locked[i]);
      });

      countEl.textContent = done ? 'Finished after ' + plan.moves.length + ' moves.'
        : 'Move ' + (step + 1) + ' of ' + plan.moves.length + ' planned from here';
      if (done) {
        titleEl.textContent = S.isSolved(board) ? 'Solved' : '';
        detailEl.textContent = 'Every tile is home.';
        subEl.textContent = '';
      } else {
        titleEl.textContent = stage.layer + ': ' + stage.title;
        detailEl.textContent = (replanned ? 'Planned afresh from your position. ' : '') + stage.detail;
        subEl.textContent = '';
        if (stage.substeps) {
          stage.substeps.forEach(function (sub, i) {
            if (step >= sub.start && step < sub.end) {
              subEl.textContent = 'Part ' + (i + 1) + ' of ' + stage.substeps.length + ': ' + sub.label;
            }
          });
        }
      }

      // The lines, with the current one marked.
      layersEl.textContent = '';
      var seen = [];
      plan.stages.forEach(function (s) { if (seen.indexOf(s.layer) < 0) seen.push(s.layer); });
      seen.forEach(function (name) {
        var mine = plan.stages.filter(function (s) { return s.layer === name; });
        var finished = mine[mine.length - 1].end <= step;
        var active = !done && stage.layer === name;
        layersEl.appendChild(make('li', (finished ? 'finished' : '') + (active ? ' active' : ''), name));
      });
    }

    function move(cell) {
      var next = S.applyMove(board, cell, size, size);
      if (!next) return false;
      board = next;
      if (plan.moves[step] === cell) { step++; }
      else { replan(); replanned = true; }
      draw();
      return true;
    }

    function onTile(event) {
      stop();
      move(board.indexOf(Number(event.currentTarget.dataset.tile)));
    }

    function nextMove() {
      if (step >= plan.moves.length) return false;
      replanned = false;
      return move(plan.moves[step]);
    }

    function nextStage() {
      stop();
      if (step >= plan.moves.length) return;
      var end = stageAt(step).end;
      replanned = false;
      while (step < end) move(plan.moves[step]);
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
      playButton.textContent = 'Play';
    }

    function play() {
      if (timer) { stop(); return; }
      if (step >= plan.moves.length) return;
      playButton.textContent = 'Pause';
      timer = setInterval(function () {
        if (!nextMove()) stop();
        else if (step >= plan.moves.length) stop();
      }, 140);
    }

    sizeSelect.addEventListener('change', function () { stop(); build(); shuffle(); });
    methodSelect.addEventListener('change', function () { stop(); replanned = false; replan(); draw(); });
    $('#tr-shuffle').addEventListener('click', shuffle);
    $('#tr-move').addEventListener('click', function () { stop(); nextMove(); });
    $('#tr-stage').addEventListener('click', nextStage);
    playButton.addEventListener('click', play);

    build();
    shuffle();
  }

  /* ---------- 6. How long are the routes? ---------- */

  function Compare() {
    var table = $('#hc-table');
    if (!table) return;
    var body = table.querySelector('tbody'), progress = $('#hc-progress');
    var sizeSelect = $('#hc-size'), runButton = $('#hc-run');
    var COUNTS = { 3: 200, 4: 100, 5: 40, 6: 12 };
    var token = 0;

    function summarise(lengths) {
      var total = 0, low = Infinity, high = 0;
      lengths.forEach(function (n) { total += n; if (n < low) low = n; if (n > high) high = n; });
      return { average: total / lengths.length, low: low, high: high };
    }

    function render(series, size) {
      body.textContent = '';
      var quick = series.quick.length ? summarise(series.quick).average : null;
      [['Rows, then column pairs', series.rows], ['Peel an L', series.peel],
       ['Quick (weighted A*)', series.quick], ['Shortest (IDA*)', series.shortest]].forEach(function (entry) {
        if (!entry[1].length) return;
        var s = summarise(entry[1]), tr = make('tr');
        tr.appendChild(make('th', null, entry[0])).scope = 'row';
        tr.appendChild(make('td', 'num', s.average.toFixed(1)));
        tr.appendChild(make('td', 'num', nf.format(s.low)));
        tr.appendChild(make('td', 'num', nf.format(s.high)));
        tr.appendChild(make('td', 'num', quick && entry[1] !== series.quick
          ? (s.average / quick >= 1 ? '+' : '−') + Math.abs(Math.round(100 * (s.average / quick - 1))) + '%' : ''));
        body.appendChild(tr);
      });
    }

    function run() {
      var mine = ++token, size = Number(sizeSelect.value), total = COUNTS[size], done = 0;
      var series = { rows: [], peel: [], quick: [], shortest: [] };
      runButton.disabled = true;

      function next() {
        if (mine !== token) return;
        if (done >= total) {
          progress.textContent = 'Done: ' + total + ' random ' + size + ' × ' + size + ' boards.';
          runButton.disabled = false;
          return;
        }
        var b = S.randomBoard(size, size);
        series.rows.push(H.solve(b, size, size, 'rows').moves.length);
        series.peel.push(H.solve(b, size, size, 'peel').moves.length);
        series.quick.push(S.solve(b, size, size, 'quick').moves.length);
        if (size === 3) series.shortest.push(S.solve(b, size, size, 'optimal').moves.length);
        done++;
        progress.textContent = 'Solved ' + done + ' of ' + total + ' boards…';
        render(series, size);
        setTimeout(next, 0);
      }
      next();
    }

    runButton.addEventListener('click', run);
    sizeSelect.addEventListener('change', function () { token++; runButton.disabled = false; progress.textContent = ''; body.textContent = ''; });
  }

  // Two example 4 x 4 boards, chosen so that the stage for the last two tiles
  // of the first row shows the trick at work: one ordinary, one awkward.
  var ORDINARY = [3, 10, 5, 14, 12, 1, 4, 8, 7, 13, 15, 11, 9, 0, 2, 6];
  var AWKWARD = [0, 8, 1, 2, 7, 13, 10, 4, 11, 9, 14, 15, 6, 3, 12, 5];

  orderMap($('#map-rows'), 6, 'rows');
  orderMap($('#map-peel'), 6, 'peel');
  frames($('#frames-normal'), ORDINARY);
  frames($('#frames-awkward'), AWKWARD);
  Trainer();
  Compare();
})();
