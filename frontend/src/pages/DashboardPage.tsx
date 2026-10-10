import { FC, useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Download, Search, Filter, Truck, Weight, IndianRupee, FileSpreadsheet, FileText, FileType, Printer, 
  ChevronLeft, ChevronRight, Sun, Moon, Monitor, X, ZoomIn, Edit2, Copy, ClipboardCheck, 
  Shield, User, Calendar, FilePlus 
} from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { WeighbridgeEntry, UserRole } from '../types';
import { exportAll } from '../services/export';
import { localStorageApi } from '../services/api';

export const DashboardPage: FC = () => {
  const [entries, setEntries] = useState<WeighbridgeEntry[]>(() => localStorageApi.getEntries());
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    return saved || 'system';
  });
  const [userRole, setUserRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('userRole') as UserRole | null;
    return saved || 'operator';
  });
  const [photoModal, setPhotoModal] = useState<{ src: string; label: string } | null>(null);
  const [editModal, setEditModal] = useState<WeighbridgeEntry | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

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

  // Sync with localStorage
  useEffect(() => {
    const saved = localStorageApi.getEntries();
    setEntries(saved);
  }, []);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries
      .filter(entry => {
        if (searchTerm && !entry.vehicle.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        if (dateFrom && entry.createdAt && new Date(entry.createdAt) < new Date(dateFrom)) {
          return false;
        }
        if (dateTo && entry.createdAt && new Date(entry.createdAt) > new Date(dateTo)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [entries, searchTerm, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const stats = {
    totalEntries: entries.length,
    savedEntries: entries.filter(e => e.saved).length,
    totalWeight: entries.reduce((sum, e) => sum + (e.net > 0 ? e.net : 0), 0),
    totalAmount: entries.reduce((sum, e) => sum + (e.money > 0 ? e.money : 0), 0),
    todayEntries: entries.filter(e => 
      e.createdAt && new Date(e.createdAt).toDateString() === new Date().toDateString()
    ).length,
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  // Copy single record to clipboard (tab-separated for Excel)
  const copyToClipboard = useCallback((entry: WeighbridgeEntry) => {
    const tabSeparated = [
      formatDate(entry.createdAt),
      entry.tyreType || '',
      entry.vehicle || '',
      entry.tare || '',
      entry.gross || '',
      entry.net > 0 ? entry.net.toString() : '',
      entry.money > 0 ? entry.money.toFixed(2) : '',
      entry.vehiclePhoto ? 'Yes' : 'No',
      entry.grossPhoto ? 'Yes' : 'No',
      entry.saved ? 'Saved' : 'Draft'
    ].join('\t');
    
    navigator.clipboard.writeText(tabSeparated).then(() => {
      setCopyToast('Record copied to clipboard! Paste in Excel.');
      setTimeout(() => setCopyToast(null), 3000);
    }).catch(() => {
      setCopyToast('Failed to copy');
      setTimeout(() => setCopyToast(null), 3000);
    });
  }, []);

  // Copy all filtered records
  const copyAllRecords = useCallback(() => {
    if (filteredEntries.length === 0) return;
    
    const header = ['Date', 'Tyre Type', 'Vehicle No.', 'Tare (kg)', 'Gross (kg)', 'Net (kg)', 'Amount', 'Veh Photo', 'Gross Photo', 'Status'].join('\t');
    const rows = filteredEntries.map(entry => [
      formatDate(entry.createdAt),
      entry.tyreType || '',
      entry.vehicle || '',
      entry.tare || '',
      entry.gross || '',
      entry.net > 0 ? entry.net.toString() : '',
      entry.money > 0 ? entry.money.toFixed(2) : '',
      entry.vehiclePhoto ? 'Yes' : 'No',
      entry.grossPhoto ? 'Yes' : 'No',
      entry.saved ? 'Saved' : 'Draft'
    ].join('\t'));
    
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyToast(`${filteredEntries.length} records copied! Paste in Excel.`);
      setTimeout(() => setCopyToast(null), 3000);
    });
  }, [filteredEntries]);

  // Edit entry
  const handleEdit = (entry: WeighbridgeEntry) => {
    setEditModal({ ...entry });
  };

  const saveEdit = useCallback((updatedEntry: WeighbridgeEntry) => {
    setEntries(prev => {
      const newEntries = prev.map(e => e.id === updatedEntry.id ? { ...updatedEntry, updatedAt: new Date().toISOString() } : e);
      localStorageApi.saveEntries(newEntries);
      return newEntries;
    });
    setEditModal(null);
  }, []);

  // Delete entry
  const handleDelete = useCallback((id: string) => {
    if (!confirm('Delete this record?')) return;
    setEntries(prev => {
      const newEntries = prev.filter(e => e.id !== id);
      localStorageApi.saveEntries(newEntries);
      return newEntries;
    });
  }, []);

  // Grand totals for filtered entries
  const grandTotals = useMemo(() => ({
    totalTare: filteredEntries.reduce((sum, e) => sum + (Number(e.tare) || 0), 0),
    totalGross: filteredEntries.reduce((sum, e) => sum + (Number(e.gross) || 0), 0),
    totalNet: filteredEntries.reduce((sum, e) => sum + (e.net > 0 ? e.net : 0), 0),
    totalAmount: filteredEntries.reduce((sum, e) => sum + (e.money > 0 ? e.money : 0), 0),
  }), [filteredEntries]);

  // Export with grand totals
  const exportWithTotals = useCallback((format: 'excel' | 'pdf' | 'word') => {
    if (filteredEntries.length === 0) return;
    
    // Add grand total row
    const entriesWithTotal = [...filteredEntries, {
      id: 'grand-total',
      sno: 0,
      tyreType: 'GRAND TOTAL',
      vehicle: '',
      tare: grandTotals.totalTare.toFixed(1),
      gross: grandTotals.totalGross.toFixed(1),
      net: grandTotals.totalNet,
      money: grandTotals.totalAmount,
      vehiclePhoto: '',
      grossPhoto: '',
      saved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as WeighbridgeEntry];
    
    exportAll(entriesWithTotal, format);
    setShowExportMenu(false);
  }, [filteredEntries, grandTotals]);

  const handleBulkExport = useCallback(() => {
    if (filteredEntries.length === 0) return;
    exportWithTotals('excel');
  }, [exportWithTotals]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 text-white px-4 py-3 shadow-sm sticky top-0 z-50">
        <div className="max-w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h1 className="text-xl font-bold">📊 Dashboard</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-400 hidden sm:inline">Weighbridge Entries Overview</p>
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

      {/* Stats Cards */}
      <div className="px-4 py-4">
        <div className="max-w-full mx-auto grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="text-center">
            <Truck className="w-8 h-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Entries</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalEntries}</p>
          </Card>
          <Card className="text-center">
            <Weight className="w-8 h-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Saved Today</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.todayEntries}</p>
          </Card>
          <Card className="text-center">
            <Weight className="w-8 h-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Net Weight</p>
            <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.totalWeight.toFixed(1)} kg</p>
          </Card>
          <Card className="text-center">
            <IndianRupee className="w-8 h-8 mx-auto text-red-600 dark:text-red-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.totalAmount.toFixed(2)}</p>
          </Card>
          <Card className="text-center">
            <FileText className="w-8 h-8 mx-auto text-orange-600 dark:text-orange-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Saved Entries</p>
            <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.savedEntries}</p>
          </Card>
          <Card className="text-center">
            <Calendar className="w-8 h-8 mx-auto text-cyan-600 dark:text-cyan-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Filtered</p>
            <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{filteredEntries.length}</p>
          </Card>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="px-4 pb-4">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by vehicle number..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)} className="sm:hidden">
              <Filter className="w-4 h-4 mr-1" /> Filters
            </Button>

            <div className="flex items-center gap-2 ml-auto">
              <div className="relative">
                <Button onClick={() => setShowExportMenu(!showExportMenu)} variant="secondary">
                  <Download className="w-4 h-4 mr-1" /> Export
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    <button onClick={handleBulkExport} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FilePlus className="w-4 h-4 text-green-600" /> Export All (with Totals)
                    </button>
                    <button onClick={() => exportWithTotals('excel')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (.xlsx)
                    </button>
                    <button onClick={() => exportWithTotals('pdf')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-red-600" /> PDF (.pdf)
                    </button>
                    <button onClick={() => exportWithTotals('word')} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                      <FileType className="w-4 h-4 text-blue-600" /> Word (.docx)
                    </button>
                  </div>
                )}
              </div>
              <Button onClick={copyAllRecords} variant="secondary">
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
              <Button onClick={handlePrint} variant="ghost">
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="flex flex-col sm:flex-row gap-3 mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 animate-slide-down">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={() => { setDateFrom(''); setDateTo(''); setSearchTerm(''); }}>
                  <X className="w-4 h-4 mr-1" /> Clear Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grand Totals Bar */}
      <div className="px-4 pb-2">
        <div className="max-w-full mx-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs opacity-80">Total Tare</p>
              <p className="font-bold">{grandTotals.totalTare.toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Total Gross</p>
              <p className="font-bold">{grandTotals.totalGross.toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Total Net</p>
              <p className="font-bold">{grandTotals.totalNet.toFixed(1)} kg</p>
            </div>
            <div>
              <p className="text-xs opacity-80">Total Amount</p>
              <p className="font-bold">{grandTotals.totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 pb-8 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-900 text-white sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider w-10">#</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Tyre Type</th>
              <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider">Vehicle No.</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider">Tare (kg)</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider">Gross (kg)</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-green-300">Net (kg)</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-red-300">Amount</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider">Photos</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider">Status</th>
              <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedEntries.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  No entries found
                </td>
              </tr>
            ) : (
              paginatedEntries.map((entry, index) => (
                <tr key={entry.id} className={clsx('hover:bg-gray-50 dark:hover:bg-gray-800', entry.saved && 'bg-green-50 dark:bg-green-900/10')}>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {(currentPage - 1) * rowsPerPage + index + 1}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {entry.tyreType || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {entry.vehicle || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                    {entry.tare || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                    {entry.gross || '-'}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-bold text-green-700 dark:text-green-400">
                    {entry.net === 0 ? '-' : entry.net}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center text-sm font-bold text-red-700 dark:text-red-400">
                    {entry.money === 0 ? '-' : entry.money.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center justify-center gap-2">
                      {entry.vehiclePhoto && (
                        <button
                          onClick={() => setPhotoModal({ src: entry.vehiclePhoto!, label: 'Vehicle Photo' })}
                          className="p-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                          aria-label="View vehicle photo"
                        >
                          <img 
                            src={entry.vehiclePhoto} 
                            alt="Vehicle" 
                            className="w-10 h-10 object-cover rounded"
                          />
                          <ZoomIn className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      {entry.grossPhoto && (
                        <button
                          onClick={() => setPhotoModal({ src: entry.grossPhoto!, label: 'Gross Photo' })}
                          className="p-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                          aria-label="View gross photo"
                        >
                          <img 
                            src={entry.grossPhoto} 
                            alt="Gross" 
                            className="w-10 h-10 object-cover rounded"
                          />
                          <ZoomIn className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                      {!entry.vehiclePhoto && !entry.grossPhoto && (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center">
                    <span className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium',
                      entry.saved 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    )}>
                      {entry.saved ? 'Saved' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-center w-24">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(entry)}
                        className="p-1"
                        aria-label="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(entry)}
                        className="p-1"
                        aria-label="Copy to clipboard"
                      >
                        <Copy className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry.id!)}
                        className="p-1"
                        aria-label="Delete"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-4 flex items-center justify-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <span className="px-4 text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage} of {totalPages} ({filteredEntries.length} entries)
          </span>
          
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Copy Toast */}
      {copyToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg animate-slide-in">
          <ClipboardCheck className="w-5 h-5 inline mr-2" />
          {copyToast}
        </div>
      )}

      {/* Photo Modal */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setPhotoModal(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full mx-4">
            <button 
              onClick={() => setPhotoModal(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{photoModal.label}</h3>
              </div>
              <div className="p-4">
                <img 
                  src={photoModal.src} 
                  alt={photoModal.label}
                  className="max-w-full max-h-[70vh] w-auto h-auto object-contain mx-auto"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Record</h3>
              <button onClick={() => setEditModal(null)} className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                <input type="text" value={formatDate(editModal.createdAt)} readOnly className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tyre Type</label>
                <select
                  value={editModal.tyreType}
                  onChange={(e) => setEditModal({...editModal, tyreType: e.target.value})}
                  disabled={userRole !== 'admin'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                >
                  <option value="Radial">Radial</option>
                  <option value="Bias">Bias</option>
                  <option value="Tube">Tube</option>
                  <option value="Tubeless">Tubeless</option>
                  <option value="Other">Other</option>
                </select>
                {userRole !== 'admin' && <p className="text-xs text-gray-500 mt-1">Only Admin can edit Tyre Type</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vehicle No.</label>
                <input
                  type="text"
                  value={editModal.vehicle}
                  onChange={(e) => setEditModal({...editModal, vehicle: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tare (kg)</label>
                  <input
                    type="number"
                    value={editModal.tare}
                    onChange={(e) => {
                      const tare = e.target.value;
                      const gross = editModal.gross;
                      const net = (Number(gross) || 0) - (Number(tare) || 0);
                      const amount = net > 0 ? Number((net / 5).toFixed(2)) : 0;
                      setEditModal({...editModal, tare, net, money: amount});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gross (kg)</label>
                  <input
                    type="number"
                    value={editModal.gross}
                    onChange={(e) => {
                      const gross = e.target.value;
                      const tare = editModal.tare;
                      const net = (Number(gross) || 0) - (Number(tare) || 0);
                      const amount = net > 0 ? Number((net / 5).toFixed(2)) : 0;
                      setEditModal({...editModal, gross, net, money: amount});
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    min="0"
                    step="1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Net (kg)</label>
                  <input type="text" value={editModal.net > 0 ? editModal.net.toString() : '-'} readOnly className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 text-green-700 dark:text-green-400 font-bold" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                  <input type="text" value={editModal.money > 0 ? editModal.money.toFixed(2) : '-'} readOnly className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600 text-red-700 dark:text-red-400 font-bold" />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="secondary" onClick={() => setEditModal(null)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => saveEdit(editModal)} className="flex-1">
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};