import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { targetsTable } from "./targets";

export const auditEntriesTable = pgTable("audit_entries", {
  id: serial("id").primaryKey(),
  operator: text("operator").notNull().default("system"),
  targetId: integer("target_id").references(() => targetsTable.id, { onDelete: "set null" }),
  tool: text("tool").notNull(),
  flags: text("flags"),
  authorizedBy: text("authorized_by"),
  outcome: text("outcome").notNull().default("allowed"), // allowed | denied
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditEntrySchema = createInsertSchema(auditEntriesTable).omit({ id: true, createdAt: true });
export type InsertAuditEntry = z.infer<typeof insertAuditEntrySchema>;
export type AuditEntry = typeof auditEntriesTable.$inferSelect;
