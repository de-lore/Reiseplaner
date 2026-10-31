// --- LOGIK UNTERKÜNFTE & STATI ---
    const getLodgingForDay = d => d && tripData.lodgings ? tripData.lodgings.find(l => l.checkIn <= d && d < l.checkOut) || null : null;
    const hasFixedLodging = day => (tripData.lodgings || []).some(l => l.checkIn <= day?.date && day?.date < l.checkOut && ['gebucht', 'bezahlt', 'reserviert'].includes((l.status || '').toLowerCase()));
    const isDayNoLodging = d => Boolean(d?.noLodgingNeeded);
    const isDayBooked = d => isDayNoLodging(d) || ['gebucht', 'bezahlt', 'reserviert'].includes((getLodgingForDay(d?.date)?.status || '').toLowerCase());
    const isNightDay = (d, i, arr) => Boolean(d) && !isDayNoLodging(d) && (i < arr.length - 1 || Boolean(getLodgingForDay(d.date)));
    const isDayLodgingSettled = d => isDayNoLodging(d) || ['gebucht', 'bezahlt', 'reserviert'].includes((getLodgingForDay(d?.date)?.status || '').toLowerCase());

    function getLodgingStatusInfo(day) {
      if (isDayNoLodging(day)) return { btnLabel: 'Ohne Unterkunft', shortLabel: 'Keine' };
      const l = getLodgingForDay(day.date), st = (l?.status || 'geplant').toLowerCase();
      if (!l) return { btnLabel: 'Offen', shortLabel: 'Offen' };
      if (st === 'reserviert') return { btnLabel: 'Reserviert', shortLabel: 'Reserviert' };
      if (['gebucht', 'bezahlt'].includes(st)) return { btnLabel: 'Gebucht', shortLabel: 'Gebucht' };
      return { btnLabel: 'Geplant', shortLabel: 'Geplant' };
    }

    // Zustand der kostenlosen Stornierung: none | green (> 3 Tage) | amber (<= 3 Tage) | red (abgelaufen)
    function getCancellationState(iso) {
      if (!iso) return { state: 'none', text: '' };
      const dl = new Date(iso);
      if (isNaN(dl.getTime())) return { state: 'none', text: '' };
      const diffH = (dl.getTime() - Date.now()) / 3600000;
      const dF = dl.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const tF = dl.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const full = `${dF} um ${tF} Uhr`;
      const days = Math.ceil(diffH / 24);
      const left = diffH < 24 ? `noch ${Math.max(1, Math.ceil(diffH))} Std.` : `noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`;
      if (diffH < 0) return { state: 'red', full, left: '', text: 'Nicht mehr kostenlos stornierbar (abgelaufen)' };
      if (diffH <= 72) return { state: 'amber', full, left, text: `Achtung: ${left} kostenlos stornierbar` };
      return { state: 'green', full, left, text: `Noch ${days} Tage kostenlos stornierbar` };
    }

    const CANCEL_BAR_CLASSES = {
      none: 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white',
      green: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200',
      amber: 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-900 dark:text-amber-200',
      red: 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 text-rose-900 dark:text-rose-200'
    };
    const CANCEL_LABEL_CLASSES = { none: 'text-slate-700 dark:text-slate-300', green: 'text-emerald-700 dark:text-emerald-400', amber: 'text-amber-700 dark:text-amber-400', red: 'text-rose-700 dark:text-rose-400' };

    // Eingabefeld "Kostenlose Stornierung bis" im Dialog farbig markieren
    function updateCancelBar() {
      const inp = document.getElementById('modalLodgingFreeCancel');
      if (!inp) return;
      const st = getCancellationState(inp.value);
      inp.className = `w-full rounded-xl px-3 py-2 border-2 font-semibold transition-colors focus:outline-none ${CANCEL_BAR_CLASSES[st.state]}`;
      const lab = document.getElementById('modalCancelLabel');
      if (lab) lab.className = `block font-bold mb-1 ${CANCEL_LABEL_CLASSES[st.state]}`;
      const info = document.getElementById('modalCancelStatus');
      if (info) {
        info.className = `text-[11px] mt-1 font-semibold ${st.state === 'none' ? 'hidden' : CANCEL_LABEL_CLASSES[st.state]}`;
        info.innerText = st.text;
      }
    }

    function renderCancellationBadge(iso) {
      if (!iso) return `<div class="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Keine Stornofrist erfasst</div>`;
      const st = getCancellationState(iso);
      if (st.state === 'none') return `<div class="w-full text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">${escapeHtml(iso)}</div>`;
      if (st.state === 'red') return `<div class="w-full text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1.5"><i class="fa-solid fa-triangle-exclamation text-rose-600"></i> Stornofrist abgelaufen (${st.full})</div>`;
      if (st.state === 'amber') return `<div class="w-full text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 animate-pulse dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1.5"><i class="fa-solid fa-clock text-amber-600"></i> Kostenlos stornierbar bis: ${st.full} (${st.left})</div>`;
      return `<div class="w-full text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5"><i class="fa-solid fa-circle-check text-emerald-600"></i> Kostenlos stornierbar bis: ${st.full} (${st.left})</div>`;
    }

    function renderLodgingsTab() {
      const container = document.getElementById('lodgingsListContainer');
      if (!container) return;
      const sortMode = document.getElementById('lodgingSortSelect')?.value || 'timeline';
      const byTimeline = (a, b) => (a.checkIn || '').localeCompare(b.checkIn || '') || (a.checkOut || '').localeCompare(b.checkOut || '');
      const lodgings = [...(tripData.lodgings || [])].sort((a, b) => {
        if (sortMode === 'cancellation') {
          if (!a.freeCancellationUntil && !b.freeCancellationUntil) return byTimeline(a, b);
          if (!a.freeCancellationUntil) return 1;
          if (!b.freeCancellationUntil) return -1;
          return (new Date(a.freeCancellationUntil).getTime() - new Date(b.freeCancellationUntil).getTime()) || byTimeline(a, b);
        }
        return byTimeline(a, b);
      });

      if (!lodgings.length) {
        container.innerHTML = `
          <div class="bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-8 sm:p-12 text-center text-slate-500 dark:text-slate-400">
            <svg class="ico-house text-3xl sm:text-4xl mb-3 text-slate-400" aria-hidden="true"><use href="#icon-house"></use></svg>
            <p class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">Noch keine Unterkünfte eingetragen</p>
            <button onclick="openLodgingModal(null)" class="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition">+ Erste Unterkunft eintragen</button>
          </div>`;
        return;
      }

      container.innerHTML = `<div class="grid grid-cols-1 gap-3.5">${lodgings.map(renderLodgingCardHTML).join('')}</div>`;
    }

    function renderLodgingCardHTML(l) {
      const pS = parseISOParts(l.checkIn), pE = parseISOParts(l.checkOut);
      const nights = (pS && pE) ? Math.max(0, Math.floor((Date.UTC(pE.y, pE.m - 1, pE.d) - Date.UTC(pS.y, pS.m - 1, pS.d)) / 86400000)) : 0;
      const safeLink = formatSafeUrl(l.link), st = (l.status || 'geplant').toLowerCase();
      const statusBadge = st === 'gebucht' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300' : (st === 'reserviert' ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300');

      return `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-4 shadow-sm space-y-3 flex flex-col justify-between hover:border-indigo-400 transition">
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><svg class="ico-house text-indigo-500" aria-hidden="true"><use href="#icon-house"></use></svg> ${escapeHtml(l.name || 'Unbenannt')}</h4>
                <div class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  📅 ${formatISODate(l.checkIn).dayFormatted} bis ${formatISODate(l.checkOut).dayFormatted} <span class="font-bold text-indigo-600 dark:text-indigo-400">(${nights} ${nights === 1 ? 'Nacht' : 'Nächte'})</span>
                </div>
              </div>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${statusBadge}">${st}</span>
            </div>
            <div>${renderCancellationBadge(l.freeCancellationUntil)}</div>
            <div class="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1">
              ${l.address ? `<div class="flex items-start gap-1.5"><i class="fa-solid fa-map-pin text-slate-400 mt-0.5 shrink-0 text-[11px]"></i><span class="truncate">${escapeHtml(l.address)}</span></div>` : ''}
              ${l.notes ? `<div class="flex items-start gap-1.5 text-slate-500 dark:text-slate-400 italic text-[11px]"><i class="fa-regular fa-comment-dots text-slate-400 mt-0.5 shrink-0"></i><span>${escapeHtml(l.notes)}</span></div>` : ''}
            </div>
          </div>
          <div class="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2">
            <div class="text-xs font-mono font-black text-slate-900 dark:text-white">${formatEuro(parseFlexibleNumber(l.totalPrice))} <span class="text-[10px] font-normal text-slate-400">Gesamt</span></div>
            <div class="flex items-center gap-1.5">
              ${safeLink ? `<a href="${escapeHtml(safeLink)}" target="_blank" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}
              <button onclick="openLodgingModal('${l.id}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition flex items-center gap-1">
                <i class="fa-solid fa-pen text-[10px]"></i> Bearbeiten
              </button>
            </div>
          </div>
        </div>`;
    }

    function openLodgingModal(id) {
      const isEdit = Boolean(id), l = isEdit ? tripData.lodgings.find(it => it.id === id) : null;
      document.getElementById('lodgingModalTitle').innerHTML = `<svg class="ico-house text-indigo-500" aria-hidden="true"><use href="#icon-house"></use></svg> ${isEdit ? 'Unterkunft bearbeiten' : 'Neue Unterkunft anlegen'}`;
      document.getElementById('modalLodgingDeleteBtn').classList.toggle('hidden', !isEdit);
      document.getElementById('autoFillBookingInput').value = '';
      lastBookingPdf = null;
      document.getElementById('modalLodgingId').value = isEdit ? l.id : '';
      document.getElementById('modalLodgingName').value = l?.name || '';
      document.getElementById('modalLodgingLocation').value = l?.location || '';
      document.getElementById('modalLodgingStatus').value = l?.status || 'gebucht';
      document.getElementById('modalLodgingCheckIn').value = l?.checkIn || tripData.startDate || '';
      document.getElementById('modalLodgingCheckOut').value = l?.checkOut || (tripData.startDate ? addDaysISO(tripData.startDate, 1) : '');
      document.getElementById('modalLodgingPrice').value = l?.totalPrice || '';
      document.getElementById('modalLodgingFreeCancel').value = toDateTimeLocalValue(l?.freeCancellationUntil || '');
      updateCancelBar();
      document.getElementById('modalLodgingAddress').value = l?.address || '';
      document.getElementById('modalLodgingLink').value = l?.link || '';
      document.getElementById('modalLodgingNotes').value = l?.notes || '';
      updateModalNightsCalc();
      toggleModal('lodgingModal', true);
      setTimeout(() => document.getElementById('modalLodgingName')?.focus(), 50);
    }

    const closeLodgingModal = () => toggleModal('lodgingModal', false);

    function updateModalNightsCalc() {
      const inVal = document.getElementById('modalLodgingCheckIn')?.value, outVal = document.getElementById('modalLodgingCheckOut')?.value;
      const infoEl = document.getElementById('modalNightsInfo'), pIn = parseISOParts(inVal), pOut = parseISOParts(outVal);
      if (pIn && pOut) {
        const nights = Math.floor((Date.UTC(pOut.y, pOut.m - 1, pOut.d) - Date.UTC(pIn.y, pIn.m - 1, pIn.d)) / 86400000);
        if (nights > 0) return infoEl.innerText = `Dauer: ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'} (Zugewiesen an ${nights} Reisetage)`;
      }
      infoEl.innerText = "Dauer: Bitte gültigen Zeitraum wählen";
    }

    function saveLodgingFromModal() {
      const id = document.getElementById('modalLodgingId').value, name = document.getElementById('modalLodgingName').value.trim();
      const location = document.getElementById('modalLodgingLocation').value.trim(), checkIn = document.getElementById('modalLodgingCheckIn').value, checkOut = document.getElementById('modalLodgingCheckOut').value;
      if (!name || !location) return showAppAlert("Name und Ort sind erforderlich.", "Eingabe unvollständig");
      if (!checkIn || !checkOut || checkIn >= checkOut) return showAppAlert("Check-out muss nach Check-in liegen.", "Ungültiger Zeitraum");
      if (!isValidISODate(checkIn) || !isValidISODate(checkOut)) return showAppAlert("Bitte gültige Check-in- und Check-out-Daten wählen.", "Ungültiges Datum", "danger");
      const totalPriceInput = document.getElementById('modalLodgingPrice').value.trim();
      if (!isValidAmountInput(totalPriceInput)) return showAppAlert("Bitte einen gültigen nicht-negativen Betrag eingeben (z. B. 123,45).", "Ungültiger Betrag", "danger");
      const cancellationDate = document.getElementById('modalLodgingFreeCancel').value;
      if (cancellationDate && !isValidISODateTimeLocal(cancellationDate)) return showAppAlert("Bitte ein gültiges Datum und eine gültige Uhrzeit für die kostenlose Stornierung wählen.", "Ungültiges Datum", "danger");

      const overlapping = (tripData.lodgings || []).find(l => (!id || l.id !== id) && typeof l.checkIn === 'string' && typeof l.checkOut === 'string' && checkIn < l.checkOut && l.checkIn < checkOut);
      if (overlapping) return showAppAlert(
        'Der Zeitraum überschneidet sich mit „' + (overlapping.name || 'einer anderen Unterkunft') + '“ (' + overlapping.checkIn + ' bis ' + overlapping.checkOut + '). Bitte prüfe die Daten.',
        'Unterkunftszeiträume überschneiden sich', 'danger'
      );

      const obj = {
        id: id || generateUUID(), name, location,
        status: document.getElementById('modalLodgingStatus').value, checkIn, checkOut,
        totalPrice: totalPriceInput,
        freeCancellationUntil: cancellationDate,
        address: document.getElementById('modalLodgingAddress').value.trim(),
        link: document.getElementById('modalLodgingLink').value.trim(),
        notes: document.getElementById('modalLodgingNotes').value.trim()
      };

      if (!Array.isArray(tripData.lodgings)) tripData.lodgings = [];
      const idx = tripData.lodgings.findIndex(it => it.id === id);
      if (idx !== -1) tripData.lodgings[idx] = obj; else tripData.lodgings.push(obj);

      closeLodgingModal(); recordChangeForReminder(); saveToStorage();
      renderLodgingsTab(); renderDays(); updateStats();
      showToast("Unterkunft gespeichert");
    }

    async function deleteModalLodging() {
      const id = document.getElementById('modalLodgingId').value;
      if (!id || !await showAppConfirm("Unterkunft wirklich löschen?", { title: "Löschen", variant: "danger", icon: "fa-trash-can" })) return;
      tripData.lodgings = (tripData.lodgings || []).filter(it => it.id !== id);
      closeLodgingModal(); recordChangeForReminder(); saveToStorage();
      renderLodgingsTab(); renderDays(); updateStats();
      showToast("Unterkunft entfernt");
    }

    function openLodgingForDay(dateStr) {
      const ex = getLodgingForDay(dateStr);
      if (ex) { switchTab('lodgings'); openLodgingModal(ex.id); }
      else {
        openLodgingModal(null);
        document.getElementById('modalLodgingCheckIn').value = dateStr;
        document.getElementById('modalLodgingCheckOut').value = addDaysISO(dateStr, 1);
        const day = tripData.days.find(d => d.date === dateStr);
        if (day?.location) document.getElementById('modalLodgingLocation').value = day.location;
        updateModalNightsCalc();
      }
    }
