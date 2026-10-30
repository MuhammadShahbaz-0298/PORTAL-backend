// Public entry point for the cleanup pass.
// The per-entity logic lives in clean*Records.js; this file only re-exports it.

module.exports = {
  ...require("./cleanUserRecords"),
  ...require("./cleanBatchRecords"),
  ...require("./cleanAssignmentRecords"),
  ...require("./cleanAttendanceRecords"),
  ...require("./cleanSubmissionRecords"),
  ...require("./cleanOrphanReport"),
};
