// Self-service password reset via email.
// Reuses tokenService patterns (random token, hashed in DB).

const crypto = require("crypto");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { sendMail } = require("../utils/mailer");
const { assertPassword } = require("../utils/validation");
const { hashRefreshToken } = require("./tokenService");

const RESET_TOKEN_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_MINUTES) || 30;

async function requestReset({ email }) {
  const user = await User.findOne({
    email: String(email || "")
      .trim()
      .toLowerCase(),
  });

  // Always return success to avoid email enumeration.
  if (!user || !user.active) {
    return { message: "If an account exists, a reset link has been sent." };
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashRefreshToken(rawToken);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

  try {
    await sendMail({
      to: user.email,
      subject: "Reset your password",
      text: `Reset your password using this link: ${resetLink}\n\nThis link expires in ${RESET_TOKEN_MINUTES} minutes.`,
    });
  } catch {
    // Email failure must not reveal whether the account exists.
  }

  return { message: "If an account exists, a reset link has been sent." };
}

async function consumeReset({ token, newPassword }) {
  if (!token || typeof token !== "string") {
    throw new AppError("Reset token is required.", 400);
  }

  const validatedPassword = assertPassword(newPassword, "New password");

  const hashedToken = hashRefreshToken(token);
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  }).select("+passwordResetToken");

  if (!user) {
    throw new AppError("Invalid or expired reset token.", 400);
  }

  user.password = validatedPassword;
  user.mustChangePassword = false;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  return { message: "Password reset successfully." };
}

module.exports = { requestReset, consumeReset };
