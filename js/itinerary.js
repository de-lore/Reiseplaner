// --- TAGESKARTEN RENDERN ---
    let weekOverviewActive = false;
    function toggleWeekOverview() {
      weekOverviewActive = !weekOverviewActive;
      renderDays();
    }

    function renderWeekOverview() {
      const overview = document.getElementById('weekOverview');
      if (!overview) return;
      const weeks = [];
      for (let i = 0; i < tripData.days.length; i += 7) weeks.push(tripData.days.slice(i, i + 7));
      overview.innerHTML = weeks.map((days, weekIdx) => `
        <section class="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <h2 class="px-3 py-2 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200">Woche ${weekIdx + 1} <span class="font-normal text-slate-500">· Tage ${weekIdx * 7 + 1}–${weekIdx * 7 + days.length}</span></h2>
          <ol class="divide-y divide-slate-100 dark:divide-slate-700/70">${days.map((day, offset) => {
            const idx = weekIdx * 7 + offset;
            const activities = [...(day.transports || []), ...(day.activities || [])].map(x => x.title).filter(Boolean).slice(0, 2).join(' · ');
            const loc = (day.location || '').trim();
            return `<li class="flex items-center gap-2 px-2 py-2 sm:px-3">
              <button type="button" data-week-day="${idx}" class="flex-1 min-w-0 text-left flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-300 focus-visible:outline">
                <span class="w-12 shrink-0 font-mono text-[10px] text-slate-500">${escapeHtml(formatISODate(day.date).dayFormatted || '--.--')}</span>
                <span class="min-w-0 flex-1"><span class="block truncate text-xs font-semibold">${escapeHtml(loc || 'Ort noch offen')}</span><span class="block truncate text-[10px] text-slate-500">${escapeHtml(activities || (day.notes ? 'Notiz vorhanden' : ''))}</span></span>
              </button>
              ${loc ? `<a class="shrink-0 px-2 py-1 text-[10px] font-semibold rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(loc)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(loc)} in Karten öffnen">Karte</a>` : ''}
            </li>`;
          }).join('')}</ol>
        </section>`).join('');
      overview.querySelectorAll('[data-week-day]').forEach(button => button.addEventListener('click', () => jumpToSpecificDay(Number(button.dataset.weekDay))));
    }

    function renderDays() {
      const container = document.getElementById('daysContainer');
      if (!container) return;
      container.innerHTML = ''; updateToggleAllBtnState();
      const overview = document.getElementById('weekOverview');
      const overviewBtn = document.getElementById('weekOverviewBtn');
      if (overview) overview.classList.toggle('hidden', !weekOverviewActive);
      if (overviewBtn) { overviewBtn.setAttribute('aria-pressed', String(weekOverviewActive)); overviewBtn.classList.toggle('bg-indigo-600', weekOverviewActive); overviewBtn.classList.toggle('text-white', weekOverviewActive); }
      container.classList.toggle('hidden', weekOverviewActive);

      if (!tripData.days?.length) {
        weekOverviewActive = false; overview?.classList.add('hidden'); container.classList.remove('hidden');
        container.innerHTML = `<div class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-8 sm:p-12 text-center text-slate-500 no-print"><i class="fa-solid fa-map text-3xl sm:text-4xl mb-3 text-slate-400"></i><p class="text-xs sm:text-sm">Noch keine Tage vorhanden.</p></div>`;
        return updateStats();
      }
      if (weekOverviewActive) { renderWeekOverview(); updateStats(); return; }

      const today = getTodayIso(); let matches = 0;
      tripData.days.forEach((day, idx) => {
        const l = getLodgingForDay(day.date);
        const fMap = {
          all: true, booked_lodging: isDayBooked(day), open_lodging: !isDayBooked(day) && !isDayNoLodging(day),
          booked_flights: day.transports?.some(t => isFlight(t) && isStatusFixed(t.costStatus)),
          open_flights: day.transports?.some(t => isFlight(t) && !isStatusFixed(t.costStatus)),
          open_transports: day.transports?.some(t => !isStatusFixed(t.costStatus)),
          with_attachments: day.images?.length > 0
        };
        if (!fMap[currentFilter]) return;

        if (searchQuery) {
          const hay = [day.location, l?.name, l?.address, day.notes, ...(day.transports || []).map(t => `${t.title} ${t.hint}`), ...(day.activities || []).map(a => `${a.title} ${a.hint}`), ...(day.images || []).map(i => i.name)].join(' ').toLowerCase();
          if (!hay.includes(searchQuery)) return;
        }

        matches++;
        container.appendChild(createDayElement(day, idx, day.date === today));
        if (!day.isCollapsed) updateImagesDOM(idx);
      });

      if (!matches) {
        container.innerHTML = `<div class="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 text-center text-slate-600 no-print"><p class="text-xs sm:text-sm font-semibold">Keine Treffer</p><button onclick="setFilter('all'); clearSearch();" class="mt-3 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold">Filter zurücksetzen</button></div>`;
      }
      updateStats(); autoResizeAllTextareas();
    }

    function renderDayLodgingSummaryHTML(day, index) {
      const noL = isDayNoLodging(day), l = getLodgingForDay(day.date);
      if (noL) {
        return `
          <div class="bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-2.5"><span class="text-base text-slate-400">✈️</span><div><span class="text-xs font-bold text-slate-600 dark:text-slate-300">Keine Übernachtung nötig</span></div></div>
            <button onclick="toggleDayNoLodging(${index})" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 no-print">Aktivieren</button>
          </div>`;
      }
      if (!l) {
        return `
          <div class="bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-dashed border-amber-300 dark:border-amber-800/80 flex items-center justify-between gap-3 shadow-sm">
            <div class="flex items-center gap-2.5"><span class="text-base text-amber-500"><svg class="ico-house" aria-hidden="true"><use href="#icon-house"></use></svg></span><div><span class="text-xs font-bold text-amber-800 dark:text-amber-300">Noch keine Unterkunft</span></div></div>
            <div class="flex items-center gap-1.5 no-print">
              <button onclick="toggleDayNoLodging(${index})" class="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-400">Keine</button>
              <button onclick="openLodgingForDay('${day.date}')" class="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold shadow-sm">+ Zuweisen</button>
            </div>
          </div>`;
      }
      const st = (l.status || 'geplant').toLowerCase();
      const statusBadge = st === 'gebucht' ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300' : (st === 'reserviert' ? 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300' : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300');

      return `
        <div class="bg-white dark:bg-slate-900/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="text-base text-slate-700 dark:text-slate-200"><svg class="ico-house" aria-hidden="true"><use href="#icon-house"></use></svg></span>
            <div class="truncate">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-slate-900 dark:text-white truncate">${escapeHtml(l.name)}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${statusBadge}">${st}</span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"><i class="fa-solid fa-map-pin text-[10px]"></i> ${escapeHtml(l.address || 'Keine Adresse')}</div>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 no-print">
            <button onclick="copyHotelInfo(${index})" title="Kopieren" class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"><i class="fa-regular fa-copy"></i></button>
            <button onclick="openHotelMaps(${index})" title="Maps" class="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 text-xs"><i class="fa-solid fa-location-dot"></i></button>
            <button onclick="openLodgingForDay('${day.date}')" title="Details" class="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>
          </div>
        </div>`;
    }

    function toggleDayNoLodging(idx) {
      const d = tripData.days[idx]; if (!d) return;
      d.noLodgingNeeded = !d.noLodgingNeeded;
      recordChangeForReminder(); saveToStorage(); renderDays(); updateStats();
      showToast(d.noLodgingNeeded ? "Keine Übernachtung markiert" : "Übernachtung aktiviert");
    }

    // Verkehrsmittel: Icon-Auswahl -> Text wird zunächst übernommen, bleibt aber frei änderbar
    const TRANSPORT_CATS = [
      ['', 'Auto-Icon', ''], ['flugzeug', 'Flugzeug', '✈️'], ['zug', 'Zug / Bahn', '🚆'], ['bus', 'Bus', '🚌'],
      ['boot', 'Boot / Fähre', '🚤'], ['mietwagen', 'Mietwagen', '🚗'], ['roller', 'Roller', '🛵'], ['taxi', 'Taxi / Grab', '🚕']
    ];
    const TRANSPORT_LABELS = Object.fromEntries(TRANSPORT_CATS.filter(c => c[0]).map(c => [c[0], c[1]]));

    // Zeile 1: Icon + Status (+ Sortieren/Verschieben/Löschen) | Zeile 2: Art | Zeile 3: Hinweise | Zeile 4: Preis + URL
    function renderTransportItemHTML(it, dayIdx, itemIdx, isFirst, isLast, st, safeUrl) {
      const attr = (field) => `data-sub-list="transports" data-day-index="${dayIdx}" data-item-index="${itemIdx}" data-sub-field="${field}"`;
      const base = `data-sub-list="transports" data-day-index="${dayIdx}" data-item-index="${itemIdx}"`;
      const arrow = (dir, disabled, icon) => `<button data-action="move-item-${dir}" ${base} class="w-6 h-6 rounded flex items-center justify-center text-[10px] ${disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400'}" ${disabled ? 'disabled' : ''}><i class="fa-solid ${icon} pointer-events-none"></i></button>`;
      return `
                  <div class="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs shadow-sm">
                    <div class="flex items-center gap-2">
                      <div class="relative w-11 h-8 shrink-0">
                        <span id="tr-emoji-${dayIdx}-${itemIdx}" class="absolute inset-0 flex items-center justify-center text-lg rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 pointer-events-none">${getTransportEmoji(it)}</span>
                        <i class="fa-solid fa-caret-down absolute right-0.5 bottom-0.5 text-[8px] text-slate-400 pointer-events-none no-print"></i>
                        <select ${attr('category')} aria-label="Verkehrsmittel" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                          ${TRANSPORT_CATS.map(([val, label, emo]) => `<option value="${val}" ${(it.category || '') === val ? 'selected' : ''}>${emo ? emo + ' ' : ''}${label}</option>`).join('')}
                        </select>
                      </div>
                      <select ${attr('costStatus')} class="text-[11px] font-bold rounded px-2 py-1.5 border transition ${getStatusBadgeClass(st)}">
                        <option value="geplant" ${st === 'geplant' ? 'selected' : ''}>⏳ Geplant</option>
                        <option value="reserviert" ${st === 'reserviert' ? 'selected' : ''}>📌 Reserviert</option>
                        <option value="bezahlt" ${['bezahlt', 'gebucht'].includes(st) ? 'selected' : ''}>✅ Bezahlt</option>
                      </select>
                      <div class="ml-auto flex items-center gap-0.5 no-print">
                        ${arrow('up', isFirst, 'fa-chevron-up')}${arrow('down', isLast, 'fa-chevron-down')}
                        <button data-action="move-item-day" ${base} class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 transition" title="Auf anderen Tag verschieben"><i class="fa-solid fa-calendar-day pointer-events-none"></i></button>
                        <button data-action="remove-item" ${base} class="text-rose-500 hover:text-rose-700 px-1.5 text-base leading-none" title="Löschen">&times;</button>
                      </div>
                    </div>
                    <textarea rows="1" placeholder="Art (z. B. Flug Bangkok – Luang Prabang)" ${attr('title')} class="auto-hint w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 font-semibold text-slate-900 dark:text-white">${escapeHtml(it.title || '')}</textarea>
                    <textarea rows="1" placeholder="Hinweise..." ${attr('hint')} class="auto-hint w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700/60 rounded px-2 py-1 text-amber-800 dark:text-amber-200">${escapeHtml(it.hint || '')}</textarea>
                    <div class="flex items-center gap-2">
                      <div class="relative flex items-center w-28 shrink-0">
                        <input type="text" inputmode="decimal" placeholder="Preis" value="${escapeHtml(it.cost || '')}" ${attr('cost')} class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-1.5 pr-5 py-1 text-slate-900 dark:text-white font-mono text-right">
                        <span class="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">€</span>
                      </div>
                      <input type="url" placeholder="URL" value="${escapeHtml(it.link || '')}" ${attr('link')} class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white no-print">
                      <a id="transports-link-btn-${dayIdx}-${itemIdx}" href="${escapeHtml(safeUrl || '#')}" target="_blank" class="${safeUrl ? '' : 'hidden'} px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center shrink-0 text-xs no-print shadow"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                    </div>
                  </div>`;
    }

    // Wird bei Änderung von Kategorie/Titel aufgerufen: Text übernehmen (nur wenn leer/Standardtext) + Icon aktualisieren
    function syncTransportIconAndTitle(day, dayIdx, idx, changedField) {
      const it = day.transports?.[idx]; if (!it) return;
      if (changedField === 'category') {
        const label = TRANSPORT_LABELS[it.category];
        const cur = (it.title || '').trim();
        if (label && (!cur || Object.values(TRANSPORT_LABELS).includes(cur))) {
          it.title = label;
          const ta = document.querySelector(`textarea[data-sub-list="transports"][data-day-index="${dayIdx}"][data-item-index="${idx}"][data-sub-field="title"]`);
          if (ta) { ta.value = label; autoResizeTextarea(ta); }
        }
      }
      const emo = document.getElementById(`tr-emoji-${dayIdx}-${idx}`);
      if (emo) emo.textContent = getTransportEmoji(it);
    }

    // Aktivität: Zeile 1 Status + Erledigt | Zeile 2 Aktivität (voller Text) | Zeile 3 Hinweise | Zeile 4 Preis + URL
    function renderActivityItemHTML(it, dayIdx, itemIdx, isFirst, isLast, st, safeUrl) {
      const attr = (field) => `data-sub-list="activities" data-day-index="${dayIdx}" data-item-index="${itemIdx}" data-sub-field="${field}"`;
      const base = `data-sub-list="activities" data-day-index="${dayIdx}" data-item-index="${itemIdx}"`;
      const arrow = (dir, disabled, icon) => `<button data-action="move-item-${dir}" ${base} class="w-6 h-6 rounded flex items-center justify-center text-[10px] ${disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400'}" ${disabled ? 'disabled' : ''}><i class="fa-solid ${icon} pointer-events-none"></i></button>`;
      return `
                  <div class="bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs shadow-sm">
                    <div class="flex items-center gap-2 flex-wrap">
                      <select ${attr('costStatus')} class="text-[11px] font-bold rounded px-2 py-1.5 border transition ${getStatusBadgeClass(st)}">
                        <option value="geplant" ${st === 'geplant' ? 'selected' : ''}>⏳ Geplant</option>
                        <option value="reserviert" ${st === 'reserviert' ? 'selected' : ''}>📌 Reserviert</option>
                        <option value="bezahlt" ${['bezahlt', 'gebucht'].includes(st) ? 'selected' : ''}>✅ Bezahlt</option>
                      </select>
                      <div class="ml-auto flex items-center gap-0.5 no-print">
                        ${arrow('up', isFirst, 'fa-chevron-up')}${arrow('down', isLast, 'fa-chevron-down')}
                        <button data-action="move-item-day" ${base} class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 transition" title="Auf anderen Tag verschieben"><i class="fa-solid fa-calendar-day pointer-events-none"></i></button>
                        <div class="relative">
                          <button type="button" data-action="toggle-activity-menu" ${base} class="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-1 rounded transition" title="Weitere Optionen" aria-label="Weitere Optionen" aria-expanded="false"><i class="fa-solid fa-ellipsis-vertical pointer-events-none"></i></button>
                          <div id="activity-menu-${dayIdx}-${itemIdx}" class="activity-action-dropdown hidden absolute right-0 top-full mt-1 w-40 p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20">
                            <label class="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                              <input type="checkbox" ${it.done ? 'checked' : ''} data-action="toggle-activity-done" data-day-index="${dayIdx}" data-act-index="${itemIdx}" class="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-0">
                              <span>Erledigt</span>
                            </label>
                          </div>
                        </div>
                        <button data-action="remove-item" ${base} class="text-rose-500 hover:text-rose-700 px-1.5 text-base leading-none" title="Löschen">&times;</button>
                      </div>
                    </div>
                    <textarea rows="1" id="act-title-input-${dayIdx}-${itemIdx}" placeholder="Aktivität / Plan" ${attr('title')} class="auto-hint w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1 font-semibold text-slate-900 dark:text-white ${it.done ? 'line-through text-slate-400' : ''}">${escapeHtml(it.title || '')}</textarea>
                    <textarea rows="1" placeholder="Hinweise..." ${attr('hint')} class="auto-hint w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-700/60 rounded px-2 py-1 text-amber-800 dark:text-amber-200">${escapeHtml(it.hint || '')}</textarea>
                    <div class="flex items-center gap-2">
                      <div class="relative flex items-center w-28 shrink-0">
                        <input type="text" inputmode="decimal" placeholder="Preis" value="${escapeHtml(it.cost || '')}" ${attr('cost')} class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded pl-1.5 pr-5 py-1 text-slate-900 dark:text-white font-mono text-right">
                        <span class="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">€</span>
                      </div>
                      <input type="url" placeholder="URL" value="${escapeHtml(it.link || '')}" ${attr('link')} class="flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-900 dark:text-white no-print">
                      <a id="activities-link-btn-${dayIdx}-${itemIdx}" href="${escapeHtml(safeUrl || '#')}" target="_blank" class="${safeUrl ? '' : 'hidden'} px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center shrink-0 text-xs no-print shadow"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
                    </div>
                  </div>`;
    }

    function renderSubItemListHTML(day, dayIdx, type) {
      const isTr = type === 'transports', items = day[type] || [], total = items.length;
      const title = isTr ? 'Transport & Route' : 'Aktivitäten & Tickets';
      const icon = isTr ? 'fa-plane-departure text-cyan-600' : 'fa-ticket text-emerald-600';
      const addAct = isTr ? 'add-transport' : 'add-activity';
      const addTxt = isTr ? '+ Weiterer Transport' : '+ Weitere Aktivität';

      return `
        <div id="${type}-box-${dayIdx}" class="bg-slate-50/80 dark:bg-slate-900/60 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2"><i class="fa-solid ${icon}"></i> ${title}</h3>
              <button data-action="${addAct}" data-day-index="${dayIdx}" class="text-xs text-indigo-600 dark:text-indigo-400 font-semibold no-print">${addTxt}</button>
            </div>
            <div class="space-y-2.5">
              ${items.map((it, itemIdx) => {
                const safeUrl = formatSafeUrl(it.link), isFirst = itemIdx === 0, isLast = itemIdx === total - 1, st = it.costStatus || 'geplant';
                return isTr ? renderTransportItemHTML(it, dayIdx, itemIdx, isFirst, isLast, st, safeUrl) : renderActivityItemHTML(it, dayIdx, itemIdx, isFirst, isLast, st, safeUrl);
              }).join('')}
            </div>
          </div>
        </div>`;
    }

    function createDayElement(day, index, isToday) {
      const visual = getDayVisualClasses(day, isToday), { dayName, dayFormatted } = formatISODate(day.date);
      const costs = getDayCostBreakdown(day), hasTr = day.transports?.length > 0, hasAct = day.activities?.length > 0;
      const images = day.images || [], l = getLodgingForDay(day.date);
      const card = document.createElement('div');
      card.id = 'day-card-' + index;

      if (day.isCollapsed) {
        card.className = `day-card cursor-pointer border rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 transition-all duration-200 flex items-center justify-between text-xs sm:text-sm shadow-sm hover:brightness-95 dark:hover:brightness-110 ${visual.cardClass}`;
        card.setAttribute('data-action', 'toggle-collapse'); card.setAttribute('data-day-index', index);
        const trTxt = hasTr ? day.transports.map(t => `${getTransportEmoji(t)} ${t.title || 'Transport'}`).join(' & ') : '—';
        const lodHtml = isDayNoLodging(day) ? '✈️ Keine Übernachtung' : (l ? `<svg class="ico-house" aria-hidden="true"><use href="#icon-house"></use></svg> ${escapeHtml(l.name)}` : `<svg class="ico-house" aria-hidden="true"><use href="#icon-house"></use></svg> <span class="italic text-slate-400 dark:text-slate-500">Noch keine Unterkunft</span>`);
        const ind = (day.notes?.trim() || images.length) ? `<span class="text-slate-400">|</span><span class="inline-flex items-center gap-1.5">${day.notes?.trim() ? '📝' : ''}${images.length ? `<span class="px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">📎 ${images.length}</span>` : ''}</span>` : '';

        card.innerHTML = `
          <div class="flex-1 min-w-0 pr-2">
           <div class="flex items-center space-x-2 sm:space-x-2.5 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span class="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/70 text-indigo-800 dark:text-indigo-200 font-bold font-mono">Tag ${index + 1} · ${dayName} · ${dayFormatted ? dayFormatted.slice(0, 5) : '--.--'}</span>
            <span class="text-slate-400">|</span>
            <span class="font-bold text-slate-900 dark:text-slate-100">📍 ${escapeHtml(day.location) || 'Ohne Ort'}</span>
            <span class="text-slate-400">|</span>
            <span class="text-slate-700 dark:text-slate-300">${escapeHtml(trTxt)}</span>
            ${ind}
           </div>
           <div class="mt-0.5 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 truncate">${lodHtml}</div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 no-print"><span class="p-1 text-slate-500"><i class="fa-solid fa-chevron-down text-xs"></i></span></div>`;
        return card;
      }

      card.className = `day-card rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm dark:shadow-md ${visual.cardClass}`;
      const statusInfo = getLodgingStatusInfo(day);
      const hasDailyLodgingPrice = Boolean(l && l.totalPrice !== undefined && String(l.totalPrice).trim() !== '');
      const lodgingDailyCost = hasDailyLodgingPrice ? formatEuro(costs.lodging) : '';
      const lodgingBadgeLabel = hasDailyLodgingPrice ? `${statusInfo.btnLabel}, pro Tag ${lodgingDailyCost}` : statusInfo.btnLabel;
      const hasPrev = index > 0, hasNext = index < tripData.days.length - 1;
      const canSwapPrev = hasPrev && !hasFixedLodging(day) && !hasFixedLodging(tripData.days[index - 1]);
      const canSwapNext = hasNext && !hasFixedLodging(day) && !hasFixedLodging(tripData.days[index + 1]);

      card.innerHTML = `
        <div id="day-header-${index}" class="px-3 py-2 sm:px-5 sm:py-4 print-compact flex flex-wrap items-center gap-x-2 gap-y-2 border-b ${visual.headerClass}">
          <div class="flex items-center gap-1.5 sm:gap-2 cursor-pointer min-w-0 shrink-0" data-action="toggle-collapse" data-day-index="${index}">
            <div class="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white text-center border border-indigo-500 shrink-0 shadow-sm">
              <div class="text-[9px] uppercase font-bold text-indigo-100">Tag ${index + 1} · ${dayName}</div>
              <div class="text-sm sm:text-lg font-black tracking-tight">${dayFormatted}</div>
            </div>
            <div class="min-w-0 whitespace-nowrap">
              ${isToday ? '<span class="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500 text-white animate-pulse no-print">HEUTE</span>' : ''}
            </div>
          </div>

          <div class="flex flex-1 min-w-[190px] flex-wrap items-center gap-1 sm:gap-1.5">
            <button type="button" title="Tag löschen" aria-label="Tag löschen" data-action="delete-day" data-day-index="${index}" class="day-action-button w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:bg-slate-800 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-950/50 flex items-center justify-center no-print"><i class="fa-solid fa-trash-can text-xs pointer-events-none"></i></button>
            <button type="button" title="Tag einfügen" aria-label="Tag einfügen" data-action="insert-day" data-day-index="${index}" class="day-action-button w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 text-indigo-600 hover:bg-indigo-50 dark:bg-slate-800 dark:text-indigo-300 dark:hover:text-indigo-200 dark:hover:bg-indigo-950/60 flex items-center justify-center no-print"><i class="fa-solid fa-calendar-plus text-xs pointer-events-none"></i></button>
            <button type="button" title="Tag nach oben tauschen" aria-label="Tag nach oben tauschen" data-action="swap-day-prev" data-day-index="${index}" ${!canSwapPrev ? 'disabled' : ''} class="day-action-button w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition no-print ${canSwapPrev ? 'text-slate-600 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}"><i class="fa-solid fa-arrow-up text-xs pointer-events-none"></i></button>
            <button type="button" title="Tag nach unten tauschen" aria-label="Tag nach unten tauschen" data-action="swap-day-next" data-day-index="${index}" ${!canSwapNext ? 'disabled' : ''} class="day-action-button w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition no-print ${canSwapNext ? 'text-slate-600 hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}"><i class="fa-solid fa-arrow-down text-xs pointer-events-none"></i></button>
            <button type="button" title="Tagesansicht zuklappen" aria-label="Tagesansicht zuklappen" data-action="toggle-collapse" data-day-index="${index}" class="day-action-button ml-auto w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 flex items-center justify-center no-print"><i class="fa-solid fa-chevron-up text-xs pointer-events-none"></i></button>
          </div>

          <div class="w-full min-w-0">
            <div id="loc-box-${index}" class="${getLocationBoxClasses(day)}">
              <button type="button" data-action="open-maps" data-day-index="${index}" class="${getLocationMapsIconClasses(day)}"><i class="fa-solid fa-map-location-dot text-base sm:text-lg pointer-events-none"></i></button>
              <button type="button" data-action="open-offline-maps" data-day-index="${index}" class="mr-2.5 shrink-0 transition no-print sm:hidden ${day.location?.trim() ? 'text-emerald-600' : 'hidden'}"><i class="fa-solid fa-compass text-sm pointer-events-none"></i></button>
              <input type="text" value="${escapeHtml(day.location || '')}" placeholder="Tagesort / Etappe eintragen..." data-day-index="${index}" data-field="location" class="w-full bg-transparent text-base sm:text-xl font-black text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none">
            </div>
          </div>

          <div class="w-full flex min-w-0 items-center justify-between gap-1">
            <div class="flex min-w-0 items-center gap-1">
              <button type="button" title="${lodgingBadgeLabel}" aria-label="${lodgingBadgeLabel}" onclick="openLodgingForDay('${day.date}')" class="h-7 max-w-[220px] sm:max-w-none min-w-0 justify-center px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[9px] sm:text-xs font-bold transition flex items-center gap-1 shadow no-print whitespace-nowrap overflow-hidden ${visual.btnClass}">
                <svg class="ico-house pointer-events-none shrink-0" aria-hidden="true"><use href="#icon-house"></use></svg><span class="min-w-0 truncate">${statusInfo.btnLabel}</span>${hasDailyLodgingPrice ? `<span class="shrink-0 opacity-70">·</span><span class="shrink-0 font-mono">pro Tag ${lodgingDailyCost}</span>` : ''}
              </button>
            </div>
            <div class="h-7 shrink-0 px-1.5 sm:px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-xs font-mono flex items-center gap-1" title="Gesamte Tageskosten einschließlich anteiliger Unterkunftskosten">
              <i class="fa-solid fa-wallet text-violet-500"></i>
              <span class="text-slate-500 dark:text-slate-400">Gesamt</span>
              <span id="day-cost-display-${index}" class="font-bold text-slate-800 dark:text-slate-200">${formatEuro(costs.total)}</span>
            </div>
          </div>
        </div>

        <div id="day-body-${index}" class="p-4 sm:p-5 print-compact space-y-4 sm:space-y-5">
          <div id="day-modules-grid-${index}" class="space-y-4 sm:space-y-5">
            ${hasTr ? renderSubItemListHTML(day, index, 'transports') : ''}
            ${hasAct ? renderSubItemListHTML(day, index, 'activities') : ''}
          </div>

          <div id="day-add-buttons-${index}" class="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1 no-print ${hasTr && hasAct ? 'hidden' : ''}">
            ${!hasTr ? `<button data-action="add-transport" data-day-index="${index}" class="w-full sm:w-auto px-4 py-2 rounded-xl border border-dashed border-cyan-400 bg-cyan-50/70 text-cyan-800 dark:bg-cyan-950/20 dark:text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5">+ Transport hinzufügen</button>` : ''}
            ${!hasAct ? `<button data-action="add-activity" data-day-index="${index}" class="w-full sm:w-auto px-4 py-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5">+ Aktivität hinzufügen</button>` : ''}
          </div>

          <div id="notes-dropzone-${index}" ondragover="handleDayDragOver(event, ${index})" ondragleave="handleDayDragLeave(event, ${index})" ondrop="handleDayDrop(event, ${index})" class="space-y-2.5 sm:space-y-3 rounded-xl transition-all p-1 -m-1">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><i class="fa-regular fa-note-sticky text-amber-500"></i> Notizen & Belege</span>
              <div class="flex items-center gap-2 no-print">
                <input type="file" id="file-upload-${index}" accept="image/*,application/pdf" multiple class="hidden" onchange="handleDocFileSelect(event, ${index})">
                <button type="button" data-action="trigger-file-upload" data-day-index="${index}" class="text-xs text-indigo-600 font-semibold flex items-center gap-1"><i class="fa-solid fa-paperclip pointer-events-none"></i> Belege anhängen</button>
              </div>
            </div>
            <textarea rows="2" placeholder="Notizen..." onpaste="handleDayPaste(event, ${index})" data-day-index="${index}" data-field="notes" class="auto-hint w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:border-indigo-500 shadow-sm">${escapeHtml(day.notes || '')}</textarea>
            <div id="images-container-${index}" class="flex flex-wrap gap-2.5 pt-1 ${images.length === 0 ? 'hidden' : ''}"></div>
          </div>

          ${renderDayLodgingSummaryHTML(day, index)}
        </div>`;
      return card;
    }

    function setupEventDelegation() {
      const container = document.getElementById('daysContainer');
      const chkContainer = document.getElementById('checklistContainer');

      container.addEventListener('click', e => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.getAttribute('data-action');
        const dayIdx = parseInt(actionEl.getAttribute('data-day-index'), 10);
        const subList = actionEl.getAttribute('data-sub-list');
        const itemIdx = parseInt(actionEl.getAttribute('data-item-index'), 10);

        if (action === 'toggle-collapse') {
          if (!isNaN(dayIdx)) openOnlyDay(dayIdx);
          return;
        }

        const actions = {
          'open-maps': () => tripData.days[dayIdx] && openGoogleMaps(tripData.days[dayIdx].location),
          'open-offline-maps': () => tripData.days[dayIdx] && openOfflineMaps(tripData.days[dayIdx].location),
          'swap-day-prev': () => swapDayWithAdjacent(dayIdx, -1),
          'swap-day-next': () => swapDayWithAdjacent(dayIdx, 1),
          'insert-day': () => openDayActionModal('insert', dayIdx),
          'delete-day': () => openDayActionModal('delete', dayIdx),
          'add-transport': () => addListRow(dayIdx, 'transports', { title: '', category: '', cost: '', costStatus: 'geplant', hint: '', link: '' }),
          'add-activity': () => addListRow(dayIdx, 'activities', { title: '', cost: '', costStatus: 'geplant', hint: '', link: '', done: false }),
          'remove-item': () => removeListRow(dayIdx, subList, itemIdx),
          'move-item-up': () => moveArrayItem(dayIdx, subList, itemIdx, -1),
          'move-item-down': () => moveArrayItem(dayIdx, subList, itemIdx, 1),
          'move-item-day': () => openMoveItemModal(dayIdx, subList, itemIdx),
          'toggle-activity-menu': () => {
            const menu = document.getElementById(`activity-menu-${dayIdx}-${itemIdx}`);
            const willOpen = menu?.classList.contains('hidden');
            document.querySelectorAll('.activity-action-dropdown').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[data-action="toggle-activity-menu"]').forEach(el => el.setAttribute('aria-expanded', 'false'));
            menu?.classList.toggle('hidden', !willOpen);
            actionEl.setAttribute('aria-expanded', String(!!willOpen));
          },
          'trigger-file-upload': () => document.getElementById('file-upload-' + dayIdx)?.click(),
          'open-lightbox': () => openLightbox(actionEl.getAttribute('data-media-id'), dayIdx),
          'open-pdf': () => openPdfAttachment(actionEl.getAttribute('data-media-id'), actionEl.getAttribute('data-file-name')),
          'rename-attachment': () => renameDayAttachment(dayIdx, itemIdx),
          'delete-attachment': () => deleteDayAttachment(dayIdx, itemIdx)
        };
        actions[action]?.();
      });

      const handleFieldUpdate = e => {
        const t = e.target, dayIdx = parseInt(t.getAttribute('data-day-index'), 10), day = tripData.days[dayIdx];
        if (!day) return;

        if (e.type === 'input' && t.classList.contains('auto-hint')) autoResizeTextarea(t);

        if (e.type === 'change' && t.getAttribute('data-action') === 'toggle-activity-done') {
          const actIdx = parseInt(t.getAttribute('data-act-index'), 10);
          if (day.activities[actIdx]) {
            day.activities[actIdx].done = t.checked;
            const titleInput = document.getElementById(`act-title-input-${dayIdx}-${actIdx}`);
            if (titleInput) { titleInput.classList.toggle('line-through', t.checked); titleInput.classList.toggle('text-slate-400', t.checked); }
            recordChangeForReminder(); saveToStorage();
          }
          return;
        }

        const field = t.getAttribute('data-field');
        if (field) {
          day[field] = t.value;
          if (field === 'location') { updateDayCardVisualStatus(dayIdx); if (day.images?.length) renderAllAttachmentsOverview(); }
          recordChangeForReminder(); saveToStorage();
          return;
        }

        const subList = t.getAttribute('data-sub-list'), subField = t.getAttribute('data-sub-field'), idx = parseInt(t.getAttribute('data-item-index'), 10);
        if (subList && subField === 'cost' && day[subList]?.[idx]) {
          if (e.type === 'input') return;
          if (!isValidAmountInput(t.value)) {
            t.value = day[subList][idx].cost || '';
            showToast('Bitte einen gültigen nicht-negativen Betrag eingeben.', true);
            return;
          }
        }
        if (subList && subField && day[subList]?.[idx]) {
          day[subList][idx][subField] = t.value;
          if (subList === 'transports' && (subField === 'category' || subField === 'title')) syncTransportIconAndTitle(day, dayIdx, idx, subField);
          if (subField === 'costStatus') t.className = 'text-[11px] font-bold rounded px-2 py-1 border transition ' + getStatusBadgeClass(t.value);
          if (subField === 'link') {
            const btn = document.getElementById(`${subList}-link-btn-${dayIdx}-${idx}`);
            if (btn) { const u = formatSafeUrl(t.value); btn.href = u || '#'; btn.classList.toggle('hidden', !u); }
          }
          refreshDayHeaderCost(dayIdx); recordChangeForReminder(); saveToStorage();
        }
      };

      container.addEventListener('change', handleFieldUpdate);
      container.addEventListener('input', handleFieldUpdate);

      if (chkContainer) {
        chkContainer.addEventListener('change', e => {
          if (e.target.getAttribute('data-action') === 'toggle-checklist-item') toggleChecklistItem(parseInt(e.target.getAttribute('data-idx'), 10));
        });
        chkContainer.addEventListener('click', e => {
          const btn = e.target.closest('[data-action="remove-checklist-item"]');
          if (btn) removeChecklistItem(parseInt(btn.getAttribute('data-idx'), 10));
        });
      }
    }

    function updateDayCardVisualStatus(dayIdx) {
      const d = tripData.days[dayIdx]; if (!d) return;
      const visual = getDayVisualClasses(d, d.date === getTodayIso()), hasLoc = Boolean((d.location || '').trim());
      const card = document.getElementById('day-card-' + dayIdx), hdr = document.getElementById('day-header-' + dayIdx);
      if (card) card.className = d.isCollapsed ? `day-card cursor-pointer border rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 transition-all duration-200 flex items-center justify-between text-xs sm:text-sm shadow-sm ${visual.cardClass}` : `day-card rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm dark:shadow-md ${visual.cardClass}`;
      if (hdr) hdr.className = `px-4 py-3 sm:px-5 sm:py-4 print-compact flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b ${visual.headerClass}`;

      const locBox = document.getElementById('loc-box-' + dayIdx);
      if (locBox) {
        locBox.className = getLocationBoxClasses(d);
        const mapsBtn = locBox.querySelector('[data-action="open-maps"]'), offMapsBtn = locBox.querySelector('[data-action="open-offline-maps"]');
        if (mapsBtn) mapsBtn.className = getLocationMapsIconClasses(d);
        if (offMapsBtn) offMapsBtn.className = `mr-2.5 shrink-0 transition no-print sm:hidden ${hasLoc ? 'text-emerald-600' : 'hidden'}`;
      }
      refreshDayHeaderCost(dayIdx); updateStats();
    }

    function refreshDayHeaderCost(dayIdx) {
      if (!tripData.days[dayIdx]) return;
      const d = document.getElementById('day-cost-display-' + dayIdx);
      if (d) d.innerText = formatEuro(getDayCostBreakdown(tripData.days[dayIdx]).total);
      updateStats();
    }

    function addListRow(dayIdx, key, def) {
      const d = tripData.days[dayIdx]; if (!d) return;
      (d[key] = d[key] || []).push(def);
      recordChangeForReminder(); saveToStorage(); renderDays();
    }

    function removeListRow(dayIdx, key, idx) {
      if (!tripData.days[dayIdx]?.[key]) return;
      tripData.days[dayIdx][key].splice(idx, 1);
      recordChangeForReminder(); saveToStorage(); renderDays();
    }

    function moveArrayItem(dayIdx, key, idx, dir) {
      const list = tripData.days[dayIdx]?.[key], target = idx + dir;
      if (!list || target < 0 || target >= list.length) return;
      const [it] = list.splice(idx, 1); list.splice(target, 0, it);
      recordChangeForReminder(); saveToStorage(); renderDays();
      showToast("Reihenfolge geändert");
    }

    // --- MOVE ITEM MODAL ---
    function openMoveItemModal(dayIdx, subList, itemIdx) {
      if ((tripData.days || []).length <= 1) return showToast("Mindestens 2 Tage erforderlich", true);
      const item = tripData.days[dayIdx]?.[subList]?.[itemIdx];
      if (!item) return;

      pendingMoveItem = { dayIndex: dayIdx, listKey: subList, itemIndex: itemIdx };
      const select = document.getElementById('moveItemTargetSelect'), pBtn = document.getElementById('moveItemPrevDayBtn'), nBtn = document.getElementById('moveItemNextDayBtn');
      document.getElementById('moveItemModalSubtitle').innerText = `Tag ${dayIdx + 1}: ${item.title || 'Eintrag'}`;

      if (pBtn) { const has = dayIdx > 0; pBtn.disabled = !has; pBtn.classList.toggle('opacity-40', !has); }
      if (nBtn) { const has = dayIdx < tripData.days.length - 1; nBtn.disabled = !has; nBtn.classList.toggle('opacity-40', !has); }

      select.innerHTML = '';
      tripData.days.forEach((d, i) => {
        if (i === dayIdx) return;
        const opt = new Option(`Tag ${i + 1} (${formatISODate(d.date).dayFormatted}) – ${d.location || 'Ohne Ort'}`, String(i));
        if (i === dayIdx + 1 || (dayIdx === tripData.days.length - 1 && i === dayIdx - 1)) opt.selected = true;
        select.add(opt);
      });
      toggleModal('moveItemModal', true);
    }

    function closeMoveItemModal() { toggleModal('moveItemModal', false); pendingMoveItem = null; }

    function confirmMoveItemToDay(mode) {
      if (!pendingMoveItem) return;
      const { dayIndex, listKey, itemIndex } = pendingMoveItem;
      const targetIdx = mode === 'prev' ? dayIndex - 1 : (mode === 'next' ? dayIndex + 1 : parseInt(document.getElementById('moveItemTargetSelect')?.value, 10));

      if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= tripData.days.length || targetIdx === dayIndex) return closeMoveItemModal();
      const [moved] = tripData.days[dayIndex][listKey].splice(itemIndex, 1);
      (tripData.days[targetIdx][listKey] = tripData.days[targetIdx][listKey] || []).push(moved);

      closeMoveItemModal(); recordChangeForReminder(); saveToStorage(); renderDays();
      showToast(`Auf Tag ${targetIdx + 1} verschoben`);
    }

    async function swapDayWithAdjacent(dayIdx, dir) {
      const target = dayIdx + dir, dA = tripData.days?.[dayIdx], dB = tripData.days?.[target];
      if (!dA || !dB) return;
      if (hasFixedLodging(dA) || hasFixedLodging(dB)) return showToast('Tage neben gebuchten oder reservierten Unterkünften können nicht getauscht werden.', true);
      const lbl = (d, i) => `Tag ${i + 1} (${(formatISODate(d.date).dayFormatted || '').slice(0, 5)}, ${(d.location || '').trim() || 'Ohne Ort'})`;
      if (!await showAppConfirm(`${lbl(dA, dayIdx)} und ${lbl(dB, target)} tauschen?\n\nDie Inhalte (Ort, Transport, Aktivitäten, Notizen, Anhänge) wechseln die Plätze, die Daten bleiben. Unterkünfte folgen weiterhin den Datumsangaben.`, { title: "Tage tauschen", confirmText: "Tauschen", variant: "amber", icon: "fa-right-left" })) return;
      await createRollingBackup();
      const [dtA, dtB] = [dA.date, dB.date];
      tripData.days[dayIdx] = Object.assign(dB, { date: dtA, isCollapsed: true });
      tripData.days[target] = Object.assign(dA, { date: dtB, isCollapsed: false });
      recordChangeForReminder(); saveToStorage(); renderDays(); renderAllAttachmentsOverview();
      showToast(`Tag ${dayIdx + 1} mit Tag ${target + 1} getauscht`);
    }

    function openDayActionModal(type, dayIdx) {
      pendingModalAction = { type, dayIndex: dayIdx };
      const day = tripData.days[dayIdx], setEl = (id, prop, v) => { const el = document.getElementById(id); if (el) el[prop] = v; };
      if (!day) return;
      document.getElementById('dayActionModalWarnings').classList.add('hidden');

      if (type === 'delete') {
        setEl('dayActionModalTitle', 'innerHTML', `<i class="fa-solid fa-trash-can text-rose-500"></i> Tag ${dayIdx + 1} leeren / entfernen`);
        setEl('dayActionModalDesc', 'innerHTML', `Datum: <b>${formatISODate(day.date).dayFormatted}</b>`);
        setEl('dayActionModalTitleA', 'innerText', "Modus A: Tag leeren & Datum behalten");
        setEl('dayActionModalDescA', 'innerText', "Inhalte leeren, Kalender unverändert lassen.");
        setEl('dayActionModalBtnA', 'innerHTML', `<i class="fa-solid fa-shield-halved"></i> Tag leeren (Modus A)`);
        setEl('dayActionModalBtnA', 'className', "w-full py-2 px-3 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5");
        setEl('dayActionModalTitleB', 'innerText', "Modus B: Reise verkürzen (-1 Tag)");
        setEl('dayActionModalDescB', 'innerText', "Tag vollständig entfernen, Folgetage rücken nach.");
        setEl('dayActionModalBtnB', 'innerHTML', `<i class="fa-solid fa-calendar-minus"></i> Tag löschen & kürzen (Modus B)`);
        setEl('dayActionModalBtnB', 'className', "w-full py-2 px-3 rounded-xl bg-rose-600 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5");
      } else {
        setEl('dayActionModalTitle', 'innerHTML', `<i class="fa-solid fa-calendar-plus text-indigo-500"></i> Tag einfügen`);
        setEl('dayActionModalDesc', 'innerHTML', `Neuer Tag nach Tag ${dayIdx + 1}.`);
        setEl('dayActionModalTitleA', 'innerText', "Reise verlängern (+1 Tag)");
        setEl('dayActionModalDescA', 'innerText', "Fügt einen Tag ein, Folgetage rücken nach hinten.");
        setEl('dayActionModalBtnA', 'innerHTML', `<i class="fa-solid fa-calendar-plus"></i> Tag einfügen (+1 Tag)`);
        setEl('dayActionModalBtnA', 'className', "w-full py-2 px-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow flex items-center justify-center gap-1.5");
        setEl('dayActionModalTitleB', 'innerText', "Abbrechen");
        setEl('dayActionModalDescB', 'innerText', "Aktion abbrechen.");
        setEl('dayActionModalBtnB', 'innerHTML', `Abbrechen`);
        setEl('dayActionModalBtnB', 'className', "w-full py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs");
      }
      toggleModal('dayActionModal', true);
    }

    function closeDayActionModal() { toggleModal('dayActionModal', false); pendingModalAction = null; }

    async function executeDayAction(mode) {
      if (!pendingModalAction) return;
      const { type, dayIndex } = pendingModalAction;
      if (type === 'insert' && mode === 'A' && tripData.days.slice(dayIndex + 1).some(hasFixedLodging)) {
        closeDayActionModal();
        return showAppAlert('Ein Tag nach dieser Position hat eine gebuchte oder reservierte Unterkunft und kann nicht verschoben werden.', 'Unterkunft schützt Reisetag', 'danger');
      }
      if (type === 'delete' && mode === 'B' && tripData.days.slice(dayIndex).some(hasFixedLodging)) {
        closeDayActionModal();
        return showAppAlert('Dieser Tag oder ein Folgetag hat eine gebuchte oder reservierte Unterkunft und kann nicht verschoben werden.', 'Unterkunft schützt Reisetag', 'danger');
      }
      closeDayActionModal(); await createRollingBackup();

      if (type === 'delete') {
        const d = tripData.days[dayIndex];
        if (mode === 'A') {
          Object.assign(d, createEmptyDay(d.date, d.isCollapsed));
                    showToast(`Tag ${dayIndex + 1} geleert (Modus A)`);
        } else {
          tripData.days.splice(dayIndex, 1);
          for (let i = dayIndex; i < tripData.days.length; i++) tripData.days[i].date = addDaysISO(tripData.days[i].date, -1);
          if (tripData.endDate) { tripData.endDate = addDaysISO(tripData.endDate, -1); document.getElementById('endDate').value = tripData.endDate; }
                    showToast(`Tag ${dayIndex + 1} gelöscht (Modus B)`);
        }
      } else if (type === 'insert' && mode === 'A') {
        const cur = tripData.days[dayIndex];
        if (cur) {
          tripData.days.splice(dayIndex + 1, 0, createEmptyDay(addDaysISO(cur.date, 1), false));
          for (let i = dayIndex + 2; i < tripData.days.length; i++) tripData.days[i].date = addDaysISO(tripData.days[i].date, 1);
          if (tripData.endDate) { tripData.endDate = addDaysISO(tripData.endDate, 1); document.getElementById('endDate').value = tripData.endDate; }
          tripData.days.forEach((d, idx) => { if (idx !== dayIndex + 1) d.isCollapsed = true; });
          showToast(`Neuer Tag eingefügt`);
        }
      }
      normalizeDataModel(); recordChangeForReminder(); saveToStorage(); renderDays(); renderAllAttachmentsOverview();
    }

    // --- BUDGET & TOTALS ---
    function updateStats() {
      const days = tripData.days || [], nights = days.filter(isNightDay);
      const totalN = nights.length, booked = nights.filter(d => isDayLodgingSettled(d)).length;
      let grand = 0, grandPaid = 0, sLodg = 0, sTr = 0, sAct = 0;

      (tripData.lodgings || []).forEach(l => {
        const c = parseFlexibleNumber(l.totalPrice);
        sLodg += c; grand += c;
        if (['gebucht', 'bezahlt'].includes((l.status || '').toLowerCase())) grandPaid += c;
      });

      days.forEach(d => {
        if (!d) return;
        const b = getDayCostBreakdown(d);
        // Unterkunftskosten sind oben einmal als Gesamtpreis enthalten; die Tagesanteile
        // dienen der Tagesansicht und dürfen die Reisegesamtsumme nicht verdoppeln.
        grand += b.transport + b.activity;
        grandPaid += b.transportPaid + b.activityPaid;
        sTr += b.transport; sAct += b.activity;
      });

      const setT = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
      setT('statTotal', totalN); setT('statBooked', booked); setT('statOpen', totalN - booked);
      setT('statCostTotal', formatEuro(grand)); setT('statCostPaid', formatEuro(grandPaid));
      setT('statCostPending', formatEuro(grand - grandPaid));
      setT('statCostPerDay', formatEuro(days.length ? grand / days.length : 0));

      const pct = v => grand > 0 ? (v / grand * 100) : 0;
      const setBar = (bId, tId, sum, p) => {
        const b = document.getElementById(bId); if (b) b.style.width = p.toFixed(1) + '%';
        setT(tId, `${formatEuro(sum)} (${p.toFixed(0)}%)`);
      };
      setBar('barLodging', 'breakdownLodging', sLodg, pct(sLodg));
      setBar('barTransport', 'breakdownTransport', sTr, pct(sTr));
      setBar('barActivity', 'breakdownActivity', sAct, pct(sAct));

      updateTripCountdown();
    }

    async function createNewTrip() {
      if (tripData.days?.length > 0 && !await showAppConfirm("Neue Reise anlegen?", { title: "Neue Reise", variant: "amber" })) return;
      await createRollingBackup();
      tripData = { title: "", startDate: "", endDate: "", generalNotes: "", emergencyNotes: "", checklist: DEFAULT_CHECKLIST.map(t => ({ text: t, done: false })), lodgings: [], days: [] };
      activeFileHandle = null; resetBackupReminder(); saveToStorage(); updateFileStatus(null);
      ['tripTitle', 'startDate', 'endDate', 'generalNotes', 'emergencyNotesInput'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
      switchTab('plan'); document.getElementById('tripConfigSection')?.classList.remove('hidden');
      updateHeadline(); renderDays(); renderLodgingsTab(); renderChecklist(); renderAllAttachmentsOverview(); updateStats();
    }

    async function prepareForPrint() {
      if (!tripData.days?.length || prePrintCollapsedStates !== null) return;
      prePrintCollapsedStates = tripData.days.map(d => d.isCollapsed);
      tripData.days.forEach(d => { if (d) d.isCollapsed = false; });
      renderDays();
      await Promise.all(tripData.days.map((_, idx) => updateImagesDOM(idx)));
      autoResizeAllTextareas();
    }

    function restoreAfterPrint() {
      if (prePrintCollapsedStates === null) return;
      tripData.days.forEach((d, idx) => { if (d && prePrintCollapsedStates[idx] !== undefined) d.isCollapsed = prePrintCollapsedStates[idx]; });
      prePrintCollapsedStates = null; renderDays();
    }

    async function printTripPlan() { await prepareForPrint(); setTimeout(() => { autoResizeAllTextareas(); window.print(); }, 300); }
    window.addEventListener('beforeprint', prepareForPrint);
    window.addEventListener('afterprint', restoreAfterPrint);

    function escapeHtml(s) {
      return String(s || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
