import React, { useState } from 'react';
import { Package, Plus, Clipboard, MapPin, DollarSign, Eye, Tag, AlertCircle, ArrowRight, UserCheck, Trash2 } from 'lucide-react';

export default function InventoryView({ assets, users, currentUser, onActionSuccess, onDeleteAsset }) {
  const [activeTab, setActiveTab] = useState('serialized'); // 'serialized' | 'bulk'
  const [showAddForm, setShowAddForm] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');

  const myRole = users.find(u => u.email === currentUser?.email)?.role || 'Guest';
  const isAdmin = myRole === 'Administrator';

  // Form State
  const [name, setName] = useState('');
  const [type, setType] = useState('serialized');
  const [category, setCategory] = useState('Cameras');
  const [serialNumber, setSerialNumber] = useState('');
  const [quantityTotal, setQuantityTotal] = useState(1);
  const [location, setLocation] = useState('');
  const [cost, setCost] = useState('');
  const [accessRole, setAccessRole] = useState('All');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Asset action forms (embedded in inventory details)
  const [activeActionAsset, setActiveActionAsset] = useState(null);
  const [actionType, setActionType] = useState(''); // 'checkout' | 'checkin'
  const [checkoutUser, setCheckoutUser] = useState('');
  const [actionQty, setActionQty] = useState(1);
  const [actionError, setActionError] = useState('');

  const filteredAssets = assets
    .filter(a => a.type === activeTab)
    .filter(a => categoryFilter === 'All' || a.category === categoryFilter);

  // Extract unique categories for filter dropdown
  const categories = ['All', ...new Set(assets.filter(a => a.type === activeTab).map(a => a.category))];

  const handleAddAsset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!name || !location || !cost) {
      setError('Please fill in all basic fields');
      setLoading(false);
      return;
    }

    if (type === 'serialized' && !serialNumber) {
      setError('Serial number is required for serialized items');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type,
          category,
          serial_number: type === 'serialized' ? serialNumber : null,
          quantity_total: type === 'bulk' ? Number(quantityTotal) : null,
          location,
          cost: Number(cost),
          access_role: accessRole
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add asset');

      // Clear Form
      setName('');
      setSerialNumber('');
      setQuantityTotal(1);
      setLocation('');
      setCost('');
      setAccessRole('All');
      setShowAddForm(false);
      onActionSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssetAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setActionError('');

    let endpoint = '';
    let body = {};

    if (actionType === 'checkout') {
      endpoint = `/api/assets/${activeActionAsset.id}/checkout`;
      body = {
        userId: Number(checkoutUser),
        quantity: activeActionAsset.type === 'bulk' ? Number(actionQty) : 1
      };
    } else if (actionType === 'checkin') {
      endpoint = `/api/assets/${activeActionAsset.id}/checkin`;
      body = {
        quantity: activeActionAsset.type === 'bulk' ? Number(actionQty) : 1
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Operation failed');

      setActiveActionAsset(null);
      setActionType('');
      setCheckoutUser('');
      setActionQty(1);
      onActionSuccess();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. VIEW CONTROL HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900">
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start">
          <button
            onClick={() => { setActiveTab('serialized'); setCategoryFilter('All'); setActiveActionAsset(null); }}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'serialized'
                ? 'bg-cyan-600 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Serialized Hardware
          </button>
          <button
            onClick={() => { setActiveTab('bulk'); setCategoryFilter('All'); setActiveActionAsset(null); }}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'bulk'
                ? 'bg-cyan-600 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bulk Consumables
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
            ))}
          </select>

          {/* Add Trigger */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {/* 2. ADD ASSET FORM COLLAPSIBLE */}
      {showAddForm && (
        <form onSubmit={handleAddAsset} className="glass-card p-6 rounded-xl border border-slate-800 space-y-4 animate-slide-in">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3">
            <h4 className="text-white font-bold text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span>Catalog New Inventory Asset</span>
            </h4>
            <span className="text-[10px] text-slate-500 uppercase font-mono">Input item metadata specs</span>
          </div>

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Asset Title / Name</label>
              <input
                type="text"
                placeholder="e.g. Sony Alpha 7S III"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Inventory Tracking Class</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value); setCategory(e.target.value === 'serialized' ? 'Cameras' : 'Cables'); }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="serialized">Serialized (High-Value Unique Item)</option>
                <option value="bulk">Bulk (Consumable Quantity Stack)</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Category Tag</label>
              {type === 'serialized' ? (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="Cameras">Cameras</option>
                  <option value="Tools">Tools</option>
                  <option value="Laptops">Laptops</option>
                  <option value="Gimbal">Gimbal</option>
                  <option value="Audio">Audio</option>
                  <option value="Other">Other Equipment</option>
                </select>
              ) : (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="Cables">Cables</option>
                  <option value="Power">Power / Chargers</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Other">Other Consumables</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Conditional S/N or Quantity */}
            {type === 'serialized' ? (
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Hardware Serial Number</label>
                <input
                  type="text"
                  placeholder="e.g. SN-CAM-89021"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            ) : (
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Initial Pack Quantity (Total)</label>
                <input
                  type="number"
                  min="1"
                  value={quantityTotal}
                  onChange={(e) => setQuantityTotal(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            )}

            {/* Location */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Physical Shelf Location</label>
              <input
                type="text"
                placeholder="e.g. Studio Room Bin A4"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            {/* Cost */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Cost per Unit ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 599.99"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            {/* Access Role (Admin Only) */}
            {isAdmin && (
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                  Visibility Restrictions
                </label>
                <select
                  value={accessRole}
                  onChange={(e) => setAccessRole(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-medium"
                >
                  <option value="All">All Staff (Public)</option>
                  <option value="Administrator">Administrators Only</option>
                  <option value="Technician">Technicians Only</option>
                  <option value="Field Engineer">Field Engineers Only</option>
                  <option value="Media Producer">Media Producers Only</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-slate-900">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition"
            >
              {loading ? 'Creating...' : 'Save Asset to DB'}
            </button>
          </div>
        </form>
      )}

      {/* 3. INVENTORY CONTAINER CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAssets.length === 0 ? (
          <div className="col-span-full py-16 text-center text-xs text-slate-500 bg-slate-950/10 rounded-xl border border-dashed border-slate-800">
            No tracked items matched filters.
          </div>
        ) : (
          filteredAssets.map(asset => {
            const isSelectedAction = activeActionAsset?.id === asset.id;

            return (
              <div
                key={asset.id}
                className="glass-card rounded-xl border border-slate-800 p-5 flex flex-col justify-between glass-card-hover relative"
              >
                {/* Visual Header */}
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-2">
                      {asset.category}
                      {asset.access_role && asset.access_role !== 'All' && (
                        <span title={`Restricted to ${asset.access_role}`} className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded flex items-center gap-1 border border-purple-500/30">
                          <Eye className="w-3 h-3" />
                          {asset.access_role}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        asset.type === 'serialized'
                          ? asset.status === 'Available' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
                            asset.status === 'Checked Out' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {asset.type === 'serialized' ? asset.status : 'Bulk'}
                      </span>
                      {onDeleteAsset && (
                        <button
                          onClick={() => onDeleteAsset(asset.id)}
                          className="text-slate-600 hover:text-red-400 p-0.5 rounded transition"
                          title="Remove Asset Catalog File"
                          disabled={asset.status === 'Checked Out' || (asset.type === 'bulk' && asset.quantity_available !== asset.quantity_total)}
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${
                            (asset.status === 'Checked Out' || (asset.type === 'bulk' && asset.quantity_available !== asset.quantity_total))
                              ? 'opacity-20 cursor-not-allowed'
                              : ''
                          }`} />
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="text-white font-bold text-sm mt-2">{asset.name}</h4>
                  
                  {/* Location spec */}
                  <div className="mt-3 flex items-center gap-1 text-[11px] text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>{asset.location}</span>
                  </div>

                  {/* Serial Spec for Serialized */}
                  {asset.type === 'serialized' && (
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Tag className="w-3.5 h-3.5 text-slate-600" />
                      <span>S/N: {asset.serial_number}</span>
                    </div>
                  )}

                  {/* Costing */}
                  <div className="mt-2.5 flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                    <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                    <span>Value: ${asset.cost.toFixed(2)}</span>
                  </div>

                  {/* Quantity and Progress bar for Bulk */}
                  {asset.type === 'bulk' && (
                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-400">Available Stock:</span>
                        <span className="text-emerald-400 font-bold">{asset.quantity_available} / {asset.quantity_total}</span>
                      </div>
                      {/* Bar */}
                      <div className="w-full bg-slate-900 h-2 rounded overflow-hidden border border-slate-800">
                        <div
                          className="bg-emerald-500 h-full rounded-r transition-all duration-500"
                          style={{ width: `${(asset.quantity_available / asset.quantity_total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Forms */}
                <div className="border-t border-slate-900 pt-4 mt-4">
                  {/* Default State Actions */}
                  {!isSelectedAction ? (
                    <div className="flex items-center justify-between text-xs">
                      {asset.type === 'serialized' ? (
                        <>
                          <span className="text-slate-500 font-medium">
                            {asset.status === 'Checked Out' ? `Checked out to ${asset.current_user_name || 'Staff'}` : 'In Stock'}
                          </span>
                          <button
                            onClick={() => {
                              if (asset.status === 'Available') {
                                openActionModal(asset, 'checkout');
                                setActiveActionAsset(asset);
                                setActionType('checkout');
                              } else if (asset.status === 'Checked Out') {
                                openActionModal(asset, 'checkin');
                                setActiveActionAsset(asset);
                                setActionType('checkin');
                              }
                            }}
                            disabled={asset.status === 'Maintenance'}
                            className={`font-bold px-3 py-1.5 rounded transition ${
                              asset.status === 'Available' ? 'bg-cyan-600 hover:bg-cyan-500 text-slate-950' :
                              asset.status === 'Checked Out' ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950' :
                              'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                            }`}
                          >
                            {asset.status === 'Available' && 'Checkout'}
                            {asset.status === 'Checked Out' && 'Check-in'}
                            {asset.status === 'Maintenance' && 'Repairs'}
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-500 font-medium">
                            Total value: ${(asset.cost * asset.quantity_total).toFixed(2)}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                openActionModal(asset, 'checkout');
                                setActiveActionAsset(asset);
                                setActionType('checkout');
                              }}
                              disabled={asset.quantity_available <= 0}
                              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-bold px-2 py-1 rounded text-xs transition"
                            >
                              Out
                            </button>
                            <button
                              onClick={() => {
                                openActionModal(asset, 'checkin');
                                setActiveActionAsset(asset);
                                setActionType('checkin');
                              }}
                              disabled={asset.quantity_available >= asset.quantity_total}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-2 py-1 rounded text-xs transition"
                            >
                              In
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Inline action drawer form */
                    <form onSubmit={handleAssetAction} className="space-y-3 animate-fade-in text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white uppercase">
                          {actionType === 'checkout' ? 'Checkout spec' : 'Check-in spec'}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setActiveActionAsset(null); setActionType(''); }}
                          className="text-slate-500 hover:text-white text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>

                      {actionError && (
                        <p className="text-[10px] text-red-400 font-medium bg-red-950/20 p-2 border border-red-900 rounded">
                          {actionError}
                        </p>
                      )}

                      {actionType === 'checkout' && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Assign Staff</label>
                          <select
                            value={checkoutUser}
                            onChange={(e) => setCheckoutUser(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                            required
                          >
                            <option value="">Select User</option>
                            {users.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {asset.type === 'bulk' && (
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1 font-semibold">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            max={actionType === 'checkout' ? asset.quantity_available : (asset.quantity_total - asset.quantity_available)}
                            value={actionQty}
                            onChange={(e) => setActionQty(Math.max(1, Number(e.target.value)))}
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-1.5 rounded font-bold text-xs text-slate-950 transition ${
                          actionType === 'checkout' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-emerald-600 hover:bg-emerald-500'
                        }`}
                      >
                        {loading ? 'Executing...' : 'Confirm'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  function openActionModal(asset, type) {
    setActionError('');
  }
}
