// app-import.js — Nubank statement parsing, grouping, installment recognition, duplicate checking, and UI rendering

const NubankImporter = {
    groups: [], // parsed transaction groups

    toggleSection() {
        const content = document.getElementById('import-content');
        const icon = document.getElementById('import-toggle-icon');
        if (content.style.display === 'none' || content.style.display === '') {
            content.style.display = 'block';
            icon.textContent = '-';
            this.updatePayerDropdown();
        } else {
            content.style.display = 'none';
            icon.textContent = '+';
        }
    },

    updatePayerDropdown() {
        const select = document.getElementById('import-default-payer');
        if (!select) return;
        select.innerHTML = '<option value="">Selecione quem pagou</option>';
        App.people.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = p.name;
            // Default to "Eu" if available
            if (p.name === 'Eu') {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    },

    processPaste() {
        const text = document.getElementById('nubank-paste-area').value;
        if (!text.trim()) {
            showNotification('Cole algum dado para processar.', 'warning');
            return;
        }
        this.parseAndPreview(text);
    },

    handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            this.parseAndPreview(e.target.result);
        };
        reader.readAsText(file);
    },

    parseAndPreview(text) {
        const lines = text.split('\n');
        const items = [];
        const headerRegex = /date|title|amount|data|descrição|descricaode/i;

        lines.forEach(line => {
            if (!line.trim()) return;
            // Skip headers
            if (headerRegex.test(line) && (line.toLowerCase().includes('date') || line.toLowerCase().includes('title') || line.toLowerCase().includes('data'))) {
                return;
            }

            // Split by tab, comma, semicolon, or double spaces
            let parts = line.split('\t');
            if (parts.length < 3) {
                parts = line.split(/,\s*/);
            }
            if (parts.length < 3) {
                parts = line.split(/;\s*/);
            }
            if (parts.length < 3) {
                parts = line.split(/\s{2,}/);
            }

            if (parts.length >= 3) {
                const dateStr = parts[0].trim();
                const titleStr = parts[1].trim();
                const amountStr = parts[2].trim();

                // Format date (YYYY-MM-DD or DD/MM/YYYY)
                let date = null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    date = dateStr;
                } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                    const dParts = dateStr.split('/');
                    date = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
                }

                // Format amount (exclude negative amounts)
                let cleanAmountStr = amountStr.replace(/R\$\s*/gi, '').replace(/\s/g, '');
                if (cleanAmountStr.includes(',') && !cleanAmountStr.includes('.')) {
                    cleanAmountStr = cleanAmountStr.replace(',', '.');
                } else if (cleanAmountStr.includes('.') && cleanAmountStr.includes(',')) {
                    cleanAmountStr = cleanAmountStr.replace(/\./g, '').replace(',', '.');
                }

                const amount = parseFloat(cleanAmountStr);
                if (isNaN(amount) || amount <= 0) {
                    return; // Skip payment/refunds or invalid lines
                }

                items.push({ date, originalTitle: titleStr, amount });
            }
        });

        if (items.length === 0) {
            showNotification('Nenhuma despesa válida encontrada. Verifique o formato.', 'warning');
            return;
        }

        // Group by exact original title
        const groupsMap = {};
        items.forEach(item => {
            const key = item.originalTitle.trim();
            if (!groupsMap[key]) {
                const installmentMatch = item.originalTitle.match(/(.*?)\s*[-–]?\s*Parcela\s+(\d+)\/(\d+)/i) || 
                                         item.originalTitle.match(/(.*?)\s*Parcela\s+(\d+)\/(\d+)/i);
                
                let isInstallment = false;
                let baseTitle = item.originalTitle;
                if (installmentMatch) {
                    isInstallment = true;
                    baseTitle = installmentMatch[1].trim();
                }

                const normTitleForDup = this.normalizeTitleForDup(baseTitle);

                groupsMap[key] = {
                    title: item.originalTitle,
                    baseTitle: baseTitle,
                    normalizedTitle: normTitleForDup,
                    isInstallment: isInstallment,
                    items: [],
                    totalAmount: 0,
                    isRecurring: isInstallment,
                    isFixedValue: isInstallment,
                    frequency: 'mensal',
                    importChecked: true
                };
            }
            groupsMap[key].items.push(item);
            groupsMap[key].totalAmount += item.amount;
        });

        this.groups = Object.values(groupsMap);
        this.groups.forEach(g => {
            g.isDuplicate = this.checkDuplicate(g.normalizedTitle, g.totalAmount);
            if (g.isDuplicate) {
                g.importChecked = false; // Pre-uncheck duplicate items
            }
        });

        this.renderPreview();
        document.getElementById('import-preview-container').style.display = 'block';
        document.getElementById('btn-clear-import').style.display = 'inline-block';
        showNotification(`${items.length} transações encontradas!`);
    },

    normalizeTitleForDup(title) {
        return title.toLowerCase()
            .replace(/[-–]?\s*parcela\s+\d+\/\d+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    checkDuplicate(normalizedTitle, amount) {
        return App.expenses.some(e => {
            const existingNorm = this.normalizeTitleForDup(e.description);
            return existingNorm === normalizedTitle && Math.abs(e.amount - amount) < 0.01;
        });
    },

    renderPreview() {
        const list = document.getElementById('import-preview-list');
        list.innerHTML = '';

        const localFormat = (dateStr) => {
            if (window.formatDate) return window.formatDate(dateStr);
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        };

        this.groups.forEach((g, index) => {
            const card = document.createElement('div');
            card.className = 'import-group-card' + (g.isDuplicate ? ' has-warning' : '');
            card.id = `import-card-${index}`;

            let badgesHTML = '';
            if (g.isInstallment) {
                badgesHTML += `<span class="import-badge import-badge-recurring"><i data-lucide="repeat" class="icon-sm"></i> Parcela</span>`;
            }
            if (g.isDuplicate) {
                badgesHTML += `<span class="import-badge import-badge-warning"><i data-lucide="alert-triangle" class="icon-sm"></i> Possível duplicata</span>`;
            }

            const detailsHTML = g.items.map(item => `
                <div class="import-detail-item">
                    <span>${item.date ? localFormat(item.date) : 'Sem data'}</span>
                    <span>R$ ${item.amount.toFixed(2)}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div class="import-group-header">
                    <div class="import-group-title-wrapper">
                        <input type="checkbox" id="import-check-${index}" ${g.importChecked ? 'checked' : ''} onchange="NubankImporter.updateChecked(${index}, this.checked)">
                        <label for="import-check-${index}" style="margin: 0; cursor: pointer;">
                            <span class="import-group-title">${g.title}</span>
                            <span class="import-group-count">${g.items.length > 1 ? `(${g.items.length} transações)` : ''}</span>
                        </label>
                    </div>
                    <div class="import-group-right">
                        <span class="import-group-amount">R$ ${g.totalAmount.toFixed(2)}</span>
                        <button type="button" class="import-group-toggle" onclick="NubankImporter.toggleDetails(${index})">
                            <span id="import-toggle-lbl-${index}">Detalhes</span>
                            <i data-lucide="chevron-down" id="import-toggle-icon-${index}" class="icon-sm"></i>
                        </button>
                    </div>
                </div>

                ${badgesHTML ? `<div class="import-badge-container">${badgesHTML}</div>` : ''}

                <div class="import-group-options" style="${g.importChecked ? 'display: flex;' : 'display: none;'}">
                    <label class="checkbox-label" style="font-size: 0.82em; margin: 0; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="checkbox" id="import-rec-${index}" ${g.isRecurring ? 'checked' : ''} onchange="NubankImporter.updateRecurring(${index}, this.checked)">
                        <span>Tornar Recorrente Fixa</span>
                    </label>
                </div>

                <div id="import-details-${index}" class="import-group-details" style="display: none;">
                    ${detailsHTML}
                </div>
            `;
            list.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
        this.updateSummaryText();
    },

    updateChecked(index, isChecked) {
        this.groups[index].importChecked = isChecked;
        const optionsDiv = document.querySelector(`#import-card-${index} .import-group-options`);
        if (optionsDiv) {
            optionsDiv.style.display = isChecked ? 'flex' : 'none';
        }
        this.updateSummaryText();
    },

    updateRecurring(index, isRecurring) {
        this.groups[index].isRecurring = isRecurring;
    },

    toggleDetails(index) {
        const detailsDiv = document.getElementById(`import-details-${index}`);
        const label = document.getElementById(`import-toggle-lbl-${index}`);
        const icon = document.getElementById(`import-toggle-icon-${index}`);
        if (detailsDiv.style.display === 'none') {
            detailsDiv.style.display = 'flex';
            label.textContent = 'Recolher';
            if (icon) {
                icon.setAttribute('data-lucide', 'chevron-up');
                if (window.lucide) lucide.createIcons();
            }
        } else {
            detailsDiv.style.display = 'none';
            label.textContent = 'Detalhes';
            if (icon) {
                icon.setAttribute('data-lucide', 'chevron-down');
                if (window.lucide) lucide.createIcons();
            }
        }
    },

    updateSummaryText() {
        const selectedCount = this.groups.filter(g => g.importChecked).length;
        const totalAmount = this.groups.filter(g => g.importChecked).reduce((sum, g) => sum + g.totalAmount, 0);
        document.getElementById('import-summary-text').textContent = `${selectedCount} selecionados · Total: R$ ${totalAmount.toFixed(2)}`;
    },

    clear() {
        document.getElementById('nubank-paste-area').value = '';
        document.getElementById('nubank-file-input').value = '';
        document.getElementById('import-preview-container').style.display = 'none';
        document.getElementById('btn-clear-import').style.display = 'none';
        this.groups = [];
    },

    confirmImport() {
        const payer = document.getElementById('import-default-payer').value;
        if (!payer) {
            showNotification('Selecione quem pagou as despesas.', 'warning');
            return;
        }

        const selectedGroups = this.groups.filter(g => g.importChecked);
        if (selectedGroups.length === 0) {
            showNotification('Nenhuma despesa selecionada para importar.', 'warning');
            return;
        }

        let importedCount = 0;

        selectedGroups.forEach(g => {
            // Check if there is already a recurring template for this baseTitle in the system
            const recurringTemplateExists = App.expenses.some(e => {
                return e.isRecurring && NubankImporter.normalizeTitleForDup(e.description) === g.normalizedTitle;
            });

            // If the user wants recurring BUT the template already exists, import as a standard one-time expense
            const shouldBeRecurring = g.isRecurring && !recurringTemplateExists;
            const date = g.items[0].date || new Date().toISOString().slice(0, 10);

            const expense = {
                id: Date.now() + Math.floor(Math.random() * 100000),
                description: g.title,
                amount: g.totalAmount,
                payer: payer,
                participants: App.people.map(p => p.name),
                date: date,
                isRecurring: shouldBeRecurring,
                isFixedValue: shouldBeRecurring ? g.isFixedValue : false,
                frequency: shouldBeRecurring ? g.frequency : null,
                isPending: false
            };

            App.expenses.push(expense);
            importedCount++;
        });

        App.save();
        App.refreshAll();
        showNotification(`${importedCount} despesas importadas com sucesso!`);
        this.clear();
        switchTab('view-expenses');
    }
};
