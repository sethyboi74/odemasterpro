import { useState, useMemo } from 'react';
import type { ProjectFile, WorkshopMessage } from '@/types/workshop';
import { analyzeExternalResources, CodeManipulator } from '@/lib/workshopUtils';

interface PrefetchWorkshopProps {
  files: ProjectFile[];
  onClose: () => void;
  sendMessage: (iframe: HTMLIFrameElement | null, message: WorkshopMessage) => void;
}

export default function PrefetchWorkshop({ files, onClose, sendMessage }: PrefetchWorkshopProps) {
  const [selectedResources, setSelectedResources] = useState<string[]>([]);

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
      dnsTime: dnsCount * 80, // avg 80ms per DNS lookup saved
      fontTime: fontCount * 120, // avg 120ms per font load saved
      overallGain: Math.min(25, (dnsCount + fontCount) * 3) // max 25% gain
    };
  }, [selectedResources, detectedResources]);

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
          <div className="tool-panel p-3">
            <h3 className="text-sm font-semibold mb-3">Detected Resources</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {detectedResources.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No external resources found
                </div>
              ) : (
                detectedResources.map((resource, index) => (
                  <div 
                    key={index}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedResources.includes(resource.url) 
                        ? 'bg-primary/20 border border-primary/30' 
                        : 'bg-muted/30 hover:bg-muted/50'
                    }`}
                    onClick={() => toggleResource(resource.url)}
                    data-testid={`resource-item-${index}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <i className={getResourceIcon(resource.type)}></i>
                      <div className="text-sm font-mono text-primary truncate">
                        {new URL(resource.url).hostname}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">
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
            <h3 className="text-sm font-semibold mb-3">Optimization Actions</h3>
            <div className="space-y-2">
              <button 
                className="w-full btn-primary px-3 py-2 rounded text-sm"
                onClick={() => setSelectedResources(detectedResources.map(r => r.url))}
                data-testid="button-select-all-resources"
              >
                Select All Suggestions
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
    </div>
  );
}
