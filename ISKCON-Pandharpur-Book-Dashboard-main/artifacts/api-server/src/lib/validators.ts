/**
 * Business Logic Validators
 * 
 * These functions encapsulate business rules and validation logic
 * that go beyond simple schema validation.
 */

import { booksRepository, billItemsRepository } from "../repositories";
import { 
  InsufficientStockError, 
  InvalidStockOperationError,
  NotFoundError,
} from "./errors";

/**
 * Validate that a book exists
 */
export async function validateBookExists(bookId: number) {
  const book = await booksRepository.findById(bookId);
  if (!book) {
    throw new NotFoundError(`Book with ID ${bookId} not found`);
  }
  return book;
}

/**
 * Validate stock availability for a sale
 */
export async function validateStockAvailability(
  bookId: number,
  requestedQuantity: number
) {
  const book = await validateBookExists(bookId);

  if (book.stock < requestedQuantity) {
    throw new InsufficientStockError(book.name, book.stock, requestedQuantity);
  }

  return book;
}

/**
 * Validate stock adjustment
 * Ensures new stock level won't be negative
 */
export async function validateStockAdjustment(
  bookId: number,
  changeAmount: number
) {
  const book = await validateBookExists(bookId);
  const newStock = book.stock + changeAmount;

  if (newStock < 0) {
    throw new InvalidStockOperationError(
      `Cannot reduce stock by ${Math.abs(changeAmount)}. Current stock: ${book.stock}`
    );
  }

  return { book, newStock };
}

/**
 * Validate that a book can be deleted
 * Books that have been sold should not be deleted (or should be soft-deleted)
 */
export async function validateBookDeletion(bookId: number) {
  const book = await validateBookExists(bookId);

  // TODO: When bills are fully integrated, check if book has any sales
  // For now, we'll allow deletion
  // In production, you might want to:
  // 1. Check if book has bill_items entries
  // 2. If yes, prevent deletion or implement soft delete
  // 3. If no, allow deletion

  return book;
}

/**
 * Validate bill number format
 */
export function validateBillNumberFormat(billNumber: string): boolean {
  // Format: YYYYMMDD-####
  const pattern = /^\d{8}-\d{4}$/;
  return pattern.test(billNumber);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDateFormat(date: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(date)) return false;

  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
}

/**
 * Validate date range
 */
export function validateDateRange(startDate: string, endDate: string) {
  if (!validateDateFormat(startDate) || !validateDateFormat(endDate)) {
    throw new Error("Invalid date format. Expected YYYY-MM-DD");
  }

  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  return { startDate, endDate };
}

/**
 * Validate price consistency
 * Actual price should not exceed MRP
 */
export function validatePriceConsistency(mrp: number, actualPrice: number) {
  if (actualPrice > mrp) {
    throw new Error("Actual price cannot exceed MRP");
  }
  return true;
}

/**
 * Validate minimum stock threshold
 * Min stock should be reasonable (not negative, not more than current stock)
 */
export function validateMinStockThreshold(minStock: number, currentStock: number) {
  if (minStock < 0) {
    throw new Error("Minimum stock cannot be negative");
  }

  // Warning if minStock > currentStock (not an error, just a business rule)
  if (minStock > currentStock) {
    return {
      valid: true,
      warning: "Minimum stock threshold is higher than current stock",
    };
  }

  return { valid: true };
}

/**
 * Calculate bill total with discount
 */
export function calculateBillTotal(
  subtotal: number,
  discountAmount: number,
  discountMode: 'amount' | 'percent' | 'off_mrp' | null
): number {
  if (!discountMode || discountAmount === 0) {
    return subtotal;
  }

  let finalDiscount = discountAmount;

  if (discountMode === 'percent') {
    finalDiscount = Math.round((subtotal * discountAmount) / 100);
  }
  // For 'amount' and 'off_mrp', discountAmount is already in paise

  const total = subtotal - finalDiscount;
  return Math.max(0, total); // Ensure total is not negative
}

/**
 * Validate discount
 */
export function validateDiscount(
  subtotal: number,
  discountAmount: number,
  discountMode: 'amount' | 'percent' | 'off_mrp' | null
) {
  if (!discountMode || discountAmount === 0) {
    return { valid: true, finalDiscount: 0 };
  }

  if (discountAmount < 0) {
    throw new Error("Discount amount cannot be negative");
  }

  if (discountMode === 'percent' && discountAmount > 100) {
    throw new Error("Discount percentage cannot exceed 100%");
  }

  const finalDiscount = discountMode === 'percent'
    ? Math.round((subtotal * discountAmount) / 100)
    : discountAmount;

  if (finalDiscount > subtotal) {
    throw new Error("Discount cannot exceed subtotal");
  }

  return { valid: true, finalDiscount };
}
