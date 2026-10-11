/**
 * Data Transfer Object (DTO) Transformers
 * 
 * Transforms backend data models to frontend-compatible formats.
 * Frontend uses abbreviated property names for compact data representation.
 */

import type { Book, Bill, BillItem } from "../repositories/types";

/**
 * Frontend Bill format (abbreviated properties)
 */
export type FrontendBill = {
  no: number;           // billNumber
  c: string;            // customerName
  d: string;            // date
  tm: string;           // time
  pay: 'Cash' | 'Online'; // paymentMethod
  it: [number, number][]; // items: [bookId, quantity][]
  st: string;           // staffName
  discount: number;     // discountAmount
  discountMode: 'amount' | 'percentage'; // discountMode (mapped)
  discountInput: number; // discountInput (parsed)
};

/**
 * Transform backend Bill to frontend format
 */
export function toFrontendBill(bill: Bill, items: BillItem[]): FrontendBill {
  // Map backend discount modes to frontend format
  let frontendDiscountMode: 'amount' | 'percentage' = 'amount';
  if (bill.discountMode === 'percent') {
    frontendDiscountMode = 'percentage';
  }

  // Parse bill number (extract numeric part)
  const billNumberMatch = bill.billNumber.match(/(\d+)$/);
  const billNo = billNumberMatch ? parseInt(billNumberMatch[1], 10) : bill.id;

  return {
    no: billNo,
    c: bill.customerName,
    d: bill.date,
    tm: bill.time,
    pay: bill.paymentMethod,
    it: items.map(item => [item.bookId, item.quantity] as [number, number]),
    st: bill.staffName,
    discount: bill.discountAmount,
    discountMode: frontendDiscountMode,
    discountInput: parseFloat(bill.discountInput || '0'),
  };
}

/**
 * Transform frontend bill data to backend format (for POST requests)
 */
export function fromFrontendBill(frontendBill: Partial<FrontendBill>): {
  customerName: string;
  customerMobile: string | null;
  paymentMethod: 'Cash' | 'Online';
  staffName: string;
  discountAmount: number;
  discountMode: 'amount' | 'percent' | null;
  discountInput: string | null;
} {
  // Map frontend discount mode to backend format
  let backendDiscountMode: 'amount' | 'percent' | null = null;
  if (frontendBill.discountMode === 'percentage') {
    backendDiscountMode = 'percent';
  } else if (frontendBill.discountMode === 'amount') {
    backendDiscountMode = 'amount';
  }

  return {
    customerName: frontendBill.c || '',
    customerMobile: null, // Frontend doesn't provide mobile in Bill type
    paymentMethod: frontendBill.pay || 'Cash',
    staffName: frontendBill.st || 'Staff',
    discountAmount: frontendBill.discount || 0,
    discountMode: backendDiscountMode,
    discountInput: frontendBill.discountInput?.toString() || null,
  };
}

/**
 * Dashboard statistics (for home screen)
 */
export type DashboardStats = {
  todaySales: {
    total: number;
    booksSold: number;
    online: number;
    cash: number;
    billCount: number;
    discountTotal: number;
  };
  recentBills: FrontendBill[];
  lowStock: {
    count: number;
    books: Array<{
      id: number;
      name: string;
      language: string;
      stock: number;
      minStock: number;
    }>;
  };
};

/**
 * Stock status summary
 */
export type StockSummary = {
  totalStock: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockBooks: Array<{
    id: number;
    name: string;
    language: string;
    stock: number;
    minStock: number;
    mrp: number;
    actualPrice: number;
  }>;
};

/**
 * Report data for date range
 */
export type ReportData = {
  summary: {
    totalSales: number;
    booksSold: number;
    online: number;
    cash: number;
    totalDiscount: number;
    billCount: number;
  };
  bills: FrontendBill[];
  bookWise?: Array<{
    label: string;
    quantity: number;
    revenue: number;
  }>;
  languageWise?: Array<{
    label: string;
    quantity: number;
    revenue: number;
  }>;
  paymentWise?: Array<{
    label: string;
    quantity: number;
    revenue: number;
  }>;
};
