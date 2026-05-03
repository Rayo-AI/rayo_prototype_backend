import { db, transactionsTable, budgetsTable } from "../../db/index.ts";
import { eq, and, gte, lte, sql, desc, SQL, ilike, inArray } from "drizzle-orm";

export class TransactionRepository {
  static async getMonthlyIncome(userId: number, start: Date, end: Date) {
    const [incomeResult] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "income"),
          gte(transactionsTable.date, start.toISOString().slice(0, 10)),
          lte(transactionsTable.date, end.toISOString().slice(0, 10)),
        ),
      );
    return parseFloat(incomeResult?.total ?? "0");
  }

  static async getAllTimeIncome(userId: number) {
    const [incomeResult] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId), 
          eq(transactionsTable.type, "income")
        )
      );
    return parseFloat(incomeResult?.total ?? "0");
  }

  static async getExpenseByCategory(userId: number, start: Date, end: Date) {
    const rows = await db
      .select({
        category: transactionsTable.category,
        amount: sql<string>`sum(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "expense"),
          gte(transactionsTable.date, start.toISOString().slice(0, 10)),
          lte(transactionsTable.date, end.toISOString().slice(0, 10))
        )
      )
      .groupBy(transactionsTable.category)
      .orderBy(sql`sum(${transactionsTable.amount}) desc`);

    const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    return rows.map(r => ({
      category: r.category,
      amount: parseFloat(r.amount),
      percentage: total > 0 ? (parseFloat(r.amount) / total) * 100 : 0,
    }));
  }
  
  static async getAllTimeExpenses(userId: number) {
    const [expenseResult] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense")));
    return parseFloat(expenseResult?.total ?? "0");
  }

  static async getMonthlyExpenses(userId: number, start: Date, end: Date) {
    const [expenseResult] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, start.toISOString().slice(0, 10)), lte(transactionsTable.date, end.toISOString().slice(0, 10))));
    return parseFloat(expenseResult?.total ?? "0");
  }

  static async getTransactionsByCategory(userId: number, start: Date, end: Date) {
    const rows = await db
        .select({
          category: transactionsTable.category,
          amount: sql<string>`sum(${transactionsTable.amount})`,
        })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId), 
            eq(transactionsTable.type, "expense"), 
            gte(transactionsTable.date, start.toISOString().slice(0, 10)), 
            lte(transactionsTable.date, end.toISOString().slice(0, 10))))
        .groupBy(transactionsTable.category)
        .orderBy(sql`sum(${transactionsTable.amount}) desc`);

    const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    return rows.map(r => ({
      category: r.category,
      amount: parseFloat(r.amount),
      percentage: total > 0 ? (parseFloat(r.amount) / total) * 100 : 0,
    }));
  }

  static async getTransactions(
    userId: number,
    filters: {
      category?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      orderBy?: "date" | "amount";
      description?: string;   
      amount?: number;
    } = {}
  ) {
    const conditions: SQL[] = [eq(transactionsTable.userId, userId)];

    if (filters.category) conditions.push(eq(transactionsTable.category, filters.category));
    if (filters.type) conditions.push(eq(transactionsTable.type, filters.type as "income" | "expense"));
    if (filters.startDate) conditions.push(gte(transactionsTable.date, filters.startDate.toISOString().slice(0, 10)));
    if (filters.endDate) conditions.push(lte(transactionsTable.date, filters.endDate.toISOString().slice(0, 10)));
    if (filters.description) conditions.push(ilike(transactionsTable.description, `%${filters.description}%`)); 
    if (filters.amount) conditions.push(eq(transactionsTable.amount, filters.amount.toFixed(2))); 

    const query = db
      .select()
      .from(transactionsTable)
      .where(and(...conditions))
      .orderBy(filters.orderBy === "amount" ? desc(transactionsTable.amount) : desc(transactionsTable.date));

    if (filters.limit) return query.limit(filters.limit);
    return query;
  }

  static async getTransactionsByUserId(userId: number) {
    const [transaction] = await db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId)));
    return transaction;
  }

  static async createTransaction(userId: number, data: { type: "income" | "expense"; amount: string; category: string; description?: string; date: string | Date }) {
    const [row] = await db
    .insert(transactionsTable)
    .values({
      userId,
      type: data.type as "income" | "expense",
      amount: String(data.amount),
      category: data.category,
      description: data.description,
      date: typeof data.date === "string" ? data.date : data.date.toISOString().slice(0, 10),
    })
    .returning();
    return row;
  }

  static async deleteTransaction(userId: number, transactionId: number) {
      const [deleted] = await db
    .delete(transactionsTable)
    .where(
      and(
        eq(transactionsTable.id, transactionId), 
        eq(transactionsTable.userId, userId)
      )
    )
    .returning();
    return deleted;
  }

  static async deleteMultipleTransactions(userId: number, ids: number[]) {
    return db
      .delete(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId), // ← ensure user can only delete their own
          inArray(transactionsTable.id, ids)
        )
      );
  }

  static async updateTransaction(userId: number, transactionId: number, data: { type?: "income" | "expense"; amount?: string; category?: string; description?: string; date?: string | Date }) {
    const updateData: any = {};
    if (data.type) updateData.type = data.type;
    if (data.amount) updateData.amount = String(data.amount);
    if (data.category) updateData.category = data.category;
    if (data.description) updateData.description = data.description;
    if (data.date) updateData.date = typeof data.date === "string" ? data.date : data.date.toISOString().slice(0, 10);

    const [updated] = await db
      .update(transactionsTable)
      .set(updateData)
      .where(
        and(
          eq(transactionsTable.id, transactionId), 
          eq(transactionsTable.userId, userId)
        )
      )
      .returning();
    return updated;
  }

  static async getSpendingReport(userId: number, start: Date, end: Date) {
    const rows = await db
        .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.userId, userId),
            eq(transactionsTable.type, "expense"),
            gte(transactionsTable.date, start.toISOString().slice(0, 10)),
            lte(transactionsTable.date, end.toISOString().slice(0, 10))
          )
        );
    return parseFloat(rows[0]?.total ?? "0");
  }

  static async getSpentByCategory(userId: number, category: string, start: string, end: string) {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.userId, userId),
          eq(transactionsTable.type, "expense"),
          eq(transactionsTable.category, category),
          gte(transactionsTable.date, start),
          lte(transactionsTable.date, end)
        )
      );
    return Number(result?.total ?? 0);
  }
}