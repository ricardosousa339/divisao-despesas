// storage.js — Persistência via localStorage para GitHub Pages

const STORAGE_KEY = 'divisao-despesas-data';

const Storage = {
    /**
     * Salva todo o estado do app no localStorage
     */
    save(data) {
        try {
            const serialized = JSON.stringify({
                people: data.people,         // Array de {name, isPermanent}
                expenses: data.expenses,     // Array de objetos de despesa
                archivedCycles: data.archivedCycles || [], // Períodos fechados
                settings: data.settings || { settlementDay: null },
                version: 2
            });
            localStorage.setItem(STORAGE_KEY, serialized);
        } catch (e) {
            console.error('Erro ao salvar dados:', e);
        }
    },

    /**
     * Carrega o estado salvo do localStorage
     * Retorna null se não houver dados salvos
     */
    load() {
        try {
            const serialized = localStorage.getItem(STORAGE_KEY);
            if (!serialized) return null;
            const data = JSON.parse(serialized);
            return data;
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
            return null;
        }
    },

    /**
     * Limpa todos os dados salvos
     */
    clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Erro ao limpar dados:', e);
        }
    },

    /**
     * Exporta todos os dados como download de arquivo JSON
     */
    exportData(data) {
        const serialized = JSON.stringify(data, null, 2);
        const blob = new Blob([serialized], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `despesas-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Importa dados de um arquivo JSON selecionado pelo usuário
     * Retorna uma Promise com os dados importados
     */
    importData() {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) {
                    reject(new Error('Nenhum arquivo selecionado'));
                    return;
                }
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        // Validação básica da estrutura
                        if (!data.people || !data.expenses) {
                            reject(new Error('Arquivo inválido: estrutura incorreta'));
                            return;
                        }
                        resolve(data);
                    } catch (err) {
                        reject(new Error('Arquivo inválido: JSON malformado'));
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        });
    }
};
