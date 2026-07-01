import { and, asc, count, eq, gte, lte, SQL, sql } from "drizzle-orm";
import { budgetsTable, categoriesTable, transactionsTable, db } from "../../db";
import type { Budget } from "../../db/schema/budgets.ts";

export class BudgetRepository {

  static async getAllBudgets(userId: number, filters: {
    categoryId?: number;
    limit?: number;
    page?: number;
  } = {}) {
    const limit = filters.limit ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;
    const conditions: SQL[] = [eq(budgetsTable.userId, userId)];

    if (filters.categoryId) {
      conditions.push(eq(budgetsTable.categoryId, filters.categoryId));
    }

    const [rows, [totalResult]] = await Promise.all([
      db.select()
        .from(budgetsTable)
        .where(and(...conditions))
        .orderBy(asc(budgetsTable.categoryId))
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

  static async getBudgetByCategoryId(userId: number, categoryId: number): Promise<Budget | undefined> {
    const [budget] = await db
      .select()
      .from(budgetsTable)
      .where(and(
        eq(budgetsTable.userId, userId),
        eq(budgetsTable.categoryId, categoryId),
      ))
      .limit(1);
    return budget;
  }

  /**
   * Look up a budget by parentSlug — joins through categories so a budget
   * set against a system category is matched even when the transaction used
   * a custom subcategory under the same parent.
   */
  static async getBudgetByParentSlug(userId: number, parentSlug: string): Promise<Budget | undefined> {
    const [row] = await db
      .select({ budget: budgetsTable })
      .from(budgetsTable)
      .innerJoin(categoriesTable, eq(budgetsTable.categoryId, categoriesTable.id))
      .where(and(
        eq(budgetsTable.userId, userId),
        eq(categoriesTable.parentSlug, parentSlug),
      ))
      .limit(1);
    return row?.budget;
  }

  static async createBudget(
    userId: number,
    categoryId: number,
    monthlyLimit: number,
    rollover = true,
  ): Promise<Budget> {
    const [budget] = await db
      .insert(budgetsTable)
      .values({
        userId,
        categoryId,
        monthlyLimit: String(monthlyLimit),
        balance: "0",
        rollover,
      })
      .returning();
    return budget;
  }

  static async upsertBudget(
    userId: number,
    categoryId: number,
    monthlyLimit: number,
    rollover = true,
  ): Promise<Budget> {
    const [budget] = await db
      .insert(budgetsTable)
      .values({
        userId,
        categoryId,
        monthlyLimit: String(monthlyLimit),
        balance: "0",
        rollover,
      })
      .onConflictDoUpdate({
        target: [budgetsTable.userId, budgetsTable.categoryId],
        set: {
          monthlyLimit: String(monthlyLimit),
          rollover,
        },
      })
      .returning();
    return budget;
  }

  static async updateBudget(
    userId: number,
    categoryId: number,
    monthlyLimit: number,
  ): Promise<Budget | undefined> {
    const [budget] = await db
      .update(budgetsTable)
      .set({ monthlyLimit: String(monthlyLimit) })
      .where(and(
        eq(budgetsTable.userId, userId),
        eq(budgetsTable.categoryId, categoryId),
      ))
      .returning();
    return budget;
  }

  static async updateBalance(
    userId: number,
    categoryId: number,
    balance: number,
  ): Promise<Budget | undefined> {
    const [budget] = await db
      .update(budgetsTable)
      .set({ balance: String(balance) })
      .where(and(
        eq(budgetsTable.userId, userId),
        eq(budgetsTable.categoryId, categoryId),
      ))
      .returning();
    return budget;
  }

  /**
   * Envelope rollover at month boundary.
   * For each rollover budget, computes leftover = limit - spent and carries
   * it forward into the next month's balance.
   * Joins through categories to match transactions by parentSlug so custom
   * subcategories count toward the right budget.
   */
  static async resetBalancesForMonthRollover(
    userId: number,
    start: string,
    end: string,
  ): Promise<void> {
    const budgets = await db
      .select({ budget: budgetsTable, parentSlug: categoriesTable.parentSlug })
      .from(budgetsTable)
      .innerJoin(categoriesTable, eq(budgetsTable.categoryId, categoriesTable.id))
      .where(eq(budgetsTable.userId, userId));

    for (const { budget, parentSlug } of budgets) {
      if (!budget.rollover) continue;

      const [result] = await db
        .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
        .where(and(
          eq(transactionsTable.userId, userId),
          eq(categoriesTable.parentSlug, parentSlug),
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
        .where(eq(budgetsTable.id, budget.id));
    }
  }

  static async deleteBudget(userId: number, categoryId: number): Promise<void> {
    await db
      .delete(budgetsTable)
      .where(and(
        eq(budgetsTable.userId, userId),
        eq(budgetsTable.categoryId, categoryId),
      ));
  }
}