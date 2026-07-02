import { pgTable, serial, integer, numeric, boolean, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.ts";
import { categoriesTable } from "./categories.ts";

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  categoryId: integer("category_id")
  .notNull()
  .references(() => categoriesTable.id),
  name: text("name").notNull().default(""),
  monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  rollover: boolean("rollover").notNull().default(true), // ← false = zero-based, true = envelope
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCategoryUnique: uniqueIndex("budgets_user_category_unique")
    .on(table.userId, table.categoryId),
}));

export const insertBudgetSchema = createInsertSchema(budgetsTable).omit({ id: true });
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type Budget = typeof budgetsTable.$inferSelect;
