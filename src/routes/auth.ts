import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { getAuthenticatedUser, loginUser, registerUser, resendResetLink, resendVerificationOtp, resetPassword, sendResetLink, verifyOtp } from "../handlers/auth.ts";
import { authLimiter } from "../lib/rateLimiter.ts";

const router: IRouter = Router();

router.use(authLimiter);

router.post("/auth/signup", registerUser);

router.post("/auth/verify-otp", verifyOtp);

router.post("/auth/resend-otp", resendVerificationOtp);

router.post("/auth/login", loginUser);

router.post("/auth/reset-password/:token", sendResetLink);

router.patch("/auth/reset-password/confirm", resetPassword);

router.post("/auth/resend-reset", resendResetLink);

// router.patch("/auth/update-password", updatePassword);

router.get("/auth/me", requireAuth, getAuthenticatedUser);

export default router;
