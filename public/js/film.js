/**
 * Film page dynamic enhancements
 */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const [profile, homeData] = await Promise.all([
      api.getProfile(),
      api.getHomeData()
    ]);
    
    // Add balance header
    const banner = document.querySelector('.movie-banner');
    const balanceHtml = `
      <div class="text-end small text-white mb-2">
        <small>Solde disponible: <span id="filmBalance">${UI.formatCurrency(homeData.balance || 0)}</span></small>
      </div>
    `;
    banner.insertAdjacentHTML('afterbegin', balanceHtml);
    
    // Recent entertainment tx
    const recentSection = document.createElement('div');
    recentSection.className = 'container mt-4 mb-5';
    recentSection.innerHTML = `
      <h6 class="fw-bold mb-3"><i class="bi bi-film text-danger me-2"></i>Derniers paiements Cinéma</h6>
      <div id="recentFilmTx" class="list-group list-group-flush">Chargement...</div>
    `;
    document.querySelector('.container.py-4.mb-5').parentNode.insertBefore(recentSection, document.querySelector('.container.py-4.mb-5'));
    
    await UI.loadTransactions('recentFilmTx', {category_id: 9, limit: 3, period: 'year'});
    
  } catch (error) {
    UI.showNotification('Erreur chargement données film', 'error');
  }
});
