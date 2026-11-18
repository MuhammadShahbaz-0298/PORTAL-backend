// Email verification flow.

const crypto = require("crypto");
const User = require("../models/User");
const { AppError } = require("../utils/errors");
const { sendMail } = require("../utils/mailer");
const { hashRefreshToken } = require("./tokenService");

const VERIFICATION_TOKEN_HOURS = Number(process.env.EMAIL_VERIFICATION_TOKEN_HOURS) || 24;

async function sendVerificationEmail({ userId }) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashRefreshToken(rawToken);

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_HOURS * 60 * 60 * 1000);
  await user.save();

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyLink = `${frontendUrl}/verify-email?token=${rawToken}`;

  try {
    await sendMail({
      to: user.email,
      subject: "Verify your email address",
      text: `Verify your email using this link: ${verifyLink}\n\nThis link expires in ${VERIFICATION_TOKEN_HOURS} hours.`,
    });
  } catch {
    // Email failure must not block registration.
  }

  return { message: "Verification email sent." };
}

async function verifyEmail({ token }) {
  if (!token || typeof token !== "string") {
    throw new AppError("Verification token is required.", 400);
  }

  const hashedToken = hashRefreshToken(token);
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: new Date() },
  }).select("+emailVerificationToken");

  if (!user) {
    throw new AppError("Invalid or expired verification token.", 400);
  }

  user.emailVerified = true;
  user.emailVerificationToken = null;
  user.emailVerificationExpires = null;
  await user.save();

  return { message: "Email verified successfully." };
}

module.exports = { sendVerificationEmail, verifyEmail };
