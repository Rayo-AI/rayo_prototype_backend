import { Router, type IRouter } from "express";
import { requireAuth } from "../lib/auth.ts";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth);

router.get("/dashboard/spending-by-category", requireAuth);

export default router;
