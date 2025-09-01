import type { WorkshopMessage, ProjectFile } from '@/types/workshop';

export function createWorkshopSrcdoc(workshopType: string, files: ProjectFile[]): string {
  const baseHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${workshopType} Workshop</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --background: hsl(220, 13%, 4%);
            --foreground: hsl(213, 31%, 91%);
            --card: hsl(220, 13%, 9%);
            --card-foreground: hsl(213, 31%, 91%);
            --primary: hsl(212, 92%, 70%);
            --primary-foreground: hsl(220, 13%, 4%);
            --secondary: hsl(137, 72%, 32%);
            --secondary-foreground: hsl(213, 31%, 91%);
            --muted: hsl(220, 13%, 13%);
            --muted-foreground: hsl(218, 11%, 65%);
            --accent: hsl(276, 55%, 72%);
            --accent-foreground: hsl(220, 13%, 4%);
            --border: hsl(220, 13%, 18%);
            --radius: 12px;
            --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
            --font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
        }
        body {
            font-family: var(--font-sans);
            background: var(--background);
            color: var(--foreground);
            margin: 0;
            padding: 0;
        }
        .tool-panel {
            background: hsl(220, 13%, 8%);
            border: 1px solid var(--border);
            border-radius: var(--radius);
        }
    </style>
</head>
<body>
    <div id="workshop-content"></div>
    <script>
        // Workshop communication protocol
        window.addEventListener('message', (event) => {
            if (event.data.type === 'WORKSHOP_REQUEST_CODE') {
                parent.postMessage({
                    type: 'WORKSHOP_READY',
                    workshopId: '${workshopType}',
                    data: { files: ${JSON.stringify(files)} }
                }, '*');
            }
        });
        
        // Signal ready state
        parent.postMessage({
            type: 'WORKSHOP_LOADED',
            workshopId: '${workshopType}'
        }, '*');
    </script>
</body>
</html>`;

  return baseHTML;
}

export function generateBlobUrl(content: string): string {
  const blob = new Blob([content], { type: 'text/html' });
  return URL.createObjectURL(blob);
}


export function analyzeExternalResources(content: string): Array<{
  url: string;
  type: 'font' | 'api' | 'cdn' | 'image' | 'script';
  recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch';
  existing?: 'preconnect' | 'dns-prefetch' | 'prefetch' | null;
}> {
  const resources: Array<{
    url: string;
    type: 'font' | 'api' | 'cdn' | 'image' | 'script';
    recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch';
    existing?: 'preconnect' | 'dns-prefetch' | 'prefetch' | null;
  }> = [];
  const uniqueUrls = new Set<string>();
  const existingTags = new Map<string, 'preconnect' | 'dns-prefetch' | 'prefetch'>();
  
  // FIRST: Detect existing prefetch/preconnect/dns-prefetch/preload tags
  const existingTagPatterns = [
    // Enhanced patterns to catch all variations with flexible attribute order
    // Pattern 1: rel="preconnect" with any attribute order
    /<link[^>]*\brel=["']preconnect["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']preconnect["'][^>]*>/gi,
    
    // Pattern 2: rel="dns-prefetch" with any attribute order  
    /<link[^>]*\brel=["']dns-prefetch["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']dns-prefetch["'][^>]*>/gi,
    
    // Pattern 3: rel="prefetch" with any attribute order
    /<link[^>]*\brel=["']prefetch["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']prefetch["'][^>]*>/gi,
    
    // Pattern 4: rel="preload" with any attribute order (treat as prefetch)
    /<link[^>]*\brel=["']preload["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']preload["'][^>]*>/gi,
    
    // Pattern 5: rel="stylesheet" (treat as prefetch for CSS)
    /<link[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi
  ];
  
  existingTagPatterns.forEach((pattern, index) => {
    let match;
    // Reset regex lastIndex to avoid skipping matches
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const url = match[1];
      if (url) {
        let relType: 'preconnect' | 'dns-prefetch' | 'prefetch';
        // Map pattern index to rel type
        if (index < 2) relType = 'preconnect';        // patterns 0-1: preconnect
        else if (index < 4) relType = 'dns-prefetch'; // patterns 2-3: dns-prefetch
        else if (index < 6) relType = 'prefetch';     // patterns 4-5: prefetch
        else if (index < 8) relType = 'prefetch';     // patterns 6-7: preload -> prefetch
        else relType = 'prefetch';                    // patterns 8-9: stylesheet -> prefetch
        
        // Convert relative URLs to absolute URLs if possible
        let fullUrl = url;
        if (!url.startsWith('http') && !url.startsWith('//')) {
          // Handle relative URLs by marking them as detected
          fullUrl = url.startsWith('/') ? url : `/${url}`;
        }
        
        existingTags.set(fullUrl, relType);
      }
    }
  });
  
  // SECOND: Detect all external resources from various sources
  const resourcePatterns = [
    // Standard URLs in attributes (src, href, etc.)
    /(?:src|href|url)\s*=\s*["']([^"'\s]+)["']/gi,
    // CSS url() function
    /url\(["']?([^"'\)\s]+)["']?\)/gi,
    // Direct HTTP URLs in text
    /https?:\/\/[^\s"'<>\)\}]+/gi,
    // Import statements
    /import\s+[^\n]*from\s+["']([^"']+)["']/gi,
    // @import in CSS
    /@import\s+["']([^"']+)["']/gi
  ];
  
  resourcePatterns.forEach(pattern => {
    let match;
    // Reset regex lastIndex to avoid skipping matches
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const url = match[1] || match[0];
      // Accept both absolute HTTP URLs and relative URLs
      if (url && (url.startsWith('http') || url.startsWith('/') || url.match(/^[a-zA-Z0-9_-]+\.(html|js|css|png|jpg|gif|svg|json|woff|woff2)$/i)) && !uniqueUrls.has(url)) {
        uniqueUrls.add(url);
        
        let type: 'font' | 'api' | 'cdn' | 'image' | 'script' = 'cdn';
        let recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch' = 'prefetch';
        
        // Smart categorization based on URL patterns
        if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || 
            url.includes('typekit.net') || url.includes('fonts.com') || 
            /\.(woff|woff2|ttf|otf|eot)$/i.test(url)) {
          type = 'font';
          recommendation = 'preconnect';
        }
        else if (url.includes('api.') || url.includes('/api/') || 
                 (url.includes('googleapis.com') && !url.includes('fonts')) ||
                 url.includes('ajax.') || url.includes('rest.') || url.includes('graphql.') ||
                 url.includes('google-analytics.com') || url.includes('facebook.com') ||
                 url.includes('twitter.com') || url.includes('youtube.com') ||
                 url.includes('analytics.') || url.includes('tracking.')) {
          type = 'api';
          recommendation = 'dns-prefetch';
        }
        else if (url.includes('cdn.') || url.includes('jsdelivr') || url.includes('unpkg') ||
                 url.includes('cdnjs.') || url.includes('bootstrap') || url.includes('tailwindcss')) {
          type = 'cdn';
          recommendation = 'prefetch';
        }
        else if (/\.(jpg|jpeg|png|webp|gif|svg|ico|bmp)$/i.test(url)) {
          type = 'image';
          recommendation = 'prefetch';
        }
        else if (/\.(js|css|json)$/i.test(url)) {
          type = 'script';
          recommendation = 'prefetch';
        }
        
        // Check if this URL already has an existing tag
        const existing = existingTags.get(url) || null;
        
        resources.push({ url, type, recommendation, existing });
      }
    }
  });
  
  // THIRD: Add existing tags that weren't found in resources
  existingTags.forEach((relType, url) => {
    if (!uniqueUrls.has(url)) {
      let type: 'font' | 'api' | 'cdn' | 'image' | 'script' = 'cdn';
      
      // Smart categorization for existing tags
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        type = 'font';
      } else if (url.includes('api.') || url.includes('analytics.')) {
        type = 'api';
      } else if (url.includes('cdn.') || url.includes('jsdelivr')) {
        type = 'cdn';
      } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url)) {
        type = 'image';
      } else if (/\.(js|css)$/i.test(url)) {
        type = 'script';
      }
      
      resources.push({ 
        url, 
        type, 
        recommendation: relType, 
        existing: relType 
      });
    }
  });
  
  // Sort by: existing tags first, then by recommendation priority
  return resources.sort((a, b) => {
    // Existing tags come first
    if (a.existing && !b.existing) return -1;
    if (!a.existing && b.existing) return 1;
    
    // Then sort by recommendation priority
    const order = { 'preconnect': 0, 'dns-prefetch': 1, 'prefetch': 2 };
    return order[a.recommendation] - order[b.recommendation];
  });
}

// Enhanced code manipulation utilities
export interface CodeLocation {
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  content: string;
}

export interface CodeChange {
  type: 'insert' | 'replace' | 'delete' | 'append';
  location: CodeLocation;
  newContent: string;
  description: string;
}

export class CodeManipulator {
  private lines: string[];
  private original: string;

  constructor(code: string) {
    this.original = code;
    this.lines = code.split('\n');
  }

  // Find HTML head section for inserting prefetch tags
  findHtmlHead(): CodeLocation | null {
    const headStartRegex = /<head[^>]*>/i;
    const headEndRegex = /<\/head>/i;
    
    let headStart: CodeLocation | null = null;
    let headEnd: CodeLocation | null = null;
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      const startMatch = line.match(headStartRegex);
      const endMatch = line.match(headEndRegex);
      
      if (startMatch && !headStart) {
        const startCol = line.indexOf(startMatch[0]);
        headStart = {
          startLine: i,
          endLine: i,
          startCol: startCol + startMatch[0].length,
          endCol: startCol + startMatch[0].length,
          content: startMatch[0]
        };
      }
      
      if (endMatch && headStart && !headEnd) {
        const endCol = line.indexOf(endMatch[0]);
        headEnd = {
          startLine: i,
          endLine: i,
          startCol: endCol,
          endCol: endCol,
          content: endMatch[0]
        };
        break;
      }
    }
    
    // Return insertion point before closing </head>
    if (headEnd) {
      return {
        startLine: headEnd.startLine,
        endLine: headEnd.startLine,
        startCol: 0,
        endCol: 0,
        content: ''
      };
    }
    
    return null;
  }

  // Find CSS rule by selector
  findCSSRule(selector: string): CodeLocation | null {
    const selectorRegex = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'i');
    let ruleStart: number | null = null;
    let braceCount = 0;
    
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      
      if (selectorRegex.test(line) && ruleStart === null) {
        ruleStart = i;
        braceCount = (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount === 0) {
          // Single line rule
          return {
            startLine: i,
            endLine: i,
            startCol: 0,
            endCol: line.length,
            content: line
          };
        }
      } else if (ruleStart !== null) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount === 0) {
          // Multi-line rule
          const content = this.lines.slice(ruleStart, i + 1).join('\n');
          return {
            startLine: ruleStart,
            endLine: i,
            startCol: 0,
            endCol: line.length,
            content
          };
        }
      }
    }
    
    return null;
  }

  // Smart insertion that preserves formatting
  insertAtLocation(location: CodeLocation, content: string, indent: boolean = true): string {
    const newLines = [...this.lines];
    const insertContent = indent ? this.getIndentedContent(content, location.startLine) : content;
    
    if (location.startLine === location.endLine) {
      // Single line insertion
      const line = newLines[location.startLine];
      newLines[location.startLine] = 
        line.slice(0, location.startCol) + 
        insertContent + 
        line.slice(location.endCol);
    } else {
      // Multi-line insertion
      const contentLines = insertContent.split('\n');
      newLines.splice(location.startLine, location.endLine - location.startLine + 1, ...contentLines);
    }
    
    return newLines.join('\n');
  }

  // Replace content while preserving structure
  replaceAtLocation(location: CodeLocation, newContent: string): string {
    const newLines = [...this.lines];
    const indentedContent = this.getIndentedContent(newContent, location.startLine);
    const contentLines = indentedContent.split('\n');
    
    newLines.splice(location.startLine, location.endLine - location.startLine + 1, ...contentLines);
    
    return newLines.join('\n');
  }

  // Delete content at location
  deleteAtLocation(location: CodeLocation): string {
    const newLines = [...this.lines];
    
    if (location.startLine === location.endLine) {
      // Single line deletion
      const line = newLines[location.startLine];
      newLines[location.startLine] = 
        line.slice(0, location.startCol) + 
        line.slice(location.endCol);
    } else {
      // Multi-line deletion
      const firstLine = newLines[location.startLine].slice(0, location.startCol);
      const lastLine = newLines[location.endLine].slice(location.endCol);
      newLines.splice(location.startLine, location.endLine - location.startLine + 1, firstLine + lastLine);
    }
    
    return newLines.join('\n');
  }

  // Get appropriate indentation based on context
  private getIndentedContent(content: string, lineNumber: number): string {
    const contextLine = this.lines[lineNumber] || '';
    const indent = contextLine.match(/^(\s*)/)?.[1] || '  ';
    
    return content.split('\n')
      .map((line, index) => index === 0 ? line : indent + line)
      .join('\n');
  }

  // Apply multiple changes in order
  applyChanges(changes: CodeChange[]): string {
    let result = this.original;
    
    // Sort changes by line number (reverse order for proper indexing)
    const sortedChanges = changes.sort((a, b) => b.location.startLine - a.location.startLine);
    
    for (const change of sortedChanges) {
      const manipulator = new CodeManipulator(result);
      
      switch (change.type) {
        case 'insert':
          result = manipulator.insertAtLocation(change.location, change.newContent);
          break;
        case 'replace':
          result = manipulator.replaceAtLocation(change.location, change.newContent);
          break;
        case 'delete':
          result = manipulator.deleteAtLocation(change.location);
          break;
        case 'append':
          // Find end of file or specific section
          const appendLocation: CodeLocation = {
            ...change.location,
            startCol: change.location.endCol,
          };
          result = manipulator.insertAtLocation(appendLocation, change.newContent);
          break;
      }
    }
    
    return result;
  }
}

// Enhanced CSS parsing with better structure preservation
export function parseCSS(content: string): Array<{
  selector: string;
  properties: Record<string, string>;
  startLine: number;
  endLine: number;
  rawContent: string;
}> {
  const manipulator = new CodeManipulator(content);
  const rules: Array<{
    selector: string;
    properties: Record<string, string>;
    startLine: number;
    endLine: number;
    rawContent: string;
  }> = [];
  
  // More robust CSS parsing
  const cssRuleRegex = /([^{]+)\{([^}]+)\}/g;
  let match;
  
  while ((match = cssRuleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const propertiesStr = match[2].trim();
    const properties: Record<string, string> = {};
    
    // Parse properties
    propertiesStr.split(';').forEach(prop => {
      const [key, value] = prop.split(':').map(s => s.trim());
      if (key && value) {
        properties[key] = value;
      }
    });
    
    // Find line numbers
    const beforeMatch = content.substring(0, match.index);
    const startLine = beforeMatch.split('\n').length - 1;
    const endLine = startLine + match[0].split('\n').length - 1;
    
    rules.push({
      selector,
      properties,
      startLine,
      endLine,
      rawContent: match[0]
    });
  }
  
  return rules;
}

// Parse CSS rules from multiple files with accurate line numbers
export const parseCSSFromFiles = (files: ProjectFile[]) => {
  const cssFiles = files.filter(f => f.type === 'css');
  const htmlFiles = files.filter(f => f.type === 'html');
  
  let allRules: any[] = [];
  
  // Parse dedicated CSS files
  cssFiles.forEach(file => {
    const rules = parseCSS(file.content);
    allRules = allRules.concat(rules.map(rule => ({ 
      ...rule, 
      source: file.name,
      fileName: file.name,
      // Line numbers are 0-based, add 1 for display
      lineNumber: rule.startLine + 1,
      endLineNumber: rule.endLine + 1
    })));
  });
  
  // Parse CSS from HTML style tags
  htmlFiles.forEach(file => {
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    
    while ((match = styleRegex.exec(file.content)) !== null) {
      const cssContent = match[1];
      const styleTagStart = file.content.substring(0, match.index);
      const styleTagLineOffset = styleTagStart.split('\n').length;
      
      const rules = parseCSS(cssContent);
      allRules = allRules.concat(rules.map(rule => ({ 
        ...rule, 
        source: `${file.name} (inline)`,
        fileName: file.name,
        // Adjust line numbers for HTML context (0-based to 1-based, plus offset)
        lineNumber: rule.startLine + styleTagLineOffset + 1,
        endLineNumber: rule.endLine + styleTagLineOffset + 1
      })));
    }
  });
  
  return allRules;
};
