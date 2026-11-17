// A tiny in-memory queue. It keeps AI calls from all running at once.
// This is enough for one server; a real job queue would be needed for many copies.

function createQueue(limit) {
  let activeCount = 0;
  const waiting = [];

  function startNext() {
    if (activeCount >= limit || waiting.length === 0) {
      return;
    }

    const job = waiting.shift();
    activeCount += 1;

    Promise.resolve()
      .then(job.task)
      .then(job.resolve, job.reject)
      .finally(() => {
        activeCount -= 1;
        startNext();
      });
  }

  return function enqueue(task) {
    return new Promise((resolve, reject) => {
      waiting.push({ task, resolve, reject });
      startNext();
    });
  };
}

module.exports = { createQueue };
