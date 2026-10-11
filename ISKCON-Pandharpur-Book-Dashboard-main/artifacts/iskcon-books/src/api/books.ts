import { apiRequest } from "./client";

// Types matching the database schema
export type Book = {
  id: number;
  name: string;
  language: string;
  mrp: number;
  actualPrice: number;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateBookData = {
  name: string;
  language: string;
  mrp: number;
  actualPrice: number;
  stock?: number;
  minStock?: number;
};

export type UpdateBookData = Partial<Omit<CreateBookData, "id">>;

export type StockAdjustment = {
  amount: number;
  reason: "restock" | "adjustment";
  notes?: string;
  staffName?: string;
};

export type RestockData = {
  quantity: number;
  notes?: string;
  staffName?: string;
};

// API functions
export async function getBooks(params?: {
  language?: string;
  search?: string;
}): Promise<Book[]> {
  const queryParams = new URLSearchParams();
  if (params?.language) queryParams.append("language", params.language);
  if (params?.search) queryParams.append("search", params.search);

  const query = queryParams.toString();
  const endpoint = query ? `/api/books?${query}` : "/api/books";

  return apiRequest<Book[]>(endpoint);
}

export async function getBook(id: number): Promise<Book> {
  return apiRequest<Book>(`/api/books/${id}`);
}

export async function createBook(data: CreateBookData): Promise<Book> {
  return apiRequest<Book>("/api/books", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBook(
  id: number,
  data: UpdateBookData
): Promise<Book> {
  return apiRequest<Book>(`/api/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBook(id: number): Promise<void> {
  return apiRequest<void>(`/api/books/${id}`, {
    method: "DELETE",
  });
}

export async function adjustStock(
  id: number,
  data: StockAdjustment
): Promise<{ book: Book; stockHistory: any }> {
  return apiRequest(`/api/books/${id}/stock`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function restockBook(
  id: number,
  data: RestockData
): Promise<{ book: Book; stockHistory: any; message: string }> {
  return apiRequest(`/api/books/${id}/restock`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBookStock(
  id: number
): Promise<{
  bookId: number;
  bookName: string;
  currentStock: number;
  minStock: number;
  history: any[];
}> {
  return apiRequest(`/api/books/${id}/stock`);
}
