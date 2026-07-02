import { and, asc, eq } from "drizzle-orm";
import { categoriesTable, db, usersTable } from "../../db/index.ts";
import type { Category, InsertCategory } from "../../db/schema/categories.ts";

export class CategoryRepository {
  static async findBySlug(slug: string): Promise<Category | undefined> {
    const [row] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.slug, slug))
      .limit(1);
    return row;
  }

  static async userExists(userId: number): Promise<boolean> {
    const [row] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return Boolean(row);
  }

  static async findAllSystem(): Promise<Category[]> {
    return db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.isSystem, true));
  }

  static async findUserCategoryByNameAndParent(
    userId: number,
    name: string,
    parentSlug: string
  ): Promise<Category | undefined> {
    const [row] = await db
      .select()
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.userId, userId),
          eq(categoriesTable.name, name),
          eq(categoriesTable.parentSlug, parentSlug)
        )
      )
      .limit(1);
    return row;
  }

  static async create(category: InsertCategory): Promise<Category> {
    const [row] = await db
      .insert(categoriesTable)
      .values(category)
      .returning();
    return row;
  }

  static async findById(id: number): Promise<Category | undefined> {
    const [row] = await db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .limit(1);
    return row;
  }

  static async findByUserId(userId: number): Promise<Category[]> {
    return db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.userId, userId));
  }

  static async findByParentSlug(parentSlug: string): Promise<Category[]> {
    return db
      .select()
      .from(categoriesTable)
      .where(eq(categoriesTable.parentSlug, parentSlug));
  }

  static async findByUserIdAndParentSlug(
    userId: number,
    parentSlug: string
  ): Promise<Category[]> {
    return db
      .select()
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.userId, userId),
          eq(categoriesTable.parentSlug, parentSlug)
        )
      );
  }

  static async findByUserIdAndSlug(
    userId: number,
    slug: string
  ): Promise<Category | undefined> {
    const [row] = await db
      .select()
      .from(categoriesTable)
      .where(
        and(
          eq(categoriesTable.userId, userId),
          eq(categoriesTable.slug, slug)
        )
      )
      .limit(1);
    return row;
  }

  static async deleteById(id: number): Promise<void> {
    await db
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, id));
  }

  static async updateById(
    id: number,
    updates: Partial<Pick<Category, "name" | "slug" | "parentSlug" | "emoji" | "isSystem">>
  ): Promise<Category | undefined> {
    const [row] = await db
      .update(categoriesTable)
      .set(updates)
      .where(eq(categoriesTable.id, id))
      .returning();
    return row;
  }

  static async getAllCategories() {
    return db
      .select()
      .from(categoriesTable)
      .orderBy(asc(categoriesTable.parentSlug), asc(categoriesTable.id));
  }
}