# CodeMaster Pro - Local Package

## Overview
CodeMaster Pro is a comprehensive code analysis and development hub with integrated CSS and Prefetch optimization workshops.

## Features
- ✅ **Multi-file upload** - Drag and drop or browse to upload HTML, CSS, and JavaScript files
- ✅ **CSS Workshop** - Edit CSS rules with live preview and line number validation
- ✅ **Prefetch Workshop** - Detect and optimize external resource loading (preconnect, dns-prefetch, prefetch)
- ✅ **Enhanced search** - Auto-focus line highlighting with clickable results
- ✅ **Live preview** - Real-time HTML/CSS preview with auto-refresh
- ✅ **Code comparison** - Side-by-side original and modified code view

## Installation & Usage

### Option 1: Local Browser Version
1. Download or clone this entire folder
2. Open `index.html` in any modern web browser
3. Start uploading files and using the workshops!

### Option 2: GoHighLevel Copy-Paste Version
Use the single `codemaster-gohighlevel.html` file that contains everything embedded.

## How to Use

### Getting Started
1. **Upload Files**: Drag and drop your HTML, CSS, or JavaScript files into the upload area
2. **Auto-Population**: Files automatically populate both the project code window and original window
3. **Run File Code**: Use this button as a failsafe if auto-population doesn't work

### CSS Workshop
1. Click "🎨 CSS Standardizer" to open the CSS workshop
2. Browse detected CSS rules with **exact line numbers** from your original files
3. **Edit Existing**: Click any rule to edit it with live preview
4. **Create New**: Click "✨ Create New CSS Rule" to add fresh CSS
5. **Apply**: Changes get automatically inserted into your code

### Prefetch Workshop  
1. Click "🚀 Prefetch Inspector" to open the prefetch workshop
2. **Automatic Detection**: Finds all external resources in your code
3. **Smart Recommendations**:
   - **Preconnect**: For fonts and cross-origin resources
   - **DNS-Prefetch**: For APIs and external services
   - **Prefetch**: For CDN resources, images, and scripts
4. **Performance Impact**: See estimated speed improvements
5. **Apply**: Generated tags get inserted into your HTML head section

### Search & Navigation
1. **Enhanced Search**: Use the search bar to find code patterns
2. **Auto-Focus**: First result automatically highlights and scrolls into view
3. **Clickable Results**: Click any search result to jump to that line
4. **Clear/Search Buttons**: Manual controls plus Enter key support

## Browser Compatibility
- Chrome, Firefox, Safari, Edge (modern versions)
- Requires JavaScript enabled
- Works offline once loaded

## File Support
- HTML (.html, .htm)
- CSS (.css)
- JavaScript (.js, .jsx, .ts, .tsx)
- JSON (.json)
- PHP (.php)
- XML (.xml)
- And more!

## Technical Details
- Built with React 18 and Tailwind CSS
- No server required - runs entirely in the browser
- Uses modern JavaScript features (ES6+)
- File processing happens client-side for privacy

## Troubleshooting
- **Files not loading?** Make sure they're text-based code files
- **Workshops not working?** Ensure your code has CSS rules or external URLs
- **Search not working?** Make sure there's content in the code editor
- **Preview blank?** Check that your HTML is valid

## Version Info
- Local standalone version with all features
- Enhanced prefetch detection for comprehensive resource optimization
- CSS workshop with exact line number matching
- Auto-population of code windows on file upload