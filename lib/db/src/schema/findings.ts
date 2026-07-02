import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scansTable } from "./scans";
import { targetsTable } from "./targets";

export const findingsTable = pgTable("findings", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().references(() => scansTable.id, { onDelete: "cascade" }),
  targetId: integer("target_id").notNull().references(() => targetsTable.id, { onDelete: "cascade" }),
  tool: text("tool").notNull(),
  severity: text("severity").notNull(), // critical | high | medium | low | info
  title: text("title").notNull(),
  description: text("description"),
  evidence: text("evidence"),
  cveRefs: text("cve_refs").array(),
  remediation: text("remediation"),
  raw: text("raw"),
  // Triage lifecycle: open | triaged | accepted_risk | fixed | regressed
  status: text("status").notNull().default("open"),
  cvssScore: text("cvss_score"),
  cwe: text("cwe"),
  // AI-assigned business risk (may differ from the raw scanner severity).
  businessRisk: text("business_risk"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFindingSchema = createInsertSchema(findingsTable).omit({ id: true, createdAt: true });
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findingsTable.$inferSelect;
