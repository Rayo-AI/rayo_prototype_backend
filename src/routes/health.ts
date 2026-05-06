import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "../../validation/index.ts";
import { appResponse } from "../utils/appResponse.ts";

const router: IRouter = Router();

router.get("/health", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  return appResponse(res, 200, data, "Health check successful");
});

export default router;
