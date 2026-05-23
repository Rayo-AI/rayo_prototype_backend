import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts"; 
import { deleteBudget, getBudgets, setBudget } from "../handlers/budget.ts";
import { budgetLimiter } from "../lib/rateLimiter.ts";
import { parseFormBody } from "../lib/multer.ts";

const router: IRouter = Router();

router.use(requireAuth);
router.use(budgetLimiter);
router.use(parseFormBody);

router.get("/budget", getBudgets);

router.post("/budget", setBudget);

router.put("/budget/:id", setBudget);

router.delete("/budget/:category", deleteBudget);

export default router;
