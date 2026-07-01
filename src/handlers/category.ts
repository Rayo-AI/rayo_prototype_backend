import { ListCategoriesResponse } from "../../validation/index.ts";
import { asyncHandler } from "../middlewares/asyncHandler.ts";
import { CategoryUseCase } from "../usecases/category.ts";
import { appResponse } from "../utils/appResponse.ts";
import { ErrorResponse } from "../utils/errorResponse.ts";

export const listCategories = asyncHandler(async (req, res) => {
  const userId = (req as { userId?: number }).userId;

  if (typeof userId !== "number") {
    throw new ErrorResponse("Unauthorized", 401);
  }

  const categories = await CategoryUseCase.listForUser(userId);

  return appResponse(res, 200, ListCategoriesResponse.parse(categories));
});