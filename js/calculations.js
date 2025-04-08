function calculateTotalExpenses(expenses) {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Get a unique list of all people involved in any expenses
function getAllParticipants(expenses) {
    const allParticipants = new Set();
    
    expenses.forEach(expense => {
        allParticipants.add(expense.payer); // Add payer
        if (expense.participants && expense.participants.length > 0) {
            expense.participants.forEach(participant => {
                allParticipants.add(participant);
            });
        }
    });
    
    return Array.from(allParticipants);
}

function calculatePersonExpenses(expenses, personName) {
    let totalOwed = 0;
    let totalPaid = 0;
    
    expenses.forEach(expense => {
        // If person is the payer, add the full amount to what they paid
        if (expense.payer === personName) {
            totalPaid += expense.amount;
        }
        
        // Calculate how much this person owes for this expense
        const participants = expense.participants && expense.participants.length > 0 
            ? expense.participants 
            : getAllParticipants(expenses);
        
        if (participants.includes(personName)) {
            const sharePerPerson = expense.amount / participants.length;
            totalOwed += sharePerPerson;
        }
    });
    
    return { paid: totalPaid, owed: totalOwed, balance: totalPaid - totalOwed };
}

function calculateOptimalPayments(adjustments) {
    // Create a copy and sort by adjustment value (negative to positive)
    const sortedAdjustments = [...adjustments].sort((a, b) => a.adjustment - b.adjustment);
    
    const transactions = [];
    let i = 0; // index for debtors (negative balances)
    let j = sortedAdjustments.length - 1; // index for creditors (positive balances)
    
    // Process until we've gone through all people
    while (i < j) {
        const debtor = sortedAdjustments[i];
        const creditor = sortedAdjustments[j];
        
        // Skip people who are already balanced
        if (Math.abs(debtor.adjustment) < 0.01) {
            i++;
            continue;
        }
        
        if (Math.abs(creditor.adjustment) < 0.01) {
            j--;
            continue;
        }
        
        // Calculate the payment amount (minimum of what's owed and what's due)
        const paymentAmount = Math.min(Math.abs(debtor.adjustment), creditor.adjustment);
        
        if (paymentAmount > 0.01) { // Only add non-zero transactions
            transactions.push({
                from: debtor.name,
                to: creditor.name,
                amount: paymentAmount
            });
        }
        
        // Update the adjustments
        debtor.adjustment += paymentAmount;
        creditor.adjustment -= paymentAmount;
        
        // Move to next person if they're balanced
        if (Math.abs(debtor.adjustment) < 0.01) {
            i++;
        }
        
        if (Math.abs(creditor.adjustment) < 0.01) {
            j--;
        }
    }
    
    return transactions;
}

function getExpenseSummary(expenses) {
    const totalExpenses = calculateTotalExpenses(expenses);
    const allParticipants = getAllParticipants(expenses);
    const numberOfPeople = allParticipants.length;
    
    // Calculate the balance for each person
    const adjustments = allParticipants.map(name => {
        const personExpenses = calculatePersonExpenses(expenses, name);
        return {
            name: name,
            adjustment: personExpenses.balance
        };
    });

    // Calculate optimal payment transactions
    const transactions = calculateOptimalPayments(adjustments);

    // Simple average calculation for display purposes
    const costPerPerson = numberOfPeople > 0 ? totalExpenses / numberOfPeople : 0;

    return {
        totalExpenses: totalExpenses,
        costPerPerson: costPerPerson,
        adjustments: adjustments,
        transactions: transactions
    };
}