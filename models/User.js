// A user of the portal: admin, teacher or student.
// The password hash is never selected by default, so it cannot leak by accident.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { NAME_MAX_LENGTH, EMAIL_MAX_LENGTH, PASSWORD_MIN_LENGTH } = require("../constants");
const { ROLES } = require("../constants");

const BCRYPT_ROUNDS = 10;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: NAME_MAX_LENGTH,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: EMAIL_MAX_LENGTH,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      minlength: PASSWORD_MIN_LENGTH,
      select: false,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      enum: Object.values(ROLES),
    },
    // Extra permissions on top of the role. Only admins may change this.
    permissions: { type: [String], default: [] },
    // Set by an admin password reset; cleared after the user changes it.
    mustChangePassword: { type: Boolean, default: false },
    // Soft delete: inactive users stay in the database but cannot log in.
    active: { type: Boolean, default: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true },
);

// These filters are used by login, user lists and permission lookups.
userSchema.index({ role: 1, active: 1 });
userSchema.index({ name: 1 });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const value = this.toObject();
  delete value.password;
  return value;
};

module.exports = mongoose.model("User", userSchema);
