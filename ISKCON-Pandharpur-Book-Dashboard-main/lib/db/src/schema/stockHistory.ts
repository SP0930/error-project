import { pgTable, serial, integer, varchar, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { booksTable } from "./books";

export const stockHistoryTable = pgTable("stock_history", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "cascade" }),
  changeAmount: integer("change_amount").notNull(), // Positive for increase, negative for decrease
  reason: varchar("reason", { length: 50 }).notNull(), // 'sale', 'restock', 'adjustment', 'initial'
  referenceId: integer("reference_id"), // bill_id if reason='sale'
  staffName: varchar("staff_name", { length: 255 }),
  firebaseUid: varchar("firebase_uid", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  bookIdx: index("idx_stock_history_book").on(table.bookId),
  dateIdx: index("idx_stock_history_date").on(table.createdAt),
  reasonIdx: index("idx_stock_history_reason").on(table.reason),
}));

// Zod schemas
export const insertStockHistorySchema = createInsertSchema(stockHistoryTable, {
  bookId: z.number().int().positive(),
  changeAmount: z.number().int(),
  reason: z.enum(["sale", "restock", "adjustment", "initial"]),
  referenceId: z.number().int().positive().optional(),
  staffName: z.string().max(255).optional(),
  firebaseUid: z.string().max(255).optional(),
  notes: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const selectStockHistorySchema = createSelectSchema(stockHistoryTable);

// Types
export type StockHistory = typeof stockHistoryTable.$inferSelect;
export type InsertStockHistory = z.infer<typeof insertStockHistorySchema>;
