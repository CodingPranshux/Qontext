import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // Every user belongs to exactly one tenant. This is the source of truth that
    // gets baked into the JWT at login — never re-derived from client input.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
