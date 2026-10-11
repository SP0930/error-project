import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { 
  billsRepository, 
  billItemsRepository, 
  booksRepository,
  stockHistoryRepository,
} from "../repositories";
import { logger } from "../lib/logger";

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const billItemSchema = z.object({
  bookId: z.number().int().positive("Book ID must be positive"),
  quantity: z.number().int().positive("Quantity must be positive"),
  priceAtSale: z.number().int().nonnegative("Price must be non-negative"),
});

const createBillSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerMobile: z.string().optional().nullable(),
  paymentMethod: z.enum(["Cash", "Online"], {
    errorMap: () => ({ message: "Payment method must be 'Cash' or 'Online'" }),
  }),
  staffName: z.string().optional(),
  discountAmount: z.number().int().nonnegative("Discount must be non-negative").default(0),
  discountMode: z.enum(["amount", "percent", "off_mrp"]).nullable().optional(),
  discountInput: z.string().nullable().optional(),
  items: z.array(billItemSchema).min(1, "At least one item is required"),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/bills
 * List all bills with optional filters
 * 
 * Query params:
 *  - startDate: Filter by date range start (YYYY-MM-DD)
 *  - endDate: Filter by date range end (YYYY-MM-DD)
 *  - customerName: Search customer name
 *  - paymentMethod: Filter by payment method
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, customerName, paymentMethod } = req.query;

    const bills = await billsRepository.findAll({
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      customerName: customerName as string | undefined,
      paymentMethod: paymentMethod as 'Cash' | 'Online' | undefined,
    });

    logger.info({ count: bills.length }, "Bills fetched");
    res.json(bills);
  } catch (error) {
    logger.error({ error }, "Error fetching bills");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch bills",
    });
  }
});

/**
 * GET /api/bills/:id
 * Get a single bill by ID with items and book details
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const billId = parseInt(req.params.id, 10);

    if (isNaN(billId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid bill ID",
      });
    }

    const bill = await billsRepository.findById(billId);

    if (!bill) {
      return res.status(404).json({
        error: "Not Found",
        message: "Bill not found",
      });
    }

    // Get bill items with book details
    const items = await billItemsRepository.findByBillIdWithBooks(billId);

    res.json({
      ...bill,
      items,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching bill");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch bill",
    });
  }
});

/**
 * POST /api/bills
 * Create a new bill (transaction: bill + bill items + stock deduction)
 * 
 * This is a critical endpoint that performs multiple operations atomically:
 * 1. Validate all items and stock availability
 * 2. Create the bill
 * 3. Create bill items
 * 4. Deduct stock from books
 * 5. Record stock history for each item
 * 
 * Auth: Required
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createBillSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid bill data",
        details: validationResult.error.errors,
      });
    }

    const billData = validationResult.data;

    // ========================================================================
    // STEP 1: Validate stock availability for all items
    // ========================================================================
    
    const stockValidationErrors: string[] = [];
    const booksToUpdate: Array<{ book: any; quantity: number }> = [];

    for (const item of billData.items) {
      const book = await booksRepository.findById(item.bookId);
      
      if (!book) {
        stockValidationErrors.push(`Book ID ${item.bookId} not found`);
        continue;
      }

      if (book.stock < item.quantity) {
        stockValidationErrors.push(
          `Insufficient stock for "${book.name}". Available: ${book.stock}, Requested: ${item.quantity}`
        );
        continue;
      }

      booksToUpdate.push({ book, quantity: item.quantity });
    }

    // If any validation errors, return them
    if (stockValidationErrors.length > 0) {
      return res.status(400).json({
        error: "Stock Validation Error",
        message: "Cannot complete sale due to stock issues",
        details: stockValidationErrors,
      });
    }

    // ========================================================================
    // STEP 2: Generate bill number and create bill
    // ========================================================================
    
    const billNumber = await billsRepository.getNextBillNumber();
    
    const today = new Date();
    const date = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = today.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const newBill = await billsRepository.create({
      billNumber,
      customerName: billData.customerName,
      customerMobile: billData.customerMobile || null,
      date,
      time,
      paymentMethod: billData.paymentMethod,
      staffName: billData.staffName || req.user?.name || req.user?.email || "Staff",
      firebaseUid: req.user?.uid || null,
      discountAmount: billData.discountAmount,
      discountMode: billData.discountMode || null,
      discountInput: billData.discountInput || null,
    });

    logger.info({ billId: newBill.id, billNumber }, "Bill created");

    // ========================================================================
    // STEP 3: Create bill items
    // ========================================================================
    
    const createdItems = await billItemsRepository.createMany(
      billData.items.map(item => ({
        billId: newBill.id,
        bookId: item.bookId,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale,
      }))
    );

    logger.info({ billId: newBill.id, itemCount: createdItems.length }, "Bill items created");

    // ========================================================================
    // STEP 4: Deduct stock and create stock history
    // ========================================================================
    
    for (const { book, quantity } of booksToUpdate) {
      const newStock = book.stock - quantity;
      
      // Update stock
      await booksRepository.updateStock(book.id, newStock);
      
      // Record stock history
      await stockHistoryRepository.create({
        bookId: book.id,
        changeAmount: -quantity,
        reason: "sale",
        referenceId: newBill.id,
        staffName: billData.staffName || req.user?.name || req.user?.email || "Staff",
        firebaseUid: req.user?.uid || null,
        notes: `Sold via bill ${billNumber}`,
      });
    }

    logger.info({ billId: newBill.id, booksUpdated: booksToUpdate.length }, "Stock deducted");

    // ========================================================================
    // STEP 5: Return complete bill with items
    // ========================================================================
    
    const items = await billItemsRepository.findByBillIdWithBooks(newBill.id);

    res.status(201).json({
      ...newBill,
      items,
    });
  } catch (error) {
    logger.error({ 
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error 
    }, "Error creating bill");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create bill. No changes were made.",
    });
  }
});

/**
 * GET /api/bills/by-number/:billNumber
 * Get a bill by its bill number (for searching/printing)
 */
router.get("/by-number/:billNumber", async (req: Request, res: Response) => {
  try {
    const { billNumber } = req.params;

    const bill = await billsRepository.findByBillNumber(billNumber);

    if (!bill) {
      return res.status(404).json({
        error: "Not Found",
        message: "Bill not found",
      });
    }

    // Get bill items with book details
    const items = await billItemsRepository.findByBillIdWithBooks(bill.id);

    res.json({
      ...bill,
      items,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching bill by number");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch bill",
    });
  }
});

export default router;
