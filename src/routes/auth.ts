import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { getAuthenticatedUser, loginUser, registerUser, resendResetLink, resetPassword, sendResetLink } from "../handlers/auth.ts";

const router: IRouter = Router();

router.post("/auth/signup", registerUser);

router.post("/auth/login", loginUser);

router.post("/auth/reset-password", sendResetLink);

router.patch("/auth/reset-password/confirm", resetPassword);

router.post("/auth/resend-reset-link", resendResetLink);

// router.patch("/auth/update-password", updatePassword);

router.get("/auth/me", requireAuth, getAuthenticatedUser);

export default router;
