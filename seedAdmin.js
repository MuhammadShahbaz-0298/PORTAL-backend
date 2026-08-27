// One-time script to create the very first admin account, since /api/auth/register
// now requires an admin token — someone has to exist before that route is usable.
//
// Usage:  node seedAdmin.js "Admin Name" admin@example.com somePassword123
//
// Run this once, then delete or ignore this file. Do not expose it as an API route.

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node seedAdmin.js "Admin Name" admin@example.com password123');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('A user with that email already exists.');
    process.exit(0);
  }

  const admin = await User.create({ name, email, password, role: 'admin' });
  console.log(`Admin created: ${admin.email}`);
  process.exit(0);
})();
