import { Router, type IRouter } from "express";
import {
  CreateSavingsGoalBody,
  UpdateSavingsGoalBody,
  UpdateSavingsGoalParams,
  DeleteSavingsGoalParams,
  ListSavingsGoalsResponse,
  UpdateSavingsGoalResponse,
} from "../../validation/index.ts";
import { requireAuth } from "../lib/auth.ts";
import { createSavingsGoal, deleteSavingsGoal, getSavingsGoals, updateSavingsGoal } from "../handlers/savings.ts";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/savings", getSavingsGoals);

router.post("/savings", createSavingsGoal);

router.patch("/savings/:id", updateSavingsGoal);

router.delete("/savings/:id", deleteSavingsGoal);

export default router;
