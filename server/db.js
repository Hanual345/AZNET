const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'database.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    avatar TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('serialized', 'bulk')),
    category TEXT NOT NULL,
    serial_number TEXT UNIQUE, -- Null for bulk items
    status TEXT CHECK(status IN ('Available', 'Checked Out', 'Maintenance')), -- Null for bulk items
    current_user_id INTEGER, -- Null if not checked out or if bulk
    quantity_total INTEGER, -- Null for serialized items
    quantity_available INTEGER, -- Null for serialized items
    location TEXT NOT NULL,
    cost REAL NOT NULL,
    access_role TEXT NOT NULL DEFAULT 'All', -- 'All', 'Administrator', 'Technician', 'Field Engineer', 'Media Producer', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(current_user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    asset_name TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    action TEXT NOT NULL, -- 'Checkout', 'Checkin', 'Maintenance Start', 'Maintenance End', 'Quantity Restock', 'Quantity Checkout', 'Create', 'Delete'
    user_id INTEGER,
    user_name TEXT,
    quantity INTEGER, -- For bulk items
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_no TEXT NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS customer_checkouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    serial_number TEXT,
    price REAL NOT NULL,
    warranty_info TEXT,
    checkout_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(asset_id) REFERENCES assets(id)
  );
`);

// Implement Immutable Audit Ledger
// Triggers to block UPDATE and DELETE on audit_logs
try {
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_log_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(FAIL, 'IMMEDIATE ERROR: Audit ledger is immutable. Updates are not allowed.');
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_log_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(FAIL, 'IMMEDIATE ERROR: Audit ledger is immutable. Deletions are not allowed.');
    END;
  `);
} catch (err) {
  console.error("Error creating triggers:", err);
}

// Seed Users if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (name, email, role, avatar) VALUES (?, ?, ?, ?)');
  
  insertUser.run('Alex Rivera', 'alex@aznet.co', 'Administrator', 'AR');
  insertUser.run('Sarah Chen', 'sarah@aznet.co', 'Technician', 'SC');
  insertUser.run('Marcus Vance', 'marcus@aznet.co', 'Field Engineer', 'MV');
  insertUser.run('Emma Watson', 'emma@aznet.co', 'Media Producer', 'EW');
  insertUser.run('David Kim', 'david@aznet.co', 'Systems Analyst', 'DK');
  
  console.log('Seeded database with users.');
}

// Dynamically alter assets table if access_role is missing
try {
  db.exec("ALTER TABLE assets ADD COLUMN access_role TEXT NOT NULL DEFAULT 'All'");
  console.log("Added access_role column to assets table.");
} catch (err) {
  // Column likely already exists
}

// Seed Assets if empty
const assetCount = db.prepare('SELECT COUNT(*) as count FROM assets').get();
if (assetCount.count === 0) {
  const insertAsset = db.prepare(`
    INSERT INTO assets (name, type, category, serial_number, status, current_user_id, quantity_total, quantity_available, location, cost, access_role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Serialized assets
  insertAsset.run('Sony FX6 Cinema Camera', 'serialized', 'Cameras', 'SN-FX6-90234', 'Available', null, null, null, 'Studio A', 5999.99, 'Administrator'); // Admin Only example
  insertAsset.run('RED Komodo 6K Camera', 'serialized', 'Cameras', 'SN-RED-11204', 'Checked Out', 4, null, null, 'Studio B', 6125.00, 'Media Producer'); // Role restricted example
  insertAsset.run('DeWalt DCD999 Hammer Drill', 'serialized', 'Tools', 'SN-DEW-84729', 'Available', null, null, null, 'Workshop Locker 4', 299.00, 'All');
  insertAsset.run('Makita 18V Cordless Drill', 'serialized', 'Tools', 'SN-MAK-29104', 'Maintenance', null, null, null, 'Repair Room Shelf C', 189.50, 'All');
  insertAsset.run('MacBook Pro 16" M3 Max', 'serialized', 'Laptops', 'SN-MBP-78291', 'Available', null, null, null, 'Main Server Room', 3499.00, 'All');
  insertAsset.run('DJI Ronin 2 Stabilizer', 'serialized', 'Gimbal', 'SN-DJI-40918', 'Available', null, null, null, 'Studio A Closet', 8499.00, 'All');
  insertAsset.run('Rode Wireless PRO Mic Kit', 'serialized', 'Audio', 'SN-ROD-09283', 'Checked Out', 2, null, null, 'Locker 12', 399.00, 'All');

  // Bulk assets
  insertAsset.run('Cat6 Ethernet Cable 10ft', 'bulk', 'Cables', null, null, null, 150, 142, 'Storage Room Bin B1', 4.99, 'All');
  insertAsset.run('USB-C Charging Cable 6ft', 'bulk', 'Cables', null, null, null, 80, 52, 'Storage Room Bin B3', 9.99, 'All');
  insertAsset.run('Rechargeable AA Batteries (4-Pack)', 'bulk', 'Power', null, null, null, 200, 178, 'Battery Charging Rack', 14.50, 'All');
  insertAsset.run('Gaffer Tape Black 2" x 50yd', 'bulk', 'Supplies', null, null, null, 40, 18, 'Studio Consumables Shelf', 18.99, 'All');
  insertAsset.run('HDMI 2.1 Cable 15ft', 'bulk', 'Cables', null, null, null, 60, 48, 'Storage Room Bin B2', 14.99, 'All');

  // Create initial logs
  const insertLog = db.prepare(`
    INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, user_id, user_name, quantity, details, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  
  // Seed initial audit log history
  insertLog.run(1, 'Sony FX6 Cinema Camera', 'serialized', 'Create', 1, 'Alex Rivera', null, 'Asset added to catalog', new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString());
  insertLog.run(2, 'RED Komodo 6K Camera', 'serialized', 'Create', 1, 'Alex Rivera', null, 'Asset added to catalog', new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString());
  insertLog.run(2, 'RED Komodo 6K Camera', 'serialized', 'Checkout', 4, 'Emma Watson', null, 'Checked out to Emma Watson for outdoor commercial shoot', new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString());
  insertLog.run(4, 'Makita 18V Cordless Drill', 'serialized', 'Create', 1, 'Alex Rivera', null, 'Asset added to catalog', new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString());
  insertLog.run(4, 'Makita 18V Cordless Drill', 'serialized', 'Maintenance Start', 2, 'Sarah Chen', null, 'Trigger motor sparks detected during standard check', new Date(now - 1000 * 60 * 60 * 12).toISOString());
  insertLog.run(8, 'Cat6 Ethernet Cable 10ft', 'bulk', 'Create', 1, 'Alex Rivera', 150, 'Bulk consumable stock created', new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString());
  insertLog.run(8, 'Cat6 Ethernet Cable 10ft', 'bulk', 'Quantity Checkout', 3, 'Marcus Vance', 8, 'Checked out 8 cables for office deployment', new Date(now - 1000 * 60 * 60 * 8).toISOString());

  console.log('Seeded database with assets and history logs.');
}

// Seed Customers if empty
const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
if (customerCount.count === 0) {
  const insertCustomer = db.prepare('INSERT INTO customers (name, contact_no, email) VALUES (?, ?, ?)');
  insertCustomer.run('John Doe', '+1 (555) 019-2834', 'john.doe@gmail.com');
  insertCustomer.run('Jane Smith', '+1 (555) 043-9821', 'jane.smith@yahoo.com');
  insertCustomer.run('Robert Johnson', '+1 (555) 087-4329', 'robert.j@outlook.com');

  const insertCheckout = db.prepare(`
    INSERT INTO customer_checkouts (customer_id, asset_id, serial_number, price, warranty_info)
    VALUES (?, ?, ?, ?, ?)
  `);
  // Seed a customer checkout for Sony FX6 Cinema Camera (ID 1)
  insertCheckout.run(1, 1, 'SN-FX6-90234', 5999.99, '24 Months Warranty');
  // Update asset status to 'Checked Out' since John Doe took it
  db.prepare("UPDATE assets SET status = 'Checked Out' WHERE id = 1").run();
  
  // Write checkout log
  db.prepare(`
    INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
    VALUES (1, 'Sony FX6 Cinema Camera', 'serialized', 'Checkout', 'Checked out to customer John Doe with 24 Months Warranty')
  `).run();

  console.log('Seeded database with customer profiles and checkout lease history.');
}

module.exports = db;
