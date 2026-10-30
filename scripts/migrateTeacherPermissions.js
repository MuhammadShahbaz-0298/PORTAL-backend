// Adds the new teacher permissions to existing teacher roles.
// Dry run by default. To write: node scripts/migrateTeacherPermissions.js --apply --i-have-a-backup

require("dotenv").config();

const mongoose = require("mongoose");
const Role = require("../models/Role");
const { ROLES } = require("../constants");
const { TEACHER_MIGRATION_PERMISSIONS } = require("../config/permissions");
const { parseScriptArguments, refuseUnsafeApply } = require("./cleanHelpers");

async function main() {
  const options = parseScriptArguments();
  refuseUnsafeApply(options);
  await mongoose.connect(process.env.MONGO_URI);

  const teacherRole = await Role.findOne({ name: ROLES.TEACHER });

  if (!teacherRole) {
    console.info("No teacher role found. Nothing to migrate.");
    await mongoose.disconnect();
    return;
  }

  const missingPermissions = TEACHER_MIGRATION_PERMISSIONS.filter(
    (permission) => !teacherRole.permissions.includes(permission),
  );

  console.info(`Mode: ${options.apply ? "APPLY" : "DRY RUN"}`);

  if (missingPermissions.length === 0) {
    console.info("Teacher role already has every required permission.");
    await mongoose.disconnect();
    return;
  }

  console.info("Teacher role is missing:");
  for (const permission of missingPermissions) {
    console.info(`  - ${permission}`);
  }

  if (options.apply) {
    for (const permission of missingPermissions) {
      await Role.updateOne({ _id: teacherRole._id }, { $addToSet: { permissions: permission } });
    }
    console.info("Teacher role updated.");
  } else {
    console.info("Dry run only. Add --apply --i-have-a-backup to write.");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
