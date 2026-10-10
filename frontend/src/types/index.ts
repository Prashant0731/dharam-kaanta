export type UserRole = 'admin' | 'operator';

export interface WeighbridgeEntry {
  id?: string;
  sno: number;
  tyreType: string;        // NEW: Tyre Type field
  vehicle: string;
  tare: string;
  gross: string;
  vehiclePhoto: string;
  grossPhoto: string;
  net: number;
  money: number;
  saved: boolean;
  createdAt?: string;
  updatedAt?: string;
  role?: UserRole;         // NEW: Track who created/edited
}

export interface DashboardStats {
  totalEntries: number;
  todayEntries: number;
  totalWeight: number;
  totalAmount: number;
}

export interface ExportOptions {
  format: 'excel' | 'pdf' | 'word';
  dateFrom?: string;
  dateTo?: string;
  vehicleFilter?: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

// Export data structure for copy/export
export interface ExportRow {
  sno: number;
  tyreType: string;
  vehicle: string;
  tare: string;
  gross: string;
  net: number;
  amount: number;
  vehiclePhoto: string;
  grossPhoto: string;
  status: string;
  createdAt: string;
}