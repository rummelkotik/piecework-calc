'use strict';

/* ============================================================
   1. ХЕЛПЕРЫ ДАТ — только локальное время, без UTC-оффсетов
   ============================================================ */
const toISODate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function parseISODate(s) {
    const [y, m, d] = String(s || '').split('-').map(Number);
    return new Date(y || 1970, (m || 1) - 1, d || 1);
}

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTH_NAMES_SHORT = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

/* ============================================================
   2. СОСТОЯНИЕ
   ============================================================ */
let entries = [];
let services = [];
let currentServices = [];

let currentDate = new Date();
let selectedDateStr = toISODate(new Date());
let currentDashboardMode = 'month';
let showAllHistory = false;

let analyticsMode = 'month';
let analyticsDate = new Date();

let targetIncome = Number(localStorage.getItem('target_income')) || 100000;
let taxRate = Number(localStorage.getItem('tax_rate')) || 0.13;

let goalChart = null;
let earningsChart = null;
let analyticsDaysChart = null;
let analyticsMonthsChart = null;
let analyticsPieChart = null;

const RESERVED_CATEGORY_NAME = 'контейнеры';

const FIXED_CONTAINERS = [
    { id: 'fixed_container_3',       category: 'Контейнеры', name: 'контейнер на 3',            price: 3333, isFixed: true },
    { id: 'fixed_container_4',       category: 'Контейнеры', name: 'контейнер на 4',            price: 2500, isFixed: true },
    { id: 'fixed_container_fenced',  category: 'Контейнеры', name: 'контейнер с ограждениями',  price: 5000, isFixed: true },
    { id: 'fixed_container_tanks_3', category: 'Контейнеры', name: 'контейнер с баками на 3',   price: 2500, isFixed: true },
    { id: 'fixed_container_tanks_4', category: 'Контейнеры', name: 'контейнер с баками на 4',   price: 1750, isFixed: true },
];

const categoryIcons = {
    "смесители": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    "душевая программа": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4v16h16V4H4zm4 4h8M8 12h8m-8 4h8"/></svg>',
    "панели/каркасы для ванн": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    "душевые кабины": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></svg>',
    "душевые ограждения": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v18M19 3v18M5 12h14"/></svg>',
    "поддоны": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18h20M4 18v2h16v-2M6 6h12v12H6z"/></svg>',
    "ванны": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16a2 2 0 0 1 2 2v2H2v-2a2 2 0 0 1 2-2zm2 6v2m12-2v2M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/></svg>',
    "инсталяции": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M12 18h.01"/></svg>',
    "санфаянс": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2h8V6a4 4 0 0 0-4-4zM4 10v4a8 8 0 0 0 16 0v-4H4z"/></svg>',
    "контейнеры": '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/></svg>'
};

/* ============================================================
   3. ДОМЕННОЕ ЯДРО — вся бизнес-логика в одном месте
   ============================================================ */
function findServiceById(id) {
    if (id === undefined || id === null || id === '') return null;
    const key = String(id);
    const fixed = FIXED_CONTAINERS.find(s => String(s.id) === key);
    if (fixed) return fixed;
    return currentServices.find(s => String(s.id) === key)
        || services.find(s => String(s.id) === key)
        || null;
}

function priceOf(e) {
    if (e.price !== undefined && e.price !== null && e.price !== '') return Number(e.price) || 0;
    const s = findServiceById(e.service_id);
    return s ? Number(s.price) || 0 : 0;
}

function sumOf(e) {
    return (Number(e.quantity) || 1) * priceOf(e);
}

function entryName(e) {
    return e.name || (findServiceById(e.service_id)?.name) || 'Работа';
}

function entryCategory(e) {
    const s = findServiceById(e.service_id);
    return s ? (s.category || 'Общие') : (e.category || 'Общие');
}

function isContainerEntry(e) {
    const cat = entryCategory(e).toLowerCase();
    const name = entryName(e).toLowerCase();
    const id = String(e.service_id || '').toLowerCase();
    return cat.includes('контейнер') || name.includes('контейнер') || id.includes('container');
}

function isTaxableEntry(e) {
    if (isContainerEntry(e)) return false;
    const s = findServiceById(e.service_id);
    if (s && (s.is_tax_free === true || s.isFixed)) return false;
    return true;
}

// mode 'day'  -> ref это ISO-строка 'YYYY-MM-DD'
// mode 'month'/'year' -> ref это Date
function filterByPeriod(list, mode, ref) {
    return list.filter(e => {
        if (!e.date) return false;
        if (mode === 'day') return e.date === ref;
        const d = parseISODate(e.date);
        if (mode === 'month') return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
        return d.getFullYear() === ref.getFullYear();
    });
}

function shiftRef(mode, ref, dir) {
    if (mode === 'day') {
        const d = parseISODate(ref);
        d.setDate(d.getDate() + dir);
        return toISODate(d);
    }
    const d = new Date(ref);
    if (mode === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    return d;
}

function aggregate(list) {
    const agg = {
        gross: 0, taxable: 0, containers: 0, count: 0,
        byCategory: {}, byWork: {}, byDay: {}, byMonth: {},
        rowsMain: {}, rowsFrames: {}
    };
    for (const e of list) {
        const sum = sumOf(e);
        const qty = Number(e.quantity) || 1;
        agg.gross += sum;
        agg.count += qty;

        const isCont = isContainerEntry(e);
        if (isCont) agg.containers += sum;
        if (!isCont && isTaxableEntry(e)) agg.taxable += sum;

        const cat = isCont ? 'Контейнеры' : entryCategory(e);
        const name = entryName(e);
        agg.byCategory[cat] = (agg.byCategory[cat] || 0) + sum;
        agg.byWork[name] = (agg.byWork[name] || 0) + sum;

        const d = parseISODate(e.date);
        agg.byDay[d.getDate()] = (agg.byDay[d.getDate()] || 0) + sum;
        agg.byMonth[d.getMonth()] = (agg.byMonth[d.getMonth()] || 0) + sum;

        const rows = isCont ? agg.rowsFrames : agg.rowsMain;
        const key = cat + '___' + name;
        if (!rows[key]) rows[key] = { category: cat, name, quantity: 0, totalSum: 0 };
        rows[key].quantity += qty;
        rows[key].totalSum += sum;
    }
    return agg;
}

function topWork(byWork) {
    let name = 'Нет данных';
    let sum = 0;
    for (const [n, s] of Object.entries(byWork)) {
        if (s > sum) { sum = s; name = n; }
    }
    return { name, sum };
}

function trendText(cur, prev) {
    if (!prev || prev <= 0) return '—';
    const pct = Math.round(((cur - prev) / prev) * 100);
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}%`;
}

/* ============================================================
   4. ХРАНИЛИЩЕ (localStorage) с дебаунсом и обработкой ошибок
   ============================================================ */
function sanitizeServices(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(s => {
        const cat = (s.category || '').toLowerCase().trim();
        // «Контейнеры» — зарезервированная категория, управляется через FIXED_CONTAINERS
        if (cat === RESERVED_CATEGORY_NAME && !s.isFixed) return false;
        return true;
    });
}

let saveTimer = null;
function saveLocalBackup() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        try {
            localStorage.setItem('services', JSON.stringify(currentServices));
            localStorage.setItem('app_entries', JSON.stringify(entries));
        } catch (err) {
            console.error('Ошибка сохранения:', err);
            alert('Не удалось сохранить данные: локальное хранилище переполнено. Сделайте экспорт.');
        }
    }, 150);
}

function loadServices() {
    let raw = null;
    try {
        raw = JSON.parse(localStorage.getItem('services') || localStorage.getItem('app_services') || localStorage.getItem('piecework_services') || 'null');
    } catch (e) {
        console.error('Ошибка чтения localStorage:', e);
    }

    if (!Array.isArray(raw) || raw.length === 0) {
        services = JSON.parse(JSON.stringify(FIXED_CONTAINERS));
    } else {
        raw = sanitizeServices(raw);
        for (const fc of FIXED_CONTAINERS) {
            if (!raw.some(s => String(s.id) === String(fc.id))) raw.push(fc);
        }
        services = raw;
    }
    currentServices = JSON.parse(JSON.stringify(services));
}

function loadEntries() {
    try {
        const raw = JSON.parse(localStorage.getItem('app_entries') || '[]');
        entries = Array.isArray(raw) ? raw : [];
    } catch (e) {
        console.error('Ошибка чтения записей:', e);
        entries = [];
    }
}

/* ============================================================
   5. ОЧЕРЕДЬ ПЕРЕРИСОВОК — батчим вызовы в один микротаск
   ============================================================ */
const pendingViews = new Set();
let renderScheduled = false;

function scheduleRender(...views) {
    views.forEach(v => pendingViews.add(v));
    if (renderScheduled) return;
    renderScheduled = true;
    queueMicrotask(() => {
        renderScheduled = false;
        const v = new Set(pendingViews);
        pendingViews.clear();
        if (v.has('summary')) renderSummary();
        if (v.has('history')) renderHistory();
        if (v.has('day')) renderDayEntries();
        if (v.has('analytics')) renderAnalytics();
    });
}

/* ============================================================
   6. ИНИЦИАЛИЗАЦИЯ И ВКЛАДКИ
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    loadEntries();
    loadServices();

    initTabs();
    initDashboardEvents();
    initEntriesEvents();
    initCatalogEvents();
    initQuickAddEvents();
    initExportImportEvents();
    initSettingsEvents();
    initThemeEvents();

    const today = toISODate(new Date());
    selectedDateStr = today;
    for (const id of ['entry-date', 'single-date']) {
        const el = document.getElementById(id);
        if (el) el.value = today;
    }
    for (const id of ['entry-qty', 'single-qty']) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    }

    populateCategoryDropdowns();
    renderContainerCheckboxes();
    renderCatalog();
    scheduleRender('summary', 'history', 'day', 'analytics');
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            const target = document.getElementById(tabName) || document.getElementById(tabName + '-tab');
            if (!target) return;

            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            target.classList.add('active');

            if (tabName === 'dashboard') {
                scheduleRender('summary', 'history');
            } else if (tabName === 'entries') {
                const d = document.getElementById('entry-date');
                if (d) d.value = selectedDateStr;
                const sd = document.getElementById('single-date');
                if (sd) sd.value = selectedDateStr;
                renderDayEntries();
            } else if (tabName === 'works') {
                renderCatalog();
            } else if (tabName === 'analytics') {
                analyticsDate = new Date(currentDate);
                scheduleRender('analytics');
            }
        });
    });
}

/* ============================================================
   7. ДАШБОРД: СВОДКА, ГРАФИКИ, ЦЕЛЬ
   ============================================================ */
function initDashboardEvents() {
    document.getElementById('search-input')?.addEventListener('input', renderHistory);

    document.getElementById('history-table-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete-entry"]');
        if (btn) deleteEntry(btn.dataset.id);
    });

    document.getElementById('show-all-entries-btn')?.addEventListener('click', () => {
        showAllHistory = !showAllHistory;
        const btn = document.getElementById('show-all-entries-btn');
        if (btn) btn.textContent = showAllHistory ? 'Свернуть' : 'Все записи →';
        renderHistory();
    });

    document.querySelectorAll('.dashboard-header .period-tabs .p-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.dashboard-header .period-tabs .p-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentDashboardMode = tab.dataset.period;
            scheduleRender('summary', 'history');
        });
    });

    document.getElementById('prev-period')?.addEventListener('click', () => shiftPeriod(-1));
    document.getElementById('next-period')?.addEventListener('click', () => shiftPeriod(1));

    document.getElementById('chart-metric-select')?.addEventListener('change', () => updateEarningsChart(true));

    document.querySelectorAll('[data-analytics-period]').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-analytics-period]').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            analyticsMode = tab.dataset.analyticsPeriod;
            scheduleRender('analytics');
        });
    });

    document.getElementById('analytics-prev-period')?.addEventListener('click', () => {
        const ref = analyticsMode === 'day' ? toISODate(analyticsDate) : analyticsDate;
        const next = shiftRef(analyticsMode, ref, -1);
        analyticsDate = analyticsMode === 'day' ? parseISODate(next) : next;
        scheduleRender('analytics');
    });
    document.getElementById('analytics-next-period')?.addEventListener('click', () => {
        const ref = analyticsMode === 'day' ? toISODate(analyticsDate) : analyticsDate;
        const next = shiftRef(analyticsMode, ref, 1);
        analyticsDate = analyticsMode === 'day' ? parseISODate(next) : next;
        scheduleRender('analytics');
    });
}

function shiftPeriod(direction) {
    if (currentDashboardMode === 'day') {
        selectedDateStr = shiftRef('day', selectedDateStr, direction);
        currentDate = parseISODate(selectedDateStr);
    } else {
        currentDate = shiftRef(currentDashboardMode, currentDate, direction);
    }
    scheduleRender('summary', 'history');
}

function renderSummary() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const labelEl = document.getElementById('current-period-label');
    if (labelEl) {
        if (currentDashboardMode === 'day') {
            labelEl.textContent = parseISODate(selectedDateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        } else if (currentDashboardMode === 'month') {
            labelEl.textContent = `${MONTH_NAMES[month]} ${year}`;
        } else {
            labelEl.textContent = `${year} год`;
        }
    }

    const ref = currentDashboardMode === 'day' ? selectedDateStr : currentDate;
    const agg = aggregate(filterByPeriod(entries, currentDashboardMode, ref));
    const tax = agg.taxable * taxRate;
    const net = agg.gross - tax;

    setIfExists('dash-gross', agg.gross.toLocaleString('ru-RU') + ' ₽');
    setIfExists('dash-tax', tax.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽');
    setIfExists('dash-net', net.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽');
    setIfExists('dash-containers-sum', agg.containers.toLocaleString('ru-RU') + ' ₽');

    updateEarningsChart();

    const monthAgg = aggregate(filterByPeriod(entries, 'month', currentDate));
    renderGoalChart(monthAgg.gross);
}

function getChartThemeColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return {
        track: isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.05)',
        grid: isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.04)',
        tick: isLight ? '#6B7280' : '#94A3B8'
    };
}

function renderGoalChart(gross) {
    const canvas = document.getElementById('goalChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const safeTarget = Math.max(0, targetIncome);
    const remaining = Math.max(0, safeTarget - gross);
    const percentage = safeTarget > 0
        ? Math.min(100, Math.round((gross / safeTarget) * 100))
        : (gross > 0 ? 100 : 0);

    setIfExists('goal-text-amount', `${gross.toLocaleString('ru-RU')} ₽ / ${safeTarget.toLocaleString('ru-RU')} ₽`);
    setIfExists('goal-text-percent', `${percentage}% выполнено`);
    setIfExists('goal-percent-big', `${percentage}%`);

    if (goalChart) {
        goalChart.data.datasets[0].data = [gross, remaining];
        goalChart.update('none');
        return;
    }

    goalChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [gross, remaining],
                backgroundColor: ['#43c6b8', getChartThemeColors().track],
                borderWidth: 0,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => ' ' + Number(context.raw || 0).toLocaleString('ru-RU') + ' ₽'
                    }
                }
            },
            cutout: '75%'
        }
    });
}

function updateEarningsChart(forceRecreate) {
    const canvas = document.getElementById('earningsChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const metric = document.getElementById('chart-metric-select')?.value || 'earnings';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let labels, data;

    if (currentDashboardMode === 'day') {
        labels = ['Выбранный день'];
        const a = aggregate(filterByPeriod(entries, 'day', selectedDateStr));
        data = [metric === 'earnings' ? a.gross : a.count];
    } else {
        const isYear = currentDashboardMode === 'year';
        const span = isYear ? 12 : new Date(year, month + 1, 0).getDate();
        labels = isYear ? MONTH_NAMES_SHORT.slice() : Array.from({ length: span }, (_, i) => i + 1);
        data = Array(span).fill(0);
        for (const e of filterByPeriod(entries, currentDashboardMode, currentDate)) {
            const d = parseISODate(e.date);
            const i = isYear ? d.getMonth() : d.getDate() - 1;
            data[i] += metric === 'earnings' ? sumOf(e) : (Number(e.quantity) || 1);
        }
    }

    const key = labels.join('|');
    if (!forceRecreate && earningsChart && earningsChart.$key === key) {
        earningsChart.data.datasets[0].data = data;
        earningsChart.update('none');
        return;
    }
    if (earningsChart) earningsChart.destroy();

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 230);
    gradient.addColorStop(0, 'rgba(94, 237, 212, 0.85)');
    gradient.addColorStop(1, 'rgba(94, 237, 212, 0.12)');
    const suffix = metric === 'earnings' ? ' ₽' : ' шт.';

    earningsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: gradient,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.85
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#182235',
                    titleColor: '#F1F5F9',
                    bodyColor: '#5EEAD4',
                    borderColor: '#293548',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: { label: (c) => ' ' + Number(c.raw || 0).toLocaleString('ru-RU') + suffix }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: getChartThemeColors().tick, font: { size: 10 }, maxTicksLimit: 15 } },
                y: { grid: { color: getChartThemeColors().grid }, ticks: { color: getChartThemeColors().tick, font: { size: 11 }, maxTicksLimit: 5 } }
            }
        }
    });
    earningsChart.$key = key;
}

/* ============================================================
   8. ИСТОРИЯ ЗАПИСЕЙ
   ============================================================ */
function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const ref = currentDashboardMode === 'day' ? selectedDateStr : currentDate;
    let sorted = filterByPeriod(entries, currentDashboardMode, ref)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    if (query) {
        sorted = sorted.filter(e =>
            entryName(e).toLowerCase().includes(query) ||
            (e.project || '').toLowerCase().includes(query)
        );
    }

    const display = showAllHistory ? sorted : sorted.slice(0, 8);

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Нет записей за выбранный период</td></tr>';
        return;
    }

    tbody.innerHTML = display.map(e => {
        const name = entryName(e);
        const category = entryCategory(e);
        const dateStr = e.date
            ? parseISODate(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
            : '';
        return `
            <tr>
                <td>${dateStr}</td>
                <td>${escapeHtml(category)}</td>
                <td>${escapeHtml(name)}</td>
                <td>${e.quantity || 1}</td>
                <td>${sumOf(e).toLocaleString('ru-RU')} ₽</td>
                <td><button type="button" class="icon-btn" data-action="delete-entry" data-id="${escapeHtml(String(e.id))}">🗑</button></td>
            </tr>
        `;
    }).join('');
}

/* ============================================================
   9. ЗАПИСИ ДНЯ: ДОБАВЛЕНИЕ И СПИСОК
   ============================================================ */
function initEntriesEvents() {
    document.getElementById('day-entries-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete-entry"]');
        if (btn) deleteEntry(btn.dataset.id);
    });

    document.getElementById('add-from-catalog-btn')?.addEventListener('click', addWorkFromCatalog);
    document.getElementById('add-single-work-btn')?.addEventListener('click', addSingleWork);

    document.getElementById('cat-select')?.addEventListener('change', (e) => {
        const valid = getValidServices();
        fillPositionSelect(valid, e.target.value);
    });

    document.getElementById('pos-select')?.addEventListener('change', (e) => {
        const s = findServiceById(e.target.value);
        const priceInput = document.getElementById('cat-work-price');
        if (s && priceInput) priceInput.value = s.price;
    });

    ['entry-date', 'single-date'].forEach((id) => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const newDate = e.target.value;
            if (!newDate) return;
            selectedDateStr = newDate;
            for (const otherId of ['entry-date', 'single-date']) {
                const el = document.getElementById(otherId);
                if (el) el.value = newDate;
            }
            renderDayEntries();
        });
    });
}

function getValidServices() {
    return currentServices.filter(s => {
        const cat = (s.category || '').trim().toLowerCase();
        return cat !== RESERVED_CATEGORY_NAME && s.type !== 'container';
    });
}

function populateCategoryDropdowns() {
    const catSelect = document.getElementById('cat-select');
    if (!catSelect) return;
    const valid = getValidServices();
    const current = catSelect.value;

    catSelect.innerHTML = '<option value="" disabled>— Выбрать —</option>';
    [...new Set(valid.map(s => s.category || 'Общие'))].forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });
    if ([...catSelect.options].some(o => o.value === current)) catSelect.value = current;

    fillPositionSelect(valid, catSelect.value);
}

function fillPositionSelect(validServices, category) {
    const posSelect = document.getElementById('pos-select');
    if (!posSelect) return;
    posSelect.innerHTML = '<option value="" disabled selected>Выберите позицию</option>';
    if (!category) return;
    validServices
        .filter(s => (s.category || 'Общие') === category)
        .forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${(Number(s.price) || 0).toLocaleString('ru-RU')} ₽)`;
            posSelect.appendChild(opt);
        });
}

function renderDayEntries() {
    const list = document.getElementById('day-entries-list');
    if (!list) return;
    const dayEntries = entries.filter(e => e.date === selectedDateStr);

    const totalEl = document.getElementById('day-total-sum');
    if (totalEl) {
        const total = dayEntries.reduce((s, e) => s + sumOf(e), 0);
        totalEl.textContent = 'Итого: ' + total.toLocaleString('ru-RU') + ' ₽';
    }

    if (dayEntries.length === 0) {
        list.innerHTML = '<div class="day-entries-empty">На этот день пока нет добавленных работ</div>';
        return;
    }

    list.innerHTML = dayEntries.map(e => {
        const name = entryName(e);
        return `
            <div class="entry-item-row">
                <span class="entry-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                <span class="entry-qty">${e.quantity || 1} шт.</span>
                <span class="entry-price">${sumOf(e).toLocaleString('ru-RU')} ₽</span>
                <button type="button" class="icon-btn" data-action="delete-entry" data-id="${escapeHtml(String(e.id))}">🗑</button>
            </div>
        `;
    }).join('');
}

function currentEntryDate() {
    const dateInput = document.getElementById('entry-date');
    return (dateInput && dateInput.value) || selectedDateStr;
}

function addWorkFromCatalog() {
    const posSelect = document.getElementById('pos-select');
    const qtyInput = document.getElementById('entry-qty');
    const priceInput = document.getElementById('cat-work-price');

    if (!posSelect || !posSelect.value) {
        alert('Выберите позицию из каталога');
        return;
    }
    const s = findServiceById(posSelect.value);
    const qtyRaw = (qtyInput?.value || '').trim();
    const qty = qtyRaw === '' ? 1 : Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
        alert('Количество должно быть положительным числом.');
        return;
    }

    entries.push({
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        date: currentEntryDate(),
        service_id: posSelect.value,
        name: s ? s.name : '',
        category: s ? s.category : '',
        quantity: qty,
        price: parseFloat(priceInput?.value) || (s ? s.price : 0)
    });
    saveLocalBackup();
    scheduleRender('summary', 'history', 'day', 'analytics');
    if (qtyInput) qtyInput.value = '';
}

function addSingleWork() {
    const nameInput = document.getElementById('single-name');
    const qtyInput = document.getElementById('single-qty');
    const priceInput = document.getElementById('single-price');
    const dateInput = document.getElementById('single-date');

    const name = nameInput?.value.trim();
    if (!name) {
        alert('Введите название работы');
        return;
    }
    const qtyRaw = (qtyInput?.value || '').trim();
    const qty = qtyRaw === '' ? 1 : Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) {
        alert('Количество должно быть положительным числом.');
        return;
    }

    entries.push({
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        date: (dateInput && dateInput.value) || selectedDateStr,
        name,
        category: 'Единичная',
        quantity: qty,
        price: parseFloat(priceInput?.value) || 0,
        service_id: null
    });
    saveLocalBackup();
    scheduleRender('summary', 'history', 'day', 'analytics');

    if (nameInput) nameInput.value = '';
    if (qtyInput) qtyInput.value = '';
    if (priceInput) priceInput.value = '';
}

function deleteEntry(id) {
    entries = entries.filter(e => String(e.id) !== String(id));
    saveLocalBackup();
    scheduleRender('summary', 'history', 'day', 'analytics');
}

/* ============================================================
   10. БЫСТРОЕ ДОБАВЛЕНИЕ КОНТЕЙНЕРОВ
   ============================================================ */
function renderContainerCheckboxes() {
    const el = document.getElementById('containers-checkboxes-list');
    if (!el) return;
    el.innerHTML = FIXED_CONTAINERS.map(s => `
        <button type="button" class="quick-card" data-service-id="${s.id}">
            <span class="quick-card-icon">📦</span>
            <span class="quick-card-title">${escapeHtml(s.name)}</span>
            <span class="quick-card-price">${s.price.toLocaleString('ru-RU')} ₽</span>
        </button>
    `).join('');
}

function initQuickAddEvents() {
    const el = document.getElementById('containers-checkboxes-list');
    if (!el) return;

    el.addEventListener('click', (e) => {
        const card = e.target.closest('.quick-card');
        if (!card) return;
        addContainerEntry(card.dataset.serviceId);

        card.classList.add('quick-card-flash');
        setTimeout(() => card.classList.remove('quick-card-flash'), 250);
    });
}

function addContainerEntry(serviceId) {
    const s = findServiceById(serviceId);
    if (!s) return;
    entries.push({
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        date: currentEntryDate(),
        service_id: serviceId,
        name: s.name,
        category: 'Контейнеры',
        quantity: 1,
        price: s.price
    });
    saveLocalBackup();
    scheduleRender('summary', 'history', 'day', 'analytics');
}

/* ============================================================
   11. КАТАЛОГ РАСЦЕНОК
   ============================================================ */
function initCatalogEvents() {
    const handleAddCategory = () => {
        const input = document.getElementById('new-cat-input');
        const catName = input?.value.trim();
        if (!catName) {
            alert('Введите название категории');
            return;
        }
        if (catName.toLowerCase() === RESERVED_CATEGORY_NAME) {
            alert('Название «Контейнеры» зарезервировано под фиксированные позиции. Выберите другое название категории.');
            return;
        }
        const exists = currentServices.some(s => (s.category || '').toLowerCase() === catName.toLowerCase());
        if (exists) {
            alert('Такая категория уже существует!');
            return;
        }
        currentServices.push({
            id: 'srv_' + Date.now(),
            category: catName,
            name: '',
            price: '',
            unit: 'шт',
            isFavorite: false
        });
        services = JSON.parse(JSON.stringify(currentServices));
        saveCatalogState();
        populateCategoryDropdowns();
        renderCatalog();
        if (input) input.value = '';
    };

    document.getElementById('add-cat-btn')?.addEventListener('click', handleAddCategory);
    document.getElementById('new-cat-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAddCategory();
    });

    document.getElementById('catalog-search')?.addEventListener('input', renderCatalog);

    const container = document.getElementById('catalog-categories-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const addBtn = e.target.closest('[data-action="add-service"]');
        if (addBtn) {
            addNewServiceToCategory(addBtn.dataset.category);
            return;
        }
        const delBtn = e.target.closest('[data-action="delete-service"]');
        if (delBtn) deleteService(delBtn.dataset.id);
    });

    container.addEventListener('change', (e) => {
        const nameInput = e.target.closest('[data-action="update-name"]');
        if (nameInput) {
            updateServiceName(nameInput.dataset.id, nameInput.value);
            return;
        }
        const priceInput = e.target.closest('[data-action="update-price"]');
        if (priceInput) updateServicePrice(priceInput.dataset.id, priceInput.value);
    });
}

function saveCatalogState() {
    try {
        localStorage.setItem('services', JSON.stringify(currentServices));
    } catch (e) {
        console.error('Ошибка сохранения каталога:', e);
    }
}

function renderCatalog() {
    currentServices = sanitizeServices(currentServices);
    const container = document.getElementById('catalog-categories-container');
    if (!container) return;

    const query = (document.getElementById('catalog-search')?.value || '').toLowerCase();
    const categoriesMap = {};
    currentServices.filter(s => !s.isFixed).forEach(s => {
        const cat = s.category || 'Общие';
        (categoriesMap[cat] = categoriesMap[cat] || []).push(s);
    });

    let html = '';
    for (const cat of Object.keys(categoriesMap).sort()) {
        let items = categoriesMap[cat];
        if (query) {
            items = items.filter(s =>
                (s.name || '').toLowerCase().includes(query) ||
                cat.toLowerCase().includes(query)
            );
            if (items.length === 0) continue;
        }

        html += `
            <div class="cat-card">
                <div class="cat-head">
                    <h3 class="cat-title">${escapeHtml(cat)}</h3>
                    <button type="button" class="cat-add-btn" data-action="add-service" data-category="${escapeHtml(cat)}">+ Добавить позицию</button>
                </div>
                <div class="cat-body">
        `;
        for (const s of items) {
            const iconSrc = categoryIcons[(s.category || '').toLowerCase().trim()] || s.icon || '📁';
            html += `
                <div class="srv-row">
                    <div class="srv-icon">${iconSrc}</div>
                    <input type="text" class="srv-name" value="${escapeHtml(s.name)}" data-action="update-name" data-id="${escapeHtml(String(s.id))}" placeholder="Название работы...">
                    <span class="srv-unit">шт</span>
                    <div class="srv-price">
                        <input type="number" class="srv-price-input" value="${escapeHtml(String(s.price))}" data-action="update-price" data-id="${escapeHtml(String(s.id))}">
                        <span class="srv-cur">₽</span>
                    </div>
                    <button type="button" class="srv-del" data-action="delete-service" data-id="${escapeHtml(String(s.id))}" title="Удалить">✕</button>
                </div>
            `;
        }
        html += `</div></div>`;
    }

    container.innerHTML = html || '<div class="catalog-empty">Ничего не найдено</div>';
}

function addNewServiceToCategory(categoryName) {
    const randomIcons = ['📁','📦','🛠️','⚙️','🧹','🪟','🏗️','🚚','💡','📌','⚡','🔨','📋','📐','💻'];
    currentServices.push({
        id: 'srv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
        category: categoryName,
        name: '',
        price: '',
        unit: 'шт',
        icon: randomIcons[Math.floor(Math.random() * randomIcons.length)]
    });
    services = JSON.parse(JSON.stringify(currentServices));
    saveCatalogState();
    populateCategoryDropdowns();
    renderCatalog();
}

function updateServiceName(id, newName) {
    const s = currentServices.find(ser => String(ser.id) === String(id));
    if (s && !s.isFixed) {
        s.name = newName.trim();
        services = JSON.parse(JSON.stringify(currentServices));
        saveCatalogState();
        populateCategoryDropdowns();
    }
}

function updateServicePrice(id, newPrice) {
    const s = currentServices.find(ser => String(ser.id) === String(id));
    if (s && !s.isFixed) {
        s.price = parseFloat(newPrice) || 0;
        services = JSON.parse(JSON.stringify(currentServices));
        saveCatalogState();
    }
}

function deleteService(id) {
    currentServices = currentServices.filter(ser => String(ser.id) !== String(id));
    services = JSON.parse(JSON.stringify(currentServices));
    saveCatalogState();
    populateCategoryDropdowns();
    renderCatalog();
}

/* ============================================================
   12. АНАЛИТИКА
   ============================================================ */
const PIE_COLORS = ['#3b82f6', '#10b981', '#f97316', '#a855f7', '#06b6d4', '#eab308', '#ec4899'];

function renderAnalytics() {
    if (typeof Chart === 'undefined') return;

    const ref = analyticsMode === 'day' ? toISODate(analyticsDate) : analyticsDate;
    const agg = aggregate(filterByPeriod(entries, analyticsMode, ref));
    const prevAgg = aggregate(filterByPeriod(entries, analyticsMode, shiftRef(analyticsMode, ref, -1)));

    const avg = agg.count > 0 ? agg.gross / agg.count : 0;
    const prevAvg = prevAgg.count > 0 ? prevAgg.gross / prevAgg.count : 0;
    const top = topWork(agg.byWork);

    setIfExists('analytic-total-income', agg.gross.toLocaleString('ru-RU') + ' ₽');
    setIfExists('analytic-income-trend', trendText(agg.gross, prevAgg.gross));
    setIfExists('analytic-total-count', agg.count + ' шт.');
    setIfExists('analytic-count-trend', trendText(agg.count, prevAgg.count));
    setIfExists('analytic-avg-earnings', avg.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽');
    setIfExists('analytic-avg-trend', trendText(avg, prevAvg));
    setIfExists('analytic-top-work-name', top.name);
    setIfExists('analytic-top-work-sum', top.sum.toLocaleString('ru-RU') + ' ₽');
    setIfExists('kp-total-units', agg.count + ' шт.');
    setIfExists('kp-avg-earnings', avg.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽');
    setIfExists('kp-top-work', `${top.name} (${top.sum.toLocaleString('ru-RU')} ₽)`);

    const label = analyticsMode === 'day'
        ? parseISODate(toISODate(analyticsDate)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : analyticsMode === 'month'
            ? `${MONTH_NAMES[analyticsDate.getMonth()]} ${analyticsDate.getFullYear()}`
            : `${analyticsDate.getFullYear()} год`;
    setIfExists('analytics-period-label', label);

    const daysInMonth = new Date(analyticsDate.getFullYear(), analyticsDate.getMonth() + 1, 0).getDate();
    const dayLabels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const dayData = dayLabels.map(d => agg.byDay[d] || 0);
    const daysCanvas = document.getElementById('analyticsDaysChart');
    if (daysCanvas) {
        analyticsDaysChart = upsertBarChart(analyticsDaysChart, daysCanvas, dayLabels, dayData, '#5eedd4');
    }

    const monthData = Array.from({ length: 12 }, (_, i) => agg.byMonth[i] || 0);
    const monthsCanvas = document.getElementById('analyticsMonthsChart');
    if (monthsCanvas) {
        analyticsMonthsChart = upsertBarChart(analyticsMonthsChart, monthsCanvas, MONTH_NAMES_SHORT, monthData, '#3b82f6');
    }

    renderPie(agg);
    renderAnalyticsTables(agg);
}

function upsertBarChart(instance, canvas, labels, data, color) {
    const key = labels.join('|');
    if (instance && instance.$key === key) {
        instance.data.datasets[0].data = data;
        instance.update('none');
        return instance;
    }
    if (instance) instance.destroy();
    const chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: getChartThemeColors().tick, font: { size: 10 } } },
                y: { grid: { color: getChartThemeColors().grid }, ticks: { color: getChartThemeColors().tick, font: { size: 10 } } }
            }
        }
    });
    chart.$key = key;
    return chart;
}

function renderPie(agg) {
    const canvas = document.getElementById('analyticsPieChart');
    const legend = document.getElementById('analytics-categories-legend');
    const sorted = Object.entries(agg.byCategory).sort((a, b) => b[1] - a[1]);

    if (legend) {
        legend.innerHTML = sorted.length === 0
            ? '<div class="pie-empty">Нет данных для категорий</div>'
            : sorted.map(([cat, sum], i) => {
                const percent = agg.gross > 0 ? Math.round((sum / agg.gross) * 100) : 0;
                const color = PIE_COLORS[i % PIE_COLORS.length];
                return `
                    <div class="pie-legend-row">
                        <span class="pie-legend-label"><span class="pie-dot" style="background:${color}"></span>${escapeHtml(cat)}</span>
                        <span>${percent}% • ${sum.toLocaleString('ru-RU')} ₽</span>
                    </div>
                `;
            }).join('');
    }

    if (!canvas || typeof Chart === 'undefined') return;
    if (sorted.length === 0) {
        if (analyticsPieChart) { analyticsPieChart.destroy(); analyticsPieChart = null; }
        return;
    }

    const labels = sorted.map(i => i[0]);
    const data = sorted.map(i => i[1]);
    const key = labels.join('|');
    if (analyticsPieChart && analyticsPieChart.$key === key) {
        analyticsPieChart.data.datasets[0].data = data;
        analyticsPieChart.update('none');
        return;
    }
    if (analyticsPieChart) analyticsPieChart.destroy();
    analyticsPieChart = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: labels.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '75%'
        }
    });
    analyticsPieChart.$key = key;
}

function renderAnalyticsTables(agg) {
    renderAggTable('analytics-main-table-body', Object.values(agg.rowsMain), 'Нет основных записей за этот период');
    renderAggTable('analytics-frames-table-body', Object.values(agg.rowsFrames), 'Нет записей по контейнерам за этот период');
}

function renderAggTable(tbodyId, rows, emptyText) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="table-empty">${emptyText}</td></tr>`;
        return;
    }
    tbody.innerHTML = rows
        .sort((a, b) => b.totalSum - a.totalSum)
        .map(r => `
            <tr>
                <td>${escapeHtml(r.category)}</td>
                <td>${escapeHtml(r.name)}</td>
                <td>${r.quantity}</td>
                <td>${r.totalSum.toLocaleString('ru-RU')} ₽</td>
            </tr>
        `).join('');
}

/* ============================================================
   13. НАСТРОЙКИ
   ============================================================ */
function initThemeEvents() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    const refreshChartsForTheme = () => {
        [goalChart, earningsChart, analyticsDaysChart, analyticsMonthsChart].forEach((c) => c?.destroy());
        goalChart = null;
        earningsChart = null;
        analyticsDaysChart = null;
        analyticsMonthsChart = null;
        scheduleRender('summary', 'analytics');
    };

    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.checked = theme === 'dark';
    };

    applyTheme(localStorage.getItem('theme') || 'dark');

    themeToggle.addEventListener('change', () => {
        applyTheme(themeToggle.checked ? 'dark' : 'light');
        refreshChartsForTheme();
    });
}

function initSettingsEvents() {
    const targetInput = document.getElementById('target-income-input');
    const taxInput = document.getElementById('tax-rate-input');
    const saveBtn = document.getElementById('save-settings-btn');

    if (targetInput) targetInput.value = targetIncome;
    if (taxInput) taxInput.value = Math.round(taxRate * 1000) / 10;

    saveBtn?.addEventListener('click', () => {
        const newTarget = Number(targetInput?.value);
        const newTax = Number(taxInput?.value);
        if (!Number.isFinite(newTarget) || newTarget < 0) {
            alert('Введите корректную цель по доходу.');
            return;
        }
        if (!Number.isFinite(newTax) || newTax < 0 || newTax > 100) {
            alert('Налог должен быть от 0 до 100%.');
            return;
        }
        targetIncome = newTarget;
        taxRate = newTax / 100;
        localStorage.setItem('target_income', String(targetIncome));
        localStorage.setItem('tax_rate', String(taxRate));
        scheduleRender('summary', 'analytics');
        alert('Настройки сохранены.');
    });
}

/* ============================================================
   14. ЭКСПОРТ / ИМПОРТ
   ============================================================ */
function initExportImportEvents() {
    document.getElementById('export-btn')?.addEventListener('click', () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
            services: currentServices,
            entries: entries
        }, null, 2));
        const a = document.createElement('a');
        a.setAttribute('href', dataStr);
        a.setAttribute('download', `backup_${toISODate(new Date())}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = (ev) => {
                try {
                    const content = JSON.parse(ev.target.result);

                    if (Array.isArray(content)) {
                        // Импорт старого формата: просто список услуг
                        const processed = sanitizeServices(content).map((item, index) => ({
                            id: item.id || ('srv_imp_' + Date.now() + '_' + index),
                            category: item.category || 'Общие',
                            name: item.name || 'Работа',
                            price: Number(item.price) || 0,
                            isFixed: !!item.isFixed,
                            is_tax_free: !!item.is_tax_free
                        }));
                        currentServices = processed;
                        services = JSON.parse(JSON.stringify(currentServices));
                        alert('Каталог успешно импортирован!');
                    } else if (content && typeof content === 'object') {
                        if (Array.isArray(content.services)) {
                            currentServices = sanitizeServices(content.services).map((item, index) => ({
                                id: item.id || ('srv_imp_' + Date.now() + '_' + index),
                                category: item.category || 'Общие',
                                name: item.name || 'Работа',
                                price: Number(item.price) || 0,
                                isFixed: !!item.isFixed,
                                is_tax_free: !!item.is_tax_free
                            }));
                            services = JSON.parse(JSON.stringify(currentServices));
                        }
                        if (Array.isArray(content.entries)) {
                            entries = content.entries;
                        }
                        alert('Данные успешно импортированы!');
                    }

                    saveLocalBackup();
                    populateCategoryDropdowns();
                    renderCatalog();
                    scheduleRender('summary', 'history', 'day', 'analytics');
                } catch (err) {
                    alert('Ошибка при чтении файла: ' + err.message);
                    console.error(err);
                }
            };
        };
        input.click();
    });

    document.getElementById('reset-btn')?.addEventListener('click', () => {
        const confirmed = confirm('Вы уверены? Все записи, расценки и настройки будут удалены безвозвратно.');
        if (!confirmed) return;

        ['services', 'app_services', 'piecework_services', 'app_entries', 'target_income', 'tax_rate']
            .forEach((key) => localStorage.removeItem(key));

        location.reload();
    });
}

/* ============================================================
   15. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ============================================================ */
function setIfExists(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}