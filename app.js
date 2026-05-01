// FINANCIA — Personal Finance Dashboard
// Fully independent per-month data — backed by FastAPI + SQLite
(function () {
    'use strict';
    const API_BASE = '/api';
    const CIRC = 2 * Math.PI * 80;
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const DEBT_CATS = ['EMI', 'Personal Loan', 'Credit Card', 'Loan for Others', 'Other'];

    let currentMonth = getMonthKey(new Date());
    function getMonthKey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    function parseMonthKey(k) { const [y, m] = k.split('-').map(Number); return { year: y, month: m - 1 }; }
    function formatMonthLabel(k) { const { year, month } = parseMonthKey(k); return MONTHS[month] + ' ' + year; }
    function shiftMonth(k, delta) { const { year, month } = parseMonthKey(k); return getMonthKey(new Date(year, month + delta, 1)); }

    // Data shape: { months: { "2026-03": { salary, savings[], debts[], family[], overallSavings[], reminders[], notes } } }
    // Everything is per-month — each month is fully independent
    let data = { months: {} };

    function getMonthData() {
        if (!data.months[currentMonth]) data.months[currentMonth] = { salary: 0, savings: [], debts: [], family: [], overallSavings: [], reminders: [], notes: '' };
        const md = data.months[currentMonth];
        // Ensure arrays exist for older data
        if (!md.debts) md.debts = [];
        if (!md.overallSavings) md.overallSavings = [];
        if (!md.reminders) md.reminders = [];
        if (md.notes === undefined) md.notes = '';
        // Migrate old carryForward data
        if (md.carryForward) delete md.carryForward;
        return md;
    }

    // --- Debounced save to API ---
    let _saveTimer = null;
    function save() {
        // Update local data immediately so UI stays snappy
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => _pushMonth(), 300);
    }
    function _pushMonth() {
        const md = data.months[currentMonth];
        if (!md) return;
        fetch(`${API_BASE}/months/${currentMonth}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(md)
        }).then(res => {
            if (res.status === 401) window.location.href = '/login';
        }).catch(err => console.error('Save failed:', err));
    }

    // --- Load all months from API ---
    async function load() {
        try {
            const res = await fetch(`${API_BASE}/months`);
            if (res.status === 401) { window.location.href = '/login'; return; }
            if (res.ok) {
                const d = await res.json();
                data = { months: d.months || {} };
            }
        } catch (e) {
            console.error('Load failed:', e);
        }
    }

    function uid() { return '_' + Math.random().toString(36).substr(2, 9); }
    function fmt(n) { return n === 0 ? '₹0' : '₹' + n.toLocaleString('en-IN'); }
    function parse(s) { const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : Math.max(0, n); }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    const $ = id => document.getElementById(id);
    const salaryInput = $('salary-input');
    const monthLabel = $('month-label');

    // Month nav
    $('month-prev').addEventListener('click', () => switchMonth(-1));
    $('month-next').addEventListener('click', () => switchMonth(1));
    function switchMonth(delta) {
        currentMonth = shiftMonth(currentMonth, delta);
        monthLabel.textContent = formatMonthLabel(currentMonth);
        monthLabel.classList.remove('month-changing');
        void monthLabel.offsetWidth;
        monthLabel.classList.add('month-changing');
        renderAll();
    }

    // --- Amount input helpers ---
    function bindAmount(el, getter, setter, onChange) {
        el.addEventListener('input', e => { setter(parse(e.target.value)); save(); if (onChange) onChange(); });
        el.addEventListener('blur', e => { const n = getter(); e.target.value = n > 0 ? n.toLocaleString('en-IN') : ''; });
        el.addEventListener('focus', e => { const n = getter(); e.target.value = n > 0 ? n.toString() : ''; });
    }

    // --- Savings / Family allocation rows (per-month) ---
    function makeAllocRow(item, type) {
        const row = document.createElement('div');
        row.className = 'item-row';
        const sal = getMonthData().salary;
        const pct = sal > 0 ? ((item.amount / sal) * 100).toFixed(1) : '0.0';

        let subHTML = '';
        if (type === 'savings') {
            subHTML = `<div class="item-sub-row"><input type="text" class="item-platform" placeholder="Platform: PhonePe, RISE..." value="${esc(item.platform || '')}" data-field="platform"></div>`;
        }

        row.innerHTML = `<div class="item-row-top"><input type="text" class="item-name" placeholder="${{ savings: 'e.g., SIP, Mutual Fund...', family: 'e.g., Mother, Family...' }[type]}" value="${esc(item.name)}" data-field="name"><div class="item-amount-wrapper"><span class="item-currency">₹</span><input type="text" class="item-amount" placeholder="0" value="${item.amount > 0 ? item.amount.toLocaleString('en-IN') : ''}" data-field="amount"></div><span class="item-percent">${pct}%</span><button class="item-delete" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>${subHTML}`;

        row.querySelector('[data-field="name"]').addEventListener('input', e => { item.name = e.target.value; save(); });
        bindAmount(row.querySelector('[data-field="amount"]'), () => item.amount, v => { item.amount = v; }, () => {
            const curSal = getMonthData().salary;
            row.querySelector('.item-percent').textContent = (curSal > 0 ? ((item.amount / curSal) * 100).toFixed(1) : '0.0') + '%';
            updateDashboard();
        });

        if (type === 'savings') {
            const pi = row.querySelector('[data-field="platform"]');
            if (pi) pi.addEventListener('input', e => { item.platform = e.target.value; save(); });
        }

        row.querySelector('.item-delete').addEventListener('click', () => {
            row.style.animation = 'fadeOutItem .3s ease-out forwards';
            setTimeout(() => { const md = getMonthData(); md[type] = md[type].filter(x => x.id !== item.id); save(); renderAllocList(type); updateDashboard(); }, 280);
        });
        return row;
    }

    // --- Debt rows (global, with total/monthly/remaining) ---
    function makeDebtRow(item) {
        const row = document.createElement('div');
        row.className = 'item-row';

        const sal = getMonthData().salary;
        const pct = sal > 0 ? ((item.monthlyPayment / sal) * 100).toFixed(1) : '0.0';
        const remain = Math.max(0, item.totalAmount - item.paidAmount);
        const monthsLeft = item.monthlyPayment > 0 ? Math.ceil(remain / item.monthlyPayment) : (remain > 0 ? '∞' : 0);
        const paidPct = item.totalAmount > 0 ? Math.min(100, (item.paidAmount / item.totalAmount) * 100) : 0;
        const settledClass = remain <= 0 ? ' settled' : '';
        const badgeText = remain <= 0 ? '✓ Settled' : `${monthsLeft} mo. left`;

        row.innerHTML = `
            <div class="item-row-top">
                <input type="text" class="item-name" placeholder="e.g., Home Loan EMI..." value="${esc(item.name)}" data-field="name">
                <div class="item-amount-wrapper"><span class="item-currency">₹</span><input type="text" class="item-amount" placeholder="0" value="${item.monthlyPayment > 0 ? item.monthlyPayment.toLocaleString('en-IN') : ''}" data-field="monthly" title="Monthly payment"></div>
                <span class="item-percent">${pct}%</span>
                <button class="item-delete" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div class="item-sub-row">
                <select class="item-cat-select" data-field="category">${DEBT_CATS.map(c => `<option value="${c}"${item.category === c ? ' selected' : ''}>${c}</option>`).join('')}</select>
                <input type="text" class="item-details" placeholder="Details: tenure, rate..." value="${esc(item.details || '')}" data-field="details">
            </div>
            <div class="debt-tracker-row">
                <label>Total:</label>
                <div class="item-amount-wrapper" style="min-width:100px"><span class="item-currency">₹</span><input type="text" class="debt-total-input" placeholder="0" value="${item.totalAmount > 0 ? item.totalAmount.toLocaleString('en-IN') : ''}" data-field="total"></div>
                <label>Paid:</label>
                <div class="item-amount-wrapper" style="min-width:100px"><span class="item-currency">₹</span><input type="text" class="debt-total-input" placeholder="0" value="${item.paidAmount > 0 ? item.paidAmount.toLocaleString('en-IN') : ''}" data-field="paid"></div>
                <span class="debt-remaining-badge${settledClass}">${badgeText}</span>
            </div>
            <div class="debt-progress-mini"><div class="debt-progress-mini-fill" style="width:${paidPct}%"></div></div>`;

        // Events
        row.querySelector('[data-field="name"]').addEventListener('input', e => { item.name = e.target.value; save(); });
        row.querySelector('[data-field="category"]').addEventListener('change', e => { item.category = e.target.value; save(); });
        row.querySelector('[data-field="details"]').addEventListener('input', e => { item.details = e.target.value; save(); });

        // Monthly payment
        bindAmount(row.querySelector('[data-field="monthly"]'), () => item.monthlyPayment, v => { item.monthlyPayment = v; }, () => {
            updateDebtBadge(row, item);
            updateDashboard();
        });

        // Total amount
        bindAmount(row.querySelector('[data-field="total"]'), () => item.totalAmount, v => { item.totalAmount = v; }, () => {
            updateDebtBadge(row, item);
        });

        // Paid amount
        bindAmount(row.querySelector('[data-field="paid"]'), () => item.paidAmount, v => { item.paidAmount = v; }, () => {
            updateDebtBadge(row, item);
        });

        row.querySelector('.item-delete').addEventListener('click', () => {
            row.style.animation = 'fadeOutItem .3s ease-out forwards';
            setTimeout(() => { const md = getMonthData(); md.debts = md.debts.filter(x => x.id !== item.id); save(); renderDebtsList(); updateDashboard(); }, 280);
        });
        return row;
    }

    function updateDebtBadge(row, item) {
        const sal = getMonthData().salary;
        const remain = Math.max(0, item.totalAmount - item.paidAmount);
        const monthsLeft = item.monthlyPayment > 0 ? Math.ceil(remain / item.monthlyPayment) : (remain > 0 ? '∞' : 0);
        const paidPct = item.totalAmount > 0 ? Math.min(100, (item.paidAmount / item.totalAmount) * 100) : 0;
        const badge = row.querySelector('.debt-remaining-badge');
        const fill = row.querySelector('.debt-progress-mini-fill');
        const pctEl = row.querySelector('.item-percent');

        if (remain <= 0) {
            badge.textContent = '✓ Settled';
            badge.className = 'debt-remaining-badge settled';
        } else {
            badge.textContent = `${monthsLeft} mo. left`;
            badge.className = 'debt-remaining-badge';
        }
        fill.style.width = paidPct + '%';
        pctEl.textContent = (sal > 0 ? ((item.monthlyPayment / sal) * 100).toFixed(1) : '0.0') + '%';
    }

    // --- Overall Savings rows (per-month) ---
    function makeOverallSavingsRow(item) {
        const row = document.createElement('div');
        row.className = 'item-row';

        row.innerHTML = `<div class="item-row-top"><input type="text" class="item-name" placeholder="e.g., SIP, Mutual Fund, FD, Stocks..." value="${esc(item.name)}" data-field="name"><div class="item-amount-wrapper"><span class="item-currency">₹</span><input type="text" class="item-amount" placeholder="0" value="${item.amount > 0 ? item.amount.toLocaleString('en-IN') : ''}" data-field="amount"></div><button class="item-delete" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>`;

        row.querySelector('[data-field="name"]').addEventListener('input', e => { item.name = e.target.value; save(); });
        bindAmount(row.querySelector('[data-field="amount"]'), () => item.amount, v => { item.amount = v; }, () => {
            updateOverallSavingsTotal();
        });

        row.querySelector('.item-delete').addEventListener('click', () => {
            row.style.animation = 'fadeOutItem .3s ease-out forwards';
            setTimeout(() => { const md = getMonthData(); md.overallSavings = md.overallSavings.filter(x => x.id !== item.id); save(); renderOverallSavingsList(); updateOverallSavingsTotal(); }, 280);
        });
        return row;
    }

    // --- Wide item (reminders) ---
    function makeWideRow(item, type) {
        const row = document.createElement('div');
        row.className = 'wide-item';
        const ph = {
            reminders: { name: 'e.g., Person name...', det: 'Notes: reason, terms, expected date...' }
        }[type];

        let metaHTML = '';
        if (type === 'reminders') {
            metaHTML = `<div class="wide-item-meta"><select class="wide-item-freq" data-field="frequency"><option value="One-time"${item.frequency === 'One-time' ? ' selected' : ''}>One-time</option><option value="Monthly"${item.frequency === 'Monthly' ? ' selected' : ''}>Monthly</option></select></div>`;
        }

        row.innerHTML = `<div class="wide-item-top"><input type="text" class="wide-item-name" placeholder="${ph.name}" value="${esc(item.name)}" data-field="name"><div class="wide-item-amount-wrap"><span class="item-currency">₹</span><input type="text" class="wide-item-amount" placeholder="0" value="${item.amount > 0 ? item.amount.toLocaleString('en-IN') : ''}" data-field="amount"></div><button class="wide-item-delete" title="Remove"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>${metaHTML}<textarea class="wide-item-details" placeholder="${ph.det}" data-field="details">${esc(item.details || '')}</textarea>`;

        row.querySelector('[data-field="name"]').addEventListener('input', e => { item.name = e.target.value; save(); });
        bindAmount(row.querySelector('[data-field="amount"]'), () => item.amount, v => { item.amount = v; }, () => { updateWideTotal(type); });
        row.querySelector('[data-field="details"]').addEventListener('input', e => { item.details = e.target.value; save(); });
        if (type === 'reminders') {
            const fi = row.querySelector('[data-field="frequency"]');
            if (fi) fi.addEventListener('change', e => { item.frequency = e.target.value; save(); });
        }
        row.querySelector('.wide-item-delete').addEventListener('click', () => {
            row.style.animation = 'fadeOutItem .3s ease-out forwards';
            setTimeout(() => { const md = getMonthData(); md[type] = md[type].filter(x => x.id !== item.id); save(); renderWideList(type); updateWideTotal(type); }, 280);
        });
        return row;
    }

    // --- Render ---
    function renderAllocList(type) {
        const el = $(type + '-list'), items = getMonthData()[type];
        el.innerHTML = '';
        if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.innerHTML = `<span class="empty-state-icon">${{ savings: '📊', family: '❤️' }[type]}</span><span class="empty-state-text">No items yet.</span>`; el.appendChild(e); return; }
        items.forEach(i => el.appendChild(makeAllocRow(i, type)));
    }

    function renderDebtsList() {
        const el = $('debts-list');
        const items = getMonthData().debts;
        el.innerHTML = '';
        if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.innerHTML = `<span class="empty-state-icon">💳</span><span class="empty-state-text">No debts yet.</span>`; el.appendChild(e); return; }
        items.forEach(i => el.appendChild(makeDebtRow(i)));
    }

    function renderOverallSavingsList() {
        const el = $('overall-savings-list');
        const items = getMonthData().overallSavings;
        el.innerHTML = '';
        if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.innerHTML = '<span class="empty-state-icon">🏦</span><span class="empty-state-text">No savings tracked yet.</span>'; el.appendChild(e); return; }
        items.forEach(i => el.appendChild(makeOverallSavingsRow(i)));
    }

    function renderWideList(type) {
        const el = $(type + '-list');
        el.innerHTML = '';
        const items = getMonthData()[type];
        if (!items.length) { const e = document.createElement('div'); e.className = 'empty-state'; e.innerHTML = `<span class="empty-state-icon">🔔</span><span class="empty-state-text">No entries yet.</span>`; el.appendChild(e); return; }
        items.forEach(i => el.appendChild(makeWideRow(i, type)));
    }

    function updateWideTotal(type) {
        $(type + '-total').textContent = fmt(getMonthData()[type].reduce((s, x) => s + x.amount, 0));
    }

    function updateOverallSavingsTotal() {
        $('overall-savings-total').textContent = fmt(getMonthData().overallSavings.reduce((s, x) => s + x.amount, 0));
    }

    // --- Dashboard ---
    function updateDashboard() {
        const md = getMonthData();
        const sal = md.salary;
        const totalBudget = sal;

        const sT = md.savings.reduce((s, x) => s + x.amount, 0);
        const dT = md.debts.reduce((s, x) => s + x.monthlyPayment, 0); // monthly payments
        const fT = md.family.reduce((s, x) => s + x.amount, 0);
        const rem = Math.max(0, totalBudget - sT - dT - fT);
        const over = totalBudget > 0 && (sT + dT + fT) > totalBudget;

        const sP = totalBudget > 0 ? (sT / totalBudget) * 100 : 0;
        const dP = totalBudget > 0 ? (dT / totalBudget) * 100 : 0;
        const fP = totalBudget > 0 ? (fT / totalBudget) * 100 : 0;
        const rP = totalBudget > 0 ? Math.max(0, 100 - sP - dP - fP) : 0;

        $('savings-total').textContent = fmt(sT);
        $('savings-percent').textContent = sP.toFixed(1) + '%';
        $('savings-progress').style.width = Math.min(sP, 100) + '%';
        $('debts-total').textContent = fmt(dT);
        $('debts-percent').textContent = dP.toFixed(1) + '%';
        $('debts-progress').style.width = Math.min(dP, 100) + '%';
        $('family-total').textContent = fmt(fT);
        $('family-percent').textContent = fP.toFixed(1) + '%';
        $('family-progress').style.width = Math.min(fP, 100) + '%';

        // Update per-item percentages
        ['savings', 'family'].forEach(t => {
            document.querySelectorAll(`#${t}-list .item-row`).forEach(r => {
                const a = r.querySelector('[data-field="amount"]'), p = r.querySelector('.item-percent');
                if (a && p) p.textContent = (totalBudget > 0 ? ((parse(a.value) / totalBudget) * 100).toFixed(1) : '0.0') + '%';
            });
        });
        // Debt percentages
        document.querySelectorAll('#debts-list .item-row').forEach(r => {
            const a = r.querySelector('[data-field="monthly"]'), p = r.querySelector('.item-percent');
            if (a && p) p.textContent = (totalBudget > 0 ? ((parse(a.value) / totalBudget) * 100).toFixed(1) : '0.0') + '%';
        });

        updateChart(sP, dP, fP, rP);

        const ra = $('remaining-amount'), rp = $('remaining-percent');
        if (over) {
            $('overview-card').classList.add('overspend-warning');
            ra.style.color = 'var(--dbt)';
            ra.textContent = '-' + fmt(sT + dT + fT - totalBudget);
            rp.textContent = '-' + (sP + dP + fP - 100).toFixed(1) + '%';
        } else {
            $('overview-card').classList.remove('overspend-warning');
            ra.style.color = ''; ra.textContent = fmt(rem); rp.textContent = rP.toFixed(1) + '%';
        }

        $('legend-savings').textContent = sP.toFixed(1) + '%'; $('legend-debts').textContent = dP.toFixed(1) + '%';
        $('legend-family').textContent = fP.toFixed(1) + '%'; $('legend-remaining').textContent = rP.toFixed(1) + '%';
        $('alloc-savings').textContent = fmt(sT); $('alloc-debts').textContent = fmt(dT);
        $('alloc-family').textContent = fmt(fT); $('alloc-remaining').textContent = fmt(rem);
    }

    function updateChart(sP, dP, fP, rP) {
        const segs = [{ id: 'seg-savings', pct: sP }, { id: 'seg-debts', pct: dP }, { id: 'seg-family', pct: fP }, { id: 'seg-remaining', pct: rP }];
        if (sP + dP + fP + rP === 0) { segs.forEach(s => $(s.id).setAttribute('stroke-dasharray', `0 ${CIRC}`)); return; }
        const gap = 2, gapLen = (gap / 360) * CIRC;
        const nz = segs.filter(s => s.pct > 0).length;
        const tg = nz > 1 ? gapLen * nz : 0;
        const sc = (CIRC - tg) / CIRC;
        let off = 0;
        segs.forEach(s => {
            const len = (s.pct / 100) * CIRC, seg = len > 0 ? len * sc : 0, el = $(s.id);
            if (seg > 0) { el.setAttribute('stroke-dasharray', `${seg} ${CIRC - seg}`); el.setAttribute('stroke-dashoffset', `${-off}`); off += seg + (nz > 1 ? gapLen : 0); }
            else { el.setAttribute('stroke-dasharray', `0 ${CIRC}`); }
        });
    }

    function renderAll() {
        const md = getMonthData();
        salaryInput.value = md.salary > 0 ? md.salary.toLocaleString('en-IN') : '';
        monthLabel.textContent = formatMonthLabel(currentMonth);
        ['savings', 'family'].forEach(renderAllocList);
        renderDebtsList();
        renderOverallSavingsList(); updateOverallSavingsTotal();
        renderWideList('reminders'); updateWideTotal('reminders');
        // Notes
        $('notes-textarea').value = md.notes || '';
        updateDashboard();
    }

    // Salary
    salaryInput.addEventListener('input', e => { getMonthData().salary = parse(e.target.value); save(); updateDashboard(); });
    salaryInput.addEventListener('blur', e => { const n = parse(e.target.value); e.target.value = n > 0 ? n.toLocaleString('en-IN') : ''; });
    salaryInput.addEventListener('focus', e => { const n = parse(e.target.value); e.target.value = n > 0 ? n.toString() : ''; });

    // Add buttons
    $('add-savings-btn').addEventListener('click', () => {
        getMonthData().savings.push({ id: uid(), name: '', amount: 0, platform: '' });
        save(); renderAllocList('savings');
        const l = $('savings-list').querySelector('.item-row:last-child');
        if (l) { const n = l.querySelector('.item-name'); if (n) n.focus(); }
        updateDashboard();
    });

    $('add-debts-btn').addEventListener('click', () => {
        getMonthData().debts.push({ id: uid(), name: '', category: 'EMI', totalAmount: 0, monthlyPayment: 0, paidAmount: 0, details: '' });
        save(); renderDebtsList();
        const l = $('debts-list').querySelector('.item-row:last-child');
        if (l) { const n = l.querySelector('.item-name'); if (n) n.focus(); }
        updateDashboard();
    });

    $('add-family-btn').addEventListener('click', () => {
        getMonthData().family.push({ id: uid(), name: '', amount: 0 });
        save(); renderAllocList('family');
        const l = $('family-list').querySelector('.item-row:last-child');
        if (l) { const n = l.querySelector('.item-name'); if (n) n.focus(); }
        updateDashboard();
    });

    $('add-overall-btn').addEventListener('click', () => {
        getMonthData().overallSavings.push({ id: uid(), name: '', amount: 0 });
        save(); renderOverallSavingsList(); updateOverallSavingsTotal();
        const l = $('overall-savings-list').querySelector('.item-row:last-child');
        if (l) { const n = l.querySelector('.item-name'); if (n) n.focus(); }
    });

    // Notes
    $('notes-textarea').addEventListener('input', e => {
        getMonthData().notes = e.target.value;
        save();
    });

    $('add-reminders-btn').addEventListener('click', () => {
        getMonthData().reminders.push({ id: uid(), name: '', amount: 0, details: '', frequency: 'One-time' });
        save(); renderWideList('reminders');
        const l = $('reminders-list').querySelector('.wide-item:last-child');
        if (l) { const n = l.querySelector('.wide-item-name'); if (n) n.focus(); }
        updateWideTotal('reminders');
    });

    // Logout
    $('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`);
        window.location.href = '/login';
    });

    // Init — load from API then render
    load().then(() => renderAll());
})();
