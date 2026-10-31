const DEFAULT_CHECKLIST = [
      "Reisepass (Gültigkeit prüfen, min. 6 Monate)",
      "E-Visum beantragt & ausgedruckt",
      "Auslandskrankenversicherung & Notfallnummer",
      "Kreditkarten für gebührenfreie Abhebungen (2x)",
      "eSIM oder lokale SIM-Karte vorbereitet",
      "Reiseadapter (Typ C/G für SE-Asien)",
      "Reiseapotheke & Mückenschutz (DEET)"
    ];

    const createEmptyDay = (date, isCollapsed = true) => ({
      date, location: '', isCollapsed, noLodgingNeeded: false, transports: [], activities: [], images: [], notes: ''
    });

    let tripData = {
      title: "", startDate: "", endDate: "", generalNotes: "", emergencyNotes: "",
      checklist: DEFAULT_CHECKLIST.map(t => ({ text: t, done: false })),
      lodgings: [],
      days: []
    };

    let activeFileHandle = null, currentTab = 'plan', currentFilter = 'all', searchQuery = '';
    let saveDebounceTimer = null, pendingModalAction = null, pendingMoveItem = null, prePrintCollapsedStates = null;
    let currentLightboxList = [], currentLightboxIndex = 0, touchStartX = 0, touchStartY = 0;
    let unsavedChangesCount = 0, lastExportTimestamp = Date.now();
    let saveStatusState = 'ready', saveFailureNotified = false, storageQuotaWarning = false, storageQuotaWarned = false, lastStorageEstimateAt = 0;
    let activeDialogResolver = null, activeDialogType = 'confirm';

    const THEME_KEY = 'reiseplaner_pro_theme', LAST_EXPORT_KEY = 'reiseplaner_pro_last_export_time', CHANGES_COUNT_KEY = 'reiseplaner_pro_unsaved_changes';
    const DB_NAME = 'ReiseplanerPro_DB_v2', DB_VERSION = 1, TRIPS_STORE = 'trips_store', MEDIA_STORE = 'media_store';
    const activeMediaObjectUrls = new Map();
    let dbInstancePromise = null;

    function readLocalSetting(key, fallback = null) {
      try { return localStorage.getItem(key) ?? fallback; }
      catch (e) { console.warn('Lokaler Einstellungsspeicher nicht verfügbar:', e); return fallback; }
    }

    function writeLocalSetting(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (e) { console.warn('Lokaler Einstellungsspeicher nicht verfügbar:', e); return false; }
    }

    function updateSaveStatus(state) {
      saveStatusState = state;
      const badge = document.getElementById('saveStatusBadge'), icon = document.getElementById('saveStatusIcon'), text = document.getElementById('saveStatusText');
      if (!badge || !icon || !text) return;
      if (state !== 'error' && storageQuotaWarning) state = 'quota';
      const styles = {
        ready: ['Bereit', 'fa-circle-check', 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700'],
        saving: ['Speichert…', 'fa-spinner fa-spin', 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/70'],
        saved: ['Gespeichert', 'fa-circle-check', 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70'],
        fileSaved: ['Datei gesichert', 'fa-file-circle-check', 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/70'],
        error: ['Speichern fehlgeschlagen', 'fa-triangle-exclamation', 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70'],
        quota: ['Speicher fast voll', 'fa-hard-drive', 'text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70']
      };
      const [label, iconClass, classes] = styles[state] || styles.ready;
      text.innerText = label;
      icon.className = 'fa-solid ' + iconClass;
      badge.className = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] shrink-0 ' + classes;
      badge.title = state === 'error' ? 'Lokales Speichern fehlgeschlagen. Erstelle sofort ein JSON-Backup.' : state === 'quota' ? 'Der verfügbare Gerätespeicher ist fast voll. Erstelle ein JSON-Backup und entferne nicht benötigte Belege.' : label;
    }

    async function checkStorageCapacity(force = false) {
      if (!navigator.storage?.estimate) return;
      const now = Date.now();
      if (!force && now - lastStorageEstimateAt < 60000) return;
      lastStorageEstimateAt = now;
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate();
        const ratio = quota > 0 ? usage / quota : 0;
        const wasWarning = storageQuotaWarning;
        storageQuotaWarning = ratio >= 0.85;
        if (ratio < 0.80) storageQuotaWarned = false;
        if (storageQuotaWarning && !storageQuotaWarned) {
          storageQuotaWarned = true;
          showToast(`Gerätespeicher zu ${Math.round(ratio * 100)} % belegt. Bitte Reise-Backup sichern.`, true);
        }
        if (wasWarning !== storageQuotaWarning || storageQuotaWarning) updateSaveStatus(saveStatusState);
      } catch (e) { console.warn('Speicherbelegung konnte nicht geprüft werden:', e); }
    }

    const toggleModal = (id, show) => {
      const m = document.getElementById(id);
      if (m) { m.classList.toggle('hidden', !show); m.classList.toggle('flex', show); }
    };
