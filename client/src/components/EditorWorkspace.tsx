import { useState, useMemo } from 'react';
import type { AnalysisChange } from '@/types/workshop';

interface EditorWorkspaceProps {
  currentCode: string;
  changes: AnalysisChange[];
  onCodeChange: (code: string) => void;
}

export default function EditorWorkspace({ currentCode, changes, onCodeChange }: EditorWorkspaceProps) {
  const [viewMode, setViewMode] = useState<'original' | 'modified' | 'diff'>('original');
  const [showPreview, setShowPreview] = useState(false);

  const previewUrl = useMemo(() => {
    if (!currentCode || !showPreview) return '';
    
    const blob = new Blob([currentCode], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [currentCode, showPreview]);

  const lineNumbers = useMemo(() => {
    const lines = currentCode.split('\n');
    return Array.from({ length: Math.max(25, lines.length) }, (_, i) => i + 1);
  }, [currentCode]);

  const syntaxHighlight = (code: string) => {
    return code
      .replace(/(&lt;\/?)(\w+)/g, '<span class="tag">$1$2</span>')
      .replace(/(\w+)=/g, '<span class="attribute">$1</span>=')
      .replace(/"([^"]*)"/g, '<span class="string">"$1"</span>')
      .replace(/\/\*.*?\*\//g, '<span class="comment">$&</span>')
      .replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
  };

  return (
    <section className="col-span-9 space-y-4">
      {/* Editor Tabs and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex bg-muted/20 rounded-lg p-1">
            <button 
              className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'original' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 transition-colors'}`}
              onClick={() => setViewMode('original')}
              data-testid="button-view-original"
            >
              Original
            </button>
            <button 
              className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'modified' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 transition-colors'}`}
              onClick={() => setViewMode('modified')}
              data-testid="button-view-modified"
            >
              Modified
            </button>
            <button 
              className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'diff' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted/50 transition-colors'}`}
              onClick={() => setViewMode('diff')}
              data-testid="button-view-diff"
            >
              Diff View
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="px-3 py-1.5 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
            data-testid="button-find-focus"
          >
            <i className="fas fa-search"></i>
            Find & Focus
          </button>
          <button 
            className="px-3 py-1.5 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
            onClick={() => setShowPreview(!showPreview)}
            data-testid="button-live-preview"
          >
            <i className="fas fa-eye"></i>
            Live Preview
          </button>
        </div>
      </div>

      {/* Main Code Editor */}
      <div className="tool-panel h-96 flex overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 bg-muted/30 text-right px-2 py-3 text-xs text-muted-foreground font-mono border-r border-border">
          {lineNumbers.map(num => (
            <div key={num} className="leading-5" data-testid={`line-number-${num}`}>
              {num}
            </div>
          ))}
        </div>
        
        {/* Code Content */}
        <div className="flex-1 relative">
          <textarea
            className="w-full h-full p-3 bg-transparent text-sm font-mono resize-none outline-none syntax-highlight"
            value={currentCode}
            onChange={(e) => onCodeChange(e.target.value)}
            placeholder="Load a file to start editing..."
            data-testid="textarea-code-editor"
          />
        </div>
      </div>

      {/* Analysis and Diff Panels */}
      <div className="grid grid-cols-2 gap-4 h-64">
        {/* Changes Summary */}
        <div className="tool-panel">
          <div className="p-3 border-b border-border">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <i className="fas fa-list-ul text-primary"></i>
              Recent Changes
            </h4>
          </div>
          <div className="p-3 space-y-2 overflow-y-auto">
            {changes.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No changes yet
              </div>
            ) : (
              changes.slice(-10).map((change) => (
                <div 
                  key={change.id}
                  className={`p-2 rounded text-sm diff-${change.type}`}
                  data-testid={`change-item-${change.id}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono">Line {change.line}: {change.content}</span>
                    <span className="text-xs text-muted-foreground">{change.tool}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {change.description}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Preview */}
        <div className="tool-panel">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <i className="fas fa-eye text-secondary"></i>
              Live Preview
            </h4>
            <div className="flex gap-2">
              <button 
                className="text-xs px-2 py-1 rounded bg-muted/50 hover:bg-muted transition-colors"
                onClick={() => setShowPreview(!showPreview)}
                data-testid="button-refresh-preview"
              >
                <i className="fas fa-refresh"></i>
              </button>
              <button 
                className="text-xs px-2 py-1 rounded bg-muted/50 hover:bg-muted transition-colors"
                data-testid="button-external-preview"
              >
                <i className="fas fa-external-link-alt"></i>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white">
            {showPreview && previewUrl ? (
              <iframe 
                src={previewUrl}
                className="w-full h-full border-0"
                data-testid="iframe-live-preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <i className="fas fa-eye-slash text-2xl mb-2"></i>
                  <p className="text-sm">Click "Live Preview" to enable</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
