import { useState, useEffect, useMemo } from 'react';
import type { ProjectFile, WorkshopMessage } from '@/types/workshop';
import { parseCSS, CodeManipulator, parseCSSFromFiles } from '@/lib/workshopUtils';

interface CSSWorkshopProps {
  files: ProjectFile[];
  onClose: () => void;
  sendMessage: (iframe: HTMLIFrameElement | null, message: WorkshopMessage) => void;
}

export default function CSSWorkshop({ files, onClose, sendMessage }: CSSWorkshopProps) {
  const [selectedRule, setSelectedRule] = useState<string>('');
  const [editedCSS, setEditedCSS] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [newCSSRule, setNewCSSRule] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<any>(null);

  // Extract and parse CSS rules from files with line numbers
  const cssRules = useMemo(() => {
    return parseCSSFromFiles(files).map(rule => ({
      ...rule,
      fileId: files.find(f => f.name === rule.fileName)?.id || 'unknown'
    }));
  }, [files]);

  const handleRuleSelect = (rule: any) => {
    setIsCreatingNew(false);
    setNewCSSRule('');
    setSelectedRule(rule.selector);
    const cssText = `${rule.selector} {\n${Object.entries(rule.properties)
      .map(([prop, value]) => `  ${prop}: ${value};`)
      .join('\n')}\n}`;
    setEditedCSS(cssText);
    
    // Immediately update preview when selecting a new rule
    updatePreview(cssText);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedRule('');
    setEditedCSS('');
    setNewCSSRule('.new-rule {\n  /* Add your styles here */\n  color: #333;\n  background: #fff;\n}');
  };

  const updatePreview = (css: string) => {
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
    
    // Clean up previous URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    
    const blob = new Blob([previewHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
  };

  useEffect(() => {
    if (editedCSS || newCSSRule) {
      updatePreview(editedCSS || newCSSRule);
    }
  }, [editedCSS, newCSSRule]);

  // Refresh when files change
  useEffect(() => {
    // Reset selections when files change to force refresh
    setSelectedRule('');
    setEditedCSS('');
    setNewCSSRule('');
    setIsCreatingNew(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  }, [files]);

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

  const handleDeleteRule = (rule: any) => {
    setRuleToDelete(rule);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (!ruleToDelete) return;
    
    // Find the file containing this rule
    const targetFile = files.find(f => f.id === ruleToDelete.fileId);
    
    if (targetFile) {
      try {
        const manipulator = new CodeManipulator(targetFile.content);
        let modifiedContent = targetFile.content;
        
        if (targetFile.type === 'css') {
          // For CSS files, remove the entire rule
          const ruleLocation = manipulator.findCSSRule(ruleToDelete.selector);
          if (ruleLocation) {
            // Replace the rule with empty content to effectively delete it
            modifiedContent = manipulator.replaceAtLocation(ruleLocation, '');
          }
        } else if (targetFile.type === 'html') {
          // For HTML files, remove the style tag or rule within <style>
          const styleTagRegex = new RegExp(`<style[^>]*>[\\s\\S]*?${ruleToDelete.selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?</style>`, 'gi');
          modifiedContent = targetFile.content.replace(styleTagRegex, '');
        }
        
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'css-workshop',
          data: {
            code: modifiedContent,
            summary: `Removed CSS rule: ${ruleToDelete.selector}`,
            changes: [{
              type: 'delete',
              description: `Deleted CSS rule ${ruleToDelete.selector}`,
              location: `${targetFile.name}:${ruleToDelete.line || 'unknown'}`
            }]
          }
        });
        
        // Clear selection if this rule was selected
        if (selectedRule === ruleToDelete.selector) {
          setSelectedRule('');
          setEditedCSS('');
        }
        
      } catch (error) {
        console.error('Failed to delete CSS rule:', error);
        alert('Failed to delete CSS rule from code');
      }
    }
    
    setShowDeleteDialog(false);
    setRuleToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setRuleToDelete(null);
  };

  const handleApplyNewCSS = () => {
    if (!newCSSRule.trim()) return;
    
    // Find appropriate file to append new CSS
    const cssFile = files.find(f => f.type === 'css');
    const htmlFile = files.find(f => f.type === 'html');
    
    if (cssFile) {
      // Append to CSS file
      const modifiedContent = cssFile.content + '\n\n' + newCSSRule.trim();
      
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'css-workshop',
        data: {
          code: modifiedContent,
          summary: `Added new CSS rule to ${cssFile.name}`,
          changes: [{
            type: 'append',
            description: 'New CSS rule added',
            location: `End of ${cssFile.name}`
          }]
        }
      });
      
    } else if (htmlFile) {
      // Append to HTML file within style tags or create new style section
      try {
        const manipulator = new CodeManipulator(htmlFile.content);
        let modifiedContent = htmlFile.content;
        
        // Check if there are existing <style> tags
        const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
        const hasStyleTags = styleRegex.test(htmlFile.content);
        
        if (hasStyleTags) {
          // Append to existing style section
          modifiedContent = htmlFile.content.replace(
            /(<\/style>)/i, 
            `\n${newCSSRule}\n$1`
          );
        } else {
          // Create new style section in head
          const headLocation = manipulator.findHtmlHead();
          if (headLocation) {
            const styleSection = `\n    <style>\n${newCSSRule}\n    </style>\n`;
            modifiedContent = manipulator.insertAtLocation(headLocation, styleSection, false);
          }
        }
        
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'css-workshop',
          data: {
            code: modifiedContent,
            summary: `Added new CSS rule to ${htmlFile.name}`,
            changes: [{
              type: 'append',
              description: 'New CSS rule added to style section',
              location: hasStyleTags ? 'Existing <style> tags' : 'New <style> section in <head>'
            }]
          }
        });
        
      } catch (error) {
        console.error('Failed to append CSS to HTML:', error);
        // Fallback: send just the CSS rule
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'css-workshop',
          data: {
            code: newCSSRule,
            summary: 'New CSS rule created (manual insertion required)'
          }
        });
      }
    } else {
      // No appropriate file found, send just the CSS
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'css-workshop',
        data: {
          code: newCSSRule,
          summary: 'New CSS rule created (no CSS/HTML file found for automatic insertion)'
        }
      });
    }
    
    onClose();
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
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedRule === rule.selector
                        ? 'bg-secondary border-2 border-secondary shadow-md text-secondary-foreground'
                        : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                    }`}
                    onClick={() => handleRuleSelect(rule)}
                    data-testid={`css-rule-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-mono text-sm text-primary">{rule.selector}</div>
                      <div className="bg-accent/20 text-accent px-2 py-0.5 rounded text-xs font-mono">
                        Line {rule.lineNumber}{ rule.endLineNumber !== rule.lineNumber ? `-${rule.endLineNumber}` : '' }
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRule(rule);
                        }}
                        className="text-sm text-red-500 hover:text-red-700 ml-auto font-bold"
                        data-testid={`button-delete-css-rule-${index}`}
                        title="Delete CSS rule from code"
                      >
<i className="fas fa-trash"></i>
                      </button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {Object.keys(rule.properties).join(', ')}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {rule.source}
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
                className="w-full btn-secondary px-3 py-2 rounded text-sm"
                onClick={handleCreateNew}
                data-testid="button-create-new-css"
              >
                ✨ Create New CSS Rule
              </button>
              <button 
                className="w-full btn-primary px-3 py-2 rounded text-sm"
                data-testid="button-standardize-rules"
              >
                🔧 Standardize All Rules
              </button>
              <button 
                className="w-full btn-primary px-3 py-2 rounded text-sm"
                onClick={isCreatingNew ? handleApplyNewCSS : handleApplyChanges}
                disabled={!editedCSS && !newCSSRule}
                data-testid="button-apply-to-codemaster"
              >
                {isCreatingNew ? '📝 Add New CSS' : '🔄 Update Existing'}
              </button>
            </div>
          </div>
        </div>

        {/* Editor Panel */}
        <div className="col-span-8 space-y-4">
          <div className="tool-panel h-80">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold">
                {isCreatingNew ? 'Create New CSS Rule' : 'CSS Rule Editor'}
              </h4>
            </div>
            <div className="flex h-full">
              <div className="w-12 bg-muted/30 text-right px-2 py-3 text-xs text-muted-foreground font-mono border-r border-border">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i + 1} className="leading-5">{i + 1}</div>
                ))}
              </div>
              <textarea 
                className="flex-1 p-3 bg-transparent text-sm font-mono resize-none outline-none"
                placeholder={isCreatingNew ? "Enter new CSS rule..." : "Select a CSS rule to edit..."}
                value={isCreatingNew ? newCSSRule : editedCSS}
                onChange={(e) => isCreatingNew ? setNewCSSRule(e.target.value) : setEditedCSS(e.target.value)}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">⚠️ Delete CSS Rule</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to remove this CSS rule from your code?
              <br />
              <span className="font-mono text-sm bg-muted p-1 rounded mt-2 block break-all">
                {ruleToDelete?.selector}
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
                data-testid="button-cancel-delete-css"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                data-testid="button-confirm-delete-css"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
