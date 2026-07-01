import { GetDashboardSummaryResponse, GetSpendingByCategoryResponse } from "../../validation";
import { getCached } from "../lib/cache";
import { CACHE_KEYS, CACHE_TTL } from "../lib/cacheKeys";
import { CategoryUseCase } from "../usecases/category";
import { BudgetUseCase } from "../usecases/budget";
import { TransactionUseCase } from "../usecases/transaction";
import { SavingsUseCase } from "../usecases/savings";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../middlewares/asyncHandler";

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
  const monthKey = `${start}-${end}`;

  const summary = await getCached(
    CACHE_KEYS.dashboardMonth(userId, monthKey) + "_v2",
    async () => {
      const [
        incomeResult,
        expenseResult,
        allIncomeResult,
        allExpenseResult,
        budgets,
        recentRows,
        categoryRows,   // ← must match Promise.all order
        savingsGoals,   // ← moved to match position in Promise.all
        categories,
      ] = await Promise.all([
        TransactionUseCase.getMonthlyIncome(userId, new Date(start), new Date(end)),
        TransactionUseCase.getMonthlyExpenses(userId, new Date(start), new Date(end)),
        TransactionUseCase.getAllTimeIncome(userId),
        TransactionUseCase.getAllTimeExpenses(userId),
        BudgetUseCase.getBudget(userId),
        TransactionUseCase.getTransactions(userId, { limit: 10, page: 1 }),
        TransactionUseCase.getTransactionsByCategory(userId, {
          start: new Date(start),
          end: new Date(end),
        }),
        SavingsUseCase.getSavingsGoals(userId, {limit: 10, page: 1}),  // ← last, matches destructuring
        CategoryUseCase.listForUser(userId),
      ]);

      const categoryById = new Map(categories.map(category => [category.id, category]));

      // ── Balances ─────────────────────────────────────────────────────────
      const monthlyIncome   = Math.round(toNumber(incomeResult)     * 100) / 100;
      const monthlyExpenses = Math.round(toNumber(expenseResult)    * 100) / 100;
      const totalIncome     = Math.round(toNumber(allIncomeResult)  * 100) / 100;
      const totalExpenses   = Math.round(toNumber(allExpenseResult) * 100) / 100;
      const totalBalance    = Math.round((totalIncome - totalExpenses) * 100) / 100;
      const monthlySavings  = Math.round((monthlyIncome - monthlyExpenses) * 100) / 100;
      const savingsRate     = monthlyIncome > 0
        ? Math.round((monthlySavings / monthlyIncome) * 100 * 100) / 100
        : totalIncome > 0
          ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 100) / 100
          : 0;

      // ── Budgets ───────────────────────────────────────────────────────────
     // ── Budgets ───────────────────────────────────────────────────────────
      const mappedBudgets = budgets.rows.map(b => {
        const limit = parseFloat(b.monthlyLimit);
        const category = categoryById.get(b.categoryId);
        const spent = categoryRows
          .filter(c => c.parentSlug === category?.parentSlug)
          .reduce((sum, row) => sum + Number(row.amount), 0);

        return {
          id:           b.id,
          userId:       userId,
          categoryId:   b.categoryId,
          categoryName: category?.name,
          parentSlug:   category?.parentSlug,
          monthlyLimit: Math.round(limit * 100) / 100,
          percentUsed:  limit ? Math.round(Math.min(100, (spent / limit) * 100) * 100) / 100 : 0,
          totalSpent:   Math.round(spent * 100) / 100,
          remaining:    Math.round((limit - spent) * 100) / 100,
          rollover:     b.rollover || false,
          balance:      b.balance ? Math.round(parseFloat(String(b.balance)) * 100) / 100 : undefined,
        };
      });

      const budgetMonthlyLimit = mappedBudgets.length > 0
        ? Math.round(mappedBudgets.reduce((sum, b) => sum + b.monthlyLimit, 0) * 100) / 100
        : 0;
        
      const budgetPercentUsed = budgetMonthlyLimit > 0
        ? Math.round(Math.min(100, (monthlyExpenses / budgetMonthlyLimit) * 100) * 100) / 100
        : 0;


      // ── Spending by category ──────────────────────────────────────────────
      const spendingByCategory = categoryRows.map(r => ({
        categoryId: r.categoryId,
        amount:     Math.round(Number(r.amount) * 100) / 100,
        percentage: Math.round(Number(r.percentage) * 100) / 100,
      }));

      // ── Recent transactions ───────────────────────────────────────────────
      const recentTransactions = recentRows.rows.map(t => ({
        id:          t.id,
        userId:      String(t.userId),
        type:        t.type,
        amount:      Math.round(parseFloat(t.amount) * 100) / 100,
        categoryId:  t.categoryId,
        description: t.description,
        institution: t.institution,
        merchant:    t.merchant,
        date:        t.date,
        createdAt:   t.createdAt.toISOString(),
      }));

      // ── Savings goals ─────────────────────────────────────────────────────
      const mappedSavings = savingsGoals.rows ?? [];

      return {
        totalBalance,
        totalIncome,
        totalExpenses,
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        savingsRate,
        budgetMonthlyLimit,
        budgetPercentUsed,
        budgets:            mappedBudgets,
        spendingByCategory,
        recentTransactions,
        savingsGoals:       mappedSavings, 
      };
    },
    CACHE_TTL.MEDIUM
  );

  console.log(summary);
  
  return appResponse(
    res, 200,
    GetDashboardSummaryResponse.parse(summary),
    "Dashboard summary retrieved successfully"
  );
});

export const dashboardSpendingByCategory = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();

  const rows = await TransactionUseCase.getTransactionsByCategory(userId, {
    start: new Date(start),
    end:   new Date(end),
  });

  const result = rows.map(r => ({
    categoryId: r.categoryId,
    amount:     r.amount,
    percentage: r.percentage,
  }));

  return appResponse(res, 200, GetSpendingByCategoryResponse.parse(result));
});