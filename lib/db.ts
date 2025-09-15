import type { CalculationResults } from '../components/SprayFoamCalculator';
import type { Costs } from '../components/EstimatePDF';
import { uploadToGCS, deleteFromGCS } from './gcs';

const DB_NAME = 'SprayFoamEstimatorDB';
const DB_VERSION = 2; // Incremented version for schema change
const ESTIMATES_STORE_NAME = 'estimates';

export type JobStatus = 'estimate' | 'sold' | 'invoiced' | 'paid';

export interface EstimateRecord {
  id?: number;
  customerId: number;
  estimatePdfPath: string; // GCS Path
  materialOrderPdfPath: string; // GCS Path
  estimateNumber: string;
  createdAt: Date;
  calcData?: CalculationResults;
  costsData?: Costs;
  status: JobStatus;
  scopeOfWork?: string;
}

// Arguments for the saveEstimate function
export interface SaveEstimateArgs {
  customerId: number;
  estimatePdf: Blob;
  materialOrderPdf: Blob;
  estimateNumber: string;
  calcData?: CalculationResults;
  costsData?: Costs;
  status: JobStatus;
  scopeOfWork?: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject("IndexedDB error");
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 2) {
        // The object structure has changed (Blob -> string path),
        // so the safest migration is to delete and recreate the store.
        if (db.objectStoreNames.contains(ESTIMATES_STORE_NAME)) {
          db.deleteObjectStore(ESTIMATES_STORE_NAME);
        }
        const store = db.createObjectStore(ESTIMATES_STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('customerId', 'customerId', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

export async function saveEstimate(estimateData: SaveEstimateArgs): Promise<EstimateRecord> {
  const { customerId, estimateNumber, estimatePdf, materialOrderPdf } = estimateData;

  // 1. Upload files to GCS and get their paths
  const estimatePath = `customers/${customerId}/estimates/${estimateNumber}/estimate.pdf`;
  const materialOrderPath = `customers/${customerId}/estimates/${estimateNumber}/material_order.pdf`;

  const [estimatePdfPath, materialOrderPdfPath] = await Promise.all([
    uploadToGCS(estimatePdf, estimatePath),
    uploadToGCS(materialOrderPdf, materialOrderPath)
  ]);

  // 2. Prepare the record for IndexedDB (without blobs)
  const recordToSave: Omit<EstimateRecord, 'id'> = {
    customerId: estimateData.customerId,
    estimateNumber: estimateData.estimateNumber,
    calcData: estimateData.calcData,
    costsData: estimateData.costsData,
    status: estimateData.status,
    scopeOfWork: estimateData.scopeOfWork,
    estimatePdfPath,
    materialOrderPdfPath,
    createdAt: new Date(),
  };

  // 3. Save the record to IndexedDB
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ESTIMATES_STORE_NAME);
    const request = store.add(recordToSave);

    request.onsuccess = () => {
      const newRecord: EstimateRecord = { ...recordToSave, id: request.result as number };
      resolve(newRecord);
    };
    request.onerror = () => {
      console.error('Error saving estimate record:', request.error);
      reject(request.error);
    };
  });
}

async function getEstimate(id: number): Promise<EstimateRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ESTIMATES_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => {
      console.error('Error fetching estimate:', request.error);
      reject(request.error);
    };
  });
}


export async function getEstimatesForCustomer(customerId: number): Promise<EstimateRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ESTIMATES_STORE_NAME);
    const index = store.index('customerId');
    const request = index.getAll(customerId);

    request.onsuccess = () => {
      const sortedResults = request.result.sort((a: EstimateRecord, b: EstimateRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(sortedResults);
    };

    request.onerror = () => {
      console.error('Error fetching estimates:', request.error);
      reject(request.error);
    };
  });
}

export async function getAllEstimates(): Promise<EstimateRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(ESTIMATES_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
       const sortedResults = request.result.sort((a: EstimateRecord, b: EstimateRecord) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(sortedResults);
    };
    request.onerror = () => {
      console.error('Error fetching all estimates:', request.error);
      reject(request.error);
    };
  });
}

export async function updateEstimateStatus(id: number, status: JobStatus): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(ESTIMATES_STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const record = getRequest.result;
            if (record) {
                record.status = status;
                const putRequest = store.put(record);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => {
                    console.error('Error updating estimate status:', putRequest.error);
                    reject(putRequest.error);
                };
            } else {
                reject(`Record with id ${id} not found.`);
            }
        };
        getRequest.onerror = () => {
            console.error('Error fetching record for update:', getRequest.error);
            reject(getRequest.error);
        };
    });
}

export async function deleteEstimate(id: number): Promise<void> {
  const recordToDelete = await getEstimate(id);
  
  // Attempt to delete files from GCS first.
  if (recordToDelete) {
    try {
      await Promise.all([
        deleteFromGCS(recordToDelete.estimatePdfPath),
        deleteFromGCS(recordToDelete.materialOrderPdfPath)
      ]);
    } catch (error) {
      console.error("Failed to delete one or more files from GCS, but proceeding with DB deletion:", error);
      // We proceed to delete the DB record even if GCS deletion fails
      // to avoid an orphaned record in the UI.
    }
  }

  // Now, delete the record from IndexedDB.
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(ESTIMATES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(ESTIMATES_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => {
      console.error('Error deleting estimate from DB:', request.error);
      reject(request.error);
    };
  });
}
