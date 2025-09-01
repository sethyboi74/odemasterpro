import { useRef } from 'react';
import type { ProjectFile } from '@/types/workshop';

interface ToolSidebarProps {
  files: ProjectFile[];
  onFilesUploaded: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onAnalyzeAll: () => void;
  onResetProject: () => void;
  onRunSpacingTool: () => void;
}

export default function ToolSidebar({
  files,
  onFilesUploaded,
  onRemoveFile,
  onAnalyzeAll,
  onResetProject,
  onRunSpacingTool
}: ToolSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.querySelector('.drag-overlay')?.classList.add('active');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.querySelector('.drag-overlay')?.classList.remove('active');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.querySelector('.drag-overlay')?.classList.remove('active');
    
    const files = Array.from(e.dataTransfer.files);
    onFilesUploaded(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFilesUploaded(files);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'html': return 'fab fa-html5 text-orange-500';
      case 'css': return 'fab fa-css3 text-blue-500';
      case 'js': return 'fab fa-js text-yellow-500';
      case 'json': return 'fas fa-file-code text-green-500';
      default: return 'fas fa-file text-gray-500';
    }
  };

  return (
    <aside className="col-span-3 space-y-4">
      {/* File Upload Area */}
      <div className="tool-panel p-4 relative">
        <div className="drag-overlay" data-testid="drag-overlay">
          <div className="text-center">
            <i className="fas fa-cloud-upload-alt text-3xl mb-2"></i>
            <p>Drop files here to analyze</p>
          </div>
        </div>
        
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <i className="fas fa-folder-open text-primary"></i>
          Project Files
        </h3>
        
        <div 
          className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          data-testid="upload-area"
        >
          <i className="fas fa-upload text-2xl text-muted-foreground mb-2"></i>
          <p className="text-sm font-medium mb-1">Drop HTML/CSS/JS files</p>
          <p className="text-xs text-muted-foreground">Or click to browse</p>
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept=".html,.css,.js,.json" 
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />
        </div>

        {/* Loaded Files List */}
        <div className="mt-4 space-y-2 max-h-48 overflow-y-auto">
          {files.map((file) => (
            <div 
              key={file.id}
              className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-sm"
              data-testid={`file-item-${file.id}`}
            >
              <div className="flex items-center gap-2">
                <i className={getFileIcon(file.type)}></i>
                <span>{file.name}</span>
              </div>
              <button 
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onRemoveFile(file.id)}
                data-testid={`button-remove-file-${file.id}`}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ))}
          
          {files.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No files loaded
            </div>
          )}
        </div>
      </div>

      {/* External Tools */}
      <div className="tool-panel p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <i className="fas fa-puzzle-piece text-accent"></i>
          External Tools
        </h3>
        
        <div className="space-y-2">
          <button 
            className="w-full p-3 text-left bg-muted/20 hover:bg-muted/40 rounded-md transition-colors border border-transparent hover:border-primary/30"
            data-testid="button-upload-tool"
          >
            <div className="flex items-center gap-3">
              <i className="fas fa-upload text-primary"></i>
              <div>
                <p className="text-sm font-medium">Upload Tool Module</p>
                <p className="text-xs text-muted-foreground">Import .js/.json tools</p>
              </div>
            </div>
          </button>
          
          {/* Loaded spacing tool */}
          <div className="p-3 bg-secondary/10 border border-secondary/30 rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <i className="fas fa-align-left text-secondary"></i>
                <div>
                  <p className="text-sm font-medium">Spacing Formatter</p>
                  <p className="text-xs text-muted-foreground">v1.0.5 - Ready</p>
                </div>
              </div>
              <button 
                className="text-xs px-2 py-1 bg-secondary text-secondary-foreground rounded"
                onClick={onRunSpacingTool}
                data-testid="button-run-spacing-tool"
              >
                Run
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="tool-panel p-4">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <i className="fas fa-bolt text-yellow-500"></i>
          Quick Actions
        </h3>
        
        <div className="space-y-2">
          <button 
            className="w-full btn-primary px-3 py-2 rounded-md text-sm font-medium transition-transform hover:scale-105 flex items-center gap-2"
            onClick={onAnalyzeAll}
            data-testid="button-analyze-all"
          >
            <i className="fas fa-play"></i>
            Analyze All Files
          </button>
          <button 
            className="w-full btn-secondary px-3 py-2 rounded-md text-sm font-medium transition-transform hover:scale-105 flex items-center gap-2"
            data-testid="button-apply-changes"
          >
            <i className="fas fa-save"></i>
            Apply All Changes
          </button>
          <button 
            className="w-full px-3 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors flex items-center gap-2"
            onClick={onResetProject}
            data-testid="button-reset-project"
          >
            <i className="fas fa-undo"></i>
            Reset Project
          </button>
        </div>
      </div>
    </aside>
  );
}
