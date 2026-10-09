/**
 * Bill hub page - Dynamic bills list from transactions
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [profile, homeData] = await Promise.all([
      api.getProfile(),
      api.getHomeData()
    ]);
    
    // Balance header
    const searchContainer = document.querySelector('.search-container');
    searchContainer.insertAdjacentHTML('afterend', `
      <div class="text-center py-3 bg-light rounded mb-3">
        <small class="text-muted">Solde disponible</small><br>
        <span class="fw-bold fs-4 text-success">${UI.formatCurrency(homeData.balance || 0)}</span>
      </div>
    `);
    
    // Dynamic recent bills (services cat 5-10)
    const billsSection = document.querySelector('.bg-white.rounded-3');
    billsSection.outerHTML = `
      <div class="bg-white rounded-3 p-3 mb-4" id="dynamicBills">
        <h6 class="fw-bold mb-3">Factures récentes</h6>
        <div id="recentBillsTx" class="list-group list-group-flush">Chargement...</div>
      </div>
    `;
    
    await UI.loadTransactions('recentBillsTx', {category_id: [5,6,7,8], limit: 6, period: 'year'});
    
  } catch (error) {
    UI.showNotification('Erreur chargement factures', 'error');
  }
});
