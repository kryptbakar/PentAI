import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scopesTable } from "./scopes";

export const targetsTable = pgTable("targets", {
  id: serial("id").primaryKey(),
  scopeId: integer("scope_id").notNull().references(() => scopesTable.id, { onDelete: "cascade" }),
  host: text("host").notNull(),
  ip: text("ip"),
  portRange: text("port_range"),
  allowed: boolean("allowed").notNull().default(true),
  activeModeEnabled: boolean("active_mode_enabled").notNull().default(false),
  notes: text("notes"),
  // Domain-ownership verification (DNS TXT proof).
  verificationToken: text("verification_token"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTargetSchema = createInsertSchema(targetsTable).omit({ id: true, createdAt: true });
export type InsertTarget = z.infer<typeof insertTargetSchema>;
export type Target = typeof targetsTable.$inferSelect;
