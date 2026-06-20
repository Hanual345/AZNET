import React, { useState } from 'react';
import { Search, ShieldAlert, ShieldCheck, Download, Trash2, Calendar } from 'lucide-react';

export default function LogsView({ logs, globalSettings }) {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');

  const filteredLogs = logs
    .filter(log => {
      const matchSearch = 
        log.asset_name.toLowerCase().includes(search.toLowerCase()) || 
        (log.user_name && log.user_name.toLowerCase().includes(search.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(search.toLowerCase()));
      const matchAction = 
        actionFilter === 'All' || 
        (actionFilter === 'Checkout' && log.action.includes('Checkout')) ||
        (actionFilter === 'Checkin' && (log.action.includes('Checkin') || log.action.includes('Restock'))) ||
        (actionFilter === 'Maintenance' && log.action.includes('Maintenance')) ||
        (actionFilter === 'Create' && log.action === 'Create');
      
      return matchSearch && matchAction;
    });

  const downloadCSV = () => {
    // Generate simple CSV content
    const headers = ['ID', 'Asset ID', 'Asset Name', 'Asset Type', 'Action', 'User ID', 'User Name', 'Quantity', 'Details', 'Timestamp'];
    const rows = logs.map(l => [
      l.id,
      l.asset_id,
      `"${l.asset_name.replace(/"/g, '""')}"`,
      l.asset_type,
      l.action,
      l.user_id || '',
      l.user_name ? `"${l.user_name.replace(/"/g, '""')}"` : '',
      l.quantity || '',
      l.details ? `"${l.details.replace(/"/g, '""')}"` : '',
      l.timestamp
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${globalSettings?.companyName?.toLowerCase() || 'aznet'}_audit_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* IMMUTABILITY BANNER */}
      <div className="bg-cyan-950/20 border border-cyan-500/20 p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-500/30 text-cyan-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-white font-bold text-sm">Cryptographic Immutable Audit Ledger</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Every checkout, return, and repair transition is permanently recorded inside the SQLite ledger. 
              Triggers actively block modifications or deletes directly at the database layer.
            </p>
          </div>
        </div>
        <button
          onClick={downloadCSV}
          className="bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-cyan-500/20 font-bold px-4 py-2 rounded-lg text-xs transition flex items-center justify-center gap-1.5 self-start md:self-center shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Export Ledger CSV</span>
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-950/20 p-4 rounded-xl border border-slate-900 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs by asset name, user or details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 shrink-0 font-medium">Filter Action:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
          >
            <option value="All">All Operations</option>
            <option value="Checkout">Checkout Logs</option>
            <option value="Checkin">Check-in Logs</option>
            <option value="Maintenance">Maintenance Logs</option>
            <option value="Create">Creation logs</option>
          </select>
        </div>
      </div>

      {/* LOGS DATA TABLE */}
      <div className="glass-card rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-900 bg-slate-950/20 flex justify-between items-center">
          <span className="text-xs font-bold text-white uppercase tracking-wider">Ledger Stream</span>
          <span className="text-[10px] bg-slate-900 border border-slate-800 px-3 py-1 rounded-full text-slate-400 font-mono">
            {filteredLogs.length} audit entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-900/30 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6">Timestamp</th>
                <th className="py-4 px-6">Action</th>
                <th className="py-4 px-6">Asset Name</th>
                <th className="py-4 px-6 font-mono">Class</th>
                <th className="py-4 px-6">User Name</th>
                <th className="py-4 px-6">Quantity</th>
                <th className="py-4 px-6">Audit Log Description</th>
                <th className="py-4 px-6 text-center">Ledger Lock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {filteredLogs.map(log => {
                // Badges
                let badgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
                if (log.action.includes('Checkout')) badgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
                if (log.action.includes('Checkin') || log.action.includes('Restock')) badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
                if (log.action.includes('Maintenance')) badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';

                return (
                  <tr key={log.id} className="hover:bg-slate-900/10 transition">
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${badgeClass}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-white">{log.asset_name}</td>
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-500 capitalize">{log.asset_type}</td>
                    <td className="py-3.5 px-6 text-slate-300 font-medium">
                      {log.user_name || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 px-6 font-mono text-xs text-slate-400">
                      {log.quantity || <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3.5 px-6 text-slate-300 text-xs max-w-sm whitespace-normal leading-relaxed">
                      {log.details}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-500/80 mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredLogs.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-500">
            No matching ledger logs found.
          </div>
        )}
      </div>
    </div>
  );
}
