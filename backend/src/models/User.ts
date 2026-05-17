import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'MANAGER' | 'AGENT';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId?: mongoose.Types.ObjectId;
  managerId?: mongoose.Types.ObjectId;
  avatarUrl?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  location?: string;
  region?: string;
  team?: string;
  territory?: string;
  zone?: string;
  refreshTokens: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    role: { type: String, enum: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'MANAGER', 'AGENT'], default: 'AGENT' },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
    managerId: { type: Schema.Types.ObjectId, ref: 'User' },
    avatarUrl: String,
    isActive: { type: Boolean, default: true },
    lastLoginAt: Date,
    location: String,
    region: String,
    team: String,
    territory: String,
    zone: String,
    refreshTokens: [{ type: String }],
  },
  { timestamps: true }
);

UserSchema.index({ companyId: 1 });
UserSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);
