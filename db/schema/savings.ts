import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  date,
  pgEnum,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { categoriesTable } from "./categories";

export const savingsGoalTypeEnum = pgEnum(
  "savings_goal_type",
  [
    "PERSONAL",
    "GROUP",
    "AJO",
  ]
);

export const savingsGoalsTable = pgTable(
  "savings_goals",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    categoryId: integer("category_id")
      .notNull()
      .references(() => categoriesTable.id),
    subcategory: text("subcategory").default(""),

    goalType: savingsGoalTypeEnum(
      "goal_type"
    )
      .notNull()
      .default("PERSONAL"),

    targetAmount: numeric(
      "target_amount",
      {
        precision: 12,
        scale: 2,
      }
    ).notNull(),

    currentAmount: numeric(
      "current_amount",
      {
        precision: 12,
        scale: 2,
      }
    )
      .notNull()
      .default("0"),

    deadline: date("deadline").notNull(),
  }
);

export const insertSavingsGoalSchema = createInsertSchema(savingsGoalsTable).omit({ id: true });
export type InsertSavingsGoal = z.infer<typeof insertSavingsGoalSchema>;
export type SavingsGoal = typeof savingsGoalsTable.$inferSelect;
