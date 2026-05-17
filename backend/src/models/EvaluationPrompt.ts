import mongoose, { Schema, Document } from 'mongoose';

export interface IEvaluationPrompt extends Document {
  companyId?: mongoose.Types.ObjectId;
  roleplayType: string;
  displayName: string;
  scoringCriteria: {
    group: string;
    criteria: { question: string; hint?: string }[];
  }[];
  promptTemplate: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EvaluationPromptSchema = new Schema<IEvaluationPrompt>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    roleplayType: { type: String, required: true },
    displayName: { type: String, required: true },
    scoringCriteria: [
      {
        group: String,
        criteria: [{ question: String, hint: String }],
      },
    ],
    promptTemplate: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EvaluationPromptSchema.index({ roleplayType: 1, companyId: 1 });

export const EvaluationPrompt = mongoose.model<IEvaluationPrompt>('EvaluationPrompt', EvaluationPromptSchema);
