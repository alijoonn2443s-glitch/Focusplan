const CACHE_NAME = 'focusplan-v208-release';
const APP_SHELL = ['./', './index.html', './mainfest.json', './icon.svg'];
const DB_NAME = 'focusplan-reminders';
const DB_STORE = 'reminders';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});

function openReminderDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, {keyPath: 'id'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveReminders(list) {
  const db = await openReminderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    store.clear();
    (Array.isArray(list) ? list : []).filter(r => r && !r.notified).forEach(r => store.put(r));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getReminders() {
  const db = await openReminderDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function checkReminders() {
  const list = await getReminders();
  const now = Date.now();
  const remaining = [];
  for (const r of list) {
    const when = new Date(`${r.date}T${r.time}:00`).getTime();
    if (Number.isFinite(when) && when <= now && when > now - 5 * 60 * 1000) {
      await self.registration.showNotification('وقت مطالعه رسید 📚', {
        body: `${r.subject || 'مطالعه'} • ${r.duration || 45} دقیقه`,
        icon: './icon.svg',
        badge: './icon.svg',
        tag: `fp-reminder-${r.id}`,
        data: {url: './index.html'}
      });
    } else if (Number.isFinite(when) && when > now) {
      remaining.push(r);
    }
  }
  await saveReminders(remaining);
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'FP_SYNC_REMINDERS') {
    event.waitUntil(saveReminders(data.reminders || []));
  }
  if (data.type === 'FP_CHECK_REMINDERS') event.waitUntil(checkReminders());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window', includeUncontrolled:true}).then(list => {
    for (const client of list) {
      if ('focus' in client) return client.focus();
    }
    return clients.openWindow('./index.html');
  }));
});

self.addEventListener('sync', event => {
  if (event.tag === 'focusplan-reminders') event.waitUntil(checkReminders());
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'focusplan-reminders') event.waitUntil(checkReminders());
});
