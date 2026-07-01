import { asyncHandler } from "../middlewares/asyncHandler";
import { CreateTransactionBody, DeleteTransactionParams, ListTransactionsQueryParams, ListTransactionsResponse } from "../../validation";
import { TransactionUseCase } from "../usecases/transaction";
import { appResponse } from "../utils/appResponse";
import { ErrorResponse } from "../utils/errorResponse";
import { invalidateCache } from "../lib/cache";
import { CACHE_KEYS } from "../lib/cacheKeys";
import { CategoryUseCase } from "../usecases/category";
import { SavingsUseCase } from "../usecases/savings";

async function syncSavingsGoalOnTransaction(
  userId: number,
  categoryId: number | null | undefined,
  amount: number,
  direction: 1 | -1, // 1 = add to goal, -1 = remove from goal
) {
  if (!categoryId) return;
  const goal = await SavingsUseCase.findByCategoryId(userId, categoryId);
  if (!goal) return; // category isn't tied to any savings goal — no-op
  await SavingsUseCase.adjustCurrentAmount(userId, goal.id, amount * direction);
}

//Calculates the month range key from a transaction date
function getMonthRangeFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEndKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  
  return `${monthKey}-${monthEndKey}`;
}

/**
 * Invalidates all caches affected by a transaction in a given month
 */
async function invalidateTransactionMonthCaches(userId: number, dateStr: string): Promise<void> {
  const monthRange = getMonthRangeFromDate(dateStr);
  
  await Promise.all([
    invalidateCache(CACHE_KEYS.dashboardMonth(userId, monthRange)),
    invalidateCache(CACHE_KEYS.transactions(userId)),
    invalidateCache(CACHE_KEYS.monthlyIncome(userId, monthRange)),
    invalidateCache(CACHE_KEYS.monthlyExpenses(userId, monthRange)),
    invalidateCache(CACHE_KEYS.transactionsByCategory(userId, monthRange)),
  ]);
}

export function parseDMYY(dateStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr; 

  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr; // let Zod handle the error

  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;

  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export const listTransactions = asyncHandler(async (req, res) => {
  const userId = (req as { userId?: number }).userId;
  if (typeof userId !== "number") {
    throw new ErrorResponse("Unauthorized", 401);
  }

  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    throw new ErrorResponse("Invalid query parameters", 400, query.error.flatten().fieldErrors);
  }

  const rows = await TransactionUseCase.getTransactions(userId, {
    parentSlug: query.data.category,
    type: query.data.type,
    startDate: query.data.startDate ? new Date(query.data.startDate) : undefined,
    endDate: query.data.endDate ? new Date(query.data.endDate) : undefined,
    description: query.data.description,
    amount: query.data.amount,
  });

  const transactions = {
    rows: rows.rows.map(t => ({
      id: t.id,
      userId: String(t.userId),
      type: t.type,
      amount: parseFloat(t.amount),
      categoryId: t.categoryId,
      description: t.description,
      institution: t.institution,
      merchant: t.merchant,
      date: t.date,
      createdAt: t.createdAt.toISOString(),
    })),
    pagination: rows.pagination,
  };

  return appResponse(res, 200, ListTransactionsResponse.parse(transactions));
});

export const createTransaction = asyncHandler(async (req, res) => {
  const userId = (req as { userId?: number }).userId;
  if (typeof userId !== "number" || !userId) {
    throw new ErrorResponse("Unauthorized", 401);
  }

  const body = {
    ...req.body,
    date: req.body.date ? parseDMYY(req.body.date) : req.body.date,
  };

  const parsed = CreateTransactionBody.safeParse(body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  // Resolve category name + parentSlug (or an existing categoryId) into a categoryId
  const categoryId = await CategoryUseCase.resolveCategory(userId, {
    categoryId: parsed.data.categoryId,
    categoryName: parsed.data.category,
    parentSlug: parsed.data.parentSlug,
  });

  const row = await TransactionUseCase.createTransaction(userId, {
    type: parsed.data.type,
    amount: parsed.data.amount.toString(),
    categoryId,
    description: parsed.data.description,
    date: parsed.data.date,
  });

  await syncSavingsGoalOnTransaction(userId, categoryId, parseFloat(row.amount), 1);

  await invalidateTransactionMonthCaches(userId, row.date);

  return appResponse(res, 201, {
    id: row.id,
    userId: String(row.userId),
    type: row.type,
    amount: parseFloat(row.amount),
    categoryId: row.categoryId,
    description: row.description,
    date: row.date,
    createdAt: row.createdAt.toISOString(),
  });
});

export const deleteTransaction = asyncHandler(async (req, res, next) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTransactionParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    throw next(new ErrorResponse("Invalid transaction ID", 400, params.error.flatten().fieldErrors));
  }

  const deleted = await TransactionUseCase.deleteTransaction(userId, params.data.id);

  if (!deleted) {
    throw next(new ErrorResponse("Transaction not found or not authorized to delete", 404));
  }

  await syncSavingsGoalOnTransaction(userId, deleted.categoryId, parseFloat(deleted.amount), -1);

  // Invalidate cache for the transaction's actual month (not current month)
  await invalidateTransactionMonthCaches(userId, deleted.date);

  return appResponse(res, 200, { message: "Transaction deleted successfully" });
});

export const deleteMultipleTransactions = asyncHandler(async (req, res, next) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const ids = req.body.ids;
  if (!Array.isArray(ids) || !ids.every(id => typeof id === "number")) {
    throw next(new ErrorResponse("Invalid request body: ids must be an array of numbers", 400));
  }

  // Fetch transactions before deletion to get their dates for cache invalidation
  const rows = await TransactionUseCase.getTransactions(userId, {});
  const transactionsToDelete = rows.rows.filter(t => ids.includes(t.id));

  if (transactionsToDelete.length === 0) {
    throw next(new ErrorResponse("One or more transactions not found or not authorized to delete", 404));
  }

  const deleted = await TransactionUseCase.deleteMultipleTransactions(userId, ids);

  if (!deleted) {
    throw next(new ErrorResponse("One or more transactions not found or not authorized to delete", 404));
  }

  // Invalidate caches for each affected month
  // Group transactions by month to avoid redundant invalidations
  const monthsAffected = new Set<string>();
  for (const transaction of transactionsToDelete) {
    monthsAffected.add(getMonthRangeFromDate(transaction.date));
  }

  await Promise.all(
    Array.from(monthsAffected).map(monthRange =>
      Promise.all([
        invalidateCache(CACHE_KEYS.dashboardMonth(userId, monthRange)),
        invalidateCache(CACHE_KEYS.transactions(userId)),
        invalidateCache(CACHE_KEYS.monthlyIncome(userId, monthRange)),
        invalidateCache(CACHE_KEYS.monthlyExpenses(userId, monthRange)),
        invalidateCache(CACHE_KEYS.transactionsByCategory(userId, monthRange)),
      ])
    )
  );

  return appResponse(res, 200, { message: "Transactions deleted successfully" });
});

export const updateTransaction = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const transactionId = parseInt(raw, 10);

  if (isNaN(transactionId)) {
    throw new ErrorResponse("Invalid transaction ID", 400);
  }

  const body = {
    ...req.body,
    date: req.body.date ? parseDMYY(req.body.date) : req.body.date,
  };

  const parsed = CreateTransactionBody.partial().safeParse(body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  // Only resolve a categoryId if the client actually sent a category to change
  let categoryId: number | undefined;
  if (parsed.data.categoryId) {
    categoryId = parsed.data.categoryId;
  } else if (parsed.data.category) {
    categoryId = await CategoryUseCase.resolveCategory(userId, {
      categoryName: parsed.data.category,
      parentSlug: parsed.data.parentSlug,
    });
  }

  const updated = await TransactionUseCase.updateTransaction(userId, transactionId, {
    type: parsed.data.type,
    amount: parsed.data.amount ? parsed.data.amount.toString() : undefined,
    categoryId,
    description: parsed.data.description,
    date: parsed.data.date,
  });

  if (!updated) {
    throw new ErrorResponse("Transaction not found or not authorized", 404);
  }

  await invalidateTransactionMonthCaches(userId, updated.date);

  return appResponse(res, 200, {
    id: updated.id,
    userId: String(updated.userId),
    type: updated.type,
    amount: parseFloat(updated.amount),
    categoryId: updated.categoryId,
    description: updated.description,
    date: updated.date,
    createdAt: updated.createdAt.toISOString(),
  }, "Transaction updated successfully");
});
  