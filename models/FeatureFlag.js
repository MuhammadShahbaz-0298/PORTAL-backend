// A feature flag toggles a feature on or off at runtime.
// Stored in the database so it can be changed without a deploy.

const mongoose = require("mongoose");

const featureFlagSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    enabled: { type: Boolean, default: false },
    description: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, strict: true },
);

module.exports = mongoose.model("FeatureFlag", featureFlagSchema);
