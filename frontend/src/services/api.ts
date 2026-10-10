import { WeighbridgeEntry, DashboardStats, ExportOptions } from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Entries
  getEntries: () => fetchApi<WeighbridgeEntry[]>('/entries'),
  getEntry: (id: string) => fetchApi<WeighbridgeEntry>(`/entries/${id}`),
  createEntry: (entry: Omit<WeighbridgeEntry, 'id' | 'createdAt' | 'updatedAt'>) => 
    fetchApi<WeighbridgeEntry>('/entries', {
      method: 'POST',
      body: JSON.stringify(entry),
    }),
  updateEntry: (id: string, entry: Partial<WeighbridgeEntry>) => 
    fetchApi<WeighbridgeEntry>(`/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    }),
  deleteEntry: (id: string) => fetchApi<void>(`/entries/${id}`, { method: 'DELETE' }),
  
  // Dashboard
  getStats: () => fetchApi<DashboardStats>('/stats'),
  
  // Export
  exportData: (options: ExportOptions) => fetchApi<Blob>(`/export?format=${options.format}`, {
    method: 'GET',
  }),

  // Bulk operations
  bulkCreate: (entries: Omit<WeighbridgeEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => 
    fetchApi<WeighbridgeEntry[]>('/entries/bulk', {
      method: 'POST',
      body: JSON.stringify(entries),
    }),
};

// Local storage fallback for offline/development
export const localStorageApi = {
  getEntries: (): WeighbridgeEntry[] => {
    const saved = localStorage.getItem('dharam_kaanta_entries');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  },
  saveEntries: (entries: WeighbridgeEntry[]) => {
    localStorage.setItem('dharam_kaanta_entries', JSON.stringify(entries));
  },
  addEntry: (entry: WeighbridgeEntry) => {
    const entries = localStorageApi.getEntries();
    entries.push({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
    localStorageApi.saveEntries(entries);
    return entry;
  },
  updateEntry: (id: string, updates: Partial<WeighbridgeEntry>) => {
    const entries = localStorageApi.getEntries();
    const idx = entries.findIndex(e => e.id === id);
    if (idx >= 0) {
      entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() };
      localStorageApi.saveEntries(entries);
      return entries[idx];
    }
    return null;
  },
  deleteEntry: (id: string) => {
    const entries = localStorageApi.getEntries().filter(e => e.id !== id);
    localStorageApi.saveEntries(entries);
  },
};