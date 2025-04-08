class Expense {
    constructor(name, amount, payer) {
        this.name = name;
        this.amount = amount;
        this.payer = payer;
    }

    editExpense(newName, newAmount) {
        this.name = newName;
        this.amount = newAmount;
    }

    static deleteExpense(expenses, expenseToDelete) {
        return expenses.filter(expense => expense !== expenseToDelete);
    }
} 

function createExpense(name, amount, payer) {
    return new Expense(name, amount, payer);
} 

function getExpenseDetails(expense) {
    return {
        name: expense.name,
        amount: expense.amount,
        payer: expense.payer
    };
}

// Remove export statements
// Expense, createExpense, and getExpenseDetails are now globally available