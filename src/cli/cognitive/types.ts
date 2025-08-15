// 🧠 Types for Advanced Cognitive Systems

export interface Task {
  id: string;
  type: TaskType;
  description: string;
  context: TaskContext;
  complexity: ComplexityLevel;
  priority: Priority;
  dependencies: string[];
  constraints: Constraint[];
  metadata: Record<string, any>;
}

export interface ComplexTask extends Task {
  subtasks: Task[];
  strategy: Strategy;
  reasoning: ReasoningChain;
}

export interface TaskContext {
  id: string;
  codebase: CodebaseContext;
  user: UserContext;
  environment: EnvironmentContext;
  history: HistoryContext;
  files: FileContext[];
  dependencies: DependencyContext[];
}

export interface CodebaseContext {
  rootPath: string;
  language: string;
  framework: string;
  patterns: CodePattern[];
  architecture: ArchitecturalPattern;
  style: CodingStyle;
  testingStrategy: TestingStrategy;
  size: number;
  complexity: number;
}

export interface ReasoningStage {
  id: string;
  name: string;
  type: ReasoningType;
  input: any;
  output: any;
  confidence: number;
  metadata: Record<string, any>;
}

export interface ReasoningPipeline {
  stages: ReasoningStage[];
  context: ReasoningContext;
  memory: WorkingMemory;
  currentStage: number;
  isComplete: boolean;
}

export interface ReasoningContext {
  task: Task;
  previousResults: ReasoningResult[];
  externalContext: TaskContext;
  constraints: ReasoningConstraint[];
  objectives: Objective[];
}

export interface WorkingMemory {
  shortTerm: Map<string, MemoryItem>;
  workingSet: MemoryItem[];
  attention: AttentionMechanism;
  capacity: number;
  currentLoad: number;
}

export interface MemoryItem {
  id: string;
  content: any;
  type: MemoryType;
  timestamp: number;
  relevance: number;
  associations: Association[];
  accessCount: number;
  lastAccess: number;
}

export interface ThoughtStep {
  id: string;
  content: string;
  type: ThoughtType;
  confidence: number;
  reasoning: string;
  corrections?: Correction[];
  metadata: Record<string, any>;
}

export interface ReasonedResponse {
  thoughtChain: ThoughtStep[];
  finalAnswer: any;
  confidence: number;
  reasoning: string;
  alternatives: Alternative[];
  uncertainty: UncertaintyMeasure;
}

export interface Strategy {
  id: string;
  name: string;
  type: StrategyType;
  description: string;
  steps: StrategyStep[];
  preconditions: Precondition[];
  expectedOutcome: ExpectedOutcome;
  riskLevel: RiskLevel;
  resourceRequirements: ResourceRequirement[];
  performance: PerformanceMetrics;
}

export interface Pattern {
  id: string;
  name: string;
  type: PatternType;
  description: string;
  structure: PatternStructure;
  examples: PatternExample[];
  applicability: ApplicabilityRule[];
  confidence: number;
  usage: UsageStatistics;
}

export interface CodePattern extends Pattern {
  syntactic: SyntacticPattern;
  semantic: SemanticPattern;
  architectural: ArchitecturalPattern;
  antiPattern?: AntiPattern;
}

export interface Performance {
  accuracy: number;
  efficiency: number;
  completeness: number;
  codeQuality: number;
  userSatisfaction: number;
  executionTime: number;
  resourceUsage: ResourceUsage;
}

export interface Insights {
  performance: Performance;
  improvements: Improvement[];
  learnings: Learning[];
  confidence: number;
  recommendations: Recommendation[];
  patterns: IdentifiedPattern[];
}

export interface LearningSignals {
  taskType: TaskType;
  userFeedback: UserFeedback;
  outcome: TaskOutcome;
  context: TaskContext;
  patterns: IdentifiedPattern[];
  performance: Performance;
}

export interface ConsensusResult {
  solution: any;
  confidence: number;
  reasoning: string;
  dissenting: DissentingView[];
  consensus: ConsensusMetrics;
  validation: ValidationResult;
}

export interface QualityMetrics {
  correctness: number;
  maintainability: number;
  performance: number;
  security: number;
  testability: number;
  readability: number;
  documentation: number;
  overall: number;
}

export interface GeneratedCode {
  code: string;
  explanation: string;
  confidence: number;
  suggestedImprovements: Improvement[];
  tests: TestCase[];
  documentation: Documentation;
}

export interface OptimalResult {
  solution: any;
  quality: QualityMetrics;
  reasoning: ReasoningChain;
  confidence: number;
  alternatives: Alternative[];
  metadata: ResultMetadata;
}

// Enums
export enum TaskType {
  CODE_GENERATION = 'code_generation',
  REFACTORING = 'refactoring',
  DEBUGGING = 'debugging',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  ARCHITECTURE = 'architecture',
  ANALYSIS = 'analysis',
  PLANNING = 'planning'
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  EXPERT = 'expert'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ReasoningType {
  DEDUCTIVE = 'deductive',
  INDUCTIVE = 'inductive',
  ABDUCTIVE = 'abductive',
  ANALOGICAL = 'analogical',
  CAUSAL = 'causal'
}

export enum MemoryType {
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  WORKING = 'working'
}

export enum ThoughtType {
  ANALYSIS = 'analysis',
  SYNTHESIS = 'synthesis',
  EVALUATION = 'evaluation',
  PLANNING = 'planning',
  REFLECTION = 'reflection'
}

export enum StrategyType {
  SEQUENTIAL = 'sequential',
  PARALLEL = 'parallel',
  ITERATIVE = 'iterative',
  RECURSIVE = 'recursive',
  HEURISTIC = 'heuristic'
}

export enum PatternType {
  SYNTACTIC = 'syntactic',
  SEMANTIC = 'semantic',
  ARCHITECTURAL = 'architectural',
  BEHAVIORAL = 'behavioral',
  DESIGN = 'design'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

// Helper types
export type ReasoningChain = ThoughtStep[];
export type ReasoningResult = any;
export type ReasoningConstraint = any;
export type Objective = any;
export type AttentionMechanism = any;
export type Association = any;
export type Correction = any;
export type Alternative = any;
export type UncertaintyMeasure = any;
export type StrategyStep = any;
export type Precondition = any;
export type ExpectedOutcome = any;
export type ResourceRequirement = any;
export type PerformanceMetrics = any;
export type PatternStructure = any;
export type PatternExample = any;
export type ApplicabilityRule = any;
export type UsageStatistics = any;
export type SyntacticPattern = any;
export type SemanticPattern = any;
export type ArchitecturalPattern = any;
export type AntiPattern = any;
export type ResourceUsage = any;
export type Improvement = any;
export type Learning = any;
export type Recommendation = any;
export type IdentifiedPattern = any;
export type UserFeedback = any;
export type TaskOutcome = any;
export type DissentingView = any;
export type ConsensusMetrics = any;
export type ValidationResult = any;
export type TestCase = any;
export type Documentation = any;
export type ResultMetadata = any;
export type Constraint = any;
export type UserContext = any;
export type EnvironmentContext = any;
export type HistoryContext = any;
export type FileContext = any;
export type DependencyContext = any;
export type CodingStyle = any;
export type TestingStrategy = any;