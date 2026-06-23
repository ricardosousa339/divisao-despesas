// app-summary.js — Resumo com cards narrativos, ciclos, histórico

const SummaryManager = {
    update() {
        const container = document.getElementById('person-cards-container');
        const paymentsEl = document.getElementById('suggested-payments');
        const totalEl = document.getElementById('total-display');
        const cycleSection = document.getElementById('close-cycle-section');
        const cycleInfo = document.getElementById('cycle-info');

        // Filtrar despesas pendentes do cálculo
        const validExpenses = App.expenses.filter(e => !e.isPending);

        if (validExpenses.length === 0) {
            totalEl.textContent = 'Total: R$ 0,00';
            container.innerHTML = '';
            paymentsEl.innerHTML = '<p class="no-participants-message">Adicione despesas para ver o resumo.</p>';
            cycleSection.style.display = 'none';
            cycleInfo.style.display = 'none';
            return;
        }

        const summary = getExpenseSummary(validExpenses);
        totalEl.textContent = `Total: R$ ${summary.totalExpenses.toFixed(2)}`;

        // Ciclo info
        if (App.settings.settlementDay) {
            cycleInfo.style.display = 'block';
            cycleInfo.innerHTML = `<div class="cycle-info-bar"><i data-lucide="calendar" class="icon-sm"></i> Acerto no dia ${App.settings.settlementDay} de cada mês</div>`;
            cycleSection.style.display = 'block';
        } else {
            cycleInfo.style.display = 'none';
            cycleSection.style.display = 'none';
        }

        // Cards por pessoa
        const allParticipants = getAllParticipants(validExpenses);
        container.innerHTML = '<h3>Resumo por Pessoa</h3>';

        const personDetails = allParticipants.map(name => {
            const pe = calculatePersonExpenses(validExpenses, name);
            return { name, paid: pe.paid, owed: pe.owed, balance: pe.balance };
        }).sort((a, b) => a.balance - b.balance);

        personDetails.forEach(p => {
            const card = document.createElement('div');
            const isPositive = p.balance > 0.01;
            const isNegative = p.balance < -0.01;
            const isNeutral = !isPositive && !isNegative;

            card.className = `person-card ${isPositive ? 'card-positive' : isNegative ? 'card-negative' : 'card-neutral'}`;

            let resultText, resultClass, resultIcon;
            if (isPositive) {
                resultText = `Deve RECEBER R$ ${p.balance.toFixed(2)}`;
                resultClass = 'result-positive';
                resultIcon = 'check-circle';
            } else if (isNegative) {
                resultText = `Deve PAGAR R$ ${Math.abs(p.balance).toFixed(2)}`;
                resultClass = 'result-negative';
                resultIcon = 'alert-circle';
            } else {
                resultText = 'Está quite!';
                resultClass = 'result-neutral';
                resultIcon = 'scale';
            }

            // Barra visual
            const maxVal = Math.max(p.paid, p.owed, 1);
            const paidPct = (p.paid / maxVal) * 100;
            const owedPct = (p.owed / maxVal) * 100;

            // Detalhes por despesa
            const personExpDetails = validExpenses.filter(e =>
                e.participants.includes(p.name) || e.payer === p.name
            ).map(e => {
                const share = e.participants.includes(p.name) ? e.amount / e.participants.length : 0;
                const didPay = e.payer === p.name;
                return `<div class="detail-row">
                    <span class="detail-desc">${e.description}</span>
                    <span class="detail-share">Parte: R$ ${share.toFixed(2)}</span>
                    <span class="detail-paid ${didPay ? 'yes' : 'no'}">${didPay ? 'Pagou R$ ' + e.amount.toFixed(2) : '—'}</span>
                </div>`;
            }).join('');

            card.innerHTML = `
                <div class="card-header">
                    <span class="card-person-name" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="user" class="icon-sm"></i> ${p.name}</span>
                </div>
                <div class="card-body">
                    <div class="card-row">
                        <span class="card-label">Gastou no total:</span>
                        <span class="card-value paid">R$ ${p.paid.toFixed(2)}</span>
                    </div>
                    <div class="card-row">
                        <span class="card-label">Sua parte justa:</span>
                        <span class="card-value owed">R$ ${p.owed.toFixed(2)}</span>
                    </div>
                    <div class="card-bars">
                        <div class="bar-row"><span class="bar-label">Pagou</span><div class="bar-track"><div class="bar-fill bar-paid" style="width:${paidPct}%"></div></div></div>
                        <div class="bar-row"><span class="bar-label">Deve</span><div class="bar-track"><div class="bar-fill bar-owed" style="width:${owedPct}%"></div></div></div>
                    </div>
                    <div class="card-result ${resultClass}">
                        <span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="${resultIcon}" class="icon-sm"></i> ${resultText}</span>
                    </div>
                </div>
                <details class="card-details">
                    <summary>Ver detalhes das despesas</summary>
                    <div class="details-content">${personExpDetails || '<p>Sem despesas.</p>'}</div>
                </details>
            `;
            container.appendChild(card);
        });

        // Pagamentos sugeridos
        if (summary.transactions.length > 0) {
            paymentsEl.innerHTML = '<h3 class="title-with-icon"><i data-lucide="banknote"></i> Pagamentos Sugeridos</h3>';
            const txSection = document.createElement('div');
            txSection.className = 'transactions-section';
            summary.transactions.forEach(tx => {
                const div = document.createElement('div');
                div.className = 'transaction-card';
                div.innerHTML = `
                    <span class="tx-from"><i data-lucide="user-minus" class="icon-sm"></i> ${tx.from}</span>
                    <span class="tx-arrow"><i data-lucide="arrow-right" class="icon-sm"></i></span>
                    <span class="tx-to"><i data-lucide="user-plus" class="icon-sm"></i> ${tx.to}</span>
                    <span class="tx-amount">R$ ${tx.amount.toFixed(2)}</span>
                `;
                txSection.appendChild(div);
            });
            paymentsEl.appendChild(txSection);
        } else {
            paymentsEl.innerHTML = '<div class="all-settled" style="display: flex; justify-content: center; align-items: center; gap: 8px;"><i data-lucide="check-circle"></i> Todos estão quites!</div>';
        }
        if (window.lucide) lucide.createIcons();
    }
};

// === CYCLES & HISTORY ===
const HistoryManager = {
    render() {
        const el = document.getElementById('history-list');
        if (App.archivedCycles.length === 0) {
            el.innerHTML = '<p class="no-participants-message">Nenhum período fechado ainda.</p>';
            return;
        }
        el.innerHTML = '';
        App.archivedCycles.slice().reverse().forEach(cycle => {
            const div = document.createElement('div');
            div.className = 'history-card';
            const total = cycle.expenses.reduce((s, e) => s + (e.amount || 0), 0);
            div.innerHTML = `
                <div class="history-header">
                    <span class="history-period" style="display: flex; align-items: center; gap: 6px;"><i data-lucide="archive" class="icon-sm"></i> ${formatDate(cycle.startDate)} — ${formatDate(cycle.endDate)}</span>
                    <span class="history-total">R$ ${total.toFixed(2)}</span>
                </div>
                <div class="history-meta">
                    ${cycle.people.length} pessoas · ${cycle.expenses.length} despesas
                </div>
                <details class="history-details">
                    <summary>Ver resumo do período</summary>
                    <div class="history-summary-content">
                        ${this._renderCycleSummary(cycle)}
                    </div>
                </details>
                <button class="btn-restore" onclick="HistoryManager.restore(${cycle.id})" style="display: flex; align-items: center; gap: 6px; justify-content: center;"><i data-lucide="rotate-ccw" class="icon-sm"></i> Restaurar período</button>
            `;
            el.appendChild(div);
        });
        if (window.lucide) lucide.createIcons();
    },

    _renderCycleSummary(cycle) {
        if (!cycle.summarySnapshot) return '<p>Resumo não disponível.</p>';
        const snap = cycle.summarySnapshot;
        let html = '<div class="history-persons">';
        snap.persons.forEach(p => {
            const icon = p.balance > 0.01 ? 'check-circle' : p.balance < -0.01 ? 'alert-circle' : 'scale';
            const label = p.balance > 0.01 ? `Recebeu R$ ${p.balance.toFixed(2)}`
                : p.balance < -0.01 ? `Pagou R$ ${Math.abs(p.balance).toFixed(2)}` : 'Quite';
            html += `<div class="history-person-row"><span>${p.name}</span><span style="display: flex; align-items: center; gap: 6px;"><i data-lucide="${icon}" class="icon-sm"></i> ${label}</span></div>`;
        });
        html += '</div>';
        if (snap.transactions && snap.transactions.length > 0) {
            html += '<div class="history-transactions"><strong>Pagamentos:</strong>';
            snap.transactions.forEach(tx => {
                html += `<div>${tx.from} → ${tx.to}: R$ ${tx.amount.toFixed(2)}</div>`;
            });
            html += '</div>';
        }
        return html;
    },

    restore(cycleId) {
        if (!confirm('Restaurar este período? As despesas voltarão para o período ativo.')) return;
        const idx = App.archivedCycles.findIndex(c => c.id === cycleId);
        if (idx === -1) return;
        const cycle = App.archivedCycles[idx];
        
        // Remove any recurring expenses that were regenerated from this cycle closure
        App.expenses = App.expenses.filter(e => e.regeneratedFromCycleId !== cycleId);
        
        // Merge back
        cycle.expenses.forEach(e => App.expenses.push(e));
        App.archivedCycles.splice(idx, 1);
        App.save();
        App.refreshAll();
        showNotification('Período restaurado!');
        switchTab('view-expenses');
    }
};

function closeCycle() {
    if (App.expenses.length === 0) {
        showNotification('Não há despesas para fechar.', 'warning');
        return;
    }
    if (!confirm('Fechar o período atual? As despesas serão arquivadas.')) return;

    const validExpenses = App.expenses.filter(e => !e.isPending);
    const summary = getExpenseSummary(validExpenses);
    const allParticipants = getAllParticipants(validExpenses);

    const summarySnapshot = {
        total: summary.totalExpenses,
        persons: allParticipants.map(name => {
            const pe = calculatePersonExpenses(validExpenses, name);
            return { name, paid: pe.paid, owed: pe.owed, balance: pe.balance };
        }),
        transactions: summary.transactions
    };

    const today = new Date().toISOString().slice(0, 10);
    const oldest = App.expenses.reduce((min, e) => {
        if (e.date && e.date < min) return e.date;
        return min;
    }, today);

    const cycle = {
        id: Date.now(),
        startDate: oldest,
        endDate: today,
        expenses: [...App.expenses],
        people: [...App.people],
        summarySnapshot
    };

    App.archivedCycles.push(cycle);

    // Regenerar recorrentes
    const recurring = App.expenses.filter(e => e.isRecurring);
    App.expenses = [];
    recurring.forEach(e => {
        App.expenses.push({
            ...e,
            id: Date.now() + Math.random() * 1000,
            date: today,
            isPending: !e.isFixedValue,
            amount: e.isFixedValue ? e.amount : 0,
            regeneratedFromCycleId: cycle.id
        });
    });

    App.save();
    App.refreshAll();
    showNotification('Período fechado! Despesas recorrentes regeneradas.');
    switchTab('history-tab');
}

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
