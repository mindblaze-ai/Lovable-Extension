// Salesforce Data Reader - Popup JavaScript

class SalesforcePopup {
    constructor() {
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            statusSection: document.getElementById('statusSection'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusTitle: document.getElementById('statusTitle'),
            statusDescription: document.getElementById('statusDescription'),
            actionsSection: document.getElementById('actionsSection'),
            quickActionsSection: document.getElementById('quickActionsSection'),
            infoSection: document.getElementById('infoSection'),
            instanceInfo: document.getElementById('instanceInfo'),
            sessionInfo: document.getElementById('sessionInfo'),
            openSidebar: document.getElementById('openSidebar'),
            refreshConnection: document.getElementById('refreshConnection'),
            aboutLink: document.getElementById('aboutLink'),
            helpLink: document.getElementById('helpLink')
        };

        this.connectionInfo = null;
        this.currentTab = null;
        
        this.initialize();
    }

    async initialize() {
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs[0];

            // Setup event listeners
            this.setupEventListeners();

            // Check connection status
            await this.checkConnection();
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showError('Failed to initialize extension');
        }
    }

    setupEventListeners() {
        // Main actions
        this.elements.openSidebar.addEventListener('click', () => this.openSidebar());
        this.elements.refreshConnection.addEventListener('click', () => this.refreshConnection());

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const query = e.target.getAttribute('data-query');
                this.executeQuickQuery(query);
            });
        });

        // Footer links
        this.elements.aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showAbout();
        });

        this.elements.helpLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.showHelp();
        });
    }

    async checkConnection() {
        try {
            this.showLoading();

            // Check if current tab is a Salesforce page
            const isSalesforce = this.isSalesforcePage(this.currentTab.url);
            
            if (!isSalesforce) {
                this.showNotSalesforce();
                return;
            }

            // Get connection info from background script
            const response = await this.sendMessage({ action: 'getConnectionInfo' });

            if (response && response.sessionId && response.instanceUrl) {
                this.connectionInfo = response;
                this.showConnected(response);
            } else {
                this.showDisconnected('No active Salesforce session found');
            }
        } catch (error) {
            console.error('Error checking connection:', error);
            this.showDisconnected(error.message || 'Connection check failed');
        }
    }

    showLoading() {
        this.hideAllSections();
        this.elements.loading.classList.remove('hidden');
    }

    showConnected(connectionInfo) {
        this.hideAllSections();
        
        // Update status
        this.elements.statusIndicator.className = 'status-indicator connected';
        this.elements.statusTitle.textContent = 'Connected';
        this.elements.statusDescription.textContent = 'Ready to query Salesforce data';
        this.elements.statusSection.classList.remove('hidden');

        // Update connection info
        const instanceUrl = new URL(connectionInfo.instanceUrl);
        this.elements.instanceInfo.textContent = instanceUrl.hostname;
        this.elements.sessionInfo.textContent = connectionInfo.sessionId.substring(0, 8) + '...';
        this.elements.infoSection.classList.remove('hidden');

        // Show actions
        this.elements.actionsSection.classList.remove('hidden');
        this.elements.quickActionsSection.classList.remove('hidden');
    }

    showDisconnected(message) {
        this.hideAllSections();
        
        // Update status
        this.elements.statusIndicator.className = 'status-indicator disconnected';
        this.elements.statusTitle.textContent = 'Not Connected';
        this.elements.statusDescription.textContent = message;
        this.elements.statusSection.classList.remove('hidden');

        // Show limited actions
        this.elements.actionsSection.classList.remove('hidden');
        this.elements.openSidebar.disabled = true;
    }

    showNotSalesforce() {
        this.hideAllSections();
        
        // Update status
        this.elements.statusIndicator.className = 'status-indicator disconnected';
        this.elements.statusTitle.textContent = 'Not a Salesforce Page';
        this.elements.statusDescription.textContent = 'Navigate to a Salesforce page to use this extension';
        this.elements.statusSection.classList.remove('hidden');
    }

    showError(message) {
        this.hideAllSections();
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
    }

    hideAllSections() {
        this.elements.loading.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
        this.elements.statusSection.classList.add('hidden');
        this.elements.actionsSection.classList.add('hidden');
        this.elements.quickActionsSection.classList.add('hidden');
        this.elements.infoSection.classList.add('hidden');
    }

    async openSidebar() {
        try {
            // Enable and open the side panel for the current tab
            await chrome.sidePanel.setOptions({
                tabId: this.currentTab.id,
                path: 'sidebar.html',
                enabled: true
            });

            await chrome.sidePanel.open({
                tabId: this.currentTab.id
            });

            // Close the popup
            window.close();
        } catch (error) {
            console.error('Error opening sidebar:', error);
            
            // Fallback: try to open sidebar without specific tab
            try {
                await chrome.sidePanel.open({});
                window.close();
            } catch (fallbackError) {
                console.error('Fallback sidebar open failed:', fallbackError);
                this.showError('Failed to open sidebar. Please try refreshing the page.');
            }
        }
    }

    async refreshConnection() {
        this.elements.refreshConnection.disabled = true;
        this.elements.refreshConnection.textContent = 'Refreshing...';
        
        try {
            // Tell content script to refresh session
            await this.sendMessageToTab({ action: 'refreshSession' });
            
            // Wait a moment then check connection again
            setTimeout(async () => {
                await this.checkConnection();
                this.elements.refreshConnection.disabled = false;
                this.elements.refreshConnection.innerHTML = '<span>🔄</span> Refresh Connection';
            }, 1500);
        } catch (error) {
            console.error('Error refreshing connection:', error);
            this.elements.refreshConnection.disabled = false;
            this.elements.refreshConnection.innerHTML = '<span>🔄</span> Refresh Connection';
            this.showError('Failed to refresh connection');
        }
    }

    async executeQuickQuery(query) {
        try {
            // Open sidebar first
            await this.openSidebar();
            
            // Send the query to the sidebar (it will handle execution)
            // Note: In a real implementation, you might want to store the query
            // and have the sidebar pick it up when it opens
            await chrome.storage.local.set({
                pendingQuery: query,
                pendingQueryTimestamp: Date.now()
            });
        } catch (error) {
            console.error('Error executing quick query:', error);
            this.showError('Failed to execute query');
        }
    }

    showAbout() {
        const aboutWindow = window.open('', '_blank', 'width=400,height=500');
        aboutWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>About Salesforce Data Reader</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px; 
                        line-height: 1.5; 
                    }
                    h1 { color: #1976d2; font-size: 18px; }
                    h2 { color: #333; font-size: 14px; margin-top: 20px; }
                    p { margin: 10px 0; font-size: 14px; }
                    .version { color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <h1>Salesforce Data Reader</h1>
                <p class="version">Version 1.0.0</p>
                
                <h2>About</h2>
                <p>A Chrome extension to read and query Salesforce data with an intuitive sidebar interface. Similar to Salesforce Inspector Reloaded, but focused on data reading and SOQL queries.</p>
                
                <h2>Features</h2>
                <ul>
                    <li>SOQL Query Builder with autocomplete</li>
                    <li>Custom SOQL query execution</li>
                    <li>Export results to CSV/JSON</li>
                    <li>Quick query templates</li>
                    <li>Auto-detection of Salesforce sessions</li>
                </ul>
                
                <h2>Usage</h2>
                <p>Navigate to any Salesforce page, then click the extension icon or use the sidebar to start querying your data.</p>
                
                <h2>Privacy</h2>
                <p>This extension communicates directly with Salesforce servers using your existing session. No data is sent to third parties.</p>
                
                <p style="margin-top: 30px; font-size: 12px; color: #666;">
                    Created with ❤️ for Salesforce developers and administrators.
                </p>
            </body>
            </html>
        `);
        aboutWindow.document.close();
    }

    showHelp() {
        const helpWindow = window.open('', '_blank', 'width=500,height=600');
        helpWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Salesforce Data Reader - Help</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px; 
                        line-height: 1.6; 
                    }
                    h1 { color: #1976d2; font-size: 18px; }
                    h2 { color: #333; font-size: 16px; margin-top: 20px; }
                    h3 { color: #555; font-size: 14px; margin-top: 15px; }
                    p, li { font-size: 14px; margin: 8px 0; }
                    code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
                    .tip { background: #e3f2fd; padding: 10px; border-radius: 5px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>Salesforce Data Reader - Help</h1>
                
                <h2>Getting Started</h2>
                <ol>
                    <li>Navigate to any Salesforce page in your browser</li>
                    <li>Click the Salesforce Data Reader extension icon</li>
                    <li>Click "Open Data Reader Sidebar" to start querying</li>
                </ol>
                
                <h2>Using the Query Builder</h2>
                <h3>Object Selection</h3>
                <p>Choose any queryable Salesforce object from the dropdown. The list shows both standard and custom objects.</p>
                
                <h3>Field Selection</h3>
                <p>Start typing field names and use autocomplete suggestions. Separate multiple fields with commas.</p>
                
                <h3>WHERE Clause</h3>
                <p>Add optional filtering conditions:</p>
                <ul>
                    <li><code>Name LIKE '%test%'</code> - Text contains "test"</li>
                    <li><code>CreatedDate = TODAY</code> - Created today</li>
                    <li><code>Amount > 1000</code> - Amount greater than 1000</li>
                </ul>
                
                <h2>Custom SOQL Queries</h2>
                <p>You can write any valid SOQL query in the custom query textarea. Examples:</p>
                <ul>
                    <li><code>SELECT Id, Name FROM Account WHERE Industry = 'Technology'</code></li>
                    <li><code>SELECT Id, Email FROM User WHERE IsActive = true</code></li>
                    <li><code>SELECT Id, API_Key__c, Model__c FROM Mindblaze_Settings__c</code></li>
                </ul>
                
                <div class="tip">
                    <strong>Tip:</strong> Use Ctrl+Enter to execute queries quickly!
                </div>
                
                <h2>Exporting Results</h2>
                <p>After running a query, you can export results in two formats:</p>
                <ul>
                    <li><strong>CSV:</strong> For spreadsheet applications</li>
                    <li><strong>JSON:</strong> For development and integration</li>
                </ul>
                
                <h2>Troubleshooting</h2>
                <h3>Connection Issues</h3>
                <ul>
                    <li>Make sure you're on a Salesforce page</li>
                    <li>Try refreshing your browser and reconnecting</li>
                    <li>Check if you're logged into Salesforce</li>
                </ul>
                
                <h3>Query Errors</h3>
                <ul>
                    <li>Verify field names exist on the selected object</li>
                    <li>Check SOQL syntax (proper quotes, operators, etc.)</li>
                    <li>Ensure you have read permissions on the object/fields</li>
                </ul>
                
                <h2>Keyboard Shortcuts</h2>
                <ul>
                    <li><code>Ctrl+Enter</code> - Execute query</li>
                </ul>
                
                <h2>Privacy & Security</h2>
                <p>This extension uses your existing Salesforce session and communicates directly with Salesforce servers. No data is shared with external services.</p>
            </body>
            </html>
        `);
        helpWindow.document.close();
    }

    isSalesforcePage(url) {
        if (!url) return false;
        
        const salesforcePatterns = [
            /https?:\/\/[^.]+\.salesforce\.com/,
            /https?:\/\/[^.]+\.force\.com/,
            /https?:\/\/[^.]+\.my\.salesforce\.com/,
            /https?:\/\/[^.]+\.lightning\.force\.com/,
            /https?:\/\/[^.]+\.cloudforce\.com/,
            /https?:\/\/[^.]+\.database\.com/
        ];

        return salesforcePatterns.some(pattern => pattern.test(url));
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

    async sendMessageToTab(message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(this.currentTab.id, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

// Initialize the popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new SalesforcePopup();
});
