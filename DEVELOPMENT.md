# Development Guide - Hot Reload Setup

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

### 3. Load Extension in Chrome
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist/` folder

## 🔄 Hot Reload Features

### What Gets Hot Reloaded
- ✅ **Background Script** (`background.js`) - Service worker reloads automatically
- ✅ **Content Script** (`content.js`) - Reloads when you refresh Salesforce pages
- ✅ **Sidebar** (`sidebar.html`, `sidebar.js`, `sidebar.css`) - Instant reload
- ✅ **Popup** (`popup.html`, `popup.js`) - Instant reload
- ✅ **Manifest** (`manifest.json`) - Extension reloads automatically

### Development Workflow
1. **Make changes** to any file in the project root
2. **Save the file** - Vite automatically rebuilds
3. **See changes instantly** - No manual reloading needed!

### File Structure for Development
```
├── manifest.json         # Extension manifest
├── background.js         # Service worker
├── content.js           # Content script
├── sidebar.html         # Sidebar interface
├── sidebar.js           # Sidebar logic
├── sidebar.css          # Sidebar styles
├── popup.html           # Popup interface
├── popup.js             # Popup logic
├── icons/               # Extension icons
├── vite.config.js       # Vite configuration
└── dist/                # Built extension (auto-generated)
```

## 🛠️ Development Tips

### Making Changes
- **Background Script**: Changes apply immediately, check console for logs
- **Content Script**: Refresh Salesforce page to see changes
- **UI Files**: Changes appear instantly in sidebar/popup
- **Manifest**: Extension reloads automatically

### Debugging
- **Background Script**: Check `chrome://extensions/` → "Service Worker" → "Console"
- **Content Script**: Check browser console on Salesforce pages
- **Sidebar/Popup**: Check browser console when sidebar/popup is open

### Common Issues
- **Extension not loading**: Make sure `dist/` folder is selected in Chrome extensions
- **Hot reload not working**: Check that Vite dev server is running (`npm run dev`)
- **Changes not appearing**: Try refreshing the Salesforce page or reopening sidebar

## 📦 Build for Production

```bash
npm run build
```

This creates a production-ready extension in the `dist/` folder.

## 🔧 Configuration

### Vite Config (`vite.config.js`)
- Uses `@crxjs/vite-plugin` for Chrome extension support
- Hot reload enabled by default
- Builds to `dist/` folder
- Server runs on port 5173

### Package Scripts
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 🎯 Best Practices

1. **Keep files in project root** - The plugin expects all files to be accessible
2. **Use console.log** - For debugging background and content scripts
3. **Test on real Salesforce orgs** - Sandbox and production environments
4. **Check Chrome extension console** - For background script errors
5. **Refresh pages when needed** - Content script changes require page refresh

## 🚨 Troubleshooting

### "Manifest assets must exist" Error
- Ensure all files referenced in `manifest.json` exist in project root
- Check that icon files are in the `icons/` folder

### "No input is provided" Error
- Make sure `manifest.json` is in the project root
- Check that Vite config points to correct manifest path

### Hot reload not working
- Verify Vite dev server is running (`npm run dev`)
- Check that `dist/` folder is loaded in Chrome extensions
- Try restarting the dev server

### Extension not loading
- Check Chrome extension console for errors
- Verify all required files are in `dist/` folder
- Try removing and re-adding the extension

---

**Happy coding! 🎉**
