import { and, asc, count, eq, gte, ilike, lte, SQL } from "drizzle-orm";
import { db, savingsGoalsTable } from "../../db";

function mapGoal(g: typeof savingsGoalsTable.$inferSelect) {
  const target = parseFloat(g.targetAmount);
  const current = parseFloat(g.currentAmount);
  return {
    id: g.id,
    userId: g.userId,
    name: g.name,
    targetAmount: target,
    currentAmount: current,
    deadline: g.deadline,
    percentComplete: target > 0 ? Math.min(100, (current / target) * 100) : 0,
  };
}

export class SavingsRepository {
  static async getSavingsGoals(userId: number, filters: {
    name?: string;
    deadlineBefore?: string;
    deadlineAfter?: string;
    limit?: number;
    page?: number;
  } = {}) {
    const limit = filters.limit ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;
    const conditions: SQL[] = [eq(savingsGoalsTable.userId, userId)];

    if (filters.name) {
      conditions.push(ilike(savingsGoalsTable.name, `%${filters.name}%`));
    }
    if (filters.deadlineBefore) {
      conditions.push(lte(savingsGoalsTable.deadline, filters.deadlineBefore));
    }
    if (filters.deadlineAfter) {
      conditions.push(gte(savingsGoalsTable.deadline, filters.deadlineAfter));
    }

    const [rows, [totalResult]] = await Promise.all([
      db.select()
        .from(savingsGoalsTable)
        .where(and(...conditions))
        .orderBy(asc(savingsGoalsTable.deadline))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(savingsGoalsTable)
        .where(and(...conditions)),
    ]);

    return {
      rows: rows.map(mapGoal),
      pagination: {
        total: totalResult?.count ?? 0,
        page: filters.page ?? 1,
        limit,
        totalPages: Math.ceil((totalResult?.count ?? 0) / limit),
        hasNext: (filters.page ?? 1) * limit < (totalResult?.count ?? 0),
        hasPrev: (filters.page ?? 1) > 1,
      },
    };
  }

  static async createSavingsGoal(userId: number, name: string, targetAmount: number, deadline: string) {
    const [saving] = await db
      .insert(savingsGoalsTable)
      .values({
        userId,
        name,
        targetAmount: targetAmount.toString(),
        currentAmount: "0",
        deadline,
      })
      .returning();
    return mapGoal(saving);
  }

  static async updateSavingsGoal(userId: number, id: number, updates: Record<string, string>) {
    const [saving] = await db
      .update(savingsGoalsTable)
      .set(updates)
      .where(and(eq(savingsGoalsTable.id, id), eq(savingsGoalsTable.userId, userId)))
      .returning();
    return mapGoal(saving);
  }

  static async deleteSavingsGoal(userId: number, id: number) {
    const [saving] = await db
      .delete(savingsGoalsTable)
      .where(and(eq(savingsGoalsTable.id, id), eq(savingsGoalsTable.userId, userId)))
      .returning();
    return mapGoal(saving);
  }
}