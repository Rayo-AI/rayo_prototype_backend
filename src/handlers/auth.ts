import { AuthSignupBody, AuthLoginBody, AuthLoginResponse, AuthMeResponse, AuthResetPasswordBody, AuthResetPasswordResponse, AuthResetPasswordWithTokenBody, UpdateMeBody, VerifyOtpBody } from "../../validation/index.ts";
import { createToken, createTokenWithCustomExpiry, hashPassword, comparePassword } from "../lib/auth.ts";
import { generateOTP, getOTPExpiry, hashOTP } from "../lib/otp.ts";
import { logger } from "../lib/logger.ts";
import { uploadToCloudinary, deleteFromCloudinary } from "../lib/cloudinary.ts";
import { sendSignUpEmail, sendOTPEmail, sendPasswordResetEmail, sendSuccessfulResetEmail, sendResendResetLinkEmail } from "../services/email.ts";
import { AuthUseCase } from "../usecases/auth.ts";
import { appResponse } from "../utils/appResponse.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";
import { ErrorResponse } from "../utils/errorResponse.ts";
import ENV from "../../db/env.ts";

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

  // Generate OTP for email verification
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry();
  const otpHash = hashOTP(otp);

  await AuthUseCase.updateUser(newUser.id, { verificationOTP: otpHash, verificationOTPExpiry: otpExpiry });

  // Send OTP email
  const emailResult = await sendOTPEmail(email, name, otp);

  if (!emailResult.success) {
    logger.error(`Failed to send OTP email to ${email}: ${emailResult.error}`);
    // We won't fail the registration if the email fails to send, but we should log it for monitoring
  }

  logger.info(`OTP generated and sent to ${email} (ID: ${newUser.id})`);
  return appResponse(res, 201, null, "User registered successfully. Please check your email for the verification code.");
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email, otp } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`OTP verification attempted for non-existent email: ${email}`);
    throw new ErrorResponse("Invalid email or OTP", 400);
  }

  if (user.emailVerified) {
    throw new ErrorResponse("Email already verified", 400);
  }

  if (!user.verificationOTP || user.verificationOTP !== hashOTP(otp)) {
    logger.warn(`Invalid OTP provided for email: ${email}`);
    throw new ErrorResponse("Invalid OTP", 400);
  }

  if (user.verificationOTPExpiry && user.verificationOTPExpiry.getTime() < Date.now()) {
    logger.warn(`OTP expired for email: ${email}`);
    throw new ErrorResponse("OTP expired. Please request a new one.", 400);
  }

  // Mark email as verified and clear OTP
  await AuthUseCase.updateUser(user.id, { 
    emailVerified: true, 
    verificationOTP: null, 
    verificationOTPExpiry: null 
  });

  const token = await createToken({ userId: user.id });
  logger.info(`Email verified for user: ${email} (ID: ${user.id})`);

  const emailResult = await sendSignUpEmail({ email, name: user.name });

  if (!emailResult.success) {
    logger.error(`Failed to send sign-up email to ${email}: ${emailResult.error}`);
    // We won't fail the verification if the email fails to send, but we should log it for monitoring
  }

  return appResponse(res, 200, AuthLoginResponse.parse({ 
    token, 
    user: { id: user.id, name: user.name, email: user.email, envelopeBased: user.envelopeBased, profileImage: user.profileImage } 
  }));
});

export const resendVerificationOtp = asyncHandler(async (req, res) => {
  const parsed = AuthResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user) {
    logger.warn(`Resend OTP requested for non-existent email: ${email}`);
    return appResponse(res, 200, null, "If that email exists, a verification code has been sent");
  }

  if (user.emailVerified) {
    throw new ErrorResponse("Email already verified", 400);
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpExpiry = getOTPExpiry();
  const otpHash = hashOTP(otp);

  await AuthUseCase.updateUser(user.id, { verificationOTP: otpHash, verificationOTPExpiry: otpExpiry });

  // Send OTP email
  const emailResult = await sendOTPEmail(email, user.name, otp);

  if (!emailResult.success) {
    logger.error(`Failed to send OTP email to ${email}: ${emailResult.error}`);
    throw new ErrorResponse("Failed to send verification code", 500);
  }

  logger.info(`OTP resent to ${email} (ID: ${user.id})`);
  return appResponse(res, 200, null, "Verification code has been sent to your email");
});

export const loginUser = asyncHandler(async (req, res) => {
  const parsed = AuthLoginBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { email, password } = parsed.data;

  const user = await AuthUseCase.findUserByEmail(email);
  if (!user || !user.passwordHash || !(await comparePassword(password, user.passwordHash))) {
    throw new ErrorResponse("Invalid credentials", 401);
  }

  if (!user.emailVerified) {
    throw new ErrorResponse("Email not verified. Please check your email for the verification code.", 401);
  }

  const token = await createToken({ userId: user.id });
  return appResponse(res, 200, AuthLoginResponse.parse({ token, user: { id: user.id, name: user.name, email: user.email, envelopeBased: user.envelopeBased, profileImage: user.profileImage } }));
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

  return appResponse(res, 200, AuthMeResponse.parse({ id: user.id, name: user.name, email: user.email, envelopeBased: user.envelopeBased, profileImage: user.profileImage }));
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

  const emailResult = await sendPasswordResetEmail(email, resetToken);
  logger.info(`Password reset link generated for user: ${email} (ID: ${user.id})`);

  if (!emailResult.success) {
    logger.error(`Failed to send password reset email to ${email}: ${emailResult.error}`);
    // We won't fail the request if the email fails to send, but we should log it for monitoring
  }

  return appResponse(res, 200, AuthResetPasswordResponse.parse({ message: "If that email exists, a reset link has been sent" }));
});

export const resetPassword = asyncHandler(async (req, res) => {
  const token = req.params.token as string;
  
  if (!token) {
    throw new ErrorResponse("Reset token is required", 400);
  }

  const parsed = AuthResetPasswordWithTokenBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { newPassword, confirmPassword } = parsed.data;

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

  const emailResult = await sendSuccessfulResetEmail(user.email);

  if (!emailResult.success) {
    logger.error(`Failed to send password reset confirmation email to ${user.email}: ${emailResult.error}`);
    // We won't fail the request if the email fails to send, but we should log it for monitoring
  }

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

  const emailResult = await sendResendResetLinkEmail(email, resetToken);

  if (!emailResult.success) {
    logger.error(`Failed to send resend password reset email to ${email}: ${emailResult.error}`);
    throw new ErrorResponse("Failed to resend reset link", 500);
  }
  
  logger.info(`Password reset link resent for user: ${user.email} (ID: ${user.id})`);
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
    profileImage: user.profileImage,
  }));
});

/**
 * Google OAuth callback handler
 * Called by Passport middleware after successful Google authentication
 * Receives the authenticated user profile in req.user
 */
export const googleOAuthCallback = asyncHandler(async (req, res) => {
  const user = req.user as any;

  if (!user || !user.id) {
    throw new ErrorResponse("Failed to authenticate with Google", 500);
  }

  logger.info(`Google OAuth callback - User authenticated: ${user.email} (ID: ${user.id})`);

  const token = await createToken({ userId: user.id });

  const emailResult = await sendSignUpEmail({ email: user.email, name: user.name });
  if (!emailResult.success) {
    logger.error(`Failed to send Google login email to ${user.email}: ${emailResult.error}`);
  }

  // Decode state to get redirectUrl
  const state = req.query.state as string | undefined;
  let redirectUrl = ENV.URL.FRONTEND + "/product/dashboard";

  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64").toString());
      redirectUrl = decoded.redirectUrl || redirectUrl;
    } catch {}
  }

  // Redirect browser to frontend with token in URL
  return res.redirect(`${redirectUrl}?token=${token}`);
});

/**
 * Upload or update user profile image
 */
export const uploadProfileImage = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;

  if (!req.file) {
    throw new ErrorResponse("No image file provided", 400);
  }

  const user = await AuthUseCase.findUserById(userId);
  if (!user) {
    throw new ErrorResponse("User not found", 404);
  }

  const filename = `profile-${userId}-${Date.now()}`;
  const uploadResult = await uploadToCloudinary(req.file.buffer, filename, "rayo-finance/profiles");

  if (!uploadResult.success) {
    logger.error(`Failed to upload profile image for user ${userId}: ${uploadResult.error}`);
    throw new ErrorResponse("Failed to upload image", 500);
  }

  // Delete previous image if it exists
  if (user.profileImage) {
    const matches = user.profileImage.match(/\/v\d+\/(.+?)\./);
    if (matches?.[1]) {
      await deleteFromCloudinary(matches[1]); // ✅ no folder prefix duplication
    }
  }

  const updatedUser = await AuthUseCase.updateUser(userId, { profileImage: uploadResult.url }); // ✅ consistent field

  if (!updatedUser) {
    throw new ErrorResponse("Failed to update user profile", 500);
  }

  logger.info(`Profile image uploaded for user ${userId}: ${uploadResult.url}`);

  return appResponse(res, 200, { profileImage: updatedUser.profileImage });
});