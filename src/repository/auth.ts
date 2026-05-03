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

    logger.info(`User found with email: ${email} user: ${user}`);
    return user;
  }

  static async findUserById(id: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  static async findUserByToken(token: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.resetToken, token));
    logger.info(`Looking for user with reset token: ${token}, found: ${user}`);
    return user;
  }

  static async createUser(name: string, email: string, passwordHash: string) {
    const [user] = await db.insert(usersTable).values({ name, email, passwordHash }).returning();
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

  // repository/auth.ts
static async updateUser(userId: number, data: { name?: string; envelopeBased?: boolean, resetToken?: string | null; resetTokenExpiry?: Date | null }) {
  const [user] = await db
    .update(usersTable)
    .set(data)
    .where(eq(usersTable.id, userId))
    .returning();
  return user;
}
}