import mongoose, { Schema, Document } from 'mongoose';

export type UsageService = 'gemini' | 'elevenlabs_tts' | 'elevenlabs_convai';

export interface IUsageLog extends Document {
  service: UsageService;
  operation: string;
  sessionId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  model?: string;
  // Gemini
  promptTokens?: number;
  completionTokens?: number;
  // ElevenLabs TTS
  characters?: number;
  // ConvAI (tracked via session duration)
  durationSeconds?: number;
  estimatedCostUsd: number;
  createdAt: Date;
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    service: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    model: String,
    promptTokens: Number,
    completionTokens: Number,
    characters: Number,
    durationSeconds: Number,
    estimatedCostUsd: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', UsageLogSchema);
