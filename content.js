// Salesforce Data Reader - Content Script

class SalesforceContentScript {
    constructor() {
        this.sessionId = null;
        this.instanceUrl = null;
        this.isInitialized = false;
        
        this.initialize();
    }

    async initialize() {
        // Wait for the page to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.extractAndStoreSession();
            });
        } else {
            this.extractAndStoreSession();
        }

        // Listen for navigation changes in Lightning Experience
        this.observeNavigationChanges();
        
        this.isInitialized = true;
    }

    extractAndStoreSession() {
        try {
            const sessionInfo = this.extractSalesforceSession();
            
            if (sessionInfo && sessionInfo.sessionId && sessionInfo.instanceUrl) {
                this.sessionId = sessionInfo.sessionId;
                this.instanceUrl = sessionInfo.instanceUrl;
                
                // Store the session info in the background
                chrome.runtime.sendMessage({
                    action: 'storeSessionInfo',
                    data: sessionInfo
                }).catch(error => {
                    console.error('Failed to store session info:', error);
                });

                // Enable the side panel for this tab
                chrome.runtime.sendMessage({
                    action: 'enableSidePanel'
                }).catch(error => {
                    console.error('Failed to enable side panel:', error);
                });

                console.log('Salesforce session detected and stored');
            }
        } catch (error) {
            console.error('Error extracting Salesforce session:', error);
        }
    }

    extractSalesforceSession() {
        let sessionId = null;
        let instanceUrl = null;

        // Method 1: Try to get from Lightning Experience global variables
        if (window.$A && window.$A.getCallback) {
            try {
                const callback = window.$A.getCallback(() => {
                    if (window.$A.getContext && window.$A.getContext()) {
                        const context = window.$A.getContext();
                        if (context.getAccessToken) {
                            sessionId = context.getAccessToken();
                        }
                    }
                });
                callback();
            } catch (e) {
                // Ignore errors from Lightning framework access
            }
        }

        // Method 2: Extract from window variables or configuration
        if (!sessionId) {
            try {
                // Check for Lightning global configuration
                if (window.Lightning && window.Lightning.app) {
                    const config = window.Lightning.app;
                    if (config.sessionId) {
                        sessionId = config.sessionId;
                    }
                }

                // Check for classic Salesforce variables
                if (!sessionId && window.sforce && window.sforce.connection) {
                    sessionId = window.sforce.connection.getSessionId();
                }

                // Check for $Api object (newer Lightning versions)
                if (!sessionId && window.$Api) {
                    if (window.$Api.getSessionId) {
                        sessionId = window.$Api.getSessionId();
                    } else if (window.$Api.getToken) {
                        sessionId = window.$Api.getToken();
                    }
                }
            } catch (e) {
                console.debug('Error accessing Salesforce global objects:', e);
            }
        }

        // Method 3: Extract from script tags and inline JavaScript
        if (!sessionId) {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const content = script.textContent || script.innerHTML;
                
                // Look for session ID patterns
                const patterns = [
                    /["']sessionId["']\s*:\s*["']([A-Za-z0-9!.]{15,18})["']/gi,
                    /["']sid["']\s*:\s*["']([A-Za-z0-9!.]{15,18})["']/gi,
                    /sessionId\s*=\s*["']([A-Za-z0-9!.]{15,18})["']/gi,
                    /session_id["']\s*:\s*["']([A-Za-z0-9!.]{15,18})["']/gi
                ];

                for (const pattern of patterns) {
                    const match = pattern.exec(content);
                    if (match && match[1]) {
                        sessionId = match[1];
                        break;
                    }
                }

                if (sessionId) break;
            }
        }

        // Method 4: Try to get from cookies as last resort
        if (!sessionId) {
            const cookies = document.cookie.split(';');
            for (const cookie of cookies) {
                const [name, value] = cookie.trim().split('=');
                if (name === 'sid' && value && value.length >= 15) {
                    sessionId = decodeURIComponent(value);
                    break;
                }
            }
        }

        // Method 5: Extract from meta tags
        if (!sessionId) {
            const metaTags = document.querySelectorAll('meta[name], meta[property]');
            for (const meta of metaTags) {
                const content = meta.getAttribute('content');
                if (content && /^[A-Za-z0-9!.]{15,18}$/.test(content)) {
                    const name = meta.getAttribute('name') || meta.getAttribute('property');
                    if (name && (name.toLowerCase().includes('session') || name.toLowerCase().includes('token'))) {
                        sessionId = content;
                        break;
                    }
                }
            }
        }

        // Extract instance URL
        if (window.location) {
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            
            if (hostname.includes('salesforce.com') || 
                hostname.includes('force.com') || 
                hostname.includes('cloudforce.com') || 
                hostname.includes('database.com')) {
                instanceUrl = `${protocol}//${hostname}`;
            }
        }

        // Additional instance URL extraction methods
        if (!instanceUrl) {
            try {
                // Try to get from window.location or other sources
                const baseElements = document.querySelectorAll('base[href]');
                for (const base of baseElements) {
                    const href = base.getAttribute('href');
                    if (href && (href.includes('salesforce.com') || href.includes('force.com'))) {
                        const url = new URL(href);
                        instanceUrl = `${url.protocol}//${url.hostname}`;
                        break;
                    }
                }
            } catch (e) {
                console.debug('Error extracting instance URL from base elements:', e);
            }
        }

        if (sessionId && instanceUrl) {
            return {
                sessionId: sessionId,
                instanceUrl: instanceUrl,
                timestamp: Date.now(),
                method: 'content_script'
            };
        }

        return null;
    }

    observeNavigationChanges() {
        // Listen for pushstate/popstate events in Lightning Experience
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.onNavigationChange();
        };

        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.onNavigationChange();
        };

        window.addEventListener('popstate', () => {
            this.onNavigationChange();
        });

        // Also listen for hash changes
        window.addEventListener('hashchange', () => {
            this.onNavigationChange();
        });

        // Listen for Lightning navigation events if available
        if (window.$A && window.$A.eventService) {
            try {
                window.$A.eventService.addHandler({
                    event: 'lightning:navigation',
                    handler: () => {
                        this.onNavigationChange();
                    }
                });
            } catch (e) {
                console.debug('Could not register Lightning navigation handler:', e);
            }
        }
    }

    onNavigationChange() {
        // Re-extract session info after navigation changes
        setTimeout(() => {
            this.extractAndStoreSession();
        }, 1000); // Small delay to let the page settle
    }

    // Inject a small indicator that the extension is active (optional)
    showExtensionIndicator() {
        if (document.getElementById('sf-data-reader-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'sf-data-reader-indicator';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #1976d2;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-family: Arial, sans-serif;
            z-index: 10000;
            opacity: 0.8;
            cursor: pointer;
        `;
        indicator.textContent = 'SF Data Reader Active';
        indicator.title = 'Click the extension icon to open the data reader sidebar';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator.parentNode) {
                        indicator.parentNode.removeChild(indicator);
                    }
                }, 300);
            }
        }, 3000);

        document.body.appendChild(indicator);
    }

    // Public method to get current session info
    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            instanceUrl: this.instanceUrl,
            isInitialized: this.isInitialized
        };
    }
}

// Initialize the content script
let salesforceContentScript = null;

// Only run on Salesforce domains
if (window.location.hostname.includes('salesforce.com') || 
    window.location.hostname.includes('force.com') || 
    window.location.hostname.includes('cloudforce.com') || 
    window.location.hostname.includes('database.com')) {
    
    salesforceContentScript = new SalesforceContentScript();
    
    // Make it globally available for debugging
    window.salesforceDataReader = salesforceContentScript;
}

// Listen for messages from the sidebar or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (salesforceContentScript) {
        switch (message.action) {
            case 'getSessionInfo':
                sendResponse(salesforceContentScript.getSessionInfo());
                break;
            case 'refreshSession':
                salesforceContentScript.extractAndStoreSession();
                sendResponse({ success: true });
                break;
            default:
                sendResponse({ error: 'Unknown action' });
        }
    } else {
        sendResponse({ error: 'Not a Salesforce page' });
    }
});