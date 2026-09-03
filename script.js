// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ
// ==========================================
let entries = [];
let services = [];
let currentServices = []; 
let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let currentDashboardMode = 'month'; 

let monthlySummaryDate = new Date();

let showAllHistory = false;
let barChartInstance = null;
let goalChartInstance = null; 
const TARGET_INCOME = 100000; 

const TAX_RATE = 0.13; 

// Жестко зафиксированные контейнеры (не редактируются и не удаляются)
const FIXED_CONTAINERS = [
    { id: 'fixed_container_3', category: 'Контейнеры', name: 'контейнер на 3', price: 3333, isFixed: true },
    { id: 'fixed_container_4', category: 'Контейнеры', name: 'контейнер на 4', price: 2500, isFixed: true },
    { id: 'fixed_container_fenced', category: 'Контейнеры', name: 'контейнер с ограждениями', price: 3750, isFixed: true },
    { id: 'fixed_container_tanks_3', category: 'Контейнеры', name: 'контейнер с баками на 3', price: 2500, isFixed: true },
    { id: 'fixed_container_tanks_4', category: 'Контейнеры', name: 'контейнер с баками на 4', price: 1750, isFixed: true }
];

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    loadEntries();

    initTabs();
    initCalendarEvents();
    initCatalogEvents();
    initDashboardEvents();
    initMonthlySummaryEvents(); 
    initExportImportEvents();
    initContainerQuickAddEvents();

    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
    updateDayEntries();
    populateCategoryDropdowns();
    renderContainerCheckboxes();
    renderMonthlySummary(); 
});

// ==========================================
// 3. РАБОТА С ЛОКАЛЬНЫМ ХРАНИЛИЩЕМ
// ==========================================
function loadServices() {
    services = JSON.parse(localStorage.getItem('app_services') || '[]');

    FIXED_CONTAINERS.forEach(fc => {
        if (!services.some(s => String(s.id) === String(fc.id))) {
            services.push(fc);
        }
    });

    currentServices = JSON.parse(JSON.stringify(services));
}

function loadEntries() {
    entries = JSON.parse(localStorage.getItem('app_entries') || '[]');
}

function saveLocalBackup() {
    localStorage.setItem('app_services', JSON.stringify(currentServices));
    localStorage.setItem('app_entries', JSON.stringify(entries));
}

function findServiceById(serviceId) {
    if (!serviceId) return null;
    const fixed = FIXED_CONTAINERS.find(s => String(s.id) === String(serviceId));
    if (fixed) return fixed;
    return services.find(ser => String(ser.id) === String(serviceId));
}

// ==========================================
// 4. ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ==========================================
function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = document.getElementById(btn.dataset.tab + '-tab');
            if (targetTab) targetTab.classList.add('active');

            if (btn.dataset.tab === 'pricing') {
                renderCatalog();
            } else if (btn.dataset.tab === 'entries') {
                renderCalendar(currentDate);
                updateDayEntries();
                renderContainerCheckboxes();
            } else if (btn.dataset.tab === 'dashboard') {
                renderSummary();
                renderHistory();
            } else if (btn.dataset.tab === 'monthly-summary') {
                renderMonthlySummary();
            }
        });
    });
}

// ==========================================
// 5. ДАШБОРД, СТАТИСТИКА И ИСТОРИЯ
// ==========================================
function initDashboardEvents() {
    document.getElementById('search-input')?.addEventListener('input', renderHistory);
    
    document.getElementById('show-more-btn')?.addEventListener('click', () => {
        showAllHistory = !showAllHistory;
        const btn = document.getElementById('show-more-btn');
        if (btn) btn.textContent = showAllHistory ? 'Свернуть' : 'Показать все';
        renderHistory();
    });

    document.querySelectorAll('.dashboard-header .period-tabs .p-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.dashboard-header .period-tabs .p-tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            currentDashboardMode = e.target.dataset.period;
            renderSummary();
            renderHistory();
        });
    });

    document.getElementById('prev-period')?.addEventListener('click', () => {
        shiftPeriod(-1);
    });
    document.getElementById('next-period')?.addEventListener('click', () => {
        shiftPeriod(1);
    });
}

function shiftPeriod(direction) {
    if (currentDashboardMode === 'day') {
        const d = new Date(selectedDateStr);
        d.setDate(d.getDate() + direction);
        selectedDateStr = d.toISOString().split('T')[0];
        currentDate = new Date(d);
    } else if (currentDashboardMode === 'month') {
        currentDate.setMonth(currentDate.getMonth() + direction);
    } else if (currentDashboardMode === 'year') {
        currentDate.setFullYear(currentDate.getFullYear() + direction);
    }
    renderSummary();
    renderCalendar(currentDate);
    renderHistory();
}

function isTaxableService(service) {
    if (!service) return true;
    if (service.is_tax_free === true || (service.category || '').toLowerCase().includes('контейнер') || service.isFixed) {
        return false;
    }
    return true;
}

function renderSummary() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const periodLabelEl = document.getElementById('current-period-label');
    if (periodLabelEl) {
        if (currentDashboardMode === 'day') {
            const dObj = new Date(selectedDateStr);
            periodLabelEl.textContent = dObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        } else if (currentDashboardMode === 'month') {
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            periodLabelEl.textContent = `${monthNames[month]} ${year}`;
        } else if (currentDashboardMode === 'year') {
            periodLabelEl.textContent = `${year} год`;
        }
    }

    const filteredEntries = entries.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        if (currentDashboardMode === 'day') {
            return e.date === selectedDateStr;
        } else if (currentDashboardMode === 'month') {
            return d.getMonth() === month && d.getFullYear() === year;
        } else if (currentDashboardMode === 'year') {
            return d.getFullYear() === year;
        }
        return true;
    });

    let totalGross = 0;
    let totalTaxableGross = 0;
    let totalContainersSum = 0;

    filteredEntries.forEach(e => {
        const s = findServiceById(e.service_id);
        const name = e.name || (s ? s.name : 'Работа');
        const category = s ? (s.category || 'Общие') : (e.category || 'Общие');
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const sum = (e.quantity || 1) * price;

        totalGross += sum;
        if (!s || isTaxableService(s)) {
            totalTaxableGross += sum;
        }

        const catLower = category.toLowerCase();
        const nameLower = name.toLowerCase();
        const sIdStr = e.service_id ? String(e.service_id).toLowerCase() : '';

        const isContainer = 
            catLower.includes('контейнер') || 
            nameLower.includes('контейнер') ||
            sIdStr.includes('container') ||
            sIdStr.includes('fixed_container');

        if (isContainer) {
            totalContainersSum += sum;
        }
    });

    const tax = totalTaxableGross * TAX_RATE;
    const net = totalGross - tax;

    const grossEl = document.getElementById('dash-gross');
    const taxEl = document.getElementById('dash-tax');
    const netEl = document.getElementById('dash-net');
    const containersSumEl = document.getElementById('dash-containers-sum');

    if (grossEl) grossEl.textContent = totalGross.toLocaleString('ru-RU') + ' ₽';
    if (taxEl) taxEl.textContent = tax.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
    if (netEl) netEl.textContent = net.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
    if (containersSumEl) containersSumEl.textContent = totalContainersSum.toLocaleString('ru-RU') + ' ₽';

    renderCharts(year);
    renderGoalChart(totalGross);
}

function renderGoalChart(grossAmount) {
    const chartCanvas = document.getElementById('goalChart');
    if (!chartCanvas || typeof Chart === 'undefined') return;
    const ctx = chartCanvas.getContext('2d');

    const remaining = Math.max(0, TARGET_INCOME - grossAmount);
    const percentage = Math.min(100, Math.round((grossAmount / TARGET_INCOME) * 100));

    const amountEl = document.getElementById('goal-text-amount');
    const percentEl = document.getElementById('goal-text-percent');
    
    if (amountEl) amountEl.textContent = `${grossAmount.toLocaleString('ru-RU')} ₽ / ${TARGET_INCOME.toLocaleString('ru-RU')} ₽`;
    if (percentEl) percentEl.textContent = `${percentage}% выполнено`;

    if (goalChartInstance) {
        goalChartInstance.destroy();
    }

    goalChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [grossAmount, remaining],
                backgroundColor: [
                    '#43c6b8',
                    'rgba(255, 255, 255, 0.05)'
                ],
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
                        label: function(context) {
                            return ' ' + context.raw.toLocaleString('ru-RU') + ' ₽';
                        }
                    }
                }
            },
            cutout: '75%'
        }
    });
}

function renderCharts(year) {
    const chartArea = document.getElementById('chart-area');
    if (!chartArea || typeof Chart === 'undefined') return;

    chartArea.innerHTML = '<canvas id="periodBarChart" style="max-height: 100%; width: 100%;"></canvas>';
    const canvas = document.getElementById('periodBarChart');
    const ctxBar = canvas.getContext('2d');

    const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
    const monthlyData = Array(12).fill(0);

    entries.forEach(e => {
        if (!e.date) return;
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            const s = findServiceById(e.service_id);
            const price = e.price !== undefined ? e.price : (s ? s.price : 0);
            monthlyData[d.getMonth()] += (e.quantity || 1) * price;
        }
    });

    if (barChartInstance) {
        barChartInstance.destroy();
    }

    barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [{
                label: 'Доход (₽)',
                data: monthlyData,
                backgroundColor: '#43c6b8',
                hoverBackgroundColor: '#389088',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#6b8a90', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#6b8a90', font: { size: 10 } }
                }
            }
        }
    });
}

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const query = (document.getElementById('search-input')?.value || '').toLowerCase();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    let periodFiltered = entries.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        if (currentDashboardMode === 'day') {
            return e.date === selectedDateStr;
        } else if (currentDashboardMode === 'month') {
            return d.getMonth() === month && d.getFullYear() === year;
        } else if (currentDashboardMode === 'year') {
            return d.getFullYear() === year;
        }
        return true;
    });

    let sorted = [...periodFiltered].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (query) {
        sorted = sorted.filter(e => {
            const s = findServiceById(e.service_id);
            const name = e.name || (s ? s.name : '');
            return name.toLowerCase().includes(query) || (e.project || '').toLowerCase().includes(query);
        });
    }

    let display = showAllHistory ? sorted : sorted.slice(0, 8);

    if (display.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted); padding: 15px;">Нет записей за выбранный период</td></tr>';
        return;
    }

    let html = '';
    display.forEach(e => {
        const s = findServiceById(e.service_id);
        const name = e.name || (s ? s.name : 'Работа');
        const category = s ? (s.category || 'Общие') : (e.category || 'Общие');
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const gross = (e.quantity || 1) * price;
        const dateStr = e.date ? new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '';

        html += `
            <tr>
                <td>${dateStr}</td>
                <td>${escapeHtml(category)}</td>
                <td>${escapeHtml(name)}</td>
                <td>${e.quantity || 1}</td>
                <td>${gross.toLocaleString('ru-RU')} ₽</td>
                <td><button class="icon-btn" onclick="deleteEntry('${e.id}')">🗑</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==========================================
// 5.1. ЛОГИКА «ИТОГ ЗА МЕСЯЦ»
// ==========================================
function initMonthlySummaryEvents() {
    document.getElementById('ms-prev-month')?.addEventListener('click', () => {
        monthlySummaryDate.setMonth(monthlySummaryDate.getMonth() - 1);
        renderMonthlySummary();
    });
    document.getElementById('ms-next-month')?.addEventListener('click', () => {
        monthlySummaryDate.setMonth(monthlySummaryDate.getMonth() + 1);
        renderMonthlySummary();
    });
}

function renderMonthlySummary() {
    const year = monthlySummaryDate.getFullYear();
    const month = monthlySummaryDate.getMonth();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    
    const labelEl = document.getElementById('ms-period-label');
    if (labelEl) labelEl.textContent = `${monthNames[month]} ${year}`;

    const periodEntries = entries.filter(e => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return d.getMonth() === month && d.getFullYear() === year;
    });

    let totalGross = 0;
    let totalTaxableGross = 0;

    const aggregatedMainMap = {};
    const aggregatedFramesMap = {};

    periodEntries.forEach(e => {
        const s = findServiceById(e.service_id);
        
        let category = 'Единичная';
        let name = 'Работа';

        if (s) {
            category = s.category || 'Общие';
            name = s.name || 'Работа';
        } else {
            if (e.name) name = e.name;
            if (e.category) category = e.category;
        }

        const catLower = category.toLowerCase();
        const nameLower = name.toLowerCase();
        const sIdStr = e.service_id ? String(e.service_id).toLowerCase() : '';

        const isContainer = 
            catLower.includes('контейнер') || 
            nameLower.includes('контейнер') ||
            sIdStr.includes('container') ||
            sIdStr.includes('fixed_container');

        if (isContainer) {
            category = 'Контейнеры';
        }

        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const qty = e.quantity || 1;
        const sum = qty * price;

        totalGross += sum;
        if (!s || isTaxableService(s)) {
            totalTaxableGross += sum;
        }

        const targetMap = isContainer ? aggregatedFramesMap : aggregatedMainMap;
        const key = `${category}___${name}`;

        if (!targetMap[key]) {
            targetMap[key] = {
                category: category,
                name: name,
                quantity: 0,
                totalSum: 0
            };
        }
        targetMap[key].quantity += qty;
        targetMap[key].totalSum += sum;
    });

    const tax = totalTaxableGross * TAX_RATE;
    const net = totalGross - tax;

    const msGrossEl = document.getElementById('ms-total-gross');
    const msTaxEl = document.getElementById('ms-total-tax');
    const msNetEl = document.getElementById('ms-total-net');

    if (msGrossEl) msGrossEl.textContent = totalGross.toLocaleString('ru-RU') + ' ₽';
    if (msTaxEl) msTaxEl.textContent = tax.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
    if (msNetEl) msNetEl.textContent = net.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';

    const tbodyMain = document.getElementById('ms-table-body');
    if (tbodyMain) {
        const mainList = Object.values(aggregatedMainMap);
        if (mainList.length === 0) {
            tbodyMain.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 15px;">Нет основных записей за этот месяц</td></tr>';
        } else {
            let html = '';
            mainList.sort((a, b) => b.totalSum - a.totalSum).forEach(item => {
                html += `
                    <tr>
                        <td>${escapeHtml(item.category)}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${item.quantity}</td>
                        <td>${item.totalSum.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                `;
            });
            tbodyMain.innerHTML = html;
        }
    }

    const tbodyFrames = document.getElementById('ms-frames-table-body');
    if (tbodyFrames) {
        const framesList = Object.values(aggregatedFramesMap);
        if (framesList.length === 0) {
            tbodyFrames.innerHTML = '<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding: 15px;">Нет записей по контейнерам за этот месяц</td></tr>';
        } else {
            let html = '';
            framesList.sort((a, b) => b.totalSum - a.totalSum).forEach(item => {
                html += `
                    <tr>
                        <td>${escapeHtml(item.category)}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td>${item.quantity}</td>
                        <td>${item.totalSum.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                `;
            });
            tbodyFrames.innerHTML = html;
        }
    }
}

// ==========================================
// 6. КАЛЕНДАРЬ И УПРАВЛЕНИЕ ЗАПИСЯМИ ДНЯ
// ==========================================
function initCalendarEvents() {
    document.getElementById('cal-prev')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });
    document.getElementById('cal-next')?.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    document.getElementById('add-from-catalog-btn')?.addEventListener('click', addWorkFromCatalog);
    document.getElementById('add-single-work-btn')?.addEventListener('click', addSingleWork);

    document.getElementById('cat-select')?.addEventListener('change', (e) => {
        const cat = e.target.value;
        const posSelect = document.getElementById('pos-select');
        if (!posSelect) return;
        posSelect.innerHTML = '<option value="">— Выбрать —</option>';
        
        const filteredServices = currentServices.filter(s => s.category === cat);
        filteredServices.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            posSelect.appendChild(opt);
        });
    });

    document.getElementById('pos-select')?.addEventListener('change', (e) => {
        const serviceId = e.target.value;
        const s = currentServices.find(ser => String(ser.id) === String(serviceId));
        const priceInput = document.getElementById('cat-work-price');
        if (s && priceInput) {
            priceInput.value = s.price;
        }
    });
}

function populateCategoryDropdowns() {
    const catSelect = document.getElementById('cat-select');
    if (!catSelect) return;
    catSelect.innerHTML = '<option value="">— Выбрать —</option>';

    const categories = [...new Set(currentServices.map(s => s.category || 'Общие'))];
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    });
}

function renderCalendar(dateObj) {
    const grid = document.getElementById('calendar-grid');
    const title = document.getElementById('selected-date-title');
    if (!grid) return;

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    if (title) title.textContent = `${monthNames[month]} ${year}`;

    grid.innerHTML = '';
    const daysOfWeek = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    daysOfWeek.forEach(d => {
        const head = document.createElement('div');
        head.className = 'calendar-day-head';
        head.textContent = d;
        grid.appendChild(head);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const adjustedIndex = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < adjustedIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;

        const mStr = String(month + 1).padStart(2, '0');
        const dStr = String(day).padStart(2, '0');
        const dateString = `${year}-${mStr}-${dStr}`;

        const dayEntries = entries.filter(e => e.date === dateString);
        if (dayEntries.length > 0) {
            cell.classList.add('has-entries');
        }

        if (dateString === selectedDateStr) {
            cell.classList.add('selected');
        }

        cell.addEventListener('click', () => {
            selectedDateStr = dateString;
            document.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
            cell.classList.add('selected');
            updateDayEntries();
        });

        grid.appendChild(cell);
    }
}

function updateDayEntries() {
    const listContainer = document.getElementById('day-entries-list');
    if (!listContainer) return;

    const dayEntries = entries.filter(e => e.date === selectedDateStr);
    if (dayEntries.length === 0) {
        listContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 10px;">Нет записей за выбранный день</div>';
        return;
    }

    let html = '';
    dayEntries.forEach(e => {
        const s = findServiceById(e.service_id);
        const name = e.name || (s ? s.name : 'Неизвестная работа');
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const sum = (e.quantity || 1) * price;

        html += `
            <div class="entry-item-row">
                <span class="entry-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
                <span class="entry-qty">${e.quantity || 1} шт.</span>
                <span class="entry-price">${sum.toLocaleString('ru-RU')} ₽</span>
                <button class="icon-btn" onclick="deleteEntry('${e.id}')">🗑</button>
            </div>
        `;
    });
    listContainer.innerHTML = html;
}

function addWorkFromCatalog() {
    const posSelect = document.getElementById('pos-select');
    const qtyInput = document.getElementById('cat-work-qty');
    const priceInput = document.getElementById('cat-work-price');

    if (!posSelect || !posSelect.value) {
        alert('Выберите позицию из каталога');
        return;
    }

    const serviceId = posSelect.value;
    const s = findServiceById(serviceId);
    const qty = parseInt(qtyInput?.value) || 1;
    const price = parseFloat(priceInput?.value) || (s ? s.price : 0);

    const newEntry = {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: selectedDateStr,
        service_id: serviceId,
        name: s ? s.name : '',
        category: s ? s.category : '',
        quantity: qty,
        price: price
    };

    entries.push(newEntry);
    saveLocalBackup();
    updateDayEntries();
    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
    renderMonthlySummary();
}

function addSingleWork() {
    const nameInput = document.getElementById('single-work-name');
    const qtyInput = document.getElementById('single-work-qty');
    const priceInput = document.getElementById('single-work-price');

    const name = nameInput?.value.trim();
    if (!name) {
        alert('Введите название работы');
        return;
    }

    const qty = parseInt(qtyInput?.value) || 1;
    const price = parseFloat(priceInput?.value) || 0;

    const newEntry = {
        id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        date: selectedDateStr,
        name: name,
        category: 'Единичная',
        quantity: qty,
        price: price,
        service_id: null
    };

    entries.push(newEntry);
    saveLocalBackup();
    updateDayEntries();
    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
    renderMonthlySummary();

    if (nameInput) nameInput.value = '';
    if (qtyInput) qtyInput.value = '1';
    if (priceInput) priceInput.value = '';
}

function deleteEntry(id) {
    entries = entries.filter(e => String(e.id) !== String(id));
    saveLocalBackup();
    updateDayEntries();
    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
    renderMonthlySummary();
}

// ==========================================
// 6.1. БЫСТРЫЙ ВЫБОР КОНТЕЙНЕРОВ
// ==========================================
function renderContainerCheckboxes() {
    const containerListEl = document.getElementById('containers-checkboxes-list');
    if (!containerListEl) return;

    let html = '';
    FIXED_CONTAINERS.forEach((s) => {
        html += `
            <label class="checkbox-label" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; cursor: pointer; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px;">
                <div class="checkbox-left" style="display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" name="quick_container" value="${s.id}" style="accent-color: var(--accent, #43c6b8); width: 16px; height: 16px;">
                    <span style="color: var(--text-main, #fff); font-size: 14px;">${escapeHtml(s.name)}</span>
                </div>
                <span class="container-price" style="color: var(--text-muted, #8b9bb4); font-size: 14px;">(${s.price.toLocaleString('ru-RU')} ₽)</span>
            </label>
        `;
    });
    containerListEl.innerHTML = html;
}

function initContainerQuickAddEvents() {
    document.getElementById('add-containers-btn')?.addEventListener('click', () => {
        const checkedBoxes = document.querySelectorAll('input[name="quick_container"]:checked');
        if (checkedBoxes.length === 0) {
            alert('Выберите хотя бы один контейнер');
            return;
        }

        const qtyInput = document.getElementById('container-work-qty');
        const qty = parseInt(qtyInput?.value) || 1;

        checkedBoxes.forEach(cb => {
            const serviceId = cb.value;
            const s = findServiceById(serviceId);
            const containerPrice = s ? s.price : 0;

            const newEntry = {
                id: 'entry_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                date: selectedDateStr,
                service_id: serviceId,
                name: s ? s.name : 'Контейнер',
                category: 'Контейнеры',
                quantity: qty,
                price: containerPrice
            };
            entries.push(newEntry);
        });

        saveLocalBackup();
        updateDayEntries();
        renderSummary();
        renderHistory();
        renderCalendar(currentDate);
        renderMonthlySummary();

        if (qtyInput) qtyInput.value = '1';
    });
}

// ==========================================
// 7. КАТАЛОГ РАСЦЕНОК
// ==========================================
function initCatalogEvents() {
    document.getElementById('add-cat-btn')?.addEventListener('click', () => {
        const input = document.getElementById('new-cat-input');
        const catName = input?.value.trim();
        if (!catName) return;

        const existing = currentServices.some(s => s.category === catName);
        if (!existing) {
            currentServices.push({
                id: 'srv_' + Date.now(),
                category: catName,
                name: 'Новая позиция',
                price: 0
            });
            renderCatalog();
            if (input) input.value = '';
        }
    });

    document.getElementById('save-catalog-btn')?.addEventListener('click', () => {
        services = JSON.parse(JSON.stringify(currentServices));
        saveLocalBackup();
        populateCategoryDropdowns();
        renderSummary();
        alert('Каталог успешно сохранен!');
    });

    document.getElementById('reset-catalog-btn')?.addEventListener('click', () => {
        currentServices = JSON.parse(JSON.stringify(services));
        renderCatalog();
    });

    document.getElementById('catalog-search')?.addEventListener('input', renderCatalog);
}

function renderCatalog() {
    const container = document.getElementById('catalog-categories-container');
    if (!container) return;

    const query = (document.getElementById('catalog-search')?.value || '').toLowerCase();
    
    const categoriesMap = {};
    currentServices.forEach(s => {
        const cat = s.category || 'Общие';
        // Скрываем категорию «Контейнеры» из отображения в расценках
        if (cat.toLowerCase() === 'контейнеры') return;

        if (!categoriesMap[cat]) categoriesMap[cat] = [];
        categoriesMap[cat].push(s);
    });

    let html = '';
    const sortedCategories = Object.keys(categoriesMap).sort();

    sortedCategories.forEach(cat => {
        let items = categoriesMap[cat];
        if (query) {
            items = items.filter(s => s.name.toLowerCase().includes(query) || cat.toLowerCase().includes(query));
        }

        if (query && items.length === 0) return;

        html += `
            <div class="catalog-category-card" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 15px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 16px; color: var(--accent, #43c6b8);">${escapeHtml(cat)}</h3>
                    <button onclick="addNewServiceToCategory('${escapeHtml(cat)}')" style="background: rgba(67, 198, 184, 0.1); border: 1px solid var(--accent, #43c6b8); color: var(--accent, #43c6b8); padding: 6px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.background='var(--accent)'; this.style.color='#121824'" onmouseout="this.style.background='rgba(67, 198, 184, 0.1)'; this.style.color='var(--accent, #43c6b8)'">+ Добавить позицию</button>
                </div>
                <div class="catalog-items-list">
        `;

        items.forEach(s => {
            const isFixed = s.isFixed;
            html += `
                <div class="catalog-item-row" style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <input type="text" value="${escapeHtml(s.name)}" ${isFixed ? 'disabled' : ''} onchange="updateServiceName('${s.id}', this.value)" style="flex: 2; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px; color: #fff;">
                    <input type="number" value="${s.price}" ${isFixed ? 'disabled' : ''} onchange="updateServicePrice('${s.id}', this.value)" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 6px; color: #fff;">
                    <span style="color: var(--text-muted); font-size: 13px;">₽</span>
                    ${!isFixed ? `<button class="icon-btn" onclick="deleteService('${s.id}')">🗑</button>` : '<span style="font-size:11px; color:var(--text-muted);">(фиксир.)</span>'}
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<div style="text-align:center; color: var(--text-muted); padding: 20px;">Ничего не найдено</div>';
}

function addNewServiceToCategory(categoryName) {
    const newService = {
        id: 'srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        category: categoryName,
        name: 'Новая работа',
        price: 0
    };
    currentServices.push(newService);
    renderCatalog();
}

function updateServiceName(id, newName) {
    const s = currentServices.find(ser => String(ser.id) === String(id));
    if (s && !s.isFixed) {
        s.name = newName.trim();
    }
}

function updateServicePrice(id, newPrice) {
    const s = currentServices.find(ser => String(ser.id) === String(id));
    if (s && !s.isFixed) {
        s.price = parseFloat(newPrice) || 0;
    }
}

function deleteService(id) {
    currentServices = currentServices.filter(ser => String(ser.id) !== String(id));
    renderCatalog();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================
// 8. ИМПОРТ И ЭКСПОРТ ДАННЫХ
// ==========================================
function initExportImportEvents() {
    document.getElementById('export-btn')?.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
            services: currentServices,
            entries: entries
        }, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.readAsText(file, 'UTF-8');
            reader.onload = readerEvent => {
                try {
                    const content = JSON.parse(readerEvent.target.result);
                    
                    if (Array.isArray(content)) {
                        if (content.length > 0 && 'category' in content[0] && 'name' in content[0] && 'price' in content[0]) {
                            const processedServices = content.map((item, index) => ({
                                id: item.id || ('srv_imp_' + Date.now() + '_' + index),
                                category: item.category,
                                name: item.name,
                                price: item.price
                            }));
                            
                            currentServices = processedServices;
                            services = JSON.parse(JSON.stringify(processedServices));
                            saveLocalBackup();
                        } else {
                            throw new Error('Неверная структура элементов каталога');
                        }
                    } 
                    else if (content && typeof content === 'object') {
                        if (content.services) {
                            currentServices = content.services;
                            services = JSON.parse(JSON.stringify(content.services));
                        }
                        if (content.entries) {
                            entries = content.entries;
                        }
                        saveLocalBackup();
                    } else {
                        throw new Error('Неизвестный формат данных');
                    }

                    alert('Данные успешно импортированы! Приложение перезагружается...');
                    location.reload();
                } catch (err) {
                    console.error('Import error:', err);
                    alert('Ошибка при чтении файла: проверьте структуру JSON');
                }
            };
        };
        input.click();
    });
}