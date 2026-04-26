import { Router, type IRouter } from "express";
import healthRouter from "./health.ts";
import authRouter from "./auth.ts";
import transactionsRouter from "./transactions.ts";
import budgetRouter from "./budget.ts";
import savingsRouter from "./savings.ts";
import dashboardRouter from "./dashboard.ts";
import aiRouter from "./ai.ts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(transactionsRouter);
router.use(budgetRouter);
router.use(savingsRouter);
router.use(dashboardRouter);
router.use(aiRouter);

export default router;
