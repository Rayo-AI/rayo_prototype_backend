import { budgetsTable, db, savingsGoalsTable, usersTable } from "../../db/index.ts";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.ts";

export interface CategoryInput {
  name: string;
  monthlyLimit: string;
}

export interface GoalInput {
  name: string;
  targetAmount: string;
  deadline: string;
}

export interface OnboardingPayload {
  userId: number;
  level: string;
  method: string;
  income: string;
  goals: GoalInput[];
  categories: CategoryInput[];
}

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

  static async completeSetup(payload: OnboardingPayload) {
    const { userId, method, income, goals, categories } = payload;

    // Dynamically determine budgeting style based on the user's string
    // If they picked "zero-based", envelopeBased is false. Otherwise, true.
    const envelopeBased = method.toLowerCase() !== "zero-based";
    const isZeroBased = !envelopeBased;

    // Execute within a database transaction to ensure data integrity
    await db.transaction(async (tx) => {
      
      // 1. Update user profile
      await tx
        .update(usersTable)
        .set({
          onboardingComplete: true,
          envelopeBased,
          incomeSource: income,
        })
        .where(eq(usersTable.id, userId));

      // 2. Insert budget categories exactly as defined by the user
      if (categories && categories.length > 0) {
        const budgetRows = categories.map((cat) => ({
          userId,
          category: cat.name,
          monthlyLimit: cat.monthlyLimit,
          balance: "0",
          rollover: !isZeroBased, // Zero-based generally implies no rollover
        }));

        await tx.insert(budgetsTable).values(budgetRows);
      }

      // 3. Insert savings goals exactly as defined by the user
      if (goals && goals.length > 0) {
        const goalRows = goals.map((goal) => ({
          userId,
          name: goal.name,
          targetAmount: goal.targetAmount, 
          currentAmount: "0",
          deadline: goal.deadline, 
        }));

        await tx.insert(savingsGoalsTable).values(goalRows);
      }
    });

    return true;
  }
}