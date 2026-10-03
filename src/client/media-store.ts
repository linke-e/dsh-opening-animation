// IndexedDB access for the local media library. Database shape mirrors the
// dsh-custom-skin pattern but with fully distinct names (ADR-004/ADR-006).

export interface MediaRecord {
  id: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: number;
}

export const DB_NAME = "dsh-opening-animation";
export const DB_VERSION = 1;
export const STORE = "media";

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

export async function getAllRecords(database: IDBDatabase): Promise<MediaRecord[]> {
  const transaction = database.transaction(STORE, "readonly");
  return requestResult(transaction.objectStore(STORE).getAll()) as Promise<MediaRecord[]>;
}

export async function putRecord(database: IDBDatabase, record: MediaRecord): Promise<void> {
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).put(record);
  await transactionDone(transaction);
}

export async function deleteRecord(database: IDBDatabase, id: string): Promise<void> {
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).delete(id);
  await transactionDone(transaction);
}

export async function clearRecords(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(STORE, "readwrite");
  transaction.objectStore(STORE).clear();
  await transactionDone(transaction);
}

export function makeId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
