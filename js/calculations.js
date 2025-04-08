function calculateTotalExpenses(expenses) {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

function calculateCostPerPerson(totalExpenses, numberOfPeople) {
    return numberOfPeople > 0 ? totalExpenses / numberOfPeople : 0;
}

function calculateAdjustments(expenses, costPerPerson) {
    return expenses.map(expense => {
        const adjustment = expense.amount - costPerPerson;
        return {
            name: expense.name,
            adjustment: adjustment
        };
    });
}

function getExpenseSummary(expenses) {
    const totalExpenses = calculateTotalExpenses(expenses);
    const numberOfPeople = expenses.length;
    const costPerPerson = calculateCostPerPerson(totalExpenses, numberOfPeople);
    const adjustments = calculateAdjustments(expenses, costPerPerson);

    return {
        totalExpenses: totalExpenses,
        costPerPerson: costPerPerson,
        adjustments: adjustments
    };
}