import mongoose, { Schema, Document } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  slug: string;
  defaultFramework: string;
  passThreshold: number;
  isActive: boolean;
  industry?: string;
  contactEmail?: string;
  contactPhone?: string;
  registrationInfo?: string;
  maxAgents?: number;
  planTier: 'starter' | 'growth' | 'pro' | 'enterprise';
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    defaultFramework: { type: String, default: 'MEDDIC' },
    passThreshold: { type: Number, default: 70 },
    isActive: { type: Boolean, default: true },
    industry: String,
    contactEmail: String,
    contactPhone: String,
    registrationInfo: String,
    maxAgents: Number,
    planTier: { type: String, enum: ['starter', 'growth', 'pro', 'enterprise'], default: 'pro' },
  },
  { timestamps: true }
);

export const Company = mongoose.model<ICompany>('Company', CompanySchema);
