import { DB_NAME, DB_VERSION, DB_STORE_ROUNDS, DB_STORE_COURSES, LS_LAST_SYNC_KEY } from './constants.js';

let dbInstance = null;

export function initDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (db.objectStoreNames.contains(DB_STORE_ROUNDS)) {
        db.deleteObjectStore(DB_STORE_ROUNDS);
      }
      if (db.objectStoreNames.contains(DB_STORE_COURSES)) {
        db.deleteObjectStore(DB_STORE_COURSES);
      }
      db.createObjectStore(DB_STORE_ROUNDS, { keyPath: 'id' });
      db.createObjectStore(DB_STORE_COURSES, { keyPath: 'id' });

      try {
        localStorage.removeItem(LS_LAST_SYNC_KEY);
      } catch (err) {
        console.warn('Could not clear last sync timestamp:', err);
      }
    };
  });
}

export async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await initDb();
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Rounds Operations
export function putRound(db, round) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_ROUNDS, 'readwrite');
    const store = transaction.objectStore(DB_STORE_ROUNDS);
    const request = store.put(round);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function deleteRound(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_ROUNDS, 'readwrite');
    const store = transaction.objectStore(DB_STORE_ROUNDS);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function getAllRounds(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_ROUNDS, 'readonly');
    const store = transaction.objectStore(DB_STORE_ROUNDS);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Courses Operations
export function putCourse(db, course) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_COURSES, 'readwrite');
    const store = transaction.objectStore(DB_STORE_COURSES);
    const request = store.put(course);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function deleteCourse(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_COURSES, 'readwrite');
    const store = transaction.objectStore(DB_STORE_COURSES);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function getAllCourses(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE_COURSES, 'readonly');
    const store = transaction.objectStore(DB_STORE_COURSES);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
