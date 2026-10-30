// Creates the very first admin account.
// All values come from environment variables. The password is never read from argv.

require("dotenv").config();

const mongoose = require("mongoose");
const User = require("./models/User");
const { ROLES, NAME_MAX_LENGTH } = require("./constants");
const { assertEmail, assertPassword, assertString } = require("./utils/validation");

function readAdminDetails() {
  if (!process.env.ADMIN_NAME || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  }

  return {
    name: assertString(process.env.ADMIN_NAME, "admin name", { maxLength: NAME_MAX_LENGTH }),
    email: assertEmail(process.env.ADMIN_EMAIL),
    password: assertPassword(process.env.ADMIN_PASSWORD, "Admin password"),
  };
}

async function main() {
  const details = readAdminDetails();
  await mongoose.connect(process.env.MONGO_URI);

  const existingUser = await User.findOne({ email: details.email });
  if (existingUser) {
    console.info("A user with that email already exists.");
    await mongoose.disconnect();
    return;
  }

  const admin = await User.create({
    name: details.name,
    email: details.email,
    password: details.password,
    role: ROLES.ADMIN,
    active: true,
  });

  console.info(`Admin created: ${admin.email}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
