const { AsyncLocalStorage } = require('async_hooks');

// Keeps the trace id of the current request available to any code that runs
// for it (logger, repositories, chaos switch) without passing it around.
const storage = new AsyncLocalStorage();

const runWithContext = (context, callback) => storage.run(context, callback);

const getContext = () => storage.getStore() || {};

module.exports = {
  runWithContext,
  getContext
};
