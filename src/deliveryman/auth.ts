import test from "node:test";
import { AuthSignupBody, AuthLoginBody, AuthLoginResponse, AuthMeResponse, AuthResetPasswordBody, AuthResetPasswordResponse, AuthUpdatePasswordBody } from "../../validation/index.ts";
import { createToken, createTokenWithCustomExpiry, hashPassword } from "../lib/auth.ts";
import { logger } from "../lib/logger.ts";
import { AuthUseCase } from "../usecases/auth.ts";
import { appResponse } from "../utils/appResponse.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import e from "express";

export const registerUser = asyncHandler(async (req, res) => {
  const parsed = AuthSignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({error: parsed.error!});
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const existing = await AuthUseCase.findUserByEmail(email);
    if (existing) {
      logger.warn(`Attempt to register with existing email: ${email}`);
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const newUser = await AuthUseCase.signup(name, email, passwordHash);
    if (!newUser) {
      logger.error(`Failed to create user for email: ${email}`);
      res.status(500).json({ error: "Failed to create user" });
      return;
    }
    logger.info(`New user registered: ${email} (ID: ${newUser.id})`);
    const token = createToken({ userId: newUser.id });
    return appResponse(res, 201, AuthLoginResponse.parse({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } }));
  } catch (err: any) {
    logger.error({ err }, "Signup error:", err?.message || "Unknown error"); // <-- this will show the real DB error
    res.status(500).json({ error: "Internal server error" });
  }
});

export const loginUser = asyncHandler(async (req, res) => {
  const parsed = AuthLoginBody.safeParse(req.body);

  if (!parsed.success) {
    throw res.status(400).json({ error: parsed.error.message })
  }

  const { email, password } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);

  if (!user || user.passwordHash !== await hashPassword(password)) {
    throw res.status(401).json({ error: "Invalid credentials" })
  }

  const token = createToken({ userId: user.id });
  return appResponse(res, 200, AuthLoginResponse.parse({ token, user: { id: user.id, name: user.name, email: user.email } }));
});

export const getAuthenticatedUser = asyncHandler(async (req, res) => {
  const userId = req.id as number;

  const user = await AuthUseCase.findUserById(userId);

  if (!user) {
    throw res.status(401).json({ error: "User not found" });
  }

  return appResponse(res, 200, AuthMeResponse.parse({ id: user.id, name: user.name, email: user.email }))
});

export const sendResetLink = asyncHandler(async (req, res) => {
  const parsed = AuthResetPasswordBody.safeParse(req.body);

  if (!parsed.success) {
    throw res.status(400).json({ error: parsed.error.message })
  }

  const { email } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`Password reset requested for non-existent email: ${email}`);
    return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
  }
  
  const resetToken = await createTokenWithCustomExpiry({ userId: user.id }, "15m"); // token valid for 15 minutes

  await AuthUseCase.updateUser({ id: user.id, resetToken, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000) });
  // TODO: Send resetToken via email to user.email with a link to the frontend reset page
  logger.info(`Password reset link generated for user: ${user.email} (ID: ${user.id} resetToken: ${resetToken})`);
  // TODO: Remove the resetToken from the response in production, it's only included here for testing purposes
  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }), resetToken);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const parsed = AuthUpdatePasswordBody.safeParse(req.body);

  if (!parsed.success) {
    throw res.status(400).json({ error: parsed.error.message })
  }

  const { token, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    logger.warn(`Password reset failed due to password mismatch for token: ${token}`);
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const user = await AuthUseCase.findUserByToken(token);
  if (!user) {
    logger.warn(`Password reset requested for non-existent user: ${token}`);
    appResponse(res, 409, AuthResetPasswordResponse.parse({ message: "Invalid or expired reset token" }));
    return;
  }

  if (user.resetTokenExpiry && user.resetTokenExpiry.getTime() < Date.now()) {
    logger.warn(`Password reset failed due to expired token for user: ${user.email} (ID: ${user.id})`);
    appResponse(res, 409, AuthResetPasswordResponse.parse({ message: "Invalid or expired reset token" }));
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await AuthUseCase.updateUserPassword(user.id, passwordHash);
  logger.info(`Password updated for user: ${user.email} (ID: ${user.id})`);
  appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "Password has been reset successfully" }));
  return;
});

export const resendResetLink = asyncHandler(async (req, res) => {
  const parsed = AuthResetPasswordBody.safeParse(req.body);

  if (!parsed.success) {
    throw res.status(400).json({ error: parsed.error.message })
  }

  const { email } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`Resend password reset requested for non-existent email: ${email}`);
    return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
  }

  const resetToken = await createTokenWithCustomExpiry({ userId: user.id }, "15m"); // token valid for 15 minutes

  await AuthUseCase.updateUser({ id: user.id, resetToken, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000) });

  // TODO: Send resetToken via email to user.email with a link to the frontend reset page
  logger.info(`Password reset link resent for user: ${user.email} (ID: ${user.id} resetToken: ${resetToken})`);
  // TODO: Remove the resetToken from the response in production, it's only included here for testing purposes
  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }), resetToken);
});
