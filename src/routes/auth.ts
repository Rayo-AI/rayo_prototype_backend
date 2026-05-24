import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { getAuthenticatedUser, loginUser, registerUser, resendResetLink, resendVerificationOtp, resetPassword, sendResetLink, verifyOtp, googleOAuthCallback, uploadProfileImage } from "../handlers/auth.ts";
import { parseFormBody, uploadSingleImage } from "../lib/multer.ts";
import { authLimiter, signupLimiter } from "../lib/rateLimiter.ts";
import passport from "../../db/google.ts";
import ENV from "../../db/env.ts";

const router: IRouter = Router();

// Signup has stricter limiter
router.post("/auth/signup", signupLimiter, parseFormBody, registerUser);

// Auth operations use standard auth limiter
router.post("/auth/verify-otp", authLimiter, parseFormBody, verifyOtp);

router.post("/auth/resend-otp", authLimiter, parseFormBody, resendVerificationOtp);

router.post("/auth/login", authLimiter, parseFormBody, loginUser);

// 1. Start OAuth flow — capture frontend URLs in the OAuth state param
//    Google will return this state unchanged in the callback
router.get("/auth/google", (req, res, next) => {
  const redirectUrl = (req.query.redirectUrl as string) || ENV.URL.FRONTEND + "/dashboard";
  const errorUrl   = (req.query.errorUrl   as string) || ENV.URL.FRONTEND + "/auth/login";

  // Encode both URLs as a JSON state string
  const state = Buffer.from(JSON.stringify({ redirectUrl, errorUrl })).toString("base64");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    session: false,
  })(req, res, next);
});

// 2. Google OAuth callback — Passport authenticates, then our handler redirects
router.get(
  "/auth/google/callback",
  (req, res, next) => {
    // Decode state so we know where to send errors
    const state = req.query.state as string | undefined;
    let errorUrl = ENV.URL.FRONTEND + "/auth/login";

    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString());
        errorUrl = decoded.errorUrl || errorUrl;
      } catch {}
    }

    passport.authenticate("google", {
      session: false,
      failureRedirect: `${errorUrl}?error=oauth_failed`,
    })(req, res, next);
  },
  googleOAuthCallback
);

router.post("/auth/reset-password/", authLimiter, parseFormBody, sendResetLink);

router.patch("/auth/reset-password/:token", authLimiter, parseFormBody, resetPassword);

router.post("/auth/resend-reset", authLimiter, parseFormBody, resendResetLink);

router.get("/auth/me", requireAuth, getAuthenticatedUser);

router.post("/auth/upload-image", requireAuth, uploadSingleImage, uploadProfileImage);

export default router;
