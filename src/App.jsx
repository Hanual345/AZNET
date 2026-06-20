import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  FolderSync, 
  History, 
  Users as UsersIcon, 
  BarChart3, 
  Settings as SettingsIcon, 
  Activity,
  Compass, 
  ShieldAlert, 
  Info,
  Server,
  Database,
  Search,
  Plus,
  Trash2,
  Download,
  LogOut,
  Check,
  Phone
} from 'lucide-react';
import { db, auth, signOut, onAuthStateChanged } from './firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, setDoc } from 'firebase/firestore';
import DashboardView from './components/DashboardView';
import InventoryView from './components/InventoryView';
import LogsView from './components/LogsView';
import ThreeDashboard from './components/ThreeDashboard';


export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [assets, setAssets] = useState([]);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ serialized: {}, bulk: {} });
  const [customers, setCustomers] = useState([]);
  const [customerCheckouts, setCustomerCheckouts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [dbStatus, setDbStatus] = useState('Connected');
  const [loading, setLoading] = useState(true);

  // Users Form State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Staff');
  const [userError, setUserError] = useState('');

  // Customer Checkout Form State
  const [custName, setCustName] = useState('');
  const [custContact, setCustContact] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custAssetId, setCustAssetId] = useState('');
  const [custPrice, setCustPrice] = useState('');
  const [custWarranty, setCustWarranty] = useState('12 Months Warranty');
  const [custQty, setCustQty] = useState(1);
  const [checkoutError, setCheckoutError] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Customer Directory Form State
  const [showAddCust, setShowAddCust] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustContact, setNewCustContact] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [custError, setCustError] = useState('');

  // Search Filter for Customers
  const [custSearch, setCustSearch] = useState('');

  // Custom Delete Modal State
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Track currently logged-in Firebase user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setLoading(true);

    const unsubAssets = onSnapshot(query(collection(db, 'assets'), orderBy('created_at', 'desc')), (snapshot) => {
      const assetsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssets(assetsData);
    });

    const unsubLogs = onSnapshot(query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc')), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubCheckouts = onSnapshot(collection(db, 'customer_checkouts'), (snapshot) => {
      setCustomerCheckouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    setDbStatus('Connected');
    setLoading(false);

    return () => {
      unsubAssets();
      unsubLogs();
      unsubUsers();
      unsubCustomers();
      unsubCheckouts();
    };
  }, []);

  // Compute stats locally whenever assets change
  useEffect(() => {
    const available = assets.filter(a => a.type === 'serialized' && a.status === 'Available').length;
    const checkedOut = assets.filter(a => a.type === 'serialized' && a.status === 'Checked Out').length;
    const maintenance = assets.filter(a => a.type === 'serialized' && a.status === 'Maintenance').length;
    const bulkAvailable = assets.filter(a => a.type === 'bulk').reduce((sum, a) => sum + (a.quantity_available || 0), 0);
    const bulkTotal = assets.filter(a => a.type === 'bulk').reduce((sum, a) => sum + (a.quantity_total || 0), 0);
    
    setStats({
      serialized: { available, checkedOut, maintenance, total: available + checkedOut + maintenance },
      bulk: { available: bulkAvailable, total: bulkTotal }
    });
  }, [assets]);

  // Deletion Handlers
  const handleDeleteAsset = (assetId) => {
    setDeleteModal({
      isOpen: true,
      title: 'Delete Asset',
      message: 'Are you sure you want to delete this asset from the database? This will permanently wipe customer checkout lease records for this item.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'assets', assetId));
          setDeleteModal({ ...deleteModal, isOpen: false });
        } catch (err) {
          alert(`Delete Error: ${err.message}`);
        }
      }
    });
  };

  const handleDeleteUser = (userId) => {
    setDeleteModal({
      isOpen: true,
      title: 'Remove Staff',
      message: 'Are you sure you want to remove this staff member?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          setDeleteModal({ ...deleteModal, isOpen: false });
        } catch (err) {
          alert(`Delete Error: ${err.message}`);
        }
      }
    });
  };

  const handleDeleteCustomer = (customerId) => {
    setDeleteModal({
      isOpen: true,
      title: 'Remove Customer',
      message: 'Are you sure you want to remove this customer file?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'customers', customerId));
          setDeleteModal({ ...deleteModal, isOpen: false });
        } catch (err) {
          alert(`Delete Error: ${err.message}`);
        }
      }
    });
  };

  // Staff registration
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    if (!newUserName || !newUserEmail) return;

    try {
      const newRef = doc(collection(db, 'users'));
      await setDoc(newRef, {
        name: newUserName,
        email: newUserEmail,
        role: newUserRole
      });
      
      setNewUserName('');
      setNewUserEmail('');
      setShowAddUser(false);
    } catch (err) {
      setUserError(err.message);
    }
  };

  // Customer registration
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    setCustError('');
    if (!newCustName || !newCustContact) return;

    try {
      const newRef = doc(collection(db, 'customers'));
      await setDoc(newRef, {
        name: newCustName,
        contact_no: newCustContact,
        email: newCustEmail
      });

      setNewCustName('');
      setNewCustContact('');
      setNewCustEmail('');
      setShowAddCust(false);
    } catch (err) {
      setCustError(err.message);
    }
  };

  // Customer checkout receipt downloader
  const downloadReceipt = (checkoutDetails) => {
    const receiptContent = `================================================
               AZNET HARDWARE INVOICE
                  OFFLINE LEDGER
================================================
Transaction ID : CC-INV-${checkoutDetails.id || Math.floor(Math.random()*90000+10000)}
Checkout Date  : ${new Date().toLocaleString()}
------------------------------------------------
CUSTOMER DETAILS:
Name           : ${checkoutDetails.customerName}
Contact No     : ${checkoutDetails.contactNo}
Email          : ${checkoutDetails.email || 'N/A'}

HARDWARE LEASE DETAILS:
Asset Name     : ${checkoutDetails.assetName}
Serial Number  : ${checkoutDetails.serialNumber || 'BULK QUANTITY STACK'}
Quantity Leased: ${checkoutDetails.quantity || 1}

FINANCIALS & TERMS:
Warranty Terms : ${checkoutDetails.warrantyInfo}
Unit Price     : $${Number(checkoutDetails.price).toFixed(2)}
Total Paid     : $${(Number(checkoutDetails.price) * (Number(checkoutDetails.quantity) || 1)).toFixed(2)}
------------------------------------------------
STATUS         : ACTIVE LEASE AGREEMENT
Ledger Lock    : SECURE DATABASE CRYPTO-LOCK
================================================
Thank you for doing business with AZNET!
`;
    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `aznet_receipt_${checkoutDetails.customerName.replace(/\s+/g, '_')}_INV.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Customer checkout submit
  const handleCustomerCheckout = async (e) => {
    e.preventDefault();
    setCheckoutError('');
    setCheckoutLoading(true);
    setCheckoutError('');

    const selectedAsset = assets.find(a => a.id === custAssetId);
    if (!selectedAsset) {
      setCheckoutError('Invalid asset selected.');
      setCheckoutLoading(false);
      return;
    }

    try {
      const assetRef = doc(db, 'assets', selectedAsset.id);
      
      // Look for customer or create
      const custQ = query(collection(db, 'customers'), where('name', '==', custName), where('contact_no', '==', custContact));
      const custSnaps = await getDocs(custQ);
      let customerId;
      if (custSnaps.empty) {
        const newCustRef = await addDoc(collection(db, 'customers'), {
          name: custName, contact_no: custContact, email: custEmail, created_at: new Date().toISOString()
        });
        customerId = newCustRef.id;
      } else {
        customerId = custSnaps.docs[0].id;
      }

      const qty = selectedAsset.type === 'bulk' ? Number(custQty) : 1;

      if (selectedAsset.type === 'serialized') {
        if (selectedAsset.status !== 'Available') throw new Error("Asset is not available");
        await updateDoc(assetRef, { status: 'Checked Out' });
      } else {
        if (selectedAsset.quantity_available < qty) throw new Error("Insufficient quantity");
        await updateDoc(assetRef, { quantity_available: selectedAsset.quantity_available - qty });
      }

      const newCheckoutRef = await addDoc(collection(db, 'customer_checkouts'), {
        customer_id: customerId,
        customer_name: custName,
        customer_contact: custContact,
        asset_id: selectedAsset.id,
        asset_name: selectedAsset.name,
        serial_number: selectedAsset.serial_number || null,
        price: Number(custPrice),
        warranty_info: custWarranty || 'No Warranty',
        checkout_date: new Date().toISOString(),
        return_date: null
      });

      await addDoc(collection(db, 'audit_logs'), {
        asset_id: selectedAsset.id, asset_name: selectedAsset.name, asset_type: selectedAsset.type,
        action: selectedAsset.type === 'serialized' ? 'Checkout' : 'Quantity Checkout',
        quantity: qty, details: `Checked out to customer ${custName}`, timestamp: new Date().toISOString()
      });

      // Download transaction receipt spec
      downloadReceipt({
        id: newCheckoutRef.id,
        customerName: custName,
        contactNo: custContact,
        email: custEmail,
        assetName: selectedAsset.name,
        serialNumber: selectedAsset.serial_number,
        price: Number(custPrice),
        warrantyInfo: custWarranty,
        quantity: qty
      });

      // Clear Form states
      setCustName('');
      setCustContact('');
      setCustEmail('');
      setCustAssetId('');
      setCustPrice('');
      setCustQty(1);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Customer Return lease
  const handleCustomerReturn = (checkoutId) => {
    setDeleteModal({
      isOpen: true,
      title: 'Process Return',
      message: 'Process return and set hardware back in available stock?',
      onConfirm: async () => {
        try {
          const checkoutRef = doc(db, 'customer_checkouts', checkoutId);
          const checkoutSnap = await getDoc(checkoutRef);
          if (!checkoutSnap.exists()) throw new Error("Checkout record not found");
          const checkout = checkoutSnap.data();

          const assetRef = doc(db, 'assets', checkout.asset_id);
          const assetSnap = await getDoc(assetRef);
          
          await updateDoc(checkoutRef, { return_date: new Date().toISOString() });

          if (assetSnap.exists()) {
            const asset = assetSnap.data();
            if (asset.type === 'serialized') {
              await updateDoc(assetRef, { status: 'Available' });
            } else {
              await updateDoc(assetRef, { quantity_available: Math.min(asset.quantity_total, asset.quantity_available + 1) });
            }
            await addDoc(collection(db, 'audit_logs'), {
              asset_id: checkout.asset_id, asset_name: asset.name, asset_type: asset.type,
              action: 'Checkin', details: `Returned by customer ${checkout.customer_name}`, timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          alert(`Return Error: ${err.message}`);
        }
      }
    });
  };

  // Pre-populate price on asset select
  const handleAssetSelectChange = (assetIdVal) => {
    setCustAssetId(assetIdVal);
    const asset = assets.find(a => a.id === assetIdVal);
    if (asset) {
      setCustPrice(asset.cost);
    } else {
      setCustPrice('');
    }
  };

  // Filtered customer profiles for Directory
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
    c.contact_no.includes(custSearch) ||
    (c.email && c.email.toLowerCase().includes(custSearch.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#080b11] cyber-grid flex text-slate-100 selection:bg-cyan-500 selection:text-slate-950 overflow-hidden">
        
        {/* 1. CYBERPUNK SIDEBAR */}
        <aside className="w-64 bg-[#0a0f19]/90 border-r border-slate-900 flex flex-col justify-between shrink-0">
          <div>
            {/* Logo Brand */}
            <div className="p-6 border-b border-slate-900 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="font-extrabold text-slate-950 font-mono text-base">AZ</span>
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-wider uppercase m-0 leading-none">AZNET</h2>
                <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest font-mono">Manager</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="p-4 space-y-1.5">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { id: '3d', label: '3D Playground', icon: Compass },
                { id: 'inventory', label: 'Inventory', icon: Package },
                { id: 'customer_checkout', label: 'Customer Checkout', icon: FolderSync },
                { id: 'customer_directory', label: 'Customer Profiles', icon: UsersIcon },
                { id: 'users', label: 'Staff Registry', icon: UsersIcon },
                { id: 'reports', label: 'Reports', icon: BarChart3 },
                { id: 'logs', label: 'Audit Logs', icon: History },
                { id: 'settings', label: 'Settings', icon: SettingsIcon },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 group ${
                      isActive 
                        ? 'bg-cyan-600/10 text-cyan-400 border border-cyan-500/20 shadow-md font-bold' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                      isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'
                    }`} />
                    <span>{tab.label}</span>
                    {tab.id === '3d' && (
                      <span className="ml-auto text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest font-extrabold">3D</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Database & Health status metrics */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/20 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold uppercase font-mono">SQLite Link</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'Connected' ? 'bg-cyan-400 pulse-cyan' : 'bg-red-500'}`} />
                <span className={`font-bold ${dbStatus === 'Connected' ? 'text-cyan-400' : 'text-red-400'}`}>{dbStatus}</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-semibold uppercase font-mono">Process Latency</span>
              <span className="text-slate-400 font-mono font-semibold">1ms (Local)</span>
            </div>
          </div>
        </aside>

        {/* 2. MAIN SECTION */}
        <main className="flex-1 flex flex-col min-w-0">
          
          {/* Top Header */}
          <header className="h-16 border-b border-slate-900 bg-[#0a0f19]/40 backdrop-blur-md px-8 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white m-0 tracking-wider capitalize">
                {activeTab === 'customer_checkout' ? 'Customer Checkout' : activeTab === 'customer_directory' ? 'Customer Profiles' : activeTab === '3d' ? 'Interactive 3D Visualizer' : activeTab === 'users' ? 'Staff Registry' : activeTab}
              </h1>
              <span className="text-[10px] text-slate-500 font-mono border border-slate-800 rounded px-1.5 py-0.5 uppercase">
                Offline Workspace Mode
              </span>
            </div>
            
            <div className="flex items-center gap-6">
              {currentUser && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 font-mono">Authenticated: {currentUser.email}</span>
                  <button 
                    onClick={() => signOut(auth)}
                    className="bg-slate-900/60 hover:bg-slate-900 text-slate-400 hover:text-red-400 border border-slate-800 px-3 py-1.5 rounded-lg transition text-xs flex items-center gap-1.5 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
              <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400 font-medium">Local SQLite Engine</span>
              </div>
            </div>
          </header>

          {/* Content View Area */}
          <div className="flex-1 overflow-y-auto p-8 max-w-7xl w-full mx-auto">
            {loading ? (
              <div className="h-[300px] flex items-center justify-center gap-2 text-slate-400">
                <Activity className="w-5 h-5 animate-spin text-cyan-400" />
                <span>Hydrating application cache from SQLite...</span>
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <DashboardView 
                    assets={assets} 
                    logs={logs} 
                    users={users} 
                    stats={stats} 
                    onActionSuccess={() => {}} 
                  />
                )}

                {activeTab === '3d' && (
                  <ThreeDashboard 
                    assets={assets} 
                    users={users} 
                    onActionSuccess={() => {}} 
                  />
                )}

                {activeTab === 'inventory' && (
                  <InventoryView 
                    assets={assets} 
                    users={users} 
                    currentUser={currentUser}
                    onActionSuccess={() => {}}
                    onDeleteAsset={handleDeleteAsset}
                  />
                )}

                {activeTab === 'logs' && (
                  <LogsView logs={logs} />
                )}

                {/* NEW TAB: CUSTOMER CHECKOUT & ACTIVE LEASES LIST */}
                {activeTab === 'customer_checkout' && (
                  <div className="space-y-6">
                    {/* Leases registration form */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      
                      {/* Left: Form */}
                      <div className="lg:col-span-1 glass-card p-6 rounded-xl border border-slate-800 space-y-4">
                        <div className="border-b border-slate-900 pb-3">
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">New Customer Lease</h3>
                          <p className="text-[10px] text-slate-400 mt-1">Check out hardware to a customer & auto-download receipt spec</p>
                        </div>

                        {checkoutError && (
                          <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-400 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>{checkoutError}</span>
                          </div>
                        )}

                        <form onSubmit={handleCustomerCheckout} className="space-y-3 text-xs">
                          <div>
                            <label className="text-slate-400 font-semibold block mb-1">Customer Full Name</label>
                            <input
                              type="text"
                              placeholder="e.g. John Doe"
                              value={custName}
                              onChange={(e) => setCustName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                              required
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-slate-400 font-semibold block mb-1">Contact No</label>
                              <input
                                type="text"
                                placeholder="+1 (555) 012-3456"
                                value={custContact}
                                onChange={(e) => setCustContact(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-semibold block mb-1">Email (Optional)</label>
                              <input
                                type="email"
                                placeholder="john@doe.com"
                                value={custEmail}
                                onChange={(e) => setCustEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-slate-400 font-semibold block mb-1">Select Hardware Item</label>
                            <select
                              value={custAssetId}
                              onChange={(e) => handleAssetSelectChange(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
                              required
                            >
                              <option value="">Select Asset</option>
                              {assets.map(a => {
                                const isAvailable = a.type === 'serialized' ? a.status === 'Available' : a.quantity_available > 0;
                                return (
                                  <option key={a.id} value={a.id} disabled={!isAvailable}>
                                    {a.name} ({a.category}) {a.type === 'serialized' ? `[S/N: ${a.serial_number}]` : `[Qty: ${a.quantity_available} left]`} {!isAvailable && '(Out of stock)'}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-slate-400 font-semibold block mb-1">Lease Unit Price ($)</label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={custPrice}
                                onChange={(e) => setCustPrice(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                required
                              />
                            </div>

                            {assets.find(a => a.id === Number(custAssetId))?.type === 'bulk' ? (
                              <div>
                                <label className="text-slate-400 font-semibold block mb-1">Quantity</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={assets.find(a => a.id === Number(custAssetId))?.quantity_available || 1}
                                  value={custQty}
                                  onChange={(e) => setCustQty(Math.max(1, Number(e.target.value)))}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="text-slate-400 font-semibold block mb-1">Warranty Term</label>
                                <select
                                  value={custWarranty}
                                  onChange={(e) => setCustWarranty(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white focus:outline-none font-medium"
                                >
                                  <option value="12 Months Warranty">12 Months Warranty</option>
                                  <option value="24 Months Warranty">24 Months Warranty</option>
                                  <option value="Lifetime Warranty">Lifetime Warranty</option>
                                  <option value="No Warranty">No Warranty / Sandbox</option>
                                </select>
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            disabled={checkoutLoading}
                            className="w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-2.5 rounded-lg text-xs tracking-wider uppercase transition flex items-center justify-center gap-1.5 disabled:opacity-50 mt-6 shadow-md"
                          >
                            <Download className="w-4 h-4" />
                            <span>{checkoutLoading ? 'Leasing...' : 'Lease & Get Invoice'}</span>
                          </button>
                        </form>
                      </div>

                      {/* Right: Active customer checkouts table */}
                      <div className="lg:col-span-2 glass-card rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between">
                        <div>
                          <div className="p-5 border-b border-slate-900 bg-slate-950/20 flex justify-between items-center">
                            <div>
                              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Customer Leases</h3>
                              <p className="text-[10px] text-slate-500 mt-0.5">Summary of hardware currently held by customer clients</p>
                            </div>
                          </div>

                          <div className="overflow-x-auto text-xs">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-400 font-bold uppercase tracking-wider">
                                  <th className="py-3.5 px-5">Customer</th>
                                  <th className="py-3.5 px-5">Asset Name</th>
                                  <th className="py-3.5 px-5 font-mono">Serial</th>
                                  <th className="py-3.5 px-5">Warranty</th>
                                  <th className="py-3.5 px-5">Date</th>
                                  <th className="py-3.5 px-5 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900">
                                {customerCheckouts.map((lease) => (
                                  <tr key={lease.id} className="hover:bg-slate-900/10 transition">
                                    <td className="py-3 px-5">
                                      <span className="font-semibold text-white block">{lease.customer_name}</span>
                                      <span className="text-[10px] text-slate-500 font-mono block">{lease.customer_contact}</span>
                                    </td>
                                    <td className="py-3 px-5 text-slate-300 font-semibold">{lease.asset_name}</td>
                                    <td className="py-3 px-5 font-mono text-slate-500">{lease.serial_number || 'BULK'}</td>
                                    <td className="py-3 px-5 text-slate-400">{lease.warranty_info}</td>
                                    <td className="py-3 px-5 font-mono text-slate-500 whitespace-nowrap">
                                      {new Date(lease.checkout_date).toLocaleDateString()}
                                    </td>
                                    <td className="py-3 px-5 text-right">
                                      {lease.return_date ? (
                                        <span className="text-[10px] text-slate-500 border border-slate-800 px-2 py-0.5 rounded uppercase font-bold">
                                          Returned
                                        </span>
                                      ) : (
                                        <div className="flex justify-end gap-1.5">
                                          <button
                                            onClick={() => downloadReceipt({
                                              id: lease.id,
                                              customerName: lease.customer_name,
                                              contactNo: lease.customer_contact,
                                              email: lease.email,
                                              assetName: lease.asset_name,
                                              serialNumber: lease.serial_number,
                                              price: lease.price,
                                              warrantyInfo: lease.warranty_info,
                                              quantity: 1
                                            })}
                                            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 p-1.5 rounded text-slate-400 hover:text-white transition"
                                            title="Download Receipt"
                                          >
                                            <Download className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => handleCustomerReturn(lease.id)}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-2 py-1 rounded transition text-[10px]"
                                          >
                                            Checkin
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {customerCheckouts.length === 0 && (
                          <div className="p-8 text-center text-xs text-slate-500">
                            No customer leases active.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* NEW TAB: CUSTOMER DIRECTORY */}
                {activeTab === 'customer_directory' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900 justify-between">
                      <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search customers by name, phone or email..."
                          value={custSearch}
                          onChange={(e) => setCustSearch(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <button
                        onClick={() => setShowAddCust(!showAddCust)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 self-start"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Register Customer File</span>
                      </button>
                    </div>

                    {showAddCust && (
                      <form onSubmit={handleCreateCustomer} className="glass-card p-5 rounded-xl border border-slate-800 space-y-4 animate-slide-in">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider">Register New Customer Profile</h4>
                        {custError && (
                          <p className="text-xs text-red-400 font-medium bg-red-950/20 p-2 border border-red-900 rounded">{custError}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <label className="text-slate-400 block mb-1">Customer Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Liam Neeson"
                              value={newCustName}
                              onChange={(e) => setNewCustName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-slate-400 block mb-1">Contact Number</label>
                            <input
                              type="text"
                              placeholder="e.g. +1 (555) 234-9018"
                              value={newCustContact}
                              onChange={(e) => setNewCustContact(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500 font-mono"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-slate-400 block mb-1">Email Address</label>
                            <input
                              type="email"
                              placeholder="e.g. liam@gmail.com"
                              value={newCustEmail}
                              onChange={(e) => setNewCustEmail(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowAddCust(false)}
                            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3 py-1.5 rounded text-xs font-semibold text-slate-400 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition"
                          >
                            Save Customer
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Customers listings directory */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredCustomers.map(customer => {
                        const custActiveLeases = customerCheckouts.filter(cc => cc.customer_id === customer.id && !cc.return_date);
                        const serialsHeld = custActiveLeases.map(cc => cc.serial_number || 'Bulk Quantity').join(', ');
                        
                        return (
                          <div key={customer.id} className="glass-card p-5 rounded-xl border border-slate-800 flex flex-col justify-between glass-card-hover min-h-[140px]">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-500 flex items-center justify-center font-bold text-slate-950 font-mono text-sm">
                                  {customer.name.split(' ').map(n=>n[0]).join('').toUpperCase().substr(0,2)}
                                </div>
                                <div>
                                  <h4 className="text-white font-bold text-sm leading-snug">{customer.name}</h4>
                                  <span className="text-[10px] text-slate-400 block flex items-center gap-1 font-mono mt-0.5">
                                    <Phone className="w-2.5 h-2.5 text-slate-500" />
                                    {customer.contact_no}
                                  </span>
                                  {customer.email && (
                                    <span className="text-[10px] text-slate-500 block font-mono">{customer.email}</span>
                                  )}
                                </div>
                              </div>

                              <button
                                onClick={() => handleDeleteCustomer(customer.id)}
                                className="text-slate-600 hover:text-red-400 p-1 rounded transition"
                                title="Remove Customer File"
                                disabled={customer.active_leases_count > 0}
                              >
                                <Trash2 className={`w-4 h-4 ${customer.active_leases_count > 0 ? 'opacity-20 cursor-not-allowed' : ''}`} />
                              </button>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-between text-[11px]">
                              <div>
                                <span className="text-slate-500 block uppercase font-mono text-[9px] tracking-wider">Hardware held</span>
                                <span className="text-slate-300 font-semibold block max-w-[160px] truncate" title={serialsHeld}>
                                  {serialsHeld || 'None'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-cyan-400 font-bold block font-mono">
                                  {customer.active_leases_count}
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase font-mono block">items leased</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="space-y-6">
                    {/* Create staff header */}
                    <div className="flex justify-between items-center bg-slate-950/20 p-4 border border-slate-900 rounded-xl">
                      <div>
                        <h3 className="text-base font-bold text-white">Staff Directories</h3>
                        <p className="text-xs text-slate-400 mt-1">Manage personnel registry authorized for hardware checkouts</p>
                      </div>
                      <button
                        onClick={() => setShowAddUser(!showAddUser)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Register Staff</span>
                      </button>
                    </div>

                    {showAddUser && (
                      <form onSubmit={handleCreateUser} className="glass-card p-5 rounded-xl border border-slate-800 space-y-4 animate-slide-in">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider">Register authorized member</h4>
                        {userError && (
                          <p className="text-xs text-red-400 font-medium bg-red-950/20 p-2 border border-red-900 rounded">{userError}</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Liam Neeson"
                              value={newUserName}
                              onChange={(e) => setNewUserName(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Email</label>
                            <input
                              type="email"
                              placeholder="e.g. liam@aznet.co"
                              value={newUserEmail}
                              onChange={(e) => setNewUserEmail(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400 block mb-1">Role Title</label>
                            <select
                              value={newUserRole}
                              onChange={(e) => setNewUserRole(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none"
                            >
                              <option value="Staff">Field Staff</option>
                              <option value="Technician">Technician</option>
                              <option value="Administrator">Administrator</option>
                              <option value="Media Producer">Media Producer</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowAddUser(false)}
                            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 px-3 py-1.5 rounded text-xs font-semibold text-slate-400 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold px-3 py-1.5 rounded text-xs transition"
                          >
                            Add to DB
                        </button>
                        </div>
                      </form>
                    )}

                    {/* Directories grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {users.map(user => {
                        const userCheckedOutAssets = assets.filter(a => a.current_user_id === user.id);
                        return (
                          <div key={user.id} className="glass-card p-5 rounded-xl border border-slate-800 flex items-center justify-between glass-card-hover relative group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center font-bold text-slate-950 font-mono text-sm">
                                {user.avatar}
                              </div>
                              <div>
                                <h4 className="text-white font-bold text-sm">{user.name}</h4>
                                <span className="text-[10px] text-slate-400 block font-semibold">{user.role}</span>
                                <span className="text-[10px] text-slate-500 block font-mono">{user.email}</span>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1 shrink-0">
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-slate-700 hover:text-red-400 p-1 rounded transition opacity-0 group-hover:opacity-100 duration-200"
                                title="Remove User Profile"
                                disabled={userCheckedOutAssets.length > 0}
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${userCheckedOutAssets.length > 0 ? 'opacity-20 cursor-not-allowed' : ''}`} />
                              </button>
                              <div>
                                <span className="text-cyan-400 text-xs font-bold font-mono block">
                                  {userCheckedOutAssets.length} active
                                </span>
                                <span className="text-[9px] text-slate-500 uppercase font-mono block">items held</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'reports' && (
                  <div className="space-y-6">
                    {/* Reporting Header */}
                    <div className="bg-slate-950/20 p-5 rounded-xl border border-slate-900">
                      <h3 className="text-base font-bold text-white">Consolidated Asset Financial Reports</h3>
                      <p className="text-xs text-slate-400 mt-1">Summary audits of physical assets value, classes, and allocation metrics</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Value distributions */}
                      <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-4">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider">Asset Financial Value Breakdown</h4>
                        <div className="space-y-3.5">
                          {(() => {
                            const catCosts = {};
                            assets.forEach(a => {
                              const val = a.cost * (a.quantity_total || 1);
                              catCosts[a.category] = (catCosts[a.category] || 0) + val;
                            });
                            const totalVal = Object.values(catCosts).reduce((a,b)=>a+b,0);

                            return Object.entries(catCosts).map(([cat, val]) => {
                              const percent = (val / totalVal) * 100;
                              return (
                                <div key={cat} className="space-y-1.5">
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span className="text-slate-400">{cat}</span>
                                    <span className="text-white">${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-1.5 rounded overflow-hidden">
                                    <div 
                                      className="bg-cyan-500 h-full rounded-r transition-all duration-500" 
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>

                      {/* Quantity stats */}
                      <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-4">
                        <h4 className="text-white font-bold text-xs uppercase tracking-wider">Asset Deployment Ratios</h4>
                        <div className="space-y-4">
                          {(() => {
                            const totalSer = stats.serialized?.total || 1;
                            const availSer = stats.serialized?.available || 0;
                            const checkoutSer = stats.serialized?.checkedOut || 0;
                            const maintSer = stats.serialized?.maintenance || 0;

                            return (
                              <>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Available Stock Ratio</span>
                                    <span className="text-cyan-400 font-bold font-mono">{((availSer / totalSer) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
                                    <div className="bg-cyan-500 h-full" style={{ width: `${(availSer / totalSer) * 100}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Deployed Field Ratio</span>
                                    <span className="text-purple-400 font-bold font-mono">{((checkoutSer / totalSer) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
                                    <div className="bg-purple-500 h-full" style={{ width: `${(checkoutSer / totalSer) * 100}%` }} />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Maintenance Repair Ratio</span>
                                    <span className="text-amber-400 font-bold font-mono">{((maintSer / totalSer) * 100).toFixed(1)}%</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-2 rounded overflow-hidden">
                                    <div className="bg-amber-500 h-full" style={{ width: `${(maintSer / totalSer) * 100}%` }} />
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="space-y-6 max-w-2xl">
                    {/* Database Information */}
                    <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
                        <Database className="w-4 h-4 text-cyan-400" />
                        <span>SQLite Engine Schema Settings</span>
                      </h3>

                      <div className="space-y-3.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Database Engine</span>
                          <span className="text-white font-mono">SQLite3 via better-sqlite3</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Immutability Triggers Status</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-cyan" />
                            <span>Active (LOCKED)</span>
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Journaling Mode</span>
                          <span className="text-white font-mono font-semibold">WAL (Write-Ahead Logging)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Conflict Resolution Policy</span>
                          <span className="text-white">Transaction-level rollback on status collision</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Database Storage Mode</span>
                          <span className="text-white font-mono">Local in-process file storage</span>
                        </div>
                      </div>
                    </div>

                    {/* Dev system properties */}
                    <div className="glass-card p-6 rounded-xl border border-slate-800 space-y-4">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-900 pb-3">
                        <Info className="w-4 h-4 text-cyan-400" />
                        <span>Local Workspace Environment Info</span>
                      </h3>
                      <div className="space-y-3.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Client Engine</span>
                          <span className="text-white">React, Vite, Tailwind CSS</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">3D WebGL Library</span>
                          <span className="text-white font-mono">Three.js</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-900/60">
                          <span className="text-slate-500">Developer Mode</span>
                          <span className="text-white font-semibold">Offline-First Local Sync</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Polling Synchronizer Rate</span>
                          <span className="text-cyan-400 font-mono font-bold">3000ms</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* CUSTOM DELETE CONFIRMATION MODAL */}
        {deleteModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0a0f19] border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl animate-slide-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-white font-bold text-base">{deleteModal.title}</h3>
              </div>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                {deleteModal.message}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteModal({ isOpen: false, title: '', message: '', onConfirm: null })}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (deleteModal.onConfirm) await deleteModal.onConfirm();
                    setDeleteModal({ isOpen: false, title: '', message: '', onConfirm: null });
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white transition shadow-lg shadow-red-500/20 flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
