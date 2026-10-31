// --- PACKLISTE ---
    const sortChecklist = () => tripData.checklist?.sort((a, b) => Number(Boolean(a?.done)) - Number(Boolean(b?.done)));

    function renderChecklist() {
      const c = document.getElementById('checklistContainer');
      if (!c) return;
      sortChecklist();
      const list = tripData.checklist || [], done = list.filter(i => i.done).length;
      document.getElementById('checklistProgress').innerText = `${done}/${list.length} erledigt`;
      document.getElementById('resetChecklistBtn')?.classList.toggle('hidden', done === 0);

      c.innerHTML = list.map((item, idx) => `
        <div class="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/60 text-xs transition">
          <label class="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden">
            <input type="checkbox" ${item.done ? 'checked' : ''} data-action="toggle-checklist-item" data-idx="${idx}" class="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 shrink-0">
            <span class="truncate ${item.done ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}">${escapeHtml(item.text)}</span>
          </label>
          <button data-action="remove-checklist-item" data-idx="${idx}" class="text-rose-400 hover:text-rose-600 px-1 text-xs shrink-0 no-print">&times;</button>
        </div>`).join('');
    }

    function toggleChecklistItem(idx) {
      if (tripData.checklist?.[idx]) {
        tripData.checklist[idx].done = !tripData.checklist[idx].done;
        recordChangeForReminder(); saveToStorage(); renderChecklist();
      }
    }

    function resetChecklistDone() {
      (tripData.checklist || []).forEach(i => { if (i) i.done = false; });
      recordChangeForReminder(); saveToStorage(); renderChecklist();
      showToast("Packliste zurückgesetzt");
    }

    function addChecklistItem() {
      const input = document.getElementById('newChecklistItemInput');
      if (!input?.value.trim()) return;
      (tripData.checklist = tripData.checklist || []).push({ text: input.value.trim(), done: false });
      input.value = ''; recordChangeForReminder(); saveToStorage(); renderChecklist();
    }

    function removeChecklistItem(idx) {
      if (tripData.checklist) { tripData.checklist.splice(idx, 1); recordChangeForReminder(); saveToStorage(); renderChecklist(); }
    }

    function updateTripCountdown() {
      const badge = document.getElementById('tripCountdownBadge');
      if (!badge) return;
      const s = document.getElementById('startDate')?.value || tripData.startDate, e = document.getElementById('endDate')?.value || tripData.endDate;
      const pN = parseISOParts(getTodayIso()), pS = parseISOParts(s), pE = parseISOParts(e);
      if (!pN || !pS || !pE) return badge.classList.add('hidden');

      const tN = Date.UTC(pN.y, pN.m - 1, pN.d), tS = Date.UTC(pS.y, pS.m - 1, pS.d), tE = Date.UTC(pE.y, pE.m - 1, pE.d);
      if (tN < tS) {
        badge.innerHTML = `<i class="fa-solid fa-plane-departure text-indigo-500"></i> Noch ${Math.ceil((tS - tN) / 86400000)} Tage bis zum Start`;
        badge.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/80 dark:text-indigo-300 dark:border-indigo-700/80";
      } else if (tN <= tE) {
        badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Reisetag ${Math.floor((tN - tS) / 86400000) + 1} von ${Math.floor((tE - tS) / 86400000) + 1} (Heute)`;
        badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/80";
      } else {
        badge.innerHTML = '<i class="fa-solid fa-flag-checkered text-slate-400"></i> Reise beendet';
        badge.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
      }
      badge.classList.remove('hidden');
    }

    function jumpToToday() {
      if (currentTab !== 'plan') switchTab('plan');
      const today = getTodayIso(), idx = (tripData.days || []).findIndex(d => d.date === today);
      if (idx === -1) return showToast(`Heute (${today}) liegt nicht im Reisezeitraum`, true);
      if (currentFilter !== 'all' || searchQuery !== '') { setFilter('all'); clearSearch(); }
      openOnlyDay(idx);
      setTimeout(() => {
        const el = document.getElementById('day-card-' + idx);
        if (el) {
          scrollDayCardIntoView(idx);
          el.classList.add('ring-4', 'ring-indigo-400');
          setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400'), 2000);
          showToast(`Zu Tag ${idx + 1} gesprungen`);
        }
      }, 100);
    }
