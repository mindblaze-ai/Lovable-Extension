# Salesforce Data Reader

A Chrome extension to read and query Salesforce data with an intuitive sidebar interface. Similar to Salesforce Inspector Reloaded, but focused specifically on data reading and SOQL query execution.

## Features

### 🔍 **SOQL Query Builder**
- Interactive query builder with object and field selection
- Auto-completion for field names with type information
- Support for WHERE clauses, LIMIT, and other SOQL features

### 📝 **Custom SOQL Queries**
- Write and execute any valid SOQL query
- Built-in query formatter
- Syntax highlighting and error detection
- Keyboard shortcuts (Ctrl+Enter to execute)

### 📊 **Results Display**
- Clean, responsive table view of query results
- Handle large datasets with scrolling
- Export results to CSV or JSON formats
- Copy individual cell values

### ⚡ **Quick Queries**
- Pre-built query templates for common tasks
- Quick access to user data, accounts, tasks
- Custom query for Mindblaze Settings: `SELECT Id, API_Key__c, Model__c FROM Mindblaze_Settings__c`

### 🔐 **Secure Authentication**
- Automatic Salesforce session detection
- No external data transmission - all communication is direct with Salesforce
- Works with both Classic and Lightning Experience
- Support for My Domain and custom domains

## Installation

### Development Installation

1. **Clone/Download the Extension**
   ```bash
   git clone <repository-url>
   cd salesforce-data-reader
   ```

2. **Load Extension in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the extension directory (containing `manifest.json`)

3. **Verify Installation**
   - Navigate to any Salesforce page
   - Click the extension icon in Chrome toolbar
   - The extension should detect your Salesforce session

### Production Installation (Future)
The extension will be available on the Chrome Web Store once published.

## Usage

### Getting Started

1. **Navigate to Salesforce**
   - Log into any Salesforce org (Sandbox, Production, Developer Edition)
   - The extension automatically detects Salesforce pages

2. **Open the Data Reader**
   - Click the extension icon in Chrome toolbar
   - Click "Open Data Reader Sidebar"
   - Or use the sidebar directly if already enabled

3. **Start Querying**
   - Use the Query Builder for guided query creation
   - Or write custom SOQL queries in the text area
   - Click "Execute Query" or press Ctrl+Enter

### Query Builder Guide

#### Object Selection
- Choose from all queryable objects in your org
- Both standard and custom objects are available
- Objects are sorted alphabetically for easy browsing

#### Field Selection
- Start typing to get autocomplete suggestions
- Shows field type and label for context
- Add multiple fields separated by commas
- Supports related object fields (e.g., `Account.Name`)

#### WHERE Clauses
Add filtering conditions to narrow results:
```sql
Name LIKE '%test%'
CreatedDate = TODAY
Amount > 1000
Industry = 'Technology'
IsActive = true
```

#### Examples
**Basic Query:**
```sql
SELECT Id, Name, Email FROM User LIMIT 10
```

**Complex Query:**
```sql
SELECT Id, Name, Account.Name, Amount, CloseDate 
FROM Opportunity 
WHERE StageName = 'Closed Won' 
AND CreatedDate = THIS_MONTH 
ORDER BY Amount DESC 
LIMIT 50
```

**Custom Object Query:**
```sql
SELECT Id, API_Key__c, Model__c 
FROM Mindblaze_Settings__c
```

### Export Options

**CSV Export:**
- Perfect for Excel or Google Sheets
- Preserves data types and formatting
- Handles special characters and line breaks

**JSON Export:**
- Ideal for developers and integrations
- Maintains object structure and relationships
- Includes Salesforce metadata

## Architecture

The extension consists of several components:

### Extension Components

1. **Manifest (manifest.json)**
   - Defines permissions and extension structure
   - Manifest V3 compliance for future-proofing

2. **Background Service Worker (background.js)**
   - Manages extension lifecycle
   - Handles session detection and storage
   - Coordinates communication between components

3. **Content Script (content.js)**
   - Runs on Salesforce pages
   - Extracts session tokens and instance URLs
   - Monitors navigation changes in Lightning

4. **Sidebar Interface (sidebar.html/css/js)**
   - Main user interface for queries and results
   - Responsive design that works in narrow sidebars
   - Real-time query execution and result display

5. **Popup Interface (popup.html/css/js)**
   - Quick access from browser toolbar
   - Connection status and diagnostics
   - Launch point for sidebar interface

### Security & Privacy

#### Data Handling
- **No External Transmission**: All data stays between your browser and Salesforce
- **Session Reuse**: Uses your existing Salesforce session tokens
- **Local Storage**: Only preferences and temporary data stored locally
- **No Analytics**: No usage tracking or data collection

#### Permissions
The extension requests these permissions:
- `activeTab`: To detect Salesforce pages
- `storage`: To save user preferences
- `scripting`: To extract session information
- `sidePanel`: To provide sidebar interface
- Host permissions for Salesforce domains

## Troubleshooting

### Connection Issues

**"Not Connected" Status:**
1. Verify you're on a Salesforce page
2. Refresh the page and try again
3. Check if you're logged into Salesforce
4. Try logging out and back into Salesforce

**"No Salesforce session found":**
1. Make sure you're on a legitimate Salesforce domain
2. Check if your organization has session security restrictions
3. Try navigating to a different Salesforce page
4. Clear browser cookies and log back in

### Query Issues

**"Query execution failed":**
1. Verify your SOQL syntax is correct
2. Check that field names exist on the selected object
3. Ensure you have read permissions on the object/fields
4. Try simplifying the query to isolate issues

**"API call failed":**
1. Check if your session has expired (refresh the page)
2. Verify API access is enabled for your user/org
3. Some objects may have special access requirements
4. Try reducing the query complexity or limit

### Performance Tips

**For Large Datasets:**
- Use LIMIT clauses to control result size
- Add WHERE clauses to filter data
- Consider exporting in smaller chunks
- Use indexed fields in WHERE clauses when possible

**For Better Performance:**
- Avoid SELECT * queries
- Specify only needed fields
- Use selective WHERE clauses
- Consider relationship query limits

## Development

### Prerequisites
- Node.js and npm (for development tools)
- Chrome browser
- Basic knowledge of JavaScript and Chrome Extension APIs

### Development Setup
```bash
# Install development dependencies (if using)
npm install

# For linting and code quality
npm run lint

# For building (if build process exists)
npm run build
```

### File Structure
```
salesforce-data-reader/
├── manifest.json          # Extension manifest
├── background.js          # Service worker
├── content.js            # Content script
├── sidebar.html          # Main UI
├── sidebar.css           # UI styles
├── sidebar.js            # UI logic
├── popup.html            # Toolbar popup
├── popup.js              # Popup logic
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various Salesforce orgs
5. Submit a pull request

### Testing Checklist
- [ ] Works in Classic Salesforce
- [ ] Works in Lightning Experience
- [ ] Handles session expiration gracefully
- [ ] Works with My Domain configurations
- [ ] Properly handles large result sets
- [ ] Export functions work correctly
- [ ] UI is responsive and accessible

## Comparison with Salesforce Inspector Reloaded

| Feature | Salesforce Data Reader | Inspector Reloaded |
|---------|----------------------|-------------------|
| Focus | Data reading & SOQL | Full Salesforce toolset |
| Interface | Clean sidebar | Multiple tools/tabs |
| Query Builder | ✅ With autocomplete | ✅ Basic |
| Export Options | CSV, JSON | CSV, Excel, JSON |
| Session Detection | ✅ Automatic | ✅ Automatic |
| Metadata Browsing | 🔄 Future feature | ✅ Comprehensive |
| Data Import | ❌ Read-only focus | ✅ Available |
| Setup Navigation | ❌ | ✅ Extensive |

## Roadmap

### Version 1.1 (Planned)
- [ ] Query history and favorites
- [ ] Improved syntax highlighting
- [ ] Field relationship explorer
- [ ] Dark mode support

### Version 1.2 (Future)
- [ ] Query performance metrics
- [ ] Bulk API integration for large datasets
- [ ] Advanced filtering UI
- [ ] Query sharing capabilities

### Version 2.0 (Vision)
- [ ] Basic metadata browsing
- [ ] Object relationship visualization
- [ ] Query optimization suggestions
- [ ] Multi-org session management

## License

MIT License - See LICENSE file for details.

## Support

For issues, questions, or feature requests:
1. Check the troubleshooting section above
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Include browser version, Salesforce org type, and error messages

## Acknowledgments

- Inspired by Salesforce Inspector Reloaded
- Built with modern Chrome Extension APIs
- Designed for the Salesforce developer and admin community

---

**Made with ❤️ for Salesforce professionals**