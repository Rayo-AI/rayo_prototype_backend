import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { getInsights, askAi } from "../handlers/ai";

const router = Router();

router.use(requireAuth);

router.get("/ai/insights", getInsights);
router.post("/ai/ask", askAi);

export default router;