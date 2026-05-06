import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";
import { dashboardSpendingByCategory, dashboardSummary } from "../handlers/dashboard.ts";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/dashboard/summary", dashboardSummary);

router.get("/dashboard/spending-by-category", dashboardSpendingByCategory);

export default router;
