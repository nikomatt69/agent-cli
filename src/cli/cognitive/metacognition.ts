// 🧠 Meta-Cognitive System for Self-Reflection and Self-Improvement
import { 
  Task, TaskResult, Performance, Insights, Learning, 
  Improvement, Recommendation, ThoughtStep
} from './types';

export interface MetaCognitiveState {
  currentCapabilities: Capability[];
  knownLimitations: Limitation[];
  learningGoals: LearningGoal[];
  confidenceLevel: number;
  metacognitiveAwareness: number;
  selfModel: SelfModel;
}

export interface Capability {
  id: string;
  domain: string;
  name: string;
  proficiencyLevel: number;
  confidence: number;
  evidence: Evidence[];
  lastUpdated: number;
}

export interface Limitation {
  id: string;
  domain: string;
  description: string;
  severity: LimitationSeverity;
  mitigationStrategies: MitigationStrategy[];
  identifiedAt: number;
}

export interface LearningGoal {
  id: string;
  description: string;
  targetCapability: string;
  currentProgress: number;
  targetDate: number;
  strategies: LearningStrategy[];
  priority: Priority;
}

export interface SelfModel {
  strengths: string[];
  weaknesses: string[];
  preferredStrategies: string[];
  biases: CognitiveBias[];
  performancePatterns: PerformancePattern[];
  adaptabilityScore: number;
}

export interface Evidence {
  taskId: string;
  performance: Performance;
  timestamp: number;
  context: string;
}

export interface MitigationStrategy {
  strategy: string;
  effectiveness: number;
  applicableContexts: string[];
}

export interface LearningStrategy {
  type: LearningStrategyType;
  description: string;
  effectiveness: number;
  timeEstimate: number;
}

export interface CognitiveBias {
  type: BiasType;
  description: string;
  strength: number;
  mitigationTechniques: string[];
}

export interface PerformancePattern {
  context: string;
  avgPerformance: number;
  variance: number;
  trendDirection: TrendDirection;
  keyFactors: string[];
}

export interface ReflectionResult {
  insights: MetaCognitiveInsight[];
  selfAssessment: SelfAssessment;
  improvementPlan: ImprovementPlan;
  confidenceAdjustment: number;
  learningRecommendations: LearningRecommendation[];
}

export interface MetaCognitiveInsight {
  type: InsightType;
  description: string;
  confidence: number;
  evidence: Evidence[];
  implications: string[];
  actionable: boolean;
}

export interface SelfAssessment {
  overallCompetence: number;
  domainCompetencies: Record<string, number>;
  metacognitiveAccuracy: number;
  learningRate: number;
  adaptability: number;
}

export interface ImprovementPlan {
  shortTermGoals: Goal[];
  longTermGoals: Goal[];
  strategicInitiatives: Initiative[];
  resourceRequirements: ResourceRequirement[];
}

export interface Goal {
  id: string;
  description: string;
  targetMetric: string;
  currentValue: number;
  targetValue: number;
  deadline: number;
  strategies: string[];
}

export interface Initiative {
  id: string;
  name: string;
  description: string;
  expectedImpact: number;
  effort: number;
  timeline: number;
}

export interface LearningRecommendation {
  capability: string;
  recommendation: string;
  rationale: string;
  priority: Priority;
  estimatedImpact: number;
}

export enum LimitationSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LearningStrategyType {
  PRACTICE = 'practice',
  STUDY = 'study',
  EXPERIMENTATION = 'experimentation',
  FEEDBACK_ANALYSIS = 'feedback_analysis',
  PATTERN_RECOGNITION = 'pattern_recognition'
}

export enum BiasType {
  CONFIRMATION = 'confirmation',
  OVERCONFIDENCE = 'overconfidence',
  ANCHORING = 'anchoring',
  AVAILABILITY = 'availability',
  RECENCY = 'recency'
}

export enum TrendDirection {
  IMPROVING = 'improving',
  DECLINING = 'declining',
  STABLE = 'stable',
  VOLATILE = 'volatile'
}

export enum InsightType {
  PERFORMANCE = 'performance',
  LEARNING = 'learning',
  CAPABILITY = 'capability',
  LIMITATION = 'limitation',
  BIAS = 'bias',
  STRATEGY = 'strategy'
}

export class MetaCognitiveSystem {
  private state: MetaCognitiveState;
  private performanceHistory: Map<string, Performance[]> = new Map();
  private reflectionHistory: ReflectionResult[] = [];
  private learningEvents: LearningEvent[] = [];

  constructor() {
    this.state = this.initializeState();
  }

  async reflectOnPerformance(task: Task, result: TaskResult): Promise<Insights> {
    // Deep performance analysis
    const performance = await this.analyzePerformance(task, result);
    
    // Identify what went well and what could be improved
    const improvements = await this.identifyImprovements(performance, task, result);
    
    // Extract learnings from this experience
    const learnings = await this.extractLearnings(task, result, performance);
    
    // Update internal models based on reflection
    await this.updateInternalModels(improvements, learnings, performance);
    
    // Assess confidence in the results
    const confidence = this.calculateConfidence(result, performance);
    
    // Generate actionable recommendations
    const recommendations = await this.generateRecommendations(task, result, performance);
    
    return {
      performance,
      improvements,
      learnings,
      confidence,
      recommendations,
      patterns: await this.identifyNewPatterns(task, result, performance)
    };
  }

  async performSelfReflection(): Promise<ReflectionResult> {
    // Analyze recent performance trends
    const performanceInsights = await this.analyzePerformanceTrends();
    
    // Assess current capabilities
    const capabilityInsights = await this.assessCapabilities();
    
    // Identify limitations and biases
    const limitationInsights = await this.identifyLimitations();
    
    // Evaluate learning progress
    const learningInsights = await this.evaluateLearningProgress();
    
    const allInsights: MetaCognitiveInsight[] = [
      ...performanceInsights,
      ...capabilityInsights,
      ...limitationInsights,
      ...learningInsights
    ];
    
    // Perform self-assessment
    const selfAssessment = await this.performSelfAssessment();
    
    // Create improvement plan
    const improvementPlan = await this.createImprovementPlan(allInsights, selfAssessment);
    
    // Adjust confidence based on self-reflection
    const confidenceAdjustment = this.calculateConfidenceAdjustment(allInsights);
    
    // Generate learning recommendations
    const learningRecommendations = await this.generateLearningRecommendations(allInsights);
    
    const reflectionResult: ReflectionResult = {
      insights: allInsights,
      selfAssessment,
      improvementPlan,
      confidenceAdjustment,
      learningRecommendations
    };
    
    // Store reflection result
    this.reflectionHistory.push(reflectionResult);
    
    // Update metacognitive state
    await this.updateMetacognitiveState(reflectionResult);
    
    return reflectionResult;
  }

  async calibrateConfidence(task: Task, predictedPerformance: Performance, actualPerformance: Performance): Promise<void> {
    // Calculate calibration error
    const calibrationError = this.calculateCalibrationError(predictedPerformance, actualPerformance);
    
    // Update confidence calibration model
    await this.updateConfidenceCalibration(task, calibrationError);
    
    // Identify overconfidence or underconfidence patterns
    const confidencePattern = this.identifyConfidencePattern(calibrationError);
    
    // Adjust future confidence predictions
    await this.adjustConfidencePrediction(confidencePattern);
  }

  async identifyBiases(): Promise<CognitiveBias[]> {
    const biases: CognitiveBias[] = [];
    
    // Analyze decision patterns for confirmation bias
    const confirmationBias = await this.detectConfirmationBias();
    if (confirmationBias.strength > 0.3) {
      biases.push(confirmationBias);
    }
    
    // Analyze confidence patterns for overconfidence bias
    const overconfidenceBias = await this.detectOverconfidenceBias();
    if (overconfidenceBias.strength > 0.3) {
      biases.push(overconfidenceBias);
    }
    
    // Analyze attention patterns for availability bias
    const availabilityBias = await this.detectAvailabilityBias();
    if (availabilityBias.strength > 0.3) {
      biases.push(availabilityBias);
    }
    
    // Analyze temporal patterns for recency bias
    const recencyBias = await this.detectRecencyBias();
    if (recencyBias.strength > 0.3) {
      biases.push(recencyBias);
    }
    
    return biases;
  }

  async adaptStrategies(context: string, performance: Performance): Promise<void> {
    // Analyze current strategy effectiveness
    const strategyEffectiveness = await this.analyzeStrategyEffectiveness(context);
    
    // Identify underperforming strategies
    const underperformingStrategies = strategyEffectiveness.filter(s => s.effectiveness < 0.6);
    
    // Generate alternative strategies
    for (const strategy of underperformingStrategies) {
      const alternatives = await this.generateAlternativeStrategies(strategy.context);
      await this.evaluateAlternatives(alternatives, strategy);
    }
    
    // Update strategy preferences
    await this.updateStrategyPreferences(strategyEffectiveness);
  }

  async learnFromFeedback(feedback: UserFeedback): Promise<void> {
    // Parse feedback for learning signals
    const learningSignals = this.extractLearningSignals(feedback);
    
    // Update performance models
    await this.updatePerformanceModels(learningSignals);
    
    // Adjust capability assessments
    await this.adjustCapabilityAssessments(learningSignals);
    
    // Update limitation awareness
    await this.updateLimitationAwareness(learningSignals);
    
    // Create learning event
    const learningEvent: LearningEvent = {
      id: `feedback_${Date.now()}`,
      type: 'user_feedback',
      timestamp: Date.now(),
      signals: learningSignals,
      impact: this.calculateLearningImpact(learningSignals)
    };
    
    this.learningEvents.push(learningEvent);
  }

  async generateSelfExplanation(result: TaskResult, reasoning: string): Promise<SelfExplanation> {
    // Analyze the reasoning process
    const reasoningAnalysis = this.analyzeReasoning(reasoning);
    
    // Identify key decision points
    const decisionPoints = this.identifyDecisionPoints(reasoning);
    
    // Assess reasoning quality
    const reasoningQuality = this.assessReasoningQuality(reasoningAnalysis);
    
    // Generate explanation
    const explanation = await this.generateExplanation(result, reasoningAnalysis, decisionPoints);
    
    // Assess explanation quality
    const explanationQuality = this.assessExplanationQuality(explanation);
    
    return {
      explanation,
      reasoningAnalysis,
      decisionPoints,
      reasoningQuality,
      explanationQuality,
      confidence: this.calculateExplanationConfidence(explanation, reasoningQuality)
    };
  }

  // Private implementation methods
  private initializeState(): MetaCognitiveState {
    return {
      currentCapabilities: this.initializeCapabilities(),
      knownLimitations: [],
      learningGoals: [],
      confidenceLevel: 0.5,
      metacognitiveAwareness: 0.3,
      selfModel: this.initializeSelfModel()
    };
  }

  private initializeCapabilities(): Capability[] {
    return [
      {
        id: 'code_generation',
        domain: 'programming',
        name: 'Code Generation',
        proficiencyLevel: 0.7,
        confidence: 0.6,
        evidence: [],
        lastUpdated: Date.now()
      },
      {
        id: 'problem_solving',
        domain: 'reasoning',
        name: 'Problem Solving',
        proficiencyLevel: 0.6,
        confidence: 0.5,
        evidence: [],
        lastUpdated: Date.now()
      },
      {
        id: 'pattern_recognition',
        domain: 'analysis',
        name: 'Pattern Recognition',
        proficiencyLevel: 0.5,
        confidence: 0.4,
        evidence: [],
        lastUpdated: Date.now()
      }
    ];
  }

  private initializeSelfModel(): SelfModel {
    return {
      strengths: ['systematic_analysis', 'code_structure'],
      weaknesses: ['domain_specific_knowledge', 'creative_solutions'],
      preferredStrategies: ['step_by_step', 'modular_approach'],
      biases: [],
      performancePatterns: [],
      adaptabilityScore: 0.5
    };
  }

  private async analyzePerformance(task: Task, result: TaskResult): Promise<Performance> {
    // Measure multiple dimensions of performance
    const accuracy = await this.measureAccuracy(result, task);
    const efficiency = this.measureEfficiency(task, result);
    const completeness = await this.assessCompleteness(task, result);
    const codeQuality = await this.assessCodeQuality(result);
    const userSatisfaction = this.predictUserSatisfaction(result);
    
    const performance: Performance = {
      accuracy,
      efficiency,
      completeness,
      codeQuality,
      userSatisfaction,
      executionTime: (result as any).executionTime || 0,
      resourceUsage: (result as any).resourceUsage || { cpu: 0, memory: 0 }
    };
    
    // Store performance history
    const taskType = task.type.toString();
    if (!this.performanceHistory.has(taskType)) {
      this.performanceHistory.set(taskType, []);
    }
    this.performanceHistory.get(taskType)!.push(performance);
    
    return performance;
  }

  private async identifyImprovements(performance: Performance, task: Task, result: TaskResult): Promise<Improvement[]> {
    const improvements: Improvement[] = [];
    
    // Accuracy improvements
    if (performance.accuracy < 0.8) {
      improvements.push({
        area: 'accuracy',
        description: 'Improve accuracy through better validation',
        priority: Priority.HIGH,
        estimatedImpact: 0.8 - performance.accuracy,
        strategies: ['add_validation_steps', 'use_multiple_approaches']
      });
    }
    
    // Efficiency improvements
    if (performance.efficiency < 0.7) {
      improvements.push({
        area: 'efficiency',
        description: 'Optimize approach for better efficiency',
        priority: Priority.MEDIUM,
        estimatedImpact: 0.7 - performance.efficiency,
        strategies: ['optimize_algorithms', 'reduce_iterations']
      });
    }
    
    // Code quality improvements
    if (performance.codeQuality < 0.8) {
      improvements.push({
        area: 'code_quality',
        description: 'Improve code structure and readability',
        priority: Priority.MEDIUM,
        estimatedImpact: 0.8 - performance.codeQuality,
        strategies: ['refactor_code', 'add_documentation', 'improve_naming']
      });
    }
    
    return improvements;
  }

  private async extractLearnings(task: Task, result: TaskResult, performance: Performance): Promise<Learning[]> {
    const learnings: Learning[] = [];
    
    // Task-specific learnings
    if (performance.accuracy > 0.9) {
      learnings.push({
        type: 'success_pattern',
        description: `Successful approach for ${task.type} tasks`,
        confidence: 0.9,
        evidence: [{ taskId: task.id, performance, timestamp: Date.now(), context: task.type.toString() }],
        applicability: [task.type.toString()]
      });
    }
    
    // Strategy learnings
    const strategyEffectiveness = performance.accuracy * performance.efficiency;
    if (strategyEffectiveness > 0.8) {
      learnings.push({
        type: 'strategy_effectiveness',
        description: 'Current strategy is highly effective',
        confidence: strategyEffectiveness,
        evidence: [{ taskId: task.id, performance, timestamp: Date.now(), context: 'strategy' }],
        applicability: ['similar_tasks']
      });
    }
    
    return learnings;
  }

  private async updateInternalModels(improvements: Improvement[], learnings: Learning[], performance: Performance): Promise<void> {
    // Update capability assessments
    for (const capability of this.state.currentCapabilities) {
      const evidence: Evidence = {
        taskId: 'current',
        performance,
        timestamp: Date.now(),
        context: capability.domain
      };
      
      capability.evidence.push(evidence);
      
      // Update proficiency based on recent performance
      const recentPerformance = capability.evidence
        .slice(-5)
        .map(e => e.performance.accuracy)
        .reduce((sum, acc) => sum + acc, 0) / Math.min(5, capability.evidence.length);
      
      capability.proficiencyLevel = recentPerformance;
      capability.lastUpdated = Date.now();
    }
    
    // Update limitations based on improvements needed
    for (const improvement of improvements) {
      if (improvement.priority === Priority.HIGH) {
        const limitation: Limitation = {
          id: `lim_${Date.now()}_${improvement.area}`,
          domain: improvement.area,
          description: improvement.description,
          severity: this.mapPriorityToSeverity(improvement.priority),
          mitigationStrategies: improvement.strategies.map(s => ({
            strategy: s,
            effectiveness: 0.7, // Default estimate
            applicableContexts: ['general']
          })),
          identifiedAt: Date.now()
        };
        
        this.state.knownLimitations.push(limitation);
      }
    }
    
    // Update self-model based on learnings
    for (const learning of learnings) {
      if (learning.type === 'success_pattern') {
        // Add to strengths if not already present
        const strengthKey = learning.description.toLowerCase().replace(/\s+/g, '_');
        if (!this.state.selfModel.strengths.includes(strengthKey)) {
          this.state.selfModel.strengths.push(strengthKey);
        }
      }
    }
  }

  private calculateConfidence(result: TaskResult, performance: Performance): number {
    // Multi-factor confidence calculation
    const factors = [
      performance.accuracy,
      performance.completeness,
      performance.codeQuality,
      this.state.confidenceLevel
    ];
    
    const weightedSum = factors.reduce((sum, factor, index) => {
      const weight = [0.3, 0.2, 0.2, 0.3][index]; // Weights for each factor
      return sum + factor * weight;
    }, 0);
    
    // Apply metacognitive awareness adjustment
    const adjustment = this.state.metacognitiveAwareness * 0.1;
    
    return Math.max(0, Math.min(1, weightedSum - adjustment));
  }

  private async generateRecommendations(task: Task, result: TaskResult, performance: Performance): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Performance-based recommendations
    if (performance.accuracy < 0.8) {
      recommendations.push({
        type: 'improvement',
        description: 'Add validation steps to improve accuracy',
        rationale: `Current accuracy (${performance.accuracy.toFixed(2)}) is below optimal threshold`,
        priority: Priority.HIGH,
        estimatedImpact: 0.2,
        actionable: true
      });
    }
    
    if (performance.efficiency < 0.7) {
      recommendations.push({
        type: 'optimization',
        description: 'Optimize approach for better efficiency',
        rationale: `Current efficiency (${performance.efficiency.toFixed(2)}) can be improved`,
        priority: Priority.MEDIUM,
        estimatedImpact: 0.15,
        actionable: true
      });
    }
    
    return recommendations;
  }

  private async identifyNewPatterns(task: Task, result: TaskResult, performance: Performance): Promise<any[]> {
    // Identify patterns in performance data
    const patterns = [];
    
    // Task type performance pattern
    const taskTypeHistory = this.performanceHistory.get(task.type.toString()) || [];
    if (taskTypeHistory.length >= 3) {
      const trend = this.calculateTrend(taskTypeHistory.map(p => p.accuracy));
      if (Math.abs(trend) > 0.1) {
        patterns.push({
          type: 'performance_trend',
          context: task.type.toString(),
          trend: trend > 0 ? 'improving' : 'declining',
          strength: Math.abs(trend),
          confidence: 0.7
        });
      }
    }
    
    return patterns;
  }

  // Placeholder implementations for complex methods
  private async measureAccuracy(result: TaskResult, task: Task): Promise<number> {
    // Simplified accuracy measurement
    // In a real implementation, this would compare against expected results
    return 0.8;
  }

  private measureEfficiency(task: Task, result: TaskResult): number {
    // Simplified efficiency measurement
    const complexity = task.complexity === 'simple' ? 1 : task.complexity === 'moderate' ? 2 : 3;
    const baseEfficiency = 0.8;
    return Math.max(0.1, baseEfficiency - (complexity - 1) * 0.1);
  }

  private async assessCompleteness(task: Task, result: TaskResult): Promise<number> {
    // Simplified completeness assessment
    return 0.85;
  }

  private async assessCodeQuality(result: TaskResult): Promise<number> {
    // Simplified code quality assessment
    return 0.75;
  }

  private predictUserSatisfaction(result: TaskResult): number {
    // Simplified user satisfaction prediction
    return 0.8;
  }

  private mapPriorityToSeverity(priority: Priority): LimitationSeverity {
    switch (priority) {
      case Priority.CRITICAL: return LimitationSeverity.CRITICAL;
      case Priority.HIGH: return LimitationSeverity.HIGH;
      case Priority.MEDIUM: return LimitationSeverity.MEDIUM;
      case Priority.LOW: return LimitationSeverity.LOW;
      default: return LimitationSeverity.MEDIUM;
    }
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = n * (n + 1) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, index) => sum + val * (index + 1), 0);
    const sumX2 = n * (n + 1) * (2 * n + 1) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  // Additional placeholder methods for full implementation
  private async analyzePerformanceTrends(): Promise<MetaCognitiveInsight[]> { return []; }
  private async assessCapabilities(): Promise<MetaCognitiveInsight[]> { return []; }
  private async identifyLimitations(): Promise<MetaCognitiveInsight[]> { return []; }
  private async evaluateLearningProgress(): Promise<MetaCognitiveInsight[]> { return []; }
  private async performSelfAssessment(): Promise<SelfAssessment> { 
    return {
      overallCompetence: 0.7,
      domainCompetencies: {},
      metacognitiveAccuracy: 0.6,
      learningRate: 0.5,
      adaptability: 0.6
    };
  }
  private async createImprovementPlan(insights: MetaCognitiveInsight[], assessment: SelfAssessment): Promise<ImprovementPlan> {
    return {
      shortTermGoals: [],
      longTermGoals: [],
      strategicInitiatives: [],
      resourceRequirements: []
    };
  }
  private calculateConfidenceAdjustment(insights: MetaCognitiveInsight[]): number { return 0; }
  private async generateLearningRecommendations(insights: MetaCognitiveInsight[]): Promise<LearningRecommendation[]> { return []; }
  private async updateMetacognitiveState(reflection: ReflectionResult): Promise<void> { }
  private calculateCalibrationError(predicted: Performance, actual: Performance): number { return 0; }
  private async updateConfidenceCalibration(task: Task, error: number): Promise<void> { }
  private identifyConfidencePattern(error: number): string { return 'neutral'; }
  private async adjustConfidencePrediction(pattern: string): Promise<void> { }
  private async detectConfirmationBias(): Promise<CognitiveBias> { 
    return { type: BiasType.CONFIRMATION, description: '', strength: 0, mitigationTechniques: [] };
  }
  private async detectOverconfidenceBias(): Promise<CognitiveBias> { 
    return { type: BiasType.OVERCONFIDENCE, description: '', strength: 0, mitigationTechniques: [] };
  }
  private async detectAvailabilityBias(): Promise<CognitiveBias> { 
    return { type: BiasType.AVAILABILITY, description: '', strength: 0, mitigationTechniques: [] };
  }
  private async detectRecencyBias(): Promise<CognitiveBias> { 
    return { type: BiasType.RECENCY, description: '', strength: 0, mitigationTechniques: [] };
  }
  private async analyzeStrategyEffectiveness(context: string): Promise<any[]> { return []; }
  private async generateAlternativeStrategies(context: string): Promise<any[]> { return []; }
  private async evaluateAlternatives(alternatives: any[], current: any): Promise<void> { }
  private async updateStrategyPreferences(effectiveness: any[]): Promise<void> { }
  private extractLearningSignals(feedback: any): any[] { return []; }
  private async updatePerformanceModels(signals: any[]): Promise<void> { }
  private async adjustCapabilityAssessments(signals: any[]): Promise<void> { }
  private async updateLimitationAwareness(signals: any[]): Promise<void> { }
  private calculateLearningImpact(signals: any[]): number { return 0.5; }
  private analyzeReasoning(reasoning: string): any { return {}; }
  private identifyDecisionPoints(reasoning: string): any[] { return []; }
  private assessReasoningQuality(analysis: any): number { return 0.7; }
  private async generateExplanation(result: TaskResult, analysis: any, points: any[]): Promise<string> { return 'Generated explanation'; }
  private assessExplanationQuality(explanation: string): number { return 0.8; }
  private calculateExplanationConfidence(explanation: string, quality: number): number { return quality * 0.9; }
}

// Supporting interfaces and types
interface UserFeedback {
  rating: number;
  comments: string;
  taskId: string;
  timestamp: number;
}

interface LearningEvent {
  id: string;
  type: string;
  timestamp: number;
  signals: any[];
  impact: number;
}

interface SelfExplanation {
  explanation: string;
  reasoningAnalysis: any;
  decisionPoints: any[];
  reasoningQuality: number;
  explanationQuality: number;
  confidence: number;
}

interface Improvement {
  area: string;
  description: string;
  priority: Priority;
  estimatedImpact: number;
  strategies: string[];
}

interface Learning {
  type: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
  applicability: string[];
}

interface Recommendation {
  type: string;
  description: string;
  rationale: string;
  priority: Priority;
  estimatedImpact: number;
  actionable: boolean;
}

interface ResourceRequirement {
  type: string;
  amount: number;
  description: string;
}