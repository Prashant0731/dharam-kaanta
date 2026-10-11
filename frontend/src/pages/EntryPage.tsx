import { FC, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Save, RotateCcw, Download, FileSpreadsheet, FileText, FileType, Printer, Plus, Sun, Moon, Monitor, Search, Shield, User } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { PhotoCapture } from '../components/PhotoCapture';
import { Toast } from '../components/Toast';
import { WeighbridgeEntry, UserRole } from '../types';
import { exportAll } from '../services/export';
import { localStorageApi } from '../services/api';
import { api } from '../services/api';

const MAX_ROWS = 50;

// Default tyre types
const DEFAULT_TYRE_TYPES = ['Radial', 'Bias', 'Tube', 'Tubeless', 'Other'];

const createEmptyEntry = (sno: number): WeighbridgeEntry => ({
  id: crypto.randomUUID(),
  sno,
  tyreType: DEFAULT_TYRE_TYPES[0],
  vehicle: '',
  tare: '',
  gross: '',
  vehiclePhoto: '',
  grossPhoto: '',
  net: 0,
  money: 0,
  saved: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const EntryPage: FC = () => {
  const [entries, setEntries] = useState<WeighbridgeEntry[]>(() => {
    const saved = localStorageApi.getEntries();
    if (saved.length > 0) return saved;
    return Array.from({ length: MAX_ROWS }, (_, i) => createEmptyEntry(i + 1));
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    return saved || 'system';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('userRole') as UserRole | null;
    return saved || 'operator';
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Filter entries based on search term and date range
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (searchTerm.trim()) {
      result = result.filter(entry => 
        entry.vehicle.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (dateFrom) {
      result = result.filter(entry => entry.createdAt && entry.createdAt >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(entry => entry.createdAt && entry.createdAt <= dateTo);
    }
    return result;
  }, [entries, searchTerm, dateFrom, dateTo]);

  // Sort: latest first, then by sno
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return a.sno - b.sno;
    });
  }, [filteredEntries]);

  const calcNet = (tare: string, gross: string): number => {
    const t = Number(tare) || 0;
    const g = Number(gross) || 0;
    if (!t && !g) return 0;
    return g - t;
  };

  const calcMoney = (net: number): number => {
    if (net <= 0) return 0;
    return Number((net / 5).toFixed(2));
  };

  const updateEntry = useCallback((index: number, field: keyof WeighbridgeEntry, value: string | number) => {
    setEntries(prev => {
      const newEntries = [...prev];
      const entry = { ...newEntries[index] };
      (entry as any)[field] = value;
      entry.updatedAt = new Date().toISOString();
      
      if (field === 'tare' || field === 'gross') {
        const tare = field === 'tare' ? Number(value) : Number(entry.tare);
        const gross = field === 'gross' ? Number(value) : Number(entry.gross);
        const net = calcNet(String(tare), String(gross));
        entry.net = net;
        entry.money = calcMoney(net);
      }
      
      newEntries[index] = entry;
      return newEntries;
    });
  }, []);

  const persistEntries = useCallback((newEntries: WeighbridgeEntry[]) => {
    localStorageApi.saveEntries(newEntries);
    api.bulkCreate(newEntries.filter(e => e.vehicle || e.tare || e.gross)).catch(console.error);
  }, []);

  const saveEntry = useCallback(async (index: number) => {
    const actualIndex = entries.findIndex(e => e.id === sortedEntries[index]?.id);
    if (actualIndex === -1) return;

    setEntries(prev => {
      const entry = prev[actualIndex];
      if (!entry.vehicle && !entry.tare && !entry.gross && !entry.vehiclePhoto && !entry.grossPhoto) {
        showToast('Entry is empty!', 'error');
        return prev;
      }

      const newEntries = [...prev];
      newEntries[actualIndex] = {
        ...entry,
        saved: true,
        updatedAt: new Date().toISOString(),
        createdAt: entry.createdAt || new Date().toISOString(),
      };
      
      persistEntries(newEntries);
      showToast(`Row ${index + 1} saved!`, 'success');
      return newEntries;
    });
  }, [entries, sortedEntries, persistEntries]);

  const clearEntry = useCallback((index: number) => {
    const actualIndex = entries.findIndex(e => e.id === sortedEntries[index]?.id);
    if (actualIndex === -1) return;

    setEntries(prev => {
      const newEntries = [...prev];
      const oldEntry = prev[actualIndex];
      // Preserve: Tyre Type, Vehicle Number, Tare Weight
      newEntries[actualIndex] = createEmptyEntry(actualIndex + 1);
      newEntries[actualIndex].tyreType = oldEntry.tyreType;
      newEntries[actualIndex].vehicle = oldEntry.vehicle;
      newEntries[actualIndex].tare = oldEntry.tare;
      newEntries[actualIndex].role = userRole;
      
      persistEntries(newEntries);
      showToast(`Row ${index + 1} cleared!`, 'info');
      return newEntries;
    });
  }, [sortedEntries, userRole, persistEntries]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleExport = (format: 'excel' | 'pdf' | 'word') => {
    const savedEntries = entries.filter(e => e.saved || e.vehicle || e.tare || e.gross);
    if (savedEntries.length === 0) {
      showToast('No data to export', 'error');
      return;
    }
    exportAll(savedEntries, format);
    showToast(`Exported to ${format.toUpperCase()}`, 'success');
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddRow = () => {
    setEntries(prev => {
      const hasEmpty = prev.some(e => e.vehicle === '' && e.tare === '' && e.gross === '');
      if (hasEmpty || prev.length >= MAX_ROWS) return prev;
      return [...prev, createEmptyEntry(prev.length + 1)];
    });
  };

  const cycleTheme = () => {
    setTheme(prev => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'system';
      return 'light';
    });
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="w-4 h-4" />;
    if (theme === 'dark') return <Moon className="w-4 h-4" />;
    return <Monitor className="w-4 h-4" />;
  };

  const getThemeLabel = () => {
    if (theme === 'light') return 'Light';
    if (theme === 'dark') return 'Dark';
    return 'System';
  };

  const cycleRole = () => {
    setUserRole(prev => {
      if (prev === 'operator') {
        localStorage.setItem('userRole', 'admin');
        return 'admin';
      }
      localStorage.setItem('userRole', 'operator');
      return 'operator';
    });
  };

  const getRoleIcon = () => userRole === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />;
  const getRoleLabel = () => userRole === 'admin' ? 'Admin' : 'Operator';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" style={{minHeight: '100vh'}}>
      {/* Header */}
      <header className="bg-gray-900 text-white px-4 py-3 shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold">⚖️ Dharam Kaanta</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400 hidden sm:inline">{getThemeLabel()}</span>
            <Button variant="ghost" size="sm" onClick={cycleTheme} aria-label="Toggle theme">
              {getThemeIcon()}
            </Button>
            <span className="text-sm text-gray-400 hidden sm:inline">{getRoleLabel()}</span>
            <Button variant="ghost" size="sm" onClick={cycleRole} aria-label="Toggle role">
              {getRoleIcon()}
            </Button>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-14 z-40">
        <div className="max-w-full mx-auto flex flex-wrap items-center gap-3">
          <Button onClick={handlePrint} variant="ghost" size="sm">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          
          {/* Vehicle Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          </div>
          
          {/* Date Range Filter */}
          <Button variant="ghost" size="sm" onClick={() => setShowDateFilter(!showDateFilter)} className="sm:hidden">
            <span className="w-4 h-4">📅</span> Date
          </Button>
          
          <div className="relative">
            <Button onClick={() => setShowExportMenu(!showExportMenu)} variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-1" /> Export
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                <button onClick={() => handleExport('excel')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (.xlsx)
                </button>
                <button onClick={() => handleExport('pdf')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-red-600" /> PDF (.pdf)
                </button>
                <button onClick={() => handleExport('word')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                  <FileType className="w-4 h-4 text-blue-600" /> Word (.docx)
                </button>
              </div>
            )}
          </div>

          <Button onClick={handleAddRow} variant="secondary" size="sm" className="ml-auto">
            <Plus className="w-4 h-4 mr-1" /> Add Row
          </Button>
        </div>

        {/* Date Range Filter Row */}
        {showDateFilter && (
          <div className="mt-3 flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From Date</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To Date</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button variant="secondary" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table Container - Responsive */}
      <div className="px-4 pb-4 overflow-hidden" style={{maxHeight: 'calc(100vh - 200px)'}}>
        <div className="overflow-x-auto" style={{height: 'calc(100vh - 200px)', overflowY: 'auto'}}>
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" ref={tableRef}>
<thead className="bg-gray-900 text-white sticky top-0 z-20">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider sticky left-0 bg-gray-900 z-30 w-8 min-w-[40px]">#</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider sticky left-0 bg-gray-900 z-20 min-w-[120px]">Tyre Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider sticky left-0 bg-gray-900 z-20 min-w-[120px]">Vehicle No.</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-20 min-w-[80px]">Tare (kg)</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-20 min-w-[80px]">Gross (kg)</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-green-300 w-20 min-w-[80px]">Net (kg)</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-red-300 w-20 min-w-[80px]">Amount</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-20 min-w-[80px]">Status</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-24 min-w-[96px]">Vehicle Photo</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-24 min-w-[96px]">Gross Photo</th>
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider w-28 min-w-[112px]">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No entries yet. Click "Add Row" to start.
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry, displayIndex) => (
                  <tr key={entry.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-800', entry.saved && 'bg-green-50 dark:bg-green-900/20')}>
                    <td className="px-2 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-inherit z-20 w-8 min-w-[40px]">
                      {displayIndex + 1}
                    </td>
                    {/* Tyre Type - First Column */}
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 min-w-[140px] max-w-[180px]">
                      <select
                        value={entry.tyreType}
                        onChange={(e) => updateEntry(entries.findIndex(e => e.id === entry.id), 'tyreType', e.target.value)}
                        disabled={userRole !== 'admin' && entry.saved}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {DEFAULT_TYRE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="Other">Other...</option>
                      </select>
                    </td>
                    {/* Vehicle Number */}
                    <td className="px-3 py-2 whitespace-nowrap sticky left-0 bg-inherit z-10 min-w-[140px] max-w-[180px]">
                      <Input
                        value={entry.vehicle}
                        onChange={(e) => updateEntry(entries.findIndex(e => e.id === entry.id), 'vehicle', e.target.value)}
                        placeholder="RJ14AB1234"
                        className="text-sm"
                      />
                    </td>
                    {/* Tare Weight */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-20 min-w-[80px]">
                      <Input
                        type="number"
                        value={entry.tare}
                        onChange={(e) => updateEntry(entries.findIndex(e => e.id === entry.id), 'tare', e.target.value)}
                        placeholder="kg"
                        className="text-center text-sm w-20 mx-auto"
                        min="0"
                        step="1"
                      />
                    </td>
                    {/* Gross Weight */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-20 min-w-[80px]">
                      <Input
                        type="number"
                        value={entry.gross}
                        onChange={(e) => {
                          const tareValue = entry.tare || '0';
                          const grossValue = e.target.value;
                          if (Number(grossValue) < Number(tareValue)) {
                            // Auto-correct gross to be at least tare
                            updateEntry(entries.findIndex(e => e.id === entry.id), 'gross', tareValue);
                          } else {
                            updateEntry(entries.findIndex(e => e.id === entry.id), 'gross', grossValue);
                          }
                        }}
                        placeholder="kg"
                        className="text-center text-sm w-20 mx-auto"
                        min={entry.tare || 0}
                        step="1"
                      />
                    </td>
                    {/* Net Weight */}
                    <td className="px-3 py-2 whitespace-nowrap text-center text-green-700 dark:text-green-400 font-bold text-sm w-20 min-w-[80px]">
                      {entry.net <= 0 ? '-' : entry.net}
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-2 whitespace-nowrap text-center text-red-700 dark:text-red-400 font-bold text-sm w-20 min-w-[80px]">
                      {entry.money <= 0 ? '-' : entry.money.toFixed(2)}
                    </td>
                    {/* Validation Warning */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-24 min-w-[96px]">
                      {Number(entry.gross) < Number(entry.tare || 0) && (
                        <span className="text-xs text-orange-600 dark:text-orange-400" title="Gross weight cannot be less than tare">
                          {'⚠ Gross < Tare'}
                        </span>
                      )}
                    </td>
                    {/* Vehicle Photo */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-28 min-w-[112px]">
                      <PhotoCapture
                        value={entry.vehiclePhoto}
                        onChange={(val) => updateEntry(entries.findIndex(e => e.id === entry.id), 'vehiclePhoto', val)}
                        label="Vehicle Photo"
                        placeholder="Vehicle"
                      />
                    </td>
                    {/* Gross Photo */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-28 min-w-[112px]">
                      <PhotoCapture
                        value={entry.grossPhoto}
                        onChange={(val) => updateEntry(entries.findIndex(e => e.id === entry.id), 'grossPhoto', val)}
                        label="Gross Photo"
                        placeholder="Gross"
                      />
                    </td>
                    {/* Action */}
                    <td className="px-3 py-2 whitespace-nowrap text-center w-32 min-w-[128px]">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        <Button
                          onClick={() => saveEntry(displayIndex)}
                          disabled={entry.saved}
                          size="sm"
                          variant={entry.saved ? 'secondary' : 'primary'}
                          className="min-w-[65px]"
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          {entry.saved ? 'Saved' : 'Save'}
                        </Button>
                        <Button
                          onClick={() => clearEntry(displayIndex)}
                          variant="danger"
                          size="sm"
                          className="min-w-[65px]"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Clear
                        </Button>
                      </div>
                      {entry.saved && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Saved</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 z-30">
        <div className="max-w-full mx-auto grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Total Entries</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {entries.filter(e => e.vehicle || e.tare || e.gross).length}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Saved Entries</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {entries.filter(e => e.saved).length}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Total Net Weight</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {entries.reduce((sum, e) => sum + (e.net > 0 ? e.net : 0), 0).toFixed(1)} kg
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {entries.reduce((sum, e) => sum + (e.money > 0 ? e.money : 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">Today's Entries</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {entries.filter(e => e.createdAt && new Date(e.createdAt).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};