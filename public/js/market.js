/**
 * Market page dynamic
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [profile, homeData] = await Promise.all([
      api.getProfile(),
      api.getHomeData()
    ]);
    
    // Balance
    const balanceEl = document.getElementById('marketBalance');
    if (balanceEl && homeData.balance !== undefined) {
      balanceEl.textContent = UI.formatCurrency(homeData.balance);
    }
    
    // Recent shopping (assume cat=10)
    await UI.loadTransactions('recentMarketTx', {category_id: 10, limit: 5, period: 'year'});
    
  } catch (error) {
    UI.showNotification('Erreur chargement market', 'error');
  }
});
