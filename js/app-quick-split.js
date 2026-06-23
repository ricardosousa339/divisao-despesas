// app-quick-split.js — Calculadora isolada para "Mesa de Bar"

const QuickSplitManager = {
    people: [],
    expenses: [],
    
    init() {
        document.getElementById('qs-person-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPerson();
        });
        
        document.getElementById('qs-expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense();
        });
        
        this.renderPeople();
        this.renderSummary();
    },
    
    addPerson() {
        const input = document.getElementById('qs-person-name');
        const name = input.value.trim();
        if (!name) return;
        
        if (this.people.includes(name)) {
            showNotification('Pessoa já adicionada na mesa.', 'warning');
            return;
        }
        
        this.people.push(name);
        input.value = '';
        this.renderPeople();
        this.renderSummary();
    },
    
    removePerson(name) {
        this.people = this.people.filter(p => p !== name);
        // Também remove a pessoa dos participantes das despesas
        this.expenses.forEach(e => {
            e.participants = e.participants.filter(p => p !== name);
        });
        this.renderPeople();
        this.renderSummary();
    },
    
    addExpense() {
        if (this.people.length === 0) {
            showNotification('Adicione pessoas à mesa primeiro.', 'warning');
            return;
        }
        
        const desc = document.getElementById('qs-description').value;
        const amount = parseFloat(document.getElementById('qs-amount').value);
        
        if (!amount || amount <= 0) return;
        
        const selected = [];
        document.querySelectorAll('#qs-participants-list input[type="checkbox"]:checked').forEach(cb => {
            selected.push(cb.value);
        });
        
        const participants = selected.length > 0 ? selected : [...this.people];
        
        this.expenses.push({
            id: Date.now(),
            description: desc,
            amount: amount,
            participants: participants
        });
        
        document.getElementById('qs-expense-form').reset();
        this.renderPeople(); // Reset checkboxes
        this.renderSummary();
    },
    
    removeExpense(id) {
        this.expenses = this.expenses.filter(e => e.id !== id);
        this.renderSummary();
    },
    
    clearAll() {
        if (this.people.length === 0 && this.expenses.length === 0) return;
        if (!confirm('Limpar toda a mesa? Isso apagará este racha atual.')) return;
        
        this.people = [];
        this.expenses = [];
        this.renderPeople();
        this.renderSummary();
    },
    
    renderPeople() {
        const list = document.getElementById('qs-people-list');
        const checkboxes = document.getElementById('qs-participants-list');
        
        if (this.people.length === 0) {
            list.innerHTML = '<p class="no-participants-message" style="padding: 10px; width: 100%;">Nenhuma pessoa na mesa.</p>';
            checkboxes.innerHTML = '<p class="help-text">Adicione pessoas primeiro.</p>';
            return;
        }
        
        list.innerHTML = '';
        checkboxes.innerHTML = '';
        
        this.people.forEach(name => {
            // Chip da pessoa
            const chip = document.createElement('div');
            chip.className = 'person-chip';
            chip.innerHTML = `
                <i data-lucide="user" class="icon-sm"></i> ${name}
                <div class="person-actions">
                    <button type="button" class="btn-delete" onclick="QuickSplitManager.removePerson('${name}')" title="Remover"><i data-lucide="x" class="icon-sm"></i></button>
                </div>
            `;
            list.appendChild(chip);
            
            // Checkbox para despesa
            const lbl = document.createElement('label');
            lbl.innerHTML = `<input type="checkbox" value="${name}"> ${name}`;
            checkboxes.appendChild(lbl);
        });
        
        if (window.lucide) lucide.createIcons();
    },
    
    renderSummary() {
        const expenseList = document.getElementById('qs-expense-list');
        const subtotalEl = document.getElementById('qs-subtotal');
        const taxAmountEl = document.getElementById('qs-tax-amount');
        const grandTotalEl = document.getElementById('qs-grand-total');
        const applyTax = document.getElementById('qs-apply-tax').checked;
        const personTotalsEl = document.getElementById('qs-person-totals');
        
        if (this.expenses.length === 0) {
            expenseList.innerHTML = '<li class="no-participants-message">Nenhum consumo adicionado.</li>';
        } else {
            expenseList.innerHTML = '';
            this.expenses.forEach(e => {
                const li = document.createElement('li');
                li.className = 'expense-item';
                li.style.padding = '8px 12px';
                li.innerHTML = `
                    <div class="expense-info">
                        <div class="expense-title" style="margin: 0;">
                            <span class="expense-description">${e.description}</span>
                            <span class="expense-amount">R$ ${e.amount.toFixed(2)}</span>
                        </div>
                        <small>P/ ${e.participants.join(', ')}</small>
                    </div>
                    <div class="button-group" style="margin-left: 8px;">
                        <button type="button" class="btn-danger btn-sm" onclick="QuickSplitManager.removeExpense(${e.id})" style="padding: 4px 8px;"><i data-lucide="trash-2" class="icon-sm"></i></button>
                    </div>
                `;
                expenseList.appendChild(li);
            });
        }
        
        const subtotal = this.expenses.reduce((acc, e) => acc + e.amount, 0);
        const tax = applyTax ? subtotal * 0.10 : 0;
        const grandTotal = subtotal + tax;
        
        subtotalEl.textContent = `R$ ${subtotal.toFixed(2)}`;
        taxAmountEl.textContent = `R$ ${tax.toFixed(2)}`;
        grandTotalEl.textContent = `R$ ${grandTotal.toFixed(2)}`;
        
        // Calcular parte de cada pessoa
        const totals = {};
        this.people.forEach(p => totals[p] = 0);
        
        this.expenses.forEach(e => {
            if (e.participants.length > 0) {
                const share = e.amount / e.participants.length;
                e.participants.forEach(p => {
                    if (totals[p] !== undefined) totals[p] += share;
                });
            }
        });
        
        personTotalsEl.innerHTML = '';
        if (this.people.length > 0) {
            this.people.forEach(p => {
                const personSubtotal = totals[p];
                const personTax = applyTax ? personSubtotal * 0.10 : 0;
                const personTotal = personSubtotal + personTax;
                
                const div = document.createElement('div');
                div.className = 'qs-person-result';
                div.innerHTML = `
                    <span style="font-weight: 500; display: flex; align-items: center; gap: 6px;"><i data-lucide="user" class="icon-sm"></i> ${p}</span>
                    <span style="font-weight: 700; color: var(--primary);">R$ ${personTotal.toFixed(2)}</span>
                `;
                personTotalsEl.appendChild(div);
            });
        } else {
            personTotalsEl.innerHTML = '<p class="help-text">Adicione pessoas para ver a divisão.</p>';
        }
        
        if (window.lucide) lucide.createIcons();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    QuickSplitManager.init();
});
