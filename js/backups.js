// --- ROLLIERENDE BACKUPS ---
    async function createRollingBackup() {
      try {
        let backups = (await tripsGet('backups')) || [];
        const snap = JSON.stringify(tripData);
        if (backups[0] && JSON.stringify(backups[0].data) === snap) return;
        const now = new Date();
        backups.unshift({
          timestamp: `${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} um ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`,
          title: tripData.title || 'Unbenannt', daysCount: (tripData.days || []).length, data: JSON.parse(snap)
        });
        const dropped = backups.splice(3);
        await tripsSet('backups', backups);
        const retainedMediaIds = collectMediaIdsFromTrips([tripData, ...backups.map(b => b?.data)]);
        const droppedMediaIds = collectMediaIdsFromTrips(dropped.map(b => b?.data));
        for (const id of droppedMediaIds) if (!retainedMediaIds.has(id)) await safeDeleteMedia(id);
      } catch {}
    }

    async function showRestoreModal() {
      const list = document.getElementById('backupList');
      if (!list) return;
      const backups = (await tripsGet('backups')) || [];
      list.innerHTML = !backups.length ? '<p class="text-xs text-slate-500 italic p-3 text-center">Keine Sicherungsstände vorhanden.</p>' : backups.map((b, idx) => `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 text-xs">
          <div>
            <div class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5"><i class="fa-solid fa-clock-rotate-left text-indigo-500"></i> Stand ${idx + 1}: ${escapeHtml(b.timestamp)}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(b.title)} (${b.daysCount} Tage)</div>
          </div>
          <button onclick="restoreBackup(${idx})" class="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shrink-0 shadow">Laden</button>
        </div>`).join('');
      toggleModal('restoreModal', true);
    }

    const closeRestoreModal = () => toggleModal('restoreModal', false);

    async function restoreBackup(idx) {
      const backups = (await tripsGet('backups')) || [];
      if (!backups[idx]?.data || !await showAppConfirm(`Sicherungsstand vom ${backups[idx].timestamp} laden?`, { title: "Laden", variant: "amber", icon: "fa-rotate-left" })) return;
      tripData = JSON.parse(JSON.stringify(backups[idx].data));
      await migrateImagesToMediaStore(tripData.days);
      normalizeDataModel(); recordChangeForReminder(); saveToStorage(); syncUI(); closeRestoreModal();
      showToast("Stand geladen");
    }

    function normalizeDataModel() {
      tripData = tripData || {};
      tripData.checklist = tripData.checklist || DEFAULT_CHECKLIST.map(t => ({ text: t, done: false }));
      tripData.lodgings = tripData.lodgings || [];
      tripData.days = tripData.days || [];

      if (tripData.lodgings.length === 0 && tripData.days.some(d => d.lodging && (d.lodging.name || d.lodging.price))) {
        let currentGroup = null;
        tripData.days.forEach(day => {
          const l = day.lodging;
          if (l && l.costStatus !== 'keine' && (l.name || l.price)) {
            if (currentGroup && currentGroup.name === l.name && currentGroup.location === (day.location || '')) {
              currentGroup.checkOut = addDaysISO(day.date, 1);
              if (parseFlexibleNumber(l.price) > 0 && !currentGroup.totalPrice) currentGroup.totalPrice = l.price;
            } else {
              if (currentGroup) tripData.lodgings.push(currentGroup);
              currentGroup = {
                id: generateUUID(), name: l.name || 'Hotel', location: day.location || '',
                checkIn: day.date, checkOut: addDaysISO(day.date, 1), status: l.costStatus || 'gebucht',
                totalPrice: l.price || '', freeCancellationUntil: '', address: l.notes || '', link: l.link || '', notes: l.hint || ''
              };
            }
          } else if (currentGroup) { tripData.lodgings.push(currentGroup); currentGroup = null; }
        });
        if (currentGroup) tripData.lodgings.push(currentGroup);
      }

      tripData.days.forEach(d => {
        d.noLodgingNeeded = Boolean(d.noLodgingNeeded || (d.lodging?.costStatus === 'keine'));
        d.images = d.images || [];
        d.transports = (d.transports || []).map(t => ({ title: t.title || '', category: t.category || '', cost: t.cost || '', costStatus: t.costStatus || 'geplant', hint: t.hint || '', link: t.link || '' }));
        d.activities = (d.activities || []).map(a => ({ title: a.title || '', cost: a.cost || '', costStatus: a.costStatus || 'geplant', hint: a.hint || '', link: a.link || '', done: Boolean(a.done) }));
      });
    }

    async function persistTripData() {
      updateSaveStatus('saving');
      const nextSnapshot = JSON.stringify(tripData);
      if (!undoInProgress && lastPersistedTripSnapshot && lastPersistedTripSnapshot !== nextSnapshot) {
        undoHistory.push(lastPersistedTripSnapshot);
        if (undoHistory.length > 20) undoHistory.shift();
        updateUndoControl();
      }
      const saved = await tripsSet('trip_data', tripData);
      if (!saved) {
        updateSaveStatus('error');
        if (!saveFailureNotified) {
          saveFailureNotified = true;
          showToast('Lokales Speichern fehlgeschlagen – bitte sofort JSON-Backup erstellen.', true);
        }
        return false;
      }
      saveFailureNotified = false;
      lastPersistedTripSnapshot = nextSnapshot;
      updateSaveStatus('saved');
      updateStats(); updateHeadline();
      checkStorageCapacity();
      return true;
    }

    function saveToStorage() {
      clearTimeout(saveDebounceTimer);
      updateSaveStatus('saving');
      saveDebounceTimer = setTimeout(async () => {
        saveDebounceTimer = null;
        await persistTripData();
      }, 250);
    }

    async function loadFromStorage() {
      let saved = await tripsGet('trip_data');
      if (!saved) { try { saved = JSON.parse(localStorage.getItem('reiseplaner_pro_pwa_data')); } catch {} }
      if (saved) { tripData = saved; await migrateImagesToMediaStore(tripData.days); }
      normalizeDataModel();
      const persisted = saved ? await tripsSet('trip_data', tripData) : true;
      lastPersistedTripSnapshot = JSON.stringify(tripData);
      syncUI(); updateFileStatus(null); updateSaveStatus(saved ? (persisted ? 'saved' : 'error') : 'ready'); updateUndoControl();
    }

    let undoHistory = [], lastPersistedTripSnapshot = null, undoInProgress = false;
    function updateUndoControl() {
      const button = document.getElementById('undoLastChangeBtn');
      const label = document.getElementById('undoCountLabel');
      if (button) { button.disabled = undoHistory.length === 0; button.classList.toggle('opacity-50', undoHistory.length === 0); }
      if (label) label.textContent = String(undoHistory.length);
    }
    async function undoLastChange() {
      if (!undoHistory.length) return showToast('In dieser Sitzung gibt es keine Änderung zum Rückgängigmachen.', true);
      await flushPendingSave();
      const previous = undoHistory.pop();
      await createRollingBackup();
      try {
        tripData = JSON.parse(previous);
        await migrateImagesToMediaStore(tripData.days);
        normalizeDataModel(); syncUI();
        undoInProgress = true;
        const saved = await persistTripData();
        undoInProgress = false;
        updateUndoControl();
        if (saved) showToast('Letzte Änderung rückgängig gemacht');
        else { undoHistory.push(previous); updateUndoControl(); }
      } catch (error) {
        undoInProgress = false;
        undoHistory.push(previous);
        updateUndoControl();
        showToast('Änderung konnte nicht rückgängig gemacht werden.', true);
        console.error('[Undo]', error);
      }
    }

    async function saveToFile(forceSaveAs) {
      await flushPendingSave(); await createRollingBackup();
      const locallySaved = await tripsSet('trip_data', tripData);
      if (locallySaved) lastPersistedTripSnapshot = JSON.stringify(tripData);
      if (!locallySaved) updateSaveStatus('error');
      const json = JSON.stringify(await buildExportPayload(), null, 2);
      const name = `Reiseplan_${(tripData.title || '').trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_') || 'Planer'}.json`;

      if ('showSaveFilePicker' in window) {
        try {
          if (!activeFileHandle || forceSaveAs) activeFileHandle = await window.showSaveFilePicker({ suggestedName: name, types: [{ accept: { 'application/json': ['.json'] } }] });
          const wr = await activeFileHandle.createWritable();
          await wr.write(json); await wr.close();
          updateFileStatus(activeFileHandle.name); resetBackupReminder();
          if (locallySaved) updateSaveStatus('fileSaved');
          return showToast('Gespeichert in: ' + activeFileHandle.name);
        } catch (err) { if (err.name === 'AbortError') return; }
      }

      downloadJsonFile(json, name); resetBackupReminder();
      if (locallySaved) updateSaveStatus('fileSaved');
      showToast("Download abgeschlossen");
    }

    // Download als Datei (URL erst verzögert freigeben – sonst bricht der Download auf Android teils ab)
    function downloadJsonFile(json, name) {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    }

    // Datei über das System-Teilen-Menü senden (z. B. Android -> OneDrive / an den PC); Fallback: Download
    async function shareTripFile() {
      await flushPendingSave(); await createRollingBackup();
      const locallySaved = await tripsSet('trip_data', tripData);
      if (!locallySaved) updateSaveStatus('error');
      const json = JSON.stringify(await buildExportPayload(), null, 2);
      const base = (tripData.title || '').trim().replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_') || 'Planer';
      const d = new Date(), p = (n) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
      const name = `Reiseplan_${base}_Handy_${stamp}.json`;

      // Manche Browser erlauben "application/json" nicht beim Teilen -> zusätzlich als text/plain versuchen
      const candidates = [new File([json], name, { type: 'application/json' }), new File([json], name, { type: 'text/plain' })];
      const file = (navigator.share && navigator.canShare) ? candidates.find(f => { try { return navigator.canShare({ files: [f] }); } catch { return false; } }) : null;
      if (!file) {
        downloadJsonFile(json, name); resetBackupReminder(); if (locallySaved) updateSaveStatus('fileSaved');
        return showToast("Teilen nicht verfügbar – Datei wurde heruntergeladen");
      }

      const doShare = () => navigator.share({ files: [file], title: name });
      try {
        await doShare(); resetBackupReminder(); if (locallySaved) updateSaveStatus('fileSaved'); showToast("Datei geteilt");
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (err?.name === 'NotAllowedError') {
          // Die Berührung ist beim Erstellen der Datei "abgelaufen" -> erneut per Tipp bestätigen lassen
          if (!await showAppConfirm(`Die Datei „${name}“ ist bereit. Jetzt teilen?`, { title: 'Teilen', confirmText: 'Teilen', icon: 'fa-share-nodes' })) return;
          try { await doShare(); resetBackupReminder(); showToast("Datei geteilt"); return; }
          catch (e2) { if (e2?.name === 'AbortError') return; }
        }
        downloadJsonFile(json, name); resetBackupReminder();
        showToast("Teilen fehlgeschlagen – Datei wurde heruntergeladen", true);
      }
    }

    function getImportValidationError(parsed) {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'Die Datei enthält kein gültiges Reiseobjekt.';
      if (!Array.isArray(parsed.days)) return 'Die Reisedaten enthalten keine gültige Tagesliste.';
      if (parsed.startDate && !isValidISODate(parsed.startDate)) return 'Das Startdatum der Reise ist ungültig.';
      if (parsed.endDate && !isValidISODate(parsed.endDate)) return 'Das Enddatum der Reise ist ungültig.';
      if (parsed.startDate && parsed.endDate && parsed.startDate > parsed.endDate) return 'Das Startdatum liegt nach dem Enddatum.';
      for (const key of ['lodgings', 'checklist']) {
        if (parsed[key] !== undefined && !Array.isArray(parsed[key])) return 'Die Liste „' + key + '“ hat ein ungültiges Format.';
      }
      const seenDates = new Set();
      for (let i = 0; i < parsed.days.length; i++) {
        const day = parsed.days[i];
        if (!day || typeof day !== 'object' || Array.isArray(day)) return 'Tag ' + (i + 1) + ' hat ein ungültiges Format.';
        if (!isValidISODate(day.date)) return 'Tag ' + (i + 1) + ' hat kein gültiges Datum.';
        if (seenDates.has(day.date)) return 'Das Datum ' + day.date + ' ist in der Tagesliste doppelt vorhanden.';
        seenDates.add(day.date);
        for (const key of ['images', 'transports', 'activities']) {
          if (day[key] !== undefined && !Array.isArray(day[key])) return 'Die Liste „' + key + '“ in Tag ' + (i + 1) + ' hat ein ungültiges Format.';
          if (Array.isArray(day[key])) {
            const invalidItem = day[key].some(item => {
              if (key === 'images') return !item || (typeof item !== 'string' && (typeof item !== 'object' || Array.isArray(item)));
              return !item || typeof item !== 'object' || Array.isArray(item);
            });
            if (invalidItem) return 'Ein Eintrag in „' + key + '“ von Tag ' + (i + 1) + ' hat ein ungültiges Format.';
            if (key !== 'images') {
              const invalidCost = day[key].some(item => item.cost !== undefined && !isValidAmountInput(item.cost));
              if (invalidCost) return 'Tag ' + (i + 1) + ' enthält einen ungültigen oder negativen Betrag.';
            }
          }
        }
      }
      for (let i = 0; i < (parsed.lodgings || []).length; i++) {
        const lodging = parsed.lodgings[i];
        if (!lodging || typeof lodging !== 'object' || Array.isArray(lodging) || !isValidISODate(lodging.checkIn) || !isValidISODate(lodging.checkOut) || lodging.checkIn >= lodging.checkOut) return 'Unterkunft ' + (i + 1) + ' hat ungültige Daten.';
        if (lodging.totalPrice !== undefined && !isValidAmountInput(lodging.totalPrice)) return 'Unterkunft ' + (i + 1) + ' enthält einen ungültigen oder negativen Betrag.';
        for (let j = 0; j < i; j++) {
          const other = parsed.lodgings[j];
          if (lodging.checkIn < other.checkOut && other.checkIn < lodging.checkOut) return 'Die Zeiträume der Unterkünfte „' + (other.name || (j + 1)) + '“ und „' + (lodging.name || (i + 1)) + '“ überschneiden sich.';
        }
      }
      return '';
    }

    async function applyImportedTrip(parsed, name, handle = null) {
      const validationError = getImportValidationError(parsed);
      if (validationError) return showAppAlert(validationError, 'Datei kann nicht geladen werden', 'danger');
      let preservedCancellationNotes = 0;
      for (const lodging of parsed.lodgings || []) {
        const raw = lodging.freeCancellationUntil;
        const normalized = normalizeImportedOptionalDate(raw);
        if (normalized === null) {
          const rawText = typeof raw === 'string' ? raw : JSON.stringify(raw);
          lodging.notes = [lodging.notes, `Alte Stornierungsangabe (nicht als Datum erkannt): ${rawText}`].filter(Boolean).join('\n');
          lodging.freeCancellationUntil = '';
          preservedCancellationNotes++;
        } else lodging.freeCancellationUntil = normalized;
      }
      await createRollingBackup();
      activeFileHandle = handle; tripData = parsed;
      await migrateImagesToMediaStore(tripData.days);
      normalizeDataModel(); await createRollingBackup(); resetBackupReminder(); saveToStorage();
      syncUI(); updateHeadline(); updateFileStatus(name);
      showToast(preservedCancellationNotes
        ? `Datei geladen; ${preservedCancellationNotes} alte Stornierungsangabe(n) in Unterkunftsnotizen gesichert.`
        : (handle ? 'Datei geöffnet' : 'Datei geladen'));
    }

    async function openFile() {
      if ('showOpenFilePicker' in window) {
        try {
          const [h] = await window.showOpenFilePicker({ types: [{ accept: { 'application/json': ['.json'] } }], multiple: false });
          const f = await h.getFile();
          await applyImportedTrip(JSON.parse(await f.text()), h.name, h);
          return;
        } catch (err) { if (err.name === 'AbortError') return; }
      }
      document.getElementById('importInput').click();
    }

    function importJSONFallback(e) {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async ev => { try { await applyImportedTrip(JSON.parse(ev.target.result), f.name); } catch { showToast("Lesefehler", true); } };
      r.readAsText(f); e.target.value = '';
    }

    function syncUI() {
      document.getElementById('tripTitle').value = tripData.title || '';
      document.getElementById('startDate').value = tripData.startDate || '';
      document.getElementById('endDate').value = tripData.endDate || '';
      document.getElementById('generalNotes').value = tripData.generalNotes || '';
      const em = document.getElementById('emergencyNotesInput'); if (em) em.value = tripData.emergencyNotes || '';
      document.getElementById('tripConfigSection')?.classList.toggle('hidden', Boolean(tripData.days?.length));
      updateHeadline(); renderChecklist(); renderAllAttachmentsOverview(); renderLodgingsTab(); renderDays();
    }

    function saveMetaData() { tripData.title = document.getElementById('tripTitle').value; recordChangeForReminder(); saveToStorage(); updateHeadline(); }
    function saveGeneralNotes(v) { tripData.generalNotes = v; recordChangeForReminder(); saveToStorage(); }

    async function generateOrUpdateDays() {
      const s = document.getElementById('startDate').value, e = document.getElementById('endDate').value;
      if (!s || !e) return showAppAlert("Start- und Enddatum erforderlich.", "Zeitraum unvollständig");
      if (!isValidISODate(s) || !isValidISODate(e)) return showAppAlert("Bitte gültige Start- und Enddaten wählen.", "Ungültiges Datum", "danger");
      const pS = parseISOParts(s), pE = parseISOParts(e);
      if (!pS || !pE || Date.UTC(pS.y, pS.m - 1, pS.d) > Date.UTC(pE.y, pE.m - 1, pE.d)) return showAppAlert("Startdatum muss vor Enddatum liegen.", "Ungültiger Zeitraum", "danger");

      normalizeDataModel();
      const count = Math.floor((Date.UTC(pE.y, pE.m - 1, pE.d) - Date.UTC(pS.y, pS.m - 1, pS.d)) / 86400000) + 1;
      const hasDays = tripData.days.length > 0, oldS = tripData.days[0]?.date || tripData.startDate;
      await createRollingBackup();

      let shift = false;
      if (hasDays && oldS && oldS !== s) {
        shift = await showAppConfirm(`Startdatum geändert (${formatISODate(oldS).dayFormatted} → ${formatISODate(s).dayFormatted}). Route mitverschieben?`, { title: "Startdatum geändert", confirmText: "Route verschieben", cancelText: "Kalender behalten" });
      }

      if (shift && tripData.days.some(hasFixedLodging)) {
        return showAppAlert('Die Route kann nicht verschoben werden, weil mindestens ein Tag eine gebuchte, bezahlte oder reservierte Unterkunft hat. Wähle „Kalender behalten“ oder breche ab.', 'Unterkunft schützt Reisetag', 'danger');
      }
      const newDays = [];

      if (hasDays && shift) {
        for (let i = 0; i < count; i++) {
          const iso = addDaysISO(s, i);
          newDays.push(i < tripData.days.length ? Object.assign(tripData.days[i], { date: iso }) : createEmptyDay(iso, true));
        }
      } else {
        const map = new Map(tripData.days.filter(d => d?.date).map(d => [d.date, d]));
        for (let i = 0; i < count; i++) { const iso = addDaysISO(s, i); newDays.push(map.get(iso) || createEmptyDay(iso, true)); }
      }

      const retainedDays = new Set(newDays);
      if (tripData.days.some(d => hasFixedLodging(d) && !retainedDays.has(d))) {
        return showAppAlert('Der neue Zeitraum würde einen Tag mit gebuchter oder reservierter Unterkunft entfernen. Passe den Zeitraum so an, dass dieser Tag erhalten bleibt.', 'Unterkunft schützt Reisetag', 'danger');
      }
      tripData.title = document.getElementById('tripTitle').value;
      tripData.startDate = s; tripData.endDate = e; tripData.days = newDays;
      normalizeDataModel();

      recordChangeForReminder(); saveToStorage();
      document.getElementById('tripConfigSection')?.classList.add('hidden');
      updateHeadline(); renderDays(); renderLodgingsTab(); renderAllAttachmentsOverview();
      showToast("Tage generiert");
    }
