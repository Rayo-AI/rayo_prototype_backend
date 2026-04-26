import { Router, type IRouter } from "express";
import { db, budgetsTable, transactionsTable } from "../../db/index.ts";
import { UpsertBudgetBody, GetBudgetResponse, UpsertBudgetResponse } from "../../validation/index.ts";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.ts"; 

const router: IRouter = Router();

function getCurrentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

async function calcBudgetResponse(userId: number, monthlyLimit: number, budgetId: number) {
  const { start, end } = getCurrentMonthRange();
  const [spendResult] = await db
    .select({ total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.type, "expense"),
        gte(transactionsTable.date, start),
        lte(transactionsTable.date, end)
      )
    );

  const totalSpent = parseFloat(spendResult?.total ?? "0");
  const remaining = Math.max(0, monthlyLimit - totalSpent);
  const percentUsed = monthlyLimit > 0 ? Math.min(100, (totalSpent / monthlyLimit) * 100) : 0;

  return GetBudgetResponse.parse({
    id: budgetId,
    userId,
    monthlyLimit,
    totalSpent,
    remaining,
    percentUsed,
  });
}

router.get("/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const [budget] = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  if (!budget) {
    res.status(404).json({ error: "No budget set" });
    return;
  }

  res.json(await calcBudgetResponse(userId, parseFloat(budget.monthlyLimit), budget.id));
});

router.post("/budget", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = UpsertBudgetBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const monthlyLimit = parsed.data.monthlyLimit;
  const [existing] = await db.select().from(budgetsTable).where(eq(budgetsTable.userId, userId));

  let budget;
  if (existing) {
    [budget] = await db
      .update(budgetsTable)
      .set({ monthlyLimit: String(monthlyLimit) })
      .where(eq(budgetsTable.id, existing.id))
      .returning();
  } else {
    [budget] = await db
      .insert(budgetsTable)
      .values({ userId, monthlyLimit: String(monthlyLimit) })
      .returning();
  }

  res.json(await calcBudgetResponse(userId, monthlyLimit, budget.id));
});

export default router;
