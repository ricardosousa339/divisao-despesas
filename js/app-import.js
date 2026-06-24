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
            this.updateParticipantsList();
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

    updateParticipantsList() {
        const el = document.getElementById('import-participants-list');
        if (!el) return;
        if (App.people.length === 0) {
            el.innerHTML = '<p class="no-participants-message" style="padding:0; margin:0;">Adicione pessoas primeiro.</p>';
            return;
        }
        el.innerHTML = '';
        App.people.forEach(p => {
            const label = document.createElement('label');
            label.style.padding = '4px 10px';
            label.style.fontSize = '0.82em';
            label.style.borderRadius = '15px';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = p.name;
            cb.name = 'import-participants[]';
            cb.checked = true; // Default to checked
            label.appendChild(cb);
            
            const textSpan = document.createElement('span');
            textSpan.textContent = ` ${p.name}`;
            label.appendChild(textSpan);
            
            el.appendChild(label);
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

    detectColumns(lines) {
        // Default indices if detection fails (assuming [date, title, amount])
        let dateIdx = 0;
        let titleIdx = 1;
        let amountIdx = 2;
        let categoryIdx = -1;
        let delimiter = null;
        let headerLineFound = false;

        const headerKeywords = /date|data|title|titulo|título|amount|valor|category|categoria|descrição|descricao|descriçao|historico|histórico|memo/i;

        // 1. Try to find a header line in the first few lines
        for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Detect delimiter for this line
            let parts = [];
            let currentDelim = null;
            const delimiters = ['\t', ';', ','];
            for (const delim of delimiters) {
                const p = line.split(delim);
                if (p.length >= 3 && p.length > parts.length) {
                    parts = p;
                    currentDelim = delim;
                }
            }

            if (parts.length >= 3 && headerKeywords.test(line)) {
                delimiter = currentDelim;
                headerLineFound = true;

                const dateMapIdx = parts.findIndex(p => /date|data/i.test(p));
                const amountMapIdx = parts.findIndex(p => /amount|valor|val/i.test(p));
                const titleMapIdx = parts.findIndex(p => /title|titulo|título|descrição|descricao|descriçao|historico|histórico|memo/i.test(p));
                const catMapIdx = parts.findIndex(p => /category|categoria/i.test(p));

                if (dateMapIdx !== -1) dateIdx = dateMapIdx;
                if (amountMapIdx !== -1) amountIdx = amountMapIdx;
                if (titleMapIdx !== -1) titleIdx = titleMapIdx;
                if (catMapIdx !== -1) categoryIdx = catMapIdx;
                break;
            }
        }

        // 2. If no header line was found, or to double check, use heuristics on the first few data-like lines
        if (!headerLineFound) {
            for (let i = 0; i < Math.min(lines.length, 10); i++) {
                const line = lines[i].trim();
                if (!line) continue;

                let parts = [];
                let currentDelim = null;
                const delimiters = ['\t', ';', ','];
                for (const delim of delimiters) {
                    const p = line.split(delim);
                    if (p.length >= 3 && p.length > parts.length) {
                        parts = p;
                        currentDelim = delim;
                    }
                }

                if (parts.length >= 3) {
                    delimiter = currentDelim;
                    
                    let dateCol = -1;
                    let amountCol = -1;
                    let textCols = [];

                    parts.forEach((part, idx) => {
                        const val = part.trim().replace(/^["']|["']$/g, '');
                        // Check if looks like a date
                        if (/^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{2}\/\d{2}\/\d{4}$/.test(val) || /^\d{2}\/\d{2}\/\d{2}$/.test(val)) {
                            dateCol = idx;
                        } else {
                            // Check if looks like a number
                            let clean = val.replace(/R\$\s*/gi, '').replace(/\s/g, '');
                            if (clean.includes(',') && !clean.includes('.')) clean = clean.replace(',', '.');
                            else if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
                            
                            const num = parseFloat(clean);
                            if (!isNaN(num) && num !== 0) {
                                amountCol = idx;
                            } else {
                                textCols.push(idx);
                            }
                        }
                    });

                    if (dateCol !== -1) dateIdx = dateCol;
                    if (amountCol !== -1) amountIdx = amountCol;

                    const remainingIdxs = parts.map((_, idx) => idx).filter(idx => idx !== dateIdx && idx !== amountIdx);
                    if (remainingIdxs.length > 0) {
                        if (remainingIdxs.length >= 2) {
                            categoryIdx = remainingIdxs[0];
                            titleIdx = remainingIdxs[1];
                        } else {
                            titleIdx = remainingIdxs[0];
                        }
                    }
                    break;
                }
            }
        }

        return { dateIdx, titleIdx, amountIdx, categoryIdx, delimiter };
    },

    parseAndPreview(text) {
        const lines = text.split('\n');
        const items = [];
        let totalLinesProcessed = 0;
        const { dateIdx, titleIdx, amountIdx, categoryIdx, delimiter } = this.detectColumns(lines);

        const headerRegex = /date|title|amount|data|descrição|descricaode|categoria|category|valor/i;
        const skipRegex = /pagamento\s+recebido|pagamento\s+de\s+fatura|pagamento\s+da\s+fatura|fatura\s+paga|pix\s+recebido|pix\s+-\s*recebido|transferência\s+recebida|transferencia\s+recebida|ted\s+recebida|doc\s+recebido|depósito|deposito|rendimento|resgate\s+pago|estorno|reembolso/i;

        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            totalLinesProcessed++;
            // Skip headers
            if (headerRegex.test(trimmed) && (trimmed.toLowerCase().includes('date') || trimmed.toLowerCase().includes('title') || trimmed.toLowerCase().includes('data') || trimmed.toLowerCase().includes('valor') || trimmed.toLowerCase().includes('amount'))) {
                return;
            }

            // Split by the detected delimiter or standard fallbacks
            let parts = [];
            if (delimiter) {
                parts = trimmed.split(delimiter);
            } else {
                parts = trimmed.split('\t');
                if (parts.length < 3) parts = trimmed.split(/,\s*/);
                if (parts.length < 3) parts = trimmed.split(/;\s*/);
                if (parts.length < 3) parts = trimmed.split(/\s{2,}/);
            }

            if (parts.length >= 3) {
                const dateStr = parts[dateIdx] ? parts[dateIdx].trim().replace(/^["']|["']$/g, '') : '';
                const titleStr = parts[titleIdx] ? parts[titleIdx].trim().replace(/^["']|["']$/g, '') : '';
                const amountStr = parts[amountIdx] ? parts[amountIdx].trim().replace(/^["']|["']$/g, '') : '';

                if (!dateStr || !titleStr || !amountStr) return;

                // Skip non-expense transactions
                if (skipRegex.test(titleStr)) {
                    return;
                }

                // Format date (YYYY-MM-DD or DD/MM/YYYY or DD/MM/YY)
                let date = null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                    date = dateStr;
                } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
                    const dParts = dateStr.split('/');
                    date = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
                } else if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
                    const dParts = dateStr.split('/');
                    date = `20${dParts[2]}-${dParts[1]}-${dParts[0]}`;
                }

                // Format amount
                let cleanAmountStr = amountStr.replace(/R\$\s*/gi, '').replace(/\s/g, '');
                if (cleanAmountStr.includes(',') && !cleanAmountStr.includes('.')) {
                    cleanAmountStr = cleanAmountStr.replace(',', '.');
                } else if (cleanAmountStr.includes('.') && cleanAmountStr.includes(',')) {
                    cleanAmountStr = cleanAmountStr.replace(/\./g, '').replace(',', '.');
                }

                let amount = parseFloat(cleanAmountStr);
                if (isNaN(amount) || amount === 0) {
                    return; // Skip payment/refunds or invalid lines
                }

                // If negative, convert to positive (expenses are debits in bank account statement)
                if (amount < 0) {
                    amount = Math.abs(amount);
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
                let isLastInstallment = false;
                let installmentCurrent = null;
                let installmentTotal = null;
                let baseTitle = item.originalTitle;
                if (installmentMatch) {
                    isInstallment = true;
                    installmentCurrent = parseInt(installmentMatch[2], 10);
                    installmentTotal = parseInt(installmentMatch[3], 10);
                    if (!isNaN(installmentCurrent) && !isNaN(installmentTotal) && installmentCurrent === installmentTotal) {
                        isLastInstallment = true;
                    }
                    baseTitle = installmentMatch[1].trim();
                }

                const normTitleForDup = this.normalizeTitleForDup(baseTitle);

                groupsMap[key] = {
                    title: item.originalTitle,
                    baseTitle: baseTitle,
                    normalizedTitle: normTitleForDup,
                    isInstallment: isInstallment,
                    isLastInstallment: isLastInstallment,
                    installmentCurrent: installmentCurrent,
                    installmentTotal: installmentTotal,
                    items: [],
                    totalAmount: 0,
                    isRecurring: false, // Parcelas nunca são recorrentes; despesas normais podem ser marcadas pelo usuário
                    isFixedValue: false,
                    frequency: 'mensal',
                    importChecked: true
                };
            }
            groupsMap[key].items.push(item);
            groupsMap[key].totalAmount += item.amount;
        });

        this.groups = Object.values(groupsMap);
        this.groups.forEach(g => {
            g.isDuplicate = this.checkDuplicate(g.normalizedTitle, g.totalAmount, 
                g.isInstallment ? g.normalizedTitle : null, g.installmentCurrent);
            if (g.isDuplicate) {
                g.importChecked = false; // Pre-uncheck duplicate items
            }
        });

        this.renderPreview();
        document.getElementById('import-preview-container').style.display = 'block';
        document.getElementById('btn-clear-import').style.display = 'inline-block';

        // Feedback detalhado
        const duplicates = this.groups.filter(g => g.isDuplicate).length;
        const skipped = totalLinesProcessed - items.length;
        let msg = `${items.length} transações encontradas`;
        if (duplicates > 0) msg += ` · ${duplicates} possíveis duplicatas`;
        if (skipped > 0) msg += ` · ${skipped} ignoradas`;
        showNotification(msg);
    },

    normalizeTitleForDup(title) {
        return title.toLowerCase()
            .replace(/[-–]?\s*parcela\s+\d+\/\d+/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    },

    checkDuplicate(normalizedTitle, amount, installmentGroup, installmentCurrent) {
        return App.expenses.some(e => {
            // Para parcelas: comparar pelo grupo + número da parcela (mais preciso)
            if (installmentGroup && e.installmentGroup) {
                return e.installmentGroup === installmentGroup 
                    && e.installmentCurrent === installmentCurrent;
            }
            // Para despesas normais: comparar título normalizado + valor
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
                if (g.isLastInstallment) {
                    badgesHTML += `<span class="import-badge" style="background: rgba(16, 185, 129, 0.08); color: var(--green); border: 1px solid rgba(16, 185, 129, 0.15);"><i data-lucide="check-circle" class="icon-sm"></i> Última Parcela (${g.installmentCurrent}/${g.installmentTotal})</span>`;
                } else {
                    badgesHTML += `<span class="import-badge import-badge-recurring"><i data-lucide="credit-card" class="icon-sm"></i> Parcela ${g.installmentCurrent}/${g.installmentTotal}</span>`;
                }
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

            // Parcelas não devem ter opção de recorrência (vem naturalmente no CSV do próximo mês)
            const recurringOptionHTML = g.isInstallment 
                ? '' 
                : `<div class="import-group-options" style="${g.importChecked ? 'display: flex;' : 'display: none;'}">
                    <label class="checkbox-label" style="font-size: 0.82em; margin: 0; display: inline-flex; align-items: center; gap: 6px; cursor: pointer;">
                        <input type="checkbox" id="import-rec-${index}" ${g.isRecurring ? 'checked' : ''} onchange="NubankImporter.updateRecurring(${index}, this.checked)">
                        <span>Tornar Recorrente Fixa</span>
                    </label>
                </div>`;

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

                ${recurringOptionHTML}

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

        // Get selected participants from the general import options
        const selectedParticipants = [];
        document.querySelectorAll('#import-participants-list input[type="checkbox"]:checked').forEach(cb => {
            selectedParticipants.push(cb.value);
        });
        
        // Default to all people if none are checked
        const participantsToUse = selectedParticipants.length > 0 ? selectedParticipants : App.people.map(p => p.name);

        let importedCount = 0;
        const baseId = Date.now();

        selectedGroups.forEach((g, idx) => {
            // Check if there is already a recurring template for this baseTitle in the system
            const recurringTemplateExists = App.expenses.some(e => {
                return e.isRecurring && NubankImporter.normalizeTitleForDup(e.description) === g.normalizedTitle;
            });

            // If the user wants recurring BUT the template already exists, import as a standard one-time expense
            const shouldBeRecurring = g.isRecurring && !recurringTemplateExists;
            const date = g.items[0].date || new Date().toISOString().slice(0, 10);

            const expense = {
                id: baseId + idx,
                description: g.title,
                amount: g.totalAmount,
                payer: payer,
                participants: participantsToUse,
                date: date,
                isRecurring: shouldBeRecurring,
                isFixedValue: shouldBeRecurring ? g.isFixedValue : false,
                frequency: shouldBeRecurring ? g.frequency : null,
                isPending: false,
                // Metadados de parcela
                installmentGroup: g.isInstallment ? g.normalizedTitle : null,
                installmentCurrent: g.installmentCurrent || null,
                installmentTotal: g.installmentTotal || null
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
