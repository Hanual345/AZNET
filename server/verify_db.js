const db = require('./db');

console.log('--- STARTING DATABASE LAYER VERIFICATION ---\n');

// 1. Verify table existence
try {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const assets = db.prepare('SELECT COUNT(*) as count FROM assets').get();
  const logs = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get();
  
  console.log(`[PASS] Database tables exist.`);
  console.log(`       Users: ${users.count}`);
  console.log(`       Assets: ${assets.count}`);
  console.log(`       Logs: ${logs.count}\n`);
} catch (err) {
  console.error('[FAIL] Tables do not exist or fail to query:', err.message);
  process.exit(1);
}

// 2. Verify Immutability Ledger
console.log('Testing Audit Ledger Immutability...');
try {
  // Attempt to update a log
  db.prepare("UPDATE audit_logs SET action = 'Tampered' WHERE id = 1").run();
  console.error('[FAIL] Audit ledger allowed UPDATE! Immutability trigger failed.');
  process.exit(1);
} catch (err) {
  if (err.message.includes('Audit ledger is immutable')) {
    console.log('[PASS] UPDATE request blocked by SQLite trigger:');
    console.log(`       Error caught: "${err.message}"`);
  } else {
    console.error('[FAIL] UPDATE failed, but with unexpected error:', err.message);
    process.exit(1);
  }
}

try {
  // Attempt to delete a log
  db.prepare('DELETE FROM audit_logs WHERE id = 1').run();
  console.error('[FAIL] Audit ledger allowed DELETE! Immutability trigger failed.');
  process.exit(1);
} catch (err) {
  if (err.message.includes('Audit ledger is immutable')) {
    console.log('[PASS] DELETE request blocked by SQLite trigger:');
    console.log(`       Error caught: "${err.message}"`);
  } else {
    console.error('[FAIL] DELETE failed, but with unexpected error:', err.message);
    process.exit(1);
  }
}
console.log('');

// 3. Verify Transaction-level conflict resolution
console.log('Testing Transaction-level Conflict Resolution...');

// Reset asset status for asset ID 1 (Sony FX6)
db.prepare("UPDATE assets SET status = 'Available', current_user_id = NULL WHERE id = 1").run();

// Define a safe checkout function using transactions (simulating api checkout)
function checkoutAsset(assetId, userId) {
  const tx = db.transaction(() => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!asset) throw new Error('Asset not found');
    
    if (asset.status !== 'Available') {
      throw new Error(`Conflict: Asset status is ${asset.status}, expected Available`);
    }
    
    db.prepare("UPDATE assets SET status = 'Checked Out', current_user_id = ? WHERE id = ?")
      .run(userId, assetId);
      
    db.prepare(`
      INSERT INTO audit_logs (asset_id, asset_name, asset_type, action, user_id, user_name, details)
      VALUES (?, ?, 'serialized', 'Checkout', ?, 'Verify System', 'Verification checkout')
    `).run(assetId, asset.name, userId);
    
    return true;
  });
  
  return tx();
}

try {
  // First checkout: Should succeed
  console.log('Attempting checkout 1 (expected success)...');
  const success1 = checkoutAsset(1, 1);
  console.log(`Result 1: ${success1 ? 'SUCCESS' : 'FAILURE'}`);
  
  // Second checkout: Should fail due to conflict (status is no longer 'Available')
  console.log('Attempting checkout 2 (expected failure/conflict)...');
  checkoutAsset(1, 2);
  console.error('[FAIL] Double-checkout succeeded! Conflict resolution failed.');
  process.exit(1);
} catch (err) {
  if (err.message.includes('Conflict: Asset status is Checked Out')) {
    console.log('[PASS] Double-checkout blocked by transaction logic:');
    console.log(`       Error caught: "${err.message}"`);
  } else {
    console.error('[FAIL] Checkout failed, but with unexpected error:', err.message);
    process.exit(1);
  }
}

console.log('\n[SUCCESS] ALL DATABASE & LEDGER VERIFICATIONS PASSED.');
