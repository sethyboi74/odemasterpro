const { useState, useCallback, useMemo, useEffect, useRef } = React;

// Utility functions
const getFileType = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const typeMap = {
        'html': 'html',
        'htm': 'html', 
        'css': 'css',
        'js': 'js',
        'jsx': 'js',
        'ts': 'js',
        'tsx': 'js',
        'json': 'js',
        'xml': 'html',
        'php': 'html',
        'py': 'js',
        'java': 'js',
        'c': 'js',
        'cpp': 'js',
        'cs': 'js'
    };
    return typeMap[ext] || 'text';
};

const analyzeExternalResources = (content) => {
    const resources = [];
    const uniqueUrls = new Set();
    
    const patterns = [
        /(?:src|href|url)\s*=\s*["']([^"'\s]+)["']/gi,
        /url\(["']?([^"'\)\s]+)["']?\)/gi,
        /https?:\/\/[^\s"'<>\)\}]+/gi,
        /import\s+[^\n]*from\s+["']([^"']+)["']/gi,
        /@import\s+["']([^"']+)["']/gi,
        /<link[^>]*\s(?:href)=["']([^"']+)["'][^>]*>/gi
    ];
    
    patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(content)) !== null) {
            const url = match[1] || match[0];
            if (url && url.startsWith('http') && !uniqueUrls.has(url)) {
                uniqueUrls.add(url);
                
                let type = 'cdn';
                let recommendation = 'prefetch';
                
                if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com') || 
                    url.includes('typekit.net') || url.includes('fonts.com') ||
                    /\.(woff|woff2|ttf|otf|eot)$/i.test(url)) {
                    type = 'font';
                    recommendation = 'preconnect';
                }
                else if (url.includes('api.') || url.includes('/api/') || 
                         url.includes('googleapis.com') && !url.includes('fonts') ||
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
                
                resources.push({ url, type, recommendation });
            }
        }
    });
    
    return resources.sort((a, b) => {
        const order = { 'preconnect': 0, 'dns-prefetch': 1, 'prefetch': 2 };
        return order[a.recommendation] - order[b.recommendation];
    });
};

const parseCSSFromFiles = (files) => {
    const rules = [];
    files.forEach(file => {
        if (file.type === 'css') {
            const cssRuleRegex = /([^{]+)\{([^}]+)\}/g;
            let match;
            
            while ((match = cssRuleRegex.exec(file.content)) !== null) {
                const selector = match[1].trim();
                const propertiesStr = match[2].trim();
                const properties = {};
                
                propertiesStr.split(';').forEach(prop => {
                    const [key, value] = prop.split(':').map(s => s.trim());
                    if (key && value) {
                        properties[key] = value;
                    }
                });
                
                const beforeMatch = file.content.substring(0, match.index);
                const startLine = beforeMatch.split('\n').length;
                const endLine = startLine + match[0].split('\n').length - 1;
                
                rules.push({
                    selector,
                    properties,
                    lineNumber: startLine,
                    endLineNumber: endLine,
                    source: file.name,
                    fileName: file.name
                });
            }
        }
        // Parse inline CSS from HTML files
        else if (file.type === 'html') {
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            let match;
            
            while ((match = styleRegex.exec(file.content)) !== null) {
                const cssContent = match[1];
                const styleTagStart = file.content.substring(0, match.index);
                const styleTagLineOffset = styleTagStart.split('\n').length;
                
                const cssRuleRegex = /([^{]+)\{([^}]+)\}/g;
                let cssMatch;
                
                while ((cssMatch = cssRuleRegex.exec(cssContent)) !== null) {
                    const selector = cssMatch[1].trim();
                    const propertiesStr = cssMatch[2].trim();
                    const properties = {};
                    
                    propertiesStr.split(';').forEach(prop => {
                        const [key, value] = prop.split(':').map(s => s.trim());
                        if (key && value) {
                            properties[key] = value;
                        }
                    });
                    
                    const beforeMatch = cssContent.substring(0, cssMatch.index);
                    const startLine = beforeMatch.split('\n').length;
                    const endLine = startLine + cssMatch[0].split('\n').length - 1;
                    
                    rules.push({
                        selector,
                        properties,
                        lineNumber: startLine + styleTagLineOffset,
                        endLineNumber: endLine + styleTagLineOffset,
                        source: `${file.name} (inline)`,
                        fileName: file.name
                    });
                }
            }
        }
    });
    return rules;
};

// Toast hook
const useToast = () => {
    return {
        toast: ({ title, description, variant }) => {
            const toastEl = document.createElement('div');
            toastEl.className = `toast fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-sm ${
                variant === 'destructive' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
            }`;
            toastEl.innerHTML = `
                <div class="font-semibold">${title}</div>
                <div class="text-sm opacity-90">${description}</div>
            `;
            document.body.appendChild(toastEl);
            setTimeout(() => {
                if (document.body.contains(toastEl)) {
                    document.body.removeChild(toastEl);
                }
            }, 3000);
        }
    };
};

// CSS Workshop Component
const CSSWorkshop = ({ files, onClose, onApply }) => {
    const [selectedRule, setSelectedRule] = useState('');
    const [editedCSS, setEditedCSS] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const [newCSSRule, setNewCSSRule] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);

    const cssRules = useMemo(() => parseCSSFromFiles(files), [files]);

    const handleRuleSelect = (rule) => {
        setIsCreatingNew(false);
        setNewCSSRule('');
        setSelectedRule(rule.selector);
        const cssText = `${rule.selector} {\n${Object.entries(rule.properties)
            .map(([prop, value]) => `  ${prop}: ${value};`)
            .join('\n')}\n}`;
        setEditedCSS(cssText);
        updatePreview(cssText);
    };

    const handleCreateNew = () => {
        setIsCreatingNew(true);
        setSelectedRule('');
        setEditedCSS('');
        setNewCSSRule('.new-rule {\n  /* Add your styles here */\n  color: #333;\n  background: #fff;\n}');
    };

    const updatePreview = (css) => {
        const previewHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Preview</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    ${css}
  </style>
</head>
<body>
  <div class="container">
    <h1>Preview Content</h1>
    <p>This is a sample paragraph to demonstrate your CSS.</p>
    <div class="hero">Hero Section</div>
    <div class="card">Card Component</div>
    <button class="btn">Sample Button</button>
  </div>
</body>
</html>`;
        
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        
        const blob = new Blob([previewHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
    };

    const handleApply = () => {
        const cssToApply = isCreatingNew ? newCSSRule : editedCSS;
        if (cssToApply.trim()) {
            onApply(cssToApply, isCreatingNew ? 'New CSS rule created' : `Updated ${selectedRule}`);
            onClose();
        }
    };

    useEffect(() => {
        if (editedCSS || newCSSRule) {
            updatePreview(editedCSS || newCSSRule);
        }
    }, [editedCSS, newCSSRule]);

    useEffect(() => {
        setSelectedRule('');
        setEditedCSS('');
        setNewCSSRule('');
        setIsCreatingNew(false);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl('');
        }
    }, [files]);

    return (
        <div className="workshop-overlay">
            <div className="max-w-6xl mx-auto my-8 h-[calc(100vh-4rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-palette text-2xl text-blue-400"></i>
                        <div>
                            <h2 className="text-lg font-bold text-white">CSS Workshop</h2>
                            <p className="text-sm text-gray-300">Edit and optimize your CSS styles</p>
                        </div>
                    </div>
                    <button 
                        className="p-2 hover:bg-gray-700 rounded-md transition-colors text-white"
                        onClick={onClose}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                    <div className="col-span-4 space-y-4">
                        <div className="tool-panel p-3">
                            <h3 className="text-sm font-semibold mb-3 text-white">CSS Rules</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {cssRules.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400 text-sm">
                                        No CSS rules found
                                    </div>
                                ) : (
                                    cssRules.map((rule, index) => (
                                        <div 
                                            key={index}
                                            className="p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700 transition-colors"
                                            onClick={() => handleRuleSelect(rule)}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="font-mono text-sm text-blue-400">{rule.selector}</div>
                                                <div className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded text-xs font-mono">
                                                    Line {rule.lineNumber}{ rule.endLineNumber !== rule.lineNumber ? `-${rule.endLineNumber}` : '' }
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {Object.keys(rule.properties).join(', ')}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                {rule.source}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="tool-panel p-3">
                            <div className="space-y-2">
                                <button 
                                    className="w-full btn-secondary px-3 py-2 rounded text-sm"
                                    onClick={handleCreateNew}
                                >
                                    ✨ Create New CSS Rule
                                </button>
                                <button 
                                    className="w-full btn-primary px-3 py-2 rounded text-sm"
                                    onClick={handleApply}
                                    disabled={!editedCSS && !newCSSRule}
                                >
                                    {isCreatingNew ? '📝 Add New CSS' : '🔄 Update Existing'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-8 space-y-4">
                        <div className="tool-panel h-80">
                            <div className="p-3 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-white">
                                    {isCreatingNew ? 'Create New CSS Rule' : 'CSS Rule Editor'}
                                </h4>
                            </div>
                            <div className="flex h-full">
                                <textarea 
                                    className="flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none text-white"
                                    placeholder={isCreatingNew ? "Enter new CSS rule..." : "Select a CSS rule to edit..."}
                                    value={isCreatingNew ? newCSSRule : editedCSS}
                                    onChange={(e) => isCreatingNew ? setNewCSSRule(e.target.value) : setEditedCSS(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="tool-panel">
                            <div className="p-3 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-white">Live Preview</h4>
                            </div>
                            <div className="h-40 bg-white">
                                {previewUrl ? (
                                    <iframe 
                                        src={previewUrl}
                                        className="w-full h-full border-0"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <div className="text-center">
                                            <i className="fas fa-eye-slash text-2xl mb-2"></i>
                                            <p className="text-sm">Select a CSS rule to preview</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Prefetch Workshop Component  
const PrefetchWorkshop = ({ files, onClose, onApply }) => {
    const [selectedResources, setSelectedResources] = useState([]);

    const detectedResources = useMemo(() => {
        const allContent = files.map(f => f.content).join('\n');
        return analyzeExternalResources(allContent);
    }, [files]);

    const generatedTags = useMemo(() => {
        return selectedResources.map(url => {
            const resource = detectedResources.find(r => r.url === url);
            if (!resource) return '';
            const crossorigin = resource.type === 'font' && resource.url.includes('gstatic') ? ' crossorigin' : '';
            return `<link rel="${resource.recommendation}" href="${resource.url}"${crossorigin}>`;
        }).join('\n');
    }, [selectedResources, detectedResources]);

    const performanceImpact = useMemo(() => {
        const dnsCount = selectedResources.filter(url => 
            detectedResources.find(r => r.url === url)?.recommendation === 'dns-prefetch'
        ).length;
        
        const fontCount = selectedResources.filter(url => 
            detectedResources.find(r => r.url === url)?.type === 'font'
        ).length;

        return {
            dnsTime: dnsCount * 80,
            fontTime: fontCount * 120,
            overallGain: Math.min(25, (dnsCount + fontCount) * 3)
        };
    }, [selectedResources, detectedResources]);

    const toggleResource = (url) => {
        setSelectedResources(prev => 
            prev.includes(url) 
                ? prev.filter(u => u !== url)
                : [...prev, url]
        );
    };

    const handleApply = () => {
        if (generatedTags.trim() && selectedResources.length > 0) {
            onApply(generatedTags, `Added ${selectedResources.length} prefetch optimizations`);
            onClose();
        }
    };

    const getResourceIcon = (type) => {
        switch (type) {
            case 'font': return 'fas fa-font text-blue-400';
            case 'api': return 'fas fa-server text-green-400';
            case 'cdn': return 'fas fa-cloud text-purple-400';
            case 'image': return 'fas fa-image text-yellow-400';
            case 'script': return 'fas fa-file-code text-green-400';
            default: return 'fas fa-link text-gray-400';
        }
    };

    const getRecommendationColor = (recommendation) => {
        switch (recommendation) {
            case 'preconnect': return 'bg-green-900 text-green-300';
            case 'dns-prefetch': return 'bg-blue-900 text-blue-300';
            case 'prefetch': return 'bg-purple-900 text-purple-300';
            default: return 'bg-gray-700 text-gray-300';
        }
    };

    useEffect(() => {
        setSelectedResources([]);
    }, [files]);

    return (
        <div className="workshop-overlay">
            <div className="max-w-6xl mx-auto my-8 h-[calc(100vh-4rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
                    <div className="flex items-center gap-3">
                        <i className="fas fa-link text-2xl text-blue-400"></i>
                        <div>
                            <h2 className="text-lg font-bold text-white">Prefetch Workshop</h2>
                            <p className="text-sm text-gray-300">Optimize resource loading with prefetch & preconnect</p>
                        </div>
                    </div>
                    <button 
                        className="p-2 hover:bg-gray-700 rounded-md transition-colors text-white"
                        onClick={onClose}
                    >
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
                    <div className="col-span-4 space-y-4">
                        <div className="tool-panel p-3">
                            <h3 className="text-sm font-semibold mb-3 text-white">Detected Resources</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {detectedResources.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400 text-sm">
                                        No external resources found
                                    </div>
                                ) : (
                                    detectedResources.map((resource, index) => (
                                        <div 
                                            key={index}
                                            className={`p-2 rounded cursor-pointer transition-colors ${
                                                selectedResources.includes(resource.url) 
                                                    ? 'bg-blue-900 border border-blue-600' 
                                                    : 'bg-gray-800 hover:bg-gray-700'
                                            }`}
                                            onClick={() => toggleResource(resource.url)}
                                        >
                                            <div className="flex items-center gap-2 mb-1">
                                                <i className={getResourceIcon(resource.type)}></i>
                                                <div className="text-sm font-mono text-blue-400 truncate">
                                                    {new URL(resource.url).hostname}
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-400 mb-1">
                                                {resource.type} resource - Recommend {resource.recommendation}
                                            </div>
                                            <div className="flex gap-1">
                                                <span className={`px-2 py-0.5 text-xs rounded ${getRecommendationColor(resource.recommendation)}`}>
                                                    {resource.recommendation}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="tool-panel p-3">
                            <h3 className="text-sm font-semibold mb-3 text-white">Actions</h3>
                            <div className="space-y-2">
                                <button 
                                    className="w-full btn-primary px-3 py-2 rounded text-sm"
                                    onClick={() => setSelectedResources(detectedResources.map(r => r.url))}
                                >
                                    Select All Suggestions
                                </button>
                                <button 
                                    className="w-full btn-secondary px-3 py-2 rounded text-sm"
                                    onClick={handleApply}
                                    disabled={selectedResources.length === 0}
                                >
                                    Apply to Code
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-8 space-y-4">
                        <div className="tool-panel">
                            <div className="p-3 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-white">Generated Prefetch Tags</h4>
                            </div>
                            <div className="p-3 font-mono text-sm bg-gray-800 h-40 overflow-auto">
                                {generatedTags ? (
                                    <div className="syntax-highlight whitespace-pre-wrap text-white">
                                        {generatedTags}
                                    </div>
                                ) : (
                                    <div className="text-gray-400">
                                        Select resources to generate prefetch tags
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="tool-panel">
                            <div className="p-3 border-b border-gray-700">
                                <h4 className="text-sm font-semibold text-white">Performance Impact</h4>
                            </div>
                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-400">
                                            -{performanceImpact.dnsTime}ms
                                        </div>
                                        <div className="text-xs text-gray-400">DNS Lookup Time</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-400">
                                            -{performanceImpact.fontTime}ms
                                        </div>
                                        <div className="text-xs text-gray-400">Font Load Time</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-400">
                                            +{performanceImpact.overallGain}%
                                        </div>
                                        <div className="text-xs text-gray-400">Overall Performance</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Main CodeMaster Hub Component
const CodeMasterHub = () => {
    const [files, setFiles] = useState([]);
    const [currentCode, setCurrentCode] = useState('');
    const [originalCode, setOriginalCode] = useState('');
    const [currentFilename, setCurrentFilename] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showOriginal, setShowOriginal] = useState(false);
    const [previewUrl, setPreviewUrl] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [activeWorkshop, setActiveWorkshop] = useState(null);
    
    const fileInputRef = useRef(null);
    const mainEditorRef = useRef(null);
    const { toast } = useToast();

    const handleFilesUploaded = useCallback(async (uploadedFiles) => {
        const fileArray = Array.from(uploadedFiles);
        const newFiles = [];
        
        for (const file of fileArray) {
            const content = await file.text();
            const projectFile = {
                id: Date.now().toString() + Math.random(),
                name: file.name,
                content,
                type: getFileType(file.name),
                size: file.size
            };
            newFiles.push(projectFile);
        }
        
        setFiles(prev => [...prev, ...newFiles]);
        
        if (newFiles.length > 0) {
            setCurrentCode(newFiles[0].content);
            setCurrentFilename(newFiles[0].name);
            setOriginalCode(newFiles[0].content);
            setShowOriginal(true);
        }
        
        toast({
            title: 'Files Loaded',
            description: `${newFiles.length} file(s) added to project`
        });
    }, [toast]);

    const focusOnLine = useCallback((lineNumber) => {
        if (!mainEditorRef.current) return;
        
        const textarea = mainEditorRef.current;
        const lines = currentCode.split('\n');
        
        let charPosition = 0;
        for (let i = 0; i < lineNumber - 1; i++) {
            charPosition += lines[i].length + 1;
        }
        
        textarea.focus();
        textarea.setSelectionRange(charPosition, charPosition + lines[lineNumber - 1].length);
        
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
        textarea.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
        
        textarea.style.transition = 'background-color 0.3s';
        const originalBg = textarea.style.backgroundColor;
        textarea.style.backgroundColor = 'rgba(88, 166, 255, 0.1)';
        setTimeout(() => {
            textarea.style.backgroundColor = originalBg;
        }, 1000);
    }, [currentCode]);

    const performSearch = useCallback(() => {
        if (!searchTerm.trim() || !currentCode) {
            setSearchResults([]);
            return;
        }
        
        const lines = currentCode.split('\n');
        const results = [];
        
        lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
                results.push({
                    line: index + 1,
                    content: line
                });
            }
        });
        
        setSearchResults(results);
        
        if (results.length === 0) {
            toast({
                title: 'Search Complete',
                description: 'No matches found',
                variant: 'destructive'
            });
        } else {
            if (results.length > 0) {
                setTimeout(() => focusOnLine(results[0].line), 100);
            }
            
            toast({
                title: 'Search Complete',
                description: `Found ${results.length} matches`
            });
        }
    }, [searchTerm, currentCode, toast, focusOnLine]);

    const refreshPreview = () => {
        if (currentCode && showPreview) {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            
            const blob = new Blob([currentCode], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        }
    };

    const togglePreview = () => {
        setShowPreview(prev => {
            const newShowPreview = !prev;
            if (newShowPreview && currentCode) {
                refreshPreview();
            }
            return newShowPreview;
        });
    };

    const handleWorkshopApply = (code, summary) => {
        // Insert the generated code into the current editor
        const insertPosition = currentCode.lastIndexOf('</head>');
        if (insertPosition > -1) {
            const newCode = currentCode.slice(0, insertPosition) + '\n    ' + code + '\n' + currentCode.slice(insertPosition);
            setCurrentCode(newCode);
        } else {
            // Fallback: append to end
            setCurrentCode(prev => prev + '\n\n' + code);
        }
        
        toast({
            title: 'Code Applied',
            description: summary
        });
    };

    const runFileCode = () => {
        if (files.length === 0) {
            toast({
                title: 'No Files',
                description: 'Please upload files first',
                variant: 'destructive'
            });
            return;
        }
        
        setOriginalCode(currentCode);
        setShowOriginal(true);
        
        toast({
            title: 'Analysis Complete',
            description: `Analyzed ${files.length} files`
        });
    };

    const resetProject = () => {
        setFiles([]);
        setCurrentCode('');
        setOriginalCode('');
        setCurrentFilename('');
        setSearchTerm('');
        setSearchResults([]);
        setShowOriginal(false);
        
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl('');
        }
        setShowPreview(false);
        
        toast({
            title: 'Project Reset',
            description: 'All files and changes cleared'
        });
    };

    useEffect(() => {
        if (showPreview && currentCode) {
            refreshPreview();
        }
    }, [currentCode]);

    return (
        <div className="min-h-screen gradient-bg">
            <div className="glass-effect border-b sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                CM
                            </div>
                            <div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                                    CodeMaster Pro
                                </h1>
                                <p className="text-xs text-gray-400">Code Analysis & Development Hub - Local Version</p>
                            </div>
                        </div>
                        
                        <nav className="flex items-center gap-2">
                            <button className="px-3 py-2 text-sm rounded-md bg-blue-600 text-white">
                                🏠 CodeMaster Pro
                            </button>
                            <button 
                                className="px-3 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                                onClick={() => setActiveWorkshop('css')}
                            >
                                🎨 CSS Standardizer
                            </button>
                            <button 
                                className="px-3 py-2 text-sm rounded-md bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                                onClick={() => setActiveWorkshop('prefetch')}
                            >
                                🚀 Prefetch Inspector
                            </button>
                            <button 
                                className="px-3 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 transition-colors text-white"
                                onClick={resetProject}
                            >
                                🔄 Reset
                            </button>
                        </nav>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-12 gap-6 h-[calc(100vh-10rem)]">
                    {/* Left Panel */}
                    <div className="col-span-4 space-y-6 overflow-y-auto">
                        {/* Upload Section */}
                        <div className="tool-panel p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fas fa-upload text-sm text-gray-400"></i>
                                <h3 className="text-sm font-semibold text-white">Project Files</h3>
                            </div>
                            
                            <div 
                                className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer mb-3"
                                onClick={() => fileInputRef.current?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleFilesUploaded(e.dataTransfer.files);
                                }}
                            >
                                <i className="fas fa-cloud-upload-alt text-2xl text-gray-400 mb-2"></i>
                                <p className="text-sm text-gray-300">Drag & drop files here</p>
                                <p className="text-xs text-gray-500">or click to browse</p>
                            </div>
                            
                            <input
                                type="file"
                                ref={fileInputRef}
                                multiple
                                className="hidden"
                                onChange={(e) => handleFilesUploaded(e.target.files)}
                            />
                            
                            {files.length > 0 && (
                                <div className="space-y-1">
                                    {files.map((file, index) => (
                                        <div key={index} className="text-xs p-2 bg-gray-800 rounded text-gray-300">
                                            <span className="font-mono">{file.name}</span>
                                            <span className="text-gray-500 ml-2">({file.type})</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search Section */}
                        <div className="tool-panel p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fas fa-search text-sm text-gray-400"></i>
                                <h3 className="text-sm font-semibold text-white">Search & Focus</h3>
                            </div>
                            
                            <div className="relative mb-3">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                                    placeholder="Search code..."
                                    className="w-full px-3 py-2 text-xs bg-gray-800 border border-gray-600 rounded-md font-mono text-white placeholder-gray-400"
                                />
                                <button
                                    onClick={performSearch}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-700 rounded text-gray-400"
                                >
                                    <i className="fas fa-search text-xs"></i>
                                </button>
                            </div>
                            
                            <div className="flex gap-2 mb-3">
                                <button 
                                    className="flex-1 px-3 py-1 text-xs btn-primary rounded"
                                    onClick={performSearch}
                                >
                                    🔍 Search
                                </button>
                                <button 
                                    className="flex-1 px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors text-white"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setSearchResults([]);
                                    }}
                                >
                                    🗑️ Clear
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="bg-gray-800 border border-gray-600 rounded-md max-h-48 overflow-y-auto">
                                    {searchResults.map((result, index) => (
                                        <div 
                                            key={index}
                                            className="flex items-center gap-2 p-2 border-b border-gray-700 last:border-b-0 hover:bg-gray-700 cursor-pointer text-xs"
                                            onClick={() => focusOnLine(result.line)}
                                        >
                                            <div className="bg-purple-900 text-purple-300 px-2 py-0.5 rounded text-xs font-mono min-w-12 text-center">
                                                {result.line}
                                            </div>
                                            <div className="flex-1 font-mono text-gray-300 truncate">
                                                {result.content.trim()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="tool-panel p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <i className="fas fa-cogs text-sm text-gray-400"></i>
                                <h3 className="text-sm font-semibold text-white">Actions</h3>
                            </div>
                            
                            <div className="space-y-2">
                                <button 
                                    className="w-full btn-primary px-3 py-2 rounded text-sm"
                                    onClick={runFileCode}
                                >
                                    🔄 Run File Code
                                </button>
                                <button 
                                    className="px-3 py-1.5 rounded text-xs bg-gray-700 hover:bg-gray-600 transition-colors text-white"
                                    onClick={togglePreview}
                                >
                                    👁️ {showPreview ? 'Hide' : 'Show'} Preview
                                </button>
                                <button 
                                    className="px-3 py-1.5 rounded text-xs bg-gray-600 hover:bg-gray-500 transition-colors text-white"
                                    onClick={refreshPreview}
                                >
                                    🔄 Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="col-span-8 flex flex-col gap-4">
                        {/* Code Editor */}
                        <div className="tool-panel flex-1">
                            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-white">Project Code Window</h4>
                                <div className="text-xs text-gray-400">
                                    {currentFilename && `${currentFilename} (${currentCode.split('\n').length} lines)`}
                                </div>
                            </div>
                            <div className="flex h-full">
                                <div className="w-12 bg-gray-800 text-right px-2 py-3 text-xs text-gray-400 font-mono border-r border-gray-700">
                                    {Array.from({ length: Math.max(20, currentCode.split('\n').length) }, (_, i) => (
                                        <div key={i + 1} className="leading-5">{i + 1}</div>
                                    ))}
                                </div>
                                <textarea
                                    ref={mainEditorRef}
                                    value={currentCode}
                                    onChange={(e) => setCurrentCode(e.target.value)}
                                    placeholder="Start coding here or upload files..."
                                    className="flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none text-white placeholder-gray-400"
                                    spellCheck="false"
                                />
                            </div>
                        </div>

                        {/* Bottom Panel */}
                        <div className="flex gap-4" style={{height: '250px'}}>
                            {/* Original Code */}
                            {showOriginal && (
                                <div className="tool-panel flex-1">
                                    <div className="p-3 border-b border-gray-700">
                                        <h4 className="text-sm font-semibold text-white">Original Code</h4>
                                    </div>
                                    <div className="flex h-full">
                                        <div className="w-12 bg-gray-800 text-right px-2 py-3 text-xs text-gray-400 font-mono border-r border-gray-700">
                                            {Array.from({ length: Math.max(10, originalCode.split('\n').length) }, (_, i) => (
                                                <div key={i + 1} className="leading-5">{i + 1}</div>
                                            ))}
                                        </div>
                                        <div className="flex-1 p-3 text-sm font-mono text-gray-300 bg-gray-800 overflow-auto">
                                            <pre className="whitespace-pre-wrap">{originalCode}</pre>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Live Preview */}
                            {showPreview && (
                                <div className="tool-panel flex-1">
                                    <div className="p-3 border-b border-gray-700">
                                        <h4 className="text-sm font-semibold text-white">Live Preview</h4>
                                    </div>
                                    <div className="h-full bg-white">
                                        {previewUrl ? (
                                            <iframe 
                                                src={previewUrl}
                                                className="w-full h-full border-0"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-500">
                                                <div className="text-center">
                                                    <i className="fas fa-eye-slash text-2xl mb-2"></i>
                                                    <p className="text-sm">No content to preview</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Workshop Overlays */}
            {activeWorkshop === 'css' && (
                <CSSWorkshop 
                    files={files}
                    onClose={() => setActiveWorkshop(null)}
                    onApply={handleWorkshopApply}
                />
            )}
            
            {activeWorkshop === 'prefetch' && (
                <PrefetchWorkshop 
                    files={files}
                    onClose={() => setActiveWorkshop(null)}
                    onApply={handleWorkshopApply}
                />
            )}
        </div>
    );
};

// Render the app
ReactDOM.render(<CodeMasterHub />, document.getElementById('root'));