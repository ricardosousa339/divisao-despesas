// app-expenses.js — CRUD de despesas, renderização, recorrência

const ExpenseManager = {
    editMode: false,

    handleSubmit() {
        const desc = document.getElementById('description').value;
        const payer = document.getElementById('payer').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const id = document.getElementById('expense-id').value;
        const date = document.getElementById('expense-date').value || null;
        const isRecurring = document.getElementById('expense-recurring').checked;
        const isFixedValue = document.getElementById('expense-fixed-value').checked;
        const frequency = document.getElementById('expense-frequency').value;

        if (!payer) { showNotification('Selecione quem pagou.', 'warning'); return; }
        if (!amount || amount <= 0) { showNotification('Informe um valor válido.', 'warning'); return; }

        const selectedParticipants = [];
        document.querySelectorAll('#participants-list input[type="checkbox"]:checked').forEach(cb => {
            selectedParticipants.push(cb.value);
        });

        const participants = selectedParticipants.length > 0 ? selectedParticipants : App.people.map(p => p.name);

        const expense = {
            id: id ? parseInt(id) : Date.now(),
            description: desc, amount, payer, participants, date,
            isRecurring, isFixedValue: isRecurring ? isFixedValue : false,
            frequency: isRecurring ? frequency : null, isPending: false
        };

        if (id) {
            const idx = App.expenses.findIndex(e => e.id == id);
            if (idx > -1) App.expenses[idx] = expense;
            showNotification('Despesa atualizada!');
            document.getElementById('submit-button').textContent = 'Adicionar Despesa';
            document.getElementById('submit-button').className = 'btn-primary';
            this.editMode = false;
        } else {
            App.expenses.push(expense);
            showNotification('Despesa adicionada!');
        }

        document.getElementById('expense-form').reset();
        document.getElementById('expense-id').value = '';
        document.getElementById('recurring-options').style.display = 'none';
        document.getElementById('pending-value-alert').style.display = 'none';
        App.save();
        App.refreshAll();
        switchTab('view-expenses');
    },

    edit(id) {
        const exp = App.expenses.find(e => e.id == id);
        if (!exp) return;
        document.getElementById('description').value = exp.description;
        document.getElementById('payer').value = exp.payer;
        document.getElementById('amount').value = exp.isPending ? '' : exp.amount;
        document.getElementById('expense-id').value = exp.id;
        document.getElementById('expense-date').value = exp.date || '';
        document.getElementById('expense-recurring').checked = exp.isRecurring || false;
        document.getElementById('expense-fixed-value').checked = exp.isFixedValue || false;
        document.getElementById('expense-frequency').value = exp.frequency || 'mensal';
        document.getElementById('recurring-options').style.display = exp.isRecurring ? 'block' : 'none';

        if (exp.isPending) {
            document.getElementById('pending-value-alert').style.display = 'block';
        }

        const btn = document.getElementById('submit-button');
        btn.textContent = 'Atualizar Despesa';
        btn.className = 'btn-success';
        this.editMode = true;

        switchTab('add-expense');
        setTimeout(() => {
            document.querySelectorAll('#participants-list input[type="checkbox"]').forEach(cb => {
                cb.checked = exp.participants && exp.participants.includes(cb.value);
            });
        }, 50);
    },

    delete(id) {
        if (!confirm('Excluir esta despesa?')) return;
        App.expenses = App.expenses.filter(e => e.id != id);
        App.save();
        App.refreshAll();
        showNotification('Despesa excluída!');
    },

    repeat(id) {
        const exp = App.expenses.find(e => e.id == id);
        if (!exp) return;
        if (exp.isFixedValue) {
            const newExp = { ...exp, id: Date.now(), date: new Date().toISOString().slice(0, 10), isPending: false };
            App.expenses.push(newExp);
            App.save();
            App.refreshAll();
            showNotification('Despesa duplicada!');
        } else {
            // Valor variável: abre formulário pré-preenchido sem valor
            document.getElementById('description').value = exp.description;
            document.getElementById('payer').value = exp.payer;
            document.getElementById('amount').value = '';
            document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
            document.getElementById('expense-recurring').checked = exp.isRecurring;
            document.getElementById('expense-fixed-value').checked = false;
            document.getElementById('expense-frequency').value = exp.frequency || 'mensal';
            document.getElementById('recurring-options').style.display = exp.isRecurring ? 'block' : 'none';
            document.getElementById('expense-id').value = '';
            switchTab('add-expense');
            setTimeout(() => {
                document.querySelectorAll('#participants-list input[type="checkbox"]').forEach(cb => {
                    cb.checked = exp.participants && exp.participants.includes(cb.value);
                });
                document.getElementById('amount').focus();
            }, 50);
            showNotification('Preencha o novo valor.', 'warning');
        }
    },

    render() {
        const list = document.getElementById('expense-list');
        const pendingSection = document.getElementById('pending-expenses-section');
        const pendingList = document.getElementById('pending-expense-list');

        const active = App.expenses.filter(e => !e.isPending);
        const pending = App.expenses.filter(e => e.isPending);

        // Pending expenses
        if (pending.length > 0) {
            pendingSection.style.display = 'block';
            pendingList.innerHTML = '';
            pending.forEach(e => pendingList.appendChild(this._createExpenseItem(e, true)));
        } else {
            pendingSection.style.display = 'none';
        }

        // Active expenses
        if (active.length === 0 && pending.length === 0) {
            list.innerHTML = '<li class="no-participants-message">Nenhuma despesa adicionada ainda.</li>';
            return;
        }
        if (active.length === 0) {
            list.innerHTML = '';
            return;
        }
        list.innerHTML = '';

        // Separar parcelas agrupáveis e despesas normais
        const installmentGroups = {};
        const normalExpenses = [];

        active.forEach(e => {
            if (e.installmentGroup) {
                if (!installmentGroups[e.installmentGroup]) {
                    installmentGroups[e.installmentGroup] = {
                        currentCycle: [],
                        historyCycle: []
                    };
                }
                installmentGroups[e.installmentGroup].currentCycle.push(e);
            } else {
                normalExpenses.push(e);
            }
        });

        // Buscar parcelas no histórico de ciclos arquivados
        Object.keys(installmentGroups).forEach(groupName => {
            const group = installmentGroups[groupName];
            
            if (window.App && App.archivedCycles) {
                App.archivedCycles.forEach(cycle => {
                    const cycleExpenses = cycle.expenses || [];
                    cycleExpenses.forEach(histExp => {
                        if (histExp.installmentGroup === groupName && !histExp.isPending) {
                            // Encontrar o período formatado do ciclo
                            const startStr = window.formatDate ? formatDate(cycle.startDate) : cycle.startDate;
                            const endStr = window.formatDate ? formatDate(cycle.endDate) : cycle.endDate;
                            group.historyCycle.push({
                                ...histExp,
                                cyclePeriod: `${startStr} — ${endStr}`,
                                isHistorical: true
                            });
                        }
                    });
                });
            }
        });

        // Renderizar grupos de parcelas
        Object.entries(installmentGroups).forEach(([groupName, group]) => {
            const allInstallments = [...group.currentCycle, ...group.historyCycle];
            const installmentNumbers = allInstallments.map(e => e.installmentCurrent || 0);
            const minInstallment = installmentNumbers.length > 0 ? Math.min(...installmentNumbers) : 999;
            
            // Só associa o histórico se tivermos registrado desde a parcela 1
            const useHistory = minInstallment === 1;
            list.appendChild(this._createInstallmentGroup(groupName, group.currentCycle, useHistory ? group.historyCycle : []));
        });

        // Renderizar despesas normais
        normalExpenses.forEach(e => list.appendChild(this._createExpenseItem(e, false)));

        if (window.lucide) lucide.createIcons();
    },

    _createInstallmentGroup(groupName, currentExpenses, historyExpenses) {
        const hasHistory = historyExpenses.length > 0;
        const allExpenses = [...currentExpenses, ...historyExpenses];
        
        // Ordenar todas as parcelas pelo número
        allExpenses.sort((a, b) => (a.installmentCurrent || 0) - (b.installmentCurrent || 0));

        const maxCurrent = Math.max(...allExpenses.map(e => e.installmentCurrent || 0));
        const total = currentExpenses[0].installmentTotal || maxCurrent;
        
        // O acumulado é o total pago (histórico + atual) se há histórico, senão apenas o atual
        const displayedExpenses = hasHistory ? allExpenses : currentExpenses;
        const totalAmount = displayedExpenses.reduce((sum, e) => sum + e.amount, 0);
        const isComplete = maxCurrent === total;

        // Capitalizar o nome do grupo
        const displayName = groupName.charAt(0).toUpperCase() + groupName.slice(1);
        const groupId = `installment-group-${groupName.replace(/[^a-z0-9]/gi, '-')}`;

        const li = document.createElement('li');
        li.className = 'installment-group' + (isComplete ? ' installment-complete' : '');
        li.id = groupId;

        let itemsHTML = '';
        allExpenses.forEach(e => {
            const dateStr = e.date ? formatDate(e.date) : '';
            if (e.isHistorical) {
                itemsHTML += `
                    <div class="installment-item historical-item" style="opacity: 0.65; background: var(--border); border-style: dashed;">
                        <div class="installment-item-info">
                            <span class="installment-item-label" style="text-decoration: line-through; color: var(--text-muted);">Parcela ${e.installmentCurrent}/${e.installmentTotal} (Paga)</span>
                            <span class="installment-item-date">${dateStr} · Período: ${e.cyclePeriod}</span>
                        </div>
                        <div class="installment-item-right">
                            <span class="installment-item-amount" style="color: var(--text-muted);">R$ ${e.amount.toFixed(2)}</span>
                            <span class="import-badge" style="background: rgba(16, 185, 129, 0.08); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.15); margin-left: 8px; font-size: 0.75em;"><i data-lucide="archive" class="icon-sm"></i> Arquivado</span>
                        </div>
                    </div>`;
            } else {
                itemsHTML += `
                    <div class="installment-item">
                        <div class="installment-item-info">
                            <span class="installment-item-label">Parcela ${e.installmentCurrent}/${e.installmentTotal}</span>
                            <span class="installment-item-date">${dateStr}</span>
                        </div>
                        <div class="installment-item-right">
                            <span class="installment-item-amount">R$ ${e.amount.toFixed(2)}</span>
                            <div class="button-group" style="margin-left: 8px;">
                                <button class="btn-primary btn-sm" onclick="ExpenseManager.edit(${e.id})">Editar</button>
                                <button class="btn-danger btn-sm" onclick="ExpenseManager.delete(${e.id})">Excluir</button>
                            </div>
                        </div>
                    </div>`;
            }
        });

        // PROGRESS BAR SEGMENTADA
        let progressHTML = '';
        if (total > 0) {
            progressHTML += `<div class="installment-progress-segmented">`;
            for (let i = 1; i <= total; i++) {
                const isActive = i <= maxCurrent;
                const isSegmentComplete = isComplete;
                progressHTML += `<div class="installment-segment ${isActive ? 'active' : ''} ${isSegmentComplete ? 'complete' : ''}" title="Parcela ${i}/${total}"></div>`;
            }
            progressHTML += `</div>`;
        } else {
            // Fallback para barra contínua se total for inválido
            const progressPct = total > 0 ? (maxCurrent / total) * 100 : 0;
            progressHTML += `
                <div class="installment-progress-track">
                    <div class="installment-progress-fill ${isComplete ? 'complete' : ''}" style="width: ${progressPct}%"></div>
                </div>`;
        }

        li.innerHTML = `
            <div class="installment-group-header" onclick="document.getElementById('${groupId}-details').toggleAttribute('open')">
                <div class="installment-group-info">
                    <span class="installment-group-name"><i data-lucide="credit-card" class="icon-sm"></i> ${displayName}</span>
                    <div class="installment-group-meta">
                        <span class="installment-badge ${isComplete ? 'installment-badge-complete' : ''}">
                            <i data-lucide="${isComplete ? 'check-circle' : 'clock'}" class="icon-sm"></i>
                            ${isComplete ? 'Quitada' : `${maxCurrent}/${total} parcelas`}
                        </span>
                        <span class="installment-group-total">${hasHistory ? 'Total Pago: ' : 'Acumulado: '}R$ ${totalAmount.toFixed(2)}</span>
                    </div>
                </div>
                ${progressHTML}
            </div>
            <details id="${groupId}-details" class="installment-group-details">
                <summary>Ver parcelas individuais (${allExpenses.length})</summary>
                <div class="installment-items-list">
                    ${itemsHTML}
                </div>
            </details>
        `;
        return li;
    },

    _createExpenseItem(exp, isPendingItem) {
        const li = document.createElement('li');
        li.className = 'expense-item' + (isPendingItem ? ' pending-expense' : '') + (exp.isRecurring ? ' recurring-expense' : '');

        let badges = '';
        if (exp.isRecurring) {
            badges += `<span class="badge badge-recurring"><i data-lucide="repeat" class="icon-sm"></i> ${exp.isFixedValue ? 'Fixa' : 'Variável'}</span>`;
        }
        if (exp.frequency && exp.isRecurring) {
            badges += `<span class="badge badge-frequency">${exp.frequency}</span>`;
        }
        if (isPendingItem) {
            badges += '<span class="badge badge-pending"><i data-lucide="alert-triangle" class="icon-sm"></i> Valor pendente</span>';
        }
        // Badge de parcela para despesas que não foram agrupadas (ex: parcela única importada)
        if (exp.installmentGroup && exp.installmentCurrent && exp.installmentTotal) {
            badges += `<span class="badge badge-recurring"><i data-lucide="credit-card" class="icon-sm"></i> Parcela ${exp.installmentCurrent}/${exp.installmentTotal}</span>`;
        }

        const dateStr = exp.date ? `<small class="expense-date"><i data-lucide="calendar" class="icon-sm"></i> ${formatDate(exp.date)}</small>` : '';
        const participantsText = exp.participants && exp.participants.length > 0
            ? `<small>Participantes: ${exp.participants.join(', ')}</small>` : '<small>Participantes: Todos</small>';

        li.innerHTML = `
            <div class="expense-info">
                <div class="expense-title">
                    <span class="expense-description">${exp.description}</span>
                    <span class="expense-amount">${isPendingItem ? 'R$ --' : 'R$ ' + exp.amount.toFixed(2)}</span>
                </div>
                <small class="expense-payer">Pago por: ${exp.payer}</small>
                ${dateStr}
                ${participantsText}
                <div class="badges">${badges}</div>
            </div>
            <div class="button-group">
                ${exp.isRecurring ? `<button class="btn-repeat btn-sm" onclick="ExpenseManager.repeat(${exp.id})" title="Repetir"><i data-lucide="repeat" class="icon-sm"></i></button>` : ''}
                <button class="btn-primary btn-sm" onclick="ExpenseManager.edit(${exp.id})">Editar</button>
                <button class="btn-danger btn-sm" onclick="ExpenseManager.delete(${exp.id})">Excluir</button>
            </div>
        `;
        return li;
    }
};

function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
