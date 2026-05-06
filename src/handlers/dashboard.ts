import { GetDashboardSummaryResponse, GetSpendingByCategoryResponse } from "../../validation";
import { BudgetUseCase } from "../usecases/budget";
import { TransactionUseCase } from "../usecases/transaction";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../utils/asyncHandler";

function getCurrentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

const toNumber = (val: unknown): number => {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  if (typeof val === "object" && "total" in val) {
    const t = (val as Record<string, unknown>).total;
    return typeof t === "number" ? t : parseFloat(String(t ?? "0")) || 0;
  }
  return 0;
};

export const dashboardSummary = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const [
    incomeResult,
    expenseResult,
    allIncomeResult,
    allExpenseResult,
    budgets,
    recentRows,
  ] = await Promise.all([
    TransactionUseCase.getMonthlyIncome(userId, new Date(start), new Date(end)),
    TransactionUseCase.getMonthlyExpenses(userId, new Date(start), new Date(end)),
    TransactionUseCase.getAllTimeIncome(userId),
    TransactionUseCase.getAllTimeExpenses(userId),
    BudgetUseCase.getBudget(userId),
    TransactionUseCase.getTransactions(userId, { limit: 5, page: 1 }),
  ]);

  const monthlyIncome = Math.round(toNumber(incomeResult) * 100) / 100;
  const monthlyExpenses = Math.round(toNumber(expenseResult) * 100) / 100;
  const totalIncome = Math.round(toNumber(allIncomeResult) * 100) / 100;
  const totalExpenses = Math.round(toNumber(allExpenseResult) * 100) / 100;
  const totalBalance = Math.round((totalIncome - totalExpenses) * 100) / 100;

  // Aggregate across all budget categories
  const budgetMonthlyLimit = budgets.rows.length > 0
    ? Math.round(budgets.rows.reduce((sum, b) => sum + parseFloat(b.monthlyLimit), 0) * 100) / 100
    : undefined;
  const budgetPercentUsed = budgetMonthlyLimit
    ? Math.round(Math.min(100, (monthlyExpenses / budgetMonthlyLimit) * 100) * 100) / 100
    : undefined;

  const recentTransactions = recentRows.rows.map(t => ({
    id: t.id,
    userId: String(t.userId),
    type: t.type,
    amount: Math.round(parseFloat(t.amount) * 100) / 100,
    category: t.category,
    description: t.description,
    date: t.date,
    createdAt: t.createdAt.toISOString(),
  }));

  return appResponse(res, 200, GetDashboardSummaryResponse.parse({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    budgetMonthlyLimit,
    budgetPercentUsed,
    recentTransactions,
  }), "Dashboard summary retrieved successfully");
});

export const dashboardSpendingByCategory = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const rows = await TransactionUseCase.getTransactionsByCategory(userId, { start: new Date(start), end: new Date(end) });

  const result = rows.map(r => ({
    category: r.category,
    amount: r.amount,
    percentage: r.percentage,
  }));

  return appResponse(res, 200, GetSpendingByCategoryResponse.parse(result));
});