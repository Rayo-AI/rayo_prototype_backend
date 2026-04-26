import { Router, type IRouter } from "express";
import { db, savingsGoalsTable } from "../../db/index.ts";
import {
  CreateSavingsGoalBody,
  UpdateSavingsGoalBody,
  UpdateSavingsGoalParams,
  DeleteSavingsGoalParams,
  ListSavingsGoalsResponse,
  UpdateSavingsGoalResponse,
} from "../../validation/index.ts";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.ts";

const router: IRouter = Router();

function mapGoal(g: typeof savingsGoalsTable.$inferSelect) {
  const target = parseFloat(g.targetAmount);
  const current = parseFloat(g.currentAmount);
  return {
    id: g.id,
    userId: g.userId,
    name: g.name,
    targetAmount: target,
    currentAmount: current,
    deadline: g.deadline,
    percentComplete: target > 0 ? Math.min(100, (current / target) * 100) : 0,
  };
}

router.get("/savings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const rows = await db.select().from(savingsGoalsTable).where(eq(savingsGoalsTable.userId, userId));
  res.json(ListSavingsGoalsResponse.parse(rows.map(mapGoal)));
});

router.post("/savings", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = CreateSavingsGoalBody.safeParse(req.body);

  if (!parsed.success) {
    sendValidationError(res, parsed.error!);
    return;
  }

  const [row] = await db
    .insert(savingsGoalsTable)
    .values({
      userId,
      name: parsed.data.name,
      targetAmount: String(parsed.data.targetAmount),
      currentAmount: String(parsed.data.currentAmount ?? 0),
      deadline: parsed.data.deadline,
    })
    .returning();

  res.status(201).json(mapGoal(row));
});

router.patch("/savings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSavingsGoalParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSavingsGoalBody.safeParse(req.body);
  if (!parsed.success) {
    sendValidationError(res, parsed.error!);
    return;
  }

  const updates: Record<string, string | undefined> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.targetAmount !== undefined) updates.targetAmount = String(parsed.data.targetAmount);
  if (parsed.data.currentAmount !== undefined) updates.currentAmount = String(parsed.data.currentAmount);
  if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;

  const [row] = await db
    .update(savingsGoalsTable)
    .set(updates)
    .where(and(eq(savingsGoalsTable.id, params.data.id), eq(savingsGoalsTable.userId, userId)))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Savings goal not found" });
    return;
  }

  res.json(UpdateSavingsGoalResponse.parse(mapGoal(row)));
});

router.delete("/savings/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSavingsGoalParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(savingsGoalsTable)
    .where(and(eq(savingsGoalsTable.id, params.data.id), eq(savingsGoalsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Savings goal not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
