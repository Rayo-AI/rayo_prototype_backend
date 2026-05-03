import { CreateSavingsGoalBody } from "../../validation";
import { asyncHandler } from "../utils/asyncHandler";

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

export const createSavingsGoal = asyncHandler(async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const parsed = CreateSavingsGoalBody.safeParse(req.body);
});

export const getSavingsGoals = asyncHandler(async (req, res): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const rows = await db.select().from(savingsGoalsTable).where(eq(savingsGoalsTable.userId, userId));
  res.json(ListSavingsGoalsResponse.parse(rows.map(mapGoal)));
});