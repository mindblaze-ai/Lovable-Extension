// Salesforce Data Reader - Background Service Worker

class SalesforceBackground {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.onInstalled(details);
        });

        // Handle messages from content scripts and sidebar
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep the message channel open for async responses
        });

        // Handle tab updates to enable/disable the extension
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.onTabUpdated(tabId, changeInfo, tab);
        });

        // Handle tab activation
        chrome.tabs.onActivated.addListener((activeInfo) => {
            this.onTabActivated(activeInfo);
        });
    }

    onInstalled(details) {
        console.log('Salesforce Data Reader installed:', details.reason);
        
        // Set default settings
        chrome.storage.sync.set({
            defaultApiVersion: 'v58.0',
            autoDetectSalesforce: true,
            enableLogging: false
        });

        // Show welcome notification on first install
        if (details.reason === 'install') {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Salesforce Data Reader',
                message: 'Extension installed successfully! Navigate to a Salesforce page to get started.'
            });
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getConnectionInfo':
                    await this.getConnectionInfo(sender.tab.id, sendResponse);
                    break;
                
                case 'storeSessionInfo':
                    await this.storeSessionInfo(message.data, sendResponse);
                    break;
                
                case 'enableSidePanel':
                    await this.enableSidePanel(sender.tab.id, sendResponse);
                    break;
                
                case 'checkSalesforceContext':
                    await this.checkSalesforceContext(sender.tab.id, sendResponse);
                    break;
                
                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
    }

    async getConnectionInfo(tabId, sendResponse) {
        try {
            // First, check if we have stored connection info
            const stored = await chrome.storage.session.get(['sessionId', 'instanceUrl']);
            
            if (stored.sessionId && stored.instanceUrl) {
                sendResponse({
                    sessionId: stored.sessionId,
                    instanceUrl: stored.instanceUrl,
                    source: 'stored'
                });
                return;
            }

            // Try to extract session info from the current tab
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: this.extractSalesforceSession
            });

            if (results && results[0] && results[0].result) {
                const sessionInfo = results[0].result;
                
                // Store the session info
                await chrome.storage.session.set({
                    sessionId: sessionInfo.sessionId,
                    instanceUrl: sessionInfo.instanceUrl
                });

                sendResponse({
                    sessionId: sessionInfo.sessionId,
                    instanceUrl: sessionInfo.instanceUrl,
                    source: 'extracted'
                });
            } else {
                sendResponse({ error: 'No Salesforce session found' });
            }
        } catch (error) {
            console.error('Error getting connection info:', error);
            sendResponse({ error: 'Failed to extract session information' });
        }
    }

    // This function will be executed in the context of the web page
    extractSalesforceSession() {
        try {
            let sessionId = null;
            let instanceUrl = null;

            // Method 1: Try to get from global variables (Lightning Experience)
            if (typeof window !== 'undefined') {
                // Check for Lightning Experience session
                if (window.$Api && window.$Api.getSessionId) {
                    sessionId = window.$Api.getSessionId();
                }

                // Alternative method for Lightning
                if (!sessionId && window.sforce && window.sforce.connection) {
                    sessionId = window.sforce.connection.getSessionId();
                }

                // Try accessing Lightning global variables
                if (!sessionId && window.document) {
                    const scripts = document.querySelectorAll('script');
                    for (const script of scripts) {
                        const content = script.innerHTML;
                        if (content.includes('sessionId') || content.includes('sid')) {
                            // Extract session ID from script content
                            const sessionMatch = content.match(/["']sessionId["']\s*:\s*["']([^"']+)["']/i) ||
                                                content.match(/["']sid["']\s*:\s*["']([^"']+)["']/i);
                            if (sessionMatch) {
                                sessionId = sessionMatch[1];
                                break;
                            }
                        }
                    }
                }

                // Get instance URL from current location
                if (window.location) {
                    const hostname = window.location.hostname;
                    if (hostname.includes('salesforce.com') || 
                        hostname.includes('force.com') || 
                        hostname.includes('cloudforce.com')) {
                        instanceUrl = `https://${hostname}`;
                    }
                }
            }

            // Method 2: Try to get from cookies
            if (!sessionId) {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name === 'sid' && value) {
                        sessionId = decodeURIComponent(value);
                        break;
                    }
                }
            }

            // Method 3: Try to extract from page meta tags or headers
            if (!sessionId) {
                const metaTags = document.querySelectorAll('meta[name*="salesforce"], meta[name*="session"]');
                for (const meta of metaTags) {
                    if (meta.content && (meta.content.length === 15 || meta.content.length === 18)) {
                        sessionId = meta.content;
                        break;
                    }
                }
            }

            if (sessionId && instanceUrl) {
                return {
                    sessionId: sessionId,
                    instanceUrl: instanceUrl,
                    timestamp: Date.now()
                };
            }

            return null;
        } catch (error) {
            console.error('Error extracting Salesforce session:', error);
            return null;
        }
    }

    async storeSessionInfo(data, sendResponse) {
        try {
            await chrome.storage.session.set({
                sessionId: data.sessionId,
                instanceUrl: data.instanceUrl,
                timestamp: Date.now()
            });
            sendResponse({ success: true });
        } catch (error) {
            sendResponse({ error: error.message });
        }
    }

    async enableSidePanel(tabId, sendResponse) {
        try {
            // Check if the current tab is a Salesforce page
            const tab = await chrome.tabs.get(tabId);
            if (this.isSalesforcePage(tab.url)) {
                await chrome.sidePanel.setOptions({
                    tabId: tabId,
                    path: 'sidebar.html',
                    enabled: true
                });
                sendResponse({ success: true });
            } else {
                sendResponse({ error: 'Not a Salesforce page' });
            }
        } catch (error) {
            sendResponse({ error: error.message });
        }
    }

    async checkSalesforceContext(tabId, sendResponse) {
        try {
            const tab = await chrome.tabs.get(tabId);
            const isSalesforce = this.isSalesforcePage(tab.url);
            
            sendResponse({
                isSalesforce: isSalesforce,
                url: tab.url,
                title: tab.title
            });
        } catch (error) {
            sendResponse({ error: error.message });
        }
    }

    async onTabUpdated(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete' && tab.url) {
            // Check if this is a Salesforce page
            if (this.isSalesforcePage(tab.url)) {
                // Enable the extension for this tab
                try {
                    await chrome.action.enable(tabId);
                    await chrome.sidePanel.setOptions({
                        tabId: tabId,
                        path: 'sidebar.html',
                        enabled: true
                    });
                } catch (error) {
                    console.error('Error enabling extension for tab:', error);
                }
            } else {
                // Disable the extension for non-Salesforce pages
                try {
                    await chrome.action.disable(tabId);
                } catch (error) {
                    console.error('Error disabling extension for tab:', error);
                }
            }
        }
    }

    async onTabActivated(activeInfo) {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            if (this.isSalesforcePage(tab.url)) {
                await chrome.action.enable(activeInfo.tabId);
            } else {
                await chrome.action.disable(activeInfo.tabId);
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
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

    async logMessage(level, message, data = null) {
        const settings = await chrome.storage.sync.get(['enableLogging']);
        if (!settings.enableLogging) return;

        const timestamp = new Date().toISOString();
        console[level](`[SF Data Reader ${timestamp}] ${message}`, data);
    }
}

// Initialize the background service
new SalesforceBackground();