import { db, usersTable } from "../../db/index.ts";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.ts";

export class AuthRepository {
  static async findUserByEmail(email: string) {
    logger.info(`Looking for user with email: ${email}`);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!user) {
      logger.info(`No user found with email: ${email}`);
      return null;
    }

    logger.info(`User found with email: ${email}`);
    return user;
  }

  static async findUserById(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  static async findUserByToken(token: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.resetToken, token));
    logger.info(`Reset token lookup: user ${user ? 'found' : 'not found'}`);
    return user;
  }

  static async findUserByGoogleId(googleId: string) {
    const id = String(googleId); // ensure string regardless of what comes in
    logger.info(`Looking for user with googleId: ${id}`);

    try {
      return db
        .select()
        .from(usersTable)
        .where(eq(usersTable.googleId, id))
        .limit(1)
        .then(rows => rows[0] ?? null);
    } catch (error: any) {
      logger.error(`findUserByGoogleId failed for ID ${id}:`, error);
      throw error; // let the caller handle it, don't silently swallow
    }
  }

  static async createUser(
    name: string, 
    email: string, 
    passwordHash: string | null,
    googleData?: {
      googleId: string;
      googleEmail: string;
      profileImage?: string | null;
      emailVerified?: boolean;
    }
  ) {
    const [user] = await db.insert(usersTable).values({
      name,
      email,
      passwordHash,
      googleId: googleData?.googleId,
      googleEmail: googleData?.googleEmail,
      profileImage: googleData?.profileImage || null,
      emailVerified: googleData?.emailVerified ?? false,
    }).returning();
    return user;
  }

  static async updateUserPassword(userId: number, passwordHash: string) {
    const [user] = await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId)).returning();

    if (user.resetToken) {
      logger.info(`Reset token cleared for user ID: ${userId} after password update`);
      await db.update(usersTable).set({ resetToken: null, resetTokenExpiry: null }).where(eq(usersTable.id, userId)).returning();
    }
    
    return user;
  }

  static async updateUser(
    userId: number, 
    data: {
      name?: string;
      envelopeBased?: boolean;
      resetToken?: string | null;
      resetTokenExpiry?: Date | null;
      emailVerified?: boolean;
      verificationOTP?: string | null;
      verificationOTPExpiry?: Date | null;
      googleId?: string;
      googleEmail?: string;
      profileImage?: string | null;
    }
  ) {
    const [user] = await db
      .update(usersTable)
      .set(data)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  static async findUserByOTP(otp: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.verificationOTP, otp));
    logger.info(`OTP verification lookup: user ${user ? 'found' : 'not found'}`);
    return user;
  }
}