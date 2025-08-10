// Salesforce Data Reader - Background Service Worker

class SalesforceBackground {
    constructor() {
        console.log('SalesforceBackground constructor called');
        this.setupEventListeners();
        this.initializeExtension();
    }

    async initializeExtension() {
        try {
            console.log('Initializing extension...');
            
            // Ensure action is enabled globally
            await chrome.action.enable();
            console.log('Extension action enabled globally');
            
            // Enable side panel globally
            await this.enableSidePanelGlobally();
            
            // Test if side panel API is available
            if (chrome.sidePanel) {
                console.log('Side panel API is available');
            } else {
                console.error('Side panel API is not available');
            }
        } catch (error) {
            console.error('Error initializing extension:', error);
        }
    }

    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.onInstalled(details);
        });

        // Handle extension icon click - this is the key handler for single-click behavior
        chrome.action.onClicked.addListener((tab) => {
            console.log('Extension icon clicked!');
            // Call the function without async to preserve user gesture context
            this.onExtensionIconClicked(tab);
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

        // Handle tab removal to clean up storage
        chrome.tabs.onRemoved.addListener((tabId) => {
            this.onTabRemoved(tabId);
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

        // Enable side panel globally
        this.enableSidePanelGlobally();

        // Note: Welcome notification removed for Manifest V3 compatibility
        // Users will see the extension is ready when they navigate to Salesforce
    }

    async enableSidePanelGlobally() {
        try {
            // Enable side panel globally
            await chrome.sidePanel.setOptions({
                path: 'sidebar.html',
                enabled: true
            });
            console.log('Side panel enabled globally');
        } catch (error) {
            console.error('Error enabling side panel globally:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'getConnectionInfo':
                    const tabId = sender.tab ? sender.tab.id : null;
                    await this.getConnectionInfo(tabId, sendResponse);
                    break;
                
                case 'storeSessionInfo':
                    await this.storeSessionInfo(message.data, sendResponse);
                    break;
                
                case 'enableSidePanel':
                    const sidePanelTabId = sender.tab ? sender.tab.id : null;
                    await this.enableSidePanel(sidePanelTabId, sendResponse);
                    break;
                
                case 'checkSalesforceContext':
                    const contextTabId = sender.tab ? sender.tab.id : null;
                    await this.checkSalesforceContext(contextTabId, sendResponse);
                    break;
                
                case 'clearSession':
                    await this.clearSession(sendResponse);
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
            console.log('Getting Salesforce connection info using cookies API...');
            
            // Get the current active tab to determine the Salesforce domain
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab || !tab.url) {
                sendResponse({ error: 'No active tab found' });
                return;
            }

            // Check if current tab is a Salesforce page
            const url = new URL(tab.url);
            const hostname = url.hostname;
            
            if (!this.isSalesforceHost(hostname)) {
                sendResponse({ error: 'Not a Salesforce page' });
                return;
            }

            // Extract session using Chrome cookies API (primary method)
            const sessionInfo = await this.extractSessionFromCookies(hostname);
            
            if (sessionInfo) {
                // Store the session info for future use
                await this.storeSessionInfo(sessionInfo);
                sendResponse(sessionInfo);
            } else {
                // Fallback: try to extract from page content
                console.log('Cookie extraction failed, trying page content extraction...');
                if (tabId) {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        func: this.extractSalesforceSession
                    });

                    if (results && results[0] && results[0].result) {
                        const sessionInfo = results[0].result;
                        await this.storeSessionInfo(sessionInfo);
                        sendResponse(sessionInfo);
                        return;
                    }
                }
                sendResponse({ error: 'No Salesforce session found' });
            }
        } catch (error) {
            console.error('Error getting connection info:', error);
            sendResponse({ error: 'Failed to extract session information' });
        }
    }

    isSalesforceHost(hostname) {
        return hostname.includes('salesforce.com') || 
               hostname.includes('force.com') || 
               hostname.includes('cloudforce.com') || 
               hostname.includes('database.com');
    }

    async extractSessionFromCookies(hostname) {
        try {
            console.log('Extracting session from cookies for hostname:', hostname);
            
            // Use Inspector Reloaded's exact domain logic
            const orderedDomains = ["salesforce.com", "cloudforce.com", "salesforce.mil", "cloudforce.mil", "sfcrmproducts.cn", "force.com"];
            const baseUrl = `https://${hostname}`;
            
            // First, get the orgId from the current domain's sid cookie
            const currentCookie = await this.getCookie(baseUrl, 'sid');
            if (!currentCookie) {
                console.log('No sid cookie found on current domain');
                return null;
            }
            
            const [orgId] = currentCookie.value.split("!");
            console.log('Found orgId:', orgId);
            
            // Try each domain to find the session cookie for this org
            for (const domain of orderedDomains) {
                try {
                    const cookies = await this.getAllCookiesForDomain(domain);
                    const sessionCookie = cookies.find(c => 
                        c.name === 'sid' && 
                        c.value.startsWith(orgId + "!") && 
                        c.domain !== "help.salesforce.com"
                    );
                    
                    if (sessionCookie) {
                        console.log('Found session cookie on domain:', sessionCookie.domain);
                        
                        // Convert domain like Inspector Reloaded does
                        let apiDomain = sessionCookie.domain
                            .replace(/\.lightning\.force\./, ".my.salesforce.")
                            .replace(/\.mcas\.ms$/, "");
                        
                        return {
                            sessionId: sessionCookie.value, // Keep full session ID (orgId!sessionId format)
                            instanceUrl: `https://${apiDomain}`,
                            hostname: apiDomain,
                            timestamp: Date.now(),
                            method: 'inspector_reloaded_logic'
                        };
                    }
                } catch (e) {
                    console.debug('Error checking domain:', domain, e);
                }
            }
            
            // Fallback: use the current domain's cookie
            console.log('Using fallback - current domain cookie');
            let fallbackDomain = hostname
                .replace(/\.lightning\.force\./, ".my.salesforce.")
                .replace(/\.mcas\.ms$/, "");
            
            return {
                sessionId: currentCookie.value, // Keep full session ID
                instanceUrl: `https://${fallbackDomain}`,
                hostname: fallbackDomain,
                timestamp: Date.now(),
                method: 'fallback'
            };
            
        } catch (error) {
            console.error('Error extracting session from cookies:', error);
            return null;
        }
    }

    async getCookie(url, name) {
        return new Promise((resolve) => {
            chrome.cookies.get({ url: url, name: name }, (cookie) => {
                if (chrome.runtime.lastError) {
                    console.debug('Error getting cookie:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(cookie);
                }
            });
        });
    }

    async getAllCookiesForDomain(hostname) {
        return new Promise((resolve) => {
            chrome.cookies.getAll({ domain: hostname }, (cookies) => {
                if (chrome.runtime.lastError) {
                    console.debug('Error getting all cookies:', chrome.runtime.lastError);
                    resolve([]);
                } else {
                    resolve(cookies || []);
                }
            });
        });
    }

    // This function will be executed in the context of the web page
    extractSalesforceSession() {
        try {
            let sessionId = null;
            let instanceUrl = null;
            let detectionMethod = 'unknown';

            console.log('Background: Starting Salesforce session extraction...');

            // Get instance URL from current location first
            if (window.location) {
                const hostname = window.location.hostname;
                if (hostname.includes('salesforce.com') || 
                    hostname.includes('force.com') || 
                    hostname.includes('cloudforce.com') ||
                    hostname.includes('database.com')) {
                    instanceUrl = `https://${hostname}`;
                }
            }

            // Method 1: Try to get from various global objects
            if (typeof window !== 'undefined') {
                // Try window.__SALESFORCE_INSTANCE__
                if (!sessionId && window.__SALESFORCE_INSTANCE__) {
                    try {
                        if (window.__SALESFORCE_INSTANCE__.sessionId) {
                            sessionId = window.__SALESFORCE_INSTANCE__.sessionId;
                            detectionMethod = 'salesforce_instance';
                        }
                    } catch (e) {
                        console.debug('Error accessing __SALESFORCE_INSTANCE__:', e);
                    }
                }

                // Check for Lightning Experience session
                if (!sessionId && window.$Api && window.$Api.getSessionId) {
                    try {
                        sessionId = window.$Api.getSessionId();
                        detectionMethod = 'api_session';
                    } catch (e) {
                        console.debug('Error accessing $Api.getSessionId:', e);
                    }
                }

                // Alternative method for Lightning
                if (!sessionId && window.sforce && window.sforce.connection) {
                    try {
                        sessionId = window.sforce.connection.getSessionId();
                        detectionMethod = 'sforce_connection';
                    } catch (e) {
                        console.debug('Error accessing sforce.connection:', e);
                    }
                }

                // Check for Lightning global configuration
                if (!sessionId && window.Lightning && window.Lightning.app) {
                    try {
                        const config = window.Lightning.app;
                        if (config.sessionId) {
                            sessionId = config.sessionId;
                            detectionMethod = 'lightning_config';
                        }
                    } catch (e) {
                        console.debug('Error accessing Lightning config:', e);
                    }
                }

                // Check for $A context
                if (!sessionId && window.$A && window.$A.getContext) {
                    try {
                        const context = window.$A.getContext();
                        if (context && context.getAccessToken) {
                            sessionId = context.getAccessToken();
                            detectionMethod = 'lightning_context';
                        }
                    } catch (e) {
                        console.debug('Error accessing $A context:', e);
                    }
                }
            }

            // Method 2: Try to get from cookies (most reliable for active sessions)
            if (!sessionId) {
                try {
                    const cookies = document.cookie.split(';');
                    for (const cookie of cookies) {
                        const [name, value] = cookie.trim().split('=');
                        if ((name === 'sid' || name === 'session' || name.toLowerCase().includes('session')) && value && value.length >= 15) {
                            const decodedValue = decodeURIComponent(value);
                            if (/^[A-Za-z0-9!._-]{15,}$/.test(decodedValue)) {
                                sessionId = decodedValue;
                                detectionMethod = 'cookie_' + name;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.debug('Error reading cookies:', e);
                }
            }

            // Method 3: Try to extract from script tags and inline JavaScript
            if (!sessionId && window.document) {
                try {
                    const scripts = document.querySelectorAll('script:not([src])');
                    for (const script of scripts) {
                        const content = script.textContent || script.innerHTML;
                        
                        // Enhanced session ID patterns
                        const patterns = [
                            /["']sessionId["']\s*:\s*["']([A-Za-z0-9!._-]{15,})["']/gi,
                            /["']sid["']\s*:\s*["']([A-Za-z0-9!._-]{15,})["']/gi,
                            /sessionId\s*[=:]\s*["']([A-Za-z0-9!._-]{15,})["']/gi,
                            /session_id["']\s*:\s*["']([A-Za-z0-9!._-]{15,})["']/gi,
                            /accessToken["']\s*:\s*["']([A-Za-z0-9!._-]{15,})["']/gi,
                            /"session"\s*:\s*"([A-Za-z0-9!._-]{15,})"/gi,
                            /window\.USER_CONTEXT\s*=\s*{[^}]*sessionId["']\s*:\s*["']([A-Za-z0-9!._-]{15,})["']/gi
                        ];

                        for (const pattern of patterns) {
                            pattern.lastIndex = 0; // Reset regex
                            const match = pattern.exec(content);
                            if (match && match[1]) {
                                sessionId = match[1];
                                detectionMethod = 'script_pattern';
                                break;
                            }
                        }

                        if (sessionId) break;
                    }
                } catch (e) {
                    console.debug('Error parsing scripts:', e);
                }
            }

            // Method 4: Try to extract from meta tags
            if (!sessionId) {
                try {
                    const metaTags = document.querySelectorAll('meta[name], meta[property]');
                    for (const meta of metaTags) {
                        const content = meta.getAttribute('content');
                        if (content && /^[A-Za-z0-9!._-]{15,}$/.test(content)) {
                            const name = meta.getAttribute('name') || meta.getAttribute('property');
                            if (name && (name.toLowerCase().includes('session') || name.toLowerCase().includes('token'))) {
                                sessionId = content;
                                detectionMethod = 'meta_tag';
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.debug('Error reading meta tags:', e);
                }
            }

            // Validate and clean session ID
            if (sessionId) {
                sessionId = sessionId.replace(/['"]/g, '').trim();
                if (!/^[A-Za-z0-9!._-]{15,}$/.test(sessionId)) {
                    console.warn('Invalid session ID format:', sessionId);
                    sessionId = null;
                }
            }

            console.log('Background session extraction result:', {
                sessionId: sessionId ? sessionId.substring(0, 8) + '...' : null,
                instanceUrl,
                detectionMethod,
                found: !!sessionId
            });

            if (sessionId && instanceUrl) {
                return {
                    sessionId: sessionId,
                    instanceUrl: instanceUrl,
                    timestamp: Date.now(),
                    method: detectionMethod
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
                timestamp: data.timestamp || Date.now(),
                method: data.method || 'unknown'
            });
            
            console.log('Session info stored:', {
                instanceUrl: data.instanceUrl,
                method: data.method,
                sessionId: data.sessionId ? data.sessionId.substring(0, 8) + '...' : null
            });
            
            if (sendResponse) {
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error('Error storing session info:', error);
            if (sendResponse) {
                sendResponse({ error: error.message });
            }
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
            // Always enable the extension for all tabs to ensure click handler works
            try {
                await chrome.action.enable(tabId);
                await chrome.sidePanel.setOptions({
                    tabId: tabId,
                    path: 'sidebar.html',
                    enabled: true
                });
                console.log('Extension enabled for tab:', tabId);
            } catch (error) {
                console.error('Error enabling extension for tab:', error);
            }
        }
    }

    async onTabActivated(activeInfo) {
        try {
            // Always enable the extension for all tabs
            await chrome.action.enable(activeInfo.tabId);
            console.log('Extension enabled for active tab:', activeInfo.tabId);
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

    onExtensionIconClicked(tab) {
        console.log('Extension icon clicked on tab:', tab.url);
        console.log('Tab ID:', tab.id);
        
        // Check if side panel API is available
        if (!chrome.sidePanel) {
            console.error('Side panel API is not available in this Chrome version');
            return;
        }
        
        console.log('Side panel API is available, attempting to open...');
        
        // Try to open the side panel immediately (preserving user gesture)
        // Use callback-based API instead of promise-based
        chrome.sidePanel.open({}, (result) => {
            if (chrome.runtime.lastError) {
                console.error('Failed to open side panel:', chrome.runtime.lastError);
                
                // Try with window-specific call
                chrome.sidePanel.open({ windowId: tab.windowId }, (windowResult) => {
                    if (chrome.runtime.lastError) {
                        console.error('Window-specific open also failed:', chrome.runtime.lastError);
                    } else {
                        console.log('Side panel opened with window-specific call');
                    }
                });
            } else {
                console.log('Side panel opened successfully');
            }
        });
    }

    async onTabRemoved(tabId) {
        try {
            // Clean up storage when tab is removed
            const storageKey = `sidebarOpen_${tabId}`;
            await chrome.storage.local.remove([storageKey]);
            console.log('Cleaned up storage for removed tab:', tabId);
        } catch (error) {
            console.error('Error cleaning up storage for tab:', error);
        }
    }

    async clearSession(sendResponse) {
        try {
            // Clear stored session info
            await chrome.storage.session.remove(['sessionId', 'instanceUrl', 'hostname', 'method', 'timestamp']);
            console.log('Session cleared from storage');
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error clearing session:', error);
            sendResponse({ error: error.message });
        }
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
