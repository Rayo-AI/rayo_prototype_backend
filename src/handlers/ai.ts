import { AskAiBody, GetAiInsightsResponse, AskAiResponse } from "../../validation";
import { AiUseCase } from "../usecases/ai";
import { appResponse } from "../utils/appResponse";
import { asyncHandler } from "../middlewares/asyncHandler";
import { ErrorResponse } from "../utils/errorResponse";

export const getInsights = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;
  const insights = await AiUseCase.generateInsights(userId);
  return appResponse(res, 200, GetAiInsightsResponse.parse(insights));
});

export const askAi = asyncHandler(async (req, res) => {
  const userId = (req as typeof req & { userId: number }).userId;

  const parsed = AskAiBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ErrorResponse("Invalid request body", 400, parsed.error.flatten().fieldErrors);
  }

  const [answer, insights] = await Promise.all([
    AiUseCase.askQuestion(userId, parsed.data.question),
    AiUseCase.generateInsights(userId),
  ]);

  return appResponse(res, 200, AskAiResponse.parse({ answer, insights }));
});