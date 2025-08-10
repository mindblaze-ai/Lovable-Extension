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
        let detectionMethod = 'unknown';

        console.log('Starting Salesforce session extraction...');

        // Extract instance URL first
        if (window.location) {
            const hostname = window.location.hostname;
            const protocol = window.location.protocol;
            
            if (hostname.includes('salesforce.com') || 
                hostname.includes('force.com') || 
                hostname.includes('cloudforce.com') || 
                hostname.includes('database.com')) {
                instanceUrl = `${protocol}//${hostname}`;
                console.log('Instance URL detected:', instanceUrl);
            }
        }

        // Method 1: Modern Salesforce API approach - try to access session from various global objects
        if (typeof window !== 'undefined') {
            // Try window.__SALESFORCE_INSTANCE__ (used in some Salesforce implementations)
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

            // Try sforce.connection (Classic Salesforce)
            if (!sessionId && window.sforce && window.sforce.connection) {
                try {
                    sessionId = window.sforce.connection.getSessionId();
                    detectionMethod = 'sforce_connection';
                } catch (e) {
                    console.debug('Error accessing sforce.connection:', e);
                }
            }

            // Try $Api object (Lightning)
            if (!sessionId && window.$Api) {
                try {
                    if (window.$Api.getSessionId) {
                        sessionId = window.$Api.getSessionId();
                        detectionMethod = 'api_session';
                    } else if (window.$Api.getToken) {
                        sessionId = window.$Api.getToken();
                        detectionMethod = 'api_token';
                    }
                } catch (e) {
                    console.debug('Error accessing $Api:', e);
                }
            }

            // Try Lightning $A framework
            if (!sessionId && window.$A) {
                try {
                    if (window.$A.getContext) {
                        const context = window.$A.getContext();
                        if (context && context.getAccessToken) {
                            sessionId = context.getAccessToken();
                            detectionMethod = 'lightning_context';
                        }
                    }
                } catch (e) {
                    console.debug('Error accessing $A context:', e);
                }
            }

            // Try Lightning global configuration
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
        }

        // Method 2: Cookie-based detection (most reliable for active sessions)
        if (!sessionId) {
            try {
                const cookies = document.cookie.split(';');
                for (const cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if ((name === 'sid' || name === 'session' || name.toLowerCase().includes('session')) && value && value.length >= 15) {
                        const decodedValue = decodeURIComponent(value);
                        // Validate session ID format
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

        // Method 3: Script tag parsing (comprehensive patterns)
        if (!sessionId) {
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

        // Method 4: Meta tag extraction
        if (!sessionId) {
            try {
                const metaTags = document.querySelectorAll('meta[name], meta[property], meta[content]');
                for (const meta of metaTags) {
                    const content = meta.getAttribute('content');
                    const name = meta.getAttribute('name') || meta.getAttribute('property');
                    
                    if (content && name && /^[A-Za-z0-9!._-]{15,}$/.test(content)) {
                        if (name.toLowerCase().includes('session') || 
                            name.toLowerCase().includes('token') || 
                            name.toLowerCase().includes('sid')) {
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

        // Method 5: Local/Session storage check
        if (!sessionId) {
            try {
                // Check localStorage
                const localKeys = Object.keys(localStorage || {});
                for (const key of localKeys) {
                    if (key.toLowerCase().includes('session') || key.toLowerCase().includes('token')) {
                        const value = localStorage.getItem(key);
                        if (value && /^[A-Za-z0-9!._-]{15,}$/.test(value)) {
                            sessionId = value;
                            detectionMethod = 'localStorage';
                            break;
                        }
                    }
                }

                // Check sessionStorage
                if (!sessionId) {
                    const sessionKeys = Object.keys(sessionStorage || {});
                    for (const key of sessionKeys) {
                        if (key.toLowerCase().includes('session') || key.toLowerCase().includes('token')) {
                            const value = sessionStorage.getItem(key);
                            if (value && /^[A-Za-z0-9!._-]{15,}$/.test(value)) {
                                sessionId = value;
                                detectionMethod = 'sessionStorage';
                                break;
                            }
                        }
                    }
                }
            } catch (e) {
                console.debug('Error reading storage:', e);
            }
        }

        // Validate and clean session ID
        if (sessionId) {
            // Remove any quotes or extra characters
            sessionId = sessionId.replace(/['"]/g, '').trim();
            
            // Final validation
            if (!/^[A-Za-z0-9!._-]{15,}$/.test(sessionId)) {
                console.warn('Invalid session ID format:', sessionId);
                sessionId = null;
            }
        }

        console.log('Session extraction result:', {
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
