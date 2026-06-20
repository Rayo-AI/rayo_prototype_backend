import { CreateSavingsGoalBody, DeleteSavingsGoalParams, ListSavingsGoalsResponse, UpdateSavingsGoalBody, UpdateSavingsGoalParams, UpdateSavingsGoalResponse } from "../../validation";
import { SavingsUseCase } from "../usecases/savings";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { ErrorResponse } from "../utils/errorResponse";
import { parseDMYY } from "./transactions";

export const createSavingsGoal = asyncHandler(async (req, res, next): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;

  const body = {
    ...req.body,
    deadline: req.body.deadline ? parseDMYY(req.body.deadline) : req.body.deadline,
  };

  const parsed = CreateSavingsGoalBody.safeParse(body);
  if (!parsed.success) {
    throw next(new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors));
  }

  console.log("Received create savings goal request with body:", body); // Debugging log
  console.log("Parsed deadline:", req.body.deadline, parsed.data.deadline, typeof parsed.data.deadline); // Debugging log
  
  const savingsGoal = await SavingsUseCase.createSavingsGoal(userId, parsed.data.name, parsed.data.targetAmount, parsed.data.deadline);
  return appResponse(res, 201, savingsGoal, "Savings goal created successfully");
});

export const getSavingsGoals = asyncHandler(async (req, res, next) => {
  const userId = (req as typeof req & { userId: number }).userId;

  const query = req.query;

  const filters: {
    name?: string;
    deadlineBefore?: string;
    deadlineAfter?: string;
  } = {};

  if (typeof query.name === "string") filters.name = query.name;
  if (typeof query.deadlineBefore === "string") filters.deadlineBefore = query.deadlineBefore;
  if (typeof query.deadlineAfter === "string") filters.deadlineAfter = query.deadlineAfter;
  
  const savingsGoals = await SavingsUseCase.getSavingsGoals(userId, filters);
  console.log("Retrieved savings goals:", savingsGoals.rows); // Debugging log
  return appResponse(res, 200, ListSavingsGoalsResponse.parse(savingsGoals), "Savings goals retrieved successfully");
});

export const updateSavingsGoal = asyncHandler(async (req, res, next): Promise<void> => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateSavingsGoalParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    throw next(new ErrorResponse("Invalid path parameter", 400, params.error.flatten().fieldErrors));
  }

  const parsed = UpdateSavingsGoalBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.format());
  }

  const updates: Record<string, string> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.targetAmount !== undefined) updates.targetAmount = String(parsed.data.targetAmount);
  if (parsed.data.currentAmount !== undefined) updates.currentAmount = String(parsed.data.currentAmount);
  if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;

  const savingsGoal = await SavingsUseCase.updateSavingsGoal(userId, params.data.id, updates);

  if (!savingsGoal) {
    throw next(new ErrorResponse("Savings goal not found", 404));
  }

  return appResponse(res, 200, UpdateSavingsGoalResponse.parse(savingsGoal), "Savings goal updated successfully");
});

export const deleteSavingsGoal = asyncHandler(async (req, res, next) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteSavingsGoalParams.safeParse({ id: parseInt(raw, 10) });

  if (!params.success) {
    throw next(new ErrorResponse("Invalid path parameter", 400, params.error.flatten().fieldErrors));
  }

  const savingsGoal = await SavingsUseCase.deleteSavingsGoal(userId, params.data.id);

  if (!savingsGoal) {
    throw next(new ErrorResponse("Savings goal not found", 404));
  }

  return appResponse(res, 200, null, "Savings goal deleted successfully");
});