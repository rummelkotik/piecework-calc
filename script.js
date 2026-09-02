// ==========================================
// 1. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И НАСТРОЙКИ
// ==========================================
let entries = [];
let services = [];
let currentServices = []; // Локальная копия для каталога
let currentDate = new Date();
let selectedDateStr = new Date().toISOString().split('T')[0];
let currentDashboardMode = 'month'; // 'day', 'month', 'year'

let showAllHistory = false;
let barChartInstance = null;

const API_ENTRIES = '/api/entries';
const API_SERVICES = '/api/services';
const TAX_RATE = 0.13; // Налог 13%

// ==========================================
// 2. ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadServices();
    await loadEntries();

    initTabs();
    initCalendarEvents();
    initCatalogEvents();
    initDashboardEvents();
    initExportImportEvents();

    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
    updateDayEntries();
    populateCategoryDropdowns();
});

// ==========================================
// 3. РАБОТА С API И ХРАНИЛИЩЕМ
// ==========================================
async function loadServices() {
    try {
        const res = await fetch(API_SERVICES);
        if (res.ok) {
            services = await res.json();
        } else {
            services = JSON.parse(localStorage.getItem('app_services') || '[]');
        }
    } catch (e) {
        console.warn('Сервер недоступен, используем локальные данные:', e);
        services = JSON.parse(localStorage.getItem('app_services') || '[]');
    }
    currentServices = JSON.parse(JSON.stringify(services));
}

async function loadEntries() {
    try {
        const res = await fetch(API_ENTRIES);
        if (res.ok) {
            entries = await res.json();
        } else {
            entries = JSON.parse(localStorage.getItem('app_entries') || '[]');
        }
    } catch (e) {
        console.warn('Сервер недоступен, используем локальные записи:', e);
        entries = JSON.parse(localStorage.getItem('app_entries') || '[]');
    }
}

function saveLocalBackup() {
    localStorage.setItem('app_services', JSON.stringify(currentServices));
    localStorage.setItem('app_entries', JSON.stringify(entries));
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
            } else if (btn.dataset.tab === 'dashboard') {
                renderSummary();
                renderHistory();
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

    document.getElementById('quick-add-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const checked = Array.from(document.querySelectorAll('input[name="container-type"]:checked')).map(c => c.value);
        if (checked.length === 0) return alert('Выберите хотя бы один тип контейнера');

        const qty = parseFloat(document.getElementById('quick-qty')?.value) || 1;
        const project = document.getElementById('quick-project')?.value || '';

        for (const type of checked) {
            await createEntry({ service_id: null, name: type, quantity: qty, project: project, price: 0 });
        }
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
    if (service.is_tax_free === true || service.category === 'Контейнеры') {
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

    filteredEntries.forEach(e => {
        const s = services.find(ser => String(ser.id) === String(e.service_id));
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const sum = (e.quantity || 1) * price;

        totalGross += sum;
        if (!s || isTaxableService(s)) {
            totalTaxableGross += sum;
        }
    });

    const tax = totalTaxableGross * TAX_RATE;
    const net = totalGross - tax;

    const grossEl = document.getElementById('dash-gross');
    const taxEl = document.getElementById('dash-tax');
    const netEl = document.getElementById('dash-net');
    const countEl = document.getElementById('dash-count');

    if (grossEl) grossEl.textContent = totalGross.toLocaleString('ru-RU') + ' ₽';
    if (taxEl) taxEl.textContent = tax.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
    if (netEl) netEl.textContent = net.toLocaleString('ru-RU', { maximumFractionDigits: 0 }) + ' ₽';
    if (countEl) countEl.textContent = filteredEntries.length;

    renderCharts(year);
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
        const d = new Date(e.date);
        if (d.getFullYear() === year) {
            const s = services.find(ser => String(ser.id) === String(e.service_id));
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
            const s = services.find(ser => String(ser.id) === String(e.service_id));
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
        const s = services.find(ser => String(ser.id) === String(e.service_id));
        const name = e.name || (s ? s.name : 'Неизвестно');
        const category = s ? (s.category || 'Общие') : 'Единичная';
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const gross = (e.quantity || 1) * price;
        const dateStr = new Date(e.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

        html += `
            <tr>
                <td>${dateStr}</td>
                <td>${category}</td>
                <td>${name}</td>
                <td>${e.quantity || 1}</td>
                <td>${gross.toLocaleString('ru-RU')} ₽</td>
                <td><button class="icon-btn" onclick="deleteEntry('${e.id}')">🗑</button></td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==========================================
// 6. КАЛЕНДАРЬ И ФОРМЫ УЧЁТА
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

    document.getElementById('cat-select')?.addEventListener('change', (e) => {
        const catName = e.target.value;
        const posSelect = document.getElementById('pos-select');
        if (!posSelect) return;

        posSelect.innerHTML = '<option value="">— Выбрать —</option>';
        const filtered = currentServices.filter(s => (s.category || 'Общие') === catName);

        filtered.forEach(s => {
            const opt = document.createElement('option');
            opt.value = String(s.id);
            opt.textContent = s.name;
            posSelect.appendChild(opt);
        });
    });

    document.getElementById('pos-select')?.addEventListener('change', (e) => {
        const val = e.target.value;
        const service = currentServices.find(s => String(s.id) === String(val));
        if (service) {
            const nameEl = document.getElementById('cat-work-name');
            const priceEl = document.getElementById('cat-work-price');
            if (nameEl) nameEl.value = service.name;
            if (priceEl) priceEl.value = service.price;
        }
    });

    const addCatalogBtn = document.getElementById('add-from-catalog-btn');
    if (addCatalogBtn) {
        addCatalogBtn.onclick = async (e) => {
            e.preventDefault();
            const posSelect = document.getElementById('pos-select');
            const serviceId = posSelect ? posSelect.value : null;
            const qtyEl = document.getElementById('cat-work-qty');
            const priceEl = document.getElementById('cat-work-price');

            const name = posSelect && posSelect.selectedIndex >= 0 ? posSelect.options[posSelect.selectedIndex]?.text : '';
            const qty = parseFloat(qtyEl?.value) || 1;
            const price = parseFloat(priceEl?.value) || 0;

            if (!name || name === '— Выбрать —') return alert('Выберите позицию из каталога');

            await createEntry({ 
                service_id: serviceId ? (isNaN(serviceId) ? serviceId : Number(serviceId)) : null, 
                name: name, 
                quantity: qty, 
                price: price 
            });
        };
    }

    const addSingleBtn = document.getElementById('add-single-work-btn');
    if (addSingleBtn) {
        addSingleBtn.onclick = async (e) => {
            e.preventDefault();
            const nameEl = document.getElementById('single-work-name');
            const qtyEl = document.getElementById('single-work-qty');
            const priceEl = document.getElementById('single-work-price');

            const name = nameEl?.value;
            const qty = parseFloat(qtyEl?.value) || 1;
            const price = parseFloat(priceEl?.value) || 0;

            if (!name) return alert('Укажите название работы');
            await createEntry({ service_id: null, name, quantity: qty, price });

            if (nameEl) nameEl.value = '';
        };
    }
}

function renderCalendar(date) {
    const calendarGrid = document.getElementById('calendar-grid');
    if (!calendarGrid) return;

    calendarGrid.innerHTML = '';
    const year = date.getFullYear();
    const month = date.getMonth();

    const dateTitle = document.getElementById('selected-date-title');
    if (dateTitle) {
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        dateTitle.textContent = `${monthNames[month]} ${year}`;
    }

    const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekDays.forEach(dayName => {
        const headCell = document.createElement('div');
        headCell.className = 'calendar-day-head';
        headCell.textContent = dayName;
        calendarGrid.appendChild(headCell);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startingDay = (firstDay === 0 ? 6 : firstDay - 1);

    for (let i = 0; i < startingDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        dayCell.textContent = day;

        if (formattedDate === selectedDateStr) dayCell.classList.add('selected');
        if (entries.some(e => e.date === formattedDate)) dayCell.classList.add('has-entries');

        dayCell.addEventListener('click', () => {
            document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected'));
            dayCell.classList.add('selected');
            selectedDateStr = formattedDate;

            updateDayEntries();
        });

        calendarGrid.appendChild(dayCell);
    }
}

async function createEntry(data) {
    const payload = { ...data, date: selectedDateStr, id: Date.now() };
    try {
        const res = await fetch(API_ENTRIES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const saved = await res.json().catch(() => null);
            if (saved && saved.id) {
                entries.push(saved);
            } else {
                entries.push(payload);
            }
        } else {
            entries.push(payload);
        }
    } catch (e) {
        entries.push(payload);
    }
    saveLocalBackup();
    updateDayEntries();
    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
}

function updateDayEntries() {
    const container = document.getElementById('day-entries-list');
    if (!container) return;

    const dayEntries = entries.filter(e => e.date === selectedDateStr);
    if (dayEntries.length === 0) {
        container.innerHTML = '<p class="empty-state" style="text-align:center; color: var(--text-muted); padding: 12px;">Нет позиций за этот день</p>';
        return;
    }

    container.innerHTML = dayEntries.map(e => {
        const s = services.find(ser => String(ser.id) === String(e.service_id));
        const name = e.name || (s ? s.name : 'Работа');
        const price = e.price !== undefined ? e.price : (s ? s.price : 0);
        const total = (e.quantity || 1) * price;

        return `
            <div class="entry-item-row">
                <span class="entry-name">${name}</span>
                <span class="entry-qty">${e.quantity || 1} шт.</span>
                <span class="entry-price">${total.toLocaleString('ru-RU')} ₽</span>
                <button class="icon-btn" onclick="deleteEntry('${e.id}')">🗑</button>
            </div>
        `;
    }).join('');
}

async function deleteEntry(id) {
    if (!confirm('Удалить запись?')) return;
    try {
        await fetch(`${API_ENTRIES}/${id}`, { method: 'DELETE' });
    } catch (e) {
        // Локальное удаление при сбое сервера
    }
    entries = entries.filter(e => String(e.id) !== String(id));
    saveLocalBackup();
    updateDayEntries();
    renderSummary();
    renderHistory();
    renderCalendar(currentDate);
}

// ==========================================
// 7. РАСЦЕНКИ / КАТАЛОГ
// ==========================================
function renderCatalog() {
    const container = document.getElementById('catalog-categories-container');
    if (!container) return;

    const query = (document.getElementById('catalog-search')?.value || '').toLowerCase();
    const categories = [...new Set(currentServices.map(s => s.category || 'Без категории'))];

    let totalPositions = 0;
    container.innerHTML = '';

    categories.forEach(cat => {
        const catServices = currentServices.filter(s =>
            (s.category || 'Без категории') === cat &&
            s.name.toLowerCase().includes(query)
        );

        totalPositions += catServices.length;

        const catBlock = document.createElement('div');
        catBlock.className = 'catalog-cat-block';
        
        catBlock.innerHTML = `
            <div class="cat-header">
                <span class="cat-title">${cat} (${catServices.length})</span>
                <div class="cat-actions">
                    <button class="icon-btn" onclick="renameCategory('${cat}')">✏️</button>
                    <button class="icon-btn" onclick="deleteCategory('${cat}')">🗑</button>
                </div>
            </div>
            <div class="cat-items-list">
                ${catServices.map(s => `
                    <div class="catalog-card-item" data-id="${s.id}">
                        <input type="text" 
                               class="v2-input inline-name" 
                               value="${s.name}" 
                               onchange="updateServiceItem('${s.id}', 'name', this.value)">
                        <div class="price-input-wrapper">
                            <input type="number" 
                                   class="v2-input inline-price" 
                                   value="${s.price}" 
                                   onchange="updateServiceItem('${s.id}', 'price', parseFloat(this.value) || 0)">
                            <span class="currency">₽</span>
                        </div>
                        <button class="icon-btn" onclick="deleteServiceItem('${s.id}')">🗑</button>
                    </div>
                `).join('')}
                <div class="add-item-inline">
                    <input type="text" placeholder="Название..." class="v2-input new-item-name" id="new-name-${cat}">
                    <input type="number" placeholder="₽" class="v2-input new-item-price" id="new-price-${cat}">
                    <button class="v2-primary-btn small-btn" onclick="addPositionToCategory('${cat}')">+</button>
                </div>
            </div>
        `;
        container.appendChild(catBlock);
    });

    const stats = document.getElementById('catalog-stats');
    if (stats) {
        stats.textContent = `Позиций: ${totalPositions} | Категорий: ${categories.length}`;
    }
}

function initCatalogEvents() {
    document.getElementById('add-cat-btn')?.addEventListener('click', () => {
        const input = document.getElementById('new-cat-input');
        const catName = input?.value.trim();

        if (!catName) return alert('Введите название категории');
        if (currentServices.some(s => s.category === catName)) return alert('Такая категория уже существует');

        currentServices.push({
            id: Date.now(),
            category: catName,
            name: 'Новая позиция',
            price: 0
        });

        if (input) input.value = '';
        renderCatalog();
        populateCategoryDropdowns();
    });

    document.getElementById('catalog-search')?.addEventListener('input', renderCatalog);

    document.getElementById('save-catalog-btn')?.addEventListener('click', async () => {
        try {
            const res = await fetch(API_SERVICES, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentServices)
            });

            if (res.ok) {
                const updated = await res.json().catch(() => null);
                services = updated && Array.isArray(updated) ? updated : JSON.parse(JSON.stringify(currentServices));
                saveLocalBackup();
                alert('Изменения успешно сохранены!');
            } else {
                services = JSON.parse(JSON.stringify(currentServices));
                saveLocalBackup();
                alert('Сохранено локально');
            }
        } catch (e) {
            services = JSON.parse(JSON.stringify(currentServices));
            saveLocalBackup();
            alert('Сохранено локально в браузере');
        }

        renderCatalog();
        populateCategoryDropdowns();
    });

    document.getElementById('reset-catalog-btn')?.addEventListener('click', () => {
        if (confirm('Сбросить несохранённые изменения в каталоге?')) {
            currentServices = JSON.parse(JSON.stringify(services));
            renderCatalog();
            populateCategoryDropdowns();
        }
    });
}

function addPositionToCategory(category) {
    const nameEl = document.getElementById(`new-name-${category}`);
    const priceEl = document.getElementById(`new-price-${category}`);

    const name = nameEl?.value.trim();
    const price = parseFloat(priceEl?.value) || 0;

    if (!name) return alert('Введите название позиции');

    currentServices.push({
        id: Date.now(),
        category: category,
        name: name,
        price: price
    });

    renderCatalog();
    populateCategoryDropdowns();
}

function updateServiceItem(id, field, value) {
    const item = currentServices.find(s => String(s.id) === String(id));
    if (item) item[field] = value;
}

function renameCategory(oldName) {
    const newName = prompt('Введите новое название категории:', oldName);
    if (!newName || newName === oldName) return;

    currentServices.forEach(s => {
        if (s.category === oldName) s.category = newName;
    });

    renderCatalog();
    populateCategoryDropdowns();
}

function deleteServiceItem(id) {
    currentServices = currentServices.filter(s => String(s.id) !== String(id));
    renderCatalog();
    populateCategoryDropdowns();
}

function deleteCategory(category) {
    if (!confirm(`Удалить категорию "${category}" и все её позиции?`)) return;
    currentServices = currentServices.filter(s => s.category !== category);
    renderCatalog();
    populateCategoryDropdowns();
}

function populateCategoryDropdowns() {
    const catSelect = document.getElementById('cat-select');
    if (!catSelect) return;

    const currentCatValue = catSelect.value;
    const categories = [...new Set(currentServices.map(s => s.category || 'Общие'))];

    catSelect.innerHTML = '<option value="">— Выбрать —</option>';
    categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === currentCatValue) opt.selected = true;
        catSelect.appendChild(opt);
    });
}

// ==========================================
// 8. ИМПОРТ И ЭКСПОРТ ДАННЫХ (ИСПРАВЛЕНО)
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
                    
                    // Проверка: если файл — это просто массив расценок (как rates_flat.json)
                    if (Array.isArray(content)) {
                        currentServices = content;
                    } 
                    // Если это полноценный объект бэкапа
                    else if (content && typeof content === 'object') {
                        if (content.services && Array.isArray(content.services)) {
                            currentServices = content.services;
                        }
                        if (content.entries && Array.isArray(content.entries)) {
                            entries = content.entries;
                        }
                    } else {
                        throw new Error('Некорректный формат данных');
                    }

                    saveLocalBackup();
                    renderCatalog();
                    populateCategoryDropdowns();
                    renderSummary();
                    renderHistory();
                    renderCalendar(currentDate);
                    alert('Данные успешно импортированы!');
                } catch (err) {
                    console.error('Ошибка импорта:', err);
                    alert('Ошибка при чтении файла: убедитесь, что выбран корректный JSON-файл.');
                }
            };
        };
        input.click();
    });
}