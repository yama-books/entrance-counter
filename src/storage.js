import { validate, mergeEvents, currentStaff, dayOf, summary } from './model.js';
import { validatePredictions, mergePredictions } from './forecast.js';
import { validateDayResults, mergeDayResults, assertFinalizedRecords, dayRecordIds, eventDays, finishEvent } from './event-days.js';
const dbName = 'entrance-counter-v1';
export function openStore() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('state')) request.result.createObjectStore('state'); };
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
    const request = store.get('events'), predictionRequest = operation.type === 'restore' ? store.get('predictions') : null, resultsRequest = store.get('day-results');
    resultsRequest.onsuccess = () => {
      try {
        const events = validate(request.result || []);
        if (operation.type === 'restore') {
          next = mergeEvents(events, operation.events);
          const results = mergeDayResults(resultsRequest.result || [], operation.dayResults === undefined ? [] : operation.dayResults);
          assertFinalizedRecords(resultsRequest.result || [], next); assertFinalizedRecords(results, next);
          store.put(results, 'day-results');
          if (operation.predictions !== undefined) store.put(mergePredictions(predictionRequest.result || [], operation.predictions), 'predictions');
        }
        else if (events.some(e => e.id === operation.id)) next = events;
        else {
          const { type, ...event } = operation;
          // Staff is resolved inside this transaction, including changes from other tabs.
          event.staff = currentStaff(events);
          if (event.kind === 'staff') event.staff = operation.name;
          delete event.name;
          next = validate([...events, event]); assertFinalizedRecords(validateDayResults(resultsRequest.result || []), next);
        }
        store.put(next, 'events');
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure || tx.error);
    tx.onabort = () => reject(failure || tx.error || Error('保存できませんでした'));
  });
}
export function readDayResults(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly'), request = tx.objectStore('state').get('day-results');
    tx.oncomplete = () => { try { resolve(validateDayResults(request.result || [])); } catch (e) { reject(e); } };
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('終了記録を読み込めませんでした'));
  });
}
export function readBackup(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly'), store = tx.objectStore('state');
    const events = store.get('events'), predictions = store.get('predictions'), results = store.get('day-results');
    tx.oncomplete = () => {
      try {
        const backup = { events: validate(events.result || []), predictions: validatePredictions(predictions.result || []), dayResults: validateDayResults(results.result || []) };
        assertFinalizedRecords(backup.dayResults, backup.events); resolve(backup);
      } catch (e) { reject(e); }
    };
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('バックアップを読み込めませんでした'));
  });
}
export function saveDayResult(db, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), events = store.get('events'), results = store.get('day-results');
    let next, failure;
    results.onsuccess = () => {
      try {
        const current = validateDayResults(results.result || []), counts = validate(events.result || []);
        const saved = current.find(r => r.id === operation.id);
        if (saved) { if (saved.date !== operation.date || saved.kind !== operation.kind) throw Error('終了記録IDが競合しています'); next = current; return; }
        if (!eventDays.includes(operation.date) || operation.date > dayOf(new Date())) throw Error('まだ終了できない日付です');
        if (operation.kind === 'close' && operation.expectedIds && JSON.stringify(operation.expectedIds) !== JSON.stringify(dayRecordIds(counts, operation.date))) throw Error('記録が更新されました。結果を確認してもう一度確定してください');
        const { expectedIds, ...input } = operation;
        const result = { ...input, at: new Date().toISOString(), staff: currentStaff(counts) };
        if (result.kind === 'close') { result.totals = summary(counts, result.date).totals; result.ids = dayRecordIds(counts, result.date); }
        next = validateDayResults([...current, result]); assertFinalizedRecords(next, counts); store.put(next, 'day-results');
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure || tx.error); tx.onabort = () => reject(failure || tx.error || Error('終了状態を保存できませんでした'));
  });
}
export function finishAllDays(db, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), events = store.get('events'), results = store.get('day-results');
    let next, failure;
    results.onsuccess = () => {
      try {
        const counts = validate(events.result || []);
        next = finishEvent(results.result || [], counts, { ...operation, staff:currentStaff(counts) });
        store.put(next, 'day-results');
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure || tx.error); tx.onabort = () => reject(failure || tx.error || Error('全日程の終了を保存できませんでした'));
  });
}
export function readPredictions(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly'), request = tx.objectStore('state').get('predictions');
    tx.oncomplete = () => { try { resolve(validatePredictions(request.result || [])); } catch (e) { reject(e); } };
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('予測を読み込めませんでした'));
  });
}
export function savePrediction(db, prediction) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state'), request = store.get('predictions');
    let next, failure;
    request.onsuccess = () => {
      try {
        if (!eventDays.includes(prediction.date)) throw Error('予測を入力できるのは10/31と11/1です');
        if (prediction.date !== dayOf(new Date())) throw Error('日付が変わりました。予測の画面を開き直してください');
        next = mergePredictions(request.result || [], [prediction]); store.put(next, 'predictions');
      } catch (e) { failure = e; tx.abort(); }
    };
    tx.oncomplete = () => resolve(next);
    tx.onerror = () => reject(failure || tx.error); tx.onabort = () => reject(failure || tx.error || Error('予測を保存できませんでした'));
  });
}
export function readShift(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly');
    const request = tx.objectStore('state').get('shift-image');
    tx.oncomplete = () => {
      const image = request.result;
      // Images are stored as bytes because WebKit can reject Blob/File values in IndexedDB.
      resolve(image ? { name: image.name, at: image.at, blob: image.blob || new Blob([image.bytes], { type: image.type }) } : null);
    };
    tx.onerror = () => reject(tx.error || Error('シフト表を読み込めませんでした'));
    tx.onabort = () => reject(tx.error || Error('シフト表を読み込めませんでした'));
  });
}
export async function writeShift(db, image) {
  const bytes = await image.blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put({ bytes, type: image.blob.type, name: image.name, at: image.at }, 'shift-image');
    tx.oncomplete = () => resolve(image);
    tx.onerror = () => reject(tx.error || Error('シフト表を保存できませんでした'));
    tx.onabort = () => reject(tx.error || Error('シフト表を保存できませんでした'));
  });
}
