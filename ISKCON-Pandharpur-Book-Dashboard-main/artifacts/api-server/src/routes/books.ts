import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { booksRepository, stockHistoryRepository } from "../repositories";
import { logger } from "../lib/logger";

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createBookSchema = z.object({
  name: z.string().min(1, "Book name is required"),
  language: z.string().min(1, "Language is required"),
  mrp: z.number().int().nonnegative("MRP must be non-negative"),
  actualPrice: z.number().int().nonnegative("Actual price must be non-negative"),
  stock: z.number().int().nonnegative("Stock must be non-negative").optional().default(0),
  minStock: z.number().int().nonnegative("Minimum stock must be non-negative").optional().default(0),
});

const updateBookSchema = z.object({
  name: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  mrp: z.number().int().nonnegative().optional(),
  actualPrice: z.number().int().nonnegative().optional(),
  minStock: z.number().int().nonnegative().optional(),
  // Note: stock is NOT allowed in update - use stock management endpoints
});

const adjustStockSchema = z.object({
  amount: z.number().int("Amount must be an integer"),
  reason: z.enum(["restock", "adjustment"], {
    errorMap: () => ({ message: "Reason must be 'restock' or 'adjustment'" }),
  }),
  notes: z.string().optional(),
  staffName: z.string().optional(),
});

const restockSchema = z.object({
  quantity: z.number().int().positive("Quantity must be positive"),
  notes: z.string().optional(),
  staffName: z.string().optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/books
 * List all books with optional filters
 * 
 * Query params:
 *  - language: Filter by language
 *  - search: Search in name or language
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const { language, search } = req.query;

    const books = await booksRepository.findAll({
      language: language as string | undefined,
      search: search as string | undefined,
    });

    logger.info({ count: books.length, filters: { language, search } }, "Books fetched");
    res.json(books);
  } catch (error) {
    logger.error({ error }, "Error fetching books");
    res.status(500).json({ 
      error: "Internal Server Error",
      message: "Failed to fetch books" 
    });
  }
});

/**
 * GET /api/books/:id
 * Get a single book by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    const book = await booksRepository.findById(bookId);

    if (!book) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    res.json(book);
  } catch (error) {
    logger.error({ error }, "Error fetching book");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch book",
    });
  }
});

/**
 * POST /api/books
 * Create a new book
 * 
 * Auth: Required (req.user from Firebase middleware)
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createBookSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid book data",
        details: validationResult.error.errors,
      });
    }

    const bookData = validationResult.data;

    // Create the book
    const newBook = await booksRepository.create(bookData);

    // Create initial stock history if stock > 0
    if (newBook.stock > 0) {
      await stockHistoryRepository.create({
        bookId: newBook.id,
        changeAmount: newBook.stock,
        reason: "initial",
        referenceId: null,
        staffName: req.user?.name || req.user?.email || "Staff",
        firebaseUid: req.user?.uid || null,
        notes: "Initial stock",
      });
    }

    logger.info({ bookId: newBook.id, name: newBook.name }, "Book created");
    res.status(201).json(newBook);
  } catch (error) {
    logger.error({ error }, "Error creating book");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create book",
    });
  }
});

/**
 * PUT /api/books/:id
 * Update an existing book
 * 
 * Note: Stock cannot be updated via this endpoint - use PATCH /api/books/:id/stock
 * Auth: Required
 */
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    // Check if book exists
    const existingBook = await booksRepository.findById(bookId);
    if (!existingBook) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    // Validate request body
    const validationResult = updateBookSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid book data",
        details: validationResult.error.errors,
      });
    }

    const updateData = validationResult.data;

    // Prevent stock updates via this endpoint
    if ('stock' in req.body) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Cannot update stock via this endpoint. Use PATCH /api/books/:id/stock instead",
      });
    }

    // Update the book
    const updatedBook = await booksRepository.update(bookId, updateData);

    logger.info({ bookId, updates: updateData }, "Book updated");
    res.json(updatedBook);
  } catch (error) {
    logger.error({ error }, "Error updating book");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update book",
    });
  }
});

/**
 * DELETE /api/books/:id
 * Delete a book
 * 
 * Auth: Required
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    // Check if book exists
    const existingBook = await booksRepository.findById(bookId);
    if (!existingBook) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    // TODO: When bills are implemented, check if book has been sold
    // If yes, prevent deletion or implement soft delete

    // Delete the book (cascade will remove stock history)
    await booksRepository.delete(bookId);

    logger.info({ bookId }, "Book deleted");
    res.json({ 
      message: "Book deleted successfully",
      id: bookId,
    });
  } catch (error) {
    logger.error({ error }, "Error deleting book");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to delete book",
    });
  }
});

/**
 * GET /api/books/:id/stock
 * Get current stock level and history
 */
router.get("/:id/stock", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    const book = await booksRepository.findById(bookId);
    if (!book) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    // Get stock history (last 50 entries)
    const history = await stockHistoryRepository.findByBookId(bookId, 50);

    res.json({
      bookId: book.id,
      bookName: book.name,
      currentStock: book.stock,
      minStock: book.minStock,
      history,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching stock information");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch stock information",
    });
  }
});

/**
 * PATCH /api/books/:id/stock
 * Adjust stock level (positive or negative)
 * 
 * Use for manual adjustments and restocks
 * Auth: Required
 */
router.patch("/:id/stock", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    // Validate request body
    const validationResult = adjustStockSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid stock adjustment data",
        details: validationResult.error.errors,
      });
    }

    const { amount, reason, notes, staffName } = validationResult.data;

    // Get current book
    const book = await booksRepository.findById(bookId);
    if (!book) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    const newStock = book.stock + amount;

    // Validate new stock is not negative
    if (newStock < 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Cannot reduce stock by ${Math.abs(amount)}. Current stock: ${book.stock}`,
      });
    }

    // Update stock
    const updatedBook = await booksRepository.updateStock(bookId, newStock);

    // Record in stock history
    const historyEntry = await stockHistoryRepository.create({
      bookId,
      changeAmount: amount,
      reason,
      referenceId: null,
      staffName: staffName || req.user?.name || req.user?.email || "Staff",
      firebaseUid: req.user?.uid || null,
      notes: notes || undefined,
    });

    logger.info({ bookId, amount, newStock, reason }, "Stock adjusted");
    res.json({
      book: updatedBook,
      stockHistory: historyEntry,
    });
  } catch (error) {
    logger.error({ error }, "Error adjusting stock");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to adjust stock",
    });
  }
});

/**
 * POST /api/books/:id/restock
 * Convenience endpoint for restocking (always positive)
 * 
 * Auth: Required
 */
router.post("/:id/restock", async (req: Request, res: Response) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId)) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Invalid book ID",
      });
    }

    // Validate request body
    const validationResult = restockSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation Error",
        message: "Invalid restock data",
        details: validationResult.error.errors,
      });
    }

    const { quantity, notes, staffName } = validationResult.data;

    // Get current book
    const book = await booksRepository.findById(bookId);
    if (!book) {
      return res.status(404).json({
        error: "Not Found",
        message: "Book not found",
      });
    }

    const newStock = book.stock + quantity;

    // Update stock
    const updatedBook = await booksRepository.updateStock(bookId, newStock);

    // Record in stock history
    const historyEntry = await stockHistoryRepository.create({
      bookId,
      changeAmount: quantity,
      reason: "restock",
      referenceId: null,
      staffName: staffName || req.user?.name || req.user?.email || "Staff",
      firebaseUid: req.user?.uid || null,
      notes: notes || `Restocked ${quantity} units`,
    });

    logger.info({ bookId, quantity, newStock }, "Book restocked");
    res.json({
      book: updatedBook,
      stockHistory: historyEntry,
      message: `Successfully added ${quantity} units to stock`,
    });
  } catch (error) {
    logger.error({ error }, "Error restocking book");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to restock book",
    });
  }
});

export default router;
