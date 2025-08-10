# Salesforce Data Reader

A Chrome extension to read Salesforce data with an intuitive sidebar interface, featuring hot reload development.

## Features

- 🔗 **Salesforce Connection**: Automatic session detection using Inspector Reloaded's proven logic
- 📊 **Connection Status**: Real-time connection status with visual indicators
- 🔄 **Hot Reload Development**: Instant reload on file changes during development
- 🛡️ **Manifest V3**: Built with the latest Chrome extension standards
- 🎯 **Simplified Interface**: Focus on connection status and session management

## Development Setup

### Prerequisites

- Node.js (v16 or higher)
- Chrome browser (v114 or higher for side panel support)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server with hot reload:**
   ```bash
   npm run dev
   ```

3. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist/` folder created by Vite

### Development Workflow

- **Hot Reload**: Any changes to files in the `extension/` folder will automatically reload the extension
- **Background Script**: Changes to `background.js` will reload the service worker
- **Content Scripts**: Changes to `content.js` will reload on page refresh
- **Sidebar/Popup**: Changes to HTML/CSS/JS will reload instantly

### Build for Production

```bash
npm run build
```

This creates a production-ready extension in the `dist/` folder.

## Project Structure

```
├── extension/                 # Extension source files
│   ├── manifest.json         # Extension manifest (MV3)
│   ├── background.js         # Service worker
│   ├── content.js           # Content script
│   ├── sidebar.html         # Sidebar interface
│   ├── sidebar.js           # Sidebar logic
│   ├── sidebar.css          # Sidebar styles
│   ├── popup.html           # Popup interface
│   ├── popup.js             # Popup logic
│   └── icons/               # Extension icons
├── dist/                    # Built extension (created by Vite)
├── vite.config.js           # Vite configuration
├── package.json             # Dependencies and scripts
└── README.md               # This file
```

## Usage

1. **Navigate to a Salesforce page** (any org - production, sandbox, etc.)
2. **Click the extension icon** in your browser toolbar
3. **View connection status** in the sidebar that opens
4. **Monitor session info** including instance URL and detection method

## Connection Detection

The extension uses the exact same session detection logic as [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded):

- **Cookie-based detection**: Uses Chrome's Cookies API
- **Multi-domain search**: Searches across Salesforce domains
- **Domain conversion**: Converts Lightning domains to API domains
- **Full session ID**: Uses complete session ID (orgId!sessionId format)

## Troubleshooting

### Connection Issues

- **401 Unauthorized**: Session may be expired - refresh the Salesforce page
- **403 Forbidden**: API Access Control may be enabled in your org
- **No connection**: Ensure you're on a Salesforce page and logged in

### Development Issues

- **Hot reload not working**: Check that the `dist/` folder is loaded in Chrome extensions
- **Build errors**: Run `npm install` to ensure all dependencies are installed
- **Side panel not opening**: Ensure Chrome version 114+ and check console for errors

## Security

- **Minimal permissions**: Only requests necessary permissions
- **Session handling**: Secure session storage using Chrome's session storage API
- **API calls**: Uses proper authentication headers and error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by [Salesforce Inspector Reloaded](https://github.com/tprouvot/Salesforce-Inspector-reloaded)
- Built with [Vite](https://vitejs.dev/) and [vite-plugin-chrome-extension](https://github.com/antfu/vite-plugin-chrome-extension)
