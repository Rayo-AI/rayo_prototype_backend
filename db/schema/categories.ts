import { pgTable, serial, text, integer, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const categoriesTable = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    slug: text("slug").notNull(),

    parentSlug: text("parent_slug").notNull(),

    emoji: text("emoji"),

    isSystem: boolean("is_system")
      .notNull()
      .default(false),
  }
);

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;