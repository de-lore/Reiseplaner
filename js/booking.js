// --- PDF-IMPORT & BOOKING-PARSER (v1.96) ---
    const BK_MONTHS = { jan: 1, feb: 2, 'mär': 3, mar: 3, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
    const bkMonth = (s) => s ? (BK_MONTHS[String(s).toLowerCase().substring(0, 3)] || null) : null;
    const bkPad = (n) => String(n).padStart(2, '0');

    // Preis-String (z. B. "1.231,20", "33", "1,234.50") -> "1231,20" im deutschen Format mit 2 Nachkommastellen
    function bkFormatPrice(raw) {
      let s = String(raw || '').replace(/[^0-9.,]/g, '');
      if (!s) return '';
      const m = s.match(/[.,](\d{1,2})$/);
      let intPart = s, dec = '00';
      if (m) { intPart = s.slice(0, s.length - m[0].length); dec = m[1].padEnd(2, '0'); }
      intPart = intPart.replace(/[.,]/g, '');
      return intPart ? `${intPart},${dec}` : '';
    }

    // Jahr für Datumsangaben ohne Jahr ableiten (Stornodatum > Reisebeginn > heutiges Datum)
    function bkInferYear(day, month, ctx = {}) {
      const mk = (y) => Date.UTC(y, month - 1, day);
      if (ctx.anchorISO) {
        const a = ctx.anchorISO.split('-').map(Number), aT = Date.UTC(a[0], a[1] - 1, a[2]);
        let y = a[0]; if (mk(y) < aT) y++;
        return y;
      }
      if (ctx.tripStart) {
        const p = ctx.tripStart.split('-').map(Number), sT = Date.UTC(p[0], p[1] - 1, p[2]);
        let best = p[0], bestDiff = Infinity;
        for (let y = p[0] - 1; y <= p[0] + 1; y++) { const d = Math.abs(mk(y) - sT); if (d < bestDiff) { bestDiff = d; best = y; } }
        return best;
      }
      const now = new Date(); let y = now.getFullYear();
      if (mk(y) < now.getTime() - 30 * 86400000) y++;
      return y;
    }

    // Text-Items (mit Koordinaten) -> Zeilen; große Lücken werden mit Tab getrennt
    function bkBuildLines(items) {
      const sorted = items.filter(i => i.str && i.str.trim()).slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
      const rows = [];
      for (const it of sorted) {
        const row = rows.find(r => Math.abs(r.y - it.y) <= 2.5);
        if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
      }
      rows.sort((a, b) => b.y - a.y);
      return rows.map(r => {
        r.items.sort((a, b) => a.x - b.x);
        let out = '', prevEnd = null;
        for (const it of r.items) {
          const gap = prevEnd === null ? 0 : it.x - prevEnd;
          if (prevEnd !== null) out += gap > 14 ? '\t' : ' ';
          out += it.str.trim();
          prevEnd = it.x + (it.w || 0);
        }
        return out;
      });
    }

    // Booking.com-Layout: Spalten ANREISE/ABREISE und linker Kopfblock anhand der Koordinaten
    function bkParseGeometry(items, ctx = {}) {
      const find = (re) => items.find(i => re.test(i.str.trim()));
      const a = find(/^(ANREISE|CHECK-?IN|ARRIVAL)$/i), b = find(/^(ABREISE|CHECK-?OUT|DEPARTURE)$/i);
      if (!a || !b) return null;
      const cx = (i) => i.x + (i.w || 0) / 2;
      const D = Math.abs(cx(b) - cx(a)) || 80;
      const column = (lab) => bkBuildLines(items.filter(i => i !== lab && i.y < lab.y - 1 && i.y > lab.y - D * 1.4 && Math.abs(cx(i) - cx(lab)) < D * 0.42));
      const parseCell = (lines) => {
        const day = (lines[0] || '').match(/^\d{1,2}$/);
        const text = lines.join(' ');
        const month = (text.match(/[A-Za-zäöüÄÖÜ]{3,}/g) || []).map(bkMonth).find(Boolean);
        const times = text.match(/\d{1,2}:\d{2}/g) || [];
        return day && month ? { day: +day[0], month, times, until: /\bbis\b|\buntil\b/i.test(text) } : null;
      };
      const cIn = parseCell(column(a)), cOut = parseCell(column(b));
      const out = { in: cIn, out: cOut };

      const pLabel = find(/^PREIS$/i);
      const leftItems = items.filter(i => (i.x + (i.w || 0)) <= Math.min(a.x, b.x) - 5 && i.y <= a.y + 12 && (!pLabel || i.y > pLabel.y + 2));
      const left = bkBuildLines(leftItems).map(l => l.replace(/\t/g, ' '));
      const addrIdx = left.findIndex(l => /^(Adresse|Address)\s*:/i.test(l));
      if (addrIdx > 0) {
        out.name = left.slice(0, addrIdx).join(' ').replace(/\s+/g, ' ').trim();
        const endIdx = left.findIndex((l, i) => i > addrIdx && /^(Telefon|Phone|GPS)/i.test(l));
        const addrLines = left.slice(addrIdx, endIdx === -1 ? left.length : endIdx);
        out.addressRaw = addrLines.join(' ').replace(/^(Adresse|Address)\s*:\s*/i, '').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim();
        const ph = left.find(l => /^(Telefon|Phone)\s*:/i.test(l));
        if (ph) out.phone = ph.replace(/^(Telefon|Phone)\s*:\s*/i, '').trim();
      }
      return out;
    }


    // Uhrzeiten aus der Anreise-/Abreisespalte lesbar formatieren
    function bkFormatTimes(c) {
      const tm = c.times || [];
      if (!tm.length) return '';
      if (c.until) return `bis ${tm[0]}`;
      if (tm.length === 1) return tm[0];
      if (tm[0] === tm[1]) return tm[0] === '00:00' ? 'ganztägig' : tm[0];
      return `${tm[0]}–${tm[1]}`;
    }

    // Fallback ohne Koordinaten: Spalten ANREISE/ABREISE aus tab-getrennten Textzeilen lesen
    function bkParseDatesFromLines(lines) {
      const segs = (l) => l.split('\t').map(s => s.trim()).filter(Boolean);
      const hi = lines.findIndex(l => { const s = segs(l); return s.length >= 2 && /^(ANREISE|CHECK-?IN|ARRIVAL)$/i.test(s[0]) && /^(ABREISE|CHECK-?OUT|DEPARTURE)$/i.test(s[1]); });
      if (hi === -1) return null;
      const win = lines.slice(hi + 1, hi + 12).map(segs);
      const dayRow = win.find(s => s.length >= 2 && /^\d{1,2}$/.test(s[0]) && /^\d{1,2}$/.test(s[1]));
      const monRow = win.find(s => s.length >= 2 && bkMonth(s[0]) && bkMonth(s[1]));
      const timeRow = win.find(s => s.length >= 2 && /\d{1,2}:\d{2}/.test(s[0]) && /\d{1,2}:\d{2}/.test(s[1]));
      if (!dayRow || !monRow) return null;
      const t = (x) => x ? (x.match(/\d{1,2}:\d{2}/g) || []) : [];
      const tr = timeRow;
      return { in: { day: +dayRow[0], month: bkMonth(monRow[0]), times: t(tr?.[0]), until: /\bbis\b/i.test(tr?.[0] || '') }, out: { day: +dayRow[1], month: bkMonth(monRow[1]), times: t(tr?.[1]), until: /\bbis\b/i.test(tr?.[1] || '') } };
    }

    // Adresse bereinigen (doppelte Teile entfernen) und Ort ableiten
    function bkCleanAddress(raw) {
      const parts = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!parts.length) return { address: '', city: '' };
      const seen = new Set(), uniq = [];
      for (const p of parts) { const k = p.toLowerCase(); if (!seen.has(k)) { seen.add(k); uniq.push(p); } }
      const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]/g, '');
      const country = norm(parts[parts.length - 1]);
      // Kandidaten: Teile ohne Land und ohne reine Zahlen; führende Postleitzahl abschneiden
      const cands = [];
      for (const p of parts) {
        if (norm(p) === country) continue;
        const stripped = p.replace(/^\d[\d\s-]*\s+(?=\D)/, '').trim();
        if (!stripped || /\d/.test(stripped)) continue;
        cands.push({ text: stripped, key: norm(stripped), hadZip: stripped !== p });
      }
      let city = '', best = 1;
      for (const c of cands) {
        if (!c.key) continue;
        const score = cands.filter(o => o.key.includes(c.key)).length;
        if (score > best || (score === best && city && score > 1 && c.key.length < norm(city).length)) { best = score; city = c.text; }
      }
      if (!city) { const z = cands.find(c => c.hadZip); if (z) city = z.text; }
      return { address: uniq.join(', '), city };
    }

    // Zentrale Parse-Funktion: Text (Zeilen) + optionale Geometrie -> { res, notes }
    function bkParseBooking(text, geo, ctx = {}) {
      const res = {}, notes = [];
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const segs = (l) => l.split('\t').map(s => s.trim()).filter(Boolean);
      const fullDateRx = /(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ]{3,9})\.?\s+(20\d{2})(?:\D{1,3}(\d{1,2}):(\d{2}))?/;

      // Stornofrist: erste Zeile "bis <Datum> <Uhrzeit>: <Währung> 0"
      let cancelAnchor = null;
      const zeroFee = text.match(/bis\s+(\d{1,2})\.?\s+([A-Za-zäöüÄÖÜ]{3,9})\.?\s+(20\d{2})\s+(\d{1,2}):(\d{2})\s*:\s*(?:[A-Z]{3}|[A-Z]{0,2}\$|€)?\s*0(?:[.,]0+)?(?!\d)/i);
      if (zeroFee && bkMonth(zeroFee[2])) {
        cancelAnchor = `${zeroFee[3]}-${bkPad(bkMonth(zeroFee[2]))}-${bkPad(zeroFee[1])}`;
        res.freeCancel = `${cancelAnchor}T${bkPad(zeroFee[4])}:${zeroFee[5]}`;
      } else {
        const gen = text.match(/(?:kostenlos(?:e|en)?\s+stornier(?:ung|bar)|stornieren\s+bis|free\s+cancellation\s+until)[:\s]*([^\n]+)/i);
        const gm = gen && gen[1].match(fullDateRx);
        if (gm && bkMonth(gm[2])) {
          cancelAnchor = `${gm[3]}-${bkPad(bkMonth(gm[2]))}-${bkPad(gm[1])}`;
          res.freeCancel = `${cancelAnchor}T${gm[4] ? bkPad(gm[4]) + ':' + gm[5] : '23:59'}`;
        } else if (/Stornierungsgeb(?:ü|u)hren|Nicht erstattungsf(?:ä|a)hig|non-?refundable/i.test(text)) {
          notes.push('Nicht kostenlos stornierbar');
        }
      }
      const ictx = Object.assign({}, ctx, { anchorISO: cancelAnchor });

      // Datum: zuerst Geometrie (Booking-Spalten), sonst Textzeilen mit vollem Datum
      const dates = (geo && geo.in && geo.out) ? geo : bkParseDatesFromLines(lines);
      if (dates && dates.in && dates.out) {
        const yIn = bkInferYear(dates.in.day, dates.in.month, ictx);
        res.checkIn = `${yIn}-${bkPad(dates.in.month)}-${bkPad(dates.in.day)}`;
        let yOut = yIn; if (Date.UTC(yOut, dates.out.month - 1, dates.out.day) < Date.UTC(yIn, dates.in.month - 1, dates.in.day)) yOut++;
        res.checkOut = `${yOut}-${bkPad(dates.out.month)}-${bkPad(dates.out.day)}`;
        if (bkFormatTimes(dates.in)) notes.push(`Check-in ${bkFormatTimes(dates.in)}`);
        if (bkFormatTimes(dates.out)) notes.push(`Check-out ${bkFormatTimes(dates.out)}`);
      }

      // Name & Adresse aus Geometrie
      if (geo?.name) res.name = geo.name;
      if (geo?.addressRaw) {
        const ca = bkCleanAddress(geo.addressRaw);
        if (ca.address) res.address = ca.address;
        if (ca.city) res.location = ca.city;
      }
      if (!res.address) {
        const al = lines.map(l => segs(l)[0] || '').find(l => /^(Adresse|Address)\s*:/i.test(l));
        if (al) { const ca = bkCleanAddress(al.replace(/^(Adresse|Address)\s*:\s*/i, '')); if (ca.address) res.address = ca.address; if (ca.city && !res.location) res.location = ca.city; }
      }

      // Buchungsnummer & PIN
      const nr = text.match(/(?:BUCHUNGSNUMMER|Buchungsnummer|Confirmation\s*number|Booking\s*(?:number|id))\s*:?\s*(\d{3,}(?:[.\s-]\d{3,}){1,3}|[A-Z0-9]{6,})/i);
      const pin = text.match(/PIN(?:[- ]?CODE)?\s*:?\s*(\d{3,8})/i);
      if (nr) notes.unshift(`Buchungs-Nr.: ${nr[1].trim()}${pin ? ` (PIN ${pin[1]})` : ''}`);

      // Zimmer & Gäste
      const gi = lines.findIndex(l => /^Name des Gastes\s*:|^Guest name\s*:/i.test(segs(l)[0] || ''));
      let roomLine = '';
      for (let k = 1; k <= 3 && gi - k >= 0 && !roomLine; k++) {
        const cand = segs(lines[gi - k])[0] || '';
        if (cand && !/:\s*$/.test(cand) && cand.length < 70) roomLine = cand;
      }
      const guests = text.match(/Anzahl der G(?:ä|a)ste\s*:\s*([^\t\n]+)/i);
      const roomBits = [];
      if (roomLine && roomLine.length < 70) roomBits.push(roomLine);
      if (guests) roomBits.push(guests[1].trim());
      if (roomBits.length) notes.push(`Zimmer: ${roomBits.join(', ')}`);

      // Verpflegung
      if (/Fr(?:ü|u)hst(?:ü|u)ck\s+(?:ist\s+)?(?:im\s+Endpreis\s+)?(?:inbegriffen|inklusive|enthalten)|breakfast\s+(?:is\s+)?included/i.test(text)) notes.push('Frühstück inklusive');

      // Preis: Zeile "Preis ... ca. € 33" (EUR) + Originalwährung in der Folgezeile
      let priceFound = false;
      const pi = lines.findIndex(l => /^(?:Preis|Price)(?:\s|\t)/.test(l) && /(?:€|EUR)\s*[\d]|[\d]\s*(?:€|EUR)/.test(l));
      if (pi !== -1) {
        const cur = [lines[pi], lines[pi + 1] || '', lines[pi + 2] || ''];
        const eur = cur[0].match(/(?:€|EUR)\s*(\d+(?:[.,]\d+)*)|(\d+(?:[.,]\d+)*)\s*(?:€|EUR)/);
        if (eur) { res.price = bkFormatPrice(eur[1] || eur[2]); priceFound = true; if (/\bca\.?(?=\s)/i.test(cur[0])) notes.push('Preis in € ist ein ca.-Wert (Umrechnung)'); }
        const foreign = (cur[0] + ' ' + cur[1]).match(/(?:\b(THB|USD|GBP|CHF|JPY|VND|IDR|MYR|SGD|LAK|KHR)|(US\$|A\$|C\$))\s*(\d+(?:[.,]\d+)*)/);
        if (foreign) notes.push(`Originalpreis: ${foreign[1] || (foreign[2] === 'US$' ? 'USD' : foreign[2])} ${foreign[3]}`);
      }
      if (!priceFound) {
        const priceText = lines.filter(l => !/storn|geb(?:ü|u)hr|kaution|deposit|fee|cancel|steuer|tax|mehrwert/i.test(l) && !/(?:^|\t)(?:ab|bis|from|until)\s+\d/i.test(l)).join('\n');
        const pm = priceText.match(/(?:gesamtpreis|total|betrag|summe|preis)[:\s\t]*(?:ca\.?\s*)?(?:€|EUR)\s*(\d+(?:[.,]\d+)*)/i) || priceText.match(/(?:ca\.?\s*)?(?:€|EUR)\s*(\d+(?:[.,]\d+)*)/i);
        if (pm) res.price = bkFormatPrice(pm[1]);
      }

      // Zahlung: Vorauszahlung / Zahlung vor Ort in Fremdwährung
      if (/Sie entrichten als Vorauszahlung/i.test(text)) notes.push('Vorauszahlung 24 h vor Anreise (Gesamtpreis)');
      const payCur = text.match(/Sie bezahlen die Unterkunft[^\n]*? in ([A-Z]{3}) gem(?:ä|a)(?:ß|ss)/i);
      if (payCur) notes.push(`Zahlung vor Ort in ${payCur[1]}`);

      // Kaution
      const dep = text.match(/(?:Schadenskaution|Kaution|damage deposit)[^.\n]*?([A-Z]{3}|€)\s*(\d+(?:[.,]\d+)*)/i);
      if (dep) {
        const approx = text.match(/ungef(?:ä|a)hr\s+(EUR|€)\s*(\d+(?:[.,]\d+)*)/i);
        notes.push(`Kaution bei Ankunft: ${dep[1]} ${dep[2]}${approx ? ` (ca. € ${approx[2]})` : ''}, bar`);
      }

      if (geo?.phone) notes.push(`Tel.: ${geo.phone}`);
      return { res, notes };
    }

    // Ursprünglicher generischer Textparser (v1.95), jetzt als reine Funktion
    function bkLegacyParse(text) {
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      const res = {};

      // 1. Check-In & Check-Out Datums-Erkennung (z. B. 24.01.2027, 2027-01-24 oder 24. Jan 2027)
      const months = {
        jan: '01', feb: '02', mär: '03', mar: '03', apr: '04', mai: '05', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', okt: '10', oct: '10', nov: '11', dez: '12', dec: '12'
      };

      const parseDateString = (str) => {
        if (!str) return null;
        const isoMatch = str.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        const deMatch = str.match(/\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(20\d{2})\b/);
        if (deMatch) return `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`;
        const wordMatch = str.match(/\b(0?[1-9]|[12]\d|3[01])\.?\s+([A-Za-zäöüÄÖÜ]{3,9})\s+(20\d{2})\b/);
        if (wordMatch) {
          const mKey = wordMatch[2].toLowerCase().substring(0, 3);
          if (months[mKey]) return `${wordMatch[3]}-${months[mKey]}-${wordMatch[1].padStart(2, '0')}`;
        }
        return null;
      };

      // Suche nach expliziten Check-in/Check-out Zeilen
      for (const line of lines) {
        if (!res.checkIn && /check[- ]?in|anreise|ankunft|arrival/i.test(line)) {
          const d = parseDateString(line);
          if (d) res.checkIn = d;
        }
        if (!res.checkOut && /check[- ]?out|abreise|abfahrt|departure/i.test(line)) {
          const d = parseDateString(line);
          if (d) res.checkOut = d;
        }
      }

      // Fallback: Erste zwei gefundene Datumsangaben im Gesamttext
      if (!res.checkIn || !res.checkOut) {
        const allDateMatches = [];
        const dateText = lines.filter(l => !/storn|cancel|geb(?:ü|u)hr|fee|kaution|deposit|gedruckt|printed/i.test(l)).join('\n');
        const rx = /\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(20\d{2})\b|\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/g;
        let m;
        while ((m = rx.exec(dateText)) !== null) {
          const parsed = parseDateString(m[0]);
          if (parsed && !allDateMatches.includes(parsed)) allDateMatches.push(parsed);
        }
        if (!res.checkIn && allDateMatches[0]) res.checkIn = allDateMatches[0];
        if (!res.checkOut && allDateMatches[1]) res.checkOut = allDateMatches[1];
      }

      // 2. Preis-Erkennung (z. B. 125,50 €, EUR 140, 89.00 EUR)
      const priceMatch = text.match(/(?:preis|gesamtpreis|total|betrag|summe)?[:\s]*([0-9]+[0-9.,]*)\s*(?:€|eur|euro)\b/i) ||
                         text.match(/(?:€|eur|euro)\s*([0-9]+[0-9.,]*)/i);
      if (priceMatch) {
        res.price = priceMatch[1].trim();
      }

      // 3. Stornofrist-Erkennung (Kostenlos stornierbar bis ...)
      const cancelMatch = text.match(/(?:kostenlos(?:e|en)?\s+stornier(?:ung|bar)|stornieren\s+bis|free\s+cancellation\s+until)[:\s]*([^\n.]+)/i);
      if (cancelMatch) {
        const cDate = parseDateString(cancelMatch[1]);
        if (cDate) {
          const timeMatch = cancelMatch[1].match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
          const timeStr = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '23:59';
          res.freeCancel = `${cDate}T${timeStr}`;
        }
      }

      // 4. Hotelname & Ort
      for (const line of lines) {
        if (!res.name && /^(hotel|resort|villa|hostel|guesthouse|bungalows?|palace|boutique)\b/i.test(line)) {
          res.name = line;
        } else if (!res.name && /(hotel|resort|villa|hostel|guesthouse|bungalows?|palace|boutique)\b/i.test(line) && line.length < 60) {
          res.name = line.replace(/^(unterkunft|ihre unterkunft|hotelname)[:\s-]*/i, '').trim();
        }
        if (!res.location && /\b(?:ort|region|stadt|location|city)\s*:\s*([^\n,]+)/i.test(line)) {
          const locMatch = line.match(/\b(?:ort|region|stadt|location|city)\s*:\s*([^\n,]+)/i);
          if (locMatch) res.location = locMatch[1].trim();
        }
      }

      // Fallback: Zeile 1 als Name, falls typische Bestätigungs-Kopfzeile
      if (!res.name && lines[0] && lines[0].length < 60 && !/buchung|bestätigung|vielen dank/i.test(lines[0])) {
        res.name = lines[0];
      }

      // 5. Buchungsnummer & Notizen
      const bookingNrMatch = text.match(/(?:buchungsnummer|booking\s*(?:id|number|nr)|pin)[:\s]*([A-Z0-9.-]+)/i);
      const notesArr = [];
      if (bookingNrMatch) notesArr.push(`Buchungs-Nr.: ${bookingNrMatch[1]}`);
      if (/frühstück\s+(?:inbegriffen|inklusive|enthalten)|breakfast\s+included/i.test(text)) {
        notesArr.push('Frühstück inklusive');
      }
      return { res, notes: notesArr };
    }

    // Erkannte Daten zunächst prüfen lassen, bevor sie Unterkunftsfelder ändern.
    let pendingBookingImport = null;
    const bookingPreviewFields = [
      ['name', 'Unterkunft'], ['location', 'Ort'], ['checkIn', 'Anreise'], ['checkOut', 'Abreise'],
      ['price', 'Gesamtpreis'], ['freeCancel', 'Kostenlose Stornierung bis'], ['address', 'Adresse']
    ];

    function showBookingImportPreview(res, notes, sourceLabel) {
      const preview = document.getElementById('bookingImportPreview');
      const list = document.getElementById('bookingImportPreviewList');
      if (!preview || !list) return;
      pendingBookingImport = { res, notes };
      list.replaceChildren();
      const detected = bookingPreviewFields.filter(([key]) => String(res[key] || '').trim());
      for (const [key, label] of bookingPreviewFields) {
        const li = document.createElement('li');
        li.className = 'flex gap-2';
        const value = String(res[key] || '').trim();
        const shown = key === 'freeCancel' && value ? toDateTimeLocalValue(value).replace('T', ' ') : value;
        li.textContent = `${value ? '✓' : '–'} ${label}: ${shown || 'nicht erkannt'}`;
        list.appendChild(li);
      }
      if (notes.length) {
        const li = document.createElement('li');
        li.textContent = `Hinweise: ${notes.join(' · ')}`;
        list.appendChild(li);
      }
      preview.classList.remove('hidden');
      preview.dataset.source = sourceLabel || 'Buchungstext';
      const source = document.getElementById('bookingImportSource');
      if (source) source.textContent = `Quelle: ${sourceLabel || 'Buchungstext'}`;
      if (!detected.length) showToast('Es wurden keine passenden Buchungsfelder erkannt', true);
      preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function cancelBookingImportPreview() {
      pendingBookingImport = null;
      document.getElementById('bookingImportPreview')?.classList.add('hidden');
    }

    function applyBookingValues(res, notes) {
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) { el.value = v; return 1; } return 0; };
      let applied = 0;
      applied += setVal('modalLodgingName', res.name);
      applied += setVal('modalLodgingLocation', res.location);
      applied += setVal('modalLodgingCheckIn', res.checkIn);
      applied += setVal('modalLodgingCheckOut', res.checkOut);
      applied += setVal('modalLodgingPrice', res.price);
      applied += setVal('modalLodgingFreeCancel', toDateTimeLocalValue(res.freeCancel));
      applied += setVal('modalLodgingAddress', res.address);
      updateCancelBar();

      const notesEl = document.getElementById('modalLodgingNotes');
      if (notesEl && notes.length) {
        const cur = notesEl.value.trim();
        const fresh = notes.filter(n => !cur.includes(n));
        if (fresh.length) {
          notesEl.value = cur ? `${cur} | ${fresh.join(' | ')}` : fresh.join(' | ');
          applied++;
        }
      }
      updateModalNightsCalc();
      return applied;
    }

    function confirmBookingImportPreview() {
      if (!pendingBookingImport) return;
      const { res, notes } = pendingBookingImport;
      const applied = applyBookingValues(res, notes);
      cancelBookingImportPreview();
      if (applied > 0) showToast(`${applied} erkannte Felder übernommen – bitte vor dem Speichern prüfen`);
      else showToast('Es wurden keine passenden Felder erkannt', true);
    }

    function applyBookingParse(text, geo, sourceLabel = 'Buchungstext') {
      const legacy = bkLegacyParse(text);
      const bk = bkParseBooking(text, geo, { tripStart: (typeof tripData !== 'undefined' && tripData?.startDate) || '' });
      const res = Object.assign({}, legacy.res, bk.res);
      const notes = bk.notes.slice();
      for (const n of legacy.notes) {
        const key = n.startsWith('Buchungs-Nr') ? 'Buchungs-Nr' : (n.startsWith('Frühstück') ? 'Frühstück' : null);
        if (!key || !notes.some(x => x.startsWith(key))) notes.push(n);
      }
      showBookingImportPreview(res, notes, sourceLabel);
      return Object.values(res).some(v => String(v || '').trim()) ? 1 : 0;
    }

    // Manueller Button: Text aus dem Textfeld analysieren (nutzt Koordinaten, falls Text unverändert aus dem PDF stammt)
    function parseBookingTextFromInput() {
      const text = document.getElementById('autoFillBookingInput')?.value || '';
      if (!text.trim()) {
        return showAppAlert("Bitte importiere zuerst ein PDF oder füge den Text deiner Buchung in das Textfeld ein.", "Keine Daten vorhanden");
      }
      const geo = (lastBookingPdf && lastBookingPdf.text === text) ? lastBookingPdf.geo : null;
      applyBookingParse(text, geo, lastBookingPdf && lastBookingPdf.text === text ? 'PDF' : 'Buchungstext');
    }

    // --- PDF.js (lokal gebündelt und vom Service Worker mitgespeichert) ---
    const PDFJS_VERSION = '3.11.174';
    const PDFJS_BASE = `vendor/pdfjs/`;
    let pdfJsLoadPromise = null, lastBookingPdf = null;

    function loadPdfJs() {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pdfJsLoadPromise) return pdfJsLoadPromise;
      pdfJsLoadPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PDFJS_BASE + 'pdf.min.js';
        s.onload = () => {
          if (!window.pdfjsLib) return reject(new Error('PDF.js nicht verfügbar'));
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
          resolve(window.pdfjsLib);
        };
        s.onerror = () => reject(new Error('PDF.js konnte nicht geladen werden'));
        document.head.appendChild(s);
      }).catch(err => { pdfJsLoadPromise = null; throw err; });
      return pdfJsLoadPromise;
    }

    async function importBookingPdf(file) {
      if (!file) return;
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        return showAppAlert("Bitte eine PDF-Datei auswählen.", "Falsches Dateiformat");
      }
      const btn = document.getElementById('bookingPdfBtn');
      const btnHtml = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Lese PDF…'; }
      try {
        const pdfjs = await loadPdfJs();
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const allLines = []; let firstItems = null;
        for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
          const tc = await (await pdf.getPage(p)).getTextContent();
          const items = tc.items.filter(i => typeof i.str === 'string').map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: i.height }));
          if (p === 1) firstItems = items;
          allLines.push(...bkBuildLines(items));
        }
        const text = allLines.join('\n');
        if (text.trim().length < 20) {
          return showAppAlert("In diesem PDF wurde kein lesbarer Text gefunden (evtl. ein Scan oder Bild). Bitte das PDF direkt aus Booking.com speichern oder den Text manuell einfügen.", "Kein Text erkannt");
        }
        const geo = bkParseGeometry(firstItems || [], {});
        document.getElementById('autoFillBookingInput').value = text;
        lastBookingPdf = { text, geo };
        applyBookingParse(text, geo, `PDF: ${file.name}`);
      } catch (err) {
        console.error('[PDF-Import]', err);
        showAppAlert(`Das PDF konnte nicht gelesen werden: ${err.message || err}. Prüfe, ob die lokalen Dateien unter vendor/pdfjs vorhanden sind.`, "PDF-Import fehlgeschlagen");
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = btnHtml; }
      }
    }

    function handleBookingPdfSelect(ev) {
      const f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      importBookingPdf(f);
    }

    function handleBookingPdfDrop(ev) {
      ev.preventDefault();
      document.getElementById('autoFillBox')?.classList.remove('drop-active');
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) importBookingPdf(f);
    }
