import { Injectable } from '@angular/core';

const DB_NAME = 'drec-field-capture';
const DB_VERSION = 1;
const STORE = 'pending';

export interface QueuedCapture {
  clientCaptureId: string;
  /** The capture payload, exactly as the API expects it. */
  capture: Record<string, any>;
  photo: Blob;
  attempts: number;
  queuedAt: string;
  lastError?: string;
}

/**
 * Offline queue for captures taken out of signal.
 *
 * Scope, stated plainly: this protects a capture taken while the page is
 * already open. drec-ui has no service worker, so an operator arriving at a
 * site with no signal and a cold browser cannot load the page at all. Real
 * offline-first needs @angular/pwa, which changes caching for the whole app.
 *
 * On iOS there is a second limit: Safari evicts script-writable storage,
 * IndexedDB included, after 7 days without a visit for sites that are not
 * installed to the Home Screen. A capture that cannot reach the server for a
 * week is therefore gone. Hence: flush eagerly, show the pending count where
 * the operator cannot miss it, and tell them to install the page.
 */
@Injectable()
export class CaptureQueueService {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) {
            db.createObjectStore(STORE, { keyPath: 'clientCaptureId' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.db;
  }

  public async add(item: QueuedCapture): Promise<void> {
    const db = await this.open();
    await this.tx(db, 'readwrite', (store) => store.put(item));
  }

  public async remove(clientCaptureId: string): Promise<void> {
    const db = await this.open();
    await this.tx(db, 'readwrite', (store) => store.delete(clientCaptureId));
  }

  public async all(): Promise<QueuedCapture[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db
        .transaction(STORE, 'readonly')
        .objectStore(STORE)
        .getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error);
    });
  }

  public async count(): Promise<number> {
    try {
      return (await this.all()).length;
    } catch {
      // Private browsing and blocked site data both make IndexedDB throw.
      // A broken queue must not break the capture screen.
      return 0;
    }
  }

  /** Record a failed send so the operator can see why something is stuck. */
  public async noteFailure(
    clientCaptureId: string,
    message: string,
  ): Promise<void> {
    const items = await this.all();
    const item = items.find((i) => i.clientCaptureId === clientCaptureId);
    if (!item) return;
    item.attempts += 1;
    item.lastError = message;
    await this.add(item);
  }

  private tx(
    db: IDBDatabase,
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
