import mongoose, { Schema, Document } from 'mongoose';

export interface IAssignmentTarget {
  scope: 'all' | 'team' | 'region' | 'individual';
  teamIds?: string[];
  regions?: string[];
  userIds?: mongoose.Types.ObjectId[];
}

export interface ITeamRoleplay extends Document {
  name: string;
  description?: string;
  scenarioConfig: {
    industry: string;
    roleplayType: string;
    personaContext: string;
    displayName: string;
    displayTitle: string;
    displayEmoji: string;
    difficulty: string;
    suggestedQuestions: string[];
    objections?: string[];
    voiceAgentId?: string;
  };
  isActive: boolean;
  companyId: mongoose.Types.ObjectId;
  createdById: mongoose.Types.ObjectId;
  assignmentTarget?: IAssignmentTarget;
  allowPeerListening: boolean;
  completionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const TeamRoleplaysSchema = new Schema<ITeamRoleplay>(
  {
    name: { type: String, required: true },
    description: String,
    scenarioConfig: {
      industry: String,
      roleplayType: String,
      personaContext: String,
      displayName: String,
      displayTitle: String,
      displayEmoji: String,
      difficulty: String,
      suggestedQuestions: [String],
      objections: [String],
      voiceAgentId: String,
    },
    isActive: { type: Boolean, default: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignmentTarget: {
      scope: String,
      teamIds: [String],
      regions: [String],
      userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    },
    allowPeerListening: { type: Boolean, default: false },
    completionCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const TeamRoleplay = mongoose.model<ITeamRoleplay>('TeamRoleplay', TeamRoleplaysSchema);
