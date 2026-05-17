import crypto from "crypto";

/**
 * Generate a random OTP (One-Time Password)
 * @param length Length of OTP (default: 6 digits)
 * @returns 6-digit OTP as string
 */
export function generateOTP(length = 6): string {
  const max = 10 ** length;

  return crypto
    .randomInt(0, max)
    .toString()
    .padStart(length, "0");
}

/**
 * Get OTP expiry time (15 minutes from now)
 * @returns Date object representing OTP expiry time
 */
export function getOTPExpiry(): Date {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
}

export function hashOTP(otp: string): string {
  return crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");
}