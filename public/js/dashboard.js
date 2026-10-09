const balanceElement = document.getElementById('balance');
const transactionsList = document.getElementById('last-transactions');

async function loadTransactions() {
    const response = await fetch('/api/transactions');
    const transactions = await response.json();

    transactionsList.innerHTML = '';

    let balance = 0;

    transactions.forEach(t => {

        const li = document.createElement('li');
        li.className = "list-group-item d-flex justify-content-between align-items-center";

        const sign = t.type === 'income' ? '+' : '-';
        const color = t.type === 'income' ? 'text-success' : 'text-danger';

        li.innerHTML = `
            <div>
                <strong>${t.title}</strong><br>
                <small class="text-muted">${new Date(t.created_at).toLocaleDateString()}</small>
            </div>
            <span class="${color}">
                ${sign}${parseFloat(t.amount).toFixed(2)} €
            </span>
        `;

        transactionsList.appendChild(li);

        if (t.type === 'income') {
            balance += parseFloat(t.amount);
        } else {
            balance -= parseFloat(t.amount);
        }
    });

    balanceElement.innerText = balance.toFixed(2) + " €";
}

loadTransactions();

