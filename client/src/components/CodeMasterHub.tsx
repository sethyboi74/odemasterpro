import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import OverlaySystem from './OverlaySystem';
import { useOverlay } from '@/hooks/useOverlay';
import { useWorkshopMessage } from '@/hooks/useWorkshopMessage';
import type { ProjectFile, AnalysisChange, ProjectStats, WorkshopMessage } from '@/types/workshop';

type TemplateType = 'html5' | 'basic' | 'css' | 'js';
type ViewMode = 'project' | 'original' | 'diff';

export default function CodeMasterHub() {
  const { toast } = useToast();
  const { currentOverlay, openOverlay, closeOverlay } = useOverlay();
  
  // Core state
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [originalCode, setOriginalCode] = useState<string>('');
  const [changes, setChanges] = useState<AnalysisChange[]>([]);
  const [currentFilename, setCurrentFilename] = useState<string>('');
  
  // UI state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('html5');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{line: number, content: string}>>([]);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState<boolean>(false);
  
  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolInputRef = useRef<HTMLInputElement>(null);
  const mainEditorRef = useRef<HTMLTextAreaElement>(null);
  
  // Stats computation
  const stats = useMemo(() => {
    const lineCount = currentCode.split('\n').length;
    const charCount = currentCode.length;
    return {
      filesLoaded: files.length,
      linesAnalyzed: lineCount,
      changesCount: changes.length
    };
  }, [files.length, currentCode, changes.length]);

  // Workshop communication
  const handleWorkshopMessage = useCallback((message: WorkshopMessage) => {
    console.log('Workshop message:', message);
    
    switch (message.type) {
      case 'WORKSHOP_READY':
        toast({
          title: 'Workshop Ready',
          description: `${message.workshopId} workshop is connected`
        });
        break;
        
      case 'WORKSHOP_APPLY_PATCH':
        if (message.data?.code) {
          setOriginalCode(currentCode); // Store current as original
          setCurrentCode(message.data.code);
          setShowOriginal(true);
          setShowDiff(true);
          setChanges(prev => [...prev, {
            id: Date.now().toString(),
            type: 'modified',
            line: 0,
            content: 'Code updated by workshop',
            tool: message.workshopId || 'unknown',
            description: message.data.summary || 'Code modified'
          }]);
        }
        break;
    }
  }, [toast, currentCode]);

  const { sendMessage } = useWorkshopMessage(handleWorkshopMessage);

  // Template definitions
  const templates = {
    html5: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    <h1>Hello World</h1>
</body>
</html>`,
    basic: `<html>
<head>
    <title>Basic HTML</title>
</head>
<body>
    <h1>Basic HTML Document</h1>
</body>
</html>`,
    css: `/* CSS Stylesheet */
body {
    margin: 0;
    padding: 20px;
    font-family: Arial, sans-serif;
    background-color: #f5f5f5;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    padding: 20px;
    border-radius: 8px;
}`,
    js: `// JavaScript Code
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded');
    
    // Your code here
    const button = document.querySelector('button');
    if (button) {
        button.addEventListener('click', function() {
            alert('Button clicked!');
        });
    }
});`
  };

  // File operations
  const handleFilesUploaded = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: ProjectFile[] = [];
    
    for (const file of fileArray) {
      const content = await file.text();
      const projectFile: ProjectFile = {
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
      // Auto-populate original code window as well
      setOriginalCode(newFiles[0].content);
      setShowOriginal(true);
      setShowDiff(false);
    }
    
    toast({
      title: 'Files Loaded',
      description: `${newFiles.length} file(s) added to project`
    });
  }, [toast]);

  // Template loading
  const loadTemplate = useCallback((templateType: TemplateType) => {
    setCurrentCode(templates[templateType]);
    setCurrentFilename(`template.${templateType === 'js' ? 'js' : templateType === 'css' ? 'css' : 'html'}`);
    setOriginalCode('');
    setShowOriginal(false);
    setShowDiff(false);
    
    toast({
      title: 'Template Loaded',
      description: `${templateType.toUpperCase()} template loaded`
    });
  }, [toast]);

  // Enhanced search with auto-focus
  const focusOnLine = useCallback((lineNumber: number) => {
    if (!mainEditorRef.current) return;
    
    const textarea = mainEditorRef.current;
    const lines = currentCode.split('\n');
    
    // Calculate character position for the line
    let charPosition = 0;
    for (let i = 0; i < lineNumber - 1; i++) {
      charPosition += lines[i].length + 1; // +1 for newline character
    }
    
    // Focus and select the line
    textarea.focus();
    textarea.setSelectionRange(charPosition, charPosition + lines[lineNumber - 1].length);
    
    // Scroll to the line
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 20;
    textarea.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight);
    
    // Add temporary highlight effect
    textarea.style.transition = 'background-color 0.3s';
    const originalBg = textarea.style.backgroundColor;
    textarea.style.backgroundColor = 'rgba(88, 166, 255, 0.1)';
    setTimeout(() => {
      textarea.style.backgroundColor = originalBg;
    }, 1000);
  }, [currentCode]);

  // Search functionality  
  const performSearch = useCallback(() => {
    if (!searchTerm.trim() || !currentCode) {
      setSearchResults([]);
      return;
    }
    
    const lines = currentCode.split('\n');
    const results: Array<{line: number, content: string}> = [];
    
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
      // Auto-focus on first result
      if (results.length > 0) {
        setTimeout(() => focusOnLine(results[0].line), 100);
      }
      
      toast({
        title: 'Search Complete',
        description: `Found ${results.length} matches`
      });
    }
  }, [searchTerm, currentCode, toast, focusOnLine]);

  // Auto-refresh preview when code changes
  useEffect(() => {
    if (showPreview && currentCode) {
      // Clean up old URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      // Create new preview URL
      const blob = new Blob([currentCode], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    }
  }, [currentCode, showPreview]);

  // Manual preview refresh
  const refreshPreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    const blob = new Blob([currentCode], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    
    if (!showPreview) {
      setShowPreview(true);
    }
  }, [currentCode, showPreview, previewUrl]);

  // Preview management
  const togglePreview = useCallback(() => {
    if (!showPreview) {
      const blob = new Blob([currentCode], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } else {
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    }
  }, [currentCode, showPreview, previewUrl]);

  // Tool actions
  const runSpacingTool = useCallback(async () => {
    if (!currentCode) {
      toast({
        title: 'No Code',
        description: 'Please load a file first',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { spacingTool } = await import('@/lib/spacingTool');
      const result = await spacingTool.run(currentCode, { filename: currentFilename });
      
      setOriginalCode(currentCode);
      setCurrentCode(result.code);
      setShowOriginal(true);
      setShowDiff(true);
      
      setChanges(prev => [...prev, {
        id: Date.now().toString(),
        type: 'modified',
        line: 0,
        content: result.summary,
        tool: 'Spacing Tool',
        description: result.summary
      }]);
      
      toast({
        title: 'Spacing Applied',
        description: result.summary
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply spacing tool',
        variant: 'destructive'
      });
    }
  }, [currentCode, currentFilename, toast]);

  const runFileCode = useCallback(() => {
    if (files.length === 0) {
      toast({
        title: 'No Files',
        description: 'Please upload files first',
        variant: 'destructive'
      });
      return;
    }
    
    // Simulate analysis
    setOriginalCode(currentCode);
    setShowOriginal(true);
    
    toast({
      title: 'Analysis Complete',
      description: `Analyzed ${files.length} files`
    });
  }, [files.length, currentCode, toast]);

  const resetProject = useCallback(() => {
    setFiles([]);
    setCurrentCode('');
    setOriginalCode('');
    setCurrentFilename('');
    setChanges([]);
    setShowOriginal(false);
    setShowDiff(false);
    setSearchTerm('');
    setSearchResults([]);
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
    setShowPreview(false);
    
    toast({
      title: 'Project Reset',
      description: 'All files and changes cleared'
    });
  }, [previewUrl, toast]);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Toolbar Header - matching original */}
      <div className="glass-effect border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Brand */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-lg">
                CM
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  CodeMaster Pro
                </h1>
                <p className="text-xs text-muted-foreground">Code Analysis & Development Hub</p>
              </div>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center gap-2">
              <button className="px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground">
                🏠 CodeMaster Pro
              </button>
              <button 
                className="px-3 py-2 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => openOverlay('css-workshop')}
                data-testid="button-css-workshop"
              >
                🎨 CSS Standardizer
              </button>
              <button 
                className="px-3 py-2 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => openOverlay('prefetch-workshop')}
                data-testid="button-prefetch-workshop"
              >
                🔗 Prefetch/Preconnect
              </button>
            </nav>

            {/* Stats */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 text-xs bg-muted/50 rounded-full">
                <span data-testid="text-lines-count">Lines: {stats.linesAnalyzed}</span>
              </div>
              <div className="px-3 py-1 text-xs bg-muted/50 rounded-full">
                <span data-testid="text-char-count">Chars: {currentCode.length}</span>
              </div>
              <div className="px-3 py-1 text-xs bg-muted/50 rounded-full">
                <span data-testid="text-changes-count">Changes: {stats.changesCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Original Layout */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Panel - 400px equivalent */}
          <aside className="col-span-4 space-y-6">
            {/* Code Workshop Panel */}
            <div className="tool-panel p-5">
              <div className="flex items-center gap-3 mb-5">
                <i className="fas fa-star text-primary text-lg"></i>
                <h2 className="text-lg font-semibold">Code Workshop</h2>
              </div>

              {/* Template Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-file text-sm text-muted-foreground"></i>
                  <h3 className="text-sm font-semibold">Document Templates</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(['html5', 'basic', 'css', 'js'] as TemplateType[]).map((template) => (
                    <button 
                      key={template}
                      className={`p-3 rounded-md text-center transition-colors text-xs ${
                        selectedTemplate === template 
                          ? 'bg-primary/20 border border-primary/30 text-primary' 
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedTemplate(template)}
                      data-testid={`template-${template}`}
                    >
                      <div className="text-lg mb-1">
                        {template === 'html5' ? '🌍' : template === 'basic' ? '📄' : 
                         template === 'css' ? '🎨' : '⚡'}
                      </div>
                      {template.toUpperCase()}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-2">
                  <button 
                    className="btn-secondary px-3 py-1.5 rounded text-xs flex items-center gap-1"
                    onClick={() => loadTemplate(selectedTemplate)}
                    data-testid="button-load-template"
                  >
                    <i className="fas fa-scroll text-xs"></i>
                    Load Template
                  </button>
                  <button 
                    className="px-3 py-1.5 rounded text-xs bg-muted hover:bg-muted/80 transition-colors"
                    onClick={() => setCurrentCode('')}
                    data-testid="button-clear-editor"
                  >
                    <i className="fas fa-trash text-xs"></i>
                    Clear
                  </button>
                </div>
              </div>

              {/* Search Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-search text-sm text-muted-foreground"></i>
                  <h3 className="text-sm font-semibold">Enhanced Search & Focus</h3>
                </div>
                
                <div className="relative mb-3">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && performSearch()}
                    placeholder="Search code (multi-line supported)..."
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-md font-mono"
                    data-testid="input-search"
                  />
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                    {searchTerm && (
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSearchResults([]);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-600 hover:text-red-800 bg-red-50 border border-red-200 font-bold"
                        data-testid="button-clear-search-x"
                        title="Clear search"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      onClick={performSearch}
                      className="p-1 hover:bg-muted/50 rounded"
                      data-testid="button-search"
                      title="Search"
                    >
                      <i className="fas fa-search text-xs text-muted-foreground"></i>
                    </button>
                  </div>
                </div>
                
                {/* Search control buttons */}
                <div className="flex gap-2 mb-3">
                  <button 
                    className="flex-1 px-3 py-1 text-xs bg-primary hover:bg-primary/80 text-primary-foreground rounded transition-colors"
                    onClick={performSearch}
                    data-testid="button-search-main"
                  >
                    🔍 Search
                  </button>
                  <button 
                    className="flex-1 px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                    onClick={() => {
                      setSearchTerm('');
                      setSearchResults([]);
                    }}
                    data-testid="button-clear-search"
                  >
                    🗑️ Clear
                  </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="bg-background border border-border rounded-md max-h-48 overflow-y-auto">
                    {searchResults.map((result, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 p-2 border-b border-border last:border-b-0 hover:bg-secondary cursor-pointer text-xs transition-colors"
                        onClick={() => focusOnLine(result.line)}
                        data-testid={`search-result-${index}`}
                      >
                        <div className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-mono min-w-12 text-center">
                          {result.line}
                        </div>
                        <div className="flex-1 font-mono text-muted-foreground truncate">
                          {result.content.trim()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* File Operations Section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-download text-sm text-muted-foreground"></i>
                  <h3 className="text-sm font-semibold">File Operations</h3>
                </div>
                
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer mb-3"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFilesUploaded(e.dataTransfer.files);
                  }}
                  data-testid="upload-area"
                >
                  <i className="fas fa-folder text-xl text-primary mb-2"></i>
                  <div className="text-sm font-medium mb-1">Drop file or click</div>
                  <div className="text-xs text-muted-foreground">HTML, CSS, JS, TXT files</div>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    multiple 
                    accept=".html,.css,.js,.txt,.htm"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFilesUploaded(e.target.files)}
                    data-testid="input-file-upload"
                  />
                </div>

                {/* Loaded Files */}
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs">
                      <span className="flex items-center gap-2">
                        <i className={getFileIcon(file.type)}></i>
                        {file.name}
                      </span>
                      <button 
                        onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                        className="text-muted-foreground hover:text-foreground"
                        data-testid={`button-remove-file-${file.id}`}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Run File Code Button */}
                {files.length > 0 && (
                  <button 
                    className="w-full btn-primary px-3 py-2 rounded text-sm mb-2"
                    onClick={runFileCode}
                    data-testid="button-run-file-code"
                  >
                    <i className="fas fa-play mr-2"></i>
                    Run File Code
                  </button>
                )}

                {/* Download Section */}
                <div className="mb-3">
                  <button 
                    className="w-full btn-primary px-3 py-2 rounded text-sm flex items-center justify-center gap-2"
                    onClick={() => {
                      const blob = new Blob([currentCode], { type: 'text/html' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = currentFilename || 'modified-code.html';
                      a.click();
                      URL.revokeObjectURL(url);
                      toast({
                        title: 'Download Complete',
                        description: `Downloaded ${currentFilename || 'modified-code.html'}`
                      });
                    }}
                    disabled={!currentCode}
                    data-testid="button-download-current"
                  >
                    <i className="fas fa-download"></i>
                    Download Current Code
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button 
                    className="btn-secondary px-2 py-1.5 rounded text-xs flex items-center justify-center"
                    onClick={togglePreview}
                    data-testid="button-live-preview"
                    title="Toggle Live Preview"
                  >
                    <i className="fas fa-eye"></i>
                  </button>
                  <button 
                    className="bg-accent/20 hover:bg-accent/30 text-accent px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-center"
                    onClick={() => {
                      if (files.length === 0) {
                        toast({
                          title: 'No Files',
                          description: 'Upload files first to download as ZIP',
                          variant: 'destructive'
                        });
                        return;
                      }
                      
                      // Create a simple ZIP-like structure as text file
                      const allFilesContent = files.map(file => 
                        `=== ${file.name} ===\n${file.content}\n\n`
                      ).join('');
                      
                      const blob = new Blob([allFilesContent], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'codemaster-project-files.txt';
                      a.click();
                      URL.revokeObjectURL(url);
                      
                      toast({
                        title: 'Project Downloaded',
                        description: `Downloaded ${files.length} files as text archive`
                      });
                    }}
                    data-testid="button-download-all"
                    title="Download All Files"
                  >
                    <i className="fas fa-file-archive"></i>
                  </button>
                  <button 
                    className="bg-muted hover:bg-muted/80 px-2 py-1.5 rounded text-xs transition-colors flex items-center justify-center"
                    onClick={resetProject}
                    data-testid="button-reset"
                    title="Reset Project"
                  >
                    <i className="fas fa-undo"></i>
                  </button>
                </div>
              </div>

              {/* Tools Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <i className="fas fa-tools text-sm text-muted-foreground"></i>
                  <h3 className="text-sm font-semibold">Process with Tools</h3>
                </div>

                <div className="space-y-2">
                  {/* Built-in spacing tool */}
                  <div className="p-2 bg-secondary/10 border border-secondary/30 rounded-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-align-left text-secondary text-sm"></i>
                        <div>
                          <div className="text-xs font-medium">Spacing Formatter</div>
                          <div className="text-xs text-muted-foreground">v1.0.5 - Ready</div>
                        </div>
                      </div>
                      <button 
                        className="btn-secondary px-2 py-1 rounded text-xs"
                        onClick={runSpacingTool}
                        data-testid="button-run-spacing-tool"
                      >
                        Run
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Right Panel - Code Editor & Preview */}
          <main className="col-span-8 space-y-6">
            {/* Main Code Editor */}
            <div className="code-window rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Project Code
                </h3>
                <div className="flex gap-2">
                  <button className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors">
                    🎯 Format
                  </button>
                  <button className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors">
                    🔄 Refresh
                  </button>
                </div>
              </div>
              <div className="flex h-96">
                <div className="w-16 bg-muted/20 text-right px-2 py-3 text-xs text-muted-foreground font-mono border-r border-border overflow-hidden">
                  {currentCode.split('\n').map((_, index) => (
                    <div key={index} className="leading-5">{index + 1}</div>
                  ))}
                </div>
                <textarea
                  ref={mainEditorRef}
                  value={currentCode}
                  onChange={(e) => setCurrentCode(e.target.value)}
                  placeholder="Start coding here or load a template..."
                  className="flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none"
                  spellCheck="false"
                  data-testid="textarea-main-editor"
                />
              </div>
            </div>

            {/* Original Code Section - Show when original exists */}
            {showOriginal && originalCode && (
              <div className="code-window rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Original Code
                  </h3>
                </div>
                <div className="flex h-64">
                  <div className="w-16 bg-muted/20 text-right px-2 py-3 text-xs text-muted-foreground font-mono border-r border-border overflow-hidden">
                    {originalCode.split('\n').map((_, index) => (
                      <div key={index} className="leading-5">{index + 1}</div>
                    ))}
                  </div>
                  <div className="flex-1 p-3 text-sm font-mono whitespace-pre overflow-auto">
                    {originalCode}
                  </div>
                </div>
              </div>
            )}

            {/* Diff Section - Show when changes exist */}
            {showDiff && changes.length > 0 && (
              <div className="code-window rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Diff Preview
                  </h3>
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors">
                      🧩 Show Diff
                    </button>
                    <button 
                      className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                      onClick={() => setShowDiff(false)}
                    >
                      🧹 Clear
                    </button>
                  </div>
                </div>
                <div className="p-3 h-56 overflow-auto">
                  <div className="space-y-2">
                    {changes.slice(-5).map((change) => (
                      <div key={change.id} className={`p-2 rounded text-sm diff-${change.type}`}>
                        <div className="font-mono font-medium">
                          {change.tool}: {change.content}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {change.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Large Live Preview - 900px height like original */}
            <div className="code-window rounded-lg overflow-hidden h-[900px]">
              <div className="bg-muted/30 px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <span className="text-sm text-muted-foreground">HTML Preview</span>
                </div>
                <div className="flex gap-2">
                  <button 
                    className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                    onClick={togglePreview}
                    data-testid="button-toggle-preview"
                  >
                    👁️ {showPreview ? 'Hide' : 'Show'} Preview
                  </button>
                  <button 
                    className="px-3 py-1 text-xs bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded transition-colors"
                    onClick={refreshPreview}
                    data-testid="button-refresh-preview"
                  >
                    🔄 Refresh
                  </button>
                  {previewUrl && (
                    <button 
                      className="btn-primary px-3 py-1 text-xs rounded"
                      onClick={() => window.open(previewUrl, '_blank')}
                      data-testid="button-open-new-tab"
                    >
                      🔗 New Tab
                    </button>
                  )}
                </div>
              </div>
              <div className="h-full bg-white">
                {showPreview && previewUrl ? (
                  <iframe 
                    src={previewUrl}
                    className="w-full h-full border-0"
                    data-testid="iframe-live-preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <i className="fas fa-eye-slash text-4xl mb-4"></i>
                      <p className="text-lg">Click "Show Preview" to display your code</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Overlay System */}
      <OverlaySystem
        currentOverlay={currentOverlay}
        onClose={closeOverlay}
        files={files}
        sendMessage={sendMessage}
      />
    </div>
  );
}

// Utility functions
function getFileType(filename: string): 'html' | 'css' | 'js' | 'json' {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return 'js';
    case 'json':
      return 'json';
    default:
      return 'html';
  }
}

function getFileIcon(type: string): string {
  switch (type) {
    case 'html': return 'fab fa-html5 text-orange-500';
    case 'css': return 'fab fa-css3 text-blue-500'; 
    case 'js': return 'fab fa-js text-yellow-500';
    case 'json': return 'fas fa-file-code text-green-500';
    default: return 'fas fa-file text-gray-500';
  }
}
