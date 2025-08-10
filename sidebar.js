// Salesforce Data Reader - Sidebar Script
class SalesforceDataReader {
    constructor() {
        this.sessionId = null;
        this.instanceUrl = null;
        this.hostname = null;
        this.detectionMethod = null;
        
        this.initializeElements();
        this.attachEventListeners();
        this.checkConnection();
    }

    initializeElements() {
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.connectionInfo = document.getElementById('connectionInfo');
        this.instanceUrlSpan = document.getElementById('instanceUrl');
        this.sessionIdSpan = document.getElementById('sessionId');
        this.detectionMethodSpan = document.getElementById('detectionMethod');
        this.authMessage = document.getElementById('authMessage');
        this.clearSessionBtn = document.getElementById('clearSessionBtn');
    }

    attachEventListeners() {
        this.clearSessionBtn.addEventListener('click', () => {
            this.clearSession();
        });
    }

    async checkConnection() {
        try {
            this.updateStatus('checking', 'Checking connection...');
            
            // Get connection info from background script
            const connectionInfo = await this.getConnectionInfo();
            
            if (!connectionInfo) {
                this.updateStatus('error', 'Not connected to Salesforce');
                this.hideConnectionInfo();
                return;
            }

            this.sessionId = connectionInfo.sessionId;
            this.instanceUrl = connectionInfo.instanceUrl;
            this.hostname = connectionInfo.hostname;
            this.detectionMethod = connectionInfo.method;

            // Test the session with an API call
            await this.testSession();
            
        } catch (error) {
            console.error('Connection check failed:', error);
            this.updateStatus('error', 'Connection failed');
            this.hideConnectionInfo();
        }
    }

    async getConnectionInfo() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'getConnectionInfo' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error getting connection info:', chrome.runtime.lastError);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });
    }

    async testSession() {
        try {
            console.log('Testing session with API call...');
            
            // Test with a simple API call
            const response = await this.makeApiCall('/services/data/v58.0/sobjects');
            
            if (response) {
                this.updateStatus('connected', 'Connected to Salesforce');
                this.showConnectionInfo();
                this.hideAuthMessage();
            }
            
        } catch (error) {
            console.error('API test failed:', error);
            
            if (error.message.includes('401') || error.message.includes('Session expired')) {
                this.updateStatus('error', 'Session expired. Please refresh the page and try again.');
                this.hideConnectionInfo();
                this.showAuthMessage();
            } else if (error.message.includes('403') || error.message.includes('Access denied')) {
                this.updateStatus('warning', 'Connected but API access restricted');
                this.showConnectionInfo();
                this.showApiAccessWarning();
            } else {
                this.updateStatus('error', 'Connection failed: ' + error.message);
                this.hideConnectionInfo();
            }
        }
    }

    async makeApiCall(endpoint) {
        if (!this.sessionId || !this.instanceUrl) {
            throw new Error('Not connected to Salesforce');
        }

        const url = this.instanceUrl + endpoint;
        
        console.log('Making API call to:', url);
        console.log('Using session ID:', this.sessionId.substring(0, 8) + '...');

        // Use XMLHttpRequest exactly like Inspector Reloaded
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            
            // Set headers exactly like Inspector Reloaded
            xhr.setRequestHeader('Accept', 'application/json; charset=UTF-8');
            xhr.setRequestHeader('Authorization', 'Bearer ' + this.sessionId);
            xhr.setRequestHeader('Sforce-Call-Options', 'client=Salesforce Data Reader');
            
            xhr.responseType = 'json';
            
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.response);
                    } else if (xhr.status === 401) {
                        console.log('401 Unauthorized - Session expired or invalid');
                        const error = xhr.response && xhr.response.length > 0 ? xhr.response[0].message : 'Session expired or invalid';
                        reject(new Error(error));
                    } else if (xhr.status === 403) {
                        console.log('403 Forbidden - Access denied');
                        const error = xhr.response && xhr.response.length > 0 ? xhr.response[0].message : 'Access denied';
                        reject(new Error(error));
                    } else {
                        console.error('API call failed:', xhr.status, xhr.response);
                        let errorMessage = 'API call failed';
                        try {
                            if (xhr.response && Array.isArray(xhr.response)) {
                                errorMessage = xhr.response.map(err => `${err.errorCode}: ${err.message}`).join('\n');
                            } else if (xhr.response && xhr.response.message) {
                                errorMessage = xhr.response.message;
                            } else {
                                errorMessage = `HTTP ${xhr.status} ${xhr.statusText}`;
                            }
                        } catch (e) {
                            errorMessage = `HTTP ${xhr.status} ${xhr.statusText}`;
                        }
                        reject(new Error(errorMessage));
                    }
                }
            };
            
            xhr.send();
        });
    }

    updateStatus(status, message) {
        this.statusIndicator.className = 'status-indicator ' + status;
        this.statusText.textContent = message;
    }

    showConnectionInfo() {
        this.instanceUrlSpan.textContent = this.instanceUrl;
        this.sessionIdSpan.textContent = this.sessionId ? this.sessionId.substring(0, 8) + '...' : 'N/A';
        this.detectionMethodSpan.textContent = this.detectionMethod || 'Unknown';
        this.connectionInfo.style.display = 'block';
        this.clearSessionBtn.style.display = 'block';
    }

    hideConnectionInfo() {
        this.connectionInfo.style.display = 'none';
        this.clearSessionBtn.style.display = 'none';
    }

    showAuthMessage() {
        this.authMessage.style.display = 'block';
    }

    hideAuthMessage() {
        this.authMessage.style.display = 'none';
    }

    showApiAccessWarning() {
        this.authMessage.innerHTML = '<p>⚠️ API Access Control is enabled. Please check your Salesforce org settings to allow API access.</p>';
        this.authMessage.style.display = 'block';
    }

    clearSession() {
        // Clear stored session info
        chrome.runtime.sendMessage({ action: 'clearSession' }, () => {
            this.sessionId = null;
            this.instanceUrl = null;
            this.hostname = null;
            this.detectionMethod = null;
            
            this.updateStatus('error', 'Session cleared');
            this.hideConnectionInfo();
            this.hideAuthMessage();
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SalesforceDataReader();
});
