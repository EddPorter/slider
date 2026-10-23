// Runs the solver off the main thread so the page stays responsive.
importScripts('solver.js');

self.onmessage = function (event) {
  var job = event.data;
  var result = Slider.solve(job.board, job.rows, job.cols, job.mode, {
    onProgress: function (progress) {
      self.postMessage({ type: 'progress', bound: progress.bound, nodes: progress.nodes });
    }
  });
  self.postMessage({ type: 'done', result: result });
};
