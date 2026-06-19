const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Get all assets
app.get('/api/assets', (req, res) => {
  try {
    const query = `
      SELECT a.*, u.name as current_user_name 
      FROM assets a 
      LEFT JOIN users u ON a.current_user_id = u.id
      ORDER BY a.id DESC
    `;
    const assets = db.prepare(query).all();
    res.json(assets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new asset
app.post('/api/assets', (req, res) => {
  const { name, type, category, serial_number, quantity_total, location, cost } = req.body;
  
  if (!name || !type || !category || !location || cost === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const insertAsset = db.transaction(() => {
      let assetId;
      if (type === 'serialized') {
        if (!serial_number) {
          throw new Error('Serial number is required for serialized assets');
        }
        const stmt = db.prepare(`
          INSERT INTO assets (name, type, category, serial_number, status, location, cost)
          VALUES (?, 'serialized', ?, ?, 'Available', ?, ?)
        `);
        const result = stmt.run(name, category, serial_number, location, Number(cost));
        assetId = result.lastInsertRowid;
      } else {
        const qty = Number(quantity_total);
        if (isNaN(qty) || qty < 0) {
          throw new Error('Valid total quantity is required for bulk assets');
        }
        const stmt = db.prepare(`
          INSERT INTO assets (name, type, category, quantity_total, quantity_available, location, cost)
          VALUES (?, 'bulk', ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(name, category, qty, qty, location, Number(cost));
        assetId = result.lastInsertRowid;
      }

      // Write immutable ledger entry
      db.prepare(`
        INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
        VALUES (?, ?, ?, 'Create', ?)
      `).run(assetId, name, type, `Created asset in inventory at ${location}`);

      return assetId;
    });

    const newId = insertAsset();
    res.json({ success: true, id: newId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Checkout asset (with transaction-level safety)
app.post('/api/assets/:id/checkout', (req, res) => {
  const assetId = Number(req.params.id);
  const { userId, quantity } = req.body; // quantity is for bulk items

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required for checkout' });
  }

  try {
    const checkoutTx = db.transaction(() => {
      // Fetch current asset state within the transaction
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (asset.type === 'serialized') {
        // CONFLICT RESOLUTION: Ensure status is 'Available'
        if (asset.status !== 'Available') {
          throw new Error(`Conflict: Asset is not Available. Current status: ${asset.status}`);
        }

        // Perform checkout
        db.prepare("UPDATE assets SET status = 'Checked Out', current_user_id = ? WHERE id = ?")
          .run(userId, assetId);

        // Write log entry
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, user_id, user_name, details)
          VALUES (?, ?, 'serialized', 'Checkout', ?, ?, ?)
        `).run(assetId, asset.name, userId, user.name, `Checked out to ${user.name}`);
      } else {
        // Bulk checkout
        const qtyToCheckout = Number(quantity) || 1;
        if (qtyToCheckout <= 0) {
          throw new Error('Quantity must be greater than zero');
        }
        if (asset.quantity_available < qtyToCheckout) {
          throw new Error(`Conflict: Insufficient quantity. Available: ${asset.quantity_available}, Requested: ${qtyToCheckout}`);
        }

        // Perform checkout
        db.prepare('UPDATE assets SET quantity_available = quantity_available - ? WHERE id = ?')
          .run(qtyToCheckout, assetId);

        // Write log entry
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, user_id, user_name, quantity, details)
          VALUES (?, ?, 'bulk', 'Quantity Checkout', ?, ?, ?, ?)
        `).run(assetId, asset.name, userId, user.name, qtyToCheckout, `Checked out ${qtyToCheckout} unit(s) to ${user.name}`);
      }

      return { success: true };
    });

    const result = checkoutTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Checkin asset (with transaction-level safety)
app.post('/api/assets/:id/checkin', (req, res) => {
  const assetId = Number(req.params.id);
  const { quantity } = req.body; // quantity is for bulk items

  try {
    const checkinTx = db.transaction(() => {
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.type === 'serialized') {
        if (asset.status !== 'Checked Out') {
          throw new Error(`Conflict: Asset is not Checked Out. Current status: ${asset.status}`);
        }

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(asset.current_user_id);
        const userName = user ? user.name : 'Unknown';

        // Perform checkin
        db.prepare("UPDATE assets SET status = 'Available', current_user_id = NULL WHERE id = ?")
          .run(assetId);

        // Write log entry
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, user_id, user_name, details)
          VALUES (?, ?, 'serialized', 'Checkin', ?, ?, ?)
        `).run(assetId, asset.name, asset.current_user_id, userName, `Checked in by ${userName}`);
      } else {
        // Bulk checkin
        const qtyToCheckin = Number(quantity) || 1;
        if (qtyToCheckin <= 0) {
          throw new Error('Quantity must be greater than zero');
        }
        
        // Ensure checked in quantity doesn't exceed checked out capacity (quantity_available + qtyToCheckin <= quantity_total)
        if (asset.quantity_available + qtyToCheckin > asset.quantity_total) {
          throw new Error(`Conflict: Checkin would exceed total inventory limit of ${asset.quantity_total}`);
        }

        // Perform checkin
        db.prepare('UPDATE assets SET quantity_available = quantity_available + ? WHERE id = ?')
          .run(qtyToCheckin, assetId);

        // Write log entry
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, quantity, details)
          VALUES (?, ?, 'bulk', 'Quantity Restock', ?, ?)
        `).run(assetId, asset.name, qtyToCheckin, `Restocked ${qtyToCheckin} unit(s)`);
      }

      return { success: true };
    });

    const result = checkinTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Trigger Maintenance transitions
app.post('/api/assets/:id/maintenance', (req, res) => {
  const assetId = Number(req.params.id);
  const { action } = req.body; // 'start' or 'stop'

  if (action !== 'start' && action !== 'stop') {
    return res.status(400).json({ error: "Action must be 'start' or 'stop'" });
  }

  try {
    const maintenanceTx = db.transaction(() => {
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.type !== 'serialized') {
        throw new Error('Maintenance is only supported for high-value Serialized assets');
      }

      if (action === 'start') {
        if (asset.status !== 'Available') {
          throw new Error(`Conflict: Asset must be Available to go into maintenance. Current status: ${asset.status}`);
        }

        db.prepare("UPDATE assets SET status = 'Maintenance' WHERE id = ?").run(assetId);
        
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
          VALUES (?, ?, 'serialized', 'Maintenance Start', 'Asset sent to maintenance')
        `).run(assetId, asset.name);
      } else {
        if (asset.status !== 'Maintenance') {
          throw new Error(`Conflict: Asset must be in Maintenance to resolve. Current status: ${asset.status}`);
        }

        db.prepare("UPDATE assets SET status = 'Available' WHERE id = ?").run(assetId);

        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
          VALUES (?, ?, 'serialized', 'Maintenance End', 'Maintenance resolved and returned to stock')
        `).run(assetId, asset.name);
      }

      return { success: true };
    });

    const result = maintenanceTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all users
app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY name ASC').all();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new user
app.post('/api/users', (req, res) => {
  const { name, email, role, avatar } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and Email are required' });
  }
  try {
    const stmt = db.prepare('INSERT INTO users (name, email, role, avatar) VALUES (?, ?, ?, ?)');
    const result = stmt.run(name, email, role || 'Staff', avatar || name.split(' ').map(n=>n[0]).join('').toUpperCase());
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all logs (immutable ledger)
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 100').all();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get stats summary
app.get('/api/stats', (req, res) => {
  try {
    // Serialized counts
    const available = db.prepare("SELECT COUNT(*) as count FROM assets WHERE type='serialized' AND status='Available'").get().count;
    const checkedOut = db.prepare("SELECT COUNT(*) as count FROM assets WHERE type='serialized' AND status='Checked Out'").get().count;
    const maintenance = db.prepare("SELECT COUNT(*) as count FROM assets WHERE type='serialized' AND status='Maintenance'").get().count;
    
    // Bulk count: SUM(quantity_available) and SUM(quantity_total)
    const bulkStats = db.prepare("SELECT SUM(quantity_available) as available, SUM(quantity_total) as total FROM assets WHERE type='bulk'").get();

    res.json({
      serialized: {
        available,
        checkedOut,
        maintenance,
        total: available + checkedOut + maintenance
      },
      bulk: {
        available: bulkStats.available || 0,
        total: bulkStats.total || 0
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Asset
app.delete('/api/assets/:id', (req, res) => {
  const assetId = Number(req.params.id);
  try {
    const deleteTx = db.transaction(() => {
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }
      if (asset.type === 'serialized' && asset.status !== 'Available' && asset.status !== 'Maintenance') {
        throw new Error('Conflict: Cannot delete a checked out asset. Record check-in first.');
      }
      if (asset.type === 'bulk' && asset.quantity_available !== asset.quantity_total) {
        throw new Error('Conflict: Cannot delete bulk asset while units are checked out.');
      }

      // Delete customer checkouts to avoid foreign key constraints
      db.prepare('DELETE FROM customer_checkouts WHERE asset_id = ?').run(assetId);
      
      // Delete asset
      db.prepare('DELETE FROM assets WHERE id = ?').run(assetId);

      // Write log
      db.prepare(`
        INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
        VALUES (?, ?, ?, 'Delete', 'Asset removed from database catalog')
      `).run(assetId, asset.name, asset.type);

      return { success: true };
    });

    const result = deleteTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Staff User
app.delete('/api/users/:id', (req, res) => {
  const userId = Number(req.params.id);
  try {
    const deleteTx = db.transaction(() => {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const holdingAssets = db.prepare("SELECT COUNT(*) as count FROM assets WHERE current_user_id = ?").get(userId);
      if (holdingAssets.count > 0) {
        throw new Error('Conflict: Cannot delete staff user holding active checkouts.');
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(userId);
      return { success: true };
    });
    const result = deleteTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch customers
app.get('/api/customers', (req, res) => {
  try {
    const query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM customer_checkouts cc WHERE cc.customer_id = c.id AND cc.return_date IS NULL) as active_leases_count
      FROM customers c
      ORDER BY c.name ASC
    `;
    const customers = db.prepare(query).all();
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create customer
app.post('/api/customers', (req, res) => {
  const { name, contact_no, email } = req.body;
  if (!name || !contact_no) {
    return res.status(400).json({ error: 'Name and Contact number are required' });
  }
  try {
    const result = db.prepare('INSERT INTO customers (name, contact_no, email) VALUES (?, ?, ?)')
      .run(name, contact_no, email || null);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete customer
app.delete('/api/customers/:id', (req, res) => {
  const customerId = Number(req.params.id);
  try {
    const deleteTx = db.transaction(() => {
      const activeLeases = db.prepare('SELECT COUNT(*) as count FROM customer_checkouts WHERE customer_id = ? AND return_date IS NULL').get(customerId);
      if (activeLeases.count > 0) {
        throw new Error('Conflict: Cannot delete customer with active item checkouts.');
      }
      db.prepare('DELETE FROM customer_checkouts WHERE customer_id = ?').run(customerId);
      db.prepare('DELETE FROM customers WHERE id = ?').run(customerId);
      return { success: true };
    });
    const result = deleteTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fetch customer checkouts
app.get('/api/customer-checkouts', (req, res) => {
  try {
    const query = `
      SELECT cc.*, c.name as customer_name, c.contact_no as customer_contact, a.name as asset_name
      FROM customer_checkouts cc
      JOIN customers c ON cc.customer_id = c.id
      JOIN assets a ON cc.asset_id = a.id
      ORDER BY cc.id DESC
    `;
    const leases = db.prepare(query).all();
    res.json(leases);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Customer checkout
app.post('/api/customer-checkouts', (req, res) => {
  const { customerName, contactNo, email, assetId, price, warrantyInfo, quantity } = req.body;
  if (!customerName || !contactNo || !assetId || price === undefined) {
    return res.status(400).json({ error: 'Missing customer checkout specs' });
  }

  try {
    const checkoutTx = db.transaction(() => {
      let customer = db.prepare('SELECT * FROM customers WHERE name = ? AND contact_no = ?').get(customerName, contactNo);
      let customerId;
      if (!customer) {
        const stmt = db.prepare('INSERT INTO customers (name, contact_no, email) VALUES (?, ?, ?)');
        const result = stmt.run(customerName, contactNo, email || null);
        customerId = result.lastInsertRowid;
      } else {
        customerId = customer.id;
      }

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      if (asset.type === 'serialized') {
        if (asset.status !== 'Available') {
          throw new Error(`Conflict: Asset is not Available. Current status: ${asset.status}`);
        }

        db.prepare("UPDATE assets SET status = 'Checked Out' WHERE id = ?").run(assetId);

        db.prepare(`
          INSERT INTO customer_checkouts (customer_id, asset_id, serial_number, price, warranty_info)
          VALUES (?, ?, ?, ?, ?)
        `).run(customerId, assetId, asset.serial_number, Number(price), warrantyInfo || 'No Warranty');

        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
          VALUES (?, ?, 'serialized', 'Checkout', ?)
        `).run(assetId, asset.name, `Checked out to customer ${customerName} (${contactNo}) | Price: $${price} | Warranty: ${warrantyInfo || 'None'}`);
      } else {
        const qty = Number(quantity) || 1;
        if (qty <= 0) {
          throw new Error('Quantity must be greater than zero');
        }
        if (asset.quantity_available < qty) {
          throw new Error(`Conflict: Insufficient quantity. Available: ${asset.quantity_available}`);
        }

        db.prepare('UPDATE assets SET quantity_available = quantity_available - ? WHERE id = ?')
          .run(qty, assetId);

        db.prepare(`
          INSERT INTO customer_checkouts (customer_id, asset_id, serial_number, price, warranty_info)
          VALUES (?, ?, NULL, ?, ?)
        `).run(customerId, assetId, Number(price) * qty, warrantyInfo || 'No Warranty');

        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, quantity, details)
          VALUES (?, ?, 'bulk', 'Quantity Checkout', ?, ?)
        `).run(assetId, asset.name, qty, `Checked out ${qty} unit(s) to customer ${customerName} (${contactNo}) | Total Price: $${Number(price) * qty} | Warranty: ${warrantyInfo || 'None'}`);
      }

      return { success: true };
    });

    const result = checkoutTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Customer return
app.post('/api/customer-checkouts/:id/return', (req, res) => {
  const checkoutId = Number(req.params.id);
  try {
    const returnTx = db.transaction(() => {
      const checkout = db.prepare('SELECT * FROM customer_checkouts WHERE id = ?').get(checkoutId);
      if (!checkout) {
        throw new Error('Customer checkout record not found');
      }
      if (checkout.return_date) {
        throw new Error('Asset already returned');
      }

      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(checkout.asset_id);
      if (!asset) {
        throw new Error('Asset not found');
      }

      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(checkout.customer_id);
      const customerName = customer ? customer.name : 'Unknown Customer';

      db.prepare('UPDATE customer_checkouts SET return_date = CURRENT_TIMESTAMP WHERE id = ?').run(checkoutId);

      if (asset.type === 'serialized') {
        db.prepare("UPDATE assets SET status = 'Available' WHERE id = ?").run(checkout.asset_id);

        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, details)
          VALUES (?, ?, 'serialized', 'Checkin', ?)
        `).run(checkout.asset_id, asset.name, `Returned by customer ${customerName}`);
      } else {
        db.prepare('UPDATE assets SET quantity_available = MIN(quantity_total, quantity_available + 1) WHERE id = ?').run(checkout.asset_id);
        
        db.prepare(`
          INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, quantity, details)
          VALUES (?, ?, 'bulk', 'Quantity Restock', 1, ?)
        `).run(checkout.asset_id, asset.name, `Returned 1 unit by customer ${customerName}`);
      }

      return { success: true };
    });

    const result = returnTx();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
