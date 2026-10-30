// Validation and field mapping for assignments.
// Kept separate so the service file only contains queries and ownership rules.

const { RESUBMISSION_POLICIES, MAX_FILE_SIZE_MB_LIMIT } = require("../constants");
const {
  assertArrayOfStrings,
  assertBoolean,
  assertDate,
  assertEnum,
  assertNumber,
  assertOptionalString,
  assertString,
  pickFields,
} = require("../utils/validation");

const CREATE_FIELDS = [
  "batch",
  "title",
  "description",
  "dueDate",
  "allowedFileTypes",
  "maxFileSizeMb",
  "resubmissionPolicy",
];

const UPDATE_FIELDS = [
  "title",
  "description",
  "dueDate",
  "allowedFileTypes",
  "maxFileSizeMb",
  "resubmissionPolicy",
  "active",
];

function isExpired(assignment, now = Date.now()) {
  return assignment.dueDate.getTime() <= now;
}

function validateFileTypes(value) {
  const fileTypes = assertArrayOfStrings(value, "allowedFileTypes", {
    allowedValues: ["zip"],
    maxItems: 5,
    maxLength: 10,
  });

  if (fileTypes.length === 0) {
    return ["zip"];
  }

  return fileTypes;
}

function buildCreateFields({ batchId, payload, createdBy }) {
  const fields = pickFields(payload, CREATE_FIELDS);

  return {
    batch: batchId,
    title: assertString(fields.title, "title", { maxLength: 160 }),
    description: assertOptionalString(fields.description, "description", {
      allowEmpty: true,
      maxLength: 5000,
    }),
    dueDate: assertDate(fields.dueDate, "dueDate"),
    allowedFileTypes: validateFileTypes(fields.allowedFileTypes || ["zip"]),
    maxFileSizeMb: assertNumber(fields.maxFileSizeMb ?? 25, "maxFileSizeMb", {
      min: 1,
      max: MAX_FILE_SIZE_MB_LIMIT,
    }),
    resubmissionPolicy: assertEnum(
      fields.resubmissionPolicy || "allowed",
      RESUBMISSION_POLICIES,
      "resubmissionPolicy",
    ),
    createdBy,
  };
}

function applyUpdateFields(assignment, payload) {
  const fields = pickFields(payload, UPDATE_FIELDS);

  if (fields.title !== undefined) {
    assignment.title = assertString(fields.title, "title", { maxLength: 160 });
  }

  if (fields.description !== undefined) {
    assignment.description = assertOptionalString(fields.description, "description", {
      allowEmpty: true,
      maxLength: 5000,
    });
  }

  if (fields.dueDate !== undefined) {
    assignment.dueDate = assertDate(fields.dueDate, "dueDate");
  }

  if (fields.allowedFileTypes !== undefined) {
    assignment.allowedFileTypes = validateFileTypes(fields.allowedFileTypes);
  }

  if (fields.maxFileSizeMb !== undefined) {
    assignment.maxFileSizeMb = assertNumber(fields.maxFileSizeMb, "maxFileSizeMb", {
      min: 1,
      max: MAX_FILE_SIZE_MB_LIMIT,
    });
  }

  if (fields.resubmissionPolicy !== undefined) {
    assignment.resubmissionPolicy = assertEnum(
      fields.resubmissionPolicy,
      RESUBMISSION_POLICIES,
      "resubmissionPolicy",
    );
  }

  if (fields.active !== undefined) {
    assignment.active = assertBoolean(fields.active, "active");
    assignment.closedAt = assignment.active ? null : new Date();
  }

  return assignment;
}

module.exports = {
  applyUpdateFields,
  buildCreateFields,
  isExpired,
  validateFileTypes,
};
