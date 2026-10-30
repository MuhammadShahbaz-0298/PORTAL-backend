// Shared helpers for the data scripts.
// Every write is counted and printed, so a dry run is easy to read.

const mongoose = require("mongoose");

function parseScriptArguments(argv = process.argv.slice(2)) {
  return {
    apply: argv.includes("--apply"),
    hasBackup: argv.includes("--i-have-a-backup"),
    allowProduction: argv.includes("--allow-production"),
  };
}

function refuseUnsafeApply(argumentsValue) {
  if (!argumentsValue.apply) {
    return;
  }

  if (!argumentsValue.hasBackup) {
    throw new Error("Refusing to write. Take a mongodump backup, then add --i-have-a-backup.");
  }
}

function createChangeTracker() {
  const counts = new Map();

  return {
    record(label, amount = 1) {
      counts.set(label, (counts.get(label) || 0) + amount);
    },
    print() {
      console.info("\nSummary:");
      if (counts.size === 0) {
        console.info("  No changes needed.");
        return;
      }

      for (const [label, amount] of counts) {
        console.info(`  ${label}: ${amount}`);
      }
    },
  };
}

function toObjectIdOrNull(value) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === "string" && mongoose.isValidObjectId(value)) {
    return new mongoose.Types.ObjectId(value);
  }

  return null;
}

function toDateOrNull(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function toNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return null;
}

function cleanString(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim();
}

function hasChanges(update) {
  return Object.keys(update).length > 0;
}

async function applyUpdate({ apply, model, filter, update, label, tracker }) {
  tracker.record(label);

  if (apply) {
    await model.updateOne(filter, update, { runValidators: false });
  }
}

module.exports = {
  applyUpdate,
  cleanString,
  createChangeTracker,
  hasChanges,
  parseScriptArguments,
  refuseUnsafeApply,
  toDateOrNull,
  toNumberOrNull,
  toObjectIdOrNull,
};
