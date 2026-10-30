// Public session API.
// Code outside this module imports from here, so the storage split stays internal.

const sessionStore = require("./sessionStore");
const sessionLifecycle = require("./sessionLifecycle");

module.exports = {
  ...sessionStore,
  ...sessionLifecycle,
};
