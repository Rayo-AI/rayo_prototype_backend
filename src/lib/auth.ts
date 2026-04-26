import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import ENV from "../../db/env.ts";

const JWT_SECRET = ENV.JWT.SECRET as string;
const JWT_EXPIRES_IN = (ENV.JWT.EXPIRES_IN as string) || "1h";

if (!JWT_SECRET) {
  throw new Error("JWT SECRET is missing.");
}

const secret = new TextEncoder().encode(JWT_SECRET);

// Create token
export async function createToken(payload: { userId: number }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(secret);
}

export async function createTokenWithCustomExpiry(
  payload: Record<string, unknown>,
  expiresIn: string
) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

// Verify token
export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as { userId: number };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    if (!payload || typeof payload.userId !== "number") {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}