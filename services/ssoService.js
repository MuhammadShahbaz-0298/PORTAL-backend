// SSO via Google OAuth. Alternate login path; never removes existing email/password auth.

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const { ROLES } = require("../constants");

function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/sso/google/callback";

  if (!clientID || !clientSecret) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error("No email from Google profile."));
          }

          let user = await User.findOne({ email: email.toLowerCase() });

          if (!user) {
            // Create a user the same way registrationService does.
            user = await User.create({
              name: profile.displayName || email,
              email: email.toLowerCase(),
              password: require("crypto").randomBytes(32).toString("hex"),
              role: ROLES.STUDENT,
              active: true,
            });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
}

module.exports = { configurePassport, passport };
