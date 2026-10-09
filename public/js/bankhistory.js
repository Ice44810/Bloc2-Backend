/*
 * Bank History - Gestion de l'historique bancaire
 * Version corrigée et optimisée
 */

// 1. Objet API pour centraliser les appels fetch
const api = {
    async getTransactions(params) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/transactions?${query}`);
        if (!res.ok) throw new Error("Erreur lors de la récupération des transactions");
        return res.json();
    },
    async getStats(params) {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`/api/stats?${query}`);
        if (!res.ok) throw new Error("Erreur lors de la récupération des statistiques");
        return res.json();
    }
};

// État des filtres
let currentPeriod = '7days';
let currentMonthFilter = 'all';
let currentStatusFilter = 'all';

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Bank History: Initialisation...');
    
    setupTabListeners();
    setupFilterListeners();

    // Charger les données initiales (7 jours par défaut)
    await loadDataForPeriod('7days');
});

/**
 * Gestion des onglets (7j, 30j, Perso)
 */
function setupTabListeners() {
    const tabs = document.querySelectorAll('#historyTabs .nav-link');
    tabs.forEach(tab => {
        tab.addEventListener('shown.bs.tab', async (event) => {
            const targetId = event.target.getAttribute('data-bs-target');
            currentPeriod = targetId.replace('#', '');
            await loadDataForPeriod(currentPeriod);
        });
    });
}

/**
 * Gestion des filtres dans le menu latéral (Offcanvas)
 */
function setupFilterListeners() {
    // Filtres par mois
    const monthBtns = document.querySelectorAll('#monthFilters .btn-filter');
    monthBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            monthBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMonthFilter = e.target.getAttribute('data-value');
        });
    });

    // Filtres par statut
    const statusBtns = document.querySelectorAll('#statusFilters .btn-filter');
    statusBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            statusBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentStatusFilter = e.target.getAttribute('data-value');
        });
    });

    // Bouton Appliquer
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const offcanvasEl = document.getElementById('offcanvasFilter');
            const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl) || new bootstrap.Offcanvas(offcanvasEl);
            offcanvas.hide();
            loadDataForPeriod(currentPeriod);
        });
    }
}

/**
 * Coeur de la logique : Chargement et Affichage
 */
async function loadDataForPeriod(period) {
    const container = document.getElementById('dynamicTransactionsContainer');
    container.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted">Chargement...</p></div>';

    // Hide loader on charts
    document.querySelectorAll('.chart-loader').forEach(el => el.classList.add('opacity-25'));
    document.querySelectorAll('#totalIncome, #totalExpense').forEach(el => el.textContent = '€0.00');

    try {
        const [transactionsRes, dailyRes] = await Promise.all([
            api.getTransactions({ period: period === '7days' ? 'week' : (period === '30days' ? 'month' : 'year') }),
            fetch(`/api/stats/daily_evolution?days=${period === '7days' ? 7 : 30}`)
        ]);

        const transactions = await transactionsRes;
        const dailyResp = await dailyRes.json();
        const dailyData = dailyResp.daily_evolution || dailyResp;

        let txList = Array.isArray(transactions) ? transactions : [];

        // Filtres
        if (currentMonthFilter !== 'all') {
            const monthNum = parseInt(currentMonthFilter);
            txList = txList.filter(tx => new Date(tx.created_at).getMonth() === monthNum);
        }
        if (currentStatusFilter !== 'all') {
            txList = txList.filter(tx => (tx.status || '').toLowerCase() === currentStatusFilter);
        }

        // Update totals
        updateTotals(txList);

        // Render list
        displayTransactions(txList);

        // Render chart from server data
        renderBarChart(document.querySelector('.tab-pane.active #chart7days')?.id || 'chart7days', 
                       document.querySelector('.tab-pane.active #labels7days')?.id || 'labels7days', dailyData);

    } catch (error) {
        console.error('Erreur:', error);
        container.innerHTML = '<div class="text-center py-5 text-danger">Erreur de chargement des données</div>';
    }
}

function updateTotals(txList) {
    let income = 0, expense = 0;
    txList.forEach(tx => {
        const amt = parseFloat(tx.amount) || 0;
        if (tx.type === 'income') income += amt;
        else expense += amt;
    });

    const elIn = document.getElementById('totalIncome');
    const elOut = document.getElementById('totalExpense');
    if (elIn) elIn.textContent = `€${income.toFixed(2)}`;
    if (elOut) elOut.textContent = `€${expense.toFixed(2)}`;
}

function renderTransactionsList(transactions) {
    const container = document.getElementById('transactionsListContainer');
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = '<p class="text-center text-muted py-4">Aucune transaction trouvée.</p>';
        return;
    }

    // Tri par date décroissante
    transactions.sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));

    container.innerHTML = transactions.map(tx => {
        const isIncome = tx.type === 'income';
        const title = tx.title || tx.description || "Transaction";
        const dateStr = new Date(tx.created_at || tx.date).toLocaleDateString('fr-FR');

        return `
            <div class="card mb-2 border-0 shadow-sm p-3">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle p-2 me-3 ${isIncome ? 'bg-success-subtle' : 'bg-danger-subtle'}">
                            <i class="bi ${isIncome ? 'bi-plus text-success' : 'bi-dash text-danger'} fs-4"></i>
                        </div>
                        <div>
                            <div class="fw-bold">${title}</div>
                            <div class="text-muted small">${dateStr}</div>
                        </div>
                    </div>
                    <div class="fw-bold ${isIncome ? 'text-success' : 'text-danger'}">
                        ${isIncome ? '+' : '-'} €${Math.abs(tx.amount).toFixed(2)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function groupTransactionsByDay(transactions, period) {
    const daysCount = period === '30days' ? 30 : 7;
    const result = [];
    const today = new Date();

    // Initialise les jours vides
    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateKey = d.toISOString().split('T')[0];
        result.push({ 
            date: dateKey, 
            label: `${d.getDate()}/${d.getMonth() + 1}`, 
            net: 0 
        });
    }

    // Remplit avec les données réelles
    transactions.forEach(tx => {
        const txDate = new Date(tx.created_at || tx.date).toISOString().split('T')[0];
        const dayEntry = result.find(r => r.date === txDate);
        if (dayEntry) {
            const amt = parseFloat(tx.amount) || 0;
            dayEntry.net += (tx.type === 'income' ? amt : -amt);
        }
    });

    return result;
}

function renderChartUI(dailyData, period) {
    const activePane = document.querySelector('.tab-pane.active');
    if (!activePane) return;

    const barsContainer = activePane.querySelector('.chart-content .d-flex.justify-content-around');
    const yAxis = activePane.querySelector('.y-axis');

    const values = dailyData.map(d => Math.abs(d.net));
    const maxVal = Math.max(...values, 100);

    if (yAxis) {
        yAxis.innerHTML = `<span>${maxVal.toFixed(0)}</span><span>${(maxVal * 0.75).toFixed(0)}</span><span>0</span><span>-${(maxVal * 0.75).toFixed(0)}</span><span>-${maxVal.toFixed(0)}</span>`;
    }

    if (barsContainer) {
        const barWidth = period === '30days' ? '8px' : '25px';
        barsContainer.innerHTML = dailyData.map(d => {
            const height = (Math.abs(d.net) / maxVal) * 100;
            const color = d.net >= 0 ? 'bg-success' : 'bg-danger';
            return `<div class="${color} rounded-top" 
                         style="height: ${Math.max(height, 5)}%; width: ${barWidth};" 
                         title="${d.label}: ${d.net.toFixed(2)}€"></div>`;
        }).join('');
    }
}

/**
 * Mettre à jour les dates sous le graphique
 * @param {Array} dailyData 
 * @param {string} period 
 */
function updateChartDates(dailyData) {
    const activePane = document.querySelector('.tab-pane.active');
    if (!activePane || !dailyData || dailyData.length === 0) return;

    const dateContainer = activePane.querySelector('.d-flex.justify-content-between.text-muted.small');
    if (!dateContainer) return;

    const dateSpans = dateContainer.querySelectorAll('span');
    if (dateSpans.length >= 2) {
        dateSpans[0].textContent = dailyData[0].label;
        dateSpans[dateSpans.length - 1].textContent = dailyData[dailyData.length - 1].label;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatDateShort(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
}

function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    if (diffDays === 0) {
        return `aujourd'hui ${timeStr}`;
    } else if (diffDays === 1) {
        return `hier ${timeStr}`;
    } else if (diffDays < 7) {
        return `il y a ${diffDays} jours à ${timeStr}`;
    }
    
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }) + ' ' + timeStr;
}

// Rendre disponible globalement
window.BankHistory = {
    loadDataForPeriod,
    refresh: () => loadDataForPeriod(currentPeriod)
};