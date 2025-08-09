// Salesforce Data Reader - Sidebar JavaScript
class SalesforceDataReader {
    constructor() {
        this.sessionId = null;
        this.instanceUrl = null;
        this.isConnected = false;
        this.currentQuery = '';
        this.lastResults = null;
        
        this.initializeUI();
        this.setupEventListeners();
        this.checkConnection();
    }

    initializeUI() {
        this.elements = {
            connectionStatus: document.getElementById('connectionStatus'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            authSection: document.getElementById('authSection'),
            querySection: document.getElementById('querySection'),
            refreshConnection: document.getElementById('refreshConnection'),
            objectSelect: document.getElementById('objectSelect'),
            fieldsInput: document.getElementById('fieldsInput'),
            fieldsSuggestions: document.getElementById('fieldsSuggestions'),
            whereClause: document.getElementById('whereClause'),
            limitClause: document.getElementById('limitClause'),
            customQuery: document.getElementById('customQuery'),
            formatQuery: document.getElementById('formatQuery'),
            executeQuery: document.getElementById('executeQuery'),
            resultsHeader: document.getElementById('resultsHeader'),
            recordCount: document.getElementById('recordCount'),
            executionTime: document.getElementById('executionTime'),
            resultsContainer: document.getElementById('resultsContainer'),
            noResults: document.getElementById('noResults'),
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            resultsTableContainer: document.getElementById('resultsTableContainer'),
            resultsTable: document.getElementById('resultsTable'),
            resultsTableHead: document.getElementById('resultsTableHead'),
            resultsTableBody: document.getElementById('resultsTableBody'),
            exportCsv: document.getElementById('exportCsv'),
            exportJson: document.getElementById('exportJson'),
            clearResults: document.getElementById('clearResults')
        };
    }

    setupEventListeners() {
        // Connection
        this.elements.refreshConnection.addEventListener('click', () => this.checkConnection());

        // Query building
        this.elements.objectSelect.addEventListener('change', () => this.onObjectChange());
        this.elements.fieldsInput.addEventListener('input', () => this.onFieldsInput());
        
        // Query execution
        this.elements.executeQuery.addEventListener('click', () => this.executeQuery());
        this.elements.formatQuery.addEventListener('click', () => this.formatQuery());
        
        // Quick queries
        document.querySelectorAll('.quick-query-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                this.elements.customQuery.value = query;
                this.executeQuery();
            });
        });

        // Results actions
        this.elements.exportCsv.addEventListener('click', () => this.exportResults('csv'));
        this.elements.exportJson.addEventListener('click', () => this.exportResults('json'));
        this.elements.clearResults.addEventListener('click', () => this.clearResults());

        // Enter key in query textarea
        this.elements.customQuery.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.executeQuery();
            }
        });
    }

    async checkConnection() {
        this.updateStatus('connecting', 'Connecting...');
        
        try {
            // Get connection info from content script
            const response = await this.sendMessage({
                action: 'getConnectionInfo'
            });

            if (response && response.sessionId && response.instanceUrl) {
                this.sessionId = response.sessionId;
                this.instanceUrl = response.instanceUrl;
                this.isConnected = true;
                
                this.updateStatus('connected', 'Connected');
                this.showQueryInterface();
                await this.loadObjects();
            } else {
                throw new Error('No Salesforce session found');
            }
        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus('disconnected', 'Not connected');
            this.showAuthInterface();
        }
    }

    updateStatus(status, text) {
        this.elements.statusIndicator.className = `status-indicator ${status}`;
        this.elements.statusText.textContent = text;
    }

    showAuthInterface() {
        this.elements.authSection.style.display = 'block';
        this.elements.querySection.style.display = 'none';
    }

    showQueryInterface() {
        this.elements.authSection.style.display = 'none';
        this.elements.querySection.style.display = 'block';
    }

    async loadObjects() {
        try {
            const response = await this.makeApiCall('/services/data/v58.0/sobjects');
            if (response && response.sobjects) {
                this.populateObjectSelect(response.sobjects);
            }
        } catch (error) {
            console.error('Failed to load objects:', error);
        }
    }

    populateObjectSelect(objects) {
        this.elements.objectSelect.innerHTML = '<option value="">Select Object...</option>';
        
        // Sort objects by label
        const sortedObjects = objects
            .filter(obj => obj.queryable)
            .sort((a, b) => a.label.localeCompare(b.label));

        sortedObjects.forEach(obj => {
            const option = document.createElement('option');
            option.value = obj.name;
            option.textContent = `${obj.label} (${obj.name})`;
            this.elements.objectSelect.appendChild(option);
        });
    }

    async onObjectChange() {
        const objectName = this.elements.objectSelect.value;
        if (!objectName) return;

        try {
            const response = await this.makeApiCall(`/services/data/v58.0/sobjects/${objectName}/describe`);
            if (response && response.fields) {
                this.currentObjectFields = response.fields;
                this.elements.fieldsInput.placeholder = 'Type field names or select from suggestions...';
                this.elements.fieldsInput.focus();
            }
        } catch (error) {
            console.error('Failed to describe object:', error);
        }
    }

    onFieldsInput() {
        const input = this.elements.fieldsInput.value.toLowerCase();
        const suggestions = this.elements.fieldsSuggestions;
        
        if (!input || !this.currentObjectFields) {
            suggestions.style.display = 'none';
            return;
        }

        const matchingFields = this.currentObjectFields
            .filter(field => field.name.toLowerCase().includes(input))
            .slice(0, 10);

        if (matchingFields.length === 0) {
            suggestions.style.display = 'none';
            return;
        }

        suggestions.innerHTML = '';
        matchingFields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'field-suggestion';
            div.textContent = `${field.name} (${field.type}) - ${field.label}`;
            div.addEventListener('click', () => {
                const currentValue = this.elements.fieldsInput.value;
                const words = currentValue.split(',').map(w => w.trim());
                words[words.length - 1] = field.name;
                this.elements.fieldsInput.value = words.join(', ');
                suggestions.style.display = 'none';
                this.elements.fieldsInput.focus();
            });
            suggestions.appendChild(div);
        });

        suggestions.style.display = 'block';
    }

    buildQuery() {
        const objectName = this.elements.objectSelect.value;
        const fields = this.elements.fieldsInput.value.trim() || 'Id';
        const whereClause = this.elements.whereClause.value.trim();
        const limitClause = this.elements.limitClause.value.trim();

        if (!objectName) {
            throw new Error('Please select an object');
        }

        let query = `SELECT ${fields} FROM ${objectName}`;
        
        if (whereClause) {
            query += ` WHERE ${whereClause}`;
        }
        
        if (limitClause) {
            query += ` LIMIT ${limitClause}`;
        }

        return query;
    }

    formatQuery() {
        const query = this.elements.customQuery.value.trim();
        if (!query) return;

        // Simple SOQL formatting
        const formatted = query
            .replace(/\s+/g, ' ')
            .replace(/\bSELECT\b/gi, 'SELECT')
            .replace(/\bFROM\b/gi, '\nFROM')
            .replace(/\bWHERE\b/gi, '\nWHERE')
            .replace(/\bORDER BY\b/gi, '\nORDER BY')
            .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
            .replace(/\bHAVING\b/gi, '\nHAVING')
            .replace(/\bLIMIT\b/gi, '\nLIMIT')
            .trim();

        this.elements.customQuery.value = formatted;
    }

    async executeQuery() {
        let query = this.elements.customQuery.value.trim();
        
        // If no custom query, build from form
        if (!query) {
            try {
                query = this.buildQuery();
                this.elements.customQuery.value = query;
            } catch (error) {
                this.showError(error.message);
                return;
            }
        }

        this.currentQuery = query;
        this.showLoading();

        const startTime = Date.now();

        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await this.makeApiCall(`/services/data/v58.0/query?q=${encodedQuery}`);
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            if (response && response.records) {
                this.displayResults(response.records, executionTime);
            } else {
                throw new Error('No records returned');
            }
        } catch (error) {
            console.error('Query execution failed:', error);
            this.showError(error.message || 'Query execution failed');
        }
    }

    showLoading() {
        this.elements.noResults.style.display = 'none';
        this.elements.errorMessage.style.display = 'none';
        this.elements.resultsTableContainer.style.display = 'none';
        this.elements.loading.style.display = 'block';
        this.elements.resultsHeader.style.display = 'none';
    }

    showError(message) {
        this.elements.loading.style.display = 'none';
        this.elements.noResults.style.display = 'none';
        this.elements.resultsTableContainer.style.display = 'none';
        this.elements.resultsHeader.style.display = 'none';
        
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.style.display = 'block';
    }

    displayResults(records, executionTime) {
        this.lastResults = records;
        
        // Hide loading and error states
        this.elements.loading.style.display = 'none';
        this.elements.errorMessage.style.display = 'none';
        this.elements.noResults.style.display = 'none';

        // Show results header
        this.elements.recordCount.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;
        this.elements.executionTime.textContent = `${executionTime}ms`;
        this.elements.resultsHeader.style.display = 'flex';

        if (records.length === 0) {
            this.elements.resultsTableContainer.style.display = 'none';
            this.elements.noResults.style.display = 'block';
            this.elements.noResults.innerHTML = '<p>Query executed successfully but returned no records.</p>';
            return;
        }

        // Build table
        this.buildResultsTable(records);
        this.elements.resultsTableContainer.style.display = 'block';
    }

    buildResultsTable(records) {
        // Get all unique field names
        const fieldNames = new Set();
        records.forEach(record => {
            Object.keys(record).forEach(key => {
                if (key !== 'attributes') {
                    fieldNames.add(key);
                }
            });
        });

        const fields = Array.from(fieldNames).sort();

        // Build table header
        this.elements.resultsTableHead.innerHTML = '';
        const headerRow = document.createElement('tr');
        fields.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field;
            headerRow.appendChild(th);
        });
        this.elements.resultsTableHead.appendChild(headerRow);

        // Build table body
        this.elements.resultsTableBody.innerHTML = '';
        records.forEach(record => {
            const row = document.createElement('tr');
            fields.forEach(field => {
                const td = document.createElement('td');
                const value = record[field];
                
                if (value === null || value === undefined) {
                    td.textContent = 'null';
                    td.className = 'null-value';
                } else if (typeof value === 'object') {
                    td.textContent = JSON.stringify(value);
                    if (JSON.stringify(value).length > 50) {
                        td.className = 'long-text';
                        td.title = JSON.stringify(value, null, 2);
                    }
                } else {
                    td.textContent = value;
                    if (String(value).length > 50) {
                        td.className = 'long-text';
                        td.title = String(value);
                    }
                }
                
                row.appendChild(td);
            });
            this.elements.resultsTableBody.appendChild(row);
        });
    }

    exportResults(format) {
        if (!this.lastResults || this.lastResults.length === 0) {
            alert('No results to export');
            return;
        }

        let content, filename, mimeType;

        if (format === 'csv') {
            content = this.convertToCSV(this.lastResults);
            filename = 'salesforce_query_results.csv';
            mimeType = 'text/csv';
        } else if (format === 'json') {
            content = JSON.stringify(this.lastResults, null, 2);
            filename = 'salesforce_query_results.json';
            mimeType = 'application/json';
        }

        this.downloadFile(content, filename, mimeType);
    }

    convertToCSV(records) {
        if (!records.length) return '';

        // Get all unique field names
        const fieldNames = new Set();
        records.forEach(record => {
            Object.keys(record).forEach(key => {
                if (key !== 'attributes') {
                    fieldNames.add(key);
                }
            });
        });

        const fields = Array.from(fieldNames).sort();
        const csvRows = [];

        // Header row
        csvRows.push(fields.map(field => `"${field}"`).join(','));

        // Data rows
        records.forEach(record => {
            const values = fields.map(field => {
                const value = record[field];
                if (value === null || value === undefined) {
                    return '""';
                } else if (typeof value === 'object') {
                    return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                } else {
                    return `"${String(value).replace(/"/g, '""')}"`;
                }
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clearResults() {
        this.lastResults = null;
        this.elements.resultsHeader.style.display = 'none';
        this.elements.resultsTableContainer.style.display = 'none';
        this.elements.errorMessage.style.display = 'none';
        this.elements.loading.style.display = 'none';
        this.elements.noResults.style.display = 'block';
        this.elements.noResults.innerHTML = '<p>No query executed yet. Use the query builder above or enter a custom SOQL query.</p>';
    }

    async makeApiCall(endpoint) {
        if (!this.sessionId || !this.instanceUrl) {
            throw new Error('Not connected to Salesforce');
        }

        const url = this.instanceUrl + endpoint;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.sessionId}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API call failed: ${response.status} - ${errorText}`);
        }

        return await response.json();
    }

    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SalesforceDataReader();
});

// Handle clicks outside of field suggestions to close them
document.addEventListener('click', (e) => {
    const suggestions = document.getElementById('fieldsSuggestions');
    const fieldsInput = document.getElementById('fieldsInput');
    
    if (suggestions && !suggestions.contains(e.target) && e.target !== fieldsInput) {
        suggestions.style.display = 'none';
    }
});