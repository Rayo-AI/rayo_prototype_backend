import { pgTable, serial, integer, text, numeric, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users.ts";
import { categoriesTable } from "./categories.ts";

export const transactionTypeEnum = pgEnum("transaction_type", ["income", "expense"]);

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  categoryId: integer("category_id")
  .notNull()
  .references(() => categoriesTable.id),
  subcategory: text("subcategory").default(""),
  description: text("description").notNull().default(""),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  bill_type: text("bill_type").default(""),
  institution: text("institution").default(""),
  merchant: text("merchant").default(""),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
