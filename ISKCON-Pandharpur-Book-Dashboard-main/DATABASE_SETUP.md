# Database Setup Guide

## Prerequisites

- PostgreSQL database server running
- Database credentials (username, password, host, port, database name)

## Step 1: Configure Database Connection

Create a `.env` file in the `lib/db` directory:

```bash
cd lib/db
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```
DATABASE_URL=postgresql://username:password@localhost:5432/iskcon_books
```

**Note:** Replace with your actual database credentials.

## Step 2: Push Database Schema

Run the following command from the **project root**:

```bash
pnpm --filter @workspace/db run push
```

This will:
- Create all tables (books, bills, bill_items, stock_history)
- Set up foreign keys and indexes
- Apply all schema constraints

## Step 3: Verify Tables Created

Connect to your PostgreSQL database and verify the tables:

```sql
\dt  -- List all tables

-- You should see:
-- books
-- bills
-- bill_items  
-- stock_history
```

## Database Schema Overview

### Tables Created

1. **books** - Book inventory
   - id, name, language, mrp, actualPrice, stock, minStock
   - Timestamps: createdAt, updatedAt

2. **bills** - Sales records
   - id, billNumber (unique), customerName, customerMobile
   - date, time, paymentMethod, staffName, clerkUserId
   - discountAmount, discountMode, discountInput
   - Timestamp: createdAt

3. **bill_items** - Line items per bill
   - id, billId (FK → bills, CASCADE), bookId (FK → books, RESTRICT)
   - quantity, priceAtSale
   - Timestamp: createdAt

4. **stock_history** - Audit trail for stock changes
   - id, bookId (FK → books, CASCADE)
   - changeAmount, reason (sale/restock/adjustment/initial)
   - referenceId, staffName, clerkUserId, notes
   - Timestamp: createdAt

### Foreign Key Constraints

- `bill_items.billId` → `bills.id` (ON DELETE CASCADE)
- `bill_items.bookId` → `books.id` (ON DELETE RESTRICT)
- `stock_history.bookId` → `books.id` (ON DELETE CASCADE)

### Indexes

- `books.name` - For search performance
- `bills.billNumber` - Unique constraint
- `bills.date` - For date-range queries
- `bill_items.billId` - For bill lookups
- `bill_items.bookId` - For book sales history
- `stock_history.bookId` - For stock audit trail
- `stock_history.createdAt` - For chronological queries

## Troubleshooting

### Error: "DATABASE_URL not found"

Make sure you created `.env` file in `lib/db` directory with the DATABASE_URL variable.

### Error: "cannot connect to database"

- Verify PostgreSQL is running
- Check connection credentials in DATABASE_URL
- Ensure database exists (or has CREATE DATABASE permission)
- Check firewall/network access

### Force Push (Caution!)

If you need to reset the schema (WARNING: destroys all data):

```bash
pnpm --filter @workspace/db run push-force
```

## Next Steps

After successful database setup:

1. Configure API server with DATABASE_URL
2. Start the API server
3. Start the frontend
4. Books will load from the database (empty initially)
5. Add books through the UI to test the integration
