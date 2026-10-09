/**
 * Charts - Gestion des graphiques et visualisations Chart.js
 * Génère des graphiques pour les statistiques financières
 */

// Configuration globale de Chart.js
Chart.defaults.font.family = "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
Chart.defaults.color = '#666';

const Charts = {
    /**
     * Initialiser un graphique en secteurs (Pie/Doughnut)
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {string} title - Titre du graphique
     * @returns {Chart}
     */
    createPieChart(canvasId, data, title = '') {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value.toFixed(2)} € (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Initialiser un graphique linéaire (Line)
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {string} title - Titre du graphique
     * @returns {Chart}
     */
    createLineChart(canvasId, data, title = '') {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' €';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    },

    /**
     * Initialiser un graphique à barres (Bar)
     * @param {string} canvasId - ID du canvas
     * @param {Object} data - Données du graphique
     * @param {string} title - Titre du graphique
     * @returns {Chart}
     */
    createBarChart(canvasId, data, title = '') {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' €';
                            }
                        }
                    }
                }
            }
        });
    },

    /**
     * Charger et afficher les données du graphique en secteurs
     * @param {string} canvasId 
     * @param {string} type - 'income' ou 'expense'
     */
    async loadPieChart(canvasId, type = 'expense') {
        try {
            const data = await api.getPieChartData(type);
            return this.createPieChart(canvasId, data, type === 'income' ? 'Revenus par catégorie' : 'Dépenses par catégorie');
        } catch (error) {
            console.error('Erreur chargement graphique secteurs:', error);
            return null;
        }
    },

    /**
     * Charger et afficher le graphique linéaire
     * @param {string} canvasId 
     */
    async loadLineChart(canvasId) {
        try {
            const data = await api.getLineChartData();
            return this.createLineChart(canvasId, data, 'Évolution mensuelle');
        } catch (error) {
            console.error('Erreur chargement graphique linéaire:', error);
            return null;
        }
    },

    /**
     * Créer un graphique de comparaison revenus/dépenses
     * @param {string} canvasId 
     */
    async loadComparisonChart(canvasId) {
        try {
            const monthlyData = await api.getMonthlyEvolution(6);
            
            const data = {
                labels: monthlyData.map(stat => stat.month_name),
                datasets: [
                    {
                        label: 'Revenus',
                        data: monthlyData.map(stat => parseFloat(stat.income)),
                        backgroundColor: 'rgba(75, 192, 192, 0.5)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2
                    },
                    {
                        label: 'Dépenses',
                        data: monthlyData.map(stat => parseFloat(stat.expense)),
                        backgroundColor: 'rgba(255, 99, 132, 0.5)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2
                    }
                ]
            };

            return this.createBarChart(canvasId, data, 'Revenus vs Dépenses');
        } catch (error) {
            console.error('Erreur chargement graphique comparaison:', error);
            return null;
        }
    },

    /**
     * Détruire un graphique
     * @param {Chart} chart 
     */
    destroyChart(chart) {
        if (chart) {
            chart.destroy();
        }
    }
};

// Fonctions spécifiques pour les pages
const PageCharts = {
    /**
     * Page d'accueil - Graphiques simplifiés
     */
    async home() {
        try {
            // Charger le graphique des dépenses
            await Charts.loadPieChart('expensesChart');
        } catch (error) {
            console.error('Erreur PageCharts.home:', error);
        }
    },

    /**
     * Page statistiques - Tous les graphiques
     */
    async stats() {
        try {
            // Graphique secteurs dépenses
            await Charts.loadPieChart('expensesPieChart', 'expense');
            
            // Graphique secteurs revenus
            await Charts.loadPieChart('incomePieChart', 'income');
            
            // Graphique linéaire évolution
            await Charts.loadLineChart('evolutionChart');
            
            // Graphique comparaison
            await Charts.loadComparisonChart('comparisonChart');
        } catch (error) {
            console.error('Erreur PageCharts.stats:', error);
        }
    },

    /**
     * Page transactions - Graphique des dépenses
     */
    async transactions() {
        try {
            await Charts.loadPieChart('transactionsChart');
        } catch (error) {
            console.error('Erreur PageCharts.transactions:', error);
        }
    }
};

// Rendre les objets disponibles globalement
window.Charts = Charts;
window.PageCharts = PageCharts;

