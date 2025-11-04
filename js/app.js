// app.js

document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expense-form');
    const personForm = document.getElementById('person-form');
    const expenseList = document.getElementById('expense-list');
    const managePeopleList = document.getElementById('manage-people-list');
    const participantsList = document.getElementById('participants-list');
    const totalDisplay = document.getElementById('total-display');
    const expenseDistribution = document.getElementById('expense-distribution');
    const adjustmentsDisplay = document.getElementById('adjustments');
    const submitButton = document.getElementById('submit-button');
    const noParticipantsMessage = document.getElementById('no-participants-message');
    const payerSelect = document.getElementById('payer');
    
    let expenses = [];
    let people = new Set(); // Track unique people (case sensitive)
    let peopleNormalizedMap = new Map(); // Map normalized (lowercase) names to original capitalization
    let editMode = false;

    // Adicionar o event listener para o formulário de pessoas
    personForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const personName = document.getElementById('person-name').value.trim();
        
        if (personName) {
            addPerson(personName);
            personForm.reset();
        }
    });

    // Desabilitar o botão de adicionar despesa se não houver pessoas
    function checkExpenseButtonState() {
        const addExpenseButton = document.querySelector('button[onclick="switchTab(\'add-expense\')"]');
        if (people.size === 0) {
            addExpenseButton.disabled = true;
            addExpenseButton.title = "Adicione pelo menos uma pessoa primeiro";
            addExpenseButton.style.opacity = "0.5";
            addExpenseButton.style.cursor = "not-allowed";
        } else {
            addExpenseButton.disabled = false;
            addExpenseButton.title = "";
            addExpenseButton.style.opacity = "1";
            addExpenseButton.style.cursor = "pointer";
        }
    }

    function addPerson(name) {
        const normalizedName = name.toLowerCase();
        
        // Verificar se já existe uma pessoa com esse nome (case insensitive)
        if (peopleNormalizedMap.has(normalizedName)) {
            const existingName = peopleNormalizedMap.get(normalizedName);
            showNotification(`Pessoa "${existingName}" já existe!`, 'warning');
        } else {
            people.add(name);
            peopleNormalizedMap.set(normalizedName, name);
            updatePeopleList();
            updatePayerSelect();
            checkExpenseButtonState();
            showNotification(`Pessoa "${name}" adicionada com sucesso!`);
        }
    }

    function deletePerson(name) {
        if (confirm(`Tem certeza que deseja excluir a pessoa "${name}"?`)) {
            // Verificar se a pessoa está em alguma despesa
            const personInExpense = expenses.some(exp => 
                exp.payer === name || (exp.participants && exp.participants.includes(name))
            );
            
            if (personInExpense) {
                showNotification(`Não é possível excluir "${name}" pois está associado a despesas.`, 'warning');
                return;
            }
            
            people.delete(name);
            peopleNormalizedMap.delete(name.toLowerCase());
            updatePeopleList();
            updatePayerSelect();
            checkExpenseButtonState();
            showNotification(`Pessoa "${name}" excluída com sucesso!`);
        }
    }

    // Nova função para atualizar o select de pagador
    function updatePayerSelect() {
        const allPeople = Array.from(people);
        
        // Limpar as opções atuais, mantendo apenas o primeiro item
        payerSelect.innerHTML = '<option value="">Selecione quem pagou</option>';
        
        // Adicionar cada pessoa como uma opção
        allPeople.forEach(person => {
            const option = document.createElement('option');
            option.value = person;
            option.textContent = person;
            payerSelect.appendChild(option);
        });

        // Verificar se deve exibir mensagem de aviso
        if (allPeople.length === 0) {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = "Adicione pessoas primeiro";
            payerSelect.appendChild(option);
        }
    }

    // Adicionar função para atualizar a lista de pessoas na aba "Gerenciar Pessoas"
    function updateManagePeopleList() {
        const allPeople = Array.from(people);
        
        if (allPeople.length === 0) {
            managePeopleList.innerHTML = '<p class="no-participants-message">Nenhuma pessoa adicionada ainda.</p>';
            return;
        }
        
        managePeopleList.innerHTML = '';
        
        allPeople.forEach(person => {
            const div = document.createElement('div');
            div.innerHTML = `
                <span>${person}</span>
                <button type="button" onclick="deletePerson('${person.replace(/'/g, "\\'")}')">×</button>
            `;
            managePeopleList.appendChild(div);
        });
    }

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const description = document.getElementById('description').value;
        const payer = document.getElementById('payer').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const id = document.getElementById('expense-id').value;
        
        // Verificar se um pagador foi selecionado
        if (!payer) {
            showNotification("Por favor, selecione quem pagou esta despesa.", 'warning');
            return;
        }
        
        // Get selected participants
        const selectedParticipants = [];
        const checkboxes = document.querySelectorAll('#participants-list input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            selectedParticipants.push(checkbox.value);
        });
        
        // Não adicionar mais automaticamente o pagador como participante
        // Respeitar apenas quem foi explicitamente selecionado

        if (id) {
            editExpense(id, description, amount, payer, selectedParticipants);
            showNotification("Despesa atualizada com sucesso!");
            submitButton.textContent = "Adicionar Despesa";
            submitButton.classList.remove("btn-success");
            submitButton.classList.add("btn-primary");
            editMode = false;
        } else {
            addExpense(description, amount, payer, selectedParticipants);
            showNotification("Despesa adicionada com sucesso!");
        }

        expenseForm.reset();
        document.getElementById('expense-id').value = '';
        updateParticipantsList();
        
        // Switch to the expenses tab after adding
        switchTab('view-expenses');
    });

    function addExpense(description, amount, payer, participants) {
        // Se não houver participantes selecionados, incluir todas as pessoas
        if (!participants || participants.length === 0) {
            // Usar todas as pessoas como participantes
            participants = Array.from(people);
        }
        
        const expense = { 
            id: Date.now(), 
            description, 
            amount, 
            payer, 
            participants: participants, 
            // Não precisamos mais usar allParticipantsAtCreation
            allParticipantsAtCreation: null
        };
        
        expenses.push(expense);
        renderExpenses();
        updateSummary();
    }

    function editExpense(id, description, amount, payer, participants) {
        const index = expenses.findIndex(exp => exp.id == id);
        if (index > -1) {
            // Se não houver participantes selecionados, incluir todas as pessoas
            if (!participants || participants.length === 0) {
                // Usar todas as pessoas como participantes
                participants = Array.from(people);
            }
            
            expenses[index] = { 
                id: parseInt(id), 
                description, 
                amount, 
                payer, 
                participants: participants,
                // Não precisamos mais usar allParticipantsAtCreation
                allParticipantsAtCreation: null
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
            updatePeopleList(); // Isso já atualiza participantsList e managePeopleList
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
                    <div class="expense-title">
                        <span class="expense-description">${exp.description}</span>
                        <span class="expense-amount">R$ ${exp.amount.toFixed(2)}</span>
                    </div>
                    <small class="expense-payer">Pago por: ${exp.payer}</small>
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
        // Update participant checkboxes
        updateParticipantsList();
        // Atualizar a lista na aba de gerenciar pessoas
        updateManagePeopleList();
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
            expenseDistribution.innerHTML = '';
            adjustmentsDisplay.innerHTML = '<p class="no-participants-message">Adicione despesas para ver os ajustes necessários.</p>';
            return;
        }
        
        const summary = getExpenseSummary(expenses);
        totalDisplay.textContent = `Total: R$ ${summary.totalExpenses.toFixed(2)}`;
        
        // Mostrar a distribuição de despesas por pessoa - NOVA VERSÃO MAIS CLARA
        expenseDistribution.innerHTML = `
            <div class="section-header">
                <h3>Resumo por Pessoa:</h3>
                <div class="help-icon" id="summary-help">?</div>
            </div>
        `;
        
        // Criar o conteúdo de ajuda escondido
        const helpContent = document.createElement('div');
        helpContent.className = 'help-content';
        helpContent.id = 'summary-help-content';
        helpContent.style.display = 'none';
        helpContent.innerHTML = `
            <p><strong>Explicação:</strong></p>
            <ul>
                <li><strong>Pagou</strong>: Total que a pessoa já desembolsou</li>
                <li><strong>Deve</strong>: Valor que a pessoa deve pagar no total (sua parcela nas despesas)</li>
                <li><strong>Saldo</strong>: A diferença entre o que pagou e o que deve (positivo = recebe, negativo = paga)</li>
                <li><strong>% das Despesas</strong>: Porcentagem das despesas totais que a pessoa está pagando</li>
            </ul>
            <button class="close-help">Fechar</button>
        `;
        expenseDistribution.appendChild(helpContent);
        
        // Adicionar evento de clique ao ícone de ajuda
        setTimeout(() => {
            const helpIcon = document.getElementById('summary-help');
            const helpContentElement = document.getElementById('summary-help-content');
            
            if (helpIcon && helpContentElement) {
                helpIcon.addEventListener('click', () => {
                    helpContentElement.style.display = helpContentElement.style.display === 'none' ? 'block' : 'none';
                });
                
                // Botão para fechar a ajuda
                const closeButton = helpContentElement.querySelector('.close-help');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        helpContentElement.style.display = 'none';
                    });
                }
            }
        }, 100);
        
        const distributionSection = document.createElement('div');
        distributionSection.className = 'distribution-section';
        
        // Calcular quanto cada pessoa pagou e quanto deve
        const allParticipants = getAllParticipants(expenses);
        
        const personDetails = allParticipants.map(name => {
            const personExpenses = calculatePersonExpenses(expenses, name);
            return {
                name,
                paid: personExpenses.paid,
                owed: personExpenses.owed,
                balance: personExpenses.balance
            };
        });
        
        // Ordenar por nome para facilitar a leitura
        personDetails.sort((a, b) => a.name.localeCompare(b.name));
        
        // Criar tabela para melhor visualização
        const table = document.createElement('table');
        table.className = 'expenses-summary-table';
        
        // Cabeçalho da tabela
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th class="person-name">Nome</th>
                <th class="amount paid-amount">Pagou</th>
                <th class="amount owed-amount">Deve</th>
                <th class="amount balance-amount">Saldo</th>
                <th class="percentage">% das Despesas</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Corpo da tabela
        const tbody = document.createElement('tbody');
        
        personDetails.forEach(person => {
            const participationPercent = summary.totalExpenses > 0 
                ? (person.owed / summary.totalExpenses) * 100 
                : 0;
            
            const row = document.createElement('tr');
            
            // Adicionar classe com base no saldo (positivo, negativo ou neutro)
            if (Math.abs(person.balance) < 0.01) {
                row.className = 'balance-neutral';
            } else if (person.balance > 0) {
                row.className = 'balance-positive';
            } else {
                row.className = 'balance-negative';
            }
            
            row.innerHTML = `
                <td class="person-name">${person.name}</td>
                <td class="amount paid-amount">R$ ${person.paid.toFixed(2)}</td>
                <td class="amount owed-amount">R$ ${person.owed.toFixed(2)}</td>
                <td class="amount balance-amount">${person.balance >= 0 ? '+' : ''}R$ ${person.balance.toFixed(2)}</td>
                <td class="percentage">${participationPercent.toFixed(1)}%</td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        distributionSection.appendChild(table);
        
        expenseDistribution.appendChild(distributionSection);
        
        // Resto do código permanece igual
        adjustmentsDisplay.innerHTML = '<h3>Ajustes necessários:</h3>';
        
        // Display individual adjustments
        const adjustmentsSection = document.createElement('div');
        adjustmentsSection.className = 'adjustments-section';
        
        // Create a map of people who owe money or will receive money
        const transactionMap = new Map();
        
        // Initialize the map with everyone at 0
        summary.adjustments.forEach(adj => {
            transactionMap.set(adj.name, 0);
        });
        
        // Add transaction amounts to the map
        summary.transactions.forEach(transaction => {
            // The person who needs to pay (debtor) has a negative amount
            transactionMap.set(transaction.from, 
                (transactionMap.get(transaction.from) || 0) - transaction.amount);
            
            // The person who receives (creditor) has a positive amount
            transactionMap.set(transaction.to, 
                (transactionMap.get(transaction.to) || 0) + transaction.amount);
        });
        
        // Now display the balance based on the transaction map
        for (const [name, amount] of transactionMap.entries()) {
            const div = document.createElement('div');
            
            if (Math.abs(amount) < 0.01) { // Using a small threshold to handle floating-point issues
                div.classList.add('adjustment-item', 'adjustment-neutral');
                div.textContent = `${name} está equilibrado`;
            } else if (amount > 0) {
                div.classList.add('adjustment-item', 'adjustment-positive');
                div.textContent = `${name} deve receber R$ ${amount.toFixed(2)}`;
            } else if (amount < 0) {
                div.classList.add('adjustment-item', 'adjustment-negative');
                div.textContent = `${name} deve pagar R$ ${Math.abs(amount).toFixed(2)}`;
            }
            
            adjustmentsSection.appendChild(div);
        }
        
        adjustmentsDisplay.appendChild(adjustmentsSection);
        
        // Display payment transactions
        if (summary.transactions.length > 0) {
            const transactionsHeader = document.createElement('h3');
            transactionsHeader.textContent = 'Pagamentos sugeridos:';
            transactionsHeader.className = 'transactions-header';
            adjustmentsDisplay.appendChild(transactionsHeader);
            
            const transactionsSection = document.createElement('div');
            transactionsSection.className = 'transactions-section';
            
            summary.transactions.forEach(transaction => {
                const div = document.createElement('div');
                div.classList.add('transaction-item');
                div.innerHTML = `
                    <span class="transaction-debtor">${transaction.from}</span>
                    <span class="transaction-arrow">→</span>
                    <span class="transaction-creditor">${transaction.to}</span>
                    <span class="transaction-amount">R$ ${transaction.amount.toFixed(2)}</span>
                `;
                transactionsSection.appendChild(div);
            });
            
            adjustmentsDisplay.appendChild(transactionsSection);
        }
    }

    function showNotification(message, type = 'success') {
        // Create a notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        // Add styles
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        notification.style.zIndex = '1000';
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(20px)';
        notification.style.transition = 'opacity 0.3s, transform 0.3s';
        
        // Definir cor com base no tipo
        if (type === 'warning') {
            notification.style.backgroundColor = '#f39c12';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#e74c3c';
        } else {
            notification.style.backgroundColor = '#2ecc71';
        }
        
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
    window.deletePerson = deletePerson;

    window.editExpensePrompt = (id) => {
        const expense = expenses.find(exp => exp.id == id);
        if (expense) {
            document.getElementById('description').value = expense.description;
            document.getElementById('payer').value = expense.payer;
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
                
                // First, uncheck all checkboxes
                checkboxes.forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Then check only those who are participants (and make sure payer is checked)
                checkboxes.forEach(checkbox => {
                    // Always check the payer's checkbox in non-edit mode
                    if (checkbox.value === expense.payer && !editMode) {
                        checkbox.checked = true;
                    }
                    // Check other participants from the saved list
                    else if (expense.participants && expense.participants.includes(checkbox.value)) {
                        checkbox.checked = true;
                    }
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
    updateManagePeopleList();
    updatePayerSelect();
    renderExpenses();
    updateSummary();
    checkExpenseButtonState();
});