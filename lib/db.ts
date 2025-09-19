import Dexie, { Table } from 'dexie';
// FIX: Added .tsx extension to component imports
import { CustomerInfo, Costs } from '../components/EstimatePDF.tsx';
import { CalculationResults } from '../components/SprayFoamCalculator.tsx';
// FIX: Added .ts extension to type import
import { TimeEntry, Employee } from '../components/types.ts';

export type JobStatus = 'estimate' | 'sold' | 'invoiced' | 'paid';

export interface EstimateRecord {
  id?: number;
  customerId: number;
  estimatePdf: Blob;
  materialOrderPdf: Blob;
  estimateNumber: string;
  calcData: Omit<CalculationResults, 'customer'> & { customer?: CustomerInfo };
  costsData: Costs;
  scopeOfWork: string;
  status: JobStatus;
  createdAt: string; // ISO string
}

export interface InventoryItem {
  id?: number;
  name: string;
  category: string;
  quantity: number;
  unitCost?: number;
  notes?: string;
}

export class AppDatabase extends Dexie {
  customers!: Table<CustomerInfo, number>;
  estimates!: Table<EstimateRecord, number>;
  employees!: Table<Employee, number>;
  time_log!: Table<TimeEntry, number>;
  inventory!: Table<InventoryItem, number>;

  constructor() {
    super('foamCrmDatabase');
    // FIX: Moved schema definition inside the constructor. This is the standard Dexie pattern and resolves the TypeScript error.
    this.version(3).stores({
      customers: '++id, name, address',
      estimates: '++id, customerId, estimateNumber, status, createdAt',
      employees: '++id, name',
      time_log: '++id, employeeId, jobId, startTime, endTime, startLat, startLng, endLat, endLng, durationHours',
      inventory: '++id, name, category',
    });
  }
}

export const db = new AppDatabase();

// --- DB Helper Functions ---

export async function saveEstimate(estimate: Omit<EstimateRecord, 'id' | 'createdAt'>): Promise<EstimateRecord> {
  const recordToSave: Omit<EstimateRecord, 'id'> = {
    ...estimate,
    createdAt: new Date().toISOString()
  };
  const id = await db.estimates.add(recordToSave as EstimateRecord);
  return { ...recordToSave, id };
}

export async function getEstimatesForCustomer(customerId: number): Promise<EstimateRecord[]> {
  return db.estimates.where('customerId').equals(customerId).toArray();
}

export async function getTimeEntriesForJob(jobId: number): Promise<TimeEntry[]> {
    return db.time_log.where('jobId').equals(jobId).toArray();
}

export async function getActiveTimeEntry(employeeId: number): Promise<TimeEntry | undefined> {
    return db.time_log.where({ employeeId }).filter(entry => !entry.endTime).first();
}

export async function saveTimeEntry(entry: TimeEntry): Promise<number> {
    return db.time_log.put(entry);
}