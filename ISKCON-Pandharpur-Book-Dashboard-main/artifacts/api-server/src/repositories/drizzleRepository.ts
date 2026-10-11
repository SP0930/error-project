/**
 * Drizzle Repository Implementation
 * 
 * Real database operations using Drizzle ORM and PostgreSQL/Supabase
 */

import { db, booksTable, stockHistoryTable, billsTable, billItemsTable } from "@workspace/db";
import { eq, and, ilike, or, desc, gte, lte, sql } from "drizzle-orm";
import type {
  Book,
  CreateBookData,
  UpdateBookData,
  StockHistoryEntry,
  CreateStockHistoryData,
  BooksRepository,
  StockHistoryRepository,
  Bill,
  CreateBillData,
  UpdateBillData,
  BillItem,
  CreateBillItemData,
  BillsRepository,
  BillItemsRepository,
} from "./types";

// ============================================================================
// BOOKS REPOSITORY
// ============================================================================

class DrizzleBooksRepository implements BooksRepository {
  async findAll(filters?: {
    language?: string;
    search?: string;
  }): Promise<Book[]> {
    let query = db.select().from(booksTable);

    const conditions = [];

    if (filters?.language) {
      conditions.push(eq(booksTable.language, filters.language));
    }

    if (filters?.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(booksTable.name, searchTerm),
          ilike(booksTable.language, searchTerm)
        )!
      );
    }

    if (conditions.length > 0) {
      // @ts-ignore - Drizzle typing issue with and()
      query = query.where(and(...conditions));
    }

    const books = await query;

    return books.map((book) => ({
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    }));
  }

  async findById(id: number): Promise<Book | null> {
    const [book] = await db
      .select()
      .from(booksTable)
      .where(eq(booksTable.id, id))
      .limit(1);

    if (!book) return null;

    return {
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }

  async create(data: CreateBookData): Promise<Book> {
    const [book] = await db
      .insert(booksTable)
      .values({
        name: data.name,
        language: data.language,
        mrp: data.mrp,
        actualPrice: data.actualPrice,
        stock: data.stock ?? 0,
        minStock: data.minStock ?? 10,
      })
      .returning();

    return {
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }

  async update(id: number, data: UpdateBookData): Promise<Book> {
    const [book] = await db
      .update(booksTable)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(booksTable.id, id))
      .returning();

    if (!book) {
      throw new Error(`Book with id ${id} not found`);
    }

    return {
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }

  async updateStock(id: number, newStock: number): Promise<Book> {
    const [book] = await db
      .update(booksTable)
      .set({
        stock: newStock,
        updatedAt: new Date(),
      })
      .where(eq(booksTable.id, id))
      .returning();

    if (!book) {
      throw new Error(`Book with id ${id} not found`);
    }

    return {
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  }

  async delete(id: number): Promise<void> {
    await db.delete(booksTable).where(eq(booksTable.id, id));
  }

  async findLowStock(): Promise<Book[]> {
    const books = await db
      .select()
      .from(booksTable)
      .where(eq(booksTable.stock, 0));

    return books.map((book) => ({
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      stock: book.stock,
      minStock: book.minStock,
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    }));
  }
}

// ============================================================================
// STOCK HISTORY REPOSITORY
// ============================================================================

class DrizzleStockHistoryRepository implements StockHistoryRepository {
  async findByBookId(
    bookId: number,
    limit: number = 50
  ): Promise<StockHistoryEntry[]> {
    const entries = await db
      .select()
      .from(stockHistoryTable)
      .where(eq(stockHistoryTable.bookId, bookId))
      .orderBy(desc(stockHistoryTable.createdAt))
      .limit(limit);

    return entries.map((entry) => ({
      id: entry.id,
      bookId: entry.bookId,
      changeAmount: entry.changeAmount,
      reason: entry.reason as "sale" | "restock" | "adjustment" | "initial",
      referenceId: entry.referenceId,
      staffName: entry.staffName ?? undefined,
      firebaseUid: entry.firebaseUid ?? undefined,
      notes: entry.notes ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async create(data: CreateStockHistoryData): Promise<StockHistoryEntry> {
    const [entry] = await db
      .insert(stockHistoryTable)
      .values({
        bookId: data.bookId,
        changeAmount: data.changeAmount,
        reason: data.reason,
        referenceId: data.referenceId ?? null,
        staffName: data.staffName ?? null,
        firebaseUid: data.firebaseUid ?? null,
        notes: data.notes ?? null,
      })
      .returning();

    return {
      id: entry.id,
      bookId: entry.bookId,
      changeAmount: entry.changeAmount,
      reason: entry.reason as "sale" | "restock" | "adjustment" | "initial",
      referenceId: entry.referenceId,
      staffName: entry.staffName ?? undefined,
      firebaseUid: entry.firebaseUid ?? undefined,
      notes: entry.notes ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  async findByReason(
    reason: "sale" | "restock" | "adjustment" | "initial",
    limit: number = 50
  ): Promise<StockHistoryEntry[]> {
    const entries = await db
      .select()
      .from(stockHistoryTable)
      .where(eq(stockHistoryTable.reason, reason))
      .orderBy(desc(stockHistoryTable.createdAt))
      .limit(limit);

    return entries.map((entry) => ({
      id: entry.id,
      bookId: entry.bookId,
      changeAmount: entry.changeAmount,
      reason: entry.reason as "sale" | "restock" | "adjustment" | "initial",
      referenceId: entry.referenceId,
      staffName: entry.staffName ?? undefined,
      firebaseUid: entry.firebaseUid ?? undefined,
      notes: entry.notes ?? undefined,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}

// ============================================================================
// BILLS REPOSITORY
// ============================================================================

class DrizzleBillsRepository implements BillsRepository {
  async findAll(filters?: {
    startDate?: string;
    endDate?: string;
    customerName?: string;
    paymentMethod?: "Cash" | "Online";
  }): Promise<Bill[]> {
    let query = db.select().from(billsTable);

    const conditions = [];

    if (filters?.startDate) {
      conditions.push(gte(billsTable.date, filters.startDate));
    }

    if (filters?.endDate) {
      conditions.push(lte(billsTable.date, filters.endDate));
    }

    if (filters?.customerName) {
      const searchTerm = `%${filters.customerName}%`;
      conditions.push(ilike(billsTable.customerName, searchTerm));
    }

    if (filters?.paymentMethod) {
      conditions.push(eq(billsTable.paymentMethod, filters.paymentMethod));
    }

    if (conditions.length > 0) {
      // @ts-ignore - Drizzle typing issue
      query = query.where(and(...conditions));
    }

    const bills = await query.orderBy(desc(billsTable.createdAt));

    return bills.map((bill) => ({
      id: bill.id,
      billNumber: String(bill.billNumber),
      customerName: bill.customerName,
      customerMobile: bill.customerMobile || null,
      date: bill.date,
      time: bill.time,
      paymentMethod: bill.paymentMethod as "Cash" | "Online",
      staffName: bill.staffName,
      firebaseUid: bill.firebaseUid || null,
      discountAmount: bill.discountAmount,
      discountMode: bill.discountMode as "amount" | "percent" | "off_mrp" | null,
      discountInput: String(bill.discountInput),
      createdAt: bill.createdAt.toISOString(),
    }));
  }

  async findById(id: number): Promise<Bill | null> {
    const [bill] = await db
      .select()
      .from(billsTable)
      .where(eq(billsTable.id, id))
      .limit(1);

    if (!bill) return null;

    return {
      id: bill.id,
      billNumber: String(bill.billNumber),
      customerName: bill.customerName,
      customerMobile: bill.customerMobile || null,
      date: bill.date,
      time: bill.time,
      paymentMethod: bill.paymentMethod as "Cash" | "Online",
      staffName: bill.staffName,
      firebaseUid: bill.firebaseUid || null,
      discountAmount: bill.discountAmount,
      discountMode: bill.discountMode as "amount" | "percent" | "off_mrp" | null,
      discountInput: String(bill.discountInput),
      createdAt: bill.createdAt.toISOString(),
    };
  }

  async create(data: CreateBillData): Promise<Bill> {
    const [bill] = await db
      .insert(billsTable)
      .values({
        billNumber: Number(data.billNumber),
        customerName: data.customerName,
        customerMobile: data.customerMobile || null,
        date: data.date,
        time: data.time,
        paymentMethod: data.paymentMethod,
        staffName: data.staffName,
        firebaseUid: data.firebaseUid || null,
        discountAmount: data.discountAmount,
        discountMode: data.discountMode || "amount",
        discountInput: Number(data.discountInput) || 0,
      })
      .returning();

    return {
      id: bill.id,
      billNumber: String(bill.billNumber),
      customerName: bill.customerName,
      customerMobile: bill.customerMobile || null,
      date: bill.date,
      time: bill.time,
      paymentMethod: bill.paymentMethod as "Cash" | "Online",
      staffName: bill.staffName,
      firebaseUid: bill.firebaseUid || null,
      discountAmount: bill.discountAmount,
      discountMode: bill.discountMode as "amount" | "percent" | "off_mrp" | null,
      discountInput: String(bill.discountInput),
      createdAt: bill.createdAt.toISOString(),
    };
  }

  async update(id: number, data: UpdateBillData): Promise<Bill> {
    const [bill] = await db
      .update(billsTable)
      .set(data)
      .where(eq(billsTable.id, id))
      .returning();

    if (!bill) {
      throw new Error(`Bill with id ${id} not found`);
    }

    return {
      id: bill.id,
      billNumber: String(bill.billNumber),
      customerName: bill.customerName,
      customerMobile: bill.customerMobile || null,
      date: bill.date,
      time: bill.time,
      paymentMethod: bill.paymentMethod as "Cash" | "Online",
      staffName: bill.staffName,
      firebaseUid: bill.firebaseUid || null,
      discountAmount: bill.discountAmount,
      discountMode: bill.discountMode as "amount" | "percent" | "off_mrp" | null,
      discountInput: String(bill.discountInput),
      createdAt: bill.createdAt.toISOString(),
    };
  }

  async delete(id: number): Promise<void> {
    await db.delete(billsTable).where(eq(billsTable.id, id));
  }

  async getNextBillNumber(): Promise<number> {
    const result = await db
      .select({ maxBillNumber: sql<number>`MAX(${billsTable.billNumber})` })
      .from(billsTable);

    const maxBillNumber = result[0]?.maxBillNumber;
    return maxBillNumber ? maxBillNumber + 1 : 1001;
  }
}

// ============================================================================
// BILL ITEMS REPOSITORY
// ============================================================================

class DrizzleBillItemsRepository implements BillItemsRepository {
  async findByBillId(billId: number): Promise<BillItem[]> {
    const items = await db
      .select()
      .from(billItemsTable)
      .where(eq(billItemsTable.billId, billId))
      .orderBy(billItemsTable.id);

    return items.map((item) => ({
      id: item.id,
      billId: item.billId,
      bookId: item.bookId,
      quantity: item.quantity,
      priceAtSale: item.priceAtSale,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async findByBillIdWithBooks(billId: number): Promise<any[]> {
    const items = await db
      .select({
        id: billItemsTable.id,
        billId: billItemsTable.billId,
        bookId: billItemsTable.bookId,
        quantity: billItemsTable.quantity,
        priceAtSale: billItemsTable.priceAtSale,
        createdAt: billItemsTable.createdAt,
        book: {
          id: booksTable.id,
          name: booksTable.name,
          author: booksTable.author,
          category: booksTable.category,
          language: booksTable.language,
          price: booksTable.price,
          stock: booksTable.stock,
        },
      })
      .from(billItemsTable)
      .innerJoin(booksTable, eq(billItemsTable.bookId, booksTable.id))
      .where(eq(billItemsTable.billId, billId))
      .orderBy(billItemsTable.id);

    return items.map((item) => ({
      id: item.id,
      billId: item.billId,
      bookId: item.bookId,
      quantity: item.quantity,
      priceAtSale: item.priceAtSale,
      createdAt: item.createdAt.toISOString(),
      book: item.book,
    }));
  }

  async create(data: CreateBillItemData): Promise<BillItem> {
    const [item] = await db
      .insert(billItemsTable)
      .values({
        billId: data.billId,
        bookId: data.bookId,
        quantity: data.quantity,
        priceAtSale: data.priceAtSale,
      })
      .returning();

    return {
      id: item.id,
      billId: item.billId,
      bookId: item.bookId,
      quantity: item.quantity,
      priceAtSale: item.priceAtSale,
      createdAt: item.createdAt.toISOString(),
    };
  }

  async createMany(items: CreateBillItemData[]): Promise<BillItem[]> {
    const created = await db
      .insert(billItemsTable)
      .values(
        items.map((item) => ({
          billId: item.billId,
          bookId: item.bookId,
          quantity: item.quantity,
          priceAtSale: item.priceAtSale,
        }))
      )
      .returning();

    return created.map((item) => ({
      id: item.id,
      billId: item.billId,
      bookId: item.bookId,
      quantity: item.quantity,
      priceAtSale: item.priceAtSale,
      createdAt: item.createdAt.toISOString(),
    }));
  }

  async deleteByBillId(billId: number): Promise<void> {
    await db.delete(billItemsTable).where(eq(billItemsTable.billId, billId));
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export const booksRepository = new DrizzleBooksRepository();
export const stockHistoryRepository = new DrizzleStockHistoryRepository();
export const billsRepository = new DrizzleBillsRepository();
export const billItemsRepository = new DrizzleBillItemsRepository();
