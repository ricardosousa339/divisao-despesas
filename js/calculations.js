function calculateTotalExpenses(expenses) {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Get a unique list of all people involved in any expenses
function getAllParticipants(expenses) {
    const allParticipants = new Set();
    
    expenses.forEach(expense => {
        allParticipants.add(expense.name); // Add payer
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
        if (expense.name === personName) {
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

    // Simple average calculation for display purposes
    const costPerPerson = numberOfPeople > 0 ? totalExpenses / numberOfPeople : 0;

    return {
        totalExpenses: totalExpenses,
        costPerPerson: costPerPerson,
        adjustments: adjustments
    };
}