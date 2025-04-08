// app.js

document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const totalDisplay = document.getElementById('total-display');
    const costPerPersonDisplay = document.getElementById('cost-per-person');
    const adjustmentsDisplay = document.getElementById('adjustments');
    let expenses = [];

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const id = document.getElementById('expense-id').value;

        if (id) {
            editExpense(id, name, amount);
        } else {
            addExpense(name, amount);
        }

        expenseForm.reset();
        document.getElementById('expense-id').value = '';
    });

    function addExpense(name, amount) {
        const expense = { id: Date.now(), name, amount };
        expenses.push(expense);
        renderExpenses();
        updateSummary();
    }

    function editExpense(id, name, amount) {
        const index = expenses.findIndex(exp => exp.id == id);
        if (index > -1) {
            expenses[index] = { id: parseInt(id), name, amount };
            renderExpenses();
            updateSummary();
        }
    }

    function deleteExpense(id) {
        expenses = expenses.filter(exp => exp.id != id);
        renderExpenses();
        updateSummary();
    }

    function renderExpenses() {
        expenseList.innerHTML = '';

        expenses.forEach(exp => {
            const li = document.createElement('li');
            li.classList.add('expense-item');
            li.innerHTML = `
                <span>${exp.name}: R$ ${exp.amount.toFixed(2)}</span>
                <div>
                    <button class="edit-btn" onclick="editExpensePrompt(${exp.id})">Editar</button>
                    <button class="delete-btn" onclick="deleteExpense(${exp.id})">Excluir</button>
                </div>
            `;
            expenseList.appendChild(li);
        });
    }

    function updateSummary() {
        const summary = getExpenseSummary(expenses);
        totalDisplay.textContent = `Total: R$ ${summary.totalExpenses.toFixed(2)}`;
        costPerPersonDisplay.textContent = `Custo por pessoa: R$ ${summary.costPerPerson.toFixed(2)}`;
        
        adjustmentsDisplay.innerHTML = '<h3>Ajustes necessários:</h3>';
        summary.adjustments.forEach(adj => {
            const p = document.createElement('p');
            if (adj.adjustment > 0) {
                p.textContent = `${adj.name} deve receber R$ ${adj.adjustment.toFixed(2)}`;
            } else if (adj.adjustment < 0) {
                p.textContent = `${adj.name} deve pagar R$ ${Math.abs(adj.adjustment).toFixed(2)}`;
            } else {
                p.textContent = `${adj.name} está equilibrado`;
            }
            adjustmentsDisplay.appendChild(p);
        });
    }

    // Make functions available globally
    window.deleteExpense = deleteExpense;

    window.editExpensePrompt = (id) => {
        const expense = expenses.find(exp => exp.id == id);
        if (expense) {
            document.getElementById('name').value = expense.name;
            document.getElementById('amount').value = expense.amount;
            document.getElementById('expense-id').value = expense.id;
        }
    };
});