// --- FILTER & AUSWERTUNGEN ---
    const isStatusFixed = s => ['gebucht', 'bezahlt', 'reserviert'].includes((s || '').toLowerCase());
    const isFlight = t => t?.category === 'flugzeug' || ['flug', 'flight', 'airline', 'airport'].some(k => (t?.title || '').toLowerCase().includes(k));

    function setFilter(f) {
      currentFilter = f;
      const sel = document.getElementById('filterSelect');
      if (sel) {
        sel.value = f;
        sel.className = f !== 'all'
          ? "bg-indigo-600 text-white border border-indigo-600 text-[11px] sm:text-xs rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 font-bold focus:outline-none cursor-pointer shadow-sm transition"
          : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 font-semibold focus:border-indigo-500 focus:outline-none cursor-pointer shadow-sm transition";
      }
      renderDays();
    }

    function handleSearch(v) {
      searchQuery = (v || '').trim().toLowerCase();
      document.getElementById('clearSearchBtn')?.classList.toggle('hidden', !searchQuery.length);
      renderDays();
    }

    function clearSearch() {
      const i = document.getElementById('searchInput'); if (i) i.value = '';
      searchQuery = ''; document.getElementById('clearSearchBtn')?.classList.add('hidden'); renderDays();
    }

    function getTransportEmoji(tr) {
      const map = { flugzeug: '✈️', zug: '🚆', bus: '🚌', boot: '🚤', mietwagen: '🚗', roller: '🛵', taxi: '🚕' };
      if (map[tr.category]) return map[tr.category];
      const t = (tr.title || '').toLowerCase();
      if (t.includes('flug')) return '✈️'; if (t.includes('roller') || t.includes('scooter')) return '🛵';
      if (t.includes('zug') || t.includes('bahn')) return '🚆'; if (t.includes('boot') || t.includes('fähre')) return '🚤';
      if (t.includes('bus')) return '🚌';
      return '🚗';
    }

    function getLodgingDailyShare(lodging, date) {
      if (!lodging || !isValidISODate(lodging.checkIn) || !isValidISODate(lodging.checkOut) || !isValidISODate(date)) return 0;
      const inParts = parseISOParts(lodging.checkIn), outParts = parseISOParts(lodging.checkOut), dayParts = parseISOParts(date);
      const start = Date.UTC(inParts.y, inParts.m - 1, inParts.d), end = Date.UTC(outParts.y, outParts.m - 1, outParts.d), day = Date.UTC(dayParts.y, dayParts.m - 1, dayParts.d);
      const nights = Math.round((end - start) / 86400000), offset = Math.round((day - start) / 86400000);
      if (nights <= 0 || offset < 0 || offset >= nights) return 0;
      const totalCents = Math.round(parseFlexibleNumber(lodging.totalPrice) * 100);
      if (totalCents <= 0) return 0;
      const baseCents = Math.floor(totalCents / nights), remainder = totalCents % nights;
      return (baseCents + (offset < remainder ? 1 : 0)) / 100;
    }

    function getDayCostBreakdown(d) {
      let transport = 0, transportPaid = 0, activity = 0, activityPaid = 0;
      const isPaid = s => ['bezahlt', 'gebucht'].includes((s || '').toLowerCase());
      (d?.transports || []).forEach(t => { const c = parseFlexibleNumber(t.cost); transport += c; if (isPaid(t.costStatus)) transportPaid += c; });
      (d?.activities || []).forEach(a => { const c = parseFlexibleNumber(a.cost); activity += c; if (isPaid(a.costStatus)) activityPaid += c; });
      const lodging = getLodgingForDay(d?.date), lodgingShare = getLodgingDailyShare(lodging, d?.date);
      const lodgingPaid = lodging && ['bezahlt', 'gebucht'].includes((lodging.status || '').toLowerCase()) ? lodgingShare : 0;
      return { total: lodgingShare + transport + activity, paid: lodgingPaid + transportPaid + activityPaid, lodging: lodgingShare, lodgingPaid, transport, transportPaid, activity, activityPaid };
    }

    const formatEuro = n => (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

    function getStatusBadgeClass(s) {
      const st = (s || '').toLowerCase();
      if (['bezahlt', 'gebucht'].includes(st)) return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-400 dark:border-emerald-700/80';
      if (st === 'reserviert') return 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-400 dark:border-sky-700/80';
      return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-400 dark:border-amber-700/80';
    }

    function autoResizeTextarea(el) { if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 32) + 'px'; } }
    function autoResizeAllTextareas() {
      requestAnimationFrame(() => document.querySelectorAll('textarea.auto-hint').forEach(ta => { if (ta.offsetParent !== null) autoResizeTextarea(ta); }));
    }

    function collectMediaIdsFromTrips(trips = []) {
      const ids = new Set();
      for (const trip of trips) for (const day of (trip?.days || [])) {
        for (const item of (day?.images || [])) if (item?.id) ids.add(item.id);
      }
      return ids;
    }
