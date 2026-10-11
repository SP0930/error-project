/**
 * Mock Data Repository
 * 
 * This provides an in-memory data store that mimics database operations.
 * When Supabase is connected, this entire file will be replaced with
 * real Drizzle ORM queries to PostgreSQL.
 * 
 * All business logic uses this repository interface, making the swap seamless.
 */

import {
  Book,
  InsertBook,
  UpdateBook,
  Bill,
  InsertBill,
  BillItem,
  InsertBillItem,
  StockHistory,
  InsertStockHistory,
  BookFilters,
  BillFilters,
} from "./types";

// In-memory data stores
let books: Book[] = [];
let bills: Bill[] = [];
let billItems: BillItem[] = [];
let stockHistory: StockHistory[] = [];

// Auto-increment IDs
let bookIdCounter = 1;
let billIdCounter = 1;
let billItemIdCounter = 1;
let stockHistoryIdCounter = 1;

// ============================================================================
// BOOKS REPOSITORY
// ============================================================================

export const booksRepository = {
  /**
   * Find all books with optional filters
   */
  async findAll(filters?: BookFilters): Promise<Book[]> {
    let result = [...books];

    if (filters?.language && filters.language !== 'All') {
      result = result.filter(book => book.language === filters.language);
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(
        book =>
          book.name.toLowerCase().includes(searchLower) ||
          book.language.toLowerCase().includes(searchLower)
      );
    }

    return result;
  },

  /**
   * Find book by ID
   */
  async findById(id: number): Promise<Book | null> {
    return books.find(book => book.id === id) || null;
  },

  /**
   * Create new book
   */
  async create(data: InsertBook): Promise<Book> {
    const newBook: Book = {
      id: bookIdCounter++,
      name: data.name,
      language: data.language,
      mrp: data.mrp,
      actualPrice: data.actualPrice,
      stock: data.stock ?? 0,
      minStock: data.minStock ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    books.push(newBook);
    return newBook;
  },

  /**
   * Update existing book
   */
  async update(id: number, data: UpdateBook): Promise<Book | null> {
    const index = books.findIndex(book => book.id === id);
    if (index === -1) return null;

    books[index] = {
      ...books[index],
      ...data,
      updatedAt: new Date(),
    };

    return books[index];
  },

  /**
   * Delete book
   */
  async delete(id: number): Promise<boolean> {
    const index = books.findIndex(book => book.id === id);
    if (index === -1) return false;

    books.splice(index, 1);
    
    // Cascade delete: Remove associated stock history
    stockHistory = stockHistory.filter(sh => sh.bookId !== id);
    
    return true;
  },

  /**
   * Update stock level
   */
  async updateStock(id: number, newStock: number): Promise<Book | null> {
    const book = await this.findById(id);
    if (!book) return null;

    return this.update(id, { stock: newStock });
  },

  /**
   * Get low stock books
   */
  async findLowStock(): Promise<Book[]> {
    return books.filter(book => book.stock <= book.minStock && book.minStock > 0);
  },
};

// ============================================================================
// BILLS REPOSITORY
// ============================================================================

export const billsRepository = {
  /**
   * Find all bills with optional filters
   */
  async findAll(filters?: BillFilters): Promise<Bill[]> {
    let result = [...bills];

    if (filters?.startDate) {
      result = result.filter(bill => bill.date >= filters.startDate!);
    }

    if (filters?.endDate) {
      result = result.filter(bill => bill.date <= filters.endDate!);
    }

    if (filters?.customerName) {
      const searchLower = filters.customerName.toLowerCase();
      result = result.filter(bill =>
        bill.customerName.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.paymentMethod) {
      result = result.filter(bill => bill.paymentMethod === filters.paymentMethod);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /**
   * Find bill by ID
   */
  async findById(id: number): Promise<Bill | null> {
    return bills.find(bill => bill.id === id) || null;
  },

  /**
   * Find bill by bill number
   */
  async findByBillNumber(billNumber: string): Promise<Bill | null> {
    return bills.find(bill => bill.billNumber === billNumber) || null;
  },

  /**
   * Create new bill
   */
  async create(data: InsertBill): Promise<Bill> {
    const newBill: Bill = {
      id: billIdCounter++,
      ...data,
      createdAt: new Date(),
    };

    bills.push(newBill);
    return newBill;
  },

  /**
   * Get next bill number
   */
  async getNextBillNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // Find bills from today
    const todayBills = bills.filter(bill => 
      bill.billNumber.startsWith(dateStr)
    );

    const nextSerial = todayBills.length + 1;
    return `${dateStr}-${String(nextSerial).padStart(4, '0')}`;
  },
};

// ============================================================================
// BILL ITEMS REPOSITORY
// ============================================================================

export const billItemsRepository = {
  /**
   * Find all items for a bill
   */
  async findByBillId(billId: number): Promise<BillItem[]> {
    return billItems.filter(item => item.billId === billId);
  },

  /**
   * Create bill item
   */
  async create(data: InsertBillItem): Promise<BillItem> {
    const newItem: BillItem = {
      id: billItemIdCounter++,
      ...data,
      createdAt: new Date(),
    };

    billItems.push(newItem);
    return newItem;
  },

  /**
   * Create multiple bill items
   */
  async createMany(items: InsertBillItem[]): Promise<BillItem[]> {
    return Promise.all(items.map(item => this.create(item)));
  },

  /**
   * Get bill items with book details
   */
  async findByBillIdWithBooks(billId: number): Promise<Array<BillItem & { book: Book | null }>> {
    const items = await this.findByBillId(billId);
    
    return items.map(item => ({
      ...item,
      book: books.find(book => book.id === item.bookId) || null,
    }));
  },
};

// ============================================================================
// STOCK HISTORY REPOSITORY
// ============================================================================

export const stockHistoryRepository = {
  /**
   * Find stock history for a book
   */
  async findByBookId(bookId: number, limit?: number): Promise<StockHistory[]> {
    let result = stockHistory
      .filter(sh => sh.bookId === bookId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (limit) {
      result = result.slice(0, limit);
    }

    return result;
  },

  /**
   * Create stock history entry
   */
  async create(data: InsertStockHistory): Promise<StockHistory> {
    const newEntry: StockHistory = {
      id: stockHistoryIdCounter++,
      ...data,
      createdAt: new Date(),
    };

    stockHistory.push(newEntry);
    return newEntry;
  },

  /**
   * Get all history entries (for reports)
   */
  async findAll(): Promise<StockHistory[]> {
    return [...stockHistory].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },
};

// ============================================================================
// UTILITY FUNCTIONS (for testing/development)
// ============================================================================

/**
 * Reset all data (useful for testing)
 */
export function resetMockData() {
  books = [];
  bills = [];
  billItems = [];
  stockHistory = [];
  
  bookIdCounter = 1;
  billIdCounter = 1;
  billItemIdCounter = 1;
  stockHistoryIdCounter = 1;
}

/**
 * Seed initial data (optional for development)
 */
export function seedMockData() {
  resetMockData();

  // Seed some initial books
  const initialBooks: InsertBook[] = [
    {
      name: "Bhagavad Gita As It Is",
      language: "English",
      mrp: 100,
      actualPrice: 80,
      stock: 25,
      minStock: 5,
    },
    {
      name: "Srimad Bhagavatam Canto 1",
      language: "English",
      mrp: 150,
      actualPrice: 120,
      stock: 10,
      minStock: 3,
    },
    {
      name: "भगवद गीता",
      language: "Hindi",
      mrp: 100,
      actualPrice: 80,
      stock: 15,
      minStock: 5,
    },
    {
      name: "चैतन्य चरितामृत",
      language: "Marathi",
      mrp: 200,
      actualPrice: 160,
      stock: 8,
      minStock: 3,
    },
    {
      name: "Krishna Book",
      language: "English",
      mrp: 120,
      actualPrice: 100,
      stock: 2,
      minStock: 5,
    },
    {
      name: "Nectar of Devotion",
      language: "English",
      mrp: 180,
      actualPrice: 150,
      stock: 12,
      minStock: 4,
    },
  ];

  // Create books and initial stock history
  initialBooks.forEach(async (bookData) => {
    const book = await booksRepository.create(bookData);
    
    if (book.stock > 0) {
      await stockHistoryRepository.create({
        bookId: book.id,
        changeAmount: book.stock,
        reason: 'initial',
        referenceId: null,
        staffName: 'System',
        firebaseUid: null,
        notes: 'Initial stock',
      });
    }
  });
}

// Optionally seed data on module load for development
if (process.env.NODE_ENV === 'development') {
  seedMockData();
}
