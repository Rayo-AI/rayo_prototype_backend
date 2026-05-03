import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts"; 
import { deleteBudget, getBudgets, setBudget } from "../handlers/budget.ts";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/budget", getBudgets);

router.post("/budget", setBudget);

router.put("/budget/:id", setBudget);

router.delete("/budget/:category", deleteBudget);

export default router;
