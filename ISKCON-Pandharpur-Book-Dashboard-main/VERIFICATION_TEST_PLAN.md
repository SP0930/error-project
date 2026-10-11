# Book ID Mismatch Fix - Verification Test Plan

## SETUP INSTRUCTIONS

### Terminal 1: Backend
```cmd
cd C:\Users\patil\Downloads\ISKCON-Pandharpur-Book-Dashboard-main\ISKCON-Pandharpur-Book-Dashboard-main\artifacts\api-server
set DATABASE_URL=postgresql://postgres.zfvuwrfbnnxizfxqvjpt:IskconTemple123@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
set PORT=5000
pnpm run start
```

**Expected Output:**
```
[INFO]: Server listening port: 5000
```

### Terminal 2: Frontend
```cmd
cd C:\Users\patil\Downloads\ISKCON-Pandharpur-Book-Dashboard-main\ISKCON-Pandharpur-Book-Dashboard-main\artifacts\iskcon-books
set PORT=3000
set BASE_PATH=/
pnpm run dev
```

**Expected Output:**
```
VITE ready in Xms
Local: http://localhost:3000/
```

### Browser
Open: `http://localhost:3000`
Open Developer Tools (F12) → Console tab

---

## TEST 1: Cart Clears on Page Load (Critical)

### Purpose
Verify that cart is cleared when books are loaded, preventing stale book IDs.

### Steps
1. Navigate to Books section
2. Note the book IDs displayed (they should be visible in the data or inspect element)
3. Navigate to Sales section
4. Add 1-2 books to cart
5. **Refresh the browser (F5)**
6. Check the cart display

### Expected Result
✅ Cart should be EMPTY after page refresh

### Actual Result
_[User to fill in]_

### Evidence
- Screenshot of empty cart after refresh
- Console logs showing loadBooks() executed

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 2: Normal Bill Creation with Valid Books (Critical)

### Purpose
Verify bill creation works with current, valid book IDs from database.

### Pre-requisites
- At least one book exists in database with stock >= 1
- Cart is empty (refresh page if needed)

### Steps
1. Navigate to Books section
2. Verify books are displayed (they are loaded from database)
3. Navigate to Sales section
4. Click on a book to add it to cart (quantity = 1)
5. Enter customer name: "Test Customer"
6. Keep payment method as "Online"
7. Leave discount as 0
8. Click "Complete Sale" button
9. Watch both browser console AND backend terminal

### Expected Results
✅ Frontend Console: No errors
✅ Backend Terminal: 
   - `[INFO]: request completed` with `statusCode: 201`
   - `[INFO]: Bill created`
   - `[INFO]: Bill items created`
   - `[INFO]: Stock deducted`
✅ Browser: Receipt page displays
✅ Cart: Cleared automatically

### Actual Results
_[User to fill in]_

**Frontend Console Logs:**
```
[User to paste]
```

**Backend Terminal Logs:**
```
[User to paste]
```

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 3: Database Verification of Bill Creation

### Purpose
Verify that bill, bill_items, and stock updates are persisted in Supabase.

### Pre-requisite
Test 2 must pass.

### Steps
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select project: `iskcon-pandharpur-dashboard`
3. Go to Table Editor

#### Check 3.1: Bills Table
1. Click on `bills` table
2. Find the most recent bill (latest `created_at`)
3. Verify fields match the test sale:
   - `customer_name` = "Test Customer"
   - `payment_method` = "Online"
   - `discount_amount` = 0
   - `bill_number` is a valid number

**Result:** _[User to fill: Bill found YES/NO]_

#### Check 3.2: Bill Items Table
1. Click on `bill_items` table
2. Find rows where `bill_id` matches the bill from 3.1
3. Verify:
   - `book_id` matches the book that was sold
   - `quantity` = 1
   - `price_at_sale` matches the book's actual_price

**Result:** _[User to fill: Bill items correct YES/NO]_

#### Check 3.3: Books Stock Deduction
1. Click on `books` table
2. Find the book that was sold
3. Note the current stock value
4. **Expected:** Stock should be (original_stock - 1)

**Original Stock:** _[User to fill]_
**Current Stock:** _[User to fill]_
**Stock Decreased:** _[YES/NO]_

#### Check 3.4: Stock History
1. Click on `stock_history` table
2. Find the most recent entry for the sold book
3. Verify:
   - `book_id` matches
   - `change_amount` = -1 (negative because stock decreased)
   - `reason` = "sale"
   - `notes` contains the bill number

**Result:** _[User to fill: Stock history recorded YES/NO]_

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 4: Cart Validation Prevents Invalid Book IDs

### Purpose
Verify that the new validation logic catches and removes stale book IDs before sending to backend.

### Setup
This test requires simulating a stale cart. Two methods:

#### Method A: Browser Console Manipulation (Easier)
1. Refresh page to clear cart
2. Add a valid book to cart
3. Open Browser Console (F12)
4. Type this command to inject a fake book ID:
```javascript
// This simulates a stale cart entry
// Replace with actual validation test when cart is visible in React DevTools
```

#### Method B: Supabase Manipulation (More realistic)
1. Add a valid book to cart
2. Note the book ID in cart (inspect element or check network request)
3. Open Supabase → books table
4. **Delete** that specific book from database
5. Return to app (DON'T refresh yet)
6. Try to create a bill

### Expected Result
✅ Frontend shows error: "Cannot create bill: Book ID X no longer exists"
✅ Invalid item is removed from cart automatically
✅ NO API request is sent to backend (check Network tab)
✅ Backend shows NO error logs

### Actual Result
_[User to fill in]_

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 5: Cart Validation Prevents Insufficient Stock

### Purpose
Verify validation catches insufficient stock before API call.

### Setup
1. Find or create a book with low stock (e.g., stock = 2)
2. Add that book to cart multiple times until quantity > stock
   OR manually edit if possible

### Steps
1. Navigate to Sales
2. Add a book with stock = 2
3. Click the + button multiple times
4. Observe: Cart quantity should be capped at 2 (existing logic)
5. Try to create bill with quantity = 2
6. **Should succeed**

**Note:** This test verifies existing stock cap logic still works. To test the new insufficient stock validation, we'd need to manipulate cart state, which is not easily done without React DevTools.

### Expected Result
✅ Cart quantity capped at available stock
✅ Bill creation succeeds

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 6: Cart Cleared After Successful Bill (Regression Test)

### Purpose
Verify existing functionality still works: cart clears after successful bill creation.

### Steps
1. Add a book to cart
2. Complete a sale successfully
3. Navigate back to Sales section
4. Check cart

### Expected Result
✅ Cart is empty

### Actual Result
_[User to fill in]_

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 7: Cart NOT Cleared During Add Book Operation

### Purpose
Verify that cart is NOT incorrectly cleared when a new book is added (only when loadBooks() is called).

### Steps
1. Navigate to Books section
2. Add a new book via the "Add a book" form
3. After book is added, navigate to Sales
4. Verify any items previously in cart are still there

**Note:** This test verifies we only clear cart on loadBooks(), not on individual book additions.

### Expected Result
✅ Cart items preserved when adding new books
✅ Cart only clears on: page load, after sale completion, explicit refresh

### Actual Result
_[User to fill in]_

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## TEST 8: Error Handling - Failed Bill Creation

### Purpose
Verify that if bill creation fails (backend error), cart is NOT cleared and stock is NOT deducted.

### Setup
Simulate a backend error (optional, requires backend manipulation).

### Steps
1. Add a book to cart
2. If possible, cause a backend error (e.g., disconnect database briefly)
3. Try to create bill
4. Check cart state

### Expected Result
✅ Error message displayed
✅ Cart items PRESERVED (not cleared)
✅ Stock NOT deducted in database
✅ No partial data in bills table

### Status
_[PASS / FAIL / NOT VERIFIED - Requires backend manipulation]_

---

## TEST 9: Multiple Book Sale

### Purpose
Verify bill creation works with multiple different books.

### Steps
1. Clear cart (refresh page)
2. Add 2-3 different books to cart
3. Create bill
4. Verify receipt shows all books
5. Check Supabase:
   - Multiple rows in bill_items for the same bill_id
   - Stock decreased for ALL books sold

### Expected Result
✅ Bill created with multiple items
✅ All books' stock decreased correctly
✅ Bill_items has correct number of rows

### Status
_[PASS / FAIL / NOT VERIFIED]_

---

## CRITICAL ISSUES CHECKLIST

Mark each as PASS/FAIL after testing:

- [ ] **CRITICAL:** Cart clears on page load (prevents stale IDs)
- [ ] **CRITICAL:** Bill creation succeeds with valid book IDs
- [ ] **CRITICAL:** Stock decreases in database after sale
- [ ] **CRITICAL:** Bill persists in database
- [ ] **CRITICAL:** Bill items persist in database
- [ ] **CRITICAL:** Invalid book IDs caught before API call
- [ ] **IMPORTANT:** Cart clears after successful sale
- [ ] **IMPORTANT:** Stock history recorded
- [ ] **MEDIUM:** Cart preserved during normal operations
- [ ] **MEDIUM:** Multiple books can be sold in one bill

---

## VERIFICATION SUMMARY

**Tests Completed:** __ / 9
**Tests Passed:** __
**Tests Failed:** __
**Critical Failures:** __

**Overall Status:** [PASS / FAIL / INCOMPLETE]

**Issues Found:**
_[List any issues discovered during testing]_

**Recommended Actions:**
_[Any fixes or improvements needed]_

---

## NOTES FOR TESTER

1. **Keep backend terminal visible** - Many issues show up in backend logs
2. **Keep browser console open** - Frontend errors appear here
3. **Take screenshots** - Especially for failures
4. **Record Supabase state** - Before and after each test
5. **Don't skip tests** - Even if early tests pass, later tests might reveal issues

**IMPORTANT:** If ANY critical test fails, STOP testing and report the issue immediately with:
- Exact steps to reproduce
- Frontend console logs
- Backend terminal logs
- Supabase table screenshots
