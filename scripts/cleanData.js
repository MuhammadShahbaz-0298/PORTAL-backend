// Cleans and normalizes existing data.
// Dry run by default. To write: node scripts/cleanData.js --apply --i-have-a-backup
// This script never deletes records. Orphans and duplicates are reported only.

require("dotenv").config();

const mongoose = require("mongoose");
const { createChangeTracker, parseScriptArguments, refuseUnsafeApply } = require("./cleanHelpers");
const {
  normalizeUsers,
  normalizeBatches,
  normalizeEnrollments,
  normalizeAssignments,
  normalizeAttendance,
  normalizeSubmissions,
  reportOrphans,
} = require("./cleanRecords");

async function main() {
  const options = parseScriptArguments();
  refuseUnsafeApply(options);

  console.info(`Mode: ${options.apply ? "APPLY" : "DRY RUN"}`);
  console.info("Reminder: take a mongodump backup before any --apply run.");
  console.info("Nothing is deleted by this script.\n");

  await mongoose.connect(process.env.MONGO_URI);
  const tracker = createChangeTracker();

  await normalizeUsers({ apply: options.apply, tracker });
  await normalizeBatches({ apply: options.apply, tracker });
  await normalizeEnrollments({ apply: options.apply, tracker });
  await normalizeAssignments({ apply: options.apply, tracker });
  await normalizeAttendance({ apply: options.apply, tracker });
  await normalizeSubmissions({ apply: options.apply, tracker });
  await reportOrphans({ tracker });

  tracker.print();

  if (!options.apply) {
    console.info("\nDry run only. Nothing was written.");
    console.info("To write: node scripts/cleanData.js --apply --i-have-a-backup");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
