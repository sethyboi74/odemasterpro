export interface WorkshopMessage {
  type: 'WORKSHOP_READY' | 'WORKSHOP_REQUEST_CODE' | 'INJECT_HTML' | 'WORKSHOP_APPLY_PATCH' | 'WORKSHOP_LOADED';
  data?: any;
  workshopId?: string;
}

export interface ProjectFile {
  id: string;
  name: string;
  content: string;
  type: 'html' | 'css' | 'js' | 'json';
  size: number;
}

export interface AnalysisChange {
  id: string;
  type: 'added' | 'removed' | 'modified';
  line: number;
  content: string;
  tool: string;
  description: string;
}

export interface ProjectStats {
  filesLoaded: number;
  linesAnalyzed: number;
  changesCount: number;
}

export interface ToolModule {
  name: string;
  version: string;
  description: string;
  run: (code: string, ctx?: any) => Promise<{
    code: string;
    summary: string;
    stats: any;
    warnings: string[];
  }>;
}
