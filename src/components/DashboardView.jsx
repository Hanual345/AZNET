import React, { useState } from 'react';
import { Play, CheckCircle, ShieldAlert, Users, Calendar, ArrowRight, User, Key, Wrench } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';

export default function DashboardView({ assets, logs, users, stats, onActionSuccess }) {
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [checkoutUser, setCheckoutUser] = useState('');
  const [bulkQty, setBulkQty] = useState(1);
  const [actionType, setActionType] = useState(''); // 'checkout' | 'checkin' | 'maintenance_start' | 'maintenance_stop'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const serializedAssets = assets.filter(a => a.type === 'serialized');
  const bulkAssets = assets.filter(a => a.type === 'bulk');

  // Trigger Action
  const openActionModal = (asset, type) => {
    setSelectedAsset(asset);
    setActionType(type);
    setCheckoutUser('');
    setBulkQty(1);
    setError('');
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const assetRef = doc(db, 'assets', selectedAsset.id);
      const assetSnap = await getDoc(assetRef);
      if (!assetSnap.exists()) throw new Error("Asset not found");
      const asset = assetSnap.data();

      if (actionType === 'checkout') {
        const qtyToCheckout = selectedAsset.type === 'bulk' ? Number(bulkQty) : 1;
        const targetUserId = checkoutUser;
        const u = users.find(user => user.id === targetUserId);
        const userName = u ? u.name : 'Unknown';

        if (selectedAsset.type === 'serialized') {
          if (asset.status !== 'Available') throw new Error(`Asset is not Available`);
          await updateDoc(assetRef, { status: 'Checked Out', current_user_id: targetUserId });
          
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'serialized',
            action: 'Checkout', user_id: targetUserId, user_name: userName,
            details: `Checked out to ${userName}`, timestamp: new Date().toISOString()
          });
        } else {
          if (asset.quantity_available < qtyToCheckout) throw new Error("Insufficient quantity.");
          await updateDoc(assetRef, { quantity_available: asset.quantity_available - qtyToCheckout });
          
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'bulk',
            action: 'Quantity Checkout', user_id: targetUserId, user_name: userName,
            quantity: qtyToCheckout, details: `Checked out ${qtyToCheckout} unit(s) to ${userName}`, timestamp: new Date().toISOString()
          });
        }
      } else if (actionType === 'checkin') {
        const qtyToCheckin = selectedAsset.type === 'bulk' ? Number(bulkQty) : 1;

        if (selectedAsset.type === 'serialized') {
          if (asset.status !== 'Checked Out') throw new Error(`Asset is not Checked Out.`);
          const u = users.find(user => user.id === asset.current_user_id);
          const userName = u ? u.name : 'Unknown';

          await updateDoc(assetRef, { status: 'Available', current_user_id: null });
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'serialized',
            action: 'Checkin', user_id: asset.current_user_id, user_name: userName,
            details: `Checked in by ${userName}`, timestamp: new Date().toISOString()
          });
        } else {
          if (asset.quantity_available + qtyToCheckin > asset.quantity_total) throw new Error("Exceeds total inventory capacity");
          await updateDoc(assetRef, { quantity_available: asset.quantity_available + qtyToCheckin });
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'bulk',
            action: 'Quantity Restock', quantity: qtyToCheckin, details: `Restocked ${qtyToCheckin} unit(s)`, timestamp: new Date().toISOString()
          });
        }
      } else if (actionType === 'maintenance_start') {
        if (asset.status === 'Available') {
          await updateDoc(assetRef, { status: 'Maintenance' });
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'serialized',
            action: 'Maintenance Start', details: 'Asset sent to maintenance', timestamp: new Date().toISOString()
          });
        } else {
           throw new Error("Asset cannot enter maintenance right now.");
        }
      } else if (actionType === 'maintenance_stop') {
        if (asset.status === 'Maintenance') {
          await updateDoc(assetRef, { status: 'Available' });
          await addDoc(collection(db, 'audit_logs'), {
            asset_id: selectedAsset.id, asset_name: asset.name, asset_type: 'serialized',
            action: 'Maintenance End', details: 'Maintenance resolved', timestamp: new Date().toISOString()
          });
        } else {
           throw new Error("Asset cannot leave maintenance right now.");
        }
      }

      onActionSuccess();
      setSelectedAsset(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Humanize Timestamp
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP-LEVEL METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Available Serialized */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none transition group-hover:bg-cyan-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Available Assets</span>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 pulse-cyan" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white glow-cyan font-mono">
              {stats.serialized?.available ?? 0}
            </span>
            <span className="text-xs text-slate-500">units in stock</span>
          </div>
        </div>

        {/* Checked Out */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl pointer-events-none transition group-hover:bg-purple-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Checked Out</span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono" style={{ textShadow: '0 0 8px rgba(167, 139, 250, 0.4)' }}>
              {stats.serialized?.checkedOut ?? 0}
            </span>
            <span className="text-xs text-slate-500">deployed in field</span>
          </div>
        </div>

        {/* Maintenance */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none transition group-hover:bg-amber-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">In Maintenance</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 pulse-amber" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white glow-amber font-mono">
              {stats.serialized?.maintenance ?? 0}
            </span>
            <span className="text-xs text-slate-500">at repair depot</span>
          </div>
        </div>

        {/* Bulk Inventory */}
        <div className="glass-card p-5 rounded-xl border border-slate-800 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none transition group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Bulk Consumables</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white glow-emerald font-mono">
              {stats.bulk?.available ?? 0}
            </span>
            <span className="text-xs text-slate-500">/ {stats.bulk?.total ?? 0} total stock</span>
          </div>
        </div>
      </div>

      {/* 2. SPLIT LAYOUT: STATUS OVERVIEW TABLE & LIVE AUDIT FEED */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* LEFT / CENTER: STATUS OVERVIEW TABLE */}
        <div className="lg:col-span-3 glass-card rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Status Overview</h3>
                <p className="text-xs text-slate-400 mt-1">Real-time tracker for high-value serialized hardware assets</p>
              </div>
              <span className="text-xs bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400 font-medium">
                {serializedAssets.length} Serialized Items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Asset Name</th>
                    <th className="py-4 px-6">Category</th>
                    <th className="py-4 px-6">Serial Number</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Location</th>
                    <th className="py-4 px-6">Assignee</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {serializedAssets.map(asset => (
                    <tr key={asset.id} className="hover:bg-slate-900/20 transition group">
                      <td className="py-3.5 px-6 font-semibold text-white group-hover:text-cyan-400 transition">
                        {asset.name}
                      </td>
                      <td className="py-3.5 px-6 text-slate-300">{asset.category}</td>
                      <td className="py-3.5 px-6 font-mono text-xs text-slate-400">{asset.serial_number}</td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          asset.status === 'Available' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                          asset.status === 'Checked Out' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            asset.status === 'Available' ? 'bg-cyan-400 pulse-cyan' :
                            asset.status === 'Checked Out' ? 'bg-purple-400' :
                            'bg-amber-500 pulse-amber'
                          }`} />
                          {asset.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-400">{asset.location}</td>
                      <td className="py-3.5 px-6 font-medium">
                        {asset.status === 'Checked Out' ? (
                          <span className="text-cyan-400 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {asset.current_user_name || 'Staff Member'}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <div className="flex justify-end gap-2">
                          {asset.status === 'Available' && (
                            <>
                              <button
                                onClick={() => openActionModal(asset, 'checkout')}
                                className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition"
                              >
                                Checkout
                              </button>
                              <button
                                onClick={() => openActionModal(asset, 'maintenance_start')}
                                className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1.5 rounded text-xs transition"
                              >
                                Repair
                              </button>
                            </>
                          )}

                          {asset.status === 'Checked Out' && (
                            <button
                              onClick={() => openActionModal(asset, 'checkin')}
                              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition"
                            >
                              Check-in
                            </button>
                          )}

                          {asset.status === 'Maintenance' && (
                            <button
                              onClick={() => openActionModal(asset, 'maintenance_stop')}
                              className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/20 font-bold px-3 py-1.5 rounded text-xs transition"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Table Footer */}
          <div className="p-4 border-t border-slate-900/60 bg-slate-950/20 flex justify-between text-xs text-slate-500">
            <span>Showing all active tracked serialized units</span>
            <span>Local process database offline-first</span>
          </div>
        </div>

        {/* RIGHT: LIVE AUDIT LOG FEED */}
        <div className="glass-card rounded-xl border border-slate-800 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Live Audit Log</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Immutable record updates tracked in real-time</p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[480px] divide-y divide-slate-900">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No logs recorded.
              </div>
            ) : (
              logs.map((log) => {
                // Determine vertical badge border color
                let borderColor = 'border-l-cyan-500';
                if (log.action.includes('Checkout')) borderColor = 'border-l-purple-500';
                if (log.action.includes('Checkin') || log.action.includes('Restock')) borderColor = 'border-l-emerald-500';
                if (log.action.includes('Maintenance')) borderColor = 'border-l-amber-500';

                return (
                  <div key={log.id} className={`p-4 border-l-4 ${borderColor} bg-slate-950/10 hover:bg-slate-900/10 transition log-item-fade`}>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                    <h5 className="text-white text-xs font-semibold mt-1">{log.asset_name}</h5>
                    <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{log.details}</p>
                    {log.user_name && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                        <User className="w-3 h-3" />
                        <span>Logged by {log.user_name}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Feed Footer */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/20 text-center text-[10px] text-slate-500 font-mono">
            System logs locked to trigger protection
          </div>
        </div>
      </div>

      {/* 3. INTERACTIVE CONTEXT MODAL FOR TABLE ACTION */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl relative animate-scale-up">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              {actionType === 'checkout' && <Key className="w-5 h-5 text-cyan-400" />}
              {actionType === 'checkin' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
              {(actionType === 'maintenance_start' || actionType === 'maintenance_stop') && <Wrench className="w-5 h-5 text-amber-500" />}
              <span>
                {actionType === 'checkout' && 'Checkout Asset'}
                {actionType === 'checkin' && 'Process Return (Check-in)'}
                {actionType === 'maintenance_start' && 'Send to Maintenance'}
                {actionType === 'maintenance_stop' && 'Resolve Maintenance'}
              </span>
            </h3>

            <div className="mt-4">
              <div className="text-sm text-slate-300">
                <span className="text-slate-500 block text-xs uppercase font-bold">Asset Name</span>
                <span className="font-semibold text-white text-base">{selectedAsset.name}</span>
                {selectedAsset.type === 'serialized' && (
                  <span className="text-xs font-mono text-slate-400 block mt-0.5">S/N: {selectedAsset.serial_number}</span>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-950/50 border border-red-800 rounded-lg flex items-center gap-2 text-xs text-red-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleActionSubmit} className="mt-5 space-y-4">
              {/* Checkout Form */}
              {actionType === 'checkout' && (
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1.5">Assign User</label>
                  <select
                    value={checkoutUser}
                    onChange={(e) => setCheckoutUser(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                    required
                  >
                    <option value="">Select Staff Member</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Confirmation text for Returns/Maintenance */}
              {actionType === 'checkin' && (
                <p className="text-xs text-slate-400">
                  Are you sure you want to log a return for this asset? The status will immediately revert to <span className="text-cyan-400 font-bold">Available</span>.
                </p>
              )}

              {actionType === 'maintenance_start' && (
                <p className="text-xs text-slate-400">
                  This will flag the asset as <span className="text-amber-400 font-bold">Maintenance</span>. It will be restricted from future checkout requests until the maintenance status is resolved.
                </p>
              )}

              {actionType === 'maintenance_stop' && (
                <p className="text-xs text-slate-400">
                  This will restore the status to <span className="text-cyan-400 font-bold">Available</span>, indicating servicing is complete and the asset is ready for deployment.
                </p>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setSelectedAsset(null)}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-xs font-bold text-slate-950 transition flex items-center gap-1.5 ${
                    actionType === 'checkout' ? 'bg-cyan-600 hover:bg-cyan-500' :
                    actionType === 'checkin' ? 'bg-emerald-600 hover:bg-emerald-500' :
                    'bg-amber-600 hover:bg-amber-500'
                  }`}
                >
                  {loading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
