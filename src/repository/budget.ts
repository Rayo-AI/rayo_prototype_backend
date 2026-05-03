import { and, eq, gte, lte, sql } from "drizzle-orm";
import { budgetsTable, db } from "../../db";

export class BudgetRepository {
  static async getAllBudgets(userId: number) {
    return db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));
  }

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
      .where(
        and(
          eq(budgetsTable.userId, userId),
          eq(budgetsTable.category, category)
        )
      )
      .returning();
    return budget;
  }

  static async resetBalancesForMonthRollover(userId: number, start: string, end: string) {
    const budgets = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));
    for (const budget of budgets) {
      if (budget.rollover) {
        const totalSpent = await db
          .select({ total: sql`coalesce(sum(${sql.raw("amount")}), 0)` })
          .from(sql.raw("transactions"))
          .where(
            and(
              eq(sql.raw("user_id"), userId),
              eq(sql.raw("category"), budget.category),
              eq(sql.raw("type"), "expense"),
              gte(sql.raw("date"), start),
              lte(sql.raw("date"), end)
            )
          )
          .then(rows => String(rows[0]?.total ?? "0"));
        const newBalance = parseFloat(budget.monthlyLimit) - parseFloat(totalSpent);
        await db
          .update(budgetsTable)
          .set({ balance: String(newBalance) })
          .where(
            and(
              eq(budgetsTable.userId, userId),
              eq(budgetsTable.category, budget.category)
            )
          );
      }
    }
  }

  static async deleteBudget(userId: number, category: string) {
    return db
      .delete(budgetsTable)
      .where(
        and(
          eq(budgetsTable.userId, userId),
          eq(budgetsTable.category, category)
        )
      );
  }
}