// --- BELEGE & DATEIEN ---
    function handleDayPaste(e, dayIndex) {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.includes('image') || item.type === 'application/pdf') {
          e.preventDefault(); const file = item.getAsFile();
          if (file) processAndAddAttachment(file, dayIndex); return;
        }
      }
    }

    const handleDayDragOver = (e, idx) => { e.preventDefault(); e.stopPropagation(); document.getElementById('notes-dropzone-' + idx)?.classList.add('drop-active'); };
    const handleDayDragLeave = (e, idx) => { e.preventDefault(); e.stopPropagation(); document.getElementById('notes-dropzone-' + idx)?.classList.remove('drop-active'); };
    function handleDayDrop(e, idx) {
      e.preventDefault(); e.stopPropagation();
      document.getElementById('notes-dropzone-' + idx)?.classList.remove('drop-active');
      if (e.dataTransfer?.files?.length) Array.from(e.dataTransfer.files).forEach(f => processAndAddAttachment(f, idx));
    }

    function handleDocFileSelect(event, idx) {
      if (event.target.files?.length) Array.from(event.target.files).forEach(f => processAndAddAttachment(f, idx));
      event.target.value = '';
    }

    async function processAndAddAttachment(file, dayIdx) {
      const day = tripData.days[dayIdx];
      if (!day) return;
      if (!Array.isArray(day.images)) day.images = [];

      const save = async (blob, defName, type, okMsg) => {
        const id = generateUUID(), name = file.name || defName;
        if (await mediaStorePut(id, blob, name, type, blob.size)) {
          day.images.push({ id, name, type, size: blob.size });
          recordChangeForReminder(); saveToStorage(); updateImagesDOM(dayIdx); renderAllAttachmentsOverview();
          showToast(okMsg);
        } else showToast("Fehler beim Speichern", true);
      };

      if (file.type === 'application/pdf') {
        await save(file, 'Dokument.pdf', 'pdf', "PDF gespeichert");
      } else if (file.type.startsWith('image/')) {
        const r = new FileReader();
        r.onload = e => {
          const img = new Image();
          img.onload = () => {
            let { width: w, height: h } = img, max = 1200;
            if (w > max || h > max) { if (w > h) { h = Math.round((h * max) / w); w = max; } else { w = Math.round((w * max) / h); h = max; } }
            const cvs = Object.assign(document.createElement('canvas'), { width: w, height: h });
            cvs.getContext('2d').drawImage(img, 0, 0, w, h);
            cvs.toBlob(b => b ? save(b, 'Screenshot.jpg', 'image', "Screenshot gespeichert") : showToast("Komprimierungsfehler", true), 'image/jpeg', 0.82);
          };
          img.src = e.target.result;
        };
        r.readAsDataURL(file);
      } else showToast("Nur Bilder & PDFs erlaubt", true);
    }

    async function renameDayAttachment(dayIdx, itemIdx) {
      const item = tripData.days[dayIdx]?.images?.[itemIdx];
      if (!item) return;
      const old = item.name || (item.type === 'pdf' ? 'Dokument.pdf' : 'Screenshot.jpg');
      const input = await showAppPrompt(`Beleg an Tag ${dayIdx + 1} umbenennen:`, old, { title: "Beleg umbenennen", confirmText: "Umbenennen" });
      if (input === null) return;
      const newName = input.trim();
      if (!newName || newName === old) return;

      item.name = newName;
      if (item.id) {
        const rec = await mediaStoreGet(item.id);
        if (rec?.blob) await mediaStorePut(item.id, rec.blob, newName, item.type, item.size || rec.size);
      }
      recordChangeForReminder(); saveToStorage(); updateImagesDOM(dayIdx); renderAllAttachmentsOverview();
      const lb = currentLightboxList[currentLightboxIndex];
      if (lb && lb.id === item.id) { lb.name = newName; document.getElementById('lightboxCaption').innerText = newName; }
      showToast("Beleg umbenannt");
    }

    async function renameCurrentLightboxImage() {
      const lb = currentLightboxList[currentLightboxIndex];
      if (!lb?.id) return;
      for (let d = 0; d < (tripData.days || []).length; d++) {
        const i = (tripData.days[d]?.images || []).findIndex(img => img?.id === lb.id);
        if (i !== -1) return renameDayAttachment(d, i);
      }
    }

    async function deleteDayAttachment(dayIdx, itemIdx) {
      const images = tripData.days[dayIdx]?.images;
      if (!images?.[itemIdx]) return;
      const target = images[itemIdx];
      if (!await showAppConfirm(`Beleg „${target.name || 'Dokument'}“ wirklich löschen?`, { title: "Beleg löschen", confirmText: "Löschen", variant: "danger", icon: "fa-trash-can" })) return;

      await createRollingBackup();
      images.splice(itemIdx, 1);
      recordChangeForReminder(); saveToStorage(); updateImagesDOM(dayIdx); renderAllAttachmentsOverview();
      showToast("Beleg entfernt");
    }

    async function openPdfAttachment(id, name) {
      const url = await getMediaBlobUrl(id);
      if (!url) return showToast("PDF konnte nicht geladen werden", true);
      if (!window.open(url, '_blank')) Object.assign(document.createElement('a'), { href: url, download: name || 'Dokument.pdf' }).click();
    }

    function buildAttachmentCardHTML(item, dayIdx, itemIdx, prefix) {
      const isPdf = item.type === 'pdf', name = escapeHtml(item.name || (isPdf ? 'Dokument.pdf' : 'Screenshot.jpg')), isOv = prefix === 'overview-thumb-';
      const btns = isOv ? `
        <button onclick="event.stopPropagation(); renameDayAttachment(${dayIdx}, ${itemIdx})" class="no-print absolute top-1 left-1 w-5 h-5 bg-slate-800/85 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px]"><i class="fa-solid fa-pen"></i></button>
        <button onclick="event.stopPropagation(); deleteDayAttachment(${dayIdx}, ${itemIdx})" class="no-print absolute top-1 right-1 w-5 h-5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">&times;</button>` : `
        <button data-action="rename-attachment" data-day-index="${dayIdx}" data-item-index="${itemIdx}" class="no-print absolute top-1 left-1 w-5 h-5 bg-slate-800/85 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center text-[9px]"><i class="fa-solid fa-pen pointer-events-none"></i></button>
        <button data-action="delete-attachment" data-day-index="${dayIdx}" data-item-index="${itemIdx}" class="no-print absolute top-1 right-1 w-5 h-5 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">&times;</button>`;

      if (isPdf) {
        const oAttr = isOv ? `onclick="openPdfAttachment('${item.id}', '${name}')"` : `data-action="open-pdf" data-media-id="${item.id}" data-file-name="${name}"`;
        return `
          <div ${isOv ? oAttr : ''} class="relative group rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 p-2.5 pl-7 pr-7 flex items-center gap-2.5 max-w-[235px] shadow-sm cursor-pointer">
            <i class="fa-solid fa-file-pdf text-xl text-rose-600 shrink-0"></i>
            <div class="overflow-hidden flex-1" ${!isOv ? oAttr : ''}>
              <span class="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">${name}</span>
              <span class="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Öffnen <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i></span>
            </div>${btns}
          </div>`;
      }

      const imgAttr = isOv ? `onclick="openLightbox('${item.id}', ${dayIdx})"` : `data-action="open-lightbox" data-day-index="${dayIdx}" data-media-id="${item.id}"`;
      return `
        <div ${isOv ? imgAttr : ''} class="relative group cursor-pointer rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-slate-900 shadow-sm w-24 h-20 flex items-center justify-center">
          <img id="${prefix}${item.id}" ${!isOv ? imgAttr : ''} class="w-full h-full object-cover group-hover:scale-105 transition duration-200" src="" alt="${name}">
          <span class="pointer-events-none absolute bottom-0 inset-x-0 bg-slate-950/75 text-white text-[9px] px-1 py-0.5 truncate text-center">${name}</span>
          ${btns}
        </div>`;
    }

    async function loadThumbnailsForItems(items, prefix) {
      await Promise.all((items || []).map(async it => {
        if (it?.type !== 'pdf' && it?.id) {
          const el = document.getElementById(prefix + it.id);
          const u = el && await getMediaBlobUrl(it.id);
          if (u) el.src = u;
        }
      }));
    }

    async function updateImagesDOM(dayIdx) {
      const c = document.getElementById('images-container-' + dayIdx);
      if (!c) return;
      const items = tripData.days[dayIdx]?.images || [];
      c.classList.toggle('hidden', !items.length);
      if (!items.length) { c.innerHTML = ''; return; }
      c.innerHTML = items.map((it, idx) => buildAttachmentCardHTML(it, dayIdx, idx, 'thumb-')).join('');
      await loadThumbnailsForItems(items, 'thumb-');
    }

    async function renderAllAttachmentsOverview() {
      const container = document.getElementById('allAttachmentsOverview'), badge = document.getElementById('allAttachmentsCountBadge');
      if (!container) return;
      let total = 0; const list = [];
      (tripData.days || []).forEach((d, idx) => { if (d?.images?.length) { total += d.images.length; list.push({ day: d, idx }); } });
      if (badge) badge.innerText = `${total} ${total === 1 ? 'Beleg' : 'Belege'}`;
      if (!list.length) {
        container.innerHTML = `<div class="p-6 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500"><i class="fa-regular fa-folder-open text-2xl mb-1.5 block"></i>Noch keine Belege hinterlegt.</div>`;
        return;
      }

      container.innerHTML = list.map(({ day, idx }) => {
        const { dayName, dayFormatted } = formatISODate(day.date), l = getLodgingForDay(day.date);
        return `
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                <span class="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">Tag ${idx + 1}</span>
                <span class="font-mono text-slate-500">${dayFormatted} (${dayName})</span>
                <span>• 📍 ${escapeHtml(day.location || 'Ohne Ort')}</span>
                ${l ? `<span class="text-slate-500">• <svg class="ico-house" aria-hidden="true"><use href="#icon-house"></use></svg> ${escapeHtml(l.name)}</span>` : ''}
              </div>
              <button onclick="jumpToSpecificDay(${idx})" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-indigo-600 no-print">Zum Tag <i class="fa-solid fa-arrow-right text-[10px]"></i></button>
            </div>
            <div class="flex flex-wrap gap-2.5">${day.images.map((it, i) => buildAttachmentCardHTML(it, idx, i, 'overview-thumb-')).join('')}</div>
          </div>`;
      }).join('');

      for (const { day } of list) await loadThumbnailsForItems(day.images, 'overview-thumb-');
    }

    function jumpToSpecificDay(dayIdx) {
      weekOverviewActive = false;
      switchTab('plan');
      if (currentFilter !== 'all' || searchQuery !== '') { setFilter('all'); clearSearch(); }
      openOnlyDay(dayIdx);
      setTimeout(() => {
        const el = document.getElementById('day-card-' + dayIdx);
        if (el) {
          scrollDayCardIntoView(dayIdx);
          el.classList.add('ring-4', 'ring-indigo-400');
          setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400'), 1800);
        }
      }, 100);
    }

    // --- LIGHTBOX ---
    async function renderLightboxCurrentSlide() {
      const item = currentLightboxList[currentLightboxIndex];
      if (!item) return;
      const url = await getMediaBlobUrl(item.id);
      if (!url) return showToast("Bild nicht ladbar", true);
      document.getElementById('lightboxImg').src = url;
      document.getElementById('lightboxCaption').innerText = item.name || 'Screenshot.jpg';
      document.getElementById('lightboxCounter').innerText = `${currentLightboxIndex + 1} / ${currentLightboxList.length}`;
      const mult = currentLightboxList.length > 1;
      ['lightboxPrevBtn', 'lightboxNextBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.classList.toggle('hidden', !mult); btn.classList.toggle('flex', mult); }
      });
    }

    async function openLightbox(id, dayIdx) {
      if (!id) return;
      let imgs = (dayIdx !== undefined && tripData.days[dayIdx]?.images || []).filter(it => it && it.type !== 'pdf' && it.id);
      if (!imgs.length) (tripData.days || []).forEach(d => (d?.images || []).forEach(it => { if (it && it.type !== 'pdf' && it.id) imgs.push(it); }));
      currentLightboxList = imgs.length ? imgs : [{ id, name: 'Screenshot.jpg' }];
      const idx = currentLightboxList.findIndex(it => it.id === id);
      currentLightboxIndex = idx !== -1 ? idx : 0;
      await renderLightboxCurrentSlide();
      toggleModal('lightboxModal', true);
    }

    async function navigateLightbox(step) {
      if (currentLightboxList.length > 1) {
        currentLightboxIndex = (currentLightboxIndex + step + currentLightboxList.length) % currentLightboxList.length;
        await renderLightboxCurrentSlide();
      }
    }

    function closeLightbox() {
      toggleModal('lightboxModal', false);
      document.getElementById('lightboxImg').src = '';
      currentLightboxList = []; currentLightboxIndex = 0;
    }

    const formatSafeUrl = u => { const t = (u || '').trim(); return !t ? '' : /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//i.test(t) ? t : 'https://' + t; };

    function escapeCsvCell(value) {
      let text = String(value ?? '');
      if (/^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(text)) text = "'" + text;
      return `"${text.replace(/"/g, '""')}"`;
    }

    function exportToCSV() {
      const rows = [["Tag / Zeitraum", "Datum", "Ort", "Kategorie", "Bezeichnung / Titel", "Kosten (EUR)", "Status", "Hinweis / Link"]];
      (tripData.lodgings || []).forEach(l => rows.push([
        `Aufenthalt (${l.checkIn} bis ${l.checkOut})`, l.checkIn, l.location || '', "Unterkunft", l.name || 'Hotel',
        parseFlexibleNumber(l.totalPrice).toFixed(2).replace('.', ','), l.status || 'gebucht',
        (l.address ? 'Adresse: ' + l.address : '') + (l.freeCancellationUntil ? ' | Storno bis: ' + l.freeCancellationUntil : '')
      ]));
      (tripData.days || []).forEach((d, idx) => {
        const pushR = (cat, t, c, st, h, l) => rows.push([`Tag ${idx + 1}`, d.date || '', d.location || '', cat, t || '', parseFlexibleNumber(c).toFixed(2).replace('.', ','), st || 'geplant', (h || '') + (l ? ' | ' + l : '')]);
        (d.transports || []).forEach(tr => pushR("Transport", tr.title, tr.cost, tr.costStatus, tr.hint, tr.link));
        (d.activities || []).forEach(a => pushR("Aktivitaet", a.title, a.cost, a.costStatus, a.hint, a.link));
      });
      const csv = "\uFEFF" + rows.map(r => r.map(escapeCsvCell).join(";")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
      const st = (tripData.title || 'Reise').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, '_');
      Object.assign(document.createElement('a'), { href: url, download: `Ausgaben_${st}.csv` }).click();
      URL.revokeObjectURL(url);
      showToast("CSV heruntergeladen");
    }

    function openOnlyDay(dayIdx) {
      if (!Array.isArray(tripData.days)) return;
      const willOpen = tripData.days[dayIdx].isCollapsed;
      tripData.days.forEach((d, i) => { d.isCollapsed = i === dayIdx ? !willOpen : true; });
      saveToStorage(); renderDays();
      if (willOpen) scrollDayCardIntoView(dayIdx);
    }

    // Geöffnete Tageskarte so ausrichten, dass ihr Anfang (inkl. Datum) direkt unter dem fixierten Header steht
    function scrollDayCardIntoView(dayIdx, behavior = 'smooth') {
      requestAnimationFrame(() => {
        const card = document.getElementById('day-card-' + dayIdx);
        if (!card) return;
        const hdr = document.querySelector('header');
        const offset = (hdr ? hdr.getBoundingClientRect().bottom : 0) + 8;
        const top = card.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: Math.max(0, top), behavior });
      });
    }

    const toggleDayCollapse = (dayIdx) => openOnlyDay(dayIdx);

    function toggleAllDaysSmart() {
      if (!tripData.days?.length) return showToast("Keine Reisetage vorhanden", true);
      const anyCol = tripData.days.some(d => d?.isCollapsed);
      tripData.days.forEach(d => { if (d) d.isCollapsed = !anyCol; });
      saveToStorage(); renderDays();
      showToast(anyCol ? "Alle geöffnet" : "Alle geschlossen");
    }

    function updateToggleAllBtnState() {
      const icon = document.getElementById('toggleAllDaysIcon'), txt = document.getElementById('toggleAllDaysText');
      if (!icon || !txt) return;
      const anyCol = !tripData.days?.length || tripData.days.some(d => d?.isCollapsed);
      icon.className = `fa-solid ${anyCol ? 'fa-angles-down' : 'fa-angles-up'} text-[10px] sm:text-xs`;
      txt.innerText = anyCol ? "Alle öffnen" : "Alle schließen";
    }

    function launchMap(q, isOff, err) {
      const query = (q || '').trim();
      if (!query) return showToast(err, true);
      if (isOff) window.location.href = `geo:0,0?q=${encodeURIComponent(query)}`;
      else window.open("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(query), '_blank');
    }

    const openGoogleMaps = loc => launchMap(loc, false, "Tagesort erforderlich");
    const openOfflineMaps = loc => launchMap(loc, true, "Tagesort erforderlich");

    function openHotelMaps(idx) {
      const d = tripData.days[idx], l = getLodgingForDay(d?.date);
      launchMap([l?.name, l?.address, d?.location].filter(Boolean).join(', '), false, "Hoteldaten fehlen");
    }

    async function copyHotelInfo(idx) {
      const l = getLodgingForDay(tripData.days[idx]?.date);
      const text = [l?.name, l?.address].filter(Boolean).join(', ');
      if (!text) return showToast("Keine Hoteldaten vorhanden", true);
      try {
        await (navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject());
        showToast("In Zwischenablage kopiert");
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        showToast("In Zwischenablage kopiert");
      }
    }

    function saveEmergencyNotes(v) { tripData.emergencyNotes = v; recordChangeForReminder(); saveToStorage(); }

    function parseFlexibleNumber(v) {
      if (v === null || v === undefined || v === '') return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      let raw = String(v).trim().replace(/[^0-9.,-]/g, '');
      const negative = raw.startsWith('-');
      raw = raw.replace(/-/g, '');
      if (!raw) return 0;

      const hasDot = raw.includes('.'), hasComma = raw.includes(',');
      if (hasDot && hasComma) {
        const decimal = raw.lastIndexOf('.') > raw.lastIndexOf(',') ? '.' : ',';
        const decimalAt = raw.lastIndexOf(decimal);
        const whole = raw.slice(0, decimalAt).replace(/[.,]/g, '');
        const fraction = raw.slice(decimalAt + 1).replace(/[.,]/g, '');
        raw = (whole || '0') + (fraction ? '.' + fraction : '');
      } else if (hasDot) {
        if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, '');
        else if ((raw.match(/\./g) || []).length > 1) {
          const at = raw.lastIndexOf('.');
          raw = raw.slice(0, at).replace(/\./g, '') + '.' + raw.slice(at + 1);
        }
      } else if (hasComma) {
        if (/^\d{1,3}(?:,\d{3})+$/.test(raw)) raw = raw.replace(/,/g, '');
        else if ((raw.match(/,/g) || []).length > 1) {
          const at = raw.lastIndexOf(',');
          raw = raw.slice(0, at).replace(/,/g, '') + '.' + raw.slice(at + 1);
        } else raw = raw.replace(',', '.');
      }

      const n = Number(raw);
      return Number.isFinite(n) ? (negative ? -n : n) : 0;
    }

    function isValidAmountInput(value) {
      if (value === null || value === undefined || String(value).trim() === '') return true;
      const raw = String(value).trim().replace(/[\s€]/g, '');
      if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw) &&
          !/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw) &&
          !/^\d+[,.]\d{1,2}$/.test(raw)) return false;
      const amount = parseFlexibleNumber(raw);
      return Number.isFinite(amount) && amount >= 0;
    }
