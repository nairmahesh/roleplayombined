import mongoose, { Schema, Document } from 'mongoose';

export interface IPersona extends Document {
  name: string;
  title: string;
  company?: string;
  industry?: string;
  emoji: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  personality: string;
  systemPrompt: string;
  objections: string[];
  buyingSignals: string[];
  frameworks: string[];
  isPreset: boolean;
  voiceId?: string;
  agentId?: string;
  companyId?: mongoose.Types.ObjectId;
  createdById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PersonaSchema = new Schema<IPersona>(
  {
    name: { type: String, required: true },
    title: { type: String, required: true },
    company: String,
    industry: String,
    emoji: { type: String, default: '' },
    difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'], default: 'MEDIUM' },
    personality: { type: String, default: '' },
    systemPrompt: { type: String, default: '' },
    objections: [String],
    buyingSignals: [String],
    frameworks: [String],
    isPreset: { type: Boolean, default: false },
    voiceId: String,
    agentId: String,
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Persona = mongoose.model<IPersona>('Persona', PersonaSchema);
