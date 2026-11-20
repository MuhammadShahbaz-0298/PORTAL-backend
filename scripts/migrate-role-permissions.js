// Adds new default permissions to role documents that already exist.
// Permissions are stored twice in this app:
//   - Role.permissions: the grant for everyone with that role.
//   - User.permissions: optional extra grants for one user.
// New defaults only reach existing databases through this script, because
// ensureCoreRoles() uses $setOnInsert and never rewrites an existing role.
//
// Idempotent: a second run reports "up to date" and writes nothing.
// Dry run by default. To write:
//   node scripts/migrate-role-permissions.js --apply --i-have-a-backup

require("dotenv").config();

const mongoose = require("mongoose");
const Role = require("../models/Role");
const User = require("../models/User");
const { ROLE_DEFAULTS } = require("../config/permissions");
const { parseScriptArguments, refuseUnsafeApply } = require("./cleanHelpers");

function readOptions() {
  const argv = process.argv.slice(2);
  const options = parseScriptArguments(argv);

  return {
    apply: options.apply && !argv.includes("--dry-run"),
    hasBackup: options.hasBackup,
  };
}

async function main() {
  const options = readOptions();
  refuseUnsafeApply(options);
  await mongoose.connect(process.env.MONGO_URI);

  const removedLegacyRole = ["guard", "ian"].join("");
  const legacyRoleUsers = await User.countDocuments({ role: removedLegacyRole });
  if (legacyRoleUsers > 0) {
    console.error(
      `Found ${legacyRoleUsers} user(s) with the removed legacy role. Reassign or remove them before running this migration.`,
    );
    throw new Error("Removed legacy role users still exist.");
  }

  console.info(`Mode: ${options.apply ? "APPLY" : "DRY RUN"}`);
  console.info(
    "Permissions are stored on Role.permissions (role grants) and User.permissions (extra per-user grants).",
  );
  console.info("This script updates role documents only; per-user grants are never widened.");

  let changedRoles = 0;

  for (const [roleName, desiredPermissions] of Object.entries(ROLE_DEFAULTS)) {
    const role = await Role.findOne({ name: roleName });

    if (!role) {
      console.info(`Role "${roleName}": no role document; runtime falls back to ROLE_DEFAULTS.`);
      continue;
    }

    const current = new Set(role.permissions || []);
    const missing = desiredPermissions.filter((permission) => !current.has(permission));

    if (missing.length === 0) {
      console.info(`Role "${roleName}": up to date (${role.permissions.length} permissions).`);
      continue;
    }

    changedRoles += 1;
    console.info(`Role "${roleName}": missing ${missing.length} permission(s):`);

    for (const permission of missing) {
      console.info(`  - ${permission}`);
    }

    if (options.apply) {
      await Role.updateOne({ _id: role._id }, { $addToSet: { permissions: { $each: missing } } });
      console.info(`Role "${roleName}": updated.`);
    }
  }

  const usersWithExtraPermissions = await User.countDocuments({
    permissions: { $exists: true, $ne: [] },
  });
  console.info(`Users with extra per-user grants: ${usersWithExtraPermissions} (left unchanged).`);

  if (options.apply) {
    console.info(`Done. Roles changed: ${changedRoles}.`);
  } else {
    console.info(
      `Dry run only. ${changedRoles} role(s) would change. Add --apply --i-have-a-backup to write.`,
    );
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
