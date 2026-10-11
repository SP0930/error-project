import { pgTable, serial, varchar, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  language: varchar("language", { length: 100 }).notNull(),
  mrp: integer("mrp").notNull(), // Maximum Retail Price
  actualPrice: integer("actual_price").notNull(), // Selling price
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(10),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  languageIdx: index("idx_books_language").on(table.language),
  stockIdx: index("idx_books_stock").on(table.stock),
}));

// Zod schemas for validation
export const insertBookSchema = createInsertSchema(booksTable, {
  name: z.string().min(1, "Book name is required").max(255),
  language: z.string().min(1, "Language is required").max(100),
  mrp: z.number().int().positive("MRP must be positive"),
  actualPrice: z.number().int().positive("Actual price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative").default(0),
  minStock: z.number().int().min(0, "Minimum stock cannot be negative").default(10),
}).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const updateBookSchema = insertBookSchema.partial();

export const selectBookSchema = createSelectSchema(booksTable);

// Types
export type Book = typeof booksTable.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type UpdateBook = z.infer<typeof updateBookSchema>;
