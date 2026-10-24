import { pgTable, serial, text, timestamp, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const logsTable = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    mode: text("mode").notNull(), // "class" | "prep" | "factcheck" | "doubt"
    content: jsonb("content").notNull(),
    verdict: text("verdict"), // only set for factcheck
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("logs_user_id_idx").on(table.userId)],
);

export const insertLogSchema = createInsertSchema(logsTable).omit({ id: true, createdAt: true });
export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logsTable.$inferSelect;
