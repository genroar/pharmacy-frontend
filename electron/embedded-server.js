/**
 * Complete Embedded SQLite Server using sql.js (Pure JavaScript)
 * Works in both development and packaged Electron app
 */

// CRITICAL: Prevent uncaught errors from showing popups on Windows
process.on('uncaughtException', (error) => {
  console.error('[Embedded-Server] Uncaught Exception:', error.message);
  // Don't rethrow - prevent popup
});

process.on('unhandledRejection', (reason) => {
  console.error('[Embedded-Server] Unhandled Rejection:', reason);
  // Don't rethrow - prevent popup
});

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Helper to resolve modules from multiple paths
function resolveModule(moduleName) {
  const searchPaths = [
    // Standard require
    moduleName,
    // Development
    path.join(__dirname, '..', 'node_modules', moduleName),
    path.join(__dirname, 'node_modules', moduleName),
    // Production - app.asar
    path.join(process.resourcesPath || '', 'app.asar', 'node_modules', moduleName),
    path.join(process.resourcesPath || '', 'app', 'node_modules', moduleName),
    // Production - backend node_modules
    path.join(process.resourcesPath || '', 'backend-pharmachy', 'node_modules', moduleName),
  ];

  for (const p of searchPaths) {
    try {
      return require(p);
    } catch (e) {
      continue;
    }
  }

  // Final fallback
  return require(moduleName);
}

const express = resolveModule('express');
const cors = resolveModule('cors');

// ==================== DATA DIRECTORIES (MUST BE FIRST) ====================
const DATA_DIR = path.join(require('os').homedir(), '.zapeera', 'data');
const DB_PATH = path.join(DATA_DIR, 'zapeera.db');

// Ensure data directory exists (with error handling for Windows)
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('[DB] Created data directory:', DATA_DIR);
  }
} catch (e) {
  console.error('[DB] Failed to create data directory:', e.message);
  // Continue anyway - might work later
}

// PostgreSQL sync configuration
const REMOTE_DATABASE_URL = 'postgresql://poszap_user:Ezify143@31.97.72.136:5432/poszap_db?schema=public';
let pgClient = null;
let isOnline = false;
let syncInProgress = false;
let lastSyncTime = null;

// ==================== TWO-WAY SYNC CONFIGURATION ====================
// PostgreSQL is SOURCE OF TRUTH - conflicts are resolved by PostgreSQL winning
const SYNC_CONFIG = {
  POLL_INTERVAL: 5000,        // Poll every 5 seconds
  FULL_SYNC_INTERVAL: 15000,  // Full sync every 15 seconds (catches manual DB changes)
  PUSH_DEBOUNCE: 2000,        // Debounce local changes by 2 seconds before pushing
  MAX_QUEUE_SIZE: 1000,       // Maximum offline queue size
  RETRY_ATTEMPTS: 3,          // Retry failed syncs
  BATCH_SIZE: 100             // Sync records in batches
};

let fullSyncCounter = 0;  // Counter to trigger full sync periodically

// Offline change queue - persisted to disk
const QUEUE_PATH = path.join(DATA_DIR, 'sync-queue.json');
let offlineQueue = [];
let lastPullTimestamps = {};  // Track last pull time per table

// Load offline queue from SQLite (migrate from JSON if exists)
function loadOfflineQueue() {
  try {
    if (!db) {
      offlineQueue = [];
      return;
    }

    // Migrate old JSON queue to SQLite if it exists
    if (fs.existsSync(QUEUE_PATH)) {
      try {
        const data = fs.readFileSync(QUEUE_PATH, 'utf8');
        const jsonQueue = JSON.parse(data);
        console.log(`[Sync] 📥 Migrating ${jsonQueue.length} operations from JSON to SQLite...`);

        for (const item of jsonQueue) {
          if (!item.synced) {
            const queueId = item.id || uuid();
            const payload = JSON.stringify(item.data || {});
            run(`INSERT OR IGNORE INTO sync_queue (id, table_name, operation, payload, synced, retries, created_at)
                 VALUES (?, ?, ?, ?, 0, ?, ?)`,
              [queueId, item.tableName, item.operation, payload, item.retries || 0, item.timestamp || now()]);
          }
        }

        // Backup old file
        fs.renameSync(QUEUE_PATH, QUEUE_PATH + '.backup');
        console.log(`[Sync] ✅ Migration complete`);
      } catch (e) {
        console.log('[Sync] Could not migrate JSON queue:', e.message);
      }
    }

    // Load from SQLite
    const unsynced = query(`SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC`);
    offlineQueue = unsynced.map(row => ({
      id: row.id,
      tableName: row.table_name,
      operation: row.operation,
      data: JSON.parse(row.payload),
      timestamp: row.created_at,
      retries: row.retries || 0,
      synced: row.synced === 1
    }));

    console.log(`[Sync] 📥 Loaded ${offlineQueue.length} queued operations from SQLite`);
  } catch (e) {
    console.log('[Sync] Could not load queue:', e.message);
    offlineQueue = [];
  }
}

// Save offline queue to SQLite (no longer needed, but kept for compatibility)
function saveOfflineQueue() {
  // Queue is now in SQLite - no need to save separately
  // This function is kept for backward compatibility
}

// Add operation to offline queue in SQLite
// CRITICAL: This function should NEVER throw errors - data is already saved to SQLite
function queueOfflineOperation(tableName, operation, data) {
  try {
    if (!tableName || !operation || !data) {
      console.log('[Sync] ⚠️ queueOfflineOperation called with invalid params:', { tableName, operation, hasData: !!data });
      return; // Don't throw - just return
    }

    if (!db) {
      console.log('[Sync] ⚠️ Database not initialized, cannot queue operation');
      return;
    }

    // Check queue size
    const queueSize = query(`SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0`)[0]?.count || 0;
    if (queueSize >= SYNC_CONFIG.MAX_QUEUE_SIZE) {
      // Remove oldest synced items
      run(`DELETE FROM sync_queue WHERE synced = 1 ORDER BY synced_at ASC LIMIT ?`, [100]);
    }

    // Insert into SQLite sync_queue table
    const queueId = uuid();
    const payload = JSON.stringify(data);
    const timestamp = now();

    const success = run(`INSERT INTO sync_queue (id, table_name, operation, payload, synced, retries, created_at)
                         VALUES (?, ?, ?, ?, 0, 0, ?)`,
      [queueId, tableName, operation, payload, timestamp]);

    if (success) {
      // Also add to in-memory queue for immediate processing
      offlineQueue.push({
        id: queueId,
        tableName,
        operation,
        data,
        timestamp,
        retries: 0,
        synced: false
      });
      console.log(`[Sync] 📝 Queued ${operation} for ${tableName} in SQLite (${queueSize + 1} in queue)`);
    } else {
      console.error(`[Sync] ⚠️ Failed to queue ${tableName} operation in SQLite`);
    }
  } catch (error) {
    // CRITICAL: Never throw from queueOfflineOperation - data is already saved to SQLite
    console.error(`[Sync] ⚠️ Error queuing ${tableName} operation:`, error.message);
    // Continue - data is still in SQLite and will be synced later
  }
}

 let app = null;
let server = null;
let db = null;
let SQL = null;

// Load sql.js with multiple fallback paths
async function loadSqlJs() {
  if (SQL) return SQL;

  const possiblePaths = [
    // Development paths
    path.join(__dirname, '..', 'node_modules', 'sql.js'),
    path.join(__dirname, 'node_modules', 'sql.js'),
    // Production paths (inside app.asar)
    path.join(process.resourcesPath || '', 'app.asar', 'node_modules', 'sql.js'),
    path.join(process.resourcesPath || '', 'app', 'node_modules', 'sql.js'),
    // Production - backend node_modules (also bundled)
    path.join(process.resourcesPath || '', 'backend-pharmachy', 'node_modules', 'sql.js'),
    // Try global require
    'sql.js'
  ];

  for (const p of possiblePaths) {
    try {
      console.log('[SQL.js] Trying:', p);
      const initSqlJs = require(p);
      SQL = await initSqlJs();
      console.log('[SQL.js] ✅ Loaded successfully from:', p);
      return SQL;
    } catch (e) {
      console.log('[SQL.js] ❌ Failed:', p, '-', e.message);
      continue;
    }
  }

  throw new Error('Could not load sql.js from any path');
}

// Initialize database with all tables
async function initDatabase() {
  try {
    await loadSqlJs();
  } catch (e) {
    console.error('[DB] Failed to load sql.js:', e.message);
    // CRITICAL: Don't throw on Windows - log and try to continue
    // This prevents popup errors
    console.error('[DB] Error details:', e.stack);
    throw e; // Still throw but will be caught by startServer
  }

  // Load existing database or create new one
  let dbData = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      dbData = fs.readFileSync(DB_PATH);
      console.log('[DB] Loaded existing database from:', DB_PATH);
    } catch (e) {
      console.log('[DB] Could not load existing database, creating new one');
    }
  }

  db = new SQL.Database(dbData);

  // CRITICAL: Verify database is actually working
  try {
    const testResult = query('SELECT 1 as test');
    if (testResult && testResult.length > 0) {
      console.log('[DB] ✅ Database initialized and verified');
    } else {
      console.error('[DB] ⚠️ Database query test returned no results');
      // Try to recreate database
      db = new SQL.Database();
      console.log('[DB] ✅ Created new database');
    }
  } catch (e) {
    console.error('[DB] ❌ Database verification failed:', e.message);
    // Try to recreate database
    try {
      db = new SQL.Database();
      console.log('[DB] ✅ Created new database after verification failure');
    } catch (e2) {
      console.error('[DB] ❌ Failed to create new database:', e2.message);
    }
  }

    // Run migrations for existing databases
  const migrations = [
    // Add username column to users table if it doesn't exist
    `ALTER TABLE users ADD COLUMN username TEXT`,
    // Add sessionToken column if it doesn't exist
    `ALTER TABLE users ADD COLUMN sessionToken TEXT`,
    // Add lastLoginAt column if it doesn't exist
    `ALTER TABLE users ADD COLUMN lastLoginAt TEXT`,
    // Add capacity column to shelves table if it doesn't exist
    `ALTER TABLE shelves ADD COLUMN capacity INTEGER DEFAULT 100`,
    // Add missing columns to products table
    `ALTER TABLE products ADD COLUMN unitType TEXT DEFAULT 'PIECE'`,
    `ALTER TABLE products ADD COLUMN genericName TEXT`,
    `ALTER TABLE products ADD COLUMN formula TEXT`,
    `ALTER TABLE products ADD COLUMN batchNumber TEXT`,
    `ALTER TABLE products ADD COLUMN costPrice REAL DEFAULT 0`,
    // Add missing columns to customers table (if any)
    `ALTER TABLE customers ADD COLUMN totalPurchases INTEGER DEFAULT 0`,
    `ALTER TABLE customers ADD COLUMN isVIP INTEGER DEFAULT 0`,
    `ALTER TABLE customers ADD COLUMN lastVisit TEXT`,
    // Add missing columns to suppliers table (if any)
    `ALTER TABLE suppliers ADD COLUMN manufacturerId TEXT`,
    // Add missing columns to manufacturers table (if any)
    `ALTER TABLE manufacturers ADD COLUMN website TEXT`,
    `ALTER TABLE manufacturers ADD COLUMN country TEXT`
  ];

  for (const migration of migrations) {
    try {
      db.run(migration);
      console.log('[DB] Migration applied:', migration.substring(0, 50) + '...');
    } catch (e) {
      // Column already exists or table doesn't exist yet - that's fine
      if (!e.message.includes('duplicate column') && !e.message.includes('no such table')) {
        // Only log if it's not a duplicate column error
        console.log('[DB] Migration skipped (expected):', e.message);
      }
    }
  }

  // Update existing users: set username = email where username is null
  try {
    db.run("UPDATE users SET username = email WHERE username IS NULL");
    console.log('[DB] Updated users: username = email where null');
  } catch (e) {
    // Table might not exist yet
  }

  // Create all tables
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL,
      role TEXT DEFAULT 'ADMIN', isActive INTEGER DEFAULT 0, companyId TEXT, branchId TEXT,
      createdBy TEXT, sessionToken TEXT, lastLoginAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, address TEXT, phone TEXT, email TEXT,
      businessType TEXT DEFAULT 'PHARMACY', isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT, phone TEXT, email TEXT, companyId TEXT NOT NULL,
      managerId TEXT, isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, type TEXT DEFAULT 'GENERAL',
      color TEXT DEFAULT '#3B82F6', branchId TEXT, companyId TEXT,
      isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, genericName TEXT, sku TEXT, barcode TEXT, description TEXT,
      categoryId TEXT, branchId TEXT, companyId TEXT, unitPrice REAL DEFAULT 0, costPrice REAL DEFAULT 0, sellingPrice REAL DEFAULT 0,
      quantity INTEGER DEFAULT 0, minStock INTEGER DEFAULT 10, maxStock INTEGER DEFAULT 1000, unitsPerPack INTEGER DEFAULT 1,
      reorderLevel INTEGER DEFAULT 20, requiresPrescription INTEGER DEFAULT 0, unitType TEXT DEFAULT 'PIECE',
      manufacturerId TEXT, supplierId TEXT, shelfId TEXT, expiryDate TEXT, manufacturingDate TEXT, batchNumber TEXT,
      isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, branchId TEXT, companyId TEXT,
      loyaltyPoints INTEGER DEFAULT 0, isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, contactPerson TEXT,
      branchId TEXT, companyId TEXT, isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS manufacturers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, email TEXT, phone TEXT, address TEXT, branchId TEXT, companyId TEXT,
      isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS shelves (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, location TEXT, capacity INTEGER DEFAULT 100,
      branchId TEXT, companyId TEXT, isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY, batchNumber TEXT NOT NULL, productId TEXT NOT NULL, quantity INTEGER DEFAULT 0,
      manufacturingDate TEXT, expiryDate TEXT, costPrice REAL DEFAULT 0, sellingPrice REAL DEFAULT 0,
      branchId TEXT, companyId TEXT, supplierId TEXT, isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY, invoiceNumber TEXT, receiptNumber TEXT, customerId TEXT, branchId TEXT, companyId TEXT,
      totalAmount REAL DEFAULT 0, discount REAL DEFAULT 0, tax REAL DEFAULT 0, grandTotal REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'CASH', paymentStatus TEXT DEFAULT 'PAID', status TEXT DEFAULT 'COMPLETED',
      notes TEXT, employeeId TEXT, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY, saleId TEXT NOT NULL, productId TEXT NOT NULL, batchId TEXT,
      quantity INTEGER DEFAULT 1, unitPrice REAL DEFAULT 0, discount REAL DEFAULT 0, total REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY, purchaseNumber TEXT, invoiceNo TEXT, supplierId TEXT, branchId TEXT, companyId TEXT,
      totalAmount REAL DEFAULT 0, paidAmount REAL DEFAULT 0, discount REAL DEFAULT 0, tax REAL DEFAULT 0, grandTotal REAL DEFAULT 0,
      paymentStatus TEXT DEFAULT 'PENDING', status TEXT DEFAULT 'PENDING', notes TEXT, purchaseDate TEXT, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY, purchaseId TEXT NOT NULL, productId TEXT NOT NULL, batchId TEXT,
      quantity INTEGER DEFAULT 1, unitPrice REAL DEFAULT 0, total REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, employeeId TEXT, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT,
      position TEXT, department TEXT, status TEXT DEFAULT 'ACTIVE',
      salary REAL DEFAULT 0, hireDate TEXT, branchId TEXT, companyId TEXT, userId TEXT,
      isActive INTEGER DEFAULT 1, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY, saleId TEXT NOT NULL, amount REAL DEFAULT 0, reason TEXT,
      branchId TEXT, companyId TEXT, status TEXT DEFAULT 'COMPLETED', createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT, branchId TEXT, companyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY, employeeId TEXT NOT NULL, date TEXT, checkIn TEXT, checkOut TEXT,
      status TEXT DEFAULT 'PRESENT', notes TEXT, branchId TEXT, companyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, startTime TEXT, endTime TEXT, isActive INTEGER DEFAULT 1,
      branchId TEXT, companyId TEXT, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_shifts (
      id TEXT PRIMARY KEY, shiftId TEXT, date TEXT, branchId TEXT, companyId TEXT,
      createdBy TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_shift_users (
      id TEXT PRIMARY KEY, scheduledShiftId TEXT, userId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS commissions (
      id TEXT PRIMARY KEY, userId TEXT, saleId TEXT, amount REAL DEFAULT 0, percentage REAL DEFAULT 0,
      status TEXT DEFAULT 'PENDING', branchId TEXT, companyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY, saleId TEXT, receiptNumber TEXT, amount REAL DEFAULT 0, paymentMethod TEXT,
      userId TEXT, branchId TEXT, companyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS refund_items (
      id TEXT PRIMARY KEY, refundId TEXT NOT NULL, saleItemId TEXT, productId TEXT, quantity INTEGER DEFAULT 1,
      amount REAL DEFAULT 0, reason TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY, productId TEXT NOT NULL, type TEXT, quantity INTEGER DEFAULT 0,
      reason TEXT, referenceId TEXT, referenceType TEXT, branchId TEXT, companyId TEXT, createdBy TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS card_details (
      id TEXT PRIMARY KEY, saleId TEXT, cardType TEXT, lastFourDigits TEXT, approvalCode TEXT,
      amount REAL DEFAULT 0, userId TEXT, branchId TEXT, companyId TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY, companyId TEXT, plan TEXT DEFAULT 'BASIC', status TEXT DEFAULT 'ACTIVE',
      startDate TEXT, endDate TEXT, amount REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      retries INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      synced_at TEXT
    )`
  ];

  // CRITICAL: Create all tables and verify they exist
  const createdTables = [];
  tables.forEach(sql => {
    try {
      db.run(sql);
      // Extract table name from CREATE TABLE statement
      const tableMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (tableMatch) {
        createdTables.push(tableMatch[1]);
      }
    } catch (e) {
      console.error('[DB] Table creation error:', e.message);
      console.error('[DB] SQL:', sql.substring(0, 100));
    }
  });

  // Verify ALL tables exist (29 tables total - including sync_queue)
  const allTables = [
    'users', 'companies', 'branches', 'categories', 'products', 'customers',
    'suppliers', 'manufacturers', 'shelves', 'batches', 'sales', 'sale_items',
    'purchases', 'purchase_items', 'employees', 'refunds', 'settings',
    'attendance', 'shifts', 'scheduled_shifts', 'scheduled_shift_users',
    'commissions', 'receipts', 'refund_items', 'stock_movements',
    'card_details', 'subscriptions', 'sync_queue'
  ];

  // MIGRATION: Add missing columns to existing tables
  // SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we check first
  function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    try {
      const tableInfo = query(`PRAGMA table_info(${tableName})`);
      const columnExists = tableInfo.some(col => col.name === columnName);
      if (!columnExists) {
        console.log(`[DB Migration] Adding column ${columnName} to table ${tableName}...`);
        run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
        console.log(`[DB Migration] ✅ Column ${columnName} added to ${tableName}`);
      }
    } catch (e) {
      console.error(`[DB Migration] Error adding column ${columnName} to ${tableName}:`, e.message);
    }
  }

  // Add missing columns to products table
  addColumnIfNotExists('products', 'costPrice', 'REAL DEFAULT 0');
  addColumnIfNotExists('products', 'unitType', 'TEXT DEFAULT \'PIECE\'');
  addColumnIfNotExists('products', 'formula', 'TEXT');
  addColumnIfNotExists('products', 'genericName', 'TEXT');

  let verifiedCount = 0;
  let missingCount = 0;

  for (const tableName of allTables) {
    try {
      const result = query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
      if (result.length === 0) {
        console.error(`[DB] ❌ Table '${tableName}' does not exist!`);
        missingCount++;
        // Try to create the missing table
        console.log(`[DB] Attempting to create missing table '${tableName}'...`);
        // Find the table definition and recreate it
        const tableDef = tables.find(t => t.includes(`CREATE TABLE IF NOT EXISTS ${tableName}`));
        if (tableDef) {
          try {
            db.run(tableDef);
            console.log(`[DB] ✅ Recreated table '${tableName}'`);
            verifiedCount++;
          } catch (e) {
            console.error(`[DB] ❌ Failed to recreate table '${tableName}':`, e.message);
          }
        }
      } else {
        console.log(`[DB] ✅ Table '${tableName}' verified`);
        verifiedCount++;
      }
    } catch (e) {
      console.error(`[DB] ❌ Error checking table '${tableName}':`, e.message);
      missingCount++;
    }
  }

  console.log(`[DB] 📊 Table Verification Summary: ${verifiedCount}/${allTables.length} tables verified`);
  if (missingCount > 0) {
    console.error(`[DB] ⚠️ ${missingCount} table(s) missing or failed verification`);
  }

  saveDatabase();
  console.log('[DB] ✅ All tables initialized and verified');
  console.log('[DB] Created tables:', createdTables.join(', '));

  // Add missing columns to existing tables (migration) - Match PostgreSQL schema
  const columnMigrations = [
    // Categories
    'ALTER TABLE categories ADD COLUMN type TEXT DEFAULT "GENERAL"',
    'ALTER TABLE categories ADD COLUMN color TEXT DEFAULT "#3B82F6"',
    // Products - CRITICAL: Add all missing columns (including quantity which is essential)
    'ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT 0',
    'ALTER TABLE products ADD COLUMN costPrice REAL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN sellingPrice REAL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN unitPrice REAL DEFAULT 0',
    'ALTER TABLE products ADD COLUMN expiryDate TEXT',
    'ALTER TABLE products ADD COLUMN manufacturingDate TEXT',
    'ALTER TABLE products ADD COLUMN batchNumber TEXT',
    'ALTER TABLE products ADD COLUMN formula TEXT',
    'ALTER TABLE products ADD COLUMN unitType TEXT DEFAULT "PIECE"',
    'ALTER TABLE products ADD COLUMN genericName TEXT',
    'ALTER TABLE products ADD COLUMN sku TEXT',
    'ALTER TABLE products ADD COLUMN barcode TEXT',
    'ALTER TABLE products ADD COLUMN minStock INTEGER DEFAULT 10',
    'ALTER TABLE products ADD COLUMN maxStock INTEGER DEFAULT 1000',
    'ALTER TABLE products ADD COLUMN unitsPerPack INTEGER DEFAULT 1',
    'ALTER TABLE products ADD COLUMN reorderLevel INTEGER DEFAULT 20',
    'ALTER TABLE products ADD COLUMN requiresPrescription INTEGER DEFAULT 0',
    'ALTER TABLE products ADD COLUMN manufacturerId TEXT',
    'ALTER TABLE products ADD COLUMN supplierId TEXT',
    'ALTER TABLE products ADD COLUMN shelfId TEXT',
    // Manufacturers - CRITICAL: Add description column for frontend compatibility
    'ALTER TABLE manufacturers ADD COLUMN description TEXT',
    'ALTER TABLE manufacturers ADD COLUMN email TEXT',
    'ALTER TABLE manufacturers ADD COLUMN phone TEXT',
    'ALTER TABLE manufacturers ADD COLUMN address TEXT',
    'ALTER TABLE manufacturers ADD COLUMN website TEXT',
    'ALTER TABLE manufacturers ADD COLUMN country TEXT',
    // Suppliers
    'ALTER TABLE suppliers ADD COLUMN manufacturerId TEXT',
    // Customers
    'ALTER TABLE customers ADD COLUMN isVIP INTEGER DEFAULT 0',
    'ALTER TABLE customers ADD COLUMN totalPurchases INTEGER DEFAULT 0',
    'ALTER TABLE customers ADD COLUMN lastVisit TEXT',
    // Shelves
    'ALTER TABLE shelves ADD COLUMN capacity INTEGER DEFAULT 100',
    // Employees
    'ALTER TABLE employees ADD COLUMN department TEXT',
    'ALTER TABLE employees ADD COLUMN employeeId TEXT',
    // Companies
    'ALTER TABLE companies ADD COLUMN website TEXT',
    // Users
    'ALTER TABLE users ADD COLUMN profileImage TEXT',
    // Sales
    'ALTER TABLE sales ADD COLUMN receiptNumber TEXT',
    // Batches
    'ALTER TABLE batches ADD COLUMN isActive INTEGER DEFAULT 1'
  ];

  // Apply migrations with proper error handling
  columnMigrations.forEach(sql => {
    try {
      // Extract table and column name from SQL for better error handling
      const match = sql.match(/ALTER TABLE (\w+) ADD COLUMN (\w+)/i);
      if (match) {
        const [, tableName, columnName] = match;
        // Check if column already exists
        try {
          const tableInfo = query(`PRAGMA table_info(${tableName})`);
          const columnExists = tableInfo.some(col => col.name === columnName);
          if (columnExists) {
            console.log(`[DB Migration] Column ${columnName} already exists in ${tableName}, skipping...`);
            return; // Skip this migration
          }
        } catch (checkError) {
          console.error(`[DB Migration] Error checking column ${columnName} in ${tableName}:`, checkError.message);
        }
      }
      // Column doesn't exist, add it
      db.run(sql);
      console.log(`[DB Migration] ✅ Applied: ${sql.substring(0, 60)}...`);
    } catch (e) {
      // Column might already exist or table doesn't exist - that's OK
      if (e.message && e.message.includes('duplicate column')) {
        console.log(`[DB Migration] Column already exists, skipping...`);
      } else {
        console.error(`[DB Migration] Error:`, e.message);
      }
    }
  });

  saveDatabase();
  console.log('[DB] ✅ Migrations applied');

  // Create default admin user
  createDefaultAdmin();
}

function saveDatabase() {
  if (db) {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('[DB] Save error:', e.message);
    }
  }
}

function uuid() { return crypto.randomUUID(); }

// Try to load bcryptjs (matches main backend), fallback to bcrypt, then SHA256
let bcrypt;
try {
  // CRITICAL: Use bcryptjs first (matches main backend server)
  bcrypt = resolveModule('bcryptjs');
  console.log('[Auth] ✅ Using bcryptjs for password hashing (matches main backend)');
} catch (e1) {
  try {
    // Fallback to bcrypt if bcryptjs not available
    bcrypt = resolveModule('bcrypt');
    console.log('[Auth] ✅ Using bcrypt for password hashing (fallback)');
  } catch (e2) {
    console.log('[Auth] ⚠️ bcryptjs and bcrypt not available, using SHA256 fallback');
    bcrypt = null;
  }
}

// Password hashing - use bcryptjs/bcrypt if available, otherwise SHA256 (for backward compatibility)
// CRITICAL: Matches main backend which uses bcryptjs with 12 salt rounds
// NOTE: Made async to support both sync and async bcrypt implementations
async function hashPassword(password) {
  const normalizedPassword = String(password).trim();

  if (bcrypt) {
    // Use bcryptjs/bcrypt (matches backend/website)
    // Main backend uses: await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'))
    const saltRounds = 12;
    try {
      // CRITICAL: bcryptjs.hash() returns a Promise, must await
      const hash = await bcrypt.hash(normalizedPassword, saltRounds);
      console.log('[Auth] ✅ Bcrypt hash generated (saltRounds:', saltRounds + ')');
      return hash;
    } catch (e) {
      console.error('[Auth] ❌ Bcrypt hash error:', e.message);
      // Fallback to SHA256 on error
      const hash = crypto.createHash('sha256').update(normalizedPassword).digest('hex');
      console.log('[Auth] SHA256 hash generated (fallback due to error)');
      return hash;
    }
  } else {
    // Fallback to SHA256 (for backward compatibility with old passwords)
    const hash = crypto.createHash('sha256').update(normalizedPassword).digest('hex');
    console.log('[Auth] SHA256 hash generated (fallback - no bcrypt available)');
    return hash;
  }
}

// Password verification - supports both bcryptjs/bcrypt and SHA256
// CRITICAL: Matches main backend which uses bcryptjs.compare()
async function verifyPassword(inputPassword, storedHash) {
  if (!storedHash) {
    console.log('[Auth] ⚠️ No stored hash provided');
    return false;
  }

  const normalizedPassword = String(inputPassword).trim();

  // Check if stored hash is bcrypt (starts with $2a$, $2b$, or $2y$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
    // It's a bcrypt hash
    if (bcrypt) {
      try {
        // CRITICAL: Use bcrypt.compare() which works for both bcryptjs and bcrypt
        const isValid = await bcrypt.compare(normalizedPassword, storedHash);
        console.log('[Auth] Bcrypt compare result:', isValid);
        return isValid;
      } catch (e) {
        console.error('[Auth] ❌ Bcrypt compare error:', e.message);
        console.error('[Auth] Error stack:', e.stack);
        return false;
      }
    } else {
      console.log('[Auth] ⚠️ Bcrypt hash detected but bcrypt module not available');
      return false;
    }
  } else {
    // It's a SHA256 hash (legacy)
    const inputHash = crypto.createHash('sha256').update(normalizedPassword).digest('hex');
    const isValid = inputHash === storedHash;
    console.log('[Auth] SHA256 compare result:', isValid);
    return isValid;
  }
}

function now() { return new Date().toISOString(); }

// ==================== POSTGRESQL SYNC ====================
// Connect to remote PostgreSQL for data sync
async function connectPostgreSQL() {
  if (pgClient && isOnline) return pgClient;

  try {
    // Try to load pg module
    let Client;
    try {
      const pg = require('pg');
      Client = pg.Client;
    } catch (e) {
      console.log('[PostgreSQL] pg module not available, sync disabled');
      return null;
    }

    pgClient = new Client({
      connectionString: REMOTE_DATABASE_URL,
      connectionTimeoutMillis: 5000,
      query_timeout: 10000
    });

    await pgClient.connect();
    isOnline = true;
    console.log('[PostgreSQL] ✅ Connected to remote database');
    return pgClient;
  } catch (e) {
    console.log('[PostgreSQL] ❌ Connection failed:', e.message);
    isOnline = false;
    pgClient = null;
    return null;
  }
}

// Check PostgreSQL connectivity
async function checkPostgreSQLConnection() {
  try {
    const client = await connectPostgreSQL();
    if (client) {
      await client.query('SELECT 1');
      isOnline = true;
      return true;
    }
    return false;
  } catch (e) {
    isOnline = false;
    return false;
  }
}

// Map SQLite row to PostgreSQL format
function mapRowForPostgreSQL(tableName, row) {
  const mapped = { ...row };

  // Handle users table - SQLite doesn't have username, PostgreSQL requires it
  if (tableName === 'users') {
    if (!mapped.username && mapped.email) {
      mapped.username = mapped.email; // Use email as username
    }
    // Convert isActive from INTEGER to boolean
    if (mapped.isActive !== undefined) {
      mapped.isActive = mapped.isActive === 1 || mapped.isActive === true;
    }
    // Add required fields if missing
    if (!mapped.updatedAt) mapped.updatedAt = mapped.createdAt || now();
  }

  // Handle boolean conversions for all tables
  ['isActive', 'isVIP', 'requiresPrescription', 'isReported'].forEach(col => {
    if (mapped[col] !== undefined && mapped[col] !== null) {
      mapped[col] = mapped[col] === 1 || mapped[col] === true || mapped[col] === 'true';
    }
  });

  // Remove phone if it doesn't exist in PostgreSQL schema
  if (tableName === 'users') {
    delete mapped.phone;
  }

  return mapped;
}

// Get PostgreSQL columns for a table (cached)
const pgColumnsCache = {};
async function getPostgreSQLColumns(tableName, client) {
  if (pgColumnsCache[tableName]) return pgColumnsCache[tableName];

  try {
    const result = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
    `, [tableName]);

    pgColumnsCache[tableName] = result.rows.map(r => r.column_name);
    return pgColumnsCache[tableName];
  } catch (e) {
    console.log(`[Sync] Could not get columns for ${tableName}:`, e.message);
    return null;
  }
}

// Sync a single table from SQLite to PostgreSQL
async function syncTableToPostgreSQL(tableName, client) {
  try {
    const localData = query(`SELECT * FROM ${tableName}`);
    if (!localData || localData.length === 0) {
      console.log(`[Sync] ${tableName}: No data to sync`);
      return { synced: 0, errors: 0 };
    }

    // Get PostgreSQL columns for this table
    const pgColumns = await getPostgreSQLColumns(tableName, client);
    if (!pgColumns || pgColumns.length === 0) {
      console.log(`[Sync] ${tableName}: Table not found in PostgreSQL`);
      return { synced: 0, errors: 0 };
    }

    console.log(`[Sync] ${tableName}: Syncing ${localData.length} records...`);

    let synced = 0;
    let errors = 0;

    for (const row of localData) {
      try {
        // Map and filter the row
        const mapped = mapRowForPostgreSQL(tableName, row);

        // Only include columns that exist in PostgreSQL
        const columns = Object.keys(mapped).filter(c => pgColumns.includes(c));
        const values = columns.map(c => mapped[c]);

        if (columns.length === 0) continue;

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = columns
          .filter(c => c !== 'id')
          .map((col, i) => `"${col}" = EXCLUDED."${col}"`)
          .join(', ');

        // Use UPSERT (INSERT ... ON CONFLICT DO UPDATE)
        const sql = `
          INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${updateSet}
        `;

        await client.query(sql, values);
        synced++;
      } catch (e) {
        // Skip constraint violations silently
        if (!e.message.includes('violates') && !e.message.includes('duplicate')) {
          console.log(`[Sync] ${tableName} row error:`, e.message.substring(0, 100));
        }
        errors++;
      }
    }

    console.log(`[Sync] ${tableName}: ✅ Synced ${synced}, Errors ${errors}`);
    return { synced, errors };
  } catch (e) {
    console.error(`[Sync] ${tableName} failed:`, e.message);
    return { synced: 0, errors: 1 };
  }
}

// Sync ALL tables from SQLite to PostgreSQL
async function syncAllToPostgreSQL() {
  if (syncInProgress) {
    console.log('[Sync] Sync already in progress, skipping...');
    return { success: false, message: 'Sync in progress' };
  }

  syncInProgress = true;
  console.log('[Sync] 🔄 Starting full sync to PostgreSQL...');

  try {
    const client = await connectPostgreSQL();
    if (!client) {
      syncInProgress = false;
      return { success: false, message: 'PostgreSQL not available' };
    }

    // Tables in dependency order (referenced tables first) - ALL 27 TABLES
    const tables = [
      'companies',
      'branches',
      'users',
      'categories',
      'manufacturers',
      'suppliers',
      'shelves',
      'products',
      'batches',
      'customers',
      'employees',
      'sales',
      'sale_items',
      'purchases',
      'purchase_items',
      'stock_movements',
      'receipts',
      'refunds',
      'refund_items',
      'attendance',
      'shifts',
      'scheduled_shifts',
      'scheduled_shift_users',
      'commissions',
      'settings',
      'card_details',
      'subscriptions'
    ];

    let totalSynced = 0;
    let totalErrors = 0;

    for (const table of tables) {
      try {
        const result = await syncTableToPostgreSQL(table, client);
        totalSynced += result.synced;
        totalErrors += result.errors;
      } catch (e) {
        console.log(`[Sync] Skipping ${table}:`, e.message);
      }
    }

    lastSyncTime = now();
    syncInProgress = false;

    console.log(`[Sync] ✅ Full sync completed: ${totalSynced} records synced, ${totalErrors} errors`);
    return {
      success: true,
      synced: totalSynced,
      errors: totalErrors,
      lastSync: lastSyncTime
    };
  } catch (e) {
    syncInProgress = false;
    console.error('[Sync] ❌ Full sync failed:', e.message);
    return { success: false, message: e.message };
  }
}

// ==================== TWO-WAY SYNC: PULL FROM POSTGRESQL ====================
// PostgreSQL is SOURCE OF TRUTH - this pulls ALL changes to SQLite

// All 27 tables in dependency order (referenced tables first)
const SYNC_TABLES = [
  { name: 'companies', pk: 'id' },
  { name: 'branches', pk: 'id' },
  { name: 'users', pk: 'id' },
  { name: 'categories', pk: 'id' },
  { name: 'manufacturers', pk: 'id' },
  { name: 'suppliers', pk: 'id' },
  { name: 'shelves', pk: 'id' },
  { name: 'products', pk: 'id' },
  { name: 'batches', pk: 'id' },
  { name: 'customers', pk: 'id' },
  { name: 'employees', pk: 'id' },
  { name: 'sales', pk: 'id' },
  { name: 'sale_items', pk: 'id' },
  { name: 'purchases', pk: 'id' },
  { name: 'purchase_items', pk: 'id' },
  { name: 'stock_movements', pk: 'id' },
  { name: 'receipts', pk: 'id' },
  { name: 'refunds', pk: 'id' },
  { name: 'refund_items', pk: 'id' },
  { name: 'attendance', pk: 'id' },
  { name: 'shifts', pk: 'id' },
  { name: 'scheduled_shifts', pk: 'id' },
  { name: 'scheduled_shift_users', pk: 'id' },
  { name: 'commissions', pk: 'id' },
  { name: 'settings', pk: 'id' },
  { name: 'card_details', pk: 'id' },
  { name: 'subscriptions', pk: 'id' }
];

// Normalize value for comparison between PostgreSQL and SQLite
function normalizeValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return val.toISOString();
  // Normalize string - trim and lowercase for case-insensitive comparison
  if (typeof val === 'string') {
    // Parse ISO dates to compare just the date part
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      return val.substring(0, 19); // Compare up to seconds
    }
    return val.trim();
  }
  return String(val);
}

// Convert PostgreSQL row to SQLite format
function pgRowToSqlite(row) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert camelCase to snake_case is not needed - keep as is
    if (value === null || value === undefined) {
      result[key] = null;
    } else if (typeof value === 'boolean') {
      result[key] = value ? 1 : 0;  // SQLite uses integers for booleans
    } else if (value instanceof Date) {
      result[key] = value.toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Get SQLite columns for a table
function getSQLiteColumns(tableName) {
  try {
    const result = query(`PRAGMA table_info(${tableName})`);
    return result.map(r => r.name);
  } catch (e) {
    return [];
  }
}

// PULL: Sync a single table FROM PostgreSQL TO SQLite
// PostgreSQL WINS in conflicts (based on updatedAt comparison)
async function pullTableFromPostgreSQL(tableName, client, forceFullCompare = false) {
  try {
    // ALWAYS get ALL records from PostgreSQL (source of truth)
    // This ensures manual DB changes are detected regardless of updatedAt
    const pgQuery = `SELECT * FROM "${tableName}"`;
    const result = await client.query(pgQuery);
    const rows = result.rows;

    if (rows.length === 0) {
      return { synced: 0, added: 0, updated: 0 };
    }

    // Get SQLite columns
    const sqliteColumns = getSQLiteColumns(tableName);
    if (sqliteColumns.length === 0) {
      console.log(`[Pull] Table ${tableName} not found in SQLite`);
      return { synced: 0, added: 0, updated: 0 };
    }

    let added = 0;
    let updated = 0;

    for (const pgRow of rows) {
      try {
        const row = pgRowToSqlite(pgRow);
        const recordId = row.id;

        if (!recordId) continue;

        // Check if record exists in SQLite
        const existing = query(`SELECT * FROM ${tableName} WHERE id = ?`, [recordId]);

        // Filter columns that exist in SQLite
        const columns = Object.keys(row).filter(c => sqliteColumns.includes(c));
        const values = columns.map(c => row[c]);

        if (existing.length > 0) {
          // COMPARE ACTUAL DATA - PostgreSQL ALWAYS WINS
          // Check if any field is different (not just updatedAt)
          const localRow = existing[0];
          let needsUpdate = false;

          // CRITICAL: For users table, ALWAYS check isActive field
          // PostgreSQL is source of truth - if isActive changed, we MUST update
          if (tableName === 'users') {
            const pgIsActive = row.isActive !== undefined ? (row.isActive === 1 || row.isActive === true || row.isActive === 'true') : null;
            const localIsActive = localRow.isActive !== undefined ? (localRow.isActive === 1 || localRow.isActive === true) : null;

            if (pgIsActive !== localIsActive) {
              needsUpdate = true;
              console.log(`[Pull] User ${recordId} isActive changed: ${localIsActive} -> ${pgIsActive}`);
            }
          }

          // Check other fields for differences
          for (const col of columns) {
            if (col === 'id') continue;
            // Skip isActive for users table (already checked above)
            if (tableName === 'users' && col === 'isActive') continue;

            const pgVal = row[col];
            const localVal = localRow[col];

            // Normalize values for comparison
            const normalizedPg = normalizeValue(pgVal);
            const normalizedLocal = normalizeValue(localVal);

            if (normalizedPg !== normalizedLocal) {
              needsUpdate = true;
              break;
            }
          }

          // ALWAYS update if forceFullCompare is true (for login sync)
          if (needsUpdate || forceFullCompare) {
            // Update local record with PostgreSQL data
            const setClause = columns.filter(c => c !== 'id').map(c => `${c} = ?`).join(', ');
            const updateValues = columns.filter(c => c !== 'id').map(c => row[c]);

            if (setClause) {
              const updateStmt = db.prepare(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`);
              updateStmt.bind([...updateValues, recordId]);
              updateStmt.step();
              updateStmt.free();
              saveDatabase(); // CRITICAL: Save immediately after update
              if (needsUpdate || forceFullCompare) {
                updated++;
                if (tableName === 'users') {
                  console.log(`[Pull] ✅ Updated user ${recordId} in SQLite (isActive: ${row.isActive})`);
                }
              }
            }
          }
        } else {
          // INSERT new record from PostgreSQL
          const placeholders = columns.map(() => '?').join(', ');
          const columnList = columns.join(', ');

          const insertStmt = db.prepare(`INSERT INTO ${tableName} (${columnList}) VALUES (${placeholders})`);
          insertStmt.bind(values);
          insertStmt.step();
          insertStmt.free();
          added++;
        }
      } catch (rowErr) {
        // Skip individual row errors (constraint violations, etc.)
        if (!rowErr.message.includes('UNIQUE constraint')) {
          console.log(`[Pull] ${tableName} row error:`, rowErr.message.substring(0, 80));
        }
      }
    }

    if (added > 0 || updated > 0) {
      saveDatabase();
    }

    return { synced: added + updated, added, updated };
  } catch (e) {
    if (!e.message.includes('does not exist')) {
      console.log(`[Pull] ${tableName} failed:`, e.message.substring(0, 80));
    }
    return { synced: 0, added: 0, updated: 0 };
  }
}

// PULL ALL: Sync ALL tables FROM PostgreSQL TO SQLite
async function pullAllFromPostgreSQL(forceFullCompare = false) {
  if (syncInProgress) {
    return { success: false, message: 'Sync in progress' };
  }

  const startTime = Date.now();
  const syncType = forceFullCompare ? 'FULL COMPARE' : 'smart';
  console.log(`[Sync] ⬇️ PULL from PostgreSQL (${syncType})...`);

  try {
    const client = await connectPostgreSQL();
    if (!client) {
      return { success: false, message: 'PostgreSQL not connected' };
    }

    syncInProgress = true;
    let totalAdded = 0;
    let totalUpdated = 0;

    for (const table of SYNC_TABLES) {
      try {
        // Always fetch all records and compare data - catches manual DB changes
        const result = await pullTableFromPostgreSQL(table.name, client, forceFullCompare);

        totalAdded += result.added;
        totalUpdated += result.updated;

        if (result.synced > 0) {
          console.log(`[Pull] ${table.name}: +${result.added} added, ~${result.updated} updated`);
        }
      } catch (tableErr) {
        // Continue with other tables even if one fails
      }
    }

    syncInProgress = false;
    lastSyncTime = new Date().toISOString();
    const duration = Date.now() - startTime;

    if (totalAdded > 0 || totalUpdated > 0) {
      console.log(`[Sync] ⬇️ PULL complete: +${totalAdded} added, ~${totalUpdated} updated (${duration}ms)`);
    }

    return { success: true, added: totalAdded, updated: totalUpdated, duration };
  } catch (e) {
    syncInProgress = false;
    console.error('[Sync] Pull failed:', e.message);
    return { success: false, message: e.message };
  }
}

// Legacy function for backwards compatibility
async function syncFromPostgreSQL() {
  return pullAllFromPostgreSQL(true);
}

// ==================== OFFLINE QUEUE PROCESSING ====================
// Process queued operations when back online
async function processOfflineQueue() {
  if (!db) return { processed: 0, failed: 0, message: 'Database not initialized' };
  if (!isOnline) return { processed: 0, failed: 0, message: 'Still offline' };

  // Load unsynced items from SQLite
  const unsyncedItems = query(`SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC LIMIT ?`, [SYNC_CONFIG.BATCH_SIZE]);

  if (unsyncedItems.length === 0) return { processed: 0, failed: 0 };

  console.log(`[Sync] 📤 Processing ${unsyncedItems.length} queued operations from SQLite...`);

  const client = await connectPostgreSQL();
  if (!client) return { processed: 0, failed: 0, message: 'No PostgreSQL connection' };

  let processed = 0;
  let failed = 0;

  for (const row of unsyncedItems) {
    try {
      const tableName = row.table_name;
      const operation = row.operation;
      const data = JSON.parse(row.payload);
      const queueId = row.id;
      const retries = row.retries || 0;

      if (operation === 'delete') {
        await client.query(`DELETE FROM "${tableName}" WHERE id = $1`, [data.id]);
      } else {
        // For create/update, use UPSERT
        const pgColumns = await getPostgreSQLColumns(tableName, client);
        if (!pgColumns) {
          // Mark as synced if table doesn't exist in PostgreSQL (might be SQLite-only table)
          run(`UPDATE sync_queue SET synced = 1, synced_at = ? WHERE id = ?`, [now(), queueId]);
          processed++;
          continue;
        }

        const mapped = mapRowForPostgreSQL(tableName, data);
        const columns = Object.keys(mapped).filter(c => pgColumns.includes(c));
        const values = columns.map(c => mapped[c]);

        if (columns.length === 0) {
          run(`UPDATE sync_queue SET synced = 1, synced_at = ? WHERE id = ?`, [now(), queueId]);
          processed++;
          continue;
        }

        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const updateSet = columns
          .filter(c => c !== 'id')
          .map(col => `"${col}" = EXCLUDED."${col}"`)
          .join(', ');

        const sql = `
          INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
          VALUES (${placeholders})
          ON CONFLICT (id) DO UPDATE SET ${updateSet}
        `;

        await client.query(sql, values);
      }

      // Mark as synced in SQLite
      run(`UPDATE sync_queue SET synced = 1, synced_at = ? WHERE id = ?`, [now(), queueId]);
      processed++;
    } catch (e) {
      const newRetries = retries + 1;
      if (newRetries < SYNC_CONFIG.RETRY_ATTEMPTS) {
        // Update retry count
        run(`UPDATE sync_queue SET retries = ?, error_message = ? WHERE id = ?`,
          [newRetries, e.message?.substring(0, 200) || 'Unknown error', row.id]);
        failed++;
      } else {
        // Mark as failed permanently (but keep in queue for manual review)
        console.log(`[Sync] ❌ Gave up on ${row.table_name} ${row.operation} after ${newRetries} retries`);
        run(`UPDATE sync_queue SET error_message = ? WHERE id = ?`,
          [`Failed after ${newRetries} retries: ${e.message}`, row.id]);
        failed++;
      }
    }
  }

  // Reload queue from SQLite
  loadOfflineQueue();

  if (processed > 0) {
    const remaining = query(`SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0`)[0]?.count || 0;
    console.log(`[Sync] 📤 Queue processed: ${processed} synced, ${failed} failed, ${remaining} remaining`);
  }

  return { processed, failed, remaining: query(`SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0`)[0]?.count || 0 };
}

// ==================== TWO-WAY SYNC LOOP ====================
// Polls PostgreSQL every 3-5 seconds for changes
let syncInterval = null;
let pullInterval = null;
let pushDebounceTimer = null;
let pendingPushTables = new Set();

// Start the two-way sync system
function startPeriodicSync() {
  if (syncInterval) return;

  // Load offline queue
  loadOfflineQueue();

  console.log('[Sync] 🔄 Starting TWO-WAY SYNC system...');
  console.log(`[Sync] ⚙️  Config: Poll every ${SYNC_CONFIG.POLL_INTERVAL}ms, PostgreSQL is SOURCE OF TRUTH`);
  console.log('[Sync] ℹ️  SQLite operations work independently - PostgreSQL sync is optional');

  // CRITICAL: Check PostgreSQL connection in background (non-blocking)
  // SQLite operations work immediately regardless of PostgreSQL status
  checkPostgreSQLConnection().catch(e => {
    console.log('[Sync] Initial PostgreSQL check failed (expected if offline):', e.message);
    console.log('[Sync] ✅ SQLite is ready - all operations will work offline');
  });

  // Initial full sync after 5 seconds (non-blocking, won't affect SQLite operations)
  setTimeout(async () => {
    try {
      console.log('[Sync] 🚀 Initial sync starting (non-blocking)...');

      // First PULL from PostgreSQL (source of truth) - FULL comparison
      // This will silently fail if PostgreSQL is not available - that's OK
      await pullAllFromPostgreSQL(true).catch(e => {
        console.log('[Sync] Initial pull skipped (PostgreSQL not available):', e.message);
        console.log('[Sync] ✅ SQLite operations continue normally');
      });

      // Then process any offline queue
      await processOfflineQueue().catch(e => console.log('[Sync] Queue processing error:', e.message));

      // Finally PUSH local changes
      await syncAllToPostgreSQL().catch(e => {
        console.log('[Sync] Initial push skipped (PostgreSQL not available):', e.message);
        console.log('[Sync] ✅ Changes queued for later sync');
      });

      console.log('[Sync] ✅ Initial sync complete (or skipped if offline)');
    } catch (e) {
      console.log('[Sync] ⚠️ Initial sync error (non-critical):', e.message);
      console.log('[Sync] ✅ SQLite operations continue normally');
    }
  }, 5000);

  // PULL from PostgreSQL every 5 seconds
  // Every 3rd pull (every 15 seconds) is a FULL comparison to catch manual DB changes
  pullInterval = setInterval(async () => {
    if (syncInProgress) return;

    // Check connection first
    const connected = await checkPostgreSQLConnection();

    if (connected && !isOnline) {
      // Just came back online!
      console.log('[Sync] 🌐 Back ONLINE! Processing offline queue...');
      isOnline = true;
      await processOfflineQueue();
      // Do full sync when coming back online
      await pullAllFromPostgreSQL(true).catch(() => {});
      return;
    }

    if (!connected) {
      if (isOnline) {
        console.log('[Sync] 📴 Gone OFFLINE - changes will be queued');
      }
      isOnline = false;
      return;
    }

    // Increment counter and do FULL compare every 3rd pull (every 15 seconds)
    fullSyncCounter++;
    const doFullSync = (fullSyncCounter % 3 === 0);

    // CRITICAL: Always do full sync for users table to catch isActive changes
    // This ensures user activation status is always up-to-date
    try {
      const client = await connectPostgreSQL();
      if (client) {
        // Always sync users table with full compare to catch isActive changes
        await pullTableFromPostgreSQL('users', client, true);
      }
    } catch (e) {
      // Silent fail for routine polling
    }

    // Smart pull - compares actual data, full compare every 15 seconds
    await pullAllFromPostgreSQL(doFullSync).catch(e => {
      // Silent fail for routine polling
    });

  }, SYNC_CONFIG.POLL_INTERVAL);

  // PUSH to PostgreSQL every 30 seconds (batch local changes)
  syncInterval = setInterval(async () => {
    if (syncInProgress || !isOnline) return;

    // Process offline queue first
    await processOfflineQueue().catch(() => {});

    // Then push any remaining local changes
    if (pendingPushTables.size > 0) {
      const tables = Array.from(pendingPushTables);
      pendingPushTables.clear();
      console.log(`[Sync] 📤 Pushing changes for: ${tables.join(', ')}`);
    }

    await syncAllToPostgreSQL().catch(e => {
      // Silent fail for routine sync
    });

  }, 30000);  // Push every 30 seconds

  console.log('[Sync] 🔄 Two-way sync active: PULL every 4s, PUSH every 30s');
}

// Mark a table as having pending changes (for debounced push)
// CRITICAL: This function should NEVER throw errors - data is already saved to SQLite
function markTableForPush(tableName) {
  try {
    if (!tableName) {
      console.log('[Sync] ⚠️ markTableForPush called with invalid tableName');
      return; // Don't throw - just return
    }

    pendingPushTables.add(tableName);

    // Debounce: if online, push after 2 seconds of no changes
    if (isOnline && pushDebounceTimer) {
      clearTimeout(pushDebounceTimer);
    }

    if (isOnline) {
      pushDebounceTimer = setTimeout(async () => {
        try {
          if (pendingPushTables.size > 0) {
            const tables = Array.from(pendingPushTables);
            pendingPushTables.clear();
            // CRITICAL: Don't await - let it run in background
            // If sync fails, data is still in SQLite and will be synced later
            syncAllToPostgreSQL().catch(err => {
              console.log(`[Sync] ⚠️ Background sync failed for ${tables.join(', ')}:`, err.message);
              // Re-add tables to queue for retry
              tables.forEach(t => pendingPushTables.add(t));
            });
          }
        } catch (error) {
          console.error('[Sync] ⚠️ Error in push debounce timer:', error.message);
          // Re-add tables to queue for retry
          if (pendingPushTables.size === 0 && tableName) {
            pendingPushTables.add(tableName);
          }
        }
      }, SYNC_CONFIG.PUSH_DEBOUNCE);
    }
  } catch (error) {
    // CRITICAL: Never throw from markTableForPush - data is already saved to SQLite
    console.error(`[Sync] ⚠️ Error marking ${tableName} for push:`, error.message);
    // Continue - data is still in SQLite and will be synced later
  }
}

// Helper: Queue operation if offline, otherwise mark for push
// CRITICAL: This function should NEVER throw errors - it's just for sync tracking
// Data is already saved to SQLite before this is called
function handleDataChange(tableName, operation, data) {
  try {
    if (!data || !tableName) {
      console.log('[Sync] ⚠️ handleDataChange called with invalid params:', { tableName, operation, hasData: !!data });
      return; // Don't throw - just log and return
    }

    // CRITICAL: This function is ONLY for sync tracking
    // SQLite operations are ALREADY COMPLETE before this is called
    // This function NEVER blocks or affects SQLite operations

    // Check if PostgreSQL is available (non-blocking check)
    // If offline, just queue for later - SQLite already has the data
    if (!isOnline) {
      // PostgreSQL is offline - queue for later sync
      // Data is already in SQLite, so this is just for tracking
      queueOfflineOperation(tableName, operation, data);
      console.log(`[Sync] 📝 Queued ${operation} for ${tableName} (offline - data already in SQLite)`);
    } else {
      // PostgreSQL is online - mark for push
      // Data is already in SQLite, this just schedules sync
      markTableForPush(tableName);
      console.log(`[Sync] ✅ Marked ${tableName} for sync (online - data already in SQLite)`);
    }
  } catch (error) {
    // CRITICAL: Never throw from handleDataChange - data is already saved to SQLite
    // This function is ONLY for sync tracking - SQLite operations are independent
    console.error(`[Sync] ⚠️ Error in handleDataChange for ${tableName}:`, error.message);
    console.log(`[Sync] ✅ SQLite operation was successful - sync error is non-critical`);
    // Still queue the operation even if there's an error
    try {
      queueOfflineOperation(tableName, operation, data);
    } catch (e) {
      // If even queuing fails, just log - data is still in SQLite
      console.error(`[Sync] ❌ Failed to queue ${tableName} operation:`, e.message);
      console.log(`[Sync] ✅ Data is still in SQLite - will sync later when PostgreSQL is available`);
    }
  }
}

// Check existing users - NO DEFAULT DATA CREATED
// All data comes from PostgreSQL sync or user registration
function createDefaultAdmin() {
  try {
    const users = query('SELECT COUNT(*) as count FROM users');
    const count = users[0]?.count || 0;
    console.log('[DB] Existing users:', count);

    if (count === 0) {
      console.log('[DB] ℹ️ No users exist - fresh database');
      console.log('[DB] ℹ️ Users will be synced from PostgreSQL or created via registration');
      // NO DEFAULT DATA - database starts empty
      // User must register or data will sync from PostgreSQL
    } else {
      // Log existing users for debugging
      const existingUsers = query('SELECT email FROM users');
      console.log('[DB] Existing users:');
      existingUsers.forEach(u => {
        console.log('[DB]    Email:', u.email);
      });
    }
  } catch (e) {
    console.error('[DB] Error checking users:', e.message);
  }
}

function generateToken(payload) {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const b = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64');
  const s = crypto.createHmac('sha256', 'zapeera-secret').update(`${h}.${b}`).digest('base64');
  return `${h}.${b}.${s}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const payload = verifyToken(auth.substring(7));
  if (!payload) return res.status(401).json({ success: false, message: 'Invalid token' });

  // Fetch fresh user data from DB to get current branchId/companyId
  const freshUser = query('SELECT id, email, name, role, branchId, companyId FROM users WHERE id = ?', [payload.id])[0];
  if (freshUser) {
    req.user = { ...payload, ...freshUser };
  } else {
  req.user = payload;
  }
  next();
}

// Helper function to apply data isolation filters to SQL query
// CRITICAL: Matches main backend's strict branch-level data isolation
// This prevents data leakage between branches
function applyDataIsolation(sql, params, branchFilter, companyFilter, createdBy) {
  // Apply data isolation - CRITICAL: Prevent data leakage
  if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
    sql += ' AND 1=0'; // Return no results
  } else if (branchFilter) {
    sql += ' AND branchId = ?';
    params.push(branchFilter);
  }
  if (companyFilter) {
    sql += ' AND companyId = ?';
    params.push(companyFilter);
  }
  // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
  // Main backend uses createdBy for:
  // - MANAGER: createdBy + branchId (both)
  // - CASHIER: createdBy only (can see all data within admin group)
  // - ADMIN: createdBy (via buildAdminWhereClause)
  if (createdBy) {
    sql += ' AND createdBy = ?';
    params.push(createdBy);
  }
  return { sql, params };
}

// Helper function to build data isolation filters
// CRITICAL: Matches main backend's strict branch-level data isolation
// This prevents data leakage between branches
function getDataFilter(user, requestedBranchId, requestedCompanyId, req = null) {
  const role = user?.role || 'CASHIER';
  const userBranchId = user?.branchId;
  const userCompanyId = user?.companyId;

  // Get branch/company from headers (set by frontend) - matches main backend
  let headerBranchId = null;
  let headerCompanyId = null;
  if (req && req.headers) {
    headerBranchId = req.headers['x-branch-id'] || req.headers['X-Branch-ID'] || null;
    headerCompanyId = req.headers['x-company-id'] || req.headers['X-Company-ID'] || null;
  }

  // Priority: Header > Request param > User's assigned
  const selectedBranchId = headerBranchId || requestedBranchId;
  const selectedCompanyId = headerCompanyId || requestedCompanyId;

  let branchFilter = null;
  let companyFilter = null;

  // CRITICAL: Strict branch-level isolation (matches main backend)
  if (role === 'SUPERADMIN' || role === 'ADMIN') {
    // SUPERADMIN/ADMIN: MUST select a branch to see data (prevents data leakage)
    if (selectedBranchId) {
      branchFilter = selectedBranchId;
      // If company is selected, use it; otherwise infer from branch
      if (selectedCompanyId) {
        companyFilter = selectedCompanyId;
      } else if (selectedBranchId) {
        // Get company from branch
        const branch = query('SELECT companyId FROM branches WHERE id = ?', [selectedBranchId])[0];
        companyFilter = branch?.companyId || null;
      }
    } else if (selectedCompanyId) {
      // Company selected but no branch - show all branches under company
      companyFilter = selectedCompanyId;
      branchFilter = null; // Will filter by company only
    } else {
      // NO BRANCH SELECTED - Return empty results (force branch selection)
      // This prevents SUPERADMIN/ADMIN from seeing all data
      branchFilter = 'must-select-branch'; // This will return no results
      companyFilter = null;
    }
  } else {
    // MANAGER, CASHIER, etc. - STRICT: Only see their own assigned branch
    // CRITICAL: Also filter by createdBy (matches main backend's buildBranchWhereClause)
    if (userBranchId) {
      branchFilter = userBranchId;
      companyFilter = userCompanyId;
    } else {
      // No branch assigned - no access
      branchFilter = 'non-existent-branch-id'; // This will return no results
      companyFilter = null;
    }
  }

  // CRITICAL: Get createdBy for additional filtering (matches main backend)
  // Main backend uses createdBy for data isolation:
  // - MANAGER: createdBy + branchId
  // - CASHIER: createdBy (can see all data within admin group)
  // - ADMIN: createdBy (via buildAdminWhereClause)
  let createdByFilter = null;
  if (role === 'MANAGER' || role === 'CASHIER' || role === 'ADMIN') {
    createdByFilter = user?.createdBy || user?.id || null;
  }

  console.log('[DataFilter] Role:', role, 'Branch:', branchFilter, 'Company:', companyFilter, 'CreatedBy:', createdByFilter, 'UserBranch:', userBranchId);

  return { branchFilter, companyFilter, role, createdBy: createdByFilter };
}

function query(sql, params = []) {
  try {
    if (!db) {
      return [];
    }
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (e) {
    return [];
  }
}

let lastDbError = null;
function run(sql, params = []) {
  try {
    // CRITICAL: Ensure database is initialized
    if (!db) {
      console.error('[DB Run] ❌ Database not initialized');
      lastDbError = 'Database not initialized';
      return false;
    }

    // CRITICAL: sql.js doesn't support db.run(sql, params) - must use prepare/bind/step
    let stmt = null;

    try {
      if (params && params.length > 0) {
        stmt = db.prepare(sql);
        if (!stmt) {
          lastDbError = 'Failed to prepare statement';
          console.error('[DB Run] ❌ Failed to prepare statement');
          console.error('[DB Run] SQL:', sql.substring(0, 200));
          return false;
        }
        stmt.bind(params);
        stmt.step(); // Execute - throws error if fails
        stmt.free();
      } else {
        // No parameters - can use db.run directly
        db.run(sql);
      }

      // CRITICAL: Save database - but don't fail the operation if save fails
      // The data is already in memory, save is just for persistence
      try {
        saveDatabase();
      } catch (saveError) {
        // Save failed but operation succeeded - this is OK, data is in memory
        console.error('[DB Run] ⚠️ Save failed (non-critical):', saveError.message);
      }

      lastDbError = null;
      return true;
    } catch (stmtError) {
      if (stmt) {
        try { stmt.free(); } catch (e) {}
      }
      // Log the FULL error with SQL and params
      lastDbError = stmtError.message || 'Statement execution failed';
      console.error('[DB Run] ❌ Statement error:', lastDbError);
      console.error('[DB Run] SQL:', sql.substring(0, 200));
      console.error('[DB Run] Params:', params);
      console.error('[DB Run] Error stack:', stmtError.stack);
      return false;
    }
  } catch (e) {
    lastDbError = e.message || 'Unknown database error';
    console.error('[DB Run] ❌ Outer catch error:', lastDbError);
    console.error('[DB Run] SQL (first 200 chars):', sql.substring(0, 200));
    if (params && params.length > 0) {
      console.error('[DB Run] Params:', params);
    }
    console.error('[DB Run] Error stack:', e.stack);
    return false;
  }
}

// Start server
async function startServer(port = 5001) {
  if (server) {
    console.log('[Server] ✅ Already running');
    return server;
  }

  console.log('[Server] ========== STARTING EMBEDDED SERVER ==========');
  console.log('[Server] Port:', port);
  console.log('[Server] Database Path:', DB_PATH);

  // CRITICAL: Initialize database with retry logic
  let dbInitSuccess = false;
  let retries = 0;
  const maxRetries = 3;

  while (!dbInitSuccess && retries < maxRetries) {
    try {
      console.log('[Server] Initializing database... (attempt ' + (retries + 1) + ')');
      await initDatabase();
      dbInitSuccess = true;
      console.log('[Server] ✅ Database initialized successfully');
    } catch (e) {
      retries++;
      console.error('[Server] Database initialization failed (attempt ' + retries + '):', e.message);
      if (retries < maxRetries) {
        console.log('[Server] Retrying database initialization in 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('[Server] Database initialization failed after ' + maxRetries + ' attempts');
        console.error('[Server] Stack:', e.stack);
        // CRITICAL: Don't throw - try to continue anyway
        // Database might still work if it was partially initialized
        console.error('[Server] Continuing - database operations may fail');
      }
    }
  }

  // CRITICAL: Verify database is actually available and working
  if (!db) {
    console.error('[Server] ❌ Database object is null - attempting final initialization...');
    // Try one more time to create database
    try {
      await initDatabase();
      if (db) {
        console.log('[Server] ✅ Database initialized successfully on retry');
      } else {
        console.error('[Server] ❌ Database still null after retry - CRITICAL ERROR');
        // Try to create a fresh database
        try {
          console.log('[Server] Attempting to create fresh database...');
          db = new SQL.Database();
          console.log('[Server] ✅ Fresh database created');
          // Re-run table creation - tables are defined in initDatabase, so just call it again
          // But since initDatabase already failed, we'll just create a minimal setup
          console.log('[Server] Note: Tables will be created on first operation');
        } catch (e2) {
          console.error('[Server] ❌ Failed to create fresh database:', e2.message);
        }
      }
    } catch (e) {
      console.error('[Server] Final database initialization attempt failed:', e.message);
      // Try to create a minimal database anyway
      try {
        db = new SQL.Database();
        console.log('[Server] ✅ Created minimal database as fallback');
      } catch (e3) {
        console.error('[Server] ❌ Cannot create database at all:', e3.message);
      }
    }
  }

  // ALWAYS verify database is working before starting server
  if (db) {
    try {
      const testResult = query('SELECT 1 as test');
      if (testResult && testResult.length > 0) {
        console.log('[Server] ✅ Database verified and working');
      } else {
        console.error('[Server] ⚠️ Database query test returned no results');
      }
    } catch (e) {
      console.error('[Server] ⚠️ Database verification failed:', e.message);
    }
  } else {
    console.error('[Server] ❌ CRITICAL: Database is still null - server will start but operations may fail');
  }

  console.log('[Server] Setting up Express...');
  app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // CRITICAL: Middleware to ensure database is initialized before processing requests
  app.use(async (req, res, next) => {
    // Skip health check - it doesn't need database
    if (req.path === '/health') {
      return next();
    }

    // If database is not initialized, try to initialize it
    if (!db) {
      console.error('[Server] ❌ CRITICAL: Database not initialized on request to:', req.path);
      console.error('[Server] Attempting emergency database initialization...');
      try {
        await initDatabase();
        if (db) {
          console.log('[Server] ✅ Emergency database initialization successful');
        } else {
          console.error('[Server] ❌ Emergency initialization failed - database still null');
          return res.status(503).json({
            success: false,
            message: 'Database not available. Please restart the application.'
          });
        }
      } catch (e) {
        console.error('[Server] ❌ Emergency initialization failed:', e.message);
        return res.status(503).json({
          success: false,
          message: 'Database initialization failed. Please restart the application.'
        });
      }
    }
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      database: 'sqlite',
      path: DB_PATH,
      timestamp: now(),
      postgresql: isOnline ? 'connected' : 'offline',
      tables: ['categories', 'products', 'customers', 'suppliers', 'manufacturers', 'shelves', 'employees', 'batches', 'sales', 'purchases', 'users']
    });
  });

  // ==================== AUTH ====================
  app.post('/api/auth/register', async (req, res) => {
    try {
      const email = (req.body.email || req.body.username || '').toLowerCase().trim();
      const password = req.body.password;
      const name = req.body.name;
      const role = req.body.role || 'ADMIN';
      const branchId = req.body.branchId;

      console.log('[Auth] Register attempt:', email);

      if (!email || !password || !name) {
        return res.status(400).json({ success: false, message: 'Email, password, and name are required' });
      }

      // Check if user exists
      const existing = query('SELECT id FROM users WHERE LOWER(email) = ?', [email]);
      if (existing.length) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }

      const id = uuid();
      const hashedPassword = await hashPassword(password);
      const timestamp = now();

      // Try multiple INSERT strategies for maximum compatibility
      let insertSuccess = false;
      let insertError = '';

      const insertStrategies = [
        // Strategy 1: Full fields with username
        {
          sql: `INSERT INTO users (id, username, email, password, name, role, branchId, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,0,?,?)`,
          params: [id, email, email, hashedPassword, name, role, branchId || null, timestamp, timestamp]
        },
        // Strategy 2: Without username (older schema)
        {
          sql: `INSERT INTO users (id, email, password, name, role, branchId, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,?,0,?,?)`,
          params: [id, email, hashedPassword, name, role, branchId || null, timestamp, timestamp]
        },
        // Strategy 3: Minimum fields
        {
          sql: `INSERT INTO users (id, email, password, name, role, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,0,?,?)`,
          params: [id, email, hashedPassword, name, role, timestamp, timestamp]
        }
      ];

      for (let i = 0; i < insertStrategies.length; i++) {
        try {
          db.run(insertStrategies[i].sql, insertStrategies[i].params);
          saveDatabase();
          insertSuccess = true;
          console.log('[Auth] Insert succeeded with strategy', i + 1);
          break;
        } catch (e) {
          console.log('[Auth] Strategy', i + 1, 'failed:', e.message);
          insertError = e.message;
        }
      }

      if (!insertSuccess) {
        console.error('[Auth] All insert strategies failed:', insertError);
        return res.status(500).json({ success: false, message: 'Registration failed: ' + insertError });
      }

      // Verify user creation
      const created = query('SELECT id, email, name, role FROM users WHERE id = ?', [id]);
      if (!created.length) {
        return res.status(500).json({ success: false, message: 'Registration failed: User not saved' });
      }

      console.log('[Auth] User created successfully:', id);

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      const newUser = query('SELECT * FROM users WHERE id = ?', [id])[0];
      if (newUser) handleDataChange('users', 'create', newUser);

      res.json({
        success: true,
        pendingActivation: true,
        data: { user: { id, email, username: email, name, role, isActive: false } },
        message: 'Account created! Contact SuperAdmin at +923107100663 to activate your account.'
      });
    } catch (e) {
      console.error('[Auth] Register exception:', e.message);
      res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      // Support both 'email' and 'usernameOrEmail' fields - case insensitive
      const emailInput = (req.body.email || req.body.usernameOrEmail || '').toLowerCase().trim();
      const password = req.body.password;
      console.log('[Auth] Login attempt for:', emailInput);

      if (!emailInput || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
      }

      // OFFLINE-FIRST: Check SQLite first (non-blocking)
      // Case-insensitive email lookup - get ALL users (including inactive)
      let users = query('SELECT * FROM users WHERE LOWER(email) = ?', [emailInput]);
      console.log('[Auth] Users found in SQLite:', users.length);

      // OPTIONAL: Try to sync from PostgreSQL in background (non-blocking)
      // This ensures isActive status is updated, but doesn't block login
      if (REMOTE_DATABASE_URL && users.length === 0) {
        // User not found locally - try to sync from PostgreSQL (first login scenario)
        console.log('[Auth] 🔄 User not found locally, attempting to sync from PostgreSQL...');
        try {
          const client = await connectPostgreSQL();
          if (client) {
            // Quick sync users table
            const syncResult = await Promise.race([
              pullTableFromPostgreSQL('users', client, false),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 5000))
            ]).catch(e => {
              console.log('[Auth] ⚠️ Sync timeout or error:', e.message);
              return null;
            });

            if (syncResult) {
              console.log('[Auth] ✅ Users table synced, rechecking...');
              // Re-query after sync
              users = query('SELECT * FROM users WHERE LOWER(email) = ?', [emailInput]);
            }
          } else {
            console.log('[Auth] ⚠️ PostgreSQL not available, using local data only');
          }
        } catch (e) {
          console.log('[Auth] ⚠️ Sync error (non-blocking):', e.message);
          // Continue with local data if sync fails
        }
      } else if (REMOTE_DATABASE_URL && users.length > 0) {
        // User found locally - sync in background (non-blocking) to update isActive status
        console.log('[Auth] 🔄 User found locally, syncing isActive status in background...');
        connectPostgreSQL().then(client => {
          if (client) {
            pullTableFromPostgreSQL('users', client, false).catch(e => {
              console.log('[Auth] Background sync error (non-critical):', e.message);
            });
          }
        }).catch(e => {
          console.log('[Auth] Background sync skipped (offline):', e.message);
        });
      }

      if (users.length > 0) {
        console.log('[Auth] User isActive status:', users[0].isActive, 'Type:', typeof users[0].isActive);
      }

      if (!users.length) {
        console.log('[Auth] User not found for:', emailInput);
        return res.status(401).json({ success: false, message: 'Invalid credentials - user not found' });
      }

      const u = users[0];

      // CHECK IF ACCOUNT IS ACTIVE - uses the synced isActive status from PostgreSQL
      if (!u.isActive || u.isActive === 0) {
        console.log('[Auth] Account not activated for:', emailInput, 'isActive:', u.isActive);
        return res.status(403).json({
          success: false,
          message: 'Your account is not activated yet. Please contact SuperAdmin at +923107100663 to activate your account.',
          accountDisabled: true,
          pendingActivation: true
        });
      }

      // Use bcrypt verification (supports both bcrypt and SHA256)
      const storedHash = u.password;
      console.log('[Auth] Stored hash type:', storedHash ? (storedHash.startsWith('$2') ? 'bcrypt' : 'SHA256') : 'NULL');
      console.log('[Auth] Stored hash preview:', storedHash ? storedHash.substring(0, 20) + '...' : 'NULL');

      const isPasswordValid = await verifyPassword(password, storedHash);
      console.log('[Auth] Password verification result:', isPasswordValid);

      if (!isPasswordValid) {
        console.log('[Auth] Password mismatch');
        return res.status(401).json({ success: false, message: 'Invalid credentials - wrong password' });
      }

      console.log('[Auth] Login successful for:', u.email);
      const token = generateToken({ id: u.id, email: u.email, name: u.name, role: u.role, companyId: u.companyId, branchId: u.branchId });
      res.json({ success: true, data: {
        user: {
          id: u.id,
          email: u.email,
          username: u.email,
          name: u.name,
          role: u.role,
          phone: u.phone,
          companyId: u.companyId,
          branchId: u.branchId,
          isActive: u.isActive
        },
        token
      }});
    } catch (e) {
      console.error('[Auth] Login error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Forgot Password - Create password reset request
  app.post('/api/auth/forgot-password', (req, res) => {
    try {
      const email = (req.body.email || '').toLowerCase().trim();

      if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
      }

      // Check if user exists
      const users = query('SELECT id, email, name FROM users WHERE LOWER(email) = ?', [email]);

      if (!users.length) {
        // Don't reveal if email exists or not for security
        return res.json({
          success: true,
          message: 'If an account with this email exists, a password reset request has been submitted.'
        });
      }

      const user = users[0];
      const resetToken = uuid();
      const timestamp = now();

      // Store reset request (we'll create a simple table or use a field)
      // For now, we'll log it and the SuperAdmin will handle it manually
      console.log(`[Auth] Password reset requested for: ${email}`);
      console.log(`[Auth] User: ${user.name} (${user.id})`);
      console.log(`[Auth] Reset Token: ${resetToken}`);

      // Sync to PostgreSQL if connected
      if (REMOTE_DATABASE_URL) {
        syncAllToPostgreSQL().catch(e => console.log('[Sync] Error:', e.message));
      }

      res.json({
        success: true,
        message: 'Password reset request submitted successfully. Please contact SuperAdmin at +923107100663 to complete the reset.',
        data: {
          email: user.email,
          name: user.name,
          requestId: resetToken,
          contactNumber: '+923107100663'
        }
      });
    } catch (e) {
      console.error('[Auth] Forgot password error:', e.message);
      res.status(500).json({ success: false, message: 'Failed to process request' });
    }
  });

  // Reset Password by SuperAdmin (requires admin authentication)
  app.post('/api/auth/reset-password', authMiddleware, async (req, res) => {
    try {
      const { userId, newPassword, email } = req.body;

      // Only SUPERADMIN can reset passwords
      if (req.user.role !== 'SUPERADMIN' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can reset passwords' });
      }

      if (!newPassword) {
        return res.status(400).json({ success: false, message: 'New password is required' });
      }

      // Find user by ID or email
      let targetUser;
      if (userId) {
        const users = query('SELECT id, email, name FROM users WHERE id = ?', [userId]);
        targetUser = users[0];
      } else if (email) {
        const users = query('SELECT id, email, name FROM users WHERE LOWER(email) = ?', [email.toLowerCase()]);
        targetUser = users[0];
      }

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Reset password
      const hashedPassword = await hashPassword(newPassword);
      run('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?', [hashedPassword, now(), targetUser.id]);

      console.log(`[Auth] Password reset by ${req.user.email} for user: ${targetUser.email}`);

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      const resetUser = query('SELECT * FROM users WHERE id = ?', [targetUser.id])[0];
      if (resetUser) handleDataChange('users', 'update', resetUser);

      res.json({
        success: true,
        message: `Password reset successfully for ${targetUser.email}`,
        data: { email: targetUser.email, name: targetUser.name }
      });
    } catch (e) {
      console.error('[Auth] Reset password error:', e.message);
      res.status(500).json({ success: false, message: 'Failed to reset password' });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    try {
      const users = query('SELECT id, email, name, role, phone, companyId, branchId FROM users WHERE id = ?', [req.user.id]);
      if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: users[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/auth/profile', authMiddleware, (req, res) => {
    try {
      const users = query('SELECT id, email, name, role, phone, companyId, branchId FROM users WHERE id = ?', [req.user.id]);
      if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: users[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const users = query('SELECT password FROM users WHERE id = ?', [req.user.id]);
      if (!users.length || !(await verifyPassword(currentPassword, users[0].password))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      const hashedNewPassword = await hashPassword(newPassword);
      run('UPDATE users SET password = ?, updatedAt = ? WHERE id = ?', [hashedNewPassword, now(), req.user.id]);
      const updatedUser = query('SELECT * FROM users WHERE id = ?', [req.user.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (updatedUser) handleDataChange('users', 'update', updatedUser);

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/auth/update-profile', authMiddleware, (req, res) => {
    try {
      const { name, phone } = req.body;
      run('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), updatedAt = ? WHERE id = ?',
        [name, phone, now(), req.user.id]);
      const user = query('SELECT id, email, name, role, phone, companyId, branchId FROM users WHERE id = ?', [req.user.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (user) handleDataChange('users', 'update', user);

      res.json({ success: true, data: user, message: 'Profile updated' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Check account status endpoint (matches main backend)
  app.get('/api/auth/check-status', authMiddleware, (req, res) => {
    try {
      const user = query('SELECT id, email, name, role, isActive, companyId, branchId FROM users WHERE id = ?', [req.user.id])[0];
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          isActive: user.isActive === 1 || user.isActive === true,
          accountStatus: user.isActive === 1 || user.isActive === true ? 'ACTIVE' : 'INACTIVE',
          pendingActivation: !(user.isActive === 1 || user.isActive === true),
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            branchId: user.branchId
          }
        }
      });
    } catch (e) {
      console.error('[Auth] Check status error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== COMPANIES ====================
  app.get('/api/companies', authMiddleware, (req, res) => {
    try {
      const companies = query('SELECT * FROM companies WHERE isActive = 1 ORDER BY createdAt DESC');
      const result = companies.map(c => ({
        ...c,
        branches: query('SELECT id, name, phone FROM branches WHERE companyId = ? AND isActive = 1', [c.id]),
        _count: { branches: query('SELECT COUNT(*) as c FROM branches WHERE companyId = ? AND isActive = 1', [c.id])[0]?.c || 0 }
      }));
      res.json({ success: true, data: result });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/companies/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM companies WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/companies', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== COMPANY CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      const { name, description, address, phone, email, businessType = 'PHARMACY' } = req.body;
      console.log('[API] Creating company:', { name, businessType, userRole: req.user?.role });

      if (!name) return res.status(400).json({ success: false, message: 'Company name is required' });
      if (query('SELECT id FROM companies WHERE name = ?', [name]).length) {
        return res.status(400).json({ success: false, message: 'Company already exists' });
      }
      const id = uuid();
      const timestamp = now();

      console.log('[API] Inserting company with:', { id, name, createdBy: req.user?.id, timestamp });

      const success = run(`INSERT INTO companies (id, name, description, address, phone, email, businessType, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, name, description || null, address || null, phone || null, email || null, businessType, req.user.id, timestamp, timestamp]);

      if (!success) {
        console.error('[API] Failed to insert company, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to insert company: ' + (lastDbError || 'Unknown error') });
      }

      const company = query('SELECT * FROM companies WHERE id = ?', [id])[0];
      console.log('[API] Company created and retrieved:', company ? 'SUCCESS' : 'NOT FOUND');

      if (!company) {
        console.error('[API] Company inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Company created but not found' });
      }

      console.log('[API] ✅ Company saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (company) {
          handleDataChange('companies', 'create', company);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Company is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== COMPANY CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: company, message: 'Company created successfully' });
    } catch (e) { console.error('[API] Company create error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/companies/:id', authMiddleware, (req, res) => {
    try {
      const { name, description, address, phone, email, businessType } = req.body;
      const success = run(`UPDATE companies SET name = COALESCE(?, name), description = COALESCE(?, description),
           address = COALESCE(?, address), phone = COALESCE(?, phone), email = COALESCE(?, email),
           businessType = COALESCE(?, businessType), updatedAt = ? WHERE id = ?`,
        [name, description, address, phone, email, businessType, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update company, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update company: ' + (lastDbError || 'Unknown error') });
      }

      const company = query('SELECT * FROM companies WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (company) handleDataChange('companies', 'update', company);

      res.json({ success: true, data: company, message: 'Company updated successfully' });
    } catch (e) { console.error('[API] Company update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/companies/:id', authMiddleware, (req, res) => {
    try {
      const company = query('SELECT * FROM companies WHERE id = ?', [req.params.id])[0];
      if (!company) return res.status(404).json({ success: false, message: 'Company not found' });

      const success = run('UPDATE companies SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete company, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete company: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (company) handleDataChange('companies', 'update', { ...company, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Company deleted successfully' });
    } catch (e) { console.error('[API] Company delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/companies/:id/stats', authMiddleware, (req, res) => {
    try {
      const id = req.params.id;
      res.json({ success: true, data: {
        branches: query('SELECT COUNT(*) as c FROM branches WHERE companyId = ? AND isActive = 1', [id])[0]?.c || 0,
        users: query('SELECT COUNT(*) as c FROM users WHERE companyId = ? AND isActive = 1', [id])[0]?.c || 0,
        products: query('SELECT COUNT(*) as c FROM products WHERE companyId = ? AND isActive = 1', [id])[0]?.c || 0
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Update company business type endpoint (matches main backend)
  app.patch('/api/companies/:id/business-type', authMiddleware, (req, res) => {
    try {
      const { businessType } = req.body;
      if (!businessType) {
        return res.status(400).json({ success: false, message: 'Business type is required' });
      }

      const company = query('SELECT * FROM companies WHERE id = ?', [req.params.id])[0];
      if (!company) {
        return res.status(404).json({ success: false, message: 'Company not found' });
      }

      run('UPDATE companies SET businessType = ?, updatedAt = ? WHERE id = ?', [businessType, now(), req.params.id]);
      const updatedCompany = query('SELECT * FROM companies WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (updatedCompany) handleDataChange('companies', 'update', updatedCompany);

      res.json({ success: true, data: updatedCompany, message: 'Business type updated successfully' });
    } catch (e) {
      console.error('[Companies] Update business type error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== BRANCHES ====================
  app.get('/api/branches', authMiddleware, (req, res) => {
    try {
      console.log('[Branches] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Company:', req.user?.companyId);
      const { companyId } = req.query;

      // Get data filter based on user role
      const { companyFilter, createdBy } = getDataFilter(req.user, null, companyId, req);

      let sql = 'SELECT * FROM branches WHERE isActive = 1';
      const params = [];

      // Apply company isolation - users only see branches from their company
      if (companyFilter) { sql += ' AND companyId = ?'; params.push(companyFilter); }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      if (createdBy) {
        sql += ' AND createdBy = ?';
        params.push(createdBy);
      }
      sql += ' ORDER BY createdAt DESC';

      const branches = query(sql, params).map(b => ({
        ...b,
        company: query('SELECT id, name FROM companies WHERE id = ?', [b.companyId])[0]
      }));
      console.log('[Branches] Found:', branches.length);
      res.json({ success: true, data: { branches, pagination: { total: branches.length } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/branches/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM branches WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/branches', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== BRANCH CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      const { name, address, phone, email, companyId, managerId } = req.body;
      console.log('[API] Creating branch:', { name, companyId, userRole: req.user?.role });

      if (!name || !companyId) return res.status(400).json({ success: false, message: 'Name and companyId required' });
      const id = uuid();
      const timestamp = now();

      console.log('[API] Inserting branch with:', { id, name, companyId, createdBy: req.user?.id, timestamp });

      const success = run(`INSERT INTO branches (id, name, address, phone, email, companyId, managerId, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, name, address || null, phone || null, email || null, companyId, managerId || null, req.user.id, timestamp, timestamp]);

      if (!success) {
        console.error('[API] Failed to insert branch, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to insert branch: ' + (lastDbError || 'Unknown error') });
      }

      const branch = query('SELECT * FROM branches WHERE id = ?', [id])[0];
      console.log('[API] Branch created and retrieved:', branch ? 'SUCCESS' : 'NOT FOUND');

      if (!branch) {
        console.error('[API] Branch inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Branch created but not found' });
      }

      console.log('[API] ✅ Branch saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (branch) {
          handleDataChange('branches', 'create', branch);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Branch is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== BRANCH CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: branch, message: 'Branch created successfully' });
    } catch (e) { console.error('[API] Branch create error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/branches/:id', authMiddleware, (req, res) => {
    try {
      const { name, address, phone, email, managerId } = req.body;
      const success = run(`UPDATE branches SET name = COALESCE(?, name), address = COALESCE(?, address),
           phone = COALESCE(?, phone), email = COALESCE(?, email), managerId = COALESCE(?, managerId), updatedAt = ? WHERE id = ?`,
        [name, address, phone, email, managerId, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update branch, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update branch: ' + (lastDbError || 'Unknown error') });
      }

      const branch = query('SELECT * FROM branches WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (branch) handleDataChange('branches', 'update', branch);

      res.json({ success: true, data: branch, message: 'Branch updated successfully' });
    } catch (e) { console.error('[API] Branch update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/branches/:id', authMiddleware, (req, res) => {
    try {
      const branch = query('SELECT * FROM branches WHERE id = ?', [req.params.id])[0];
      if (!branch) return res.status(404).json({ success: false, message: 'Branch not found' });

      const success = run('UPDATE branches SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete branch, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete branch: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (branch) handleDataChange('branches', 'update', { ...branch, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Branch deleted successfully' });
    } catch (e) { console.error('[API] Branch delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== CATEGORIES ====================
  app.get('/api/categories', authMiddleware, (req, res) => {
    try {
      console.log('[Categories] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { branchId, companyId, search, type } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM categories WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        // For ADMIN/SUPERADMIN without branch selection, show global categories (branchId IS NULL)
        // For other roles, return no results
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (branchId IS NULL OR branchId = "")';
        } else {
          sql += ' AND 1=0'; // Return no results - force branch selection
        }
      } else if (branchFilter) {
        // Branch is selected - show categories for this branch AND global categories (branchId IS NULL)
        sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
        params.push(branchFilter);
      } else {
        // No branch filter specified - show all categories user has access to
        // For ADMIN/SUPERADMIN: show all categories (no branch filter)
        // For others: use their assigned branch
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // Show all categories (no branch filter)
        } else if (req.user?.branchId) {
          sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
          params.push(req.user.branchId);
        } else {
          sql += ' AND 1=0'; // No branch assigned - no access
        }
      }
      if (companyFilter) {
        sql += ' AND (companyId = ? OR companyId IS NULL OR companyId = "")';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But allow global categories (createdBy IS NULL) for ADMIN/SUPERADMIN
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (createdBy = ? OR createdBy IS NULL)';
        } else {
          sql += ' AND createdBy = ?';
        }
        params.push(createdBy);
      }
      if (type) { sql += ' AND type = ?'; params.push(type); }
      if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
      sql += ' ORDER BY createdAt DESC';

      console.log('[Categories] Query SQL:', sql);
      console.log('[Categories] Query Params:', params);
      console.log('[Categories] BranchFilter:', branchFilter, 'CompanyFilter:', companyFilter, 'CreatedBy:', createdBy);

      const categories = query(sql, params).map(c => ({
        ...c,
        _count: { products: query('SELECT COUNT(*) as count FROM products WHERE categoryId = ? AND isActive = 1', [c.id])[0]?.count || 0 }
      }));

      console.log('[Categories] Found:', categories.length, 'categories');
      // Also check total count without filters for debugging
      const totalCount = query('SELECT COUNT(*) as count FROM categories WHERE isActive = 1')[0]?.count || 0;
      console.log('[Categories] Total categories in DB (no filters):', totalCount);
      res.json({ success: true, data: { categories, pagination: { total: categories.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { console.error('[API] Categories GET error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/categories/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM categories WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Category not found' });
      const category = items[0];
      category._count = { products: query('SELECT COUNT(*) as count FROM products WHERE categoryId = ? AND isActive = 1', [category.id])[0]?.count || 0 };
      res.json({ success: true, data: category });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/categories', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== CATEGORY CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      const { name, description, type = 'GENERAL', color = '#3B82F6', branchId, companyId } = req.body;
      console.log('[API] Creating category:', { name, type, color, branchId, companyId, userRole: req.user?.role });

      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global category) if no branch is selected
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      // For ADMIN/SUPERADMIN, if no branch is selected, allow null (global category)
      if (!finalBranchId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        finalBranchId = null; // Global category
      }

      const id = uuid();
      const timestamp = now();

      console.log('[API] Inserting category with:', { id, name, finalBranchId, finalCompanyId, createdBy: req.user?.id, timestamp });

      const success = run(`INSERT INTO categories (id, name, description, type, color, branchId, companyId, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, description || null, type, color, finalBranchId || null, finalCompanyId || null, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        return res.status(500).json({ success: false, message: 'Failed to create category. Please try again.' });
      }

      const category = query('SELECT * FROM categories WHERE id = ?', [id])[0];
      console.log('[API] Category created and retrieved:', category ? 'SUCCESS' : 'NOT FOUND', category);

      if (!category) {
        console.error('[API] Category inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Category created but not found' });
      }

      console.log('[API] ✅ Category saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (category) {
          handleDataChange('categories', 'create', category);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Category is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== CATEGORY CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
    } catch (e) { console.error('[API] Category create error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/categories/:id', authMiddleware, (req, res) => {
    try {
      const { name, description, type, color } = req.body;
      run(`UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description),
           type = COALESCE(?, type), color = COALESCE(?, color), updatedAt = ? WHERE id = ?`,
        [name, description, type, color, now(), req.params.id]);
      const category = query('SELECT * FROM categories WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (category) handleDataChange('categories', 'update', category);

      res.json({ success: true, data: category, message: 'Category updated successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/categories/:id', authMiddleware, (req, res) => {
    try {
      const category = query('SELECT * FROM categories WHERE id = ?', [req.params.id])[0];
      run('UPDATE categories SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (category) handleDataChange('categories', 'update', { ...category, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== PRODUCTS ====================
  app.get('/api/products', authMiddleware, (req, res) => {
    try {
      const { branchId, companyId, categoryId, category, search, lowStock, categoryType, limit = 1000 } = req.query;
      console.log('[Products] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      // CRITICAL: Handle isActive as both integer (1/0) and boolean (true/false)
      // SQLite can store it either way, so check both
      let sql = 'SELECT * FROM products WHERE (isActive = 1 OR isActive = true)';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But for ADMIN/SUPERADMIN, be more flexible - check both createdBy and user.id
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // For ADMIN, check both createdBy and user.id (product might be created by admin or their createdBy)
          sql += ' AND (createdBy = ? OR createdBy = ?)';
          params.push(createdBy, req.user?.id);
        } else {
          sql += ' AND createdBy = ?';
          params.push(createdBy);
        }
      }

      if (categoryId || category) { sql += ' AND categoryId = ?'; params.push(categoryId || category); }
      if (search) { sql += ' AND (name LIKE ? OR genericName LIKE ? OR sku LIKE ? OR barcode LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
      if (lowStock === 'true') { sql += ' AND quantity <= minStock'; }
      sql += ' ORDER BY createdAt DESC';
      sql += ` LIMIT ${parseInt(limit) || 1000}`;

      console.log('[Products] GET Query - Filters:', {
        branchFilter,
        companyFilter,
        createdBy,
        userRole: req.user?.role,
        userId: req.user?.id,
        userCreatedBy: req.user?.createdBy
      });
      console.log('[Products] SQL:', sql);
      console.log('[Products] Params:', params);

      const rawProducts = query(sql, params);
      console.log('[Products] Raw products count:', rawProducts.length);

      // DEBUG: Also check total products in database (without filters) to see if product exists
      const allProductsDebug = query('SELECT id, name, branchId, createdBy, isActive FROM products ORDER BY createdAt DESC LIMIT 10');
      console.log('[Products] DEBUG - Last 10 products in DB:', allProductsDebug.map(p => ({
        id: p.id,
        name: p.name,
        branchId: p.branchId,
        createdBy: p.createdBy,
        isActive: p.isActive
      })));

      const products = rawProducts.map(p => {
        const cat = p.categoryId ? query('SELECT id, name, type, color FROM categories WHERE id = ?', [p.categoryId])[0] : null;
        const sup = p.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [p.supplierId])[0] : null;
        const branch = p.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [p.branchId])[0] : null;

        // Filter by category type if specified
        if (categoryType && cat && cat.type !== categoryType) {
          return null;
        }

        // Get batches for this product
        let productBatches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [p.id]);

        // Auto-create batch if none exists and product has stock
        if (productBatches.length === 0 && p.quantity > 0) {
          const batchId = uuid();
          const batchNo = `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 3)}`;
          const timestamp = now();
          const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

          run(`INSERT INTO batches (id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, branchId, companyId, supplierId, isActive, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            [batchId, batchNo, p.id, p.quantity, timestamp, expiryDate, p.costPrice || 0, p.sellingPrice || p.unitPrice || 0, p.branchId, p.companyId, p.supplierId, timestamp, timestamp]);

          productBatches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [p.id]);
          console.log('[Products] Auto-created batch for product:', p.name);
        }

        const formattedBatches = productBatches.map(b => ({
          ...b,
          id: b.id,
          batchNo: b.batchNumber,
          batchNumber: b.batchNumber,
          totalStock: b.quantity,
          quantity: b.quantity,
          expireDate: b.expiryDate,
          expiryDate: b.expiryDate,
          productionDate: b.manufacturingDate,
          purchasePrice: b.costPrice,
          costPrice: b.costPrice,
          sellingPrice: b.sellingPrice
        }));

        // Get current batch (first available with stock)
        const currentBatch = formattedBatches.find(b => b.quantity > 0) || null;

        // Calculate total stock from batches if available
        const batchStock = formattedBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);
        const totalStock = batchStock > 0 ? batchStock : (p.quantity || 0);

        // Get price from current batch or product
        const price = currentBatch?.sellingPrice || p.sellingPrice || p.unitPrice || 0;

        return {
          ...p,
          price: price,
          stock: totalStock,
          sellingPrice: price,
          costPrice: currentBatch?.costPrice || p.costPrice || 0,
          unitType: p.unitType || 'PIECE',
          unitsPerPack: p.unitsPerPack || 1,
          minStock: p.minStock || 10,
          maxStock: p.maxStock || 1000,
          requiresPrescription: p.requiresPrescription || false,
          category: cat || { id: '', name: 'Uncategorized', type: 'GENERAL' },
          supplier: sup || { id: '', name: 'Unknown' },
          branch: branch || { id: '', name: 'Unknown' },
          manufacturer: p.manufacturerId ? query('SELECT id, name FROM manufacturers WHERE id = ?', [p.manufacturerId])[0] : null,
          batches: formattedBatches,
          currentBatch: currentBatch
        };
      }).filter(p => p !== null);

      console.log('[Products] Final products count:', products.length);
      res.json({ success: true, data: { products, pagination: { total: products.length, page: 1, limit: parseInt(limit) || 1000, pages: 1 } } });
    } catch (e) { console.error('[API] Products GET error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/products/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM products WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Product not found' });
      const p = items[0];
      p.category = p.categoryId ? query('SELECT * FROM categories WHERE id = ?', [p.categoryId])[0] : null;
      p.manufacturer = p.manufacturerId ? query('SELECT * FROM manufacturers WHERE id = ?', [p.manufacturerId])[0] : null;
      p.supplier = p.supplierId ? query('SELECT * FROM suppliers WHERE id = ?', [p.supplierId])[0] : null;
      p.branch = p.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [p.branchId])[0] : null;

      // Get batches for this product
      const productBatches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [p.id]);
      p.batches = productBatches.map(b => ({
        ...b,
        batchNo: b.batchNumber,
        totalStock: b.quantity,
        expireDate: b.expiryDate,
        productionDate: b.manufacturingDate,
        purchasePrice: b.costPrice
      }));

      // Get current batch (first available with stock)
      p.currentBatch = p.batches.find(b => b.quantity > 0) || null;

      // Calculate total stock from batches if available
      const batchStock = p.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      p.stock = batchStock > 0 ? batchStock : (p.quantity || 0);
      p.price = p.currentBatch?.sellingPrice || p.sellingPrice || p.unitPrice || 0;

      res.json({ success: true, data: p });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/products', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== PRODUCT CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      console.log('[Products] POST request body:', req.body);
      const { name, genericName, formula, sku, barcode, description, categoryId, branchId, companyId,
              unitPrice = 0, costPrice = 0, sellingPrice = 0, stock = 0, quantity = 0, minStock = 10, maxStock = 1000,
              unitsPerPack = 1, reorderLevel = 20, requiresPrescription = false,
              manufacturerId, supplierId, shelfId, expiryDate, manufacturingDate, batchNumber } = req.body;

      if (!name) {
        console.log('[Products] Name is required but not provided');
        return res.status(400).json({ success: false, message: 'Name is required' });
      }

      const id = uuid();
      const generatedSku = sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const timestamp = now();
      const finalQuantity = parseInt(stock) || parseInt(quantity) || 0;
      const finalSellingPrice = parseFloat(sellingPrice) || parseFloat(unitPrice) || 0;
      const finalCostPrice = parseFloat(costPrice) || 0;

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global product) if no branch is selected
      let cleanBranchId = (branchId && branchId !== 'default-branch' && branchId.length > 10) ? branchId : null;
      let cleanCompanyId = companyId || null;

      // Fallback to user's branch/company
      if (!cleanBranchId) cleanBranchId = req.user?.branchId || null;
      if (!cleanCompanyId) cleanCompanyId = req.user?.companyId || null;

      // If branchId is empty string, treat as null (global product for ADMIN/SUPERADMIN)
      if (cleanBranchId === '' && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        cleanBranchId = null;
      }
      if (cleanCompanyId === '') {
        cleanCompanyId = null;
      }

      // CRITICAL: If companyId is still null, we need to handle NOT NULL constraint
      // Try to get it from the first available company, or use a default value
      if (!cleanCompanyId) {
        try {
          const companies = query('SELECT id FROM companies LIMIT 1');
          if (companies && companies.length > 0) {
            cleanCompanyId = companies[0].id;
            console.log('[Products] Using default companyId from companies table:', cleanCompanyId);
          } else {
            // If no company exists, we need to handle the NOT NULL constraint
            // Try to get companyId from user's branch
            if (cleanBranchId) {
              const branch = query('SELECT companyId FROM branches WHERE id = ?', [cleanBranchId])[0];
              if (branch && branch.companyId) {
                cleanCompanyId = branch.companyId;
                console.log('[Products] Using companyId from branch:', cleanCompanyId);
              }
            }

            // If still no companyId, we'll need to allow NULL or use a placeholder
            // For now, let's try to insert with NULL and see if we need to fix the schema
            if (!cleanCompanyId) {
              console.warn('[Products] ⚠️ No companyId available - will try to insert with NULL');
              // We'll let the INSERT fail and then fix the schema if needed
            }
          }
        } catch (e) {
          console.error('[Products] Error fetching companyId:', e.message);
        }
      }

      const cleanCategoryId = (categoryId && categoryId.length > 10) ? categoryId : null;
      const cleanSupplierId = (supplierId && supplierId.length > 10) ? supplierId : null;

      const finalCreatedBy = req.user?.createdBy || req.user?.id || null;
      console.log('[Products] Creating product with:', {
        id,
        name,
        cleanBranchId,
        cleanCompanyId,
        cleanCategoryId,
        cleanSupplierId,
        createdBy: finalCreatedBy,
        userId: req.user?.id,
        userCreatedBy: req.user?.createdBy,
        userRole: req.user?.role
      });

      // CRITICAL: Verify database is initialized before attempting INSERT
      if (!db) {
        console.error('[API] ❌ Database not initialized');
        return res.status(500).json({
          success: false,
          message: 'Database not initialized. Please restart the application.',
          error: 'Database not initialized',
          code: 'DATABASE_ERROR'
        });
      }

      // CRITICAL: Ensure all required columns exist before INSERT
      // Add missing columns on-the-fly if needed
      const requiredColumns = [
        { name: 'quantity', sql: 'ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT 0' },
        { name: 'unitType', sql: "ALTER TABLE products ADD COLUMN unitType TEXT DEFAULT 'PIECE'" },
        { name: 'genericName', sql: 'ALTER TABLE products ADD COLUMN genericName TEXT' },
        { name: 'formula', sql: 'ALTER TABLE products ADD COLUMN formula TEXT' },
        { name: 'batchNumber', sql: 'ALTER TABLE products ADD COLUMN batchNumber TEXT' },
        { name: 'costPrice', sql: 'ALTER TABLE products ADD COLUMN costPrice REAL DEFAULT 0' },
        { name: 'sellingPrice', sql: 'ALTER TABLE products ADD COLUMN sellingPrice REAL DEFAULT 0' },
        { name: 'unitPrice', sql: 'ALTER TABLE products ADD COLUMN unitPrice REAL DEFAULT 0' },
        { name: 'expiryDate', sql: 'ALTER TABLE products ADD COLUMN expiryDate TEXT' },
        { name: 'manufacturingDate', sql: 'ALTER TABLE products ADD COLUMN manufacturingDate TEXT' },
        { name: 'minStock', sql: 'ALTER TABLE products ADD COLUMN minStock INTEGER DEFAULT 10' },
        { name: 'maxStock', sql: 'ALTER TABLE products ADD COLUMN maxStock INTEGER DEFAULT 1000' },
        { name: 'unitsPerPack', sql: 'ALTER TABLE products ADD COLUMN unitsPerPack INTEGER DEFAULT 1' },
        { name: 'reorderLevel', sql: 'ALTER TABLE products ADD COLUMN reorderLevel INTEGER DEFAULT 20' },
        { name: 'requiresPrescription', sql: 'ALTER TABLE products ADD COLUMN requiresPrescription INTEGER DEFAULT 0' },
        { name: 'manufacturerId', sql: 'ALTER TABLE products ADD COLUMN manufacturerId TEXT' },
        { name: 'supplierId', sql: 'ALTER TABLE products ADD COLUMN supplierId TEXT' },
        { name: 'shelfId', sql: 'ALTER TABLE products ADD COLUMN shelfId TEXT' },
        { name: 'sku', sql: 'ALTER TABLE products ADD COLUMN sku TEXT' },
        { name: 'barcode', sql: 'ALTER TABLE products ADD COLUMN barcode TEXT' }
      ];

      // Try to add missing columns (will fail silently if column already exists)
      for (const col of requiredColumns) {
        try {
          db.run(col.sql);
          console.log(`[API] Added missing column: ${col.name}`);
        } catch (e) {
          // Column already exists or other error - that's fine
          if (!e.message.includes('duplicate column')) {
            console.log(`[API] Column ${col.name} already exists or error:`, e.message);
          }
        }
      }

      // CRITICAL: Ensure companyId is never null to avoid NOT NULL constraint errors
      // SQLite treats empty string as valid value, so use empty string instead of null
      const finalCompanyId = cleanCompanyId || '';
      console.log('[Products] Final companyId for INSERT:', finalCompanyId || '(empty string)');

      // Try to insert product - use minimal columns first to avoid column mismatch errors
      // Only include columns that definitely exist in the schema
      const success = run(`INSERT INTO products (
        id, name, genericName, sku, barcode, description,
        categoryId, branchId, companyId,
        unitPrice, costPrice, sellingPrice,
        quantity, minStock, maxStock, unitsPerPack, reorderLevel,
        requiresPrescription,
        manufacturerId, supplierId, shelfId,
        expiryDate, manufacturingDate, batchNumber,
        createdBy, isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [
          id,
          name,
          genericName || formula || null,
          generatedSku,
          barcode || null,
          description || null,
          cleanCategoryId,
          cleanBranchId,
          finalCompanyId, // Use empty string instead of null
          finalSellingPrice,
          finalCostPrice,
          finalSellingPrice,
          finalQuantity,
          minStock || 10,
          maxStock || 1000,
          unitsPerPack || 1,
          reorderLevel || 20,
          requiresPrescription ? 1 : 0,
          manufacturerId || null,
          cleanSupplierId,
          shelfId || null,
          expiryDate || null,
          manufacturingDate || null,
          batchNumber || null,
          finalCreatedBy, // Use createdBy if available, otherwise user.id (matches query filter)
          timestamp,
          timestamp
        ]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Product INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        console.error('[API] Full error details:', {
          error: errorMsg,
          dbInitialized: !!db,
          sql: 'INSERT INTO products...',
          paramsCount: 28
        });

        // CRITICAL: Return detailed error message so frontend can see exactly what's wrong
        const errorResponse = {
          success: false,
          message: `Failed to create product: ${errorMsg}`,
          error: errorMsg,
          code: 'DATABASE_ERROR',
          details: {
            dbInitialized: !!db,
            errorType: errorMsg.includes('no column') ? 'MISSING_COLUMN' :
                      errorMsg.includes('no such table') ? 'MISSING_TABLE' :
                      errorMsg.includes('syntax error') ? 'SQL_SYNTAX_ERROR' : 'UNKNOWN_ERROR'
          }
        };

        console.error('[API] Returning error response:', JSON.stringify(errorResponse, null, 2));
        return res.status(500).json(errorResponse);
      }

      // Return with nested objects that frontend expects
      const p = query('SELECT * FROM products WHERE id = ?', [id])[0];
      console.log('[Products] Product created and retrieved:', p ? 'SUCCESS' : 'NOT FOUND');

      if (!p) {
        console.error('[Products] Product inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Product created but not found' });
      }

      const category = p.categoryId ? query('SELECT id, name FROM categories WHERE id = ?', [p.categoryId])[0] : null;
      const supplier = p.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [p.supplierId])[0] : null;
      const branch = p.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [p.branchId])[0] : null;

      const product = {
        ...p,
        category: category || { id: '', name: 'Uncategorized' },
        supplier: supplier || { id: '', name: 'Unknown' },
        branch: branch || { id: '', name: 'Unknown' },
        stock: p.quantity || 0,
        price: p.sellingPrice || 0,
        requiresPrescription: !!p.requiresPrescription
      };

      console.log('[Products] Created product successfully:', product.id, product.name);
      console.log('[API] ✅ Product saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (product) {
          handleDataChange('products', 'create', product);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Product is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== PRODUCT CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
    } catch (e) {
      console.error('[API] Product create error:', e.message, e.stack);
      res.status(500).json({ success: false, message: 'Error creating product: ' + e.message });
    }
  });

  app.put('/api/products/:id', authMiddleware, (req, res) => {
    try {
      const cols = Object.keys(req.body).filter(k => req.body[k] !== undefined);
      if (!cols.length) return res.status(400).json({ success: false, message: 'No fields to update' });
      const sets = cols.map(k => `${k} = ?`).join(', ');
      const vals = [...cols.map(k => req.body[k]), now(), req.params.id];
      const success = run(`UPDATE products SET ${sets}, updatedAt = ? WHERE id = ?`, vals);

      if (!success) {
        console.error('[Products] Failed to update product, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update product: ' + (lastDbError || 'Unknown error') });
      }

      const product = query('SELECT * FROM products WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (product) handleDataChange('products', 'update', product);

      res.json({ success: true, data: product, message: 'Product updated successfully' });
    } catch (e) { console.error('[API] Product update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/products/:id', authMiddleware, (req, res) => {
    try {
      const product = query('SELECT * FROM products WHERE id = ?', [req.params.id])[0];
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      const success = run('UPDATE products SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[Products] Failed to delete product, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete product: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (product) handleDataChange('products', 'update', { ...product, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Product deleted successfully' });
    } catch (e) { console.error('[API] Product delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  // Activate all products endpoint (matches main backend) - ADMIN/SUPERADMIN only
  app.post('/api/products/activate-all', authMiddleware, (req, res) => {
    try {
      // Only ADMIN and SUPERADMIN can activate all products
      if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({ success: false, message: 'Only Admin and SuperAdmin can activate all products' });
      }

      // Get data filter to only activate products in user's scope
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, null, null, req);

      // Note: sql.js doesn't support UPDATE with WHERE directly, so we need to do it row by row
      // CRITICAL: Apply data isolation including createdBy
      let activateWhere = 'isActive = 0';
      const activateParams = [];
      if (branchFilter && branchFilter !== 'must-select-branch' && branchFilter !== 'non-existent-branch-id') {
        activateWhere += ' AND branchId = ?';
        activateParams.push(branchFilter);
      }
      if (companyFilter) {
        activateWhere += ' AND companyId = ?';
        activateParams.push(companyFilter);
      }
      if (createdBy) {
        activateWhere += ' AND createdBy = ?';
        activateParams.push(createdBy);
      }

      // Note: sql.js doesn't support UPDATE with WHERE directly, so we need to do it row by row
      const products = query(`SELECT * FROM products WHERE ${activateWhere}`, activateParams);

      let activated = 0;
      products.forEach(p => {
        run('UPDATE products SET isActive = 1, updatedAt = ? WHERE id = ?', [now(), p.id]);
        handleDataChange('products', 'update', { ...p, isActive: 1, updatedAt: now() });
        activated++;
      });

      res.json({
        success: true,
        data: { activated },
        message: `Activated ${activated} products successfully`
      });
    } catch (e) {
      console.error('[Products] Activate all error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== CUSTOMERS ====================
  app.get('/api/customers', authMiddleware, (req, res) => {
    try {
      console.log('[Customers] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { branchId, companyId, search, vip, limit = 100 } = req.query;

      // CRITICAL: Strict branch-level data isolation (matches main backend)
      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM customers WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }

      if (search) { sql += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
      if (vip === 'true') { sql += ' AND loyaltyPoints >= 1000'; }
      sql += ' ORDER BY createdAt DESC';
      sql += ` LIMIT ${parseInt(limit) || 100}`;

      console.log('[Customers] SQL:', sql, 'Params:', params);
      const rawCustomers = query(sql, params);
      console.log('[Customers] Found customers:', rawCustomers.length);

      const customers = rawCustomers.map(c => {
        const salesCount = query('SELECT COUNT(*) as count, SUM(grandTotal) as total FROM sales WHERE customerId = ?', [c.id])[0];
        const branch = c.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [c.branchId])[0] : null;
        const lastSale = query('SELECT createdAt FROM sales WHERE customerId = ? ORDER BY createdAt DESC LIMIT 1', [c.id])[0];
        return {
          ...c,
          totalPurchases: salesCount?.total || 0,
          totalSpent: salesCount?.total || 0,
          isVIP: (c.loyaltyPoints || 0) >= 1000,
          branch: branch || { id: '', name: 'Default' },
          lastPurchase: lastSale?.createdAt || null,
          _count: { sales: salesCount?.count || 0 }
        };
      });
      res.json({ success: true, data: { customers, pagination: { total: customers.length, page: 1, limit: parseInt(limit) || 100, pages: 1 } } });
    } catch (e) {
      console.error('[Customers] GET error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/customers/:id', authMiddleware, (req, res) => {
    try {
      // CRITICAL: Apply data isolation - check if customer belongs to user's branch/company
      const { branchFilter, companyFilter } = getDataFilter(req.user, null, null, req);

      let sql = 'SELECT * FROM customers WHERE id = ? AND isActive = 1';
      const params = [req.params.id];

      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }

      const items = query(sql, params);
      if (!items.length) return res.status(404).json({ success: false, message: 'Customer not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/customers', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== CUSTOMER CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      const { name, email, phone, address, branchId, companyId, loyaltyPoints = 0 } = req.body;
      console.log('[API] Creating customer:', { name, branchId, companyId, userRole: req.user?.role });

      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      // Use user's branchId and companyId if not provided
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      const id = uuid();
      const timestamp = now();

      // CRITICAL: Ensure companyId is never null to avoid NOT NULL constraint errors
      const finalCompanyIdForCustomer = finalCompanyId || '';

      console.log('[API] Inserting customer with:', { id, name, finalBranchId, finalCompanyIdForCustomer, createdBy: req.user?.id, timestamp });

      const success = run(`INSERT INTO customers (id, name, email, phone, address, branchId, companyId, loyaltyPoints, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, email || null, phone || null, address || null, finalBranchId || null, finalCompanyIdForCustomer, loyaltyPoints, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Customer INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        return res.status(500).json({
          success: false,
          message: `Failed to create customer: ${errorMsg}`,
          error: errorMsg,
          code: 'DATABASE_ERROR'
        });
      }

      const customer = query('SELECT * FROM customers WHERE id = ?', [id])[0];
      console.log('[API] Customer created and retrieved:', customer ? 'SUCCESS' : 'NOT FOUND');

      if (!customer) {
        console.error('[API] Customer inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Customer created but not found' });
      }

      console.log('[API] ✅ Customer saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (customer) {
          handleDataChange('customers', 'create', customer);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Customer is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== CUSTOMER CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: customer, message: 'Customer created successfully' });
    } catch (e) { console.error('[API] Customer create error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/customers/:id', authMiddleware, (req, res) => {
    try {
      const { name, email, phone, address, loyaltyPoints } = req.body;
      const success = run(`UPDATE customers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
           address = COALESCE(?, address), loyaltyPoints = COALESCE(?, loyaltyPoints), updatedAt = ? WHERE id = ?`,
        [name, email, phone, address, loyaltyPoints, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update customer, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update customer: ' + (lastDbError || 'Unknown error') });
      }

      const customer = query('SELECT * FROM customers WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (customer) handleDataChange('customers', 'update', customer);

      res.json({ success: true, data: customer, message: 'Customer updated successfully' });
    } catch (e) { console.error('[API] Customer update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/customers/:id', authMiddleware, (req, res) => {
    try {
      const customer = query('SELECT * FROM customers WHERE id = ?', [req.params.id])[0];
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

      const success = run('UPDATE customers SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete customer, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete customer: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (customer) handleDataChange('customers', 'update', { ...customer, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (e) { console.error('[API] Customer delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/customers/:id/purchase-history', authMiddleware, (req, res) => {
    try {
      const customer = query('SELECT * FROM customers WHERE id = ?', [req.params.id])[0];
      if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

      const sales = query('SELECT * FROM sales WHERE customerId = ? ORDER BY createdAt DESC LIMIT 50', [req.params.id]).map(s => {
        const items = query('SELECT * FROM sale_items WHERE saleId = ?', [s.id]).map(item => {
          const product = query('SELECT id, name, unitPrice FROM products WHERE id = ?', [item.productId])[0];
          return { ...item, totalPrice: item.total, product: product || { id: '', name: 'Unknown', unitType: 'PIECE' } };
        });
        const user = s.createdBy ? query('SELECT id, name, email as username FROM users WHERE id = ?', [s.createdBy])[0] : null;
        const branch = s.branchId ? query('SELECT name FROM branches WHERE id = ?', [s.branchId])[0] : null;
        return { ...s, items, user, branch, totalAmount: s.grandTotal };
      });

      const totalSpent = query('SELECT SUM(grandTotal) as total FROM sales WHERE customerId = ?', [req.params.id])[0]?.total || 0;
      const avgOrder = sales.length > 0 ? totalSpent / sales.length : 0;

      res.json({ success: true, data: {
        customer: { id: customer.id, name: customer.name, phone: customer.phone },
        sales,
        stats: { totalPurchases: sales.length, totalSpent, averageOrder: avgOrder },
        pagination: { total: sales.length, page: 1, limit: 50, pages: 1 }
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== SUPPLIERS ====================
  app.get('/api/suppliers', authMiddleware, (req, res) => {
    try {
      console.log('[Suppliers] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { branchId, companyId, search, manufacturerId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM suppliers WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        // For ADMIN/SUPERADMIN without branch selection, show global items (branchId IS NULL)
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (branchId IS NULL OR branchId = "")';
        } else {
          sql += ' AND 1=0'; // Return no results - force branch selection
        }
      } else if (branchFilter) {
        // Branch is selected - show items for this branch AND global items (branchId IS NULL)
        sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
        params.push(branchFilter);
      } else {
        // No branch filter specified - show all items user has access to
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // Show all items (no branch filter)
        } else if (req.user?.branchId) {
          sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
          params.push(req.user.branchId);
        } else {
          sql += ' AND 1=0'; // No branch assigned - no access
        }
      }
      if (companyFilter) {
        sql += ' AND (companyId = ? OR companyId IS NULL OR companyId = "")';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But allow global items (createdBy IS NULL) for ADMIN/SUPERADMIN
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (createdBy = ? OR createdBy IS NULL)';
        } else {
          sql += ' AND createdBy = ?';
        }
        params.push(createdBy);
      }
      if (manufacturerId) { sql += ' AND manufacturerId = ?'; params.push(manufacturerId); }
      if (search) { sql += ' AND (name LIKE ? OR contactPerson LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      sql += ' ORDER BY createdAt DESC';

      const suppliers = query(sql, params).map(s => ({
        ...s,
        manufacturer: s.manufacturerId ? query('SELECT id, name, country FROM manufacturers WHERE id = ?', [s.manufacturerId])[0] : null,
        _count: { products: query('SELECT COUNT(*) as c FROM products WHERE supplierId = ?', [s.id])[0]?.c || 0 }
      }));

      console.log('[Suppliers] Found:', suppliers.length);
      res.json({ success: true, data: { suppliers, pagination: { total: suppliers.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/suppliers/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM suppliers WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Supplier not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/suppliers', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== SUPPLIER CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      const { name, email, phone, address, contactPerson, branchId, companyId } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global supplier) if no branch is selected
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      // For ADMIN/SUPERADMIN, if no branch is selected, allow null (global supplier)
      if (!finalBranchId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        finalBranchId = null; // Global supplier
      }

      const id = uuid();
      const timestamp = now();

      // CRITICAL: Ensure companyId is never null to avoid NOT NULL constraint errors
      const finalCompanyIdForSupplier = finalCompanyId || '';

      console.log('[API] Inserting supplier with:', { id, name, finalBranchId, finalCompanyIdForSupplier, createdBy: req.user?.id });

      const success = run(`INSERT INTO suppliers (id, name, email, phone, address, contactPerson, branchId, companyId, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, email || null, phone || null, address || null, contactPerson || null, finalBranchId || null, finalCompanyIdForSupplier, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Supplier INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        return res.status(500).json({
          success: false,
          message: `Failed to create supplier: ${errorMsg}`,
          error: errorMsg,
          code: 'DATABASE_ERROR'
        });
      }

      const supplier = query('SELECT * FROM suppliers WHERE id = ?', [id])[0];
      console.log('[API] Supplier created and retrieved:', supplier ? 'SUCCESS' : 'NOT FOUND');

      if (!supplier) {
        console.error('[API] Supplier inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Supplier created but not found' });
      }

      console.log('[API] ✅ Supplier saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (supplier) {
          handleDataChange('suppliers', 'create', supplier);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Supplier is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== SUPPLIER CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: supplier, message: 'Supplier created successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/suppliers/:id', authMiddleware, (req, res) => {
    try {
      const { name, email, phone, address, contactPerson } = req.body;
      const success = run(`UPDATE suppliers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
           address = COALESCE(?, address), contactPerson = COALESCE(?, contactPerson), updatedAt = ? WHERE id = ?`,
        [name, email, phone, address, contactPerson, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update supplier, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update supplier: ' + (lastDbError || 'Unknown error') });
      }

      const supplier = query('SELECT * FROM suppliers WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (supplier) handleDataChange('suppliers', 'update', supplier);

      res.json({ success: true, data: supplier, message: 'Supplier updated successfully' });
    } catch (e) { console.error('[API] Supplier update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/suppliers/:id', authMiddleware, (req, res) => {
    try {
      const supplier = query('SELECT * FROM suppliers WHERE id = ?', [req.params.id])[0];
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

      const success = run('UPDATE suppliers SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete supplier, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete supplier: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (supplier) handleDataChange('suppliers', 'update', { ...supplier, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (e) { console.error('[API] Supplier delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== MANUFACTURERS ====================
  app.get('/api/manufacturers', authMiddleware, (req, res) => {
    try {
      console.log('[Manufacturers] GET - User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { branchId, companyId, search } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM manufacturers WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        // For ADMIN/SUPERADMIN without branch selection, show global items (branchId IS NULL)
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (branchId IS NULL OR branchId = "")';
        } else {
          sql += ' AND 1=0'; // Return no results - force branch selection
        }
      } else if (branchFilter) {
        // Branch is selected - show items for this branch AND global items (branchId IS NULL)
        sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
        params.push(branchFilter);
      } else {
        // No branch filter specified - show all items user has access to
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // Show all items (no branch filter)
        } else if (req.user?.branchId) {
          sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
          params.push(req.user.branchId);
        } else {
          sql += ' AND 1=0'; // No branch assigned - no access
        }
      }
      if (companyFilter) {
        sql += ' AND (companyId = ? OR companyId IS NULL OR companyId = "")';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But allow global items (createdBy IS NULL) for ADMIN/SUPERADMIN
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (createdBy = ? OR createdBy IS NULL)';
        } else {
          sql += ' AND createdBy = ?';
        }
        params.push(createdBy);
      }
      if (search) { sql += ' AND name LIKE ?'; params.push(`%${search}%`); }
      sql += ' ORDER BY createdAt DESC';

      const manufacturers = query(sql, params).map(m => ({
        ...m,
        _count: { suppliers: query('SELECT COUNT(*) as c FROM suppliers WHERE manufacturerId = ?', [m.id])[0]?.c || 0 },
        suppliers: query('SELECT id, name FROM suppliers WHERE manufacturerId = ? AND isActive = 1', [m.id])
      }));
      console.log('[Manufacturers] Found:', manufacturers.length);
      res.json({ success: true, data: { manufacturers, pagination: { total: manufacturers.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/manufacturers/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM manufacturers WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Manufacturer not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/manufacturers', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== MANUFACTURER CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      // CRITICAL: Accept both description (from frontend) and email/phone/address (from backend)
      const { name, description, email, phone, address, branchId, companyId } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global manufacturer) if no branch is selected
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      // For ADMIN/SUPERADMIN, if no branch is selected, allow null (global manufacturer)
      if (!finalBranchId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        finalBranchId = null; // Global manufacturer
      }

      const id = uuid();
      const timestamp = now();

      // CRITICAL: Ensure companyId is never null to avoid NOT NULL constraint errors
      const finalCompanyIdForManufacturer = finalCompanyId || '';

      console.log('[API] Inserting manufacturer with:', { id, name, finalBranchId, finalCompanyIdForManufacturer, createdBy: req.user?.id });

      // CRITICAL: Include description field in INSERT (frontend sends description, not email/phone/address)
      const success = run(`INSERT INTO manufacturers (id, name, description, email, phone, address, branchId, companyId, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, description || null, email || null, phone || null, address || null, finalBranchId || null, finalCompanyIdForManufacturer, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Manufacturer INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        return res.status(500).json({
          success: false,
          message: `Failed to create manufacturer: ${errorMsg}`,
          error: errorMsg,
          code: 'DATABASE_ERROR'
        });
      }

      const manufacturer = query('SELECT * FROM manufacturers WHERE id = ?', [id])[0];
      console.log('[API] Manufacturer created and retrieved:', manufacturer ? 'SUCCESS' : 'NOT FOUND');

      if (!manufacturer) {
        console.error('[API] Manufacturer inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Manufacturer created but not found' });
      }

      console.log('[API] ✅ Manufacturer saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (manufacturer) {
          handleDataChange('manufacturers', 'create', manufacturer);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Manufacturer is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== MANUFACTURER CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: manufacturer, message: 'Manufacturer created successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/manufacturers/:id', authMiddleware, (req, res) => {
    try {
      const { name, email, phone, address } = req.body;
      const success = run(`UPDATE manufacturers SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
           address = COALESCE(?, address), updatedAt = ? WHERE id = ?`,
        [name, email, phone, address, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update manufacturer, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update manufacturer: ' + (lastDbError || 'Unknown error') });
      }

      const manufacturer = query('SELECT * FROM manufacturers WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (manufacturer) handleDataChange('manufacturers', 'update', manufacturer);

      res.json({ success: true, data: manufacturer, message: 'Manufacturer updated successfully' });
    } catch (e) { console.error('[API] Manufacturer update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/manufacturers/:id', authMiddleware, (req, res) => {
    try {
      const manufacturer = query('SELECT * FROM manufacturers WHERE id = ?', [req.params.id])[0];
      if (!manufacturer) return res.status(404).json({ success: false, message: 'Manufacturer not found' });

      const success = run('UPDATE manufacturers SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete manufacturer, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete manufacturer: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (manufacturer) handleDataChange('manufacturers', 'update', { ...manufacturer, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Manufacturer deleted successfully' });
    } catch (e) { console.error('[API] Manufacturer delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== SHELVES ====================
  app.get('/api/shelves', authMiddleware, (req, res) => {
    try {
      console.log('[Shelves] GET - User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { branchId, companyId, search } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM shelves WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        // For ADMIN/SUPERADMIN without branch selection, show global items (branchId IS NULL)
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (branchId IS NULL OR branchId = "")';
        } else {
          sql += ' AND 1=0'; // Return no results - force branch selection
        }
      } else if (branchFilter) {
        // Branch is selected - show items for this branch AND global items (branchId IS NULL)
        sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
        params.push(branchFilter);
      } else {
        // No branch filter specified - show all items user has access to
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // Show all items (no branch filter)
        } else if (req.user?.branchId) {
          sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
          params.push(req.user.branchId);
        } else {
          sql += ' AND 1=0'; // No branch assigned - no access
        }
      }
      if (companyFilter) {
        sql += ' AND (companyId = ? OR companyId IS NULL OR companyId = "")';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But allow global items (createdBy IS NULL) for ADMIN/SUPERADMIN
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (createdBy = ? OR createdBy IS NULL)';
        } else {
          sql += ' AND createdBy = ?';
        }
        params.push(createdBy);
      }
      if (search) { sql += ' AND (name LIKE ? OR location LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      sql += ' ORDER BY createdAt DESC';

      const shelves = query(sql, params).map(s => ({
        ...s,
        branch: s.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [s.branchId])[0] : null,
        _count: { products: query('SELECT COUNT(*) as c FROM products WHERE shelfId = ?', [s.id])[0]?.c || 0 }
      }));
      console.log('[Shelves] Found:', shelves.length);
      res.json({ success: true, data: { shelves, pagination: { total: shelves.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/shelves/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM shelves WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Shelf not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/shelves', authMiddleware, (req, res) => {
    try {
      const { name, location, capacity = 100, branchId, companyId } = req.body;
      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global shelf) if no branch is selected
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      // For ADMIN/SUPERADMIN, if no branch is selected, allow null (global shelf)
      if (!finalBranchId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        finalBranchId = null; // Global shelf
      }

      const id = uuid();
      const timestamp = now();

      console.log('[API] Inserting shelf with:', { id, name, finalBranchId, finalCompanyId, createdBy: req.user?.id });

      const success = run(`INSERT INTO shelves (id, name, location, capacity, branchId, companyId, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, location || null, capacity, finalBranchId || null, finalCompanyId || null, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        console.error('[API] Failed to insert shelf, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to insert shelf: ' + (lastDbError || 'Unknown error') });
      }

      const shelf = query('SELECT * FROM shelves WHERE id = ?', [id])[0];
      console.log('[API] Shelf created and retrieved:', shelf ? 'SUCCESS' : 'NOT FOUND');

      if (!shelf) {
        console.error('[API] Shelf inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Shelf created but not found' });
      }

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (shelf) handleDataChange('shelves', 'create', shelf);

      res.status(201).json({ success: true, data: shelf, message: 'Shelf created successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/shelves/:id', authMiddleware, (req, res) => {
    try {
      const { name, location, capacity } = req.body;
      run(`UPDATE shelves SET name = COALESCE(?, name), location = COALESCE(?, location), capacity = COALESCE(?, capacity), updatedAt = ? WHERE id = ?`,
        [name, location, capacity, now(), req.params.id]);
      const shelf = query('SELECT * FROM shelves WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (shelf) handleDataChange('shelves', 'update', shelf);

      res.json({ success: true, data: shelf, message: 'Shelf updated successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/shelves/:id', authMiddleware, (req, res) => {
    try {
      const shelf = query('SELECT * FROM shelves WHERE id = ?', [req.params.id])[0];
      run('UPDATE shelves SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (shelf) handleDataChange('shelves', 'update', { ...shelf, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Shelf deleted successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== EMPLOYEES ====================
  app.get('/api/employees', authMiddleware, (req, res) => {
    try {
      const { branchId, companyId, search, isActive, status } = req.query;
      let sql = 'SELECT * FROM employees WHERE isActive = 1';
      const params = [];
      if (branchId) { sql += ' AND branchId = ?'; params.push(branchId); }
      if (companyId) { sql += ' AND companyId = ?'; params.push(companyId); }
      if (search) { sql += ' AND (name LIKE ? OR email LIKE ? OR position LIKE ? OR employeeId LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
      sql += ' ORDER BY createdAt DESC';
      const employees = query(sql, params).map(e => ({
        ...e,
        status: e.status || 'ACTIVE',
        branch: e.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [e.branchId])[0] : { id: '', name: 'Unknown' }
      }));
      res.json({ success: true, data: { employees, pagination: { total: employees.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/employees/:id', authMiddleware, (req, res) => {
    try {
      const items = query('SELECT * FROM employees WHERE id = ? AND isActive = 1', [req.params.id]);
      if (!items.length) return res.status(404).json({ success: false, message: 'Employee not found' });
      res.json({ success: true, data: items[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/employees', authMiddleware, (req, res) => {
    try {
      console.log('[API] ========== EMPLOYEE CREATE REQUEST ==========');
      console.log('[API] ✅ SQLite operation starting (independent of PostgreSQL)');
      console.log('[Employees] POST request body:', req.body);
      const { name, email, phone, address, position, department, salary = 0, hireDate, branchId, companyId, employeeId,
              status = 'ACTIVE', emergencyContactName, emergencyContactPhone, emergencyContactRelation } = req.body;

      if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

      const id = uuid();
      const generatedEmployeeId = employeeId || `EMP-${Date.now()}`;
      const timestamp = now();

      console.log('[API] Inserting employee with:', { id, name, branchId, companyId, createdBy: req.user?.id, timestamp });

      const success = run(`INSERT INTO employees (id, name, email, phone, address, position, department, salary, hireDate, branchId, companyId, employeeId, status, createdBy, isActive, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        [id, name, email || null, phone || null, address || null, position || 'Staff', department || null, salary,
         hireDate || timestamp, branchId || null, companyId || null, generatedEmployeeId, status, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Employee INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        return res.status(500).json({ success: false, message: 'Failed to create employee. Please try again.' });
      }

      // Return with nested objects that frontend expects
      const e = query('SELECT * FROM employees WHERE id = ?', [id])[0];
      console.log('[API] Employee created and retrieved:', e ? 'SUCCESS' : 'NOT FOUND');

      if (!e) {
        console.error('[API] Employee inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Employee created but not found' });
      }

      const branch = e.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [e.branchId])[0] : { id: '', name: 'Unknown' };

      const employee = {
        ...e,
        employeeId: e.employeeId || generatedEmployeeId,
        status: e.status || 'ACTIVE',
        branch,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null
      };

      console.log('[Employees] Created employee successfully:', employee.id, employee.name);
      console.log('[API] ✅ Employee saved to SQLite successfully');

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL (non-blocking, optional)
      // CRITICAL: Wrap in try-catch to ensure sync errors never block response
      try {
        if (employee) {
          handleDataChange('employees', 'create', employee);
          console.log('[API] ✅ Sync queued (PostgreSQL sync is optional)');
        }
      } catch (syncError) {
        console.error('[API] ⚠️ Sync error (non-critical):', syncError.message);
        console.log('[API] ✅ Employee is saved in SQLite - sync will retry later');
      }

      console.log('[API] ========== EMPLOYEE CREATE SUCCESS ==========');
      res.status(201).json({ success: true, data: employee, message: 'Employee created successfully' });
    } catch (e) { console.error('[API] Employee create error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/employees/:id', authMiddleware, (req, res) => {
    try {
      const { name, email, phone, address, position, department, salary, hireDate } = req.body;
      const success = run(`UPDATE employees SET name = COALESCE(?, name), email = COALESCE(?, email), phone = COALESCE(?, phone),
           address = COALESCE(?, address), position = COALESCE(?, position), department = COALESCE(?, department),
           salary = COALESCE(?, salary), hireDate = COALESCE(?, hireDate), updatedAt = ? WHERE id = ?`,
        [name, email, phone, address, position, department, salary, hireDate, now(), req.params.id]);

      if (!success) {
        console.error('[API] Failed to update employee, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to update employee: ' + (lastDbError || 'Unknown error') });
      }

      const employee = query('SELECT * FROM employees WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (employee) handleDataChange('employees', 'update', employee);

      res.json({ success: true, data: employee, message: 'Employee updated successfully' });
    } catch (e) { console.error('[API] Employee update error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/employees/:id', authMiddleware, (req, res) => {
    try {
      const employee = query('SELECT * FROM employees WHERE id = ?', [req.params.id])[0];
      if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

      const success = run('UPDATE employees SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);
      if (!success) {
        console.error('[API] Failed to delete employee, lastDbError:', lastDbError);
        return res.status(500).json({ success: false, message: 'Failed to delete employee: ' + (lastDbError || 'Unknown error') });
      }

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (employee) handleDataChange('employees', 'update', { ...employee, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (e) { console.error('[API] Employee delete error:', e); res.status(500).json({ success: false, message: e.message }); }
  });

  // Employee statistics endpoint (matches main backend)
  app.get('/api/employees/stats', authMiddleware, (req, res) => {
    try {
      const { branchId, companyId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let whereClause = 'WHERE isActive = 1';
      const params = [];

      // Apply data isolation
      if (branchFilter && branchFilter !== 'must-select-branch' && branchFilter !== 'non-existent-branch-id') {
        whereClause += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        whereClause += ' AND companyId = ?';
        params.push(companyFilter);
      }
      if (createdBy) {
        whereClause += ' AND createdBy = ?';
        params.push(createdBy);
      }

      const totalEmployees = query(`SELECT COUNT(*) as count FROM employees ${whereClause}`, params)[0]?.count || 0;
      const activeEmployees = query(`SELECT COUNT(*) as count FROM employees ${whereClause} AND status = 'ACTIVE'`, params)[0]?.count || 0;
      const onLeaveEmployees = query(`SELECT COUNT(*) as count FROM employees ${whereClause} AND status = 'ON_LEAVE'`, params)[0]?.count || 0;
      const terminatedEmployees = query(`SELECT COUNT(*) as count FROM employees ${whereClause} AND status = 'TERMINATED'`, params)[0]?.count || 0;

      // Get employees by position
      const employeesByPosition = query(`SELECT position, COUNT(*) as count FROM employees ${whereClause} GROUP BY position`, params);

      // Get employees by department
      const employeesByDepartment = query(`SELECT department, COUNT(*) as count FROM employees ${whereClause} AND department IS NOT NULL GROUP BY department`, params);

      res.json({
        success: true,
        data: {
          totalEmployees,
          activeEmployees,
          onLeaveEmployees,
          terminatedEmployees,
          employeesByPosition: employeesByPosition.map(e => ({ position: e.position, count: e.count })),
          employeesByDepartment: employeesByDepartment.map(e => ({ department: e.department, count: e.count }))
        }
      });
    } catch (e) {
      console.error('[Employees] Stats error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Employee attendance, shifts, commissions
  app.get('/api/attendance', authMiddleware, (req, res) => {
    res.json({ success: true, data: { attendance: [] } });
  });

  app.get('/api/shifts', authMiddleware, (req, res) => {
    res.json({ success: true, data: { shifts: [] } });
  });

  app.get('/api/commissions', authMiddleware, (req, res) => {
    res.json({ success: true, data: { commissions: [] } });
  });

  app.post('/api/attendance', authMiddleware, (req, res) => {
    res.status(201).json({ success: true, data: { ...req.body, id: uuid() } });
  });

  app.post('/api/shifts', authMiddleware, (req, res) => {
    res.status(201).json({ success: true, data: { ...req.body, id: uuid() } });
  });

  app.post('/api/commissions', authMiddleware, (req, res) => {
    res.status(201).json({ success: true, data: { ...req.body, id: uuid() } });
  });

  // ==================== BATCHES ====================
  // Get batches for a product (used in POS)
  app.get('/api/products/:productId/batches', authMiddleware, (req, res) => {
    try {
      const { productId } = req.params;
      console.log('[Batches] Getting batches for product:', productId);

      // First check if product exists
      const product = query('SELECT * FROM products WHERE id = ?', [productId])[0];
      if (!product) {
        return res.json({ success: true, data: [] });
      }

      let batches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [productId]);

      // If no batches exist, auto-create one from product stock
      if (batches.length === 0 && product.quantity > 0) {
        console.log('[Batches] No batches found, auto-creating from product stock');
        const batchId = uuid();
        const batchNo = `AUTO-${Date.now()}`;
        const timestamp = now();
        const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        run(`INSERT INTO batches (id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, branchId, companyId, supplierId, isActive, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [batchId, batchNo, productId, product.quantity, timestamp, expiryDate, product.costPrice || 0, product.sellingPrice || product.unitPrice || 0, product.branchId, product.companyId, product.supplierId, timestamp, timestamp]);

        batches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [productId]);
      }

      const result = batches.map(b => ({
        ...b,
        id: b.id,
        batchNo: b.batchNumber,
        batchNumber: b.batchNumber,
        totalStock: b.quantity,
        quantity: b.quantity,
        expireDate: b.expiryDate,
        expiryDate: b.expiryDate,
        productionDate: b.manufacturingDate,
        purchasePrice: b.costPrice,
        costPrice: b.costPrice,
        sellingPrice: b.sellingPrice,
        product: product,
        supplier: b.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [b.supplierId])[0] : null
      }));

      console.log('[Batches] Returning', result.length, 'batches for product', productId);
      res.json({ success: true, data: result });
    } catch (e) {
      console.error('[Batches] Error getting product batches:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/batches', authMiddleware, (req, res) => {
    try {
      console.log('[Batches] GET - User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { productId, branchId, companyId, search } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM batches WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        // For ADMIN/SUPERADMIN without branch selection, show global items (branchId IS NULL)
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (branchId IS NULL OR branchId = "")';
        } else {
          sql += ' AND 1=0'; // Return no results - force branch selection
        }
      } else if (branchFilter) {
        // Branch is selected - show items for this branch AND global items (branchId IS NULL)
        sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
        params.push(branchFilter);
      } else {
        // No branch filter specified - show all items user has access to
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          // Show all items (no branch filter)
        } else if (req.user?.branchId) {
          sql += ' AND (branchId = ? OR branchId IS NULL OR branchId = "")';
          params.push(req.user.branchId);
        } else {
          sql += ' AND 1=0'; // No branch assigned - no access
        }
      }
      if (companyFilter) {
        sql += ' AND (companyId = ? OR companyId IS NULL OR companyId = "")';
        params.push(companyFilter);
      }
      // CRITICAL: Add createdBy filter for MANAGER/CASHIER/ADMIN (matches main backend)
      // But allow global items (createdBy IS NULL) for ADMIN/SUPERADMIN
      if (createdBy) {
        if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
          sql += ' AND (createdBy = ? OR createdBy IS NULL)';
        } else {
          sql += ' AND createdBy = ?';
        }
        params.push(createdBy);
      }
      if (productId) { sql += ' AND productId = ?'; params.push(productId); }
      if (search) { sql += ' AND batchNumber LIKE ?'; params.push(`%${search}%`); }
      sql += ' ORDER BY expiryDate ASC';

      const rawBatches = query(sql, params);
      console.log('[Batches] Found:', rawBatches.length);

      const batches = rawBatches.map(b => {
        const product = b.productId ? query('SELECT id, name, sku FROM products WHERE id = ?', [b.productId])[0] : null;
        const supplier = b.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [b.supplierId])[0] : null;
        const branch = b.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [b.branchId])[0] : null;

        return {
          ...b,
          batchNo: b.batchNumber,
          totalStock: b.quantity,
          expireDate: b.expiryDate,
          productionDate: b.manufacturingDate,
          product: product || { id: '', name: 'Unknown Product', sku: '' },
          supplier: supplier,
          branch: branch || { id: '', name: 'Unknown' }
        };
      });

      res.json({ success: true, data: { batches, pagination: { total: batches.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) {
      console.error('[API] Batches GET error:', e);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/batches/low-stock', authMiddleware, (req, res) => {
    try {
      const batches = query('SELECT * FROM batches WHERE isActive = 1 AND quantity <= 10').map(b => ({
        ...b,
        product: b.productId ? query('SELECT id, name, sku FROM products WHERE id = ?', [b.productId])[0] : null
      }));
      res.json({ success: true, data: { batches, pagination: { total: batches.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/batches/near-expiry', authMiddleware, (req, res) => {
    try {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const batches = query('SELECT * FROM batches WHERE isActive = 1 AND expiryDate <= ? AND quantity > 0', [thirtyDays]).map(b => ({
        ...b,
        product: b.productId ? query('SELECT id, name, sku FROM products WHERE id = ?', [b.productId])[0] : null
      }));
      res.json({ success: true, data: { batches, pagination: { total: batches.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/batches/:id', authMiddleware, (req, res) => {
    try {
      const b = query('SELECT * FROM batches WHERE id = ? AND isActive = 1', [req.params.id])[0];
      if (!b) return res.status(404).json({ success: false, message: 'Batch not found' });
      b.product = b.productId ? query('SELECT * FROM products WHERE id = ?', [b.productId])[0] : null;
      b.branch = b.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [b.branchId])[0] : null;
      res.json({ success: true, data: b });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/batches', authMiddleware, (req, res) => {
    try {
      console.log('[Batches] POST request body:', req.body);

      // Support both 'batchNumber' and 'batchNo' field names
      const batchNumber = req.body.batchNumber || req.body.batchNo;
      const { productId, supplierId, branchId, companyId } = req.body;

      // Support multiple quantity field names
      const quantity = parseInt(req.body.quantity || req.body.totalStock || req.body.stockQuantity || 0);
      const costPrice = parseFloat(req.body.costPrice || req.body.costPricePerUnit || 0);
      const sellingPrice = parseFloat(req.body.sellingPrice || req.body.sellingPricePerUnit || 0);
      const expiryDate = req.body.expiryDate || req.body.expireDate || null;
      const manufacturingDate = req.body.manufacturingDate || req.body.productionDate || null;

      if (!batchNumber || !productId) {
        console.log('[Batches] Missing required fields:', { batchNumber, productId });
        return res.status(400).json({ success: false, message: 'Batch number and product are required' });
      }

      // Check if product exists
      const productCheck = query('SELECT id, name FROM products WHERE id = ?', [productId]);
      if (!productCheck.length) {
        console.log('[Batches] Product not found:', productId);
        return res.status(400).json({ success: false, message: 'Product not found' });
      }

      const id = uuid();
      const timestamp = now();

      // Use user's branchId and companyId if not provided
      // For ADMIN/SUPERADMIN, allow null branchId (global batch) if no branch is selected
      // CRITICAL: Check for empty string BEFORE using || operator
      let finalBranchId = (branchId && branchId !== '') ? branchId : (req.user?.branchId && req.user.branchId !== '' ? req.user.branchId : null);
      let finalCompanyId = (companyId && companyId !== '') ? companyId : (req.user?.companyId && req.user.companyId !== '' ? req.user.companyId : null);

      // For ADMIN/SUPERADMIN, if no branch is selected, allow null (global batch)
      if (!finalBranchId && (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN')) {
        finalBranchId = null; // Global batch
      }

      // Clean up IDs
      const cleanSupplierId = (supplierId && supplierId.length > 10) ? supplierId : null;

      console.log('[Batches] Inserting batch with:', { id, batchNumber, productId, finalBranchId, finalCompanyId, createdBy: req.user?.id });

      const success = run(`INSERT INTO batches (id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, branchId, companyId, supplierId, isActive, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
        [id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, finalBranchId || null, finalCompanyId || null, cleanSupplierId, req.user?.id || null, timestamp, timestamp]);

      if (!success) {
        const errorMsg = lastDbError || 'Database operation failed';
        console.error('[API] ❌ Batch INSERT failed:', errorMsg);
        console.error('[API] Database state:', db ? 'initialized' : 'NOT INITIALIZED');
        return res.status(500).json({ success: false, message: 'Failed to create batch. Please try again.' });
      }

      // Update product quantity
      run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [quantity, productId]);

      const batch = query('SELECT * FROM batches WHERE id = ?', [id])[0];
      console.log('[Batches] Batch created and retrieved:', batch ? 'SUCCESS' : 'NOT FOUND');

      if (!batch) {
        console.error('[Batches] Batch inserted but not found in database');
        return res.status(500).json({ success: false, message: 'Batch created but not found' });
      }

      if (!batch) {
        return res.status(500).json({ success: false, message: 'Batch created but not found' });
      }

      const product = batch.productId ? query('SELECT id, name, sku FROM products WHERE id = ?', [batch.productId])[0] : null;
      const supplier = batch.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [batch.supplierId])[0] : null;

      // Return with expected field names
      const response = {
        ...batch,
        batchNo: batch.batchNumber,  // Frontend expects batchNo
        product: product || { id: '', name: 'Unknown', sku: '' },
        supplier,
        totalStock: batch.quantity,
        expireDate: batch.expiryDate,
        productionDate: batch.manufacturingDate
      };

      console.log('[Batches] Created batch successfully:', response.id, response.batchNumber);

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (batch) handleDataChange('batches', 'create', batch);

      res.status(201).json({ success: true, data: response, message: 'Batch created successfully' });
    } catch (e) {
      console.error('[API] Batch create error:', e.message, e.stack);
      res.status(500).json({ success: false, message: 'Error creating batch: ' + e.message });
    }
  });

  app.put('/api/batches/:id', authMiddleware, (req, res) => {
    try {
      const { quantity, expiryDate, costPrice, sellingPrice } = req.body;
      run(`UPDATE batches SET quantity = COALESCE(?, quantity), expiryDate = COALESCE(?, expiryDate),
           costPrice = COALESCE(?, costPrice), sellingPrice = COALESCE(?, sellingPrice), updatedAt = ? WHERE id = ?`,
        [quantity, expiryDate, costPrice, sellingPrice, now(), req.params.id]);
      const batch = query('SELECT * FROM batches WHERE id = ?', [req.params.id])[0];
      batch.product = batch.productId ? query('SELECT id, name, sku FROM products WHERE id = ?', [batch.productId])[0] : null;

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (batch) handleDataChange('batches', 'update', batch);

      res.json({ success: true, data: batch, message: 'Batch updated' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.delete('/api/batches/:id', authMiddleware, (req, res) => {
    try {
      const batch = query('SELECT * FROM batches WHERE id = ?', [req.params.id])[0];
      run('UPDATE batches SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (batch) handleDataChange('batches', 'update', { ...batch, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'Batch deleted' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Restock batch endpoint (matches main backend)
  app.post('/api/batches/:id/restock', authMiddleware, (req, res) => {
    try {
      const { quantity, costPrice, sellingPrice } = req.body;
      const batch = query('SELECT * FROM batches WHERE id = ?', [req.params.id])[0];

      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }

      const newQuantity = (batch.quantity || 0) + (parseInt(quantity) || 0);
      const finalCostPrice = costPrice !== undefined ? parseFloat(costPrice) : batch.costPrice;
      const finalSellingPrice = sellingPrice !== undefined ? parseFloat(sellingPrice) : batch.sellingPrice;

      run(`UPDATE batches SET quantity = ?, costPrice = ?, sellingPrice = ?, updatedAt = ? WHERE id = ?`,
        [newQuantity, finalCostPrice, finalSellingPrice, now(), req.params.id]);

      // Update product stock
      run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [parseInt(quantity) || 0, batch.productId]);

      const updatedBatch = query('SELECT * FROM batches WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (updatedBatch) handleDataChange('batches', 'update', updatedBatch);

      res.json({ success: true, data: updatedBatch, message: 'Batch restocked successfully' });
    } catch (e) {
      console.error('[Batches] Restock error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== SALES ====================
  app.get('/api/sales', authMiddleware, (req, res) => {
    try {
      console.log('[Sales] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { startDate, endDate, branchId, companyId, customerId, paymentMethod, limit = 500 } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM sales WHERE 1=1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }
      if (customerId && customerId !== 'undefined') { sql += ' AND customerId = ?'; params.push(customerId); }
      if (paymentMethod && paymentMethod !== 'all') { sql += ' AND paymentMethod = ?'; params.push(paymentMethod); }
      if (startDate) { sql += ' AND createdAt >= ?'; params.push(startDate); }
      if (endDate) { sql += ' AND createdAt <= ?'; params.push(endDate); }
      sql += ` ORDER BY createdAt DESC LIMIT ${parseInt(limit) || 500}`;

      const rawSales = query(sql, params);
      console.log('[Sales] Found sales:', rawSales.length);

      const sales = rawSales.map(s => {
        const customer = s.customerId ? query('SELECT id, name, phone, email FROM customers WHERE id = ?', [s.customerId])[0] : null;
        const branch = s.branchId ? query('SELECT id, name, address FROM branches WHERE id = ?', [s.branchId])[0] : null;
        const user = s.createdBy ? query('SELECT id, name, email as username FROM users WHERE id = ?', [s.createdBy])[0] : { id: '', name: 'System', username: 'system' };
        const items = query('SELECT * FROM sale_items WHERE saleId = ?', [s.id]).map(item => {
          const product = query('SELECT id, name, unitPrice FROM products WHERE id = ?', [item.productId])[0];
          return {
            ...item,
            totalPrice: item.total,
            product: product || { id: item.productId, name: 'Unknown', unitType: 'PIECE' }
          };
        });

        return {
          ...s,
          subtotal: s.totalAmount,
          taxAmount: s.tax,
          discountAmount: s.discount,
          totalAmount: s.grandTotal,
          customer,
          branch: branch || { id: '', name: 'Default', address: '' },
          user: user || { id: '', name: 'Unknown', username: 'unknown' },
          items,
          receiptNumber: s.receiptNumber || s.invoiceNumber
        };
      });

      res.json({ success: true, data: { sales, pagination: { total: sales.length, page: 1, limit: parseInt(limit) || 500, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/sales/:id', authMiddleware, (req, res) => {
    try {
      const s = query('SELECT * FROM sales WHERE id = ?', [req.params.id])[0];
      if (!s) return res.status(404).json({ success: false, message: 'Sale not found' });

      const customer = s.customerId ? query('SELECT * FROM customers WHERE id = ?', [s.customerId])[0] : null;
      const branch = s.branchId ? query('SELECT * FROM branches WHERE id = ?', [s.branchId])[0] : null;
      const user = s.createdBy ? query('SELECT id, name, email as username FROM users WHERE id = ?', [s.createdBy])[0] : null;
      const items = query('SELECT * FROM sale_items WHERE saleId = ?', [s.id]).map(item => {
        const product = query('SELECT * FROM products WHERE id = ?', [item.productId])[0];
        return { ...item, totalPrice: item.total, product: product || { id: item.productId, name: 'Unknown', unitType: 'PIECE' } };
      });

      res.json({ success: true, data: {
        ...s, subtotal: s.totalAmount, taxAmount: s.tax, discountAmount: s.discount,
        customer, branch, user, items, receipts: [{ id: s.id, receiptNumber: s.invoiceNumber }]
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/sales', authMiddleware, (req, res) => {
    try {
      console.log('[Sales] POST request body:', JSON.stringify(req.body, null, 2));

      const { customerId, customerName, customerPhone, customerEmail, branchId, companyId, items = [], discount = 0, discountAmount = 0, discountPercentage = 0, tax = 0, paymentMethod = 'CASH', notes, saleDate } = req.body;

      if (!items.length) {
        return res.status(400).json({ success: false, message: 'At least one item is required' });
      }

      const id = uuid();
      const invoiceNumber = `INV-${Date.now()}`;
      const receiptNumber = `RCP-${Date.now()}`;
      const timestamp = now();

      // Use user's branch/company if not provided
      const finalBranchId = branchId || req.user?.branchId;
      const finalCompanyId = companyId || req.user?.companyId;

      // Auto-create customer if name/phone provided but no customerId
      let finalCustomerId = customerId;
      if (!customerId && (customerName || customerPhone)) {
        // Check if customer already exists by phone
        let existingCustomer = null;
        if (customerPhone) {
          // First try to find in same company
          if (finalCompanyId) {
            existingCustomer = query('SELECT id FROM customers WHERE phone = ? AND companyId = ?', [customerPhone, finalCompanyId])[0];
          }
          // If not found, check globally
          if (!existingCustomer) {
            existingCustomer = query('SELECT id FROM customers WHERE phone = ?', [customerPhone])[0];
          }
        }

        if (existingCustomer) {
          finalCustomerId = existingCustomer.id;
          console.log('[Sales] Found existing customer:', existingCustomer.id);
        } else if (customerName) {
          // Create new customer with COMPANY ID (branchId is optional)
          const newCustomerId = uuid();
          const insertSuccess = run(`INSERT INTO customers (id, name, email, phone, branchId, companyId, loyaltyPoints, createdBy, isActive, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?)`,
            [newCustomerId, customerName, customerEmail || null, customerPhone || null, finalBranchId || null, finalCompanyId || null, req.user?.id || null, timestamp, timestamp]);

          if (insertSuccess) {
            finalCustomerId = newCustomerId;
            console.log('[Sales] ✅ Auto-created customer:', newCustomerId, customerName, 'Company:', finalCompanyId);
          } else {
            console.error('[Sales] ❌ Failed to create customer');
          }
        }
      }

      let subtotal = 0;
      items.forEach(i => {
        const price = i.unitPrice || i.price || i.sellingPrice || 0;
        subtotal += (i.quantity || 1) * price;
      });

      const finalDiscount = discountAmount || (discountPercentage ? (subtotal * discountPercentage / 100) : discount);
      const taxAmount = tax || 0;
      const grandTotal = subtotal - finalDiscount + taxAmount;

      console.log('[Sales] Creating sale:', { id, invoiceNumber, subtotal, grandTotal, itemsCount: items.length, customerId: finalCustomerId });

      const success = run(`INSERT INTO sales (id, invoiceNumber, receiptNumber, customerId, branchId, companyId, totalAmount, discount, tax, grandTotal, paymentMethod, paymentStatus, status, notes, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, invoiceNumber, receiptNumber, finalCustomerId || null, finalBranchId || null, finalCompanyId || null, subtotal, finalDiscount, taxAmount, grandTotal, paymentMethod, 'PAID', 'COMPLETED', notes || null, req.user?.id, saleDate || timestamp, timestamp]);

      if (!success) {
        console.error('[Sales] Failed to insert sale');
        return res.status(500).json({ success: false, message: 'Failed to create sale' });
      }

      const saleItems = items.map(i => {
        const itemId = uuid();
        const price = i.unitPrice || i.price || i.sellingPrice || 0;
        const quantity = i.quantity || 1;
        const total = quantity * price;

        run('INSERT INTO sale_items (id, saleId, productId, quantity, unitPrice, discount, total, createdAt) VALUES (?,?,?,?,?,?,?,?)',
          [itemId, id, i.productId, quantity, price, i.discount || 0, total, timestamp]);

        // Update product stock
        run('UPDATE products SET quantity = quantity - ? WHERE id = ?', [quantity, i.productId]);

        // Also update batch stock if batchId is provided
        if (i.batchId) {
          run('UPDATE batches SET quantity = quantity - ? WHERE id = ?', [quantity, i.batchId]);
        }

        const product = query('SELECT id, name, unitPrice, sellingPrice FROM products WHERE id = ?', [i.productId])[0];
        return {
          id: itemId,
          productId: i.productId,
          quantity: quantity,
          unitPrice: price,
          totalPrice: total,
          product: product || { id: i.productId, name: i.name || 'Unknown', unitType: 'PIECE' }
        };
      });

      // Update customer loyalty points if exists
      if (finalCustomerId) {
        run('UPDATE customers SET loyaltyPoints = loyaltyPoints + ? WHERE id = ?', [Math.floor(grandTotal / 100), finalCustomerId]);
      }

      const customer = finalCustomerId ? query('SELECT * FROM customers WHERE id = ?', [finalCustomerId])[0] : null;

      console.log('[Sales] Created sale successfully:', id);

      // 🔄 TWO-WAY SYNC: Queue sale and sale_items for sync to PostgreSQL
      const saleData = query('SELECT * FROM sales WHERE id = ?', [id])[0];
      if (saleData) handleDataChange('sales', 'create', saleData);
      saleItems.forEach(item => handleDataChange('sale_items', 'create', item));

      res.status(201).json({
        success: true,
        data: {
          id,
          invoiceNumber,
          receiptNumber,
          customer,
          items: saleItems,
          subtotal,
          taxAmount,
          discountAmount: finalDiscount,
          totalAmount: grandTotal,
          grandTotal,
          paymentMethod,
          paymentStatus: 'PAID',
          status: 'COMPLETED',
          createdAt: timestamp
        },
        message: 'Sale created successfully'
      });
    } catch (e) {
      console.error('[Sales] Create error:', e.message, e.stack);
      res.status(500).json({ success: false, message: 'Failed to create sale: ' + e.message });
    }
  });

  app.put('/api/sales/:id', authMiddleware, (req, res) => {
    try {
      const { discountPercentage, saleDate, notes, paymentStatus } = req.body;
      const updates = [];
      const params = [];

      if (discountPercentage !== undefined) { updates.push('discount = ?'); params.push(discountPercentage); }
      if (saleDate) { updates.push('createdAt = ?'); params.push(saleDate); }
      if (notes) { updates.push('notes = ?'); params.push(notes); }
      if (paymentStatus) { updates.push('paymentStatus = ?'); params.push(paymentStatus); }

      if (updates.length) {
        params.push(now(), req.params.id);
        run(`UPDATE sales SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`, params);
      }

      const sale = query('SELECT * FROM sales WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (sale) handleDataChange('sales', 'update', sale);

      res.json({ success: true, data: sale });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== USERS ====================
  app.get('/api/users', authMiddleware, (req, res) => {
    try {
      console.log('[Users] GET - User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { branchId, companyId, role, search } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT id, email, name, role, phone, companyId, branchId, isActive, createdAt, updatedAt FROM users WHERE isActive = 1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }
      if (role) { sql += ' AND role = ?'; params.push(role); }
      if (search) { sql += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
      sql += ' ORDER BY name';

      const users = query(sql, params).map(u => ({
        ...u,
        username: u.email,
        branch: u.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [u.branchId])[0] : null
      }));
      console.log('[Users] Found:', users.length);
      res.json({ success: true, data: { users, pagination: { total: users.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/users', authMiddleware, async (req, res) => {
    try {
      const { email, username, password, name, role = 'CASHIER', branchId, companyId } = req.body;
      const userEmail = (email || username || '').toLowerCase().trim();

      if (!userEmail || !password || !name) {
        return res.status(400).json({ success: false, message: 'Email, password, and name are required' });
      }

      // Check if user already exists
      const existing = query('SELECT id FROM users WHERE LOWER(email) = ?', [userEmail]);
      if (existing.length) {
        return res.status(400).json({ success: false, message: 'User with this email already exists' });
      }

      const finalBranchId = branchId || req.user?.branchId;
      const finalCompanyId = companyId || req.user?.companyId;
      const id = uuid();
      const timestamp = now();
      const hashedPassword = await hashPassword(password);

      // Try multiple INSERT strategies
      let insertSuccess = false;
      let insertError = '';

      const strategies = [
        { sql: 'INSERT INTO users (id, username, email, password, name, role, branchId, companyId, isActive, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,0,?,?,?)',
          params: [id, userEmail, userEmail, hashedPassword, name, role, finalBranchId, finalCompanyId, req.user?.id || null, timestamp, timestamp] },
        { sql: 'INSERT INTO users (id, email, password, name, role, branchId, companyId, isActive, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,0,?,?,?)',
          params: [id, userEmail, hashedPassword, name, role, finalBranchId, finalCompanyId, req.user?.id || null, timestamp, timestamp] },
        { sql: 'INSERT INTO users (id, email, password, name, role, isActive, createdAt, updatedAt) VALUES (?,?,?,?,?,0,?,?)',
          params: [id, userEmail, hashedPassword, name, role, timestamp, timestamp] }
      ];

      for (let i = 0; i < strategies.length; i++) {
        try {
          db.run(strategies[i].sql, strategies[i].params);
          saveDatabase();
          insertSuccess = true;
          break;
        } catch (e) {
          insertError = e.message;
        }
      }

      if (!insertSuccess) {
        return res.status(500).json({ success: false, message: 'Failed to create user: ' + insertError });
      }

      const user = query('SELECT id, email, name, role, branchId, companyId, isActive, createdAt FROM users WHERE id = ?', [id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (user) handleDataChange('users', 'create', user);

      res.status(201).json({ success: true, data: user, message: 'User created successfully' });
    } catch (e) {
      console.error('[Users] Create error:', e.message);
      res.status(500).json({ success: false, message: 'Server error: ' + e.message });
    }
  });

  app.get('/api/users/:id', authMiddleware, (req, res) => {
    try {
      const user = query('SELECT id, email, name, role, phone, branchId, companyId, isActive, createdAt, updatedAt FROM users WHERE id = ?', [req.params.id])[0];
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      user.branch = user.branchId ? query('SELECT id, name FROM branches WHERE id = ?', [user.branchId])[0] : null;
      res.json({ success: true, data: user });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/users/:id', authMiddleware, async (req, res) => {
    try {
      console.log('[Users] PUT request for id:', req.params.id, 'body:', req.body);
      const { name, email, role, phone, branchId, companyId, isActive, password } = req.body;
      const updates = [];
      const params = [];

      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (email !== undefined) { updates.push('email = ?'); params.push(email.toLowerCase()); }
      if (role !== undefined) { updates.push('role = ?'); params.push(role); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (branchId !== undefined) { updates.push('branchId = ?'); params.push(branchId); }
      if (companyId !== undefined) { updates.push('companyId = ?'); params.push(companyId); }
      if (isActive !== undefined) { updates.push('isActive = ?'); params.push(isActive ? 1 : 0); }
      if (password) {
        const hashedPassword = await hashPassword(password);
        updates.push('password = ?');
        params.push(hashedPassword);
      }

      if (updates.length) {
        params.push(now(), req.params.id);
        run(`UPDATE users SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`, params);
      }

      const user = query('SELECT id, email, name, role, phone, branchId, companyId, isActive, createdAt, updatedAt FROM users WHERE id = ?', [req.params.id])[0];
      console.log('[Users] Updated user:', user?.id);

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (user) handleDataChange('users', 'update', user);

      res.json({ success: true, data: user, message: 'User updated successfully' });
    } catch (e) {
      console.error('[Users] Update error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete('/api/users/:id', authMiddleware, (req, res) => {
    try {
      const user = query('SELECT * FROM users WHERE id = ?', [req.params.id])[0];
      run('UPDATE users SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), req.params.id]);

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (user) handleDataChange('users', 'update', { ...user, isActive: 0, updatedAt: now() });

      res.json({ success: true, message: 'User deleted successfully' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // User activation endpoint (matches main backend) - SUPERADMIN only
  app.patch('/api/users/:id/activate', authMiddleware, async (req, res) => {
    try {
      // Only SUPERADMIN can activate users
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({ success: false, message: 'Only SuperAdmin can activate users' });
      }

      const { isActive } = req.body;
      const user = query('SELECT * FROM users WHERE id = ?', [req.params.id])[0];

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Update isActive status
      run('UPDATE users SET isActive = ?, updatedAt = ? WHERE id = ?', [isActive ? 1 : 0, now(), req.params.id]);

      const updatedUser = query('SELECT id, email, name, role, branchId, companyId, isActive, createdAt, updatedAt FROM users WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (updatedUser) handleDataChange('users', 'update', updatedUser);

      res.json({
        success: true,
        data: updatedUser,
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (e) {
      console.error('[Users] Activate error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== DASHBOARD ====================
  app.get('/api/dashboard/stats', authMiddleware, (req, res) => {
    try {
      console.log('[Dashboard/Stats] User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { branchId, companyId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      // Build WHERE clauses
      let productWhere = 'WHERE isActive = 1';
      let customerWhere = 'WHERE isActive = 1';
      let salesWhere = 'WHERE 1=1';
      let purchaseWhere = "WHERE status != 'DELETED'";

      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        productWhere += ` AND 1=0`;
        customerWhere += ` AND 1=0`;
        salesWhere += ` AND 1=0`;
        purchaseWhere += ` AND 1=0`;
      } else if (branchFilter) {
        productWhere += ` AND branchId = '${branchFilter}'`;
        customerWhere += ` AND branchId = '${branchFilter}'`;
        salesWhere += ` AND branchId = '${branchFilter}'`;
        purchaseWhere += ` AND branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        productWhere += ` AND companyId = '${companyFilter}'`;
        customerWhere += ` AND companyId = '${companyFilter}'`;
        salesWhere += ` AND companyId = '${companyFilter}'`;
        purchaseWhere += ` AND companyId = '${companyFilter}'`;
      }

      const today = new Date().toISOString().split('T')[0];

      const stats = {
        totalProducts: query(`SELECT COUNT(*) as c FROM products ${productWhere}`)[0]?.c || 0,
        totalCustomers: query(`SELECT COUNT(*) as c FROM customers ${customerWhere}`)[0]?.c || 0,
        totalSales: query(`SELECT COUNT(*) as c FROM sales ${salesWhere}`)[0]?.c || 0,
        totalRevenue: query(`SELECT SUM(grandTotal) as t FROM sales ${salesWhere}`)[0]?.t || 0,
        todaySales: query(`SELECT COUNT(*) as c FROM sales ${salesWhere} AND DATE(createdAt) = '${today}'`)[0]?.c || 0,
        todayRevenue: query(`SELECT SUM(grandTotal) as t FROM sales ${salesWhere} AND DATE(createdAt) = '${today}'`)[0]?.t || 0,
        lowStockProducts: query(`SELECT COUNT(*) as c FROM products ${productWhere} AND quantity <= minStock`)[0]?.c || 0,
        outOfStock: query(`SELECT COUNT(*) as c FROM products ${productWhere} AND quantity = 0`)[0]?.c || 0,
        pendingOrders: query(`SELECT COUNT(*) as c FROM purchases ${purchaseWhere} AND status = 'PENDING'`)[0]?.c || 0
      };

      console.log('[Dashboard/Stats] Returning stats:', stats);
      res.json({ success: true, data: stats });
    } catch (e) {
      console.error('[Dashboard/Stats] Error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/dashboard/chart', authMiddleware, (req, res) => {
    try {
      console.log('[Dashboard/Chart] User:', req.user?.email, 'Period:', req.query.period);
      const { period = 'week', branchId, companyId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        whereClause += ` AND 1=0`; // Return no results
      } else if (branchFilter) {
        whereClause += ` AND branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        whereClause += ` AND companyId = '${companyFilter}'`;
      }

      // Determine date range based on period
      let days;
      let startDate;
      const today = new Date();

      switch(period) {
        case 'today':
          days = 1;
          startDate = new Date().toISOString().split('T')[0];
          break;
        case 'week':
        case 'this_week':
        case '7days':
          days = 7;
          startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'month':
        case 'this_month':
        case '30days':
          days = 30;
          startDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'year':
        case 'this_year':
          days = 365;
          startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
          break;
        default:
          days = 7;
          startDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const data = [];

      // Generate data points
      for (let i = Math.min(days, 30) - 1; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const result = query(`SELECT SUM(grandTotal) as total, COUNT(*) as count FROM sales ${whereClause} AND DATE(createdAt) = '${date}'`)[0];

        data.push({
          date,
          sales: result?.total || 0,
          revenue: result?.total || 0,
          orders: result?.count || 0,
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        });
      }

      // Summary for the period
      const summary = query(`SELECT SUM(grandTotal) as totalRevenue, COUNT(*) as totalOrders FROM sales ${whereClause} AND DATE(createdAt) >= '${startDate}'`)[0];

      console.log('[Dashboard/Chart] Returning', data.length, 'data points, Summary:', summary);

      res.json({
        success: true,
        data,
        summary: {
          totalRevenue: summary?.totalRevenue || 0,
          totalOrders: summary?.totalOrders || 0,
          averageOrder: summary?.totalOrders > 0 ? (summary?.totalRevenue / summary?.totalOrders) : 0
        }
      });
    } catch (e) {
      console.error('[Dashboard/Chart] Error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/dashboard/admin-stats', authMiddleware, (req, res) => {
    try {
      res.json({ success: true, data: {
        totalCompanies: query('SELECT COUNT(*) as c FROM companies WHERE isActive = 1')[0]?.c || 0,
        totalBranches: query('SELECT COUNT(*) as c FROM branches WHERE isActive = 1')[0]?.c || 0,
        totalUsers: query('SELECT COUNT(*) as c FROM users WHERE isActive = 1')[0]?.c || 0,
        totalProducts: query('SELECT COUNT(*) as c FROM products WHERE isActive = 1')[0]?.c || 0
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== REPORTS ====================
  app.get('/api/reports/sales', authMiddleware, (req, res) => {
    try {
      res.json({ success: true, data: query('SELECT * FROM sales ORDER BY createdAt DESC LIMIT 100') });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/reports/inventory', authMiddleware, (req, res) => {
    try {
      res.json({ success: true, data: query('SELECT * FROM products WHERE isActive = 1 ORDER BY quantity ASC') });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== INVENTORY ====================
  app.get('/api/inventory/summary', authMiddleware, (req, res) => {
    try {
      res.json({ success: true, data: {
        totalProducts: query('SELECT COUNT(*) as c FROM products WHERE isActive = 1')[0]?.c || 0,
        totalValue: query('SELECT SUM(quantity * costPrice) as v FROM products WHERE isActive = 1')[0]?.v || 0,
        lowStock: query('SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND quantity <= minStock')[0]?.c || 0,
        outOfStock: query('SELECT COUNT(*) as c FROM products WHERE isActive = 1 AND quantity = 0')[0]?.c || 0
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== INVENTORY BATCHES (for POS/CreateInvoice) ====================
  app.get('/api/inventory/batches', authMiddleware, (req, res) => {
    try {
      console.log('[Inventory/Batches] GET request with params:', req.query);
      const { productId, branchId, expired, limit = 100 } = req.query;

      if (!productId) {
        return res.status(400).json({ success: false, message: 'productId is required' });
      }

      // First check if product exists
      const product = query('SELECT * FROM products WHERE id = ?', [productId])[0];
      if (!product) {
        return res.json({ success: true, data: [] });
      }

      // Get batches for this product
      let batches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [productId]);

      // Auto-create batch if none exists and product has stock
      if (batches.length === 0 && product.quantity > 0) {
        console.log('[Inventory/Batches] Auto-creating batch for product:', productId);
        const batchId = uuid();
        const batchNo = `AUTO-${Date.now()}`;
        const timestamp = now();
        const expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        run(`INSERT INTO batches (id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, branchId, companyId, supplierId, isActive, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [batchId, batchNo, productId, product.quantity, timestamp, expiryDate, product.costPrice || 0, product.sellingPrice || product.unitPrice || 0, product.branchId, product.companyId, product.supplierId, timestamp, timestamp]);

        batches = query('SELECT * FROM batches WHERE productId = ? AND isActive = 1 ORDER BY expiryDate ASC', [productId]);
      }

      // Filter expired if requested
      const now_date = new Date();
      let filteredBatches = batches;
      if (expired === 'false') {
        filteredBatches = batches.filter(b => {
          if (!b.expiryDate) return true;
          return new Date(b.expiryDate) > now_date;
        });
      }

      const result = filteredBatches.map(b => {
        const expiryDateObj = b.expiryDate ? new Date(b.expiryDate) : null;
        const daysUntilExpiry = expiryDateObj ? Math.ceil((expiryDateObj.getTime() - now_date.getTime()) / (1000 * 60 * 60 * 24)) : null;

        let expiryStatus = 'valid';
        if (daysUntilExpiry !== null) {
          if (daysUntilExpiry <= 0) expiryStatus = 'expired';
          else if (daysUntilExpiry <= 30) expiryStatus = 'expiring_soon';
          else if (daysUntilExpiry <= 90) expiryStatus = 'warning';
        }

        return {
          id: b.id,
          batchNo: b.batchNumber,
          batchNumber: b.batchNumber,
          quantity: b.quantity,
          totalStock: b.quantity,
          sellingPrice: b.sellingPrice,
          costPrice: b.costPrice,
          expireDate: b.expiryDate,
          expiryDate: b.expiryDate,
          manufacturingDate: b.manufacturingDate,
          productionDate: b.manufacturingDate,
          expiryStatus,
          daysUntilExpiry,
          productId: b.productId,
          product: { id: product.id, name: product.name, sku: product.sku }
        };
      });

      console.log('[Inventory/Batches] Returning', result.length, 'batches for product', productId);
      res.json({ success: true, data: result });
    } catch (e) {
      console.error('[Inventory/Batches] Error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== SETTINGS ====================
  app.get('/api/settings', authMiddleware, (req, res) => {
    try {
      const settings = query('SELECT * FROM settings');
      const obj = {};
      settings.forEach(s => { obj[s.key] = s.value; });
      res.json({ success: true, data: obj });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.put('/api/settings', authMiddleware, (req, res) => {
    try {
      const createdBy = req.user?.createdBy || req.user?.id;
      if (!createdBy) {
        return res.status(401).json({ success: false, message: 'Admin ID not found' });
      }

      Object.entries(req.body).forEach(([key, value]) => {
        // Check if setting exists for this admin
        const exists = query('SELECT id FROM settings WHERE key = ? AND createdBy = ?', [key, createdBy]);
        if (exists.length) {
          run('UPDATE settings SET value = ?, updatedAt = ? WHERE key = ? AND createdBy = ?', [value, now(), key, createdBy]);
          const setting = query('SELECT * FROM settings WHERE key = ? AND createdBy = ?', [key, createdBy])[0];
          // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
          if (setting) handleDataChange('settings', 'update', setting);
        } else {
          const id = uuid();
          run('INSERT INTO settings (id, key, value, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?)', [id, key, value, createdBy, now(), now()]);
          const setting = query('SELECT * FROM settings WHERE id = ?', [id])[0];
          // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
          if (setting) handleDataChange('settings', 'create', setting);
        }
      });
      res.json({ success: true, message: 'Settings updated' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Get tax rate endpoint (matches main backend)
  app.get('/api/settings/tax-rate', authMiddleware, (req, res) => {
    try {
      const createdBy = req.user?.createdBy || req.user?.id;
      if (!createdBy) {
        return res.status(401).json({ success: false, message: 'Admin ID not found' });
      }

      // Get tax rate setting for this admin
      const taxSetting = query('SELECT value FROM settings WHERE key = ? AND createdBy = ?', ['defaultTax', createdBy])[0];
      const taxRate = taxSetting ? parseFloat(taxSetting.value) : 0; // Default to 0% if not set

      res.json({
        success: true,
        data: { taxRate }
      });
    } catch (e) {
      console.error('[Settings] Get tax rate error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== STOCK MOVEMENTS ====================
  app.get('/api/products/stock-movements', authMiddleware, (req, res) => {
    try {
      // Return empty array since we don't track movements yet
      res.json({ success: true, data: { stockMovements: [], pagination: { total: 0, page: 1, limit: 50, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.patch('/api/products/:id/stock', authMiddleware, (req, res) => {
    try {
      const { type, quantity, reason } = req.body;
      const product = query('SELECT * FROM products WHERE id = ?', [req.params.id])[0];
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

      let newQuantity = product.quantity;
      if (type === 'IN') newQuantity += quantity;
      else if (type === 'OUT') newQuantity -= quantity;
      else if (type === 'ADJUSTMENT') newQuantity = quantity;

      run('UPDATE products SET quantity = ?, updatedAt = ? WHERE id = ?', [newQuantity, now(), req.params.id]);
      const updated = query('SELECT * FROM products WHERE id = ?', [req.params.id])[0];
      updated.stock = updated.quantity;

      // 🔄 TWO-WAY SYNC: Queue stock update for sync
      if (updated) handleDataChange('products', 'update', updated);

      // Also create a stock movement record
      const movementId = uuid();
      const timestamp = now();
      run(`INSERT INTO stock_movements (id, productId, type, quantity, reason, branchId, companyId, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [movementId, req.params.id, type, quantity, reason || null, product.branchId, product.companyId, req.user?.id, timestamp, timestamp]);
      const movement = query('SELECT * FROM stock_movements WHERE id = ?', [movementId])[0];
      if (movement) handleDataChange('stock_movements', 'create', movement);

      res.json({ success: true, data: updated });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== TWO-WAY SYNC ENDPOINTS ====================

  // Get comprehensive sync status
  app.get('/api/sync/status', authMiddleware, async (req, res) => {
    try {
      const online = await checkPostgreSQLConnection();
      res.json({
        success: true,
        data: {
          isOnline: online,
          lastSync: lastSyncTime,
          pendingChanges: offlineQueue.filter(q => !q.synced).length,
          queueSize: offlineQueue.length,
          status: syncInProgress ? 'syncing' : (online ? 'connected' : 'offline'),
          syncInProgress: syncInProgress,
          postgresqlUrl: REMOTE_DATABASE_URL ? 'configured' : 'not configured',
          config: {
            pollInterval: SYNC_CONFIG.POLL_INTERVAL,
            sourceOfTruth: 'PostgreSQL',
            conflictResolution: 'PostgreSQL wins'
          }
        }
      });
    } catch (e) {
      res.json({
        success: true,
        data: { isOnline: false, lastSync: null, status: 'offline', queueSize: offlineQueue.length }
      });
    }
  });

  // Trigger manual PUSH to PostgreSQL
  app.post('/api/sync/push', authMiddleware, async (req, res) => {
    try {
      console.log('[Sync] Manual PUSH triggered');

      // First process offline queue
      const queueResult = await processOfflineQueue();

      // Then push all tables
      const pushResult = await syncAllToPostgreSQL();

      res.json({
        success: pushResult.success,
        data: {
          ...pushResult,
          queueProcessed: queueResult.processed,
          queueFailed: queueResult.failed,
          queueRemaining: queueResult.remaining || 0
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Trigger manual PULL from PostgreSQL (source of truth)
  app.post('/api/sync/pull', authMiddleware, async (req, res) => {
    try {
      const { full } = req.body;  // full=true for full comparison sync
      console.log(`[Sync] Manual PULL triggered (${full ? 'FULL compare' : 'smart'})`);

      const result = await pullAllFromPostgreSQL(full === true);

      res.json({
        success: result.success,
        data: result
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Trigger full bidirectional sync
  app.post('/api/sync/full', authMiddleware, async (req, res) => {
    try {
      console.log('[Sync] Full BIDIRECTIONAL sync triggered');

      // Step 1: PULL from PostgreSQL first (source of truth) - FULL comparison
      const pullResult = await pullAllFromPostgreSQL(true);

      // Step 2: Process offline queue
      const queueResult = await processOfflineQueue();

      // Step 3: PUSH local changes
      const pushResult = await syncAllToPostgreSQL();

      res.json({
        success: true,
        data: {
          pull: pullResult,
          queue: queueResult,
          push: pushResult
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Legacy endpoint for backwards compatibility
  app.post('/api/sync/to-postgresql', authMiddleware, async (req, res) => {
    try {
      console.log('[Sync] Manual sync triggered (legacy)');
      const result = await syncAllToPostgreSQL();
      res.json({ success: result.success, data: result });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Check PostgreSQL connectivity
  app.get('/api/sync/check-connectivity', authMiddleware, async (req, res) => {
    try {
      const online = await checkPostgreSQLConnection();
      res.json({
        success: true,
        data: {
          isOnline: online,
          postgresqlUrl: REMOTE_DATABASE_URL ? 'SET' : 'NOT SET',
          lastCheck: now(),
          queueSize: offlineQueue.length
        }
      });
    } catch (e) {
      res.json({ success: false, data: { isOnline: false }, message: e.message });
    }
  });

  // Get offline queue status
  app.get('/api/sync/queue', authMiddleware, (req, res) => {
    try {
      const pending = offlineQueue.filter(q => !q.synced);
      res.json({
        success: true,
        data: {
          total: offlineQueue.length,
          pending: pending.length,
          items: pending.slice(0, 50).map(q => ({
            id: q.id,
            table: q.tableName,
            operation: q.operation,
            timestamp: q.timestamp,
            retries: q.retries
          }))
        }
      });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Clear offline queue (use with caution)
  app.delete('/api/sync/queue', authMiddleware, (req, res) => {
    try {
      const cleared = offlineQueue.length;
      offlineQueue = [];
      saveOfflineQueue();
      console.log(`[Sync] Cleared ${cleared} items from offline queue`);
      res.json({ success: true, data: { cleared } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== ADMIN ENDPOINTS ====================
  app.get('/api/admin', authMiddleware, (req, res) => {
    try {
      const admins = query('SELECT id, email, name, role, phone, companyId, createdAt FROM users WHERE role = "ADMIN" OR role = "SUPERADMIN" ORDER BY createdAt DESC');
      const result = admins.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone || '',
        company: a.companyId || '',
        userCount: query('SELECT COUNT(*) as c FROM users WHERE createdBy = ?', [a.id])[0]?.c || 0,
        status: 'active',
        plan: 'premium',
        createdAt: a.createdAt,
        lastActive: a.createdAt
      }));
      res.json({ success: true, data: { admins: result, pagination: { total: result.length, page: 1, limit: 50, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/admin', authMiddleware, async (req, res) => {
    try {
      const { name, email, phone, company, plan, password } = req.body;
      if (!email || !password || !name) return res.status(400).json({ success: false, message: 'Email, password, name required' });
      const id = uuid();
      const hashedPassword = await hashPassword(password);
      run('INSERT INTO users (id, username, email, password, name, role, isActive, createdBy, createdAt, updatedAt) VALUES (?,?,?,?,?,?,0,?,?,?)',
        [id, email, email, hashedPassword, name, 'ADMIN', req.user?.id, now(), now()]);
      const user = query('SELECT * FROM users WHERE id = ?', [id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (user) handleDataChange('users', 'create', user);

      res.status(201).json({ success: true, data: { id, email, name, role: 'ADMIN', company, plan: plan || 'basic', status: 'pending' } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== PURCHASES ====================
  app.get('/api/purchases', authMiddleware, (req, res) => {
    try {
      console.log('[Purchases] GET - User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { status, supplierId, branchId, companyId, page = 1, limit = 50 } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM purchases WHERE status != "DELETED"';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }
      if (status && status !== 'all') { sql += ' AND status = ?'; params.push(status); }
      if (supplierId && supplierId !== 'all') { sql += ' AND supplierId = ?'; params.push(supplierId); }
      sql += ' ORDER BY createdAt DESC';

      const purchases = query(sql, params).map(p => {
        const supplier = p.supplierId ? query('SELECT id, name, contactPerson, phone, email FROM suppliers WHERE id = ?', [p.supplierId])[0] : null;
        const purchaseItems = query('SELECT * FROM purchase_items WHERE purchaseId = ?', [p.id]).map(item => {
          const product = query('SELECT id, name, sku, barcode FROM products WHERE id = ?', [item.productId])[0];
          return { ...item, product: product || { id: '', name: 'Unknown', sku: '' } };
        });
        return {
          ...p,
          invoiceNo: p.invoiceNo || p.purchaseNumber,
          purchaseDate: p.purchaseDate || p.createdAt,
          paidAmount: p.paidAmount || 0,
          outstanding: (p.grandTotal || 0) - (p.paidAmount || 0),
          supplier: supplier || { id: '', name: 'Unknown', contactPerson: '', phone: '' },
          purchaseItems,
          items: purchaseItems
        };
      });

      console.log('[Purchases] Found', purchases.length, 'purchases');
      res.json({ success: true, data: purchases, pagination: { total: purchases.length, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(purchases.length / parseInt(limit)) || 1 } });
    } catch (e) {
      console.error('[Purchases] GET error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/purchases', authMiddleware, (req, res) => {
    try {
      console.log('[Purchases] POST request body:', req.body);
      const { supplierId, branchId, companyId, items = [], discount = 0, tax = 0, notes, status = 'PENDING', invoiceNo, paidAmount = 0, purchaseDate } = req.body;

      if (!items.length) {
        return res.status(400).json({ success: false, message: 'At least one item is required' });
      }

      const id = uuid();
      const purchaseNumber = `PO-${Date.now()}`;
      const timestamp = now();

      let totalAmount = 0;
      items.forEach(i => { totalAmount += (i.quantity || 1) * (i.unitPrice || i.costPrice || 0); });
      const grandTotal = totalAmount - (discount || 0) + (tax || 0);
      const paymentStatus = paidAmount >= grandTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING');

      console.log('[Purchases] Creating purchase:', { id, purchaseNumber, totalAmount, grandTotal, paidAmount });

      const success = run(`INSERT INTO purchases (id, purchaseNumber, invoiceNo, supplierId, branchId, companyId, totalAmount, paidAmount, discount, tax, grandTotal, paymentStatus, status, notes, purchaseDate, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, purchaseNumber, invoiceNo || null, supplierId || null, branchId || null, companyId || null, totalAmount, paidAmount, discount || 0, tax || 0, grandTotal, paymentStatus, status, notes || null, purchaseDate || timestamp, req.user?.id, timestamp, timestamp]);

      if (!success) {
        console.error('[Purchases] Failed to insert purchase');
        return res.status(500).json({ success: false, message: 'Failed to create purchase' });
      }

      const createdItems = [];
      items.forEach(i => {
        const itemId = uuid();
        const unitPrice = i.unitPrice || i.costPrice || 0;
        const quantity = i.quantity || 1;
        const total = quantity * unitPrice;
        const batchNo = i.batchNo || `BT-${Date.now()}`;
        const expireDate = i.expireDate || null;
        const productionDate = i.productionDate || null;

        run('INSERT INTO purchase_items (id, purchaseId, productId, quantity, unitPrice, total, createdAt) VALUES (?,?,?,?,?,?,?)',
          [itemId, id, i.productId, quantity, unitPrice, total, timestamp]);

        // Create batch for this purchase item
        if (i.productId) {
          const batchId = uuid();
          run(`INSERT INTO batches (id, batchNumber, productId, quantity, manufacturingDate, expiryDate, costPrice, sellingPrice, branchId, companyId, supplierId, isActive, createdBy, createdAt, updatedAt)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?,?)`,
            [batchId, batchNo, i.productId, quantity, productionDate, expireDate, unitPrice, unitPrice * 1.3, branchId || null, companyId || null, supplierId || null, req.user?.id, timestamp, timestamp]);
        }

        // Update product stock
        run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [quantity, i.productId]);

        const product = query('SELECT id, name, sku FROM products WHERE id = ?', [i.productId])[0];
        createdItems.push({ id: itemId, productId: i.productId, quantity, unitPrice, total, product, batchNo, expireDate, productionDate });
      });

      const purchase = query('SELECT * FROM purchases WHERE id = ?', [id])[0];
      const supplier = purchase?.supplierId ? query('SELECT * FROM suppliers WHERE id = ?', [purchase.supplierId])[0] : null;

      console.log('[Purchases] Created purchase successfully:', purchase?.id);

      // 🔄 TWO-WAY SYNC: Queue purchase and purchase_items for sync to PostgreSQL
      if (purchase) handleDataChange('purchases', 'create', purchase);
      createdItems.forEach(item => handleDataChange('purchase_items', 'create', item));

      res.status(201).json({
        success: true,
        data: {
          ...purchase,
          purchaseItems: createdItems,
          supplier,
          outstanding: grandTotal - paidAmount
        },
        message: 'Purchase order created successfully'
      });
    } catch (e) {
      console.error('[Purchases] Create error:', e.message, e.stack);
      res.status(500).json({ success: false, message: 'Failed to create purchase: ' + e.message });
    }
  });

  app.get('/api/purchases/:id', authMiddleware, (req, res) => {
    try {
      const purchase = query('SELECT * FROM purchases WHERE id = ?', [req.params.id])[0];
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Purchase not found' });
      }

      const supplier = purchase.supplierId ? query('SELECT * FROM suppliers WHERE id = ?', [purchase.supplierId])[0] : null;
      const purchaseItems = query('SELECT * FROM purchase_items WHERE purchaseId = ?', [purchase.id]).map(item => {
        const product = query('SELECT id, name, sku, barcode FROM products WHERE id = ?', [item.productId])[0];
        return { ...item, product: product || { id: '', name: 'Unknown', sku: '' } };
      });

      res.json({
        success: true,
        data: {
          ...purchase,
          invoiceNo: purchase.invoiceNo || purchase.purchaseNumber,
          purchaseDate: purchase.purchaseDate || purchase.createdAt,
          paidAmount: purchase.paidAmount || 0,
          outstanding: (purchase.grandTotal || 0) - (purchase.paidAmount || 0),
          supplier: supplier || { id: '', name: 'Unknown', contactPerson: '', phone: '' },
          purchaseItems,
          items: purchaseItems
        }
      });
    } catch (e) {
      console.error('[Purchases] GET by ID error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.put('/api/purchases/:id', authMiddleware, (req, res) => {
    try {
      const { status, paidAmount, notes, discount, tax } = req.body;
      const purchase = query('SELECT * FROM purchases WHERE id = ?', [req.params.id])[0];

      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Purchase not found' });
      }

      const updates = [];
      const params = [];

      if (status !== undefined) { updates.push('status = ?'); params.push(status); }
      if (paidAmount !== undefined) {
        updates.push('paidAmount = ?');
        params.push(paidAmount);
        const paymentStatus = paidAmount >= purchase.grandTotal ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING');
        updates.push('paymentStatus = ?');
        params.push(paymentStatus);
      }
      if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
      if (discount !== undefined) {
        updates.push('discount = ?');
        params.push(discount);
        // Recalculate grandTotal
        const newGrandTotal = purchase.totalAmount - discount + (tax !== undefined ? tax : purchase.tax || 0);
        updates.push('grandTotal = ?');
        params.push(newGrandTotal);
      }
      if (tax !== undefined) {
        updates.push('tax = ?');
        params.push(tax);
        // Recalculate grandTotal
        const newGrandTotal = purchase.totalAmount - (discount !== undefined ? discount : purchase.discount || 0) + tax;
        updates.push('grandTotal = ?');
        params.push(newGrandTotal);
      }

      if (updates.length) {
        params.push(now(), req.params.id);
        run(`UPDATE purchases SET ${updates.join(', ')}, updatedAt = ? WHERE id = ?`, params);
      }

      const updatedPurchase = query('SELECT * FROM purchases WHERE id = ?', [req.params.id])[0];

      // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
      if (updatedPurchase) handleDataChange('purchases', 'update', updatedPurchase);

      res.json({ success: true, data: updatedPurchase, message: 'Purchase updated successfully' });
    } catch (e) {
      console.error('[Purchases] Update error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete('/api/purchases/:id', authMiddleware, (req, res) => {
    try {
      const purchase = query('SELECT * FROM purchases WHERE id = ?', [req.params.id])[0];
      if (!purchase) {
        return res.status(404).json({ success: false, message: 'Purchase not found' });
      }

      // Soft delete
      run('UPDATE purchases SET status = ?, updatedAt = ? WHERE id = ?', ['DELETED', now(), req.params.id]);

      // 🔄 TWO-WAY SYNC: Queue soft delete for sync
      if (purchase) handleDataChange('purchases', 'update', { ...purchase, status: 'DELETED', updatedAt: now() });

      res.json({ success: true, message: 'Purchase deleted successfully' });
    } catch (e) {
      console.error('[Purchases] Delete error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== ENHANCED REPORTS ====================
  app.get('/api/reports/sales', authMiddleware, (req, res) => {
    try {
      console.log('[Reports/Sales] User:', req.user?.email, 'Role:', req.user?.role, 'Branch:', req.user?.branchId);
      const { startDate, endDate, branchId, companyId, period } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      // Build WHERE clause with data isolation
      let whereClause = 'WHERE 1=1';
      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        whereClause += ` AND 1=0`; // Return no results
      } else if (branchFilter) {
        whereClause += ` AND branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        whereClause += ` AND companyId = '${companyFilter}'`;
      }

      // Handle period-based filtering
      const today = new Date().toISOString().split('T')[0];
      let periodStartDate = startDate;

      if (period === 'today') {
        periodStartDate = today;
      } else if (period === 'week' || period === 'this_week') {
        periodStartDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (period === 'month' || period === 'this_month') {
        periodStartDate = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      } else if (period === 'year' || period === 'this_year') {
        periodStartDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      }

      if (periodStartDate) whereClause += ` AND DATE(createdAt) >= '${periodStartDate}'`;
      if (endDate) whereClause += ` AND DATE(createdAt) <= '${endDate}'`;

      const sales = query(`SELECT * FROM sales ${whereClause} ORDER BY createdAt DESC LIMIT 100`);
      const totalRevenue = query(`SELECT SUM(grandTotal) as total FROM sales ${whereClause}`)[0]?.total || 0;
      const totalSales = query(`SELECT COUNT(*) as count FROM sales ${whereClause}`)[0]?.count || 0;
      const totalDiscount = query(`SELECT SUM(discount) as total FROM sales ${whereClause}`)[0]?.total || 0;
      const totalTax = query(`SELECT SUM(tax) as total FROM sales ${whereClause}`)[0]?.total || 0;

      console.log('[Reports/Sales] Found sales:', totalSales, 'Revenue:', totalRevenue);

      // Sales by payment method
      const salesByPaymentMethod = query(`SELECT paymentMethod, COUNT(*) as count, SUM(grandTotal) as total FROM sales ${whereClause} GROUP BY paymentMethod`);

      // Top products (with branch filter) - CRITICAL: Prevent data leakage
      let topProductsWhere = '';
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        topProductsWhere = `AND 1=0`; // Return no results
      } else if (branchFilter) {
        topProductsWhere = `AND s.branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        topProductsWhere += ` AND s.companyId = '${companyFilter}'`;
      }

      const topProducts = query(`SELECT p.id, p.name, SUM(si.quantity) as totalQty, SUM(si.total) as totalRevenue
        FROM sale_items si JOIN products p ON si.productId = p.id
        JOIN sales s ON si.saleId = s.id WHERE 1=1 ${topProductsWhere}
        GROUP BY p.id ORDER BY totalRevenue DESC LIMIT 10`);

      // Sales trend (last 7 days with branch filter)
      const salesTrend = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        let trendWhere = `WHERE DATE(createdAt) = '${date}'`;
        // Apply data isolation - CRITICAL: Prevent data leakage
        if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
          trendWhere += ` AND 1=0`; // Return no results
        } else if (branchFilter) {
          trendWhere += ` AND branchId = '${branchFilter}'`;
        }
        if (companyFilter) {
          trendWhere += ` AND companyId = '${companyFilter}'`;
        }

        const dayData = query(`SELECT SUM(grandTotal) as total, COUNT(*) as count FROM sales ${trendWhere}`)[0];
        salesTrend.push({
          date,
          total: dayData?.total || 0,
          revenue: dayData?.total || 0,
          count: dayData?.count || 0,
          orders: dayData?.count || 0,
          name: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
        });
      }

      res.json({ success: true, data: {
        summary: { totalSales, totalRevenue, totalSubtotal: totalRevenue, totalTax, totalDiscount },
        salesByPaymentMethod,
        topProducts,
        salesTrend,
        sales: sales.map(s => ({
          ...s,
          customer: s.customerId ? query('SELECT id, name, phone FROM customers WHERE id = ?', [s.customerId])[0] : null
        }))
      }});
    } catch (e) {
      console.error('[Reports/Sales] Error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/reports/inventory', authMiddleware, (req, res) => {
    try {
      console.log('[Reports/Inventory] User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { branchId, companyId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let whereClause = 'WHERE isActive = 1';
      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        whereClause += ` AND 1=0`; // Return no results
      } else if (branchFilter) {
        whereClause += ` AND branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        whereClause += ` AND companyId = '${companyFilter}'`;
      }

      const products = query(`SELECT * FROM products ${whereClause} ORDER BY quantity ASC`);
      const totalProducts = products.length;
      const totalStock = products.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const totalValue = products.reduce((sum, p) => sum + ((p.quantity || 0) * (p.costPrice || 0)), 0);
      const lowStockCount = products.filter(p => p.quantity <= p.minStock).length;
      const outOfStock = products.filter(p => p.quantity === 0).length;

      console.log('[Reports/Inventory] Products:', totalProducts, 'Stock:', totalStock);

      const lowStockProducts = products.filter(p => p.quantity <= p.minStock).map(p => ({
        ...p,
        stock: p.quantity,
        category: p.categoryId ? query('SELECT name FROM categories WHERE id = ?', [p.categoryId])[0] : { name: 'Uncategorized' },
        supplier: p.supplierId ? query('SELECT name FROM suppliers WHERE id = ?', [p.supplierId])[0] : { name: 'Unknown' }
      }));

      // Products by category (with filter)
      const productsByCategory = query(`SELECT c.name as category, COUNT(p.id) as count, SUM(p.quantity) as totalStock
        FROM products p LEFT JOIN categories c ON p.categoryId = c.id ${whereClause.replace('WHERE', 'WHERE p.')} GROUP BY c.id`);

      res.json({ success: true, data: {
        summary: { totalProducts, totalStock, totalValue, lowStockCount, outOfStock },
        productsByCategory,
        lowStockProducts
      }});
    } catch (e) {
      console.error('[Reports/Inventory] Error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get('/api/reports/customers', authMiddleware, (req, res) => {
    try {
      const customers = query('SELECT * FROM customers WHERE isActive = 1 ORDER BY createdAt DESC');
      const totalCustomers = customers.length;
      const totalSpent = query('SELECT SUM(grandTotal) as total FROM sales')[0]?.total || 0;

      res.json({ success: true, data: {
        summary: { totalCustomers, totalSpent, totalLoyaltyPoints: 0, averageSpent: totalCustomers > 0 ? totalSpent / totalCustomers : 0 },
        customersByVIP: [],
        topCustomers: customers.slice(0, 10),
        recentCustomers: customers.slice(0, 10)
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/reports/products', authMiddleware, (req, res) => {
    try {
      const products = query('SELECT * FROM products WHERE isActive = 1 ORDER BY quantity DESC LIMIT 20');
      res.json({ success: true, data: {
        topProducts: products.map(p => ({
          productId: p.id,
          product: { id: p.id, name: p.name, stock: p.quantity, sellingPrice: p.sellingPrice || p.unitPrice },
          _sum: { quantity: p.quantity, totalPrice: p.quantity * (p.sellingPrice || p.unitPrice) },
          _count: { id: 1 }
        })),
        categoryPerformance: []
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // Top products report endpoint (matches main backend)
  app.get('/api/reports/top-products', authMiddleware, (req, res) => {
    try {
      const { branchId, companyId, startDate, endDate, limit = 10 } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let whereClause = 'WHERE 1=1';
      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        whereClause += ` AND 1=0`; // Return no results
      } else if (branchFilter) {
        whereClause += ` AND s.branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        whereClause += ` AND s.companyId = '${companyFilter}'`;
      }
      if (startDate) {
        whereClause += ` AND DATE(s.createdAt) >= '${startDate}'`;
      }
      if (endDate) {
        whereClause += ` AND DATE(s.createdAt) <= '${endDate}'`;
      }

      // Get top products by sales quantity
      const topProducts = query(`
        SELECT
          p.id as productId,
          p.name as productName,
          p.sku,
          SUM(si.quantity) as totalQuantity,
          SUM(si.total) as totalRevenue,
          COUNT(DISTINCT s.id) as saleCount
        FROM sale_items si
        JOIN products p ON si.productId = p.id
        JOIN sales s ON si.saleId = s.id
        ${whereClause}
        GROUP BY p.id, p.name, p.sku
        ORDER BY totalQuantity DESC
        LIMIT ${parseInt(limit) || 10}
      `);

      const result = topProducts.map(p => ({
        productId: p.productId,
        product: {
          id: p.productId,
          name: p.productName,
          sku: p.sku
        },
        _sum: {
          quantity: p.totalQuantity || 0,
          totalPrice: p.totalRevenue || 0
        },
        _count: {
          id: p.saleCount || 0
        }
      }));

      res.json({ success: true, data: { topProducts: result } });
    } catch (e) {
      console.error('[Reports] Top products error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // Payment methods report endpoint (matches main backend)
  app.get('/api/reports/payment-methods', authMiddleware, (req, res) => {
    try {
      const { branchId, companyId, startDate, endDate } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let whereClause = 'WHERE 1=1';
      // Apply data isolation - CRITICAL: Prevent data leakage
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        whereClause += ` AND 1=0`; // Return no results
      } else if (branchFilter) {
        whereClause += ` AND branchId = '${branchFilter}'`;
      }
      if (companyFilter) {
        whereClause += ` AND companyId = '${companyFilter}'`;
      }
      if (startDate) {
        whereClause += ` AND DATE(createdAt) >= '${startDate}'`;
      }
      if (endDate) {
        whereClause += ` AND DATE(createdAt) <= '${endDate}'`;
      }

      // Get sales by payment method
      const salesByPaymentMethod = query(`
        SELECT
          paymentMethod,
          COUNT(*) as count,
          SUM(grandTotal) as total
        FROM sales
        ${whereClause}
        GROUP BY paymentMethod
        ORDER BY total DESC
      `);

      res.json({
        success: true,
        data: {
          salesByPaymentMethod: salesByPaymentMethod.map(s => ({
            paymentMethod: s.paymentMethod,
            count: s.count || 0,
            total: s.total || 0
          }))
        }
      });
    } catch (e) {
      console.error('[Reports] Payment methods error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // ==================== REFUNDS ====================
  app.get('/api/refunds', authMiddleware, (req, res) => {
    try {
      console.log('[Refunds] GET - User:', req.user?.email, 'Branch:', req.user?.branchId);
      const { status, branchId, companyId } = req.query;

      // Get data filter based on user role
      const { branchFilter, companyFilter, createdBy } = getDataFilter(req.user, branchId, companyId, req);

      let sql = 'SELECT * FROM refunds WHERE 1=1';
      const params = [];

      // Apply data isolation - CRITICAL: Prevent data leakage
      // Special case: 'must-select-branch' or 'non-existent-branch-id' means no access
      if (branchFilter === 'must-select-branch' || branchFilter === 'non-existent-branch-id') {
        sql += ' AND 1=0'; // Return no results - force branch selection
      } else if (branchFilter) {
        sql += ' AND branchId = ?';
        params.push(branchFilter);
      }
      if (companyFilter) {
        sql += ' AND companyId = ?';
        params.push(companyFilter);
      }
      if (status) { sql += ' AND status = ?'; params.push(status); }
      sql += ' ORDER BY createdAt DESC';

      const rawRefunds = query(sql, params);
      console.log('[Refunds] Found refunds:', rawRefunds.length);

      const refunds = rawRefunds.map(r => {
        const sale = r.saleId ? query('SELECT * FROM sales WHERE id = ?', [r.saleId])[0] : null;
        const customer = sale?.customerId ? query('SELECT * FROM customers WHERE id = ?', [sale.customerId])[0] : null;
        const user = r.createdBy ? query('SELECT id, name, email FROM users WHERE id = ?', [r.createdBy])[0] : null;
        const saleItems = sale ? query('SELECT si.*, p.name as productName FROM sale_items si JOIN products p ON si.productId = p.id WHERE si.saleId = ?', [sale.id]) : [];

        return {
          ...r,
          sale: sale ? { ...sale, items: saleItems } : null,
          customer: customer || null,
          processedBy: user || null,
          refundNumber: `REF-${r.id.substr(0, 8).toUpperCase()}`
        };
      });

      res.json({ success: true, data: { refunds, pagination: { total: refunds.length, page: 1, limit: 50, pages: 1 } } });
    } catch (e) {
      console.error('[Refunds] GET error:', e.message);
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post('/api/refunds', authMiddleware, (req, res) => {
    try {
      console.log('[Refunds] POST request body:', JSON.stringify(req.body));
      const { saleId, amount, reason, items = [], branchId, companyId } = req.body;

      if (!saleId) {
        console.error('[Refunds] No saleId provided');
        return res.status(400).json({ success: false, message: 'Sale ID is required' });
      }

      // Get original sale
      console.log('[Refunds] Looking for sale:', saleId);
      const sale = query('SELECT * FROM sales WHERE id = ?', [saleId])[0];
      if (!sale) {
        console.error('[Refunds] Sale not found:', saleId);
        return res.status(404).json({ success: false, message: 'Sale not found' });
      }
      console.log('[Refunds] Found sale:', sale.invoiceNumber);

      const id = uuid();
      const refundNumber = `REF-${Date.now()}`;
      const timestamp = now();
      const refundAmount = parseFloat(amount) || parseFloat(sale.grandTotal) || 0;
      const finalBranchId = branchId || sale.branchId || req.user?.branchId || null;
      const finalCompanyId = companyId || sale.companyId || req.user?.companyId || null;

      console.log('[Refunds] Creating refund:', { id, saleId, refundAmount, finalBranchId, finalCompanyId });

      const insertSuccess = run(`INSERT INTO refunds (id, saleId, amount, reason, branchId, companyId, status, createdBy, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [id, saleId, refundAmount, reason || 'Customer return', finalBranchId, finalCompanyId, 'COMPLETED', req.user?.id || null, timestamp, timestamp]);

      if (!insertSuccess) {
        console.error('[Refunds] Failed to insert refund');
        return res.status(500).json({ success: false, message: 'Failed to create refund record' });
      }

      // Restore product stock for refunded items
      const saleItems = query('SELECT * FROM sale_items WHERE saleId = ?', [saleId]);
      console.log('[Refunds] Restoring stock for', saleItems.length, 'items');

      saleItems.forEach(item => {
        if (item.productId && item.quantity) {
          run('UPDATE products SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.productId]);
          console.log('[Refunds] Restored', item.quantity, 'units to product', item.productId);
        }
      });

      // Update sale status
      run("UPDATE sales SET status = 'REFUNDED', paymentStatus = 'REFUNDED', updatedAt = ? WHERE id = ?", [timestamp, saleId]);
      console.log('[Refunds] Updated sale status to REFUNDED');

      const refund = query('SELECT * FROM refunds WHERE id = ?', [id])[0];
      const customer = sale.customerId ? query('SELECT * FROM customers WHERE id = ?', [sale.customerId])[0] : null;

      console.log('[Refunds] ✅ Refund created successfully:', id);

      // 🔄 TWO-WAY SYNC: Queue refund for sync to PostgreSQL
      if (refund) handleDataChange('refunds', 'create', refund);

      res.status(201).json({
        success: true,
        data: {
          ...refund,
          refundNumber,
          sale,
          customer,
          items: saleItems,
          processedBy: { id: req.user?.id, name: req.user?.name || 'Admin' }
        },
        message: 'Refund processed successfully'
      });
    } catch (e) {
      console.error('[Refunds] POST error:', e.message, e.stack);
      res.status(500).json({ success: false, message: 'Failed to process refund: ' + e.message });
    }
  });

  // ==================== BULK OPERATIONS ====================
  app.post('/api/products/bulk-delete', authMiddleware, (req, res) => {
    try {
      const { productIds } = req.body;
      if (!productIds || !productIds.length) return res.status(400).json({ success: false, message: 'No products to delete' });
      productIds.forEach(id => {
        const product = query('SELECT * FROM products WHERE id = ?', [id])[0];
        run('UPDATE products SET isActive = 0, updatedAt = ? WHERE id = ?', [now(), id]);
        // 🔄 TWO-WAY SYNC: Queue soft delete for sync
        if (product) handleDataChange('products', 'update', { ...product, isActive: 0, updatedAt: now() });
      });
      res.json({ success: true, message: 'Products deleted', data: { deletedCount: productIds.length, deletedProducts: productIds.map(id => ({ id })) } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.post('/api/products/bulk-import', authMiddleware, (req, res) => {
    try {
      const { products } = req.body;
      if (!products || !products.length) return res.status(400).json({ success: false, message: 'No products to import' });

      const successful = [];
      const failed = [];

      products.forEach(p => {
        try {
          const id = uuid();
          run(`INSERT INTO products (id, name, genericName, sku, description, categoryId, branchId, companyId, unitPrice, costPrice, sellingPrice, quantity, minStock, createdBy, isActive, createdAt, updatedAt)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)`,
            [id, p.name, p.genericName || null, p.sku || `SKU-${Date.now()}`, p.description || null, p.categoryId || null, p.branchId || null, p.companyId || null, p.sellingPrice || 0, p.costPrice || 0, p.sellingPrice || 0, p.stock || 0, p.minStock || 10, req.user?.id, now(), now()]);
          const product = query('SELECT * FROM products WHERE id = ?', [id])[0];
          // 🔄 TWO-WAY SYNC: Queue for sync to PostgreSQL
          if (product) handleDataChange('products', 'create', product);
          successful.push({ ...p, id });
        } catch (e) {
          failed.push({ product: p, error: e.message });
        }
      });

      res.json({ success: true, data: { successful, failed, total: products.length, successCount: successful.length, failureCount: failed.length } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== RECEIPTS ====================
  app.get('/api/sales/receipts', authMiddleware, (req, res) => {
    try {
      const receipts = query('SELECT id, invoiceNumber as receiptNumber, id as saleId, createdAt as printedAt FROM sales ORDER BY createdAt DESC LIMIT 100');
      res.json({ success: true, data: { receipts } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/sales/receipt/:receiptNumber', authMiddleware, (req, res) => {
    try {
      const s = query('SELECT * FROM sales WHERE invoiceNumber = ? OR receiptNumber = ?', [req.params.receiptNumber, req.params.receiptNumber])[0];
      if (!s) return res.status(404).json({ success: false, message: 'Receipt not found' });
      const customer = s.customerId ? query('SELECT * FROM customers WHERE id = ?', [s.customerId])[0] : null;
      const branch = s.branchId ? query('SELECT * FROM branches WHERE id = ?', [s.branchId])[0] : null;
      const user = s.createdBy ? query('SELECT id, name, email as username FROM users WHERE id = ?', [s.createdBy])[0] : null;
      const items = query('SELECT * FROM sale_items WHERE saleId = ?', [s.id]).map(item => {
        const product = query('SELECT * FROM products WHERE id = ?', [item.productId])[0];
        return { ...item, totalPrice: item.total, product: product || { id: '', name: 'Unknown', unitType: 'PIECE' } };
      });
      res.json({ success: true, data: { ...s, customer, branch, user, items, receipts: [{ id: s.id, receiptNumber: s.invoiceNumber }] } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== INVENTORY DETAILED ====================
  app.get('/api/inventory/products', authMiddleware, (req, res) => {
    try {
      const { branchId, lowStock } = req.query;
      let sql = 'SELECT * FROM products WHERE isActive = 1';
      const params = [];
      if (branchId) { sql += ' AND branchId = ?'; params.push(branchId); }
      if (lowStock === 'true') { sql += ' AND quantity <= minStock'; }
      sql += ' ORDER BY quantity ASC';
      const products = query(sql, params).map(p => ({
        ...p,
        stock: p.quantity,
        category: p.categoryId ? query('SELECT id, name FROM categories WHERE id = ?', [p.categoryId])[0] : { id: '', name: 'Uncategorized' },
        supplier: p.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [p.supplierId])[0] : { id: '', name: 'Unknown' }
      }));
      res.json({ success: true, data: { products, pagination: { total: products.length, page: 1, limit: 100, pages: 1 } } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/inventory/low-stock', authMiddleware, (req, res) => {
    try {
      const products = query('SELECT * FROM products WHERE isActive = 1 AND quantity <= minStock ORDER BY quantity ASC').map(p => ({
        ...p,
        stock: p.quantity,
        category: p.categoryId ? query('SELECT id, name FROM categories WHERE id = ?', [p.categoryId])[0] : { id: '', name: 'Uncategorized' },
        supplier: p.supplierId ? query('SELECT id, name FROM suppliers WHERE id = ?', [p.supplierId])[0] : { id: '', name: 'Unknown' }
      }));
      res.json({ success: true, data: { products, count: products.length } });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  app.get('/api/inventory/reports', authMiddleware, (req, res) => {
    try {
      const products = query('SELECT * FROM products WHERE isActive = 1');
      const categories = query('SELECT * FROM categories WHERE isActive = 1');
      const lowStock = products.filter(p => p.quantity <= p.minStock);
      const outOfStock = products.filter(p => p.quantity === 0);
      const totalValue = products.reduce((sum, p) => sum + (p.quantity * (p.costPrice || 0)), 0);

      res.json({ success: true, data: {
        summary: { totalProducts: products.length, totalValue, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length },
        lowStockProducts: lowStock.map(p => ({
          ...p, stock: p.quantity,
          category: p.categoryId ? query('SELECT name FROM categories WHERE id = ?', [p.categoryId])[0] : { name: 'Uncategorized' },
          supplier: p.supplierId ? query('SELECT name FROM suppliers WHERE id = ?', [p.supplierId])[0] : { name: 'Unknown' }
        })),
        productsByCategory: categories.map(c => ({
          categoryId: c.id,
          category: { id: c.id, name: c.name },
          _count: { id: products.filter(p => p.categoryId === c.id).length },
          _sum: { stock: products.filter(p => p.categoryId === c.id).reduce((sum, p) => sum + (p.quantity || 0), 0) }
        }))
      }});
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  });

  // ==================== PROMOTIONS ====================
  app.get('/api/promotions', authMiddleware, (req, res) => {
    res.json({ success: true, data: { promotions: [], pagination: { total: 0, page: 1, limit: 50, pages: 1 } } });
  });

  // ==================== GIFT CARDS ====================
  app.get('/api/gift-cards', authMiddleware, (req, res) => {
    res.json({ success: true, data: { giftCards: [], pagination: { total: 0, page: 1, limit: 50, pages: 1 } } });
  });

  // ==================== CATCH-ALL for unhandled routes ====================
  app.all('/api/*', (req, res) => {
    console.log('[API] Unhandled route:', req.method, req.path);
    res.status(404).json({ success: false, message: `Endpoint not found: ${req.method} ${req.path}` });
  });

  // Start listening
  return new Promise((resolve, reject) => {
    try {
      // CRITICAL: Try to start server, handle port conflicts gracefully
      server = app.listen(port, '127.0.0.1', () => {
        console.log(`[Server] ✅ Running on http://127.0.0.1:${port}`);
        console.log(`[Server] ✅ Database: ${DB_PATH}`);
        console.log(`[Server] 🔄 PostgreSQL sync URL: ${REMOTE_DATABASE_URL ? 'configured' : 'not configured'}`);
        console.log(`[Server] ✅ SQLite is READY - ALL operations work independently of PostgreSQL`);
        console.log(`[Server] ✅ PostgreSQL sync is OPTIONAL - app works perfectly offline`);
        console.log(`[Server] ✅ ALL CRUD operations work with SQLite when backend is down`);

        // Start periodic sync to PostgreSQL (with error handling)
        // CRITICAL: This is non-blocking - SQLite operations work immediately
        try {
          startPeriodicSync();
          console.log(`[Server] ✅ Sync system started (non-blocking)`);
        } catch (syncError) {
          console.error('[Server] Failed to start periodic sync:', syncError.message);
          console.log('[Server] ✅ SQLite operations continue normally - sync is optional');
          // Continue anyway - sync is not critical for app startup
        }

        resolve(server);
      });
      server.on('error', (err) => {
        // Port might be in use - check if it's the embedded server or main backend
        if (err.code === 'EADDRINUSE') {
          console.log(`[Server] ⚠️ Port ${port} is already in use`);
          console.log(`[Server] 💡 This might be the main backend - embedded server will use existing server`);
          // Port is in use - might be main backend, that's OK
          // The existing server should handle requests
          resolve(null); // Return null but don't fail
        } else {
          console.error('[Server] ❌ Error:', err.message);
          console.error('[Server] Server failed but app will continue');
          resolve(null);
        }
      });
    } catch (err) {
      console.error('[Server] ❌ Startup error:', err.message);
      // CRITICAL: Don't reject - resolve with null to prevent popup
      resolve(null);
    }
  });
}

function stopServer() {
  if (server) { server.close(); server = null; }
  if (db) { saveDatabase(); db.close(); db = null; }
}

module.exports = { startServer, stopServer };
