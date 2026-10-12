import { FC, useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Save, RotateCcw, FileSpreadsheet, FileText, FileType, Printer, Plus, Sun, Moon, Monitor, Search, Shield, User } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { PhotoCapture } from '../components/PhotoCapture';
import { Toast } from '../components/Toast';
import { WeighbridgeEntry, UserRole } from '../types';
import { exportAll } from '../services/export';
import { localStorageApi } from '../services/api';
import { api } from '../services/api';

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
  const [entries, setEntries] = useState<WeighbridgeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
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

  // Load entries from API on initial load
  useEffect(() => {
    const loadEntries = async () => {
      try {
        setIsLoading(true);
        const saved = localStorageApi.getEntries();
        if (saved.length > 0) {
          setEntries(saved);
        } else {
          try {
            const apiEntries = await api.getEntries();
            setEntries(apiEntries);
            localStorageApi.saveEntries(apiEntries);
          } catch (error) {
            console.error('Failed to load entries from API:', error);
            // Fallback to localStorage
            const saved = localStorageApi.getEntries();
            if (saved.length > 0) {
              setEntries(saved);
            } else {
              setEntries(Array.from({ length: 50 }, (_, i) => createEmptyEntry(i + 1)));
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadEntries();
  }, []);

  // Sync entries to localStorage whenever entries change
  useEffect(() => {
    if (!isLoading) {
      localStorageApi.saveEntries(entries);
    }
  }, [entries]);

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
    return t - g;  // Tare - Gross = Net (as requested)
  };

  const calcMoney = (net: number): number => {
    // Use absolute value for money calculation (rate is per 5kg)
    return Number((Math.abs(net) / 5).toFixed(2));
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
    if (userRole !== 'admin') {
      showToast('Permission denied: Only admins can save entries', 'error');
      return;
    }
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
  }, [entries, sortedEntries]);

  const clearEntry = useCallback((index: number) => {
    if (userRole !== 'admin') {
      showToast('Permission denied: Only admins can clear entries', 'error');
      return;
    }
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
  };

  const handlePrint = () => {
    window.print();
  };

  const handleAddRow = () => {
    if (userRole !== 'admin') {
      showToast('Permission denied: Only admins can add rows', 'error');
      return;
    }
    setEntries(prev => {
      const hasEmpty = prev.some(e => e.vehicle === '' && e.tare === '' && e.gross === '');
      if (hasEmpty || prev.length >= 50) return prev;
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

  const getRoleIcon = () => {
    const role = localStorage.getItem('userRole') as UserRole | null || 'operator';
    return role === 'admin' ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />;
  };

  const getRoleLabel = () => {
    const role = localStorage.getItem('userRole') as UserRole | null || 'operator';
    return role === 'admin' ? 'Admin' : 'Operator';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">⚖️ Dharam Kaanta</h1>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Weighbridge Entry
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={cycleTheme} aria-label="Cycle theme">
                {getThemeIcon()}
              </Button>
              <Button variant="ghost" size="sm" onClick={cycleRole} aria-label="Toggle role">
                {getRoleIcon()}
                <span className="ml-1 text-xs hidden sm:inline">{getRoleLabel()}</span>
              </Button>
            </div>
          </div>
        </div>
        
        {/* Search and Filter Bar */}
        <div className="px-4 sm:px-6 lg:px-8 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-3 max-w-7xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by vehicle number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowDateFilter(!showDateFilter)}>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Filter
              </span>
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleExport.bind(null, 'excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport.bind(null, 'pdf')}>
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExport.bind(null, 'word')}>
                <FileType className="w-4 h-4 mr-1" />
                Word
              </Button>
              <Button variant="secondary" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1" />
                Print
              </Button>
            </div>
          </div>

          {/* Date Filter */}
          {showDateFilter && (
            <div className="mt-3 flex flex-col sm:flex-row gap-3 max-w-7xl mx-auto">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                Clear
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm" ref={tableRef}>
            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-16 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-10">S.No</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-40">Tyre Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-48">Vehicle No</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 w-32">Tare (kg)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 w-32">Gross (kg)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 w-32">Net (kg)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500 dark:text-gray-400 w-24">Money</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-32">Vehicle Photo</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-32">Gross Photo</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-24">Saved</th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 dark:text-gray-400 w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedEntries.map((entry, displayIndex) => (
                <tr key={entry.id} className={clsx(
                  'transition-colors',
                  entry.saved ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-gray-950',
                  userRole !== 'admin' ? 'opacity-75' : ''
                )}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white font-medium">{entry.sno}</td>
                  <td className="px-3 py-2">
                    <select
                      value={entry.tyreType}
                      onChange={(e) => updateEntry(displayIndex, 'tyreType', e.target.value)}
                      disabled={userRole !== 'admin'}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50"
                    >
                      {DEFAULT_TYRE_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="text"
                      value={entry.vehicle}
                      onChange={(e) => updateEntry(displayIndex, 'vehicle', e.target.value.toUpperCase())}
                      placeholder="Vehicle No"
                      disabled={userRole !== 'admin'}
                      className="uppercase"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.tare}
                      onChange={(e) => updateEntry(displayIndex, 'tare', e.target.value)}
                      placeholder="Tare"
                      disabled={userRole !== 'admin'}
                      inputMode="decimal"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={entry.gross}
                      onChange={(e) => updateEntry(displayIndex, 'gross', e.target.value)}
                      placeholder="Gross"
                      disabled={userRole !== 'admin'}
                      inputMode="decimal"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-gray-900 dark:text-white">
                    {entry.net !== 0 ? entry.net.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-green-600 dark:text-green-400">
                    {entry.money !== 0 ? entry.money.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <PhotoCapture
                      value={entry.vehiclePhoto}
                      onChange={(photo) => updateEntry(displayIndex, 'vehiclePhoto', photo)}
                      label="Vehicle"
                      disabled={userRole !== 'admin'}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <PhotoCapture
                      value={entry.grossPhoto}
                      onChange={(photo) => updateEntry(displayIndex, 'grossPhoto', photo)}
                      label="Gross"
                      disabled={userRole !== 'admin'}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={clsx(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      entry.saved 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    )}>
                      {entry.saved ? 'Saved' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {userRole === 'admin' && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => saveEntry(displayIndex)}
                            disabled={entry.saved}
                            aria-label="Save entry"
                            className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => clearEntry(displayIndex)}
                            aria-label="Clear entry"
                            className="text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Row Button */}
        {userRole === 'admin' && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleAddRow} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Add Row
            </Button>
          </div>
        )}

        {/* Role Info Banner */}
        {userRole !== 'admin' && (
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Operator Mode (Read-Only)</p>
                <p>You can view entries but cannot save, clear, or add rows. Switch to Admin mode to edit.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};