import { Router, type IRouter } from "express";
import { db, transactionsTable, budgetsTable } from "../../db/index.ts";
import { GetDashboardSummaryResponse, GetSpendingByCategoryResponse } from "../../validation/index.ts";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.ts";

const router: IRouter = Router();

function getCurrentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const [incomeResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "income"), gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

  const [expenseResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, start), lte(transactionsTable.date, end)));

  const [allIncomeResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "income")));

  const [allExpenseResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense")));

  const [budget] = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  const monthlyIncome = parseFloat(incomeResult?.total ?? "0");
  const monthlyExpenses = parseFloat(expenseResult?.total ?? "0");
  const totalIncome = parseFloat(allIncomeResult?.total ?? "0");
  const totalExpenses = parseFloat(allExpenseResult?.total ?? "0");
  const totalBalance = totalIncome - totalExpenses;

  const budgetMonthlyLimit = budget ? parseFloat(budget.monthlyLimit) : undefined;
  const budgetPercentUsed = budgetMonthlyLimit ? Math.min(100, (monthlyExpenses / budgetMonthlyLimit) * 100) : undefined;

  const recentRows = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.date))
    .limit(10);

  const recentTransactions = recentRows.map(t => ({
    id: t.id,
    userId: t.userId,
    type: t.type,
    amount: parseFloat(t.amount),
    category: t.category,
    description: t.description,
    date: t.date,
    createdAt: t.createdAt.toISOString(),
  }));

  res.json(GetDashboardSummaryResponse.parse({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    budgetMonthlyLimit,
    budgetPercentUsed,
    recentTransactions,
  }));
});

router.get("/dashboard/spending-by-category", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const rows = await db
    .select({
      category: transactionsTable.category,
      amount: sql<string>`sum(${transactionsTable.amount})`,
    })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, start), lte(transactionsTable.date, end)))
    .groupBy(transactionsTable.category)
    .orderBy(sql`sum(${transactionsTable.amount}) desc`);

  const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  const result = rows.map(r => ({
    category: r.category,
    amount: parseFloat(r.amount),
    percentage: total > 0 ? (parseFloat(r.amount) / total) * 100 : 0,
  }));

  res.json(GetSpendingByCategoryResponse.parse(result));
});

export default router;
