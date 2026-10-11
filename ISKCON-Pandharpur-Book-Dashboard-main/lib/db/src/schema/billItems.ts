import { pgTable, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { billsTable } from "./bills";
import { booksTable } from "./books";

export const billItemsTable = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull().references(() => billsTable.id, { onDelete: "cascade" }),
  bookId: integer("book_id").notNull().references(() => booksTable.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull(),
  priceAtSale: integer("price_at_sale").notNull(), // Price at time of sale
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  billIdx: index("idx_bill_items_bill").on(table.billId),
  bookIdx: index("idx_bill_items_book").on(table.bookId),
}));

// Zod schemas
export const insertBillItemSchema = createInsertSchema(billItemsTable, {
  billId: z.number().int().positive(),
  bookId: z.number().int().positive(),
  quantity: z.number().int().positive("Quantity must be positive"),
  priceAtSale: z.number().int().positive("Price must be positive"),
}).omit({
  id: true,
  createdAt: true,
});

export const selectBillItemSchema = createSelectSchema(billItemsTable);

// Types
export type BillItem = typeof billItemsTable.$inferSelect;
export type InsertBillItem = z.infer<typeof insertBillItemSchema>;
