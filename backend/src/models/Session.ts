import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage {
  _id?: mongoose.Types.ObjectId;
  role: 'user' | 'assistant';
  content: string;
  timestampMs: number;
  audioUrl?: string;
}

export interface IFrameworkScore {
  _id?: mongoose.Types.ObjectId;
  component: string;
  score: number;
  feedback: string;
  evidence: string[];
}

export interface ITimelineEvent {
  _id?: mongoose.Types.ObjectId;
  type: 'ISSUE' | 'GOOD' | 'WARNING' | 'NEUTRAL';
  timestampMs: number;
  title: string;
  description: string;
  suggestion?: string;
  transcriptRef?: string;
  betterResponse?: string;
}

export interface IScenarioConfig {
  industry: string;
  roleplayType: string;
  personaContext: string;
  displayName: string;
  displayTitle: string;
  displayEmoji: string;
  difficulty: string;
  suggestedQuestions: string[];
  objections?: string[];
  aiCanEnd?: boolean;
  endCondition?: string;
  timeLimitMins?: number | null;
  avatarId?: string;
  elevenlabsVoiceId?: string;
  language?: string;
}

export interface ISession extends Document {
  type: 'PHONE_CALL' | 'ONLINE_MEETING';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  framework: string;
  totalScore?: number;
  durationSeconds?: number;
  recordingUrl?: string;
  aiFeedback?: string;
  analysisSkipped?: boolean;
  convaiConversationId?: string;
  startedAt?: Date;
  endedAt?: Date;
  userId: mongoose.Types.ObjectId;
  personaId?: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  scenarioConfig?: IScenarioConfig;
  messages: IMessage[];
  frameworkScores: IFrameworkScore[];
  timelineEvents: ITimelineEvent[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestampMs: { type: Number, required: true },
  audioUrl: String,
});

const FrameworkScoreSchema = new Schema<IFrameworkScore>({
  component: String,
  score: Number,
  feedback: String,
  evidence: [String],
});

const TimelineEventSchema = new Schema<ITimelineEvent>({
  type: { type: String, enum: ['ISSUE', 'GOOD', 'WARNING', 'NEUTRAL'] },
  timestampMs: Number,
  title: String,
  description: String,
  suggestion: String,
  transcriptRef: String,
  betterResponse: String,
});

const ScenarioConfigSchema = new Schema<IScenarioConfig>({
  industry: String,
  roleplayType: String,
  personaContext: String,
  displayName: String,
  displayTitle: String,
  displayEmoji: String,
  difficulty: String,
  suggestedQuestions: [String],
  objections: [String],
  aiCanEnd: Boolean,
  endCondition: String,
  timeLimitMins: Number,
  avatarId: String,
  elevenlabsVoiceId: String,
  language: String,
});

const SessionSchema = new Schema<ISession>(
  {
    type: { type: String, enum: ['PHONE_CALL', 'ONLINE_MEETING'], required: true },
    status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    framework: { type: String, required: true },
    totalScore: Number,
    durationSeconds: Number,
    recordingUrl: String,
    aiFeedback: String,
    analysisSkipped: Boolean,
    convaiConversationId: String,
    startedAt: Date,
    endedAt: Date,
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    personaId: { type: Schema.Types.ObjectId, ref: 'Persona' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    scenarioConfig: ScenarioConfigSchema,
    messages: [MessageSchema],
    frameworkScores: [FrameworkScoreSchema],
    timelineEvents: [TimelineEventSchema],
  },
  { timestamps: true }
);

SessionSchema.index({ userId: 1, createdAt: -1 });
SessionSchema.index({ companyId: 1, createdAt: -1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
