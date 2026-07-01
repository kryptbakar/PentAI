import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scopesTable = pgTable("scopes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  signedBy: text("signed_by").notNull(),
  roeActive: boolean("roe_active").notNull().default(true),
  validFrom: text("valid_from"),
  validUntil: text("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertScopeSchema = createInsertSchema(scopesTable).omit({ id: true, createdAt: true });
export type InsertScope = z.infer<typeof insertScopeSchema>;
export type Scope = typeof scopesTable.$inferSelect;
