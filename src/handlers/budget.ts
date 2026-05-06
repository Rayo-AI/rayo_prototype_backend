import { GetBudgetResponse, UpsertBudgetBody, UpsertBudgetResponse } from "../../validation";
import { logger } from "../lib/logger";
import { AuthUseCase } from "../usecases/auth";
import { BudgetUseCase } from "../usecases/budget";
import { TransactionUseCase } from "../usecases/transaction";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorResponse } from "../utils/errorResponse";

function getCurrentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function calcBudgetResponse(
  userId: number,
  budget: { id: number; category: string; monthlyLimit: string; balance: string; rollover: boolean },
) {
  const { start, end } = getCurrentMonthRange();
  const monthlyLimit = parseFloat(budget.monthlyLimit);
  const carryover = budget.rollover ? parseFloat(budget.balance) : 0;

  const totalSpent = await TransactionUseCase.getSpentByCategory(userId, budget.category, start, end);
  const remaining = Math.max(0, monthlyLimit + carryover - totalSpent);
  const percentUsed = (monthlyLimit + carryover) > 0
    ? parseFloat(Math.min(100, (totalSpent / (monthlyLimit + carryover)) * 100).toFixed(2))
    : 0;

  return {
    id: budget.id,
    userId,
    category: budget.category,
    monthlyLimit,
    totalSpent,
    remaining,
    percentUsed,
    rollover: budget.rollover,
  };
}

export const getBudgets = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const budgets = await BudgetUseCase.getBudget(userId);
  const { start, end } = getCurrentMonthRange();

  const response = await Promise.all(
    budgets.rows.map(async (b) => {
      const totalSpent = await TransactionUseCase.getSpentByCategory(userId, b.category, start, end);
      const monthlyLimit = parseFloat(b.monthlyLimit);
      const remaining = Math.max(0, monthlyLimit - totalSpent);
      const percentUsed = monthlyLimit > 0 ? parseFloat(Math.min(100, (totalSpent / monthlyLimit) * 100).toFixed(2)) : 0;
      return { id: b.id, userId, category: b.category, monthlyLimit, totalSpent, remaining, percentUsed, rollover: b.rollover };
    })
  );

  return appResponse(res, 200, response);
});

export const setBudget = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const params = req.params;

  const parsed = UpsertBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const { category, monthlyLimit } = parsed.data;

  const existing = await BudgetUseCase.getBudgetByCategory(userId, category);
  const budget = existing
    ? await BudgetUseCase.updateBudget(userId, category, monthlyLimit)
    : await BudgetUseCase.createBudget(userId, category, monthlyLimit);

  const response = await calcBudgetResponse(userId, budget);
  const validated = UpsertBudgetResponse.parse(response);
  logger.info(`Budget for category "${category}" ${existing ? "updated" : "created"} for user ID ${userId}`);
  return appResponse(res, 200, validated);
});

export async function processMonthRollover(userId: number, start: string, end: string) {
  const user = await AuthUseCase.findUserById(userId);
  const budgets = await BudgetUseCase.getBudget(userId);

  for (const budget of budgets.rows) {
    // per-category rollover overrides global preference
    const isEnvelope = budget.rollover ?? user.envelopeBased;
    if (!isEnvelope) continue;

    const spent = await TransactionUseCase.getSpentByCategory(userId, budget.category, start, end);
    const leftover = parseFloat(budget.monthlyLimit) - spent;
    const newBalance = parseFloat(budget.balance) + leftover;
    await BudgetUseCase.updateBalance(userId, budget.category, newBalance);
  }
}

export const resetBalancesForMonthRollover = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const { start, end } = getCurrentMonthRange();
  await BudgetUseCase.resetBalancesForMonthRollover(userId, start, end);
  return appResponse(res, 200, { message: "Balances reset for month rollover" });
});

export const deleteBudget = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const category = String(req.params.category);

  if (!category) {
    throw new ErrorResponse("Category is required", 400);
  }

  const existing = await BudgetUseCase.getBudgetByCategory(userId, category);
  if (!existing) {
    throw new ErrorResponse(`Budget for category "${category}" not found`, 404);
  }

  await BudgetUseCase.deleteBudget(userId, category);
  logger.info(`Budget for category "${category}" deleted for user ID ${userId}`);
  
  return appResponse(res, 200, { message: `Budget for category "${category}" deleted successfully` });
});

