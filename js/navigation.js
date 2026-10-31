// --- NAVIGATION & VIEWS ---
    function switchTab(t) {
      currentTab = t;
      ['plan', 'lodgings', 'budget', 'notes'].forEach(tab => {
        const act = tab === t;
        document.getElementById('tabContent-' + tab)?.classList.toggle('hidden', !act);
        const dBtn = document.getElementById('deskTabBtn-' + tab), mBtn = document.getElementById('mobTabBtn-' + tab);
        if (dBtn) dBtn.className = act ? "px-4 py-1.5 rounded-xl font-bold bg-indigo-600 text-white shadow-sm transition flex items-center gap-2 shrink-0" : "px-4 py-1.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2 shrink-0";
        if (dBtn) dBtn.setAttribute('aria-current', act ? 'page' : 'false');
        if (mBtn) {
          mBtn.className = act ? "mobile-tab-button w-full min-w-0 flex flex-col items-center justify-center py-1 px-0 text-indigo-600 dark:text-indigo-400 font-bold transition" : "mobile-tab-button w-full min-w-0 flex flex-col items-center justify-center py-1 px-0 text-slate-500 dark:text-slate-400 font-medium transition";
          mBtn.setAttribute('aria-current', act ? 'page' : 'false');
        }
      });
      document.getElementById('headerFilterBar')?.classList.toggle('hidden', t !== 'plan');
      if (t === 'lodgings') renderLodgingsTab();
      if (t === 'budget') updateStats();
      if (t === 'notes') renderAllAttachmentsOverview();
      if (['plan', 'notes'].includes(t)) autoResizeAllTextareas();
    }

    const toggleMoreMenu = () => document.getElementById('moreMenuDropdown')?.classList.toggle('hidden');

    document.addEventListener('click', e => {
      const menu = document.getElementById('moreMenuDropdown'), btn = document.getElementById('moreMenuBtn');
      if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn?.contains(e.target)) menu.classList.add('hidden');
      if (!e.target.closest('.activity-action-dropdown') && !e.target.closest('[data-action="toggle-activity-menu"]')) {
        document.querySelectorAll('.activity-action-dropdown').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[data-action="toggle-activity-menu"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
      }
    });

    function toggleConfigPanel() {
      const p = document.getElementById('tripConfigSection');
      if (!p) return;
      if (p.classList.contains('hidden')) {
        if (currentTab !== 'plan') switchTab('plan');
        p.classList.remove('hidden'); p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        document.getElementById('startDate').value = tripData.startDate || '';
        document.getElementById('endDate').value = tripData.endDate || '';
        updateHeadline(); updateTripCountdown(); p.classList.add('hidden');
      }
    }

    function updateHeadline() {
      const titleEl = document.getElementById('headerTripTitle'), datesEl = document.getElementById('headerTripDates'), countEl = document.getElementById('headerTripDaysCount');
      if (titleEl) titleEl.innerText = (tripData.title || '').trim() || 'Reiseplaner';
      const days = tripData.days || [], nights = days.filter(isNightDay).length;
      if (datesEl) {
        const s = document.getElementById('startDate')?.value || tripData.startDate, e = document.getElementById('endDate')?.value || tripData.endDate;
        datesEl.innerText = (s && e) ? `${formatISODate(s).dayFormatted} – ${formatISODate(e).dayFormatted}` : 'Kein Reisezeitraum festgelegt';
      }
      if (countEl) {
        countEl.classList.toggle('hidden', !days.length);
        if (days.length) countEl.innerText = nights !== days.length ? `${days.length} Tage · ${nights} Nächte` : `${nights} Nächte`;
      }
    }

    function getDayVisualClasses(day, isToday) {
      const isSettled = isDayLodgingSettled(day), hasLoc = Boolean((day.location || '').trim());
      const btnClass = isSettled ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : (hasLoc ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-rose-600 hover:bg-rose-500 text-white');
      if (isToday) return { cardClass: 'bg-white dark:bg-slate-800/90 border-indigo-500 ring-2 ring-indigo-500/80 today-highlight', headerClass: 'border-indigo-200 bg-indigo-50/80 dark:border-indigo-500/40 dark:bg-indigo-950/40', btnClass };
      if (isSettled) return { cardClass: 'bg-emerald-100/80 border-emerald-500 dark:bg-emerald-950/50 dark:border-emerald-500/70', headerClass: 'border-emerald-300 bg-emerald-200/90 dark:border-emerald-500/50 dark:bg-emerald-900/70', btnClass };
      if (hasLoc) return { cardClass: 'bg-amber-100/80 border-amber-500 dark:bg-amber-950/50 dark:border-amber-500/70', headerClass: 'border-amber-300 bg-amber-200/90 dark:border-amber-500/50 dark:bg-amber-900/70', btnClass };
      return { cardClass: 'bg-rose-50/90 border-rose-300 dark:bg-rose-950/30 dark:border-rose-900/50', headerClass: 'border-rose-200 bg-rose-100/80 dark:border-rose-900/40 dark:bg-rose-950/50', btnClass };
    }

    function getLocationBoxClasses(day) {
      const base = 'relative flex items-center rounded-xl px-3 py-1.5 sm:py-2 border-2 transition ';
      if (isDayLodgingSettled(day)) return base + 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 dark:bg-emerald-950/50 dark:border-emerald-500';
      if ((day?.location || '').trim()) return base + 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/20 dark:bg-amber-950/50 dark:border-amber-500';
      return base + 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-400/20 dark:bg-rose-950/40 dark:border-rose-500/80';
    }

    function getLocationMapsIconClasses(day) {
      const base = 'mr-2 shrink-0 transition no-print ';
      if (!(day?.location || '').trim()) return base + 'text-rose-400 dark:text-rose-500 cursor-not-allowed';
      return base + (isDayLodgingSettled(day) ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 cursor-pointer' : 'text-amber-600 dark:text-amber-400 hover:text-amber-800 cursor-pointer');
    }

    window.addEventListener('DOMContentLoaded', async () => {
      try {
        initTheme(); initFontScale(); updateNetworkBadge();
        window.addEventListener('online', () => { updateNetworkBadge(); checkOfflineReadiness(); });
        window.addEventListener('offline', () => { updateNetworkBadge(); checkOfflineReadiness(); });
        initBackupReminderState();
        await loadFromStorage();
        await checkStorageCapacity(true);
        if ('serviceWorker' in navigator && location.protocol !== 'file:') {
          navigator.serviceWorker.addEventListener('controllerchange', checkOfflineReadiness);
          navigator.serviceWorker.register('sw.js').then(r => r.update()).then(() => navigator.serviceWorker.ready).then(checkOfflineReadiness).catch(() => updateOfflineAssetsStatus('Offline-Paket nicht verfügbar', false));
        } else updateOfflineAssetsStatus('Offline-Paket nicht verfügbar', false);
        initPersistentStorage();
        setupKeyboardShortcuts(); setupLightboxSwipeGestures(); setupLifecycleSaveFlush(); setupEventDelegation();
        checkBackupReminder();
      } catch (e) { console.error("Init Error:", e); }
    });

    window.addEventListener('resize', autoResizeAllTextareas);

    function setupKeyboardShortcuts() {
      window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); return saveToFile(false); }
        const editingText = e.target?.matches?.('input:not([type="checkbox"]):not([type="button"]), textarea, [contenteditable="true"]');
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !editingText) { e.preventDefault(); return undoLastChange(); }
        const appDlg = document.getElementById('appDialogModal');
        if (appDlg && !appDlg.classList.contains('hidden')) { if (e.key === 'Escape') { e.preventDefault(); resolveAppDialog(false); } return; }
        const lb = document.getElementById('lightboxModal');
        if (lb && !lb.classList.contains('hidden')) {
          if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateLightbox(-1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); navigateLightbox(1); }
        }
      });
    }

    const FONT_SCALE_KEY = 'reiseplaner_pro_font_scale';
    const FONT_SCALES = [90, 100, 112, 125];
    function setFontScale(value) {
      const scale = FONT_SCALES.includes(Number(value)) ? Number(value) : 100;
      document.documentElement.style.fontSize = `${scale}%`;
      const label = document.getElementById('fontScaleLabel');
      if (label) label.textContent = `${scale}%`;
      writeLocalSetting(FONT_SCALE_KEY, String(scale));
    }
    function initFontScale() { setFontScale(Number(readLocalSetting(FONT_SCALE_KEY, '100'))); }
    function cycleFontScale() {
      const current = Number(readLocalSetting(FONT_SCALE_KEY, '100'));
      setFontScale(FONT_SCALES[(FONT_SCALES.indexOf(current) + 1) % FONT_SCALES.length]);
    }

    function setupLightboxSwipeGestures() {
      const area = document.getElementById('lightboxTouchArea');
      if (!area) return;
      area.addEventListener('touchstart', e => { if (e.changedTouches?.[0]) { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; } }, { passive: true });
      area.addEventListener('touchend', e => {
        if (!e.changedTouches?.[0]) return;
        const dx = e.changedTouches[0].screenX - touchStartX, dy = e.changedTouches[0].screenY - touchStartY;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) navigateLightbox(dx < 0 ? 1 : -1);
      }, { passive: true });
    }

    function flushPendingSave() {
      if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; return persistTripData(); }
      return Promise.resolve(true);
    }

    function setupLifecycleSaveFlush() {
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPendingSave(); });
      window.addEventListener('pagehide', flushPendingSave);
    }

    function updateNetworkBadge() {
      const dot = document.getElementById('networkDot'), text = document.getElementById('networkText'), badge = document.getElementById('networkBadge');
      if (!dot || !text || !badge) return;
      const on = navigator.onLine;
      badge.className = `hidden sm:inline-flex text-[10px] font-normal px-2 py-0.5 rounded-full items-center gap-1 ${on ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800' : 'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`;
      dot.className = `w-1.5 h-1.5 rounded-full ${on ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`;
      text.innerText = on ? "Online" : "Offline bereit";
    }

    function updateOfflineAssetsStatus(label, ready) {
      const badge = document.getElementById('offlineAssetsBadge');
      if (!badge) return;
      badge.className = `hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] shrink-0 ${ready ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70' : 'text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70'}`;
      badge.innerHTML = `<i class="fa-solid ${ready ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i><span>${escapeHtml(label)}</span>`;
      badge.title = ready ? 'App-Oberfläche und benötigte Bibliotheken sind offline zwischengespeichert.' : 'Die App-Oberfläche oder benötigte Bibliotheken sind nicht vollständig offline zwischengespeichert.';
    }

    async function checkOfflineReadiness() {
      if (!('serviceWorker' in navigator) || location.protocol === 'file:') {
        updateOfflineAssetsStatus('Offline-Paket nicht verfügbar', false); return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const worker = navigator.serviceWorker.controller || registration.active;
        if (!worker) { updateOfflineAssetsStatus('Offline-Paket wird eingerichtet', false); return; }
        const channel = new MessageChannel();
        const timeout = setTimeout(() => updateOfflineAssetsStatus('Offline-Status unbekannt', false), 5000);
        channel.port1.onmessage = event => {
          clearTimeout(timeout);
          const missing = Number(event.data?.missing || 0);
          updateOfflineAssetsStatus(missing ? `Offline unvollständig (${missing})` : 'Offline bereit', missing === 0);
          channel.port1.close();
        };
        worker.postMessage({ type: 'CHECK_OFFLINE_ASSETS' }, [channel.port2]);
      } catch (e) { updateOfflineAssetsStatus('Offline-Status unbekannt', false); }
    }

    function initBackupReminderState() {
      const stored = readLocalSetting(LAST_EXPORT_KEY);
      lastExportTimestamp = stored ? parseInt(stored, 10) : 0;
      unsavedChangesCount = parseInt(readLocalSetting(CHANGES_COUNT_KEY, '0'), 10) || 0;
    }

    function recordChangeForReminder() {
      unsavedChangesCount++;
      writeLocalSetting(CHANGES_COUNT_KEY, String(unsavedChangesCount));
      checkBackupReminder();
    }

    function resetBackupReminder() {
      unsavedChangesCount = 0; lastExportTimestamp = Date.now();
      writeLocalSetting(CHANGES_COUNT_KEY, '0');
      writeLocalSetting(LAST_EXPORT_KEY, String(lastExportTimestamp));
      dismissBackupReminder();
    }

    function checkBackupReminder() {
      const b = document.getElementById('backupReminderBanner'), c = document.getElementById('backupReminderCounter');
      if (!b) return;
      const overWeek = (Date.now() - lastExportTimestamp) > 7 * 86400000, overTen = unsavedChangesCount >= 10;
      if (overTen || (overWeek && unsavedChangesCount > 0)) {
        if (c) c.innerText = overTen ? `${unsavedChangesCount} Änderungen` : (!lastExportTimestamp ? 'Noch kein Backup exportiert' : `Seit 7 Tagen kein Export`);
        b.classList.remove('hidden');
      }
    }

    const dismissBackupReminder = () => document.getElementById('backupReminderBanner')?.classList.add('hidden');

    function parseISOParts(iso) {
      if (!iso || typeof iso !== 'string') return null;
      const [y, m, d] = iso.split('-').map(Number);
      return (!y || !m || !d) ? null : { y, m, d };
    }

    function isValidISODate(iso) {
      if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
      const p = parseISOParts(iso);
      if (!p) return false;
      const date = new Date(0);
      date.setUTCHours(12, 0, 0, 0);
      date.setUTCFullYear(p.y, p.m - 1, p.d);
      return date.toISOString().slice(0, 10) === iso;
    }

    function isValidISODateTimeLocal(value) {
      if (isValidISODate(value)) return true;
      if (typeof value !== 'string') return false;
      const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/);
      return Boolean(match && isValidISODate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 && Number(match[4] || 0) < 60);
    }

    function toDateTimeLocalValue(value) {
      if (typeof value !== 'string' || !value.trim()) return '';
      const text = value.trim();
      if (isValidISODate(text)) return `${text}T23:59`;
      const match = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      return match && isValidISODateTimeLocal(match[1]) ? match[1] : '';
    }

    function normalizeImportedOptionalDate(value) {
      if (value === null || value === undefined || value === '') return '';
      if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          const iso = date.toISOString().slice(0, 10);
          if (isValidISODate(iso)) return iso;
        }
        return null;
      }
      const text = String(value).trim();
      // datetime-local-Stornofristen aus JSON mit Uhrzeit vollständig erhalten.
      const localDateTime = text.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/);
      if (localDateTime && isValidISODateTimeLocal(localDateTime[1])) return toDateTimeLocalValue(localDateTime[1]);
      // Zeitstempel mit Zeitzone in lokale Eingabezeit umwandeln.
      if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
        const instant = new Date(text);
        if (!Number.isNaN(instant.getTime())) {
          const local = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}T${String(instant.getHours()).padStart(2, '0')}:${String(instant.getMinutes()).padStart(2, '0')}`;
          if (isValidISODateTimeLocal(local)) return local;
        }
      }
      const isoPrefix = text.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/);
      if (isoPrefix && isValidISODate(isoPrefix[1])) return isoPrefix[1];
      const dmy = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
      if (dmy) {
        const [, first, second, year] = dmy;
        const day = Number(first), month = Number(second);
        const de = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (isValidISODate(de)) return de;
        const us = `${year}-${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}`;
        if (day <= 12 && isValidISODate(us)) return us;
      }
      return null;
    }

    function addDaysISO(iso, num) {
      const p = parseISOParts(iso);
      return p ? new Date(Date.UTC(p.y, p.m - 1, p.d + num, 12, 0, 0)).toISOString().split('T')[0] : '';
    }

    function formatISODate(iso) {
      const p = parseISOParts(iso);
      if (!p) return { dayName: '', dayFormatted: '' };
      const d = new Date(Date.UTC(p.y, p.m - 1, p.d, 12, 0, 0));
      return {
        dayName: d.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'UTC' }),
        dayFormatted: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
      };
    }

    function getTodayIso() {
      const n = new Date();
      return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
    }

    const initTheme = () => setTheme(readLocalSetting(THEME_KEY) === 'light' ? 'light' : 'dark');

    function setTheme(t) {
      const isL = t === 'light';
      document.documentElement.classList.toggle('dark', !isL);
      writeLocalSetting(THEME_KEY, isL ? 'light' : 'dark');
      const icon = document.getElementById('themeToggleIcon');
      if (icon) icon.className = isL ? 'fa-solid fa-moon text-indigo-600' : 'fa-solid fa-sun text-amber-300';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isL ? '#f8fafc' : '#0f172a');
    }

    const toggleTheme = () => setTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');

    async function initPersistentStorage() {
      const badge = document.getElementById('storageBadge');
      if (navigator.storage?.persist) {
        try { renderStorageBadge(await navigator.storage.persisted() || await navigator.storage.persist()); }
        catch (e) { renderStorageBadge(false); }
      } else if (badge) {
        badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Standard-Speicher';
      }
    }

    function renderStorageBadge(prot) {
      const b = document.getElementById('storageBadge');
      if (!b) return;
      b.className = `text-[10px] font-normal px-2 py-0.5 rounded-full flex items-center gap-1.5 ${prot ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800' : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'}`;
      b.innerHTML = prot ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Dauerhaft geschützt' : '<span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Temporärer Speicher';
    }

    function updateFileStatus(name) {
      const el = document.getElementById('fileStatusText');
      if (!el) return;
      el.className = name ? "hidden md:inline-flex text-[10px] text-emerald-600 dark:text-emerald-400 items-center gap-1 truncate" : "hidden md:inline-flex text-[10px] text-slate-400 dark:text-slate-500 truncate";
      el.innerHTML = name ? `• <i class="fa-solid fa-file-circle-check"></i> <b>${escapeHtml(name)}</b>` : "• IndexedDB aktiv";
    }

    function showToast(msg, isErr) {
      const t = document.getElementById('toast'), tm = document.getElementById('toastMsg'), ti = document.getElementById('toastIcon');
      if (!t || !tm) return;
      tm.innerText = msg;
      ti.className = isErr ? "fa-solid fa-triangle-exclamation text-rose-500 text-sm" : "fa-solid fa-check text-emerald-500 text-sm";
      t.classList.remove('opacity-0', 'pointer-events-none');
      setTimeout(() => t.classList.add('opacity-0', 'pointer-events-none'), 2500);
    }
