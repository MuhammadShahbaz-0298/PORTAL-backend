// A role is a named group of permissions. The three core roles are always present,
// but admins may create custom roles with any valid permission list.

const mongoose = require("mongoose");
const { ROLE_NAME_MAX_LENGTH } = require("../constants");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: ROLE_NAME_MAX_LENGTH,
    },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    permissions: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, strict: true },
);

roleSchema.index({ active: 1 });

module.exports = mongoose.model("Role", roleSchema);
