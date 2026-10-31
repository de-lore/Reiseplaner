// --- APP-DIALOGE ---
    function openAppDialog({
      type = 'confirm', title = 'Hinweis', message = '', defaultValue = '',
      placeholder = '', confirmText = 'OK', cancelText = 'Abbrechen', variant = 'indigo', icon = 'fa-circle-question'
    }) {
      return new Promise((resolve) => {
        activeDialogResolver = resolve;
        activeDialogType = type;
        const modal = document.getElementById('appDialogModal');
        if (!modal) return resolve(type === 'prompt' ? null : false);

        document.getElementById('appDialogTitle').innerText = title;
        document.getElementById('appDialogMessage').innerText = message;
        document.getElementById('appDialogIcon').className = `fa-solid ${icon}`;

        const iconBox = document.getElementById('appDialogIconBox');
        const confirmBtn = document.getElementById('appDialogConfirmBtn');
        const cancelBtn = document.getElementById('appDialogCancelBtn');
        const inputWrap = document.getElementById('appDialogInputWrap');
        const inputEl = document.getElementById('appDialogInput');

        const styles = {
          danger: ['bg-rose-500/15 text-rose-600 dark:text-rose-400', 'bg-rose-600 hover:bg-rose-500'],
          amber: ['bg-amber-500/15 text-amber-600 dark:text-amber-400', 'bg-amber-600 hover:bg-amber-500'],
          indigo: ['bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', 'bg-indigo-600 hover:bg-indigo-500']
        }[variant] || ['bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', 'bg-indigo-600 hover:bg-indigo-500'];

        iconBox.className = `w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${styles[0]}`;
        confirmBtn.className = `px-4 py-2 rounded-xl text-white text-xs font-semibold transition shadow flex items-center gap-1.5 ${styles[1]}`;
        confirmBtn.innerText = confirmText;
        cancelBtn.innerText = cancelText;
        cancelBtn.classList.toggle('hidden', type === 'alert');

        inputWrap.classList.toggle('hidden', type !== 'prompt');
        if (type === 'prompt') {
          inputEl.value = defaultValue || '';
          inputEl.placeholder = placeholder || '';
        }

        toggleModal('appDialogModal', true);
        setTimeout(() => {
          if (type === 'prompt') { inputEl.focus(); inputEl.select(); }
          else confirmBtn.focus();
        }, 40);
      });
    }

    function resolveAppDialog(confirmed) {
      toggleModal('appDialogModal', false);
      if (!activeDialogResolver) return;
      const res = activeDialogResolver, t = activeDialogType;
      activeDialogResolver = null;
      res(t === 'prompt' ? (confirmed ? document.getElementById('appDialogInput').value : null) : Boolean(confirmed));
    }

    const showAppAlert = (m, t = 'Hinweis', v = 'amber', i = 'fa-circle-exclamation') => openAppDialog({ type: 'alert', title: t, message: m, confirmText: 'Verstanden', variant: v, icon: i });
    const showAppConfirm = (m, o = {}) => openAppDialog({ type: 'confirm', title: o.title || 'Bitte bestätigen', message: m, confirmText: o.confirmText || 'Bestätigen', cancelText: o.cancelText || 'Abbrechen', variant: o.variant || 'indigo', icon: o.icon || 'fa-circle-question' });
    const showAppPrompt = (m, d = '', o = {}) => openAppDialog({ type: 'prompt', title: o.title || 'Eingabe', message: m, defaultValue: d, placeholder: o.placeholder || '', confirmText: o.confirmText || 'Speichern', cancelText: o.cancelText || 'Abbrechen', variant: o.variant || 'indigo', icon: o.icon || 'fa-pen' });

    // --- INDEXEDDB ---
    function openDB() {
      if (dbInstancePromise) return dbInstancePromise;
      return dbInstancePromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(TRIPS_STORE)) db.createObjectStore(TRIPS_STORE);
          if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => { req.result.close(); dbInstancePromise = null; };
          resolve(req.result);
        };
        req.onerror = () => { dbInstancePromise = null; reject(req.error); };
      });
    }

    async function dbOp(store, mode, cb, fallback = null) {
      try {
        const db = await openDB();
        return await new Promise((res, rej) => {
          const tx = db.transaction(store, mode), req = cb(tx.objectStore(store));
          if (mode === 'readonly') { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }
          else { tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }
        });
      } catch (e) { console.warn(`DB Error (${store}/${mode}):`, e); return fallback; }
    }

    const tripsGet = k => dbOp(TRIPS_STORE, 'readonly', s => s.get(k), null);
    const tripsSet = (k, v) => dbOp(TRIPS_STORE, 'readwrite', s => s.put(v, k), false);
    const mediaStorePut = async (id, blob, name, type, size) => {
      const saved = await dbOp(MEDIA_STORE, 'readwrite', s => s.put({ id, blob, name, type, size, createdAt: Date.now() }), false);
      if (saved) checkStorageCapacity(true);
      return saved;
    };
    const mediaStoreGet = id => dbOp(MEDIA_STORE, 'readonly', s => s.get(id), null);
    const mediaStoreDelete = id => dbOp(MEDIA_STORE, 'readwrite', s => s.delete(id), false);

    async function safeDeleteMedia(id) {
      if (!id) return;
      revokeMediaBlobUrl(id);
      const isUsed = days => Array.isArray(days) && days.some(d => d?.images?.some(img => img?.id === id));
      if (isUsed(tripData.days)) return;
      const backups = (await tripsGet('backups')) || [];
      if (!backups.some(b => isUsed(b?.data?.days))) await mediaStoreDelete(id);
    }

    async function getMediaBlobUrl(id) {
      if (!id) return null;
      if (activeMediaObjectUrls.has(id)) return activeMediaObjectUrls.get(id);
      const rec = await mediaStoreGet(id);
      if (rec?.blob) {
        const url = URL.createObjectURL(rec.blob);
        activeMediaObjectUrls.set(id, url);
        return url;
      }
      return null;
    }

    function revokeMediaBlobUrl(id) {
      if (activeMediaObjectUrls.has(id)) {
        URL.revokeObjectURL(activeMediaObjectUrls.get(id));
        activeMediaObjectUrls.delete(id);
      }
    }

    const generateUUID = () => window.crypto?.randomUUID ? window.crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    function dataURLtoBlob(url) {
      const [hdr, b64] = url.split(','), mime = hdr.match(/:(.*?);/)?.[1] || 'application/octet-stream', str = atob(b64);
      const u8 = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) u8[i] = str.charCodeAt(i);
      return new Blob([u8], { type: mime });
    }

    const blobToDataURL = blob => new Promise((res, rej) => {
      const r = new FileReader(); r.onloadend = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
    });

    async function buildExportPayload() {
      const clone = JSON.parse(JSON.stringify(tripData));
      for (const d of (clone.days || [])) {
        for (const item of (d.images || [])) {
          if (item?.id && !item.data) {
            const rec = await mediaStoreGet(item.id);
            if (rec?.blob) { try { item.data = await blobToDataURL(rec.blob); } catch (e) {} }
          }
        }
      }
      return clone;
    }

    async function migrateImagesToMediaStore(days) {
      if (!Array.isArray(days)) return days;
      for (const day of days) {
        if (!Array.isArray(day.images)) continue;
        const sanitized = [];
        for (const item of day.images) {
          if (!item) continue;
          const rawData = typeof item === 'string' ? item : item.data;
          const name = item.name || 'Dokument', type = item.type || (rawData?.startsWith('data:application/pdf') ? 'pdf' : 'image');
          if (rawData?.startsWith('data:')) {
            try {
              const blob = dataURLtoBlob(rawData), id = item.id || generateUUID();
              revokeMediaBlobUrl(id);
              await mediaStorePut(id, blob, name, type, blob.size);
              sanitized.push({ id, name, type, size: blob.size });
            } catch (e) {}
          } else if (item.id) {
            sanitized.push({ id: item.id, name, type, size: item.size || 0 });
          }
        }
        day.images = sanitized;
      }
      return days;
    }
