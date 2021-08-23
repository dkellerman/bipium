let timerID = null;
let interval = 0.25;

/* eslint-disable-next-line */
self.onmessage = function (e) {
  if (e.data === 'start') {
    timerID = setInterval(function () {
      postMessage('tick');
    }, interval * 1000);
    postMessage('tick');
  } else if (e.data.interval) {
    interval = e.data.interval;
    if (timerID) {
      clearInterval(timerID);
      timerID = setInterval(function () {
        postMessage('tick');
      }, interval * 1000);
    }
  } else if (e.data === 'stop') {
    clearInterval(timerID);
    timerID = null;
  }
};
