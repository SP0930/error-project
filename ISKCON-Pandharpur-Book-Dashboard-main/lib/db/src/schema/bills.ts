import { pgTable, serial, varchar, integer, date, time, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const billsTable = pgTable("bills", {
  id: serial("id").primaryKey(),
  billNumber: integer("bill_number").notNull().unique(),
  customerName: varchar("customer_name", { length: 255 }).notNull(),
  customerMobile: varchar("customer_mobile", { length: 20 }),
  date: date("date").notNull(),
  time: time("time").notNull(),
  paymentMethod: varchar("payment_method", { length: 10 }).notNull(), // 'Cash' or 'Online'
  staffName: varchar("staff_name", { length: 255 }).notNull(),
  firebaseUid: varchar("firebase_uid", { length: 255 }), // Firebase user ID for staff
  discountAmount: integer("discount_amount").notNull().default(0),
  discountMode: varchar("discount_mode", { length: 10 }).notNull().default("amount"), // 'amount' or 'percentage'
  discountInput: integer("discount_input").notNull().default(0), // Original input value
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  dateIdx: index("idx_bills_date").on(table.date),
  paymentIdx: index("idx_bills_payment").on(table.paymentMethod),
  customerIdx: index("idx_bills_customer").on(table.customerName),
  firebaseUserIdx: index("idx_bills_firebase_user").on(table.firebaseUid),
}));

// Zod schemas
export const insertBillSchema = createInsertSchema(billsTable, {
  billNumber: z.number().int().positive(),
  customerName: z.string().min(1, "Customer name is required").max(255),
  customerMobile: z.string().max(20).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be in HH:MM or HH:MM:SS format"),
  paymentMethod: z.enum(["Cash", "Online"]),
  staffName: z.string().min(1, "Staff name is required").max(255),
  firebaseUid: z.string().max(255).optional(),
  discountAmount: z.number().int().min(0).default(0),
  discountMode: z.enum(["amount", "percentage"]).default("amount"),
  discountInput: z.number().int().min(0).default(0),
}).omit({
  id: true,
  createdAt: true,
});

export const selectBillSchema = createSelectSchema(billsTable);

// Types
export type Bill = typeof billsTable.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
