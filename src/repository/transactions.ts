import { categoriesTable, db, transactionsTable } from "../../db/index.ts";
import { eq, and, gte, lte, sql, desc, SQL, ilike, inArray, count } from "drizzle-orm";

export class TransactionRepository {

  // ── Aggregates ────────────────────────────────────────────────────────────

  static async getMonthlyIncome(userId: number, start: Date, end: Date) {
    const [result] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
        gte(transactionsTable.date, start.toISOString().slice(0, 10)),
        lte(transactionsTable.date, end.toISOString().slice(0, 10)),
      ));
    return parseFloat(result?.total ?? "0");
  }

  static async getMonthlyExpenses(userId: number, start: Date, end: Date) {
    const [result] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, start.toISOString().slice(0, 10)),
        lte(transactionsTable.date, end.toISOString().slice(0, 10)),
      ));
    return parseFloat(result?.total ?? "0");
  }

  static async getAllTimeIncome(userId: number) {
    const [result] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "income"),
      ));
    return parseFloat(result?.total ?? "0");
  }

  static async getAllTimeExpenses(userId: number) {
    const [result] = await db
      .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
      ));
    return parseFloat(result?.total ?? "0");
  }

  /**
   * Sum expenses for a given parentSlug within a date range.
   * Used by the budget usecase to compute totalSpent per budget category.
   * Matches across all custom subcategories under the same parent.
   */
  static async getSpentByParentSlug(
    userId: number,
    parentSlug: string,
    start: string,
    end: string
  ) {
    const [result] = await db
      .select({ total: sql<string>`COALESCE(SUM(${transactionsTable.amount}), 0)` })
      .from(transactionsTable)
      .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        eq(categoriesTable.parentSlug, parentSlug),
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end),
      ));
    return Number(result?.total ?? 0);
  }

  static async getTransactionsSummary(_userId: string) {
    // TODO
  }

  // ── Row queries ───────────────────────────────────────────────────────────

  static async getTransactions(
    userId: number,
    filters: {
      categoryId?: number;
      parentSlug?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      description?: string;
      amount?: number;
      orderBy?: "date" | "amount";
      limit?: number;
      page?: number;
    } = {}
  ) {
    const limit = filters.limit ?? 20;
    const offset = ((filters.page ?? 1) - 1) * limit;
    const conditions: SQL[] = [eq(transactionsTable.userId, userId)];

    if (filters.categoryId) {
      conditions.push(eq(transactionsTable.categoryId, filters.categoryId));
    }
    if (filters.parentSlug) {
      conditions.push(
        inArray(
          transactionsTable.categoryId,
          db.select({ id: categoriesTable.id })
            .from(categoriesTable)
            .where(eq(categoriesTable.parentSlug, filters.parentSlug))
        )
      );
    }
    if (filters.type) {
      conditions.push(eq(transactionsTable.type, filters.type as "income" | "expense"));
    }
    if (filters.startDate) {
      conditions.push(gte(transactionsTable.date, filters.startDate.toISOString().slice(0, 10)));
    }
    if (filters.endDate) {
      conditions.push(lte(transactionsTable.date, filters.endDate.toISOString().slice(0, 10)));
    }
    if (filters.description) {
      conditions.push(ilike(transactionsTable.description, `%${filters.description}%`));
    }
    if (filters.amount) {
      conditions.push(eq(transactionsTable.amount, filters.amount.toFixed(2)));
    }

    const [rows, [totalResult]] = await Promise.all([
      db.select()
        .from(transactionsTable)
        .where(and(...conditions))
        .orderBy(
          filters.orderBy === "amount"
            ? desc(transactionsTable.amount)
            : desc(transactionsTable.date)
        )
        .limit(limit)
        .offset(offset),
      db.select({ count: count() })
        .from(transactionsTable)
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

  static async getTransactionsByCategory(userId: number, filters: {
    start: Date;
    end: Date;
  }) {
    const rows = await db
      .select({
        parentSlug: categoriesTable.parentSlug,
        categoryId: categoriesTable.id,
        amount: sql<string>`sum(${transactionsTable.amount})`,
      })
      .from(transactionsTable)
      .innerJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, filters.start.toISOString().slice(0, 10)),
        lte(transactionsTable.date, filters.end.toISOString().slice(0, 10)),
      ))
      .groupBy(categoriesTable.parentSlug, categoriesTable.id)
      .orderBy(sql`sum(${transactionsTable.amount}) desc`);

    const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);
    return rows.map(r => ({
      parentSlug: r.parentSlug,
      categoryId: r.categoryId,
      amount: Math.round(parseFloat(r.amount) * 100) / 100,
      percentage: total > 0
        ? Math.round((parseFloat(r.amount) / total) * 10000) / 100
        : 0,
    }));
  }

  static async getRecentTransactions(userId: number, limit = 10) {
    return db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(desc(transactionsTable.date))
      .limit(limit);
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  static async createTransaction(userId: number, data: {
    type: "income" | "expense";
    amount: string;
    categoryId: number;
    description?: string;
    date: string | Date;
    institution?: string;
    merchant?: string;
    bill_type?: string;
  }) {
    const [row] = await db
      .insert(transactionsTable)
      .values({
        userId,
        type: data.type,
        amount: String(data.amount),
        categoryId: data.categoryId,
        description: data.description ?? "",
        date: typeof data.date === "string"
          ? data.date
          : data.date.toISOString().slice(0, 10),
        institution: data.institution ?? "",
        merchant: data.merchant ?? "",
        bill_type: data.bill_type ?? "",
      })
      .returning();
    return row;
  }

  static async updateTransaction(userId: number, transactionId: number, data: {
    type?: "income" | "expense";
    amount?: string;
    categoryId?: number;        // ← was: category: string
    description?: string;
    date?: string | Date;
    institution?: string;
    merchant?: string;
  }) {
    const updateData: Record<string, unknown> = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) updateData.amount = String(data.amount);
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.institution !== undefined) updateData.institution = data.institution;
    if (data.merchant !== undefined) updateData.merchant = data.merchant;
    if (data.date !== undefined) {
      updateData.date = typeof data.date === "string"
        ? data.date
        : data.date.toISOString().slice(0, 10);
    }

    const [updated] = await db
      .update(transactionsTable)
      .set(updateData)
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.userId, userId),
      ))
      .returning();
    return updated;
  }

  static async deleteTransaction(userId: number, transactionId: number) {
    const [deleted] = await db
      .delete(transactionsTable)
      .where(and(
        eq(transactionsTable.id, transactionId),
        eq(transactionsTable.userId, userId),
      ))
      .returning();
    return deleted;
  }

  static async deleteMultipleTransactions(userId: number, ids: number[]) {
    return db
      .delete(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        inArray(transactionsTable.id, ids),
      ));
  }
}