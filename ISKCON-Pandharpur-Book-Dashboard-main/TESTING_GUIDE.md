# Phase 1 Manual Integration Testing Guide

## Prerequisites

Before testing, ensure you have completed the database setup:

1. ✅ PostgreSQL database is running
2. ✅ `.env` files created in `lib/db` and `artifacts/api-server` with valid DATABASE_URL
3. ✅ Database schema pushed: `pnpm --filter @workspace/db run push`

## Test Environment Setup

### Terminal 1: Start API Server

```bash
cd artifacts/api-server
pnpm install  # if not already done
pnpm run dev
```

Expected output:
```
Server running on http://localhost:5000
```

### Terminal 2: Start Frontend

```bash
cd artifacts/iskcon-books
pnpm install  # if not already done
pnpm run dev
```

Expected output:
```
Local: http://localhost:5173
```

Create `.env` file in `artifacts/iskcon-books`:
```
VITE_API_URL=http://localhost:5000
```

## Manual Test Cases

### Test 1: Books Screen - Initial Load (Empty State)

**Steps:**
1. Open browser: `http://localhost:5173`
2. Navigate to "Books" screen (click Books in sidebar)

**Expected Results:**
- ✅ Loading state appears briefly: "Loading books..."
- ✅ Empty state displays: "No books in inventory yet. Add your first book below."
- ✅ "Add a book" form is visible and functional
- ✅ No errors in browser console
- ✅ No errors in API server logs

**API Call Verification:**
- Check Network tab: `GET http://localhost:5000/api/books`
- Response: `200 OK` with empty array `[]`

---

### Test 2: Create Book - Valid Data

**Steps:**
1. In "Add a book" form, fill in:
   - Book title: "Bhagavad Gita"
   - Language: "English"
   - Opening stock: "10"
   - MRP: "100"
   - Actual price: "80"
2. Click "Save book" button

**Expected Results:**
- ✅ Success notification appears
- ✅ Book appears in the list immediately
- ✅ Book displays: "Bhagavad Gita" | English · MRP ₹100 · Actual ₹80
- ✅ Stock badge shows: "10"
- ✅ Form clears after submission

**API Call Verification:**
- Network tab: `POST http://localhost:5000/api/books`
- Request body:
  ```json
  {
    "name": "Bhagavad Gita",
    "language": "English",
    "mrp": 100,
    "actualPrice": 80,
    "stock": 10,
    "minStock": 0
  }
  ```
- Response: `201 Created` with book object including `id`

**Database Verification:**
```sql
SELECT * FROM books;
-- Should show 1 book

SELECT * FROM stock_history WHERE reason = 'initial';
-- Should show 1 entry with changeAmount = 10
```

---

### Test 3: Create Book - Zero Stock

**Steps:**
1. Add another book:
   - Book title: "Srimad Bhagavatam"
   - Language: "Hindi"
   - Opening stock: "0"
   - MRP: "150"
   - Actual price: "120"
2. Click "Save book"

**Expected Results:**
- ✅ Book appears with stock "0"
- ✅ Stock badge shows "Out of stock" (red)
- ✅ No stock_history entry created for zero stock

**Database Verification:**
```sql
SELECT * FROM stock_history WHERE book_id = 2;
-- Should return 0 rows (no history for zero initial stock)
```

---

### Test 4: Search Books by Title

**Steps:**
1. Ensure you have at least 2 books (from previous tests)
2. Type "Bhagavad" in search field

**Expected Results:**
- ✅ Only "Bhagavad Gita" appears
- ✅ "Srimad Bhagavatam" is filtered out
- ✅ Search is case-insensitive

**Steps:**
3. Clear search (click X button)

**Expected Results:**
- ✅ All books appear again

---

### Test 5: Filter Books by Language

**Steps:**
1. Click "English" chip/button

**Expected Results:**
- ✅ Only "Bhagavad Gita" (English) appears
- ✅ "Srimad Bhagavatam" (Hindi) is filtered out
- ✅ "English" chip is highlighted/active

**Steps:**
2. Click "All" chip

**Expected Results:**
- ✅ All books appear again
- ✅ "All" chip is highlighted

---

### Test 6: Page Refresh - Data Persistence

**Steps:**
1. With books visible, refresh the page (F5 or Ctrl+R)

**Expected Results:**
- ✅ Loading state appears briefly
- ✅ All books load from database
- ✅ Stock levels match previous values
- ✅ No "empty state" message

**API Call Verification:**
- Network tab: `GET http://localhost:5000/api/books`
- Response: `200 OK` with array of all books

---

### Test 7: Create Book - Validation Errors

**Steps:**
1. Try to submit form with empty "Book title"

**Expected Results:**
- ✅ Browser validation prevents submission
- ✅ "Please fill out this field" message

**Steps:**
2. Fill title, leave "Language" empty, submit

**Expected Results:**
- ✅ Validation prevents submission

**Steps:**
3. Try negative MRP: "-50"

**Expected Results:**
- ✅ Validation prevents submission (min="0")

---

### Test 8: API Error Handling

**Steps:**
1. Stop the API server (Terminal 1: Ctrl+C)
2. Refresh the frontend page

**Expected Results:**
- ✅ Error message appears: "Failed to load books..."
- ✅ "Retry" button is visible
- ✅ Red error styling

**Steps:**
3. Restart API server
4. Click "Retry" button

**Expected Results:**
- ✅ Loading state appears
- ✅ Books load successfully
- ✅ Error clears

---

### Test 9: Multiple Books - Different Languages

**Steps:**
1. Add 3 more books:
   - "Chaitanya Charitamrita" | Marathi | MRP 200 | Actual 160 | Stock 5
   - "Nectar of Devotion" | English | MRP 120 | Actual 100 | Stock 15
   - "Krishna Book" | Hindi | MRP 180 | Actual 150 | Stock 3

**Expected Results:**
- ✅ All 5 books appear in the list
- ✅ Language filter shows: All, English, Hindi, Marathi
- ✅ Each language filter works correctly
- ✅ Search works across all books

**Database Verification:**
```sql
SELECT COUNT(*) FROM books;
-- Should return 5

SELECT language, COUNT(*) FROM books GROUP BY language;
-- Should show counts per language
```

---

### Test 10: Low Stock Badge

**Steps:**
1. Add a book with stock below minimum:
   - Book: "Test Low Stock"
   - Language: "English"
   - Opening stock: "2"
   - MRP: 50
   - Actual: 40
2. Manually set minStock in database:
   ```sql
   UPDATE books SET min_stock = 5 WHERE name = 'Test Low Stock';
   ```
3. Refresh page

**Expected Results:**
- ✅ Book shows with yellow "Low stock" badge (stock 2 < minStock 5)

---

## API Endpoint Testing (Optional - Use Postman/cURL)

### GET /api/books
```bash
curl http://localhost:5000/api/books
```

### GET /api/books/:id
```bash
curl http://localhost:5000/api/books/1
```

### POST /api/books
```bash
curl -X POST http://localhost:5000/api/books \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Book",
    "language": "English",
    "mrp": 100,
    "actualPrice": 80,
    "stock": 10
  }'
```

### PUT /api/books/:id
```bash
curl -X PUT http://localhost:5000/api/books/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bhagavad Gita (Updated)",
    "mrp": 110
  }'
```

### DELETE /api/books/:id
```bash
curl -X DELETE http://localhost:5000/api/books/1
```

### GET /api/books/:id/stock
```bash
curl http://localhost:5000/api/books/1/stock
```

### PATCH /api/books/:id/stock
```bash
curl -X PATCH http://localhost:5000/api/books/1/stock \
  -H "Content-Type: application/json" \
  -d '{
    "amount": -2,
    "reason": "adjustment",
    "notes": "Manual stock adjustment",
    "staffName": "Admin"
  }'
```

### POST /api/books/:id/restock
```bash
curl -X POST http://localhost:5000/api/books/1/restock \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 20,
    "notes": "Weekly restock",
    "staffName": "Manager"
  }'
```

---

## Known Limitations (Phase 1)

1. ❌ **No Edit/Delete UI** - Books can only be created through UI
   - Edit/Delete requires API calls or Phase 2 implementation

2. ❌ **Bills still use hardcoded data** - Phase 2 work
   - Creating bills doesn't affect book stock yet
   - Bills are not persisted to database

3. ❌ **No Clerk authentication** - Phase 2 work
   - API endpoints are public (no auth required)
   - staffName/clerkUserId not enforced

4. ❌ **No stock adjustment UI** - Phase 2 work
   - Stock can only be set during book creation
   - Restock/adjustment requires API calls

5. ❌ **No validation for duplicate book names**
   - Multiple books can have the same name

---

## Success Criteria

Phase 1 is successfully completed if:

- ✅ Database schema pushed without errors
- ✅ API server starts and responds to health check
- ✅ Frontend loads empty book list from API
- ✅ Creating a book persists to database
- ✅ Created book appears in UI immediately
- ✅ Page refresh loads books from database
- ✅ Search and filter work correctly
- ✅ Error states display when API is unavailable
- ✅ No TypeScript errors
- ✅ No console errors during normal operation

---

## Troubleshooting

### Books not loading / API errors

1. Check API server is running on port 5000
2. Verify DATABASE_URL in `artifacts/api-server/.env`
3. Check browser console for CORS errors
4. Verify VITE_API_URL in `artifacts/iskcon-books/.env`

### Database connection errors

1. Verify PostgreSQL is running
2. Check connection string format
3. Ensure database exists
4. Test connection: `psql $DATABASE_URL`

### TypeScript errors

1. Run: `pnpm install` in workspace root
2. Clear build cache: delete `tsconfig.tsbuildinfo` files
3. Rebuild: `pnpm run build`

### Port already in use

1. API server: Change PORT in `.env` or kill process on 5000
2. Frontend: Vite will auto-increment (5173 → 5174 → ...)
