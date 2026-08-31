const API_URL = 'http://localhost:3000/api';
let analyticsChart = null;
let allEntriesCache = [];

const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

// Инициализация графиков
function initChart() {
    const ctx = document.getElementById('analyticsChart').getContext('2d');
    analyticsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [{
                label: 'Валовый доход (₽)',
                data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                backgroundColor: '#0d9488',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// Загрузка прайса
async function loadServices() {
    const res = await fetch(`${API_URL}/services`);
    const services = await res.json();
    const select = document.getElementById('entry-service');
    const servicesList = document.getElementById('services-list');
    
    select.innerHTML = '<option value="">Выберите услугу...</option>';
    servicesList.innerHTML = '';
    
    services.forEach(s => {
        select.innerHTML += `<option value="${s.id}">${s.name} (${s.price} ₽)</option>`;
        servicesList.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                <span>${s.name} — <strong>${s.price} ₽</strong></span>
                <button class="btn-icon" title="Удалить" onclick="deleteService(${s.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
    });
}

// Загрузка и фильтрация журнала
async function loadEntries() {
    const res = await fetch(`${API_URL}/entries`);
    allEntriesCache = await res.json();
    renderDashboard();
}

function renderDashboard() {
    const tbody = document.getElementById('entries-list');
    const selectedMonth = document.getElementById('filter-month').value;
    
    tbody.innerHTML = '';
    
    let gross = 0;
    let monthlyStats = Array(12).fill(0);

    const filtered = allEntriesCache.filter(e => {
        // Заполнение данных для графика
        const monthIdx = new Date(e.date).getMonth();
        monthlyStats[monthIdx] += (e.quantity * e.price);

        if (!selectedMonth) return true;
        return e.date.startsWith(selectedMonth);
    });

    filtered.forEach(e => {
        const sum = e.quantity * e.price;
        const tax = sum * 0.04;
        const net = sum - tax;
        gross += sum;

        tbody.innerHTML += `
            <tr>
                <td><strong>${e.date}</strong></td>
                <td>${e.project || 'МойПроект'}</td>
                <td>${e.name}</td>
                <td>${e.price} ₽</td>
                <td>${e.quantity}</td>
                <td><strong>${sum.toLocaleString()} ₽</strong></td>
                <td class="text-muted">${Math.round(tax).toLocaleString()} ₽</td>
                <td class="text-accent"><strong>${Math.round(net).toLocaleString()} ₽</strong></td>
                <td style="text-align: right;">
                    <button class="btn-icon" title="Удалить" onclick="deleteEntry(${e.id})"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    // Расчет метрик
    const taxTotal = gross * 0.04;
    const netTotal = gross - taxTotal;
    const daysInMonth = 30;
    const avgDaily = gross / daysInMonth;
    const vacation = gross * 0.10;

    document.getElementById('gross-sum').textContent = `${gross.toLocaleString()} ₽`;
    document.getElementById('tax-sum').textContent = `${Math.round(taxTotal).toLocaleString()} ₽`;
    document.getElementById('net-sum').textContent = `${Math.round(netTotal).toLocaleString()} ₽`;
    document.getElementById('avg-daily').textContent = `${Math.round(avgDaily).toLocaleString()} ₽`;
    document.getElementById('vacation-sum').textContent = `${Math.round(vacation).toLocaleString()} ₽`;
    document.getElementById('vacation-progress').style.width = `${Math.min(100, (vacation / 50000) * 100)}%`;

    // Обновление диаграммы
    if (analyticsChart) {
        analyticsChart.data.datasets[0].data = monthlyStats;
        analyticsChart.update();
    }
}

// Поиск по таблице
function filterTable() {
    const query = document.getElementById('table-search').value.toLowerCase();
    const rows = document.querySelectorAll('#entries-list tr');
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
}

// Экспорт в CSV
async function exportToCSV() {
    if (allEntriesCache.length === 0) return alert('Нет записей для экспорта!');

    let csv = '\uFEFFДата;Проект;Вид работы;Ставка;Количество;Вал;Налог;Чистыми\n';
    allEntriesCache.forEach(e => {
        const sum = e.quantity * e.price;
        const tax = sum * 0.04;
        const net = sum - tax;
        csv += `"${e.date}";"${e.project || 'МойПроект'}";"${e.name}";"${e.price}";"${e.quantity}";"${sum}";"${tax}";"${net}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `worklog_pro_report.csv`;
    link.click();
}

// Удаление элементов
async function deleteService(id) {
    if (confirm('Удалить эту услугу?')) {
        await fetch(`${API_URL}/services/${id}`, { method: 'DELETE' });
        await loadServices();
    }
}

async function deleteEntry(id) {
    if (confirm('Удалить запись?')) {
        await fetch(`${API_URL}/entries/${id}`, { method: 'DELETE' });
        await loadEntries();
    }
}

// Обработчики форм
document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('service-name').value;
    const price = document.getElementById('service-price').value;
    await fetch(`${API_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, price: Number(price) })
    });
    e.target.reset();
    await loadServices();
});

document.getElementById('entry-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const project = document.getElementById('entry-project').value;
    const date = document.getElementById('entry-date').value;
    const service_id = document.getElementById('entry-service').value;
    const quantity = document.getElementById('entry-qty').value;

    await fetch(`${API_URL}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, date, service_id: Number(service_id), quantity: Number(quantity) })
    });

    e.target.reset();
    document.getElementById('entry-date').valueAsDate = new Date();
    await loadEntries();
});

document.getElementById('filter-month').addEventListener('change', renderDashboard);

// Старт
const now = new Date();
document.getElementById('entry-date').valueAsDate = now;
document.getElementById('filter-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

initChart();
loadServices();
loadEntries();