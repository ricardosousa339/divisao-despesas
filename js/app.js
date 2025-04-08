// app.js

document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const peopleList = document.getElementById('people-list');
    const participantsList = document.getElementById('participants-list');
    const totalDisplay = document.getElementById('total-display');
    const costPerPersonDisplay = document.getElementById('cost-per-person');
    const adjustmentsDisplay = document.getElementById('adjustments');
    const submitButton = document.getElementById('submit-button');
    const noParticipantsMessage = document.getElementById('no-participants-message');
    
    let expenses = [];
    let people = new Set(); // Track unique people
    let editMode = false;

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const id = document.getElementById('expense-id').value;
        
        // Get selected participants
        const selectedParticipants = [];
        const checkboxes = document.querySelectorAll('#participants-list input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            selectedParticipants.push(checkbox.value);
        });

        if (id) {
            editExpense(id, name, amount, selectedParticipants);
            showNotification("Despesa atualizada com sucesso!");
            submitButton.textContent = "Adicionar Despesa";
            submitButton.classList.remove("btn-success");
            submitButton.classList.add("btn-primary");
            editMode = false;
        } else {
            addExpense(name, amount, selectedParticipants);
            showNotification("Despesa adicionada com sucesso!");
        }

        // Add this person to our list of people if they're new
        if (!people.has(name)) {
            people.add(name);
            updatePeopleList();
        }

        expenseForm.reset();
        document.getElementById('expense-id').value = '';
        updateParticipantsList();
        
        // Switch to the expenses tab after adding
        switchTab('view-expenses');
    });

    function addExpense(name, amount, participants) {
        const expense = { 
            id: Date.now(), 
            name, 
            amount, 
            participants 
        };
        expenses.push(expense);
        renderExpenses();
        updateSummary();
    }

    function editExpense(id, name, amount, participants) {
        const index = expenses.findIndex(exp => exp.id == id);
        if (index > -1) {
            expenses[index] = { 
                id: parseInt(id), 
                name, 
                amount, 
                participants 
            };
            renderExpenses();
            updateSummary();
        }
    }

    function deleteExpense(id) {
        if (confirm("Tem certeza que deseja excluir esta despesa?")) {
            expenses = expenses.filter(exp => exp.id != id);
            renderExpenses();
            updateSummary();
            updatePeopleList(); // People list might change if an expense is deleted
            updateParticipantsList();
            showNotification("Despesa excluída com sucesso!");
        }
    }

    function renderExpenses() {
        if (expenses.length === 0) {
            expenseList.innerHTML = '<li class="no-participants-message">Nenhuma despesa adicionada ainda.</li>';
            return;
        }
        
        expenseList.innerHTML = '';

        expenses.forEach(exp => {
            const li = document.createElement('li');
            li.classList.add('expense-item');
            
            // Format participants display
            let participantsText = '';
            if (exp.participants && exp.participants.length > 0) {
                participantsText = `<small>Participantes: ${exp.participants.join(', ')}</small>`;
            } else {
                participantsText = '<small>Participantes: Todos</small>';
            }
            
            li.innerHTML = `
                <div class="expense-info">
                    <span class="expense-name">${exp.name}</span>
                    <span class="expense-amount">R$ ${exp.amount.toFixed(2)}</span>
                    ${participantsText}
                </div>
                <div class="button-group">
                    <button class="btn-primary btn-sm" onclick="editExpensePrompt(${exp.id})">Editar</button>
                    <button class="btn-danger btn-sm" onclick="deleteExpense(${exp.id})">Excluir</button>
                </div>
            `;
            expenseList.appendChild(li);
        });
    }

    function updatePeopleList() {
        // Update the master list of all people
        const allPeople = getAllParticipants(expenses);
        people = new Set(allPeople); // Update our Set of people
        
        if (allPeople.length === 0) {
            peopleList.innerHTML = '<p class="no-participants-message">Nenhuma pessoa adicionada ainda.</p>';
            return;
        }
        
        peopleList.innerHTML = '';
        allPeople.forEach(person => {
            const div = document.createElement('div');
            div.textContent = person;
            peopleList.appendChild(div);
        });
        
        // Update participant checkboxes
        updateParticipantsList();
    }

    function updateParticipantsList() {
        const allPeople = Array.from(people);
        
        if (allPeople.length === 0) {
            participantsList.innerHTML = '<p id="no-participants-message" class="no-participants-message">Adicione uma despesa primeiro para ver as pessoas disponíveis.</p>';
            return;
        }
        
        if (noParticipantsMessage) {
            noParticipantsMessage.style.display = 'none';
        }
        
        participantsList.innerHTML = '';
        
        allPeople.forEach(person => {
            const label = document.createElement('label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = person;
            checkbox.name = 'participants[]';
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${person}`));
            participantsList.appendChild(label);
        });
    }

    function updateSummary() {
        if (expenses.length === 0) {
            totalDisplay.textContent = `Total: R$ 0.00`;
            costPerPersonDisplay.textContent = `Custo por pessoa: R$ 0.00`;
            adjustmentsDisplay.innerHTML = '<p class="no-participants-message">Adicione despesas para ver os ajustes necessários.</p>';
            return;
        }
        
        const summary = getExpenseSummary(expenses);
        totalDisplay.textContent = `Total: R$ ${summary.totalExpenses.toFixed(2)}`;
        costPerPersonDisplay.textContent = `Custo por pessoa: R$ ${summary.costPerPerson.toFixed(2)}`;
        
        adjustmentsDisplay.innerHTML = '';
        summary.adjustments.forEach(adj => {
            const div = document.createElement('div');
            
            if (adj.adjustment > 0) {
                div.classList.add('adjustment-item', 'adjustment-positive');
                div.textContent = `${adj.name} deve receber R$ ${adj.adjustment.toFixed(2)}`;
            } else if (adj.adjustment < 0) {
                div.classList.add('adjustment-item', 'adjustment-negative');
                div.textContent = `${adj.name} deve pagar R$ ${Math.abs(adj.adjustment).toFixed(2)}`;
            } else {
                div.classList.add('adjustment-item', 'adjustment-neutral');
                div.textContent = `${adj.name} está equilibrado`;
            }
            
            adjustmentsDisplay.appendChild(div);
        });
    }

    function showNotification(message) {
        // Create a notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add styles
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.backgroundColor = '#2ecc71';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '1000';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        
        // Add to body
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        }, 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(20px)';
            
            // Remove from DOM after animation
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // Make functions available globally
    window.deleteExpense = deleteExpense;

    window.editExpensePrompt = (id) => {
        const expense = expenses.find(exp => exp.id == id);
        if (expense) {
            document.getElementById('name').value = expense.name;
            document.getElementById('amount').value = expense.amount;
            document.getElementById('expense-id').value = expense.id;
            
            // Switch to the add expense tab
            switchTab('add-expense');
            
            // Change button text and style to indicate edit mode
            submitButton.textContent = "Atualizar Despesa";
            submitButton.classList.remove("btn-primary");
            submitButton.classList.add("btn-success");
            editMode = true;
            
            // Update the participant checkboxes after a short delay to ensure they're rendered
            setTimeout(() => {
                const checkboxes = document.querySelectorAll('#participants-list input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = expense.participants && expense.participants.includes(checkbox.value);
                });
            }, 100);
        }
    };
    
    // Make switchTab function available globally
    window.switchTab = function(tabId) {
        // Hide all tabs
        document.querySelectorAll('.tab-pane').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Deactivate all tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        
        // Show the selected tab
        document.getElementById(tabId).classList.add('active');
        
        // Activate the correct button
        document.querySelectorAll('.tab-button').forEach(button => {
            if (button.getAttribute('onclick').includes(tabId)) {
                button.classList.add('active');
            }
        });
    };
    
    // Initial setup
    updatePeopleList();
    renderExpenses();
    updateSummary();
});