import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import ToolSidebar from './ToolSidebar';
import EditorWorkspace from './EditorWorkspace';
import OverlaySystem from './OverlaySystem';
import { useOverlay } from '@/hooks/useOverlay';
import { useWorkshopMessage } from '@/hooks/useWorkshopMessage';
import type { ProjectFile, AnalysisChange, ProjectStats, WorkshopMessage } from '@/types/workshop';

export default function CodeMasterHub() {
  const { toast } = useToast();
  const { currentOverlay, openOverlay, closeOverlay } = useOverlay();
  
  // Project state
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [changes, setChanges] = useState<AnalysisChange[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    filesLoaded: 0,
    linesAnalyzed: 0,
    changesCount: 0
  });

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
          setCurrentCode(message.data.code);
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
  }, [toast]);

  const { sendMessage } = useWorkshopMessage(handleWorkshopMessage);

  // File management
  const handleFilesUploaded = useCallback((newFiles: File[]) => {
    const processFiles = async () => {
      const projectFiles: ProjectFile[] = [];
      
      for (const file of newFiles) {
        const content = await file.text();
        const projectFile: ProjectFile = {
          id: Date.now().toString() + Math.random(),
          name: file.name,
          content,
          type: getFileType(file.name),
          size: file.size
        };
        projectFiles.push(projectFile);
      }
      
      setFiles(prev => [...prev, ...projectFiles]);
      setStats(prev => ({
        ...prev,
        filesLoaded: prev.filesLoaded + projectFiles.length,
        linesAnalyzed: prev.linesAnalyzed + projectFiles.reduce((acc, f) => 
          acc + f.content.split('\n').length, 0)
      }));
      
      if (projectFiles.length > 0) {
        setCurrentCode(projectFiles[0].content);
      }
      
      toast({
        title: 'Files Loaded',
        description: `${projectFiles.length} file(s) added to project`
      });
    };
    
    processFiles();
  }, [toast]);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setStats(prev => ({
      ...prev,
      filesLoaded: Math.max(0, prev.filesLoaded - 1)
    }));
  }, []);

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
      const result = await spacingTool.run(currentCode);
      
      setCurrentCode(result.code);
      setChanges(prev => [...prev, {
        id: Date.now().toString(),
        type: 'modified',
        line: 0,
        content: result.summary,
        tool: 'Spacing Tool',
        description: result.summary
      }]);
      
      setStats(prev => ({
        ...prev,
        changesCount: prev.changesCount + 1
      }));
      
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
  }, [currentCode, toast]);

  const analyzeAllFiles = useCallback(() => {
    if (files.length === 0) {
      toast({
        title: 'No Files',
        description: 'Please upload files to analyze',
        variant: 'destructive'
      });
      return;
    }
    
    toast({
      title: 'Analysis Complete',
      description: `Analyzed ${files.length} files`
    });
  }, [files, toast]);

  const resetProject = useCallback(() => {
    setFiles([]);
    setCurrentCode('');
    setChanges([]);
    setStats({ filesLoaded: 0, linesAnalyzed: 0, changesCount: 0 });
    toast({
      title: 'Project Reset',
      description: 'All files and changes cleared'
    });
  }, [toast]);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="glass-effect border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  <i className="fas fa-code"></i>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    CodeMaster Pro
                  </h1>
                  <p className="text-xs text-muted-foreground">Unified Development Hub</p>
                </div>
              </div>
            </div>
            
            <nav className="flex items-center gap-2">
              <button 
                className="px-3 py-2 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
                onClick={() => openOverlay('css-workshop')}
                data-testid="button-css-workshop"
              >
                <i className="fas fa-palette"></i>
                CSS Workshop
              </button>
              <button 
                className="px-3 py-2 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
                onClick={() => openOverlay('prefetch-workshop')}
                data-testid="button-prefetch-workshop"
              >
                <i className="fas fa-link"></i>
                Prefetch Tools
              </button>
              <button 
                className="px-3 py-2 text-sm rounded-md bg-muted/50 hover:bg-muted transition-colors flex items-center gap-2"
                onClick={runSpacingTool}
                data-testid="button-spacing-tool"
              >
                <i className="fas fa-align-left"></i>
                Spacing
              </button>
            </nav>

            <div className="flex items-center gap-3">
              <div className="status-indicator px-3 py-1 text-xs bg-muted rounded-full">
                <span data-testid="text-files-count">{stats.filesLoaded} files</span>
              </div>
              <div className="px-3 py-1 text-xs bg-muted rounded-full">
                <span data-testid="text-lines-count">{stats.linesAnalyzed} lines</span>
              </div>
              <div className="px-3 py-1 text-xs bg-muted rounded-full">
                <span data-testid="text-changes-count">{stats.changesCount} changes</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-140px)]">
          <ToolSidebar
            files={files}
            onFilesUploaded={handleFilesUploaded}
            onRemoveFile={removeFile}
            onAnalyzeAll={analyzeAllFiles}
            onResetProject={resetProject}
            onRunSpacingTool={runSpacingTool}
          />
          <EditorWorkspace
            currentCode={currentCode}
            changes={changes}
            onCodeChange={setCurrentCode}
          />
        </div>
      </main>

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
