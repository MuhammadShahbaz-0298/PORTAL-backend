// TOTP 2FA using otplib. Secret is stored with select: false on User.

const { authenticator } = require("otplib");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { getUserId } = require("../utils/authorization");

async function setupTwoFactor({ requester }) {
  const userId = getUserId(requester);
  const user = await User.findById(userId).select("+twoFactorSecret");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const secret = authenticator.generateSecret();
  user.twoFactorSecret = secret;
  await user.save();

  const otpauthUrl = authenticator.keyuri(user.email, "School Portal", secret);

  return { secret, otpauthUrl };
}

async function verifyTwoFactor({ requester, code }) {
  const userId = getUserId(requester);
  const user = await User.findById(userId).select("+twoFactorSecret");

  if (!user || !user.twoFactorSecret) {
    throw new AppError("2FA setup not started.", 400);
  }

  const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });

  if (!isValid) {
    throw new AppError("Invalid 2FA code.", 400);
  }

  user.twoFactorEnabled = true;
  await user.save();

  return { message: "2FA enabled successfully." };
}

async function disableTwoFactor({ requester }) {
  const userId = getUserId(requester);
  const user = await User.findById(userId).select("+twoFactorSecret");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  user.twoFactorSecret = null;
  user.twoFactorEnabled = false;
  await user.save();

  return { message: "2FA disabled." };
}

// Called during login if user.twoFactorEnabled is true.
function verifyCode(secret, code) {
  return authenticator.verify({ token: code, secret });
}

module.exports = {
  setupTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  verifyCode,
};
