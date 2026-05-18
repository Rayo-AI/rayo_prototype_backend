import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { getAuthenticatedUser, loginUser, registerUser, resendResetLink, resendVerificationOtp, resetPassword, sendResetLink, verifyOtp, googleOAuthCallback, uploadProfileImage } from "../handlers/auth.ts";
import { uploadSingleImage } from "../lib/multer.ts";
import { authLimiter, signupLimiter } from "../lib/rateLimiter.ts";
import passport from "../../db/google.ts";

const router: IRouter = Router();

// Signup has stricter limiter
router.post("/auth/signup", signupLimiter, registerUser);

// Auth operations use standard auth limiter
router.post("/auth/verify-otp", authLimiter, verifyOtp);

router.post("/auth/resend-otp", authLimiter, resendVerificationOtp);

router.post("/auth/login", authLimiter, loginUser);

// Google OAuth routes
// 1. Start OAuth flow - redirects user to Google
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// 2. Google OAuth callback - handled by Passport first, then our handler
router.get("/auth/google/callback", passport.authenticate("google", { session: false, failureRedirect: "/login" }), googleOAuthCallback);

router.post("/auth/reset-password/:token", authLimiter, sendResetLink);

router.patch("/auth/reset-password/confirm", authLimiter, resetPassword);

router.post("/auth/resend-reset", authLimiter, resendResetLink);

router.get("/auth/me", requireAuth, getAuthenticatedUser);

router.post("/auth/upload-image", requireAuth, uploadSingleImage, uploadProfileImage);

export default router;
