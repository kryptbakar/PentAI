import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { targetsTable } from "./targets";

export const scansTable = pgTable("scans", {
  id: serial("id").primaryKey(),
  targetId: integer("target_id").notNull().references(() => targetsTable.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  phase: text("phase").notNull(), // recon | scan | exploit | intel
  status: text("status").notNull().default("queued"), // queued | running | completed | failed | cancelled
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScanSchema = createInsertSchema(scansTable).omit({ id: true, createdAt: true, startedAt: true, completedAt: true, errorMessage: true });
export type InsertScan = z.infer<typeof insertScanSchema>;
export type Scan = typeof scansTable.$inferSelect;
