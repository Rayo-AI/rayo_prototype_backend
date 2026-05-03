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

export const dashboardSummary = asyncHandler(async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const incomeResult = await TransactionUseCase.getMonthlyIncome(userId, new Date(start), new Date(end));

  const expenseResult = await TransactionUseCase.getMonthlyExpenses(userId, new Date(start), new Date(end));

  const allIncomeResult = await TransactionUseCase.getAllTimeIncome(userId);

  const allExpenseResult = await TransactionUseCase.getAllTimeExpenses(userId);

  const budget = await BudgetUseCase.getBudget(userId);

  // helpers to handle cases where usecases/repositories may return a number
  // or an object with a `total` string field
  const toNumber = (val: any): number => {
    if (val == null) return 0;
    if (typeof val === "number") return val;
    if (typeof val === "string") return parseFloat(val) || 0;
    if (typeof val === "object" && "total" in val) {
      const t = (val as any).total;
      return typeof t === "number" ? t : parseFloat(t ?? "0") || 0;
    }
    return 0;
  };

  const monthlyIncome = toNumber(incomeResult);
  const monthlyExpenses = toNumber(expenseResult);
  const totalIncome = toNumber(allIncomeResult);
  const totalExpenses = toNumber(allExpenseResult);
  const totalBalance = totalIncome - totalExpenses;

  const budgetMonthlyLimit = budget ? parseFloat(budget.monthlyLimit) : undefined;
  const budgetPercentUsed = budgetMonthlyLimit ? Math.min(100, (monthlyExpenses / budgetMonthlyLimit) * 100) : undefined;

  const recentRows = await TransactionUseCase.getRecentTransactions(userId);

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

  return appResponse(res, 200, GetDashboardSummaryResponse.parse({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    budgetMonthlyLimit,
    budgetPercentUsed,
    recentTransactions,
  }), "Dashboard summary retrieved successfully");
})

// export const dashboardSpendingByCategory = asyncHandler(async (req, res): Promise<void> => {
//   const userId = (req as typeof req & { userId: number }).userId;
//   const { start, end } = getCurrentMonthRange();

//   const rows = ;

//   const total = rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

//   const result = rows.map(r => ({
//     category: r.category,
//     amount: parseFloat(r.amount),
//     percentage: total > 0 ? (parseFloat(r.amount) / total) * 100 : 0,
//   }));

//   res.json(GetSpendingByCategoryResponse.parse(result));
// });