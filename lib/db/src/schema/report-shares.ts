import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reportsTable } from "./reports";

/**
 * Shareable read-only report links. A random token maps to a report; anyone
 * with the link can view the report at /shared/reports/{token} without auth.
 */
export const reportSharesTable = pgTable("report_shares", {
  id: serial("id").primaryKey(),
  reportId: integer("report_id").notNull().references(() => reportsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReportShareSchema = createInsertSchema(reportSharesTable).omit({ id: true, createdAt: true });
export type InsertReportShare = z.infer<typeof insertReportShareSchema>;
export type ReportShare = typeof reportSharesTable.$inferSelect;
