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

export function parseCSS(content: string): Array<{
  selector: string;
  properties: Record<string, string>;
  startLine: number;
  endLine: number;
}> {
  const rules: Array<{
    selector: string;
    properties: Record<string, string>;
    startLine: number;
    endLine: number;
  }> = [];
  
  const lines = content.split('\n');
  let currentRule: any = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('{') && !currentRule) {
      const selector = line.split('{')[0].trim();
      currentRule = {
        selector,
        properties: {},
        startLine: i + 1,
        endLine: i + 1
      };
    } else if (line.includes('}') && currentRule) {
      currentRule.endLine = i + 1;
      rules.push(currentRule);
      currentRule = null;
    } else if (currentRule && line.includes(':')) {
      const [prop, value] = line.split(':').map(s => s.trim());
      if (prop && value) {
        currentRule.properties[prop] = value.replace(';', '');
      }
    }
  }
  
  return rules;
}

export function analyzeExternalResources(content: string): Array<{
  url: string;
  type: 'font' | 'api' | 'cdn' | 'image' | 'script';
  recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch';
}> {
  const resources: Array<{
    url: string;
    type: 'font' | 'api' | 'cdn' | 'image' | 'script';
    recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch';
  }> = [];
  
  // Extract URLs from various sources
  const urlRegex = /https?:\/\/[^\s"'<>]+/g;
  const matches = content.match(urlRegex) || [];
  
  matches.forEach(url => {
    let type: 'font' | 'api' | 'cdn' | 'image' | 'script' = 'cdn';
    let recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch' = 'prefetch';
    
    if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
      type = 'font';
      recommendation = 'preconnect';
    } else if (url.includes('api.') || url.includes('/api/')) {
      type = 'api';
      recommendation = 'dns-prefetch';
    } else if (url.includes('cdn.') || url.includes('jsdelivr') || url.includes('unpkg')) {
      type = 'cdn';
      recommendation = 'prefetch';
    } else if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(url)) {
      type = 'image';
      recommendation = 'prefetch';
    } else if (/\.(js|css)$/i.test(url)) {
      type = 'script';
      recommendation = 'prefetch';
    }
    
    resources.push({ url, type, recommendation });
  });
  
  return resources;
}
