// Routes for SSO (Google OAuth).

const express = require("express");
const { configurePassport, passport } = require("../services/ssoService");

configurePassport();

const router = express.Router();

router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (request, response) => {
    // On success, issue tokens and redirect.
    response.json({ user: request.user });
  },
);

module.exports = router;
