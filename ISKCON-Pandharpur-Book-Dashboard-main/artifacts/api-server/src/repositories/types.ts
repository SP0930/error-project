/**
 * Repository Types
 * 
 * These types mirror the Drizzle schema types but are defined independently
 * for the mock repository. When connecting to Supabase, these will be replaced
 * with actual Drizzle types from @workspace/db/schema
 */

export type Book = {
  id: number;
  name: string;
  language: string;
  mrp: number;
  actualPrice: number;
  stock: number;
  minStock: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertBook = Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & {
  stock?: number;
  minStock?: number;
};

export type UpdateBook = Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>;

export type Bill = {
  id: number;
  billNumber: string;
  customerName: string;
  customerMobile: string | null;
  date: string;
  time: string;
  paymentMethod: 'Cash' | 'Online';
  staffName: string;
  firebaseUid: string | null;
  discountAmount: number;
  discountMode: 'amount' | 'percent' | 'off_mrp' | null;
  discountInput: string | null;
  createdAt: Date;
};

export type InsertBill = Omit<Bill, 'id' | 'createdAt'>;

export type BillItem = {
  id: number;
  billId: number;
  bookId: number;
  quantity: number;
  priceAtSale: number;
  createdAt: Date;
};

export type InsertBillItem = Omit<BillItem, 'id' | 'createdAt'>;

export type StockHistoryReason = 'sale' | 'restock' | 'adjustment' | 'initial';

export type StockHistory = {
  id: number;
  bookId: number;
  changeAmount: number;
  reason: StockHistoryReason;
  referenceId: number | null;
  staffName: string;
  firebaseUid: string | null;
  notes: string | null;
  createdAt: Date;
};

export type InsertStockHistory = Omit<StockHistory, 'id' | 'createdAt'>;

// Query filters
export type BookFilters = {
  language?: string;
  search?: string;
};

export type BillFilters = {
  startDate?: string;
  endDate?: string;
  customerName?: string;
  paymentMethod?: 'Cash' | 'Online';
};


// Repository interfaces
export interface BooksRepository {
  findAll(filters?: BookFilters): Promise<Book[]>;
  findById(id: number): Promise<Book | null>;
  create(data: CreateBookData): Promise<Book>;
  update(id: number, data: UpdateBookData): Promise<Book>;
  updateStock(id: number, newStock: number): Promise<Book>;
  delete(id: number): Promise<void>;
  findLowStock(): Promise<Book[]>;
}

export interface StockHistoryRepository {
  findByBookId(bookId: number, limit?: number): Promise<StockHistoryEntry[]>;
  create(data: CreateStockHistoryData): Promise<StockHistoryEntry>;
  findByReason(reason: StockHistoryReason, limit?: number): Promise<StockHistoryEntry[]>;
}

export interface BillsRepository {
  findAll(filters?: BillFilters): Promise<Bill[]>;
  findById(id: number): Promise<Bill | null>;
  create(data: CreateBillData): Promise<Bill>;
  update(id: number, data: UpdateBillData): Promise<Bill>;
  delete(id: number): Promise<void>;
  getNextBillNumber(): Promise<number>;
}

export interface BillItemsRepository {
  findByBillId(billId: number): Promise<BillItem[]>;
  findByBillIdWithBooks(billId: number): Promise<any[]>;
  create(data: CreateBillItemData): Promise<BillItem>;
  createMany(items: CreateBillItemData[]): Promise<BillItem[]>;
  deleteByBillId(billId: number): Promise<void>;
}

// Data transfer types
export type CreateBookData = Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & {
  stock?: number;
  minStock?: number;
};

export type UpdateBookData = Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>>;

export type CreateBillData = Omit<Bill, 'id' | 'createdAt'>;

export type UpdateBillData = Partial<Omit<Bill, 'id' | 'createdAt'>>;

export type CreateBillItemData = Omit<BillItem, 'id' | 'createdAt'>;

export type StockHistoryEntry = {
  id: number;
  bookId: number;
  changeAmount: number;
  reason: StockHistoryReason;
  referenceId: number | null;
  staffName?: string;
  firebaseUid?: string;
  notes?: string;
  createdAt: string;
};

export type CreateStockHistoryData = {
  bookId: number;
  changeAmount: number;
  reason: StockHistoryReason;
  referenceId: number | null;
  staffName?: string;
  firebaseUid?: string | null;
  notes?: string;
};
