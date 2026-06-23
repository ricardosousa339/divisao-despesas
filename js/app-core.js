// app-core.js — Estado global, pessoas, persistência, tabs, notificações

const App = {
    people: [],          // [{name, isPermanent}]
    expenses: [],        // [{id, description, amount, payer, participants, date, isRecurring, isFixedValue, frequency, isPending}]
    archivedCycles: [],  // [{id, startDate, endDate, expenses, people, summary}]
    settings: { settlementDay: null },

    init() {
        const saved = Storage.load();
        if (saved) {
            this.people = saved.people || [];
            this.expenses = saved.expenses || [];
            this.archivedCycles = saved.archivedCycles || [];
            this.settings = saved.settings || { settlementDay: null };
        }

        // Add default user "Eu" if no people are registered
        if (this.people.length === 0) {
            this.people.push({ name: 'Eu', isPermanent: true });
            this.save();
        }

        this.bindForms();
        this.refreshAll();
        this.checkSettlementBanner();
        if (this.settings.settlementDay) {
            document.getElementById('settlement-day').value = this.settings.settlementDay;
        }
        ThemeManager.init();
    },

    save() {
        Storage.save({
            people: this.people,
            expenses: this.expenses,
            archivedCycles: this.archivedCycles,
            settings: this.settings
        });
    },

    bindForms() {
        document.getElementById('person-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('person-name').value.trim();
            const isPermanent = document.getElementById('person-permanent').checked;
            if (name) {
                this.addPerson(name, isPermanent);
                e.target.reset();
            }
        });

        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            ExpenseManager.handleSubmit();
        });
    },

    // === PEOPLE ===
    addPerson(name, isPermanent) {
        const exists = this.people.find(p => p.name.toLowerCase() === name.toLowerCase());
        if (exists) {
            showNotification(`"${exists.name}" já existe!`, 'warning');
            return;
        }
        this.people.push({ name, isPermanent });
        this.save();
        this.refreshAll();
        showNotification(`"${name}" adicionada!`);
    },

    deletePerson(name) {
        if (!confirm(`Excluir "${name}"?`)) return;
        const inExpense = this.expenses.some(e => e.payer === name || (e.participants && e.participants.includes(name)));
        if (inExpense) {
            showNotification(`"${name}" está em despesas, não pode excluir.`, 'warning');
            return;
        }
        this.people = this.people.filter(p => p.name !== name);
        this.save();
        this.refreshAll();
        showNotification(`"${name}" excluída!`);
    },

    togglePermanent(name) {
        const person = this.people.find(p => p.name === name);
        if (person) {
            person.isPermanent = !person.isPermanent;
            this.save();
            this.refreshAll();
        }
    },

    refreshAll() {
        this.renderPeopleList();
        this.updatePayerSelect();
        this.updateParticipantsList();
        ExpenseManager.render();
        SummaryManager.update();
        HistoryManager.render();
        this.checkExpenseButtonState();
    },

    renderPeopleList() {
        const el = document.getElementById('manage-people-list');
        if (this.people.length === 0) {
            el.innerHTML = '<p class="no-participants-message">Nenhuma pessoa adicionada ainda.</p>';
            return;
        }
        el.innerHTML = '';
        this.people.forEach(p => {
            const div = document.createElement('div');
            div.className = 'person-chip' + (p.isPermanent ? ' permanent' : '');
            div.innerHTML = `
                <i data-lucide="user" class="icon-sm"></i> ${p.name}
                <div class="person-actions">
                    <button type="button" class="btn-pin" title="${p.isPermanent ? 'Remover permanente' : 'Tornar permanente'}" onclick="App.togglePermanent('${p.name.replace(/'/g, "\\'")}')">
                        <i data-lucide="${p.isPermanent ? 'pin-off' : 'pin'}" class="icon-sm"></i>
                    </button>
                    <button type="button" class="btn-delete" onclick="App.deletePerson('${p.name.replace(/'/g, "\\'")}')">
                        <i data-lucide="x" class="icon-sm"></i>
                    </button>
                </div>
            `;
            el.appendChild(div);
        });
    },

    updatePayerSelect() {
        const sel = document.getElementById('payer');
        sel.innerHTML = '<option value="">Selecione quem pagou</option>';
        this.people.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            sel.appendChild(opt);
        });
        if (window.lucide) lucide.createIcons();
    },

    updateParticipantsList() {
        const el = document.getElementById('participants-list');
        if (this.people.length === 0) {
            el.innerHTML = '<p class="no-participants-message">Adicione pessoas primeiro.</p>';
            return;
        }
        el.innerHTML = '';
        this.people.forEach(p => {
            const label = document.createElement('label');
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = p.name;
            cb.name = 'participants[]';
            if (p.isPermanent) cb.checked = true;
            label.appendChild(cb);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = ` ${p.name}`;
            label.appendChild(textSpan);
            
            if (p.isPermanent) {
                const icon = document.createElement('i');
                icon.setAttribute('data-lucide', 'pin');
                icon.className = 'icon-sm';
                icon.style.marginLeft = '4px';
                icon.style.color = 'var(--primary)';
                label.appendChild(icon);
            }
            el.appendChild(label);
        });
    },

    checkExpenseButtonState() {
        const btn = document.querySelector('button[onclick="switchTab(\'add-expense\')"]');
        if (!btn) return;
        if (this.people.length === 0) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    },

    checkSettlementBanner() {
        const banner = document.getElementById('settlement-banner');
        const day = this.settings.settlementDay;
        if (!day) { banner.style.display = 'none'; return; }
        const today = new Date();
        const currentDay = today.getDate();
        if (currentDay >= day) {
            document.getElementById('settlement-banner-text').textContent =
                `O dia de acerto (dia ${day}) já passou. Considere fechar o período.`;
            banner.style.display = 'flex';
        } else {
            const remaining = day - currentDay;
            document.getElementById('settlement-banner-text').textContent =
                `Próximo acerto em ${remaining} dia${remaining > 1 ? 's' : ''} (dia ${day}).`;
            banner.style.display = 'flex';
            banner.classList.add('info');
        }
    }
};

// === GLOBAL FUNCTIONS ===
function switchTab(tabId) {
    document.querySelectorAll('.tab-pane').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.tab-button').forEach(b => {
        if (b.getAttribute('onclick').includes(tabId)) b.classList.add('active');
    });
}

function dismissSettlementBanner() {
    document.getElementById('settlement-banner').style.display = 'none';
}

function saveSettlementDay() {
    const val = parseInt(document.getElementById('settlement-day').value);
    if (val >= 1 && val <= 31) {
        App.settings.settlementDay = val;
        App.save();
        App.checkSettlementBanner();
        showNotification(`Dia de acerto definido para dia ${val}!`);
    } else {
        App.settings.settlementDay = null;
        App.save();
        App.checkSettlementBanner();
        showNotification('Ciclo de acerto desativado (modo livre).');
    }
}

function exportAllData() {
    Storage.exportData({
        people: App.people, expenses: App.expenses,
        archivedCycles: App.archivedCycles, settings: App.settings
    });
    showNotification('Dados exportados!');
}

function importAllData() {
    Storage.importData().then(data => {
        App.people = data.people || [];
        App.expenses = data.expenses || [];
        App.archivedCycles = data.archivedCycles || [];
        App.settings = data.settings || { settlementDay: null };
        App.save();
        App.refreshAll();
        showNotification('Dados importados com sucesso!');
    }).catch(err => showNotification(err.message, 'error'));
}

function clearAllData() {
    if (!confirm('Tem certeza? TODOS os dados serão apagados permanentemente.')) return;
    if (!confirm('Última chance! Deseja exportar um backup antes?')) {
        Storage.clear();
        App.people = []; App.expenses = []; App.archivedCycles = [];
        App.settings = { settlementDay: null };
        App.refreshAll();
        showNotification('Todos os dados foram apagados.');
    } else {
        exportAllData();
    }
}

function showNotification(message, type = 'success') {
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = message;
    Object.assign(n.style, {
        position: 'fixed', bottom: '20px', right: '20px', color: 'white',
        padding: '12px 20px', borderRadius: '8px', zIndex: '1000',
        opacity: '0', transform: 'translateY(20px)', transition: 'all 0.3s',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)', maxWidth: '300px',
        backgroundColor: type === 'warning' ? '#f39c12' : type === 'error' ? '#e74c3c' : '#2ecc71'
    });
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity = '1'; n.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => {
        n.style.opacity = '0'; n.style.transform = 'translateY(20px)';
        setTimeout(() => document.body.removeChild(n), 300);
    }, 3000);
}

// === THEME MANAGER ===
const ThemeManager = {
    init() {
        // Observar mudanças do sistema se o usuário não escolheu um tema manual
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
            if (!localStorage.getItem('theme')) {
                document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
                this.updateToggleButton();
            }
        });
        this.updateToggleButton();
    },
    
    toggle() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateToggleButton();
        showNotification(`Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} ativado!`);
    },
    
    updateToggleButton() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const btn = document.getElementById('theme-toggle-btn');
        if (!btn) return;
        
        if (currentTheme === 'light') {
            btn.innerHTML = '<i data-lucide="moon" class="icon-sm"></i>';
            btn.title = "Mudar para tema escuro";
        } else {
            btn.innerHTML = '<i data-lucide="sun" class="icon-sm"></i>';
            btn.title = "Mudar para tema claro";
        }
        if (window.lucide) lucide.createIcons();
    }
};
