import { AuthSignupBody, AuthLoginBody, AuthLoginResponse, AuthMeResponse, AuthResetPasswordBody, AuthResetPasswordResponse, AuthUpdatePasswordBody, UpdateMeBody } from "../../validation/index.ts";
import { createToken, createTokenWithCustomExpiry, hashPassword, comparePassword } from "../lib/auth.ts";
import { logger } from "../lib/logger.ts";
import { AuthUseCase } from "../usecases/auth.ts";
import { appResponse } from "../utils/appResponse.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { ErrorResponse } from "../utils/errorResponse.ts";

export const registerUser = asyncHandler(async (req, res) => {
  const parsed = AuthSignupBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { name, email, password } = parsed.data;

  const existing = await AuthUseCase.findUserByEmail(email);
  if (existing) {
    logger.warn(`Attempt to register with existing email: ${email}`);
    throw new ErrorResponse("Email already exists", 409);
  }

  const passwordHash = await hashPassword(password);
  const newUser = await AuthUseCase.signup(name, email, passwordHash);
  if (!newUser) {
    logger.error(`Failed to create user for email: ${email}`);
    throw new ErrorResponse("Failed to create user", 500);
  }

  logger.info(`New user registered: ${email} (ID: ${newUser.id})`);
  const token = await createToken({ userId: newUser.id });

  // TODO: In production, we should not reveal whether the email exists or not to prevent user enumeration attacks. We can log the attempt for monitoring purposes but always return a generic error message.
  // TODO: We should also consider implementing email verification to ensure the email belongs to the user and to prevent abuse of the registration endpoint.
  return appResponse(res, 201, AuthLoginResponse.parse({ token, user: { id: newUser.id, name: newUser.name, email: newUser.email } }));
});

export const loginUser = asyncHandler(async (req, res) => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email, password } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  const token = await createToken({ userId: user.id });
  return appResponse(res, 200, AuthLoginResponse.parse({ token, user: { id: user.id, name: user.name, email: user.email } }));
});

export const getAuthenticatedUser = asyncHandler(async (req, res) => {
  const userId = (req as { userId?: number }).userId;
  if (typeof userId !== "number") {
    throw new ErrorResponse("Unauthorized", 401);
  }

  const user = await AuthUseCase.findUserById(userId);
  if (!user) {
    throw new ErrorResponse("User not found", 401);
  }

  return appResponse(res, 200, AuthMeResponse.parse({ id: user.id, name: user.name, email: user.email }));
});

export const sendResetLink = asyncHandler(async (req, res) => {
  const parsed = AuthResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`Password reset requested for non-existent email: ${email}`);
    return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
  }

  const resetToken = await createTokenWithCustomExpiry({ userId: user.id }, "15m");
  await AuthUseCase.updateUser(user.id, { resetToken, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000) });

  // TODO: In production, we should send an actual email with the reset link instead of just logging the token. We can use a service like SendGrid, Mailgun, or Amazon SES for this purpose. The reset link should point to a frontend page where the user can enter their new password along with the token.
  // TODO: We should also consider implementing rate limiting on this endpoint to prevent abuse and potential denial of service attacks.
  // TODO: Remove the resetToken from the response in production, it's only included here for testing purposes
  logger.info(`Password reset link generated for user: ${user.email} (ID: ${user.id} resetToken: ${resetToken})`);
  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const parsed = AuthUpdatePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { token, newPassword, confirmPassword } = parsed.data;

  if (newPassword !== confirmPassword) {
    logger.warn(`Password reset failed due to password mismatch for token: ${token}`);
    throw new ErrorResponse("Passwords do not match", 400);
  }

  const user = await AuthUseCase.findUserByToken(token);
  if (!user) {
    logger.warn(`Password reset requested for non-existent user: ${token}`);
    throw new ErrorResponse("Invalid or expired reset token", 400);
  }

  if (user.resetTokenExpiry && user.resetTokenExpiry.getTime() < Date.now()) {
    logger.warn(`Password reset failed due to expired token for user: ${user.email} (ID: ${user.id})`);
    throw new ErrorResponse("Invalid or expired reset token", 400);
  }

  const passwordHash = await hashPassword(newPassword);
  await AuthUseCase.updateUserPassword(user.id, passwordHash);

  await AuthUseCase.updateUser(user.id, { resetToken: null, resetTokenExpiry: null });

  // TODO: In production, we should consider sending a confirmation email to the user after their password has been successfully reset. This can help alert them to any unauthorized password reset attempts and provide an additional layer of security.
  logger.info(`Password updated for user: ${user.email} (ID: ${user.id})`);
  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "Password has been reset successfully" }));
});

export const resendResetLink = asyncHandler(async (req, res) => {
  const parsed = AuthResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`Resend password reset requested for non-existent email: ${email}`);
    return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
  }

  const resetToken = await createTokenWithCustomExpiry({ userId: user.id }, "15m");
  await AuthUseCase.updateUser(user.id, { resetToken, resetTokenExpiry: new Date(Date.now() + 15 * 60 * 1000) });

  // TODO: In production, we should send an actual email with the reset link instead of just logging the token. We can use a service like SendGrid, Mailgun, or Amazon SES for this purpose. The reset link should point to a frontend page where the user can enter their new password along with the token.
  logger.info(`Password reset link resent for user: ${user.email} (ID: ${user.id} resetToken: ${resetToken})`);
  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
});

export const updateMe = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;

  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const user = await AuthUseCase.updateUser(userId, parsed.data);
  if (!user) throw new ErrorResponse("User not found", 404);

  return appResponse(res, 200, AuthMeResponse.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    envelopeBased: user.envelopeBased,
  }));
});