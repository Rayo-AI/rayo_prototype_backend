import { and, asc, count, eq, gte, lte, SQL, sql } from "drizzle-orm";
import { budgetsTable, transactionsTable, db } from "../../db";

export class BudgetRepository {
  static async getAllBudgets(userId: number, filters: {
    category?: string;
    limit?: number;
    page?: number;
  } = {}) {
    const limit = filters.limit ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;
    const conditions: SQL[] = [eq(budgetsTable.userId, userId)];

    if (filters.category) {
      conditions.push(eq(budgetsTable.category, filters.category));
    }

    const [rows, [totalResult]] = await Promise.all([
      db.select()
        .from(budgetsTable)
        .where(and(...conditions))
        .orderBy(asc(budgetsTable.category))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(budgetsTable)
        .where(and(...conditions)),
    ]);

    return {
      rows,
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

  // Single record — no pagination needed
  static async getBudgetByCategory(userId: number, category: string) {
    const [budget] = await db
      .select()
      .from(budgetsTable)
      .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, category)));
    return budget;
  }

  static async createBudget(userId: number, category: string, monthlyLimit: number) {
    const [budget] = await db
      .insert(budgetsTable)
      .values({ userId, category, monthlyLimit: String(monthlyLimit) })
      .returning();
    return budget;
  }

  static async updateBudget(userId: number, category: string, monthlyLimit: number) {
    const [budget] = await db
      .update(budgetsTable)
      .set({ monthlyLimit: String(monthlyLimit) })
      .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, category)))
      .returning();
    return budget;
  }

  static async updateBalance(userId: number, category: string, balance: number) {
    const [budget] = await db
      .update(budgetsTable)
      .set({ balance: String(balance) })
      .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, category)))
      .returning();
    return budget;
  }

  // Fixed: uses proper Drizzle table references instead of sql.raw strings
  static async resetBalancesForMonthRollover(userId: number, start: string, end: string) {
    const budgets = await db
      .select()
      .from(budgetsTable)
      .where(eq(budgetsTable.userId, userId));

    for (const budget of budgets) {
      if (!budget.rollover) continue;

      const [result] = await db
        .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.category, budget.category),
          eq(transactionsTable.type, "expense"),
          gte(transactionsTable.date, start),
          lte(transactionsTable.date, end),
        ));

      const spent = parseFloat(result?.total ?? "0");
      const leftover = parseFloat(budget.monthlyLimit) - spent;
      const newBalance = parseFloat(budget.balance ?? "0") + leftover;

      await db
        .update(budgetsTable)
        .set({ balance: String(newBalance) })
        .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, budget.category)));
    }
  }

  static async deleteBudget(userId: number, category: string) {
    return db
      .delete(budgetsTable)
      .where(and(eq(budgetsTable.userId, userId), eq(budgetsTable.category, category)));
  }
}