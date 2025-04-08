class Expense {
    constructor(description, amount, payer, participants = []) {
        this.description = description;
        this.amount = amount;
        this.payer = payer;
        this.participants = participants;
    }

    editExpense(newDescription, newAmount, newPayer, newParticipants) {
        this.description = newDescription;
        this.amount = newAmount;
        this.payer = newPayer;
        if (newParticipants) {
            this.participants = newParticipants;
        }
    }

    static deleteExpense(expenses, expenseToDelete) {
        return expenses.filter(expense => expense !== expenseToDelete);
    }
} 

function createExpense(description, amount, payer, participants = []) {
    return new Expense(description, amount, payer, participants);
} 

function getExpenseDetails(expense) {
    return {
        description: expense.description,
        amount: expense.amount,
        payer: expense.payer,
        participants: expense.participants
    };
}

// Remove export statements
// Expense, createExpense, and getExpenseDetails are now globally available