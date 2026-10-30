import { validate, mergeEvents, currentStaff } from './model.js';
const dbName = 'entrance-counter-v1';
export function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('別タブを閉じて再読込してください'));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
  });
}
export function read(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const request = tx.objectStore('state').get('events');
    tx.oncomplete = () => { try { resolve(validate(request.result || [])); } catch (e) { reject(e); } };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error('読込失敗'));
  });
}
export function write(db, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state');
    let next, failure;
    const request = store.get('events');
    request.onsuccess = () => {
      try {
        const events = validate(request.result || []);
        if (operation.type === 'restore') next = mergeEvents(events, operation.events);
        else if (events.some(e => e.id === operation.id)) next = events;
        else {
          const { type, ...event } = operation;
          // Staff is resolved inside this transaction, including changes from other tabs.
          event.staff = currentStaff(events);
          if (event.kind === 'staff') event.staff = operation.name;
          delete event.name;
          next = validate([...events, event]);
        }
        store.put(next, 'events');
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure || tx.error);
    tx.onabort = () => reject(failure || tx.error || Error('保存できませんでした'));
  });
}
