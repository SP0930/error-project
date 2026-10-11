import { Router, type Request, type Response } from "express";
import { 
  booksRepository, 
  billsRepository, 
  billItemsRepository,
} from "../repositories";
import { logger } from "../lib/logger";

const router = Router();

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/reports/dashboard
 * Get dashboard statistics
 * 
 * Returns:
 *  - Total books count
 *  - Total stock value (based on actualPrice)
 *  - Low stock count
 *  - Today's sales
 *  - This month's sales
 *  - Recent bills (last 10)
 */
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    // Get all books
    const allBooks = await booksRepository.findAll();
    
    // Calculate total stock value
    const totalStockValue = allBooks.reduce(
      (sum, book) => sum + (book.stock * book.actualPrice),
      0
    );

    // Get low stock books
    const lowStockBooks = await booksRepository.findLowStock();

    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get this month's date range
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString().split('T')[0];
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // Get all bills
    const allBills = await billsRepository.findAll();
    
    // Filter today's bills
    const todayBills = allBills.filter(bill => bill.date === today);
    
    // Filter this month's bills
    const monthBills = allBills.filter(
      bill => bill.date >= firstDayOfMonth && bill.date <= lastDayOfMonth
    );

    // Calculate today's sales
    let todaySalesAmount = 0;
    for (const bill of todayBills) {
      const items = await billItemsRepository.findByBillId(bill.id);
      const billTotal = items.reduce(
        (sum, item) => sum + (item.quantity * item.priceAtSale),
        0
      );
      todaySalesAmount += billTotal - bill.discountAmount;
    }

    // Calculate this month's sales
    let monthSalesAmount = 0;
    for (const bill of monthBills) {
      const items = await billItemsRepository.findByBillId(bill.id);
      const billTotal = items.reduce(
        (sum, item) => sum + (item.quantity * item.priceAtSale),
        0
      );
      monthSalesAmount += billTotal - bill.discountAmount;
    }

    // Get recent bills (last 10)
    const recentBills = allBills.slice(0, 10);

    const dashboard = {
      books: {
        total: allBooks.length,
        lowStock: lowStockBooks.length,
        totalStockValue,
      },
      sales: {
        today: {
          count: todayBills.length,
          amount: todaySalesAmount,
        },
        thisMonth: {
          count: monthBills.length,
          amount: monthSalesAmount,
        },
      },
      recentBills: recentBills.map(bill => ({
        id: bill.id,
        billNumber: bill.billNumber,
        customerName: bill.customerName,
        date: bill.date,
        time: bill.time,
        paymentMethod: bill.paymentMethod,
      })),
    };

    logger.info("Dashboard data fetched");
    res.json(dashboard);
  } catch (error) {
    logger.error({ error }, "Error fetching dashboard data");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch dashboard data",
    });
  }
});

/**
 * GET /api/reports/date-range
 * Get sales report for a date range
 * 
 * Query params:
 *  - startDate: Start date (YYYY-MM-DD) - required
 *  - endDate: End date (YYYY-MM-DD) - required
 */
router.get("/date-range", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Both startDate and endDate are required",
      });
    }

    // Get bills in date range
    const bills = await billsRepository.findAll({
      startDate: startDate as string,
      endDate: endDate as string,
    });

    // Calculate detailed statistics
    let totalAmount = 0;
    let totalDiscount = 0;
    let totalItems = 0;
    const booksSold: Record<number, { bookId: number; bookName: string; quantity: number; revenue: number }> = {};
    const dailySales: Record<string, { date: string; amount: number; count: number }> = {};

    for (const bill of bills) {
      const items = await billItemsRepository.findByBillIdWithBooks(bill.id);
      
      const billSubtotal = items.reduce(
        (sum, item) => sum + (item.quantity * item.priceAtSale),
        0
      );
      
      const billTotal = billSubtotal - bill.discountAmount;
      
      totalAmount += billTotal;
      totalDiscount += bill.discountAmount;
      totalItems += items.reduce((sum, item) => sum + item.quantity, 0);

      // Track books sold
      for (const item of items) {
        if (!booksSold[item.bookId]) {
          booksSold[item.bookId] = {
            bookId: item.bookId,
            bookName: item.book?.name || "Unknown",
            quantity: 0,
            revenue: 0,
          };
        }
        booksSold[item.bookId].quantity += item.quantity;
        booksSold[item.bookId].revenue += item.quantity * item.priceAtSale;
      }

      // Track daily sales
      if (!dailySales[bill.date]) {
        dailySales[bill.date] = {
          date: bill.date,
          amount: 0,
          count: 0,
        };
      }
      dailySales[bill.date].amount += billTotal;
      dailySales[bill.date].count += 1;
    }

    // Sort books by revenue (top sellers)
    const topBooks = Object.values(booksSold)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Sort daily sales by date
    const dailySalesArray = Object.values(dailySales)
      .sort((a, b) => a.date.localeCompare(b.date));

    const report = {
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalBills: bills.length,
        totalAmount,
        totalDiscount,
        totalItems,
        averageBillValue: bills.length > 0 ? Math.round(totalAmount / bills.length) : 0,
      },
      topBooks,
      dailySales: dailySalesArray,
      paymentMethods: {
        cash: bills.filter(b => b.paymentMethod === 'Cash').length,
        online: bills.filter(b => b.paymentMethod === 'Online').length,
      },
    };

    logger.info({ startDate, endDate, billCount: bills.length }, "Date range report fetched");
    res.json(report);
  } catch (error) {
    logger.error({ error }, "Error generating date range report");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to generate report",
    });
  }
});

/**
 * GET /api/reports/low-stock
 * Get books with low stock
 */
router.get("/low-stock", async (req: Request, res: Response) => {
  try {
    const lowStockBooks = await booksRepository.findLowStock();

    const report = lowStockBooks.map(book => ({
      id: book.id,
      name: book.name,
      language: book.language,
      currentStock: book.stock,
      minStock: book.minStock,
      deficit: book.minStock - book.stock,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
    }));

    logger.info({ count: report.length }, "Low stock report fetched");
    res.json(report);
  } catch (error) {
    logger.error({ error }, "Error fetching low stock report");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch low stock report",
    });
  }
});

/**
 * GET /api/reports/books-summary
 * Get summary of all books with sales statistics
 */
router.get("/books-summary", async (req: Request, res: Response) => {
  try {
    const allBooks = await booksRepository.findAll();
    const allBills = await billsRepository.findAll();

    // Calculate sales for each book
    const bookSales: Record<number, { quantity: number; revenue: number }> = {};

    for (const bill of allBills) {
      const items = await billItemsRepository.findByBillId(bill.id);
      
      for (const item of items) {
        if (!bookSales[item.bookId]) {
          bookSales[item.bookId] = { quantity: 0, revenue: 0 };
        }
        bookSales[item.bookId].quantity += item.quantity;
        bookSales[item.bookId].revenue += item.quantity * item.priceAtSale;
      }
    }

    const summary = allBooks.map(book => ({
      id: book.id,
      name: book.name,
      language: book.language,
      mrp: book.mrp,
      actualPrice: book.actualPrice,
      currentStock: book.stock,
      minStock: book.minStock,
      stockValue: book.stock * book.actualPrice,
      totalSold: bookSales[book.id]?.quantity || 0,
      totalRevenue: bookSales[book.id]?.revenue || 0,
      isLowStock: book.stock <= book.minStock && book.minStock > 0,
    }));

    logger.info({ bookCount: summary.length }, "Books summary report fetched");
    res.json(summary);
  } catch (error) {
    logger.error({ error }, "Error fetching books summary");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch books summary",
    });
  }
});

export default router;
