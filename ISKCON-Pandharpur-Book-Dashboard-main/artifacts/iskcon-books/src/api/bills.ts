import { apiRequest } from "./client";

// Types for bills
export type BillItem = {
  id: number;
  billId: number;
  bookId: number;
  bookName?: string;
  bookLanguage?: string;
  quantity: number;
  priceAtSale: number;
};

export type Bill = {
  id: number;
  billNumber: string;
  customerName: string;
  customerMobile: string | null;
  date: string;
  time: string;
  paymentMethod: "Cash" | "Online";
  staffName: string;
  firebaseUid: string | null;
  discountAmount: number;
  discountMode: string | null;
  discountInput: string | null;
  createdAt: string;
  items?: BillItem[];
};

export type CreateBillData = {
  customerName: string;
  customerMobile?: string;
  paymentMethod: "Cash" | "Online";
  staffName?: string;
  discountAmount?: number;
  discountMode?: "amount" | "percent" | "off_mrp";
  discountInput?: string;
  items: {
    bookId: number;
    quantity: number;
    priceAtSale: number;
  }[];
};

// API functions
export async function getBills(params?: {
  startDate?: string;
  endDate?: string;
  customerName?: string;
  paymentMethod?: "Cash" | "Online";
}): Promise<Bill[]> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.append("startDate", params.startDate);
  if (params?.endDate) queryParams.append("endDate", params.endDate);
  if (params?.customerName) queryParams.append("customerName", params.customerName);
  if (params?.paymentMethod) queryParams.append("paymentMethod", params.paymentMethod);

  const query = queryParams.toString();
  const endpoint = query ? `/api/bills?${query}` : "/api/bills";

  return apiRequest<Bill[]>(endpoint);
}

export async function getBill(id: number): Promise<Bill> {
  return apiRequest<Bill>(`/api/bills/${id}`);
}

export async function getBillByNumber(billNumber: string): Promise<Bill> {
  return apiRequest<Bill>(`/api/bills/by-number/${billNumber}`);
}

export async function createBill(data: CreateBillData): Promise<Bill> {
  return apiRequest<Bill>("/api/bills", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
