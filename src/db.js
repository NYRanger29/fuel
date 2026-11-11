// db.js: the app's filing cabinet.
// Everything is saved in IndexedDB, a database built into the browser.
// Nothing here ever leaves the device.

const DB_NAME = 'fuel';
const DB_VERSION = 1;

// Each "collection" is one drawer in the cabinet.
export const COLLECTIONS = ['foods', 'weights', 'pantry', 'workouts', 'days', 'recipes'];

let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of COLLECTIONS) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function run(collection, mode, work) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(collection, mode);
        const result = work(tx.objectStore(collection));
        tx.oncomplete = () => resolve(result?.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export const getAll = (collection) => run(collection, 'readonly', (s) => s.getAll());
export const put = (collection, record) => run(collection, 'readwrite', (s) => s.put(record));
export const remove = (collection, id) => run(collection, 'readwrite', (s) => s.delete(id));
export const clear = (collection) => run(collection, 'readwrite', (s) => s.clear());

// Ask the browser not to clear our data when the phone runs low on space.
export function requestPersistence() {
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}
