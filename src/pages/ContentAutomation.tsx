import React, { useState, useEffect } from 'react';
import { generateReelDescription, suggestImprovements, CONTENT_TYPES, type ContentType } from '@/lib/greekCarnivoreContentGenerator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  PlusCircle, 
  Calendar, 
  TrendingUp, 
  Zap, 
  Target, 
  Settings, 
  Play, 
  Pause,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Edit3,
  ThumbsUp,
  ThumbsDown,
  Star,
  MessageSquare,
  Lightbulb,
  RefreshCw
} from 'lucide-react';

interface AutomationRule {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'pending_approval';
  trigger: string;
  action: string;
  last_run: string;
  next_run: string;
  success_rate: number;
}

interface ContentPipeline {
  id: string;
  name: string;
  input_type: 'manual' | 'calendar' | 'analytics' | 'trending';
  processing_steps: string[];
  output_platforms: string[];
  approval_required: boolean;
  auto_publish: boolean;
}

interface PendingApproval {
  id: string;
  pipeline: string;
  content_type: string;
  generated_content: any;
  estimated_performance: number;
  created_at: string;
  urgency: 'low' | 'medium' | 'high';
  suggestions?: ContentSuggestion[];
}

interface ContentSuggestion {
  aspect: 'title' | 'hook' | 'script' | 'thumbnail' | 'tone';
  before: string;
  after: string;
  reasoning: string;
  confidence: number;
}

interface FeedbackData {
  rating: number;
  notes: string;
  edits: {[key: string]: string};
}

export default function ContentAutomation() {
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [contentPipelines, setContentPipelines] = useState<ContentPipeline[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [masterSwitch, setMasterSwitch] = useState(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [feedbackData, setFeedbackData] = useState<{[key: string]: FeedbackData}>({});
  const [generateContext, setGenerateContext] = useState('');
  const [generateContentType, setGenerateContentType] = useState<ContentType>('diet_testing');

  useEffect(() => {
    // Load initial data
    loadAutomationRules();
    loadContentPipelines();
    loadPendingApprovals();
  }, []);

  const loadAutomationRules = async () => {
    // Mock data - replace with API call
    setAutomationRules([
      {
        id: '1',
        name: 'Daily Carnivore Tips',
        status: 'active',
        trigger: 'Daily at 9:00 AM',
        action: 'Generate educational reel',
        last_run: '2026-03-30T09:00:00Z',
        next_run: '2026-03-31T09:00:00Z',
        success_rate: 92
      },
      {
        id: '2',
        name: 'Client Success Stories',
        status: 'pending_approval',
        trigger: 'New measurement upload',
        action: 'Create transformation reel',
        last_run: '2026-03-29T15:30:00Z',
        next_run: 'On trigger',
        success_rate: 87
      },
      {
        id: '3',
        name: 'Trending Response',
        status: 'paused',
        trigger: 'Trending carnivore hashtag',
        action: 'Create response video',
        last_run: '2026-03-28T20:15:00Z',
        next_run: 'On trigger',
        success_rate: 78
      }
    ]);
  };

  const loadContentPipelines = async () => {
    // Mock data - replace with API call
    setContentPipelines([
      {
        id: '1',
        name: 'Educational Content Pipeline',
        input_type: 'manual',
        processing_steps: ['Script Generation', 'Video Creation', 'Thumbnail Design', 'Caption Writing'],
        output_platforms: ['Instagram Reels', 'TikTok', 'YouTube Shorts'],
        approval_required: true,
        auto_publish: false
      },
      {
        id: '2',
        name: 'Client Results Showcase',
        input_type: 'analytics',
        processing_steps: ['Data Collection', 'Story Creation', 'Visual Design', 'Privacy Check'],
        output_platforms: ['Instagram Reels', 'Facebook'],
        approval_required: true,
        auto_publish: false
      }
    ]);
  };

  const loadPendingApprovals = async () => {
    const generated1 = generateReelDescription('ribeye steak food showcase meat', 'food_showcase');
    const generated2 = generateReelDescription('transformation results weight loss before after', 'transformation');
    setPendingApprovals([
      {
        id: '1',
        pipeline: 'Daily Carnivore Tips',
        content_type: 'Educational Reel',
        generated_content: {
          title: generated1.hook,
          hook: generated1.hook,
          script: generated1.description,
        },
        estimated_performance: generated1.estimated_performance,
        created_at: new Date().toISOString(),
        urgency: 'medium',
        suggestions: suggestImprovements(generated1.description).map((s, i) => ({
          aspect: 'hook' as const,
          before: generated1.hook,
          after: s,
          reasoning: 'Improvement suggestion from Greek Carnivore generator',
          confidence: 0.85 - i * 0.05,
        })),
      },
      {
        id: '2',
        pipeline: 'Client Results Showcase',
        content_type: 'Transformation Story',
        generated_content: {
          title: generated2.hook,
          hook: generated2.hook,
          script: generated2.description,
        },
        estimated_performance: generated2.estimated_performance,
        created_at: new Date().toISOString(),
        urgency: 'high',
        suggestions: suggestImprovements(generated2.description).map((s, i) => ({
          aspect: 'script' as const,
          before: generated2.description.slice(0, 60),
          after: s,
          reasoning: 'Improvement suggestion from Greek Carnivore generator',
          confidence: 0.92 - i * 0.05,
        })),
      },
    ]);
  };

  const generateNewContent = () => {
    const result = generateReelDescription(generateContext || 'carnivore diet lifestyle', generateContentType);
    setPendingApprovals(prev => [{
      id: Date.now().toString(),
      pipeline: CONTENT_TYPES.find(t => t.value === generateContentType)?.label ?? generateContentType,
      content_type: 'Generated Reel',
      generated_content: {
        title: result.hook,
        hook: result.hook,
        script: result.description,
      },
      estimated_performance: result.estimated_performance,
      created_at: new Date().toISOString(),
      urgency: 'medium',
      suggestions: suggestImprovements(result.description).map((s, i) => ({
        aspect: 'hook' as const,
        before: result.hook,
        after: s,
        reasoning: 'Greek Carnivore generator suggestion',
        confidence: 0.85 - i * 0.05,
      })),
    }, ...prev]);
  };

  const toggleAutomationRule = (id: string) => {
    setAutomationRules(rules => 
      rules.map(rule => 
        rule.id === id 
          ? { ...rule, status: rule.status === 'active' ? 'paused' : 'active' }
          : rule
      )
    );
  };

  const approveContent = (id: string, approved: boolean, feedback?: FeedbackData) => {
    if (approved) {
      // Send feedback to learning system
      if (feedback) {
        submitFeedback(id, 'approval', feedback);
      }
      console.log(`Approved content ${id} for publishing`);
    } else {
      // Send rejection feedback
      if (feedback) {
        submitFeedback(id, 'rejection', feedback);
      }
    }
    setPendingApprovals(approvals => 
      approvals.filter(approval => approval.id !== id)
    );
    setEditingContent(null);
  };

  const submitFeedback = (contentId: string, type: 'approval' | 'rejection' | 'edit', feedback: FeedbackData) => {
    // This would call the feedback learning API
    console.log(`Submitting ${type} feedback for ${contentId}:`, feedback);
    // API call: POST /api/automation/feedback
  };

  const applySuggestion = (approvalId: string, suggestion: ContentSuggestion) => {
    setPendingApprovals(approvals => 
      approvals.map(approval => {
        if (approval.id === approvalId) {
          const updatedContent = { ...approval.generated_content };
          updatedContent[suggestion.aspect] = suggestion.after;
          return { ...approval, generated_content: updatedContent };
        }
        return approval;
      })
    );
  };

  const startEditing = (contentId: string) => {
    setEditingContent(contentId);
    if (!feedbackData[contentId]) {
      setFeedbackData(prev => ({
        ...prev,
        [contentId]: { rating: 7, notes: '', edits: {} }
      }));
    }
  };

  const updateFeedback = (contentId: string, field: keyof FeedbackData, value: any) => {
    setFeedbackData(prev => ({
      ...prev,
      [contentId]: { ...prev[contentId], [field]: value }
    }));
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Content Automation Center</h1>
          <p className="text-muted-foreground">AI-powered content generation with manual approval gates</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="master-switch">Master Automation</Label>
            <Switch 
              id="master-switch"
              checked={masterSwitch}
              onCheckedChange={setMasterSwitch}
            />
          </div>
          <Button disabled={!masterSwitch}>
            <Zap className="w-4 h-4 mr-2" />
            {masterSwitch ? 'Active' : 'Paused'}
          </Button>
        </div>
      </div>

      {/* Greek Carnivore Content Generator */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            🥩 Greek Carnivore Content Generator
          </CardTitle>
          <CardDescription>Generate Greek-language reel hooks, descriptions, and hashtags</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Video context (e.g. ribeye steak, transformation story...)"
              value={generateContext}
              onChange={e => setGenerateContext(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Select value={generateContentType} onValueChange={v => setGenerateContentType(v as ContentType)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={generateNewContent}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="approvals" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="approvals">
            Pending Approvals 
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingApprovals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rules">Automation Rules</TabsTrigger>
          <TabsTrigger value="pipelines">Content Pipelines</TabsTrigger>
          <TabsTrigger value="learning">Learning Dashboard</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="approvals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Content Awaiting Your Approval
              </CardTitle>
              <CardDescription>
                Review AI-generated content before it goes live
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>All content approved! No items pending.</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <Card key={approval.id} className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold">{approval.generated_content.title}</h3>
                          <p className="text-sm text-muted-foreground">{approval.pipeline}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            approval.urgency === 'high' ? 'destructive' :
                            approval.urgency === 'medium' ? 'default' : 'secondary'
                          }>
                            {approval.urgency}
                          </Badge>
                          <Badge variant="outline">
                            Score: {approval.estimated_performance}/10
                          </Badge>
                        </div>
                      </div>

                      {/* AI Suggestions */}
                      {approval.suggestions && approval.suggestions.length > 0 && (
                        <div className="mb-4">
                          <Label className="text-xs font-medium flex items-center gap-1 mb-2">
                            <Lightbulb className="w-3 h-3" />
                            AI Suggestions (learned from your feedback)
                          </Label>
                          <div className="space-y-2">
                            {approval.suggestions.map((suggestion, idx) => (
                              <div key={idx} className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium capitalize">{suggestion.aspect}:</span>
                                  <Badge variant="outline" className="text-xs">
                                    {Math.round(suggestion.confidence * 100)}% confidence
                                  </Badge>
                                </div>
                                <div className="text-muted-foreground mb-1">"{suggestion.before}"</div>
                                <div className="font-medium text-blue-700 mb-1">→ "{suggestion.after}"</div>
                                <div className="text-xs text-muted-foreground mb-2">{suggestion.reasoning}</div>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => applySuggestion(approval.id, suggestion)}
                                  className="text-xs h-6"
                                >
                                  Apply Suggestion
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="space-y-2 mb-4">
                        <div>
                          <Label className="text-xs font-medium">Hook:</Label>
                          {editingContent === approval.id ? (
                            <Textarea 
                              value={approval.generated_content.hook}
                              onChange={(e) => {
                                const newContent = { ...approval.generated_content, hook: e.target.value };
                                setPendingApprovals(prev => 
                                  prev.map(a => a.id === approval.id ? {...a, generated_content: newContent} : a)
                                );
                                updateFeedback(approval.id, 'edits', { 
                                  ...feedbackData[approval.id]?.edits, 
                                  hook: e.target.value 
                                });
                              }}
                              className="text-sm mt-1"
                              rows={2}
                            />
                          ) : (
                            <p className="text-sm">{approval.generated_content.hook}</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Script Preview:</Label>
                          {editingContent === approval.id ? (
                            <Textarea 
                              value={approval.generated_content.script}
                              onChange={(e) => {
                                const newContent = { ...approval.generated_content, script: e.target.value };
                                setPendingApprovals(prev => 
                                  prev.map(a => a.id === approval.id ? {...a, generated_content: newContent} : a)
                                );
                                updateFeedback(approval.id, 'edits', { 
                                  ...feedbackData[approval.id]?.edits, 
                                  script: e.target.value 
                                });
                              }}
                              className="text-sm text-muted-foreground mt-1"
                              rows={3}
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground">{approval.generated_content.script}</p>
                          )}
                        </div>
                      </div>

                      {/* Feedback Section - shown when editing */}
                      {editingContent === approval.id && (
                        <div className="mb-4 p-3 bg-gray-50 rounded border">
                          <Label className="text-xs font-medium mb-2 block">Help the AI learn from your feedback:</Label>
                          
                          <div className="space-y-3">
                            <div>
                              <Label className="text-xs">Rate this content (1-10):</Label>
                              <div className="flex gap-1 mt-1">
                                {[...Array(10)].map((_, i) => (
                                  <Button
                                    key={i}
                                    variant={feedbackData[approval.id]?.rating === i + 1 ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => updateFeedback(approval.id, 'rating', i + 1)}
                                    className="w-8 h-8 p-0 text-xs"
                                  >
                                    {i + 1}
                                  </Button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <Label className="text-xs">What should the AI improve next time?</Label>
                              <Textarea
                                value={feedbackData[approval.id]?.notes || ''}
                                onChange={(e) => updateFeedback(approval.id, 'notes', e.target.value)}
                                placeholder="e.g., Make hooks more engaging, use more specific numbers, add urgency..."
                                className="text-xs mt-1"
                                rows={2}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {editingContent === approval.id ? (
                          <>
                            <Button 
                              onClick={() => approveContent(approval.id, true, feedbackData[approval.id])}
                              className="flex-1"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Save & Publish
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => setEditingContent(null)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => approveContent(approval.id, false, feedbackData[approval.id])}
                            >
                              <ThumbsDown className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button 
                              onClick={() => approveContent(approval.id, true)}
                              className="flex-1"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Quick Approve
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => startEditing(approval.id)}
                              className="flex-1"
                            >
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit & Feedback
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => approveContent(approval.id, false)}
                            >
                              <ThumbsDown className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Automation Rules</h2>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Create New Rule
            </Button>
          </div>

          <div className="grid gap-4">
            {automationRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        {rule.name}
                        {rule.status === 'active' ? (
                          <Play className="w-4 h-4 text-green-500" />
                        ) : rule.status === 'paused' ? (
                          <Pause className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-blue-500" />
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {rule.trigger} → {rule.action}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Next: {new Date(rule.next_run).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{rule.success_rate}% success</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAutomationRule(rule.id)}
                      >
                        {rule.status === 'active' ? 'Pause' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Content Pipelines</h2>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Pipeline
            </Button>
          </div>

          <div className="grid gap-4">
            {contentPipelines.map((pipeline) => (
              <Card key={pipeline.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{pipeline.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Input: {pipeline.input_type} | Output: {pipeline.output_platforms.join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {pipeline.approval_required && (
                        <Badge variant="secondary">Manual Approval</Badge>
                      )}
                      {pipeline.auto_publish && (
                        <Badge variant="default">Auto-Publish</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Processing Steps:</Label>
                    <div className="flex flex-wrap gap-2">
                      {pipeline.processing_steps.map((step, index) => (
                        <Badge key={index} variant="outline">{step}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Learning Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Learning Progress
                </CardTitle>
                <CardDescription>
                  How the AI is improving based on your feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">47</div>
                    <div className="text-xs text-muted-foreground">Feedback Entries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">12</div>
                    <div className="text-xs text-muted-foreground">Learned Patterns</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">89%</div>
                    <div className="text-xs text-muted-foreground">Recent Approval Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">8.2</div>
                    <div className="text-xs text-muted-foreground">Avg Content Score</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Your Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Your Content Preferences
                </CardTitle>
                <CardDescription>
                  Patterns learned from your feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium">Hooks you love:</Label>
                    <div className="text-sm text-muted-foreground">
                      • Questions that create curiosity<br/>
                      • Specific numbers and timeframes<br/>
                      • Urgent language ("you need to know")
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Script style:</Label>
                    <div className="text-sm text-muted-foreground">
                      • Personal experience stories<br/>
                      • Direct, no-fluff approach<br/>
                      • Scientific backing when possible
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Avoid:</Label>
                    <div className="text-sm text-muted-foreground">
                      • Generic advice<br/>
                      • Overly promotional tone
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Learning Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Learning Activity</CardTitle>
              <CardDescription>Latest improvements based on your feedback</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  {
                    date: "Mar 30, 2026",
                    learning: "User prefers hooks with specific timeframes",
                    example: '"3 weeks" instead of "quickly"',
                    confidence: 85
                  },
                  {
                    date: "Mar 29, 2026", 
                    learning: "Add personal experience to scripts",
                    example: '"In my 5 years of coaching..." approach',
                    confidence: 78
                  },
                  {
                    date: "Mar 28, 2026",
                    learning: "Avoid generic health claims",
                    example: 'Specific benefits over vague "better health"',
                    confidence: 92
                  }
                ].map((item, idx) => (
                  <div key={idx} className="border-l-4 border-l-blue-500 pl-4 py-2">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium">{item.learning}</span>
                      <Badge variant="outline">{item.confidence}% confidence</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{item.example}</div>
                    <div className="text-xs text-muted-foreground">{item.date}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Automation Performance
              </CardTitle>
              <CardDescription>
                Track the effectiveness of your automated content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4" />
                <p>Performance analytics coming soon...</p>
                <p className="text-xs mt-2">Integration with social media APIs in progress</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}