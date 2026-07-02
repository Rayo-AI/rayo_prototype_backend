import { CategoryRepository } from "../repository/category";
import { ErrorResponse } from "../utils/errorResponse";

export class CategoryUseCase {
  static readonly DEFAULT_PARENT_SLUG = "other";

  static normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s&]/g, "")
      .replace(/\s+/g, " ");
  }

  static async resolveCategory(
    userId: number,
    input: { categoryId?: number; categoryName?: string; parentSlug?: string }
  ): Promise<number> {
    if (input.categoryId) return input.categoryId;

    if (!input.categoryName) {
      throw new ErrorResponse("categoryName is required when categoryId is omitted", 400);
    }

    // Fall back to a default bucket (e.g. "other") if the user didn't pick a parent
    const parentSlug = input.parentSlug ?? this.DEFAULT_PARENT_SLUG;

    const parent = await CategoryRepository.findBySlug(parentSlug);
    if (!parent || !parent.isSystem) {
      throw new ErrorResponse(
        `parentSlug "${parentSlug}" is not a valid system category`,
        400
      );
    }

    const normalizedName = this.normalizeName(input.categoryName);
    if (!normalizedName) {
      throw new ErrorResponse("categoryName must contain at least one alphanumeric character", 400);
    }

    const userExists = await CategoryRepository.userExists(userId);
    if (!userExists) {
      throw new ErrorResponse(`User ${userId} not found`, 404);
    }

    const existing = await CategoryRepository.findUserCategoryByNameAndParent(
      userId,
      normalizedName,
      parentSlug
    );
    if (existing) return existing.id;

    const slug = `${parentSlug}__${normalizedName.replace(/\s+/g, "_")}`;

    try {
      const created = await CategoryRepository.create({
        userId,
        name: normalizedName,
        slug,
        parentSlug,
        emoji: null,
        isSystem: false,
      });

      return created.id;
    } catch {
      const fallback = await CategoryRepository.findUserCategoryByNameAndParent(
        userId,
        normalizedName,
        parentSlug
      );

      if (fallback) {
        return fallback.id;
      }

      throw new ErrorResponse("Failed to create category", 500);
    }
  }

  static async listForUser(userId: number) {
    const [system, custom] = await Promise.all([
      CategoryRepository.findAllSystem(),
      CategoryRepository.findByUserId(userId),
    ]);
    return [...system, ...custom];
  }

  static async findCategoryById(categoryId: number) {
    return CategoryRepository.findById(categoryId);
  }
}