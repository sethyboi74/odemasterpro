import { useState, useMemo, useEffect } from 'react';
import type { ProjectFile, WorkshopMessage } from '@/types/workshop';
import { analyzeExternalResources, CodeManipulator } from '@/lib/workshopUtils';

interface PrefetchWorkshopProps {
  files: ProjectFile[];
  onClose: () => void;
  sendMessage: (iframe: HTMLIFrameElement | null, message: WorkshopMessage) => void;
}

export default function PrefetchWorkshop({ files, onClose, sendMessage }: PrefetchWorkshopProps) {
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [manualType, setManualType] = useState<'preconnect' | 'dns-prefetch' | 'prefetch'>('preconnect');
  const [manualResources, setManualResources] = useState<Array<{
    url: string;
    type: 'font' | 'api' | 'cdn' | 'image' | 'script';
    recommendation: 'preconnect' | 'dns-prefetch' | 'prefetch';
  }>>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);

  // Refresh when files change
  useEffect(() => {
    // Reset selections when files change to force refresh
    setSelectedResources([]);
  }, [files]);

  const detectedResources = useMemo(() => {
    const allContent = files.map(f => f.content).join('\n');
    return analyzeExternalResources(allContent);
  }, [files]);

  // Add manual URL function
  const addManualUrl = () => {
    if (!manualUrl.trim() || !manualUrl.startsWith('http')) {
      alert('Please enter a valid HTTP/HTTPS URL');
      return;
    }
    
    if (manualResources.some(r => r.url === manualUrl)) {
      alert('This URL has already been added');
      return;
    }
    
    // Smart categorization for manual URLs
    let type: 'font' | 'api' | 'cdn' | 'image' | 'script' = 'cdn';
    if (manualUrl.includes('fonts.googleapis.com') || manualUrl.includes('fonts.gstatic.com') || /\.(woff|woff2|ttf|otf|eot)$/i.test(manualUrl)) {
      type = 'font';
    } else if (manualUrl.includes('api.') || manualUrl.includes('/api/')) {
      type = 'api';
    } else if (/\.(jpg|jpeg|png|webp|gif|svg|ico)$/i.test(manualUrl)) {
      type = 'image';
    } else if (/\.(js|css|json)$/i.test(manualUrl)) {
      type = 'script';
    }
    
    const newResource = {
      url: manualUrl,
      type,
      recommendation: manualType
    };
    
    setManualResources(prev => [...prev, newResource]);
    setSelectedResources(prev => [...prev, manualUrl]);
    setManualUrl('');
  };

  // Combine detected and manual resources
  const allResources = useMemo(() => {
    return [...detectedResources, ...manualResources];
  }, [detectedResources, manualResources]);

  const generatedTags = useMemo(() => {
    return selectedResources.map(url => {
      const resource = allResources.find(r => r.url === url);
      if (!resource) return '';

      const crossorigin = resource.type === 'font' && resource.url.includes('gstatic') ? ' crossorigin' : '';
      return `<link rel="${resource.recommendation}" href="${resource.url}"${crossorigin}>`;
    }).join('\n');
  }, [selectedResources, allResources]);

  const performanceImpact = useMemo(() => {
    const dnsCount = selectedResources.filter(url => 
      allResources.find(r => r.url === url)?.recommendation === 'dns-prefetch'
    ).length;
    
    const fontCount = selectedResources.filter(url => 
      allResources.find(r => r.url === url)?.type === 'font'
    ).length;

    return {
      dnsTime: dnsCount * 80, // avg 80ms per DNS lookup saved
      fontTime: fontCount * 120, // avg 120ms per font load saved
      overallGain: Math.min(25, (dnsCount + fontCount) * 3) // max 25% gain
    };
  }, [selectedResources, allResources]);

  const toggleResource = (url: string) => {
    setSelectedResources(prev => 
      prev.includes(url) 
        ? prev.filter(u => u !== url)
        : [...prev, url]
    );
  };

  const handleApplyAll = () => {
    if (!generatedTags || selectedResources.length === 0) return;
    
    // Find the main HTML file to modify
    const htmlFile = files.find(f => f.type === 'html' && f.content.includes('<head'));
    
    if (!htmlFile) {
      // Fallback: Send tags without structure preservation
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'prefetch-workshop',
        data: {
          code: generatedTags,
          summary: `Added ${selectedResources.length} prefetch optimizations (manual insertion required)`
        }
      });
      onClose();
      return;
    }
    
    try {
      const manipulator = new CodeManipulator(htmlFile.content);
      const headLocation = manipulator.findHtmlHead();
      
      if (headLocation) {
        // Smart insertion: Add prefetch tags before closing </head> with proper indentation
        const prefetchComment = `    <!-- Prefetch optimizations added by Prefetch Workshop -->\n`;
        const indentedTags = generatedTags.split('\n')
          .map(tag => tag.trim() ? `    ${tag.trim()}` : tag)
          .join('\n');
        const insertContent = `\n${prefetchComment}${indentedTags}\n`;
        
        const modifiedContent = manipulator.insertAtLocation(headLocation, insertContent, false);
        
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'prefetch-workshop',
          data: {
            code: modifiedContent,
            summary: `Smart-inserted ${selectedResources.length} prefetch optimizations into <head> section`,
            changes: [{
              type: 'insert',
              description: `Added prefetch tags to ${htmlFile.name}`,
              location: `Head section (line ${headLocation.startLine})`
            }]
          }
        });
        
      } else {
        // If can't find head, try to insert after <head> tag
        const headInsertRegex = /(<head[^>]*>)/i;
        const modifiedContent = htmlFile.content.replace(headInsertRegex, (match) => {
          return match + `\n    <!-- Prefetch optimizations -->\n${generatedTags.split('\n').map(tag => `    ${tag}`).join('\n')}\n`;
        });
        
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'prefetch-workshop',
          data: {
            code: modifiedContent,
            summary: `Added ${selectedResources.length} prefetch optimizations after <head> tag`
          }
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to apply prefetch changes:', error);
      
      // Fallback: Send tags for manual insertion
      sendMessage(null, {
        type: 'WORKSHOP_APPLY_PATCH',
        workshopId: 'prefetch-workshop',
        data: {
          code: generatedTags,
          summary: `Generated ${selectedResources.length} prefetch optimizations (fallback mode - manual insertion required)`
        }
      });
      onClose();
    }
  };

  const handleDeleteResource = (url: string) => {
    setResourceToDelete(url);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (!resourceToDelete) return;
    
    // Find the resource in all files that contains this URL in link tags
    const htmlFile = files.find(f => f.type === 'html');
    
    if (htmlFile) {
      try {
        const manipulator = new CodeManipulator(htmlFile.content);
        
        // Find and remove all link tags that reference this URL
        const linkTagRegex = new RegExp(`<link[^>]*href=["\']${resourceToDelete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["\'][^>]*>`, 'gi');
        const modifiedContent = htmlFile.content.replace(linkTagRegex, '');
        
        sendMessage(null, {
          type: 'WORKSHOP_APPLY_PATCH',
          workshopId: 'prefetch-workshop',
          data: {
            code: modifiedContent,
            summary: `Removed prefetch/preconnect tag for ${resourceToDelete}`
          }
        });
        
        // Remove from selections if it was selected
        setSelectedResources(prev => prev.filter(url => url !== resourceToDelete));
        
      } catch (error) {
        console.error('Failed to delete resource:', error);
        alert('Failed to delete resource from code');
      }
    }
    
    setShowDeleteDialog(false);
    setResourceToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setResourceToDelete(null);
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'font': return 'fas fa-font text-primary';
      case 'api': return 'fas fa-server text-secondary';
      case 'cdn': return 'fas fa-cloud text-accent';
      case 'image': return 'fas fa-image text-yellow-500';
      case 'script': return 'fas fa-file-code text-green-500';
      default: return 'fas fa-link text-gray-500';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'preconnect': return 'bg-secondary/20 text-secondary';
      case 'dns-prefetch': return 'bg-primary/20 text-primary';
      case 'prefetch': return 'bg-accent/20 text-accent';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  return (
    <div className="max-w-6xl mx-auto my-8 h-[calc(100vh-4rem)] bg-card border border-border rounded-lg shadow-2xl flex flex-col">
      {/* Workshop Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <i className="fas fa-link text-2xl text-primary"></i>
          <div>
            <h2 className="text-lg font-bold">Prefetch Workshop</h2>
            <p className="text-sm text-muted-foreground">Optimize resource loading with prefetch & preconnect</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 text-xs bg-secondary/20 text-secondary rounded-full">
            Connected to CodeMaster
          </div>
          <button 
            className="p-2 hover:bg-muted rounded-md transition-colors"
            onClick={onClose}
            data-testid="button-close-prefetch-workshop"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      {/* Workshop Content */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Resource Analysis Panel */}
        <div className="col-span-4 space-y-4">
          {/* Manual URL Creation Panel */}
          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">Create New Prefetch Tag</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">URL</label>
                <div className="relative">
                  <input 
                    type="url"
                    value={manualUrl}
                    onChange={(e) => setManualUrl(e.target.value)}
                    placeholder="https://fonts.googleapis.com/css2?family=Inter"
                    className="w-full px-2 py-1 pr-8 text-sm border border-border rounded"
                    data-testid="input-manual-url"
                  />
                  {manualUrl && (
                    <button
                      onClick={() => setManualUrl('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted/50 rounded text-red-500 hover:text-red-700"
                      data-testid="button-clear-manual-url"
                      title="Clear URL"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Type</label>
                <select 
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as 'preconnect' | 'dns-prefetch' | 'prefetch')}
                  className="w-full px-2 py-1 text-sm border border-border rounded"
                  data-testid="select-manual-type"
                >
                  <option value="preconnect">preconnect</option>
                  <option value="dns-prefetch">dns-prefetch</option>
                  <option value="prefetch">prefetch</option>
                </select>
              </div>
              <button 
                onClick={addManualUrl}
                className="w-full btn-secondary px-3 py-2 rounded text-sm"
                data-testid="button-add-manual-url"
              >
                Add URL
              </button>
            </div>
          </div>

          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">All Resources</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allResources.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No resources found. Upload files or add URLs manually.
                </div>
              ) : (
                allResources.map((resource, index) => {
                  const isManual = manualResources.includes(resource);
                  const hasExisting = 'existing' in resource && resource.existing;
                  return (
                    <div 
                      key={index}
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        selectedResources.includes(resource.url) 
                          ? 'bg-secondary border-2 border-secondary shadow-md text-secondary-foreground' 
                          : hasExisting 
                            ? 'bg-green-50 border border-green-200 hover:bg-green-100' 
                            : 'bg-muted/30 hover:bg-muted/50 border border-transparent'
                      }`}
                      onClick={() => toggleResource(resource.url)}
                      data-testid={`resource-item-${index}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <i className={getResourceIcon(resource.type)}></i>
                        <div className="text-sm font-mono text-primary truncate">
                          {new URL(resource.url).hostname}
                        </div>
                        {hasExisting ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                            ✓ exists
                          </span>
                        ) : null}
                        {isManual ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                            ✋ manual
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {resource.type} resource - Recommend {resource.recommendation}
                        {hasExisting ? ` (has ${String((resource as any).existing || 'existing')})` : ''}
                      </div>
                      <div className="flex gap-1 items-center">
                        <span className={`px-2 py-0.5 text-xs rounded ${getRecommendationColor(resource.recommendation)}`}>
                          {resource.recommendation}
                        </span>
                        {isManual && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setManualResources(prev => prev.filter(r => r.url !== resource.url));
                              setSelectedResources(prev => prev.filter(url => url !== resource.url));
                            }}
                            className="text-sm text-red-500 hover:text-red-700 ml-1 font-bold"
                            data-testid={`button-remove-manual-${index}`}
                          >
                            ✕
                          </button>
                        )}
                        {hasExisting ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteResource(resource.url);
                            }}
                            className="text-sm text-red-500 hover:text-red-700 ml-1 font-bold"
                            data-testid={`button-delete-existing-${index}`}
                            title="Delete from code"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">Optimization Actions</h3>
            <div className="space-y-2">
              <button 
                className="w-full btn-primary px-3 py-2 rounded text-sm"
                onClick={() => setSelectedResources(allResources.map(r => r.url))}
                data-testid="button-select-all-resources"
              >
                Select All Resources
              </button>
              <button 
                className="w-full btn-secondary px-3 py-2 rounded text-sm"
                onClick={handleApplyAll}
                disabled={selectedResources.length === 0}
                data-testid="button-apply-prefetch-changes"
              >
                Send to CodeMaster
              </button>
            </div>
          </div>
        </div>

        {/* Generated Code Panel */}
        <div className="col-span-8 space-y-4">
          <div className="tool-panel">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold">Generated Prefetch Tags</h4>
            </div>
            <div className="p-3 font-mono text-sm bg-muted/20 h-40 overflow-auto">
              {generatedTags ? (
                <div className="syntax-highlight whitespace-pre-wrap" data-testid="text-generated-tags">
                  {generatedTags}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Select resources to generate prefetch tags
                </div>
              )}
            </div>
          </div>

          <div className="tool-panel">
            <div className="p-3 border-b border-border">
              <h4 className="text-sm font-semibold">Performance Impact</h4>
            </div>
            <div className="p-3 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-secondary" data-testid="text-dns-impact">
                    -{performanceImpact.dnsTime}ms
                  </div>
                  <div className="text-xs text-muted-foreground">DNS Lookup Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary" data-testid="text-font-impact">
                    -{performanceImpact.fontTime}ms
                  </div>
                  <div className="text-xs text-muted-foreground">Font Load Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent" data-testid="text-overall-impact">
                    +{performanceImpact.overallGain}%
                  </div>
                  <div className="text-xs text-muted-foreground">Overall Performance</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">⚠️ Delete Prefetch Resource</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to remove this prefetch/preconnect tag from your code?
              <br />
              <span className="font-mono text-sm bg-muted p-1 rounded mt-2 block break-all">
                {resourceToDelete}
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded transition-colors"
                data-testid="button-cancel-delete"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                data-testid="button-confirm-delete"
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
