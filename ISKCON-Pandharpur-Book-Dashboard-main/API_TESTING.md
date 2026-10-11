# API Testing Guide - Mock Data Backend

## Overview

This document provides comprehensive testing procedures for all backend APIs using the mock data layer.

**Important Notes:**
- All APIs use mock in-memory data storage
- Firebase Authentication runs in MOCK MODE (accepts any token)
- No database connection required
- Data resets on server restart
- Mock data is seeded automatically in development

---

## Setup

### 1. Start API Server

```bash
cd artifacts/api-server
pnpm install
pnpm run dev
```

Server should start on: `http://localhost:5000`

### 2. Verify Health Check

```bash
curl http://localhost:5000/api/healthz
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-08T..."
}
```

---

## Authentication

### Mock Mode (Development)

Since Firebase is not configured, the API runs in **MOCK MODE**:
- Any Authorization header with "Bearer" token is accepted
- No real token validation occurs
- User context is mocked

### Making Authenticated Requests

All API endpoints (except `/healthz`) require authentication:

```bash
curl -H "Authorization: Bearer mock-token-123" \
  http://localhost:5000/api/books
```

For testing, you can use any token value. In production, this will be a real Firebase ID token.

---

## Books API Testing

### 1. GET /api/books - List All Books

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/books
```

**Expected:** Array of 6 pre-seeded books

### 2. GET /api/books?language=English - Filter by Language

```bash
curl -H "Authorization: Bearer mock-token" \
  "http://localhost:5000/api/books?language=English"
```

**Expected:** Only English books

### 3. GET /api/books?search=gita - Search Books

```bash
curl -H "Authorization: Bearer mock-token" \
  "http://localhost:5000/api/books?search=gita"
```

**Expected:** Books matching "gita" in name or language

### 4. GET /api/books/:id - Get Single Book

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/books/1
```

**Expected:** Book with ID 1

### 5. POST /api/books - Create New Book

```bash
curl -X POST \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Book",
    "language": "English",
    "mrp": 200,
    "actualPrice": 160,
    "stock": 10,
    "minStock": 3
  }' \
  http://localhost:5000/api/books
```

**Expected:** New book object with ID
**Verify:** Stock history entry created for initial stock

### 6. PUT /api/books/:id - Update Book

```bash
curl -X PUT \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Book Name",
    "mrp": 220
  }' \
  http://localhost:5000/api/books/1
```

**Expected:** Updated book object
**Note:** Cannot update stock via this endpoint

### 7. DELETE /api/books/:id - Delete Book

```bash
curl -X DELETE \
  -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/books/1
```

**Expected:** Success message
**Verify:** Book removed from list, stock history cascade deleted

### 8. GET /api/books/:id/stock - Get Stock Info

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/books/1/stock
```

**Expected:** Current stock + history array (last 50 entries)

### 9. PATCH /api/books/:id/stock - Adjust Stock

```bash
curl -X PATCH \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": -5,
    "reason": "adjustment",
    "notes": "Damaged items removed",
    "staffName": "Admin"
  }' \
  http://localhost:5000/api/books/1/stock
```

**Expected:** Updated book + new stock history entry
**Validation:** Cannot make stock negative

### 10. POST /api/books/:id/restock - Restock Book

```bash
curl -X POST \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 20,
    "notes": "Weekly restock",
    "staffName": "Manager"
  }' \
  http://localhost:5000/api/books/1/restock
```

**Expected:** Updated book + stock history + success message

---

## Bills API Testing

### 1. GET /api/bills - List All Bills

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/bills
```

**Expected:** Array of bills (empty initially)

### 2. GET /api/bills?startDate=2026-10-01&endDate=2026-10-31 - Date Range

```bash
curl -H "Authorization: Bearer mock-token" \
  "http://localhost:5000/api/bills?startDate=2026-10-01&endDate=2026-10-31"
```

**Expected:** Bills within date range

### 3. POST /api/bills - Create Bill (Transaction)

**Important:** This is a complex transaction that:
1. Validates stock availability
2. Creates bill
3. Creates bill items
4. Deducts stock
5. Records stock history

```bash
curl -X POST \
  -H "Authorization: Bearer mock-token" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "customerMobile": "1234567890",
    "paymentMethod": "Cash",
    "staffName": "Cashier",
    "discountAmount": 10,
    "discountMode": "amount",
    "discountInput": "10",
    "items": [
      {
        "bookId": 1,
        "quantity": 2,
        "priceAtSale": 80
      },
      {
        "bookId": 2,
        "quantity": 1,
        "priceAtSale": 120
      }
    ]
  }' \
  http://localhost:5000/api/bills
```

**Expected:** 
- Bill created with auto-generated billNumber (YYYYMMDD-####)
- Bill items created
- Stock deducted from books (Book 1: -2, Book 2: -1)
- Stock history entries created for each item

**Validation Tests:**
- Insufficient stock: Try quantity > available stock → 400 error
- Invalid book ID: Use non-existent bookId → 400 error
- Empty items: Send empty items array → 400 validation error

### 4. GET /api/bills/:id - Get Bill with Items

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/bills/1
```

**Expected:** Bill object with items array (including book details)

### 5. GET /api/bills/by-number/:billNumber - Get Bill by Number

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/bills/by-number/20261008-0001
```

**Expected:** Bill object with items

---

## Reports API Testing

### 1. GET /api/reports/dashboard - Dashboard Statistics

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/reports/dashboard
```

**Expected Response Structure:**
```json
{
  "books": {
    "total": 6,
    "lowStock": 1,
    "totalStockValue": 12345
  },
  "sales": {
    "today": {
      "count": 0,
      "amount": 0
    },
    "thisMonth": {
      "count": 0,
      "amount": 0
    }
  },
  "recentBills": []
}
```

### 2. GET /api/reports/date-range - Sales Report

```bash
curl -H "Authorization: Bearer mock-token" \
  "http://localhost:5000/api/reports/date-range?startDate=2026-10-01&endDate=2026-10-31"
```

**Expected Response Structure:**
```json
{
  "dateRange": {
    "startDate": "2026-10-01",
    "endDate": "2026-10-31"
  },
  "summary": {
    "totalBills": 5,
    "totalAmount": 5000,
    "totalDiscount": 100,
    "totalItems": 15,
    "averageBillValue": 1000
  },
  "topBooks": [],
  "dailySales": [],
  "paymentMethods": {
    "cash": 3,
    "online": 2
  }
}
```

**Validation:** Both startDate and endDate are required

### 3. GET /api/reports/low-stock - Low Stock Report

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/reports/low-stock
```

**Expected:** Array of books where `currentStock <= minStock`

### 4. GET /api/reports/books-summary - Books Summary

```bash
curl -H "Authorization: Bearer mock-token" \
  http://localhost:5000/api/reports/books-summary
```

**Expected:** Array of all books with sales statistics

---

## Integration Test Scenarios

### Scenario 1: Complete Sale Flow

1. **Check initial stock**
   ```bash
   curl -H "Authorization: Bearer mock-token" \
     http://localhost:5000/api/books/1
   ```
   Note the current stock value.

2. **Create a sale**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer mock-token" \
     -H "Content-Type: application/json" \
     -d '{
       "customerName": "John Doe",
       "customerMobile": "9876543210",
       "paymentMethod": "Online",
       "items": [
         { "bookId": 1, "quantity": 3, "priceAtSale": 80 }
       ]
     }' \
     http://localhost:5000/api/bills
   ```

3. **Verify stock deduction**
   ```bash
   curl -H "Authorization: Bearer mock-token" \
     http://localhost:5000/api/books/1
   ```
   Stock should be reduced by 3.

4. **Check stock history**
   ```bash
   curl -H "Authorization: Bearer mock-token" \
     http://localhost:5000/api/books/1/stock
   ```
   Should show new entry with reason="sale"

### Scenario 2: Restock Flow

1. **Check current stock**
2. **Restock book**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer mock-token" \
     -H "Content-Type: application/json" \
     -d '{
       "quantity": 50,
       "notes": "Monthly restock"
     }' \
     http://localhost:5000/api/books/1/restock
   ```
3. **Verify stock increased**
4. **Check stock history** - should show restock entry

### Scenario 3: Validation Error Handling

1. **Try to sell more than available**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer mock-token" \
     -H "Content-Type: application/json" \
     -d '{
       "customerName": "Test",
       "paymentMethod": "Cash",
       "items": [
         { "bookId": 1, "quantity": 9999, "priceAtSale": 80 }
       ]
     }' \
     http://localhost:5000/api/bills
   ```
   **Expected:** 400 error with "Insufficient stock" message

2. **Try to create book with invalid data**
   ```bash
   curl -X POST \
     -H "Authorization: Bearer mock-token" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "",
       "language": "English",
       "mrp": -100
     }' \
     http://localhost:5000/api/books
   ```
   **Expected:** 400 validation error

---

## Error Response Formats

### 400 Bad Request - Validation Error
```json
{
  "error": "Validation Error",
  "message": "Invalid book data",
  "details": [
    {
      "path": ["mrp"],
      "message": "MRP must be non-negative"
    }
  ]
}
```

### 401 Unauthorized - Missing/Invalid Token
```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid Authorization header"
}
```

### 404 Not Found
```json
{
  "error": "Not Found",
  "message": "Book not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Failed to create book"
}
```

---

## Mock Data Verification

The mock repository seeds the following data on startup:

**Books (6 items):**
1. Bhagavad Gita As It Is (English) - Stock: 25
2. Srimad Bhagavatam Canto 1 (English) - Stock: 10
3. भगवद गीता (Hindi) - Stock: 15
4. चैतन्य चरितामृत (Marathi) - Stock: 8
5. Krishna Book (English) - Stock: 2 ⚠️ LOW STOCK
6. Nectar of Devotion (English) - Stock: 12

**Stock History:**
- Each book has an initial stock history entry with reason="initial"

---

## Testing Checklist

### Books API
- [ ] List all books
- [ ] Filter by language
- [ ] Search by name
- [ ] Get single book
- [ ] Create book (with initial stock)
- [ ] Update book
- [ ] Delete book
- [ ] Get stock info
- [ ] Adjust stock (positive)
- [ ] Adjust stock (negative)
- [ ] Restock book
- [ ] Validation: Negative stock prevented
- [ ] Validation: Cannot update stock via PUT

### Bills API
- [ ] List all bills
- [ ] Filter by date range
- [ ] Create bill (complete transaction)
- [ ] Get bill with items
- [ ] Get bill by number
- [ ] Validation: Insufficient stock error
- [ ] Validation: Invalid book ID error
- [ ] Verify stock deduction
- [ ] Verify stock history entries

### Reports API
- [ ] Dashboard statistics
- [ ] Date range report
- [ ] Low stock report
- [ ] Books summary

### Integration
- [ ] Complete sale flow
- [ ] Restock flow
- [ ] Stock history tracking
- [ ] Error handling
- [ ] Authentication (mock mode)

---

## Known Limitations (Mock Data Mode)

1. **Data Persistence:** All data is lost on server restart
2. **No Transactions:** Operations are not atomic (in production, database transactions will ensure atomicity)
3. **No Concurrency:** No locking mechanism for concurrent stock updates
4. **No Soft Delete:** Books are hard-deleted (production should use soft delete)
5. **No Referential Integrity Checks:** Bill items don't prevent book deletion (should in production)
6. **Mock Authentication:** Any token is accepted (production will validate Firebase tokens)

---

## Production Readiness Notes

When connecting to Supabase PostgreSQL:

1. **Replace Mock Repository** with Drizzle queries
2. **Enable Firebase Auth** by setting environment variables
3. **Add Database Transactions** for bill creation
4. **Implement Soft Delete** for books with sales history
5. **Add Referential Integrity** checks before deletion
6. **Add Audit Logging** for sensitive operations
7. **Implement Rate Limiting** to prevent abuse
8. **Add Request Validation** middleware
9. **Setup Error Monitoring** (Sentry, etc.)
10. **Enable CORS** configuration for production domains
