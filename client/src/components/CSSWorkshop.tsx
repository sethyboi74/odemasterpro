import { useState, useEffect, useMemo } from 'react';
import type { ProjectFile, WorkshopMessage } from '@/types/workshop';
import { parseCSS, CodeManipulator } from '@/lib/workshopUtils';

interface CSSWorkshopProps {
  files: ProjectFile[];
  onClose: () => void;
  sendMessage: (iframe: HTMLIFrameElement | null, message: WorkshopMessage) => void;
}

export default function CSSWorkshop({ files, onClose, sendMessage }: CSSWorkshopProps) {
  const [selectedRule, setSelectedRule] = useState<string>('');
  const [editedCSS, setEditedCSS] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');

  const cssRules = useMemo(() => {
    const allRules: Array<{
      selector: string;
      properties: Record<string, string>;
      startLine: number;
      endLine: number;
      rawContent: string;
      fileId: string;
      fileName: string;
    }> = [];

    files.forEach(file => {
      if (file.type === 'css') {
        const rules = parseCSS(file.content);
        rules.forEach(rule => {
          allRules.push({
            ...rule,
            fileId: file.id,
            fileName: file.name
          });
        });
      } else if (file.type === 'html') {
        // Extract CSS from style tags
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        let match;
        while ((match = styleRegex.exec(file.content)) !== null) {
          const rules = parseCSS(match[1]);
          rules.forEach(rule => {
            allRules.push({
              ...rule,
              fileId: file.id,
              fileName: `${file.name} (inline)`
            });
          });
        }
      }
    });

    return allRules;
  }, [files]);

  const handleRuleSelect = (rule: any) => {
    setSelectedRule(rule.selector);
    const cssText = `${rule.selector} {\n${Object.entries(rule.properties)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n')}\n}`;
    setEditedCSS(cssText);
  };

  const updatePreview = (css: string) => {
    const previewHTML = `
      <style>${css}</style>
      <div class="container">Container Preview</div>
      <div class="hero">Hero Section Preview</div>
    `;
    
    const blob = new Blob([previewHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  useEffect(() => {
    if (editedCSS) {
      updatePreview(editedCSS);
    }
  }, [editedCSS]);

  const handleApplyChanges = () => {
    if (!selectedRule || !editedCSS) return;
    
    // Find the original file to modify
    const targetRule = cssRules.find(rule => rule.selector === selectedRule);
    if (!targetRule) return;
    
    const targetFile = files.find(f => f.id === targetRule.fileId);
    if (!targetFile) return;
    
    try {
      const manipulator = new CodeManipulator(targetFile.content);
      let modifiedContent = targetFile.content;
      
      if (targetFile.type === 'css') {
        // For CSS files, replace the entire rule
        const ruleLocation = manipulator.findCSSRule(selectedRule);
        if (ruleLocation) {
          modifiedContent = manipulator.replaceAtLocation(ruleLocation, editedCSS);
        }
      } else if (targetFile.type === 'html') {
        // For HTML with inline styles, need to find and replace within <style> tags
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        modifiedContent = targetFile.content.replace(styleRegex, (match, cssContent) => {
          const cssManipulator = new CodeManipulator(cssContent);
          const ruleLocation = cssManipulator.findCSSRule(selectedRule);
          if (ruleLocation) {
            const updatedCSS = cssManipulator.replaceAtLocation(ruleLocation, editedCSS);
            return match.replace(cssContent, updatedCSS);
          }
          return match;
        });
      }
      
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'css-workshop',
        data: {
          code: modifiedContent,
          summary: `CSS rule "${selectedRule}" updated with preserved structure`,
          changes: [{
            type: 'replace',
            description: `Updated ${selectedRule} in ${targetFile.name}`,
            location: `Line ${targetRule.startLine}-${targetRule.endLine}`
          }]
        }
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to apply CSS changes:', error);
      
      // Fallback: Send original code as backup
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'css-workshop',
        data: {
          code: editedCSS,
          summary: `CSS rule "${selectedRule}" updated (fallback mode)`
        }
      });
      onClose();
    }
  };

  return (
    <div className="max-w-6xl mx-auto my-8 h-[calc(100vh-4rem)] bg-card border border-border rounded-lg shadow-2xl flex flex-col">
      {/* Workshop Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <i className="fas fa-palette text-2xl text-primary"></i>
          <div>
            <h2 className="text-lg font-bold">CSS Workshop</h2>
            <p className="text-sm text-muted-foreground">Extract, analyze, and standardize CSS rules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 text-xs bg-secondary/20 text-secondary rounded-full">
            Connected to CodeMaster
          </div>
          <button 
            className="p-2 hover:bg-muted rounded-md transition-colors"
            onClick={onClose}
            data-testid="button-close-css-workshop"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* Workshop Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* CSS Rules Panel */}
        <div className="col-span-4 space-y-4">
          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">Detected CSS Rules</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cssRules.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No CSS rules found
                </div>
              ) : (
                cssRules.map((rule, index) => (
                  <div
                    key={`${rule.fileId}-${index}`}
                    className="p-2 bg-muted/30 rounded cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRuleSelect(rule)}
                    data-testid={`css-rule-${index}`}
                  >
                    <div className="font-mono text-sm text-primary">{rule.selector}</div>
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(rule.properties).join(', ')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {rule.fileName}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">Batch Operations</h3>
            <div className="space-y-2">
              <button 
                className="w-full btn-primary px-3 py-2 rounded text-sm"
                data-testid="button-standardize-rules"
              >
                Standardize All Rules
              </button>
              <button 
                className="w-full btn-secondary px-3 py-2 rounded text-sm"
                onClick={handleApplyChanges}
                data-testid="button-apply-to-codemaster"
              >
                Apply to CodeMaster
              </button>
            </div>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="col-span-8 space-y-4">
          <div className="tool-panel h-80">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold">CSS Rule Editor</h4>
            </div>
            <div className="flex h-full">
              <div className="w-12 bg-muted/30 text-right px-2 py-3 text-xs text-muted-foreground font-mono border-r border-border">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i + 1} className="leading-5">{i + 1}</div>
                ))}
              </div>
              <textarea 
                className="flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none"
                placeholder="Select a CSS rule to edit..."
                value={editedCSS}
                onChange={(e) => setEditedCSS(e.target.value)}
                data-testid="textarea-css-editor"
              />
            </div>
          </div>

          <div className="tool-panel">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold">Live Preview</h4>
            </div>
            <div className="h-40 bg-white">
              {previewUrl ? (
                <iframe 
                  src={previewUrl}
                  className="w-full h-full border-0"
                  data-testid="iframe-css-preview"
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
  );
}
