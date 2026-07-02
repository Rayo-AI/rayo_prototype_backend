import { GetBudgetResponse, UpsertBudgetBody, UpsertBudgetResponse } from "../../validation";
import { logger } from "../lib/logger";
import { AuthUseCase } from "../usecases/auth";
import { BudgetUseCase } from "../usecases/budget";
import { TransactionUseCase } from "../usecases/transaction";
import { CategoryUseCase } from "../usecases/category";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../middlewares/asyncHandler";
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
  budget: { id: number; name: string; categoryId: number; monthlyLimit: string; balance: string; rollover: boolean },
) {
  const { start, end } = getCurrentMonthRange();
  const category = await CategoryUseCase.findCategoryById(budget.categoryId);
  const monthlyLimit = parseFloat(budget.monthlyLimit);
  const carryover = budget.rollover ? parseFloat(budget.balance) : 0;

  const totalSpent = category
    ? await TransactionUseCase.getSpentByParentSlug(userId, category.parentSlug, start, end)
    : 0;
  const remaining = Math.max(0, monthlyLimit + carryover - totalSpent);
  const percentUsed = (monthlyLimit + carryover) > 0
    ? parseFloat(Math.min(100, (totalSpent / (monthlyLimit + carryover)) * 100).toFixed(2))
    : 0;

  return {
    id: budget.id,
    userId,
    name: budget.name,
    categoryId: budget.categoryId,
    category: category?.name,
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

  const response = await Promise.all(
    budgets.rows.map((b) => calcBudgetResponse(userId, b))
  );

  return appResponse(res, 200, response);
});

export const setBudget = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;

  const parsed = UpsertBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const categoryId = parsed.data.categoryId
    ?? await CategoryUseCase.resolveCategory(userId, {
        categoryName: parsed.data.category,
        parentSlug: parsed.data.parentSlug,
      });

  const { name, monthlyLimit, rollover } = parsed.data;

  const existing = await BudgetUseCase.getBudgetByCategoryId(userId, categoryId);
  const budget = existing
    ? await BudgetUseCase.updateBudget(userId, categoryId, { monthlyLimit, name })
    : await BudgetUseCase.createBudget(userId, name, categoryId, monthlyLimit, rollover);

  if (!budget) {
    throw new ErrorResponse("Failed to create or update budget", 500);
  }

  const response = await calcBudgetResponse(userId, budget);
  const validated = UpsertBudgetResponse.parse(response);
  return appResponse(res, 200, validated);
});

export async function processMonthRollover(userId: number, start: string, end: string) {
  const user = await AuthUseCase.findUserById(userId);
  const budgets = await BudgetUseCase.getBudget(userId);

  for (const budget of budgets.rows) {
    const isEnvelope = budget.rollover ?? user.envelopeBased;
    if (!isEnvelope) continue;

    const category = await CategoryUseCase.findCategoryById(budget.categoryId);
    if (!category) continue;

    const spent = await TransactionUseCase.getSpentByParentSlug(userId, category.parentSlug, start, end);
    const leftover = parseFloat(budget.monthlyLimit) - spent;
    const newBalance = parseFloat(budget.balance) + leftover;
    await BudgetUseCase.updateBalance(userId, budget.categoryId, newBalance);
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
  const categoryId = parseInt(String(req.params.category), 10);

  if (isNaN(categoryId)) {
    throw new ErrorResponse("Valid category ID is required", 400);
  }

  const existing = await BudgetUseCase.getBudgetByCategoryId(userId, categoryId);
  if (!existing) {
    throw new ErrorResponse(`Budget for category ID ${categoryId} not found`, 404);
  }

  await BudgetUseCase.deleteBudget(userId, categoryId);
  logger.info(`Budget for category ID ${categoryId} deleted for user ID ${userId}`);

  return appResponse(res, 200, { message: `Budget for category ID ${categoryId} deleted successfully` });
});