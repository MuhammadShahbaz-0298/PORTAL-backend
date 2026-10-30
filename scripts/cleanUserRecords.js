// Normalizes user records and reports duplicate emails.
// Never deletes a user; duplicates are printed for a human to resolve.

const User = require("../models/User");
const { ROLES } = require("../constants");
const { applyUpdate, cleanString, hasChanges } = require("./cleanHelpers");

async function normalizeUsers({ apply, tracker }) {
  const users = await User.find().lean();
  const groups = new Map();

  for (const user of users) {
    const email = String(user.email || "")
      .trim()
      .toLowerCase();
    if (!email) {
      tracker.record("users with missing email (reported)");
      continue;
    }

    const group = groups.get(email) || [];
    group.push(user);
    groups.set(email, group);
  }

  for (const [email, group] of groups) {
    if (group.length > 1) {
      tracker.record("duplicate user emails (reported, not merged)");
      console.info(`  duplicate email: ${email} (${group.length} users)`);
    }
  }

  for (const user of users) {
    const update = {};
    const email = String(user.email || "")
      .trim()
      .toLowerCase();
    const name = cleanString(user.name);
    const role = String(user.role || "")
      .trim()
      .toLowerCase();

    if (email && groups.get(email)?.length === 1 && email !== user.email) {
      update.email = email;
    }

    if (name && name !== user.name) {
      update.name = name;
    }

    if (Object.values(ROLES).includes(role) && role !== user.role) {
      update.role = role;
    }

    if (typeof user.active !== "boolean") {
      update.active = true;
    }

    if (!Array.isArray(user.permissions)) {
      update.permissions = [];
    }

    if (user.active === false && !user.archivedAt) {
      update.archivedAt = new Date();
    }

    if (hasChanges(update)) {
      await applyUpdate({
        apply,
        model: User,
        filter: { _id: user._id },
        update: { $set: update },
        label: "users normalized",
        tracker,
      });
    }
  }
}

module.exports = { normalizeUsers };
