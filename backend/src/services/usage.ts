/**
 * Usage tracking — logs Gemini and ElevenLabs API calls with estimated costs.
 *
 * Pricing references (approximate, update as pricing changes):
 *  Gemini 2.0 Flash  — $0.075 / 1M input tokens, $0.30 / 1M output tokens
 *  ElevenLabs TTS    — $0.15 / 1K characters (eleven_turbo_v2)
 *  ElevenLabs ConvAI — $0.08 / minute of conversation
 */
import mongoose from 'mongoose';
import { UsageLog, UsageService } from '../models/UsageLog';

// ── Pricing constants (USD) ───────────────────────────────────────────────────

const GEMINI_INPUT_PER_M_TOKEN  = 0.075;
const GEMINI_OUTPUT_PER_M_TOKEN = 0.30;
const EL_TTS_PER_K_CHARS        = 0.15;
const EL_CONVAI_PER_MINUTE      = 0.08;

// ── Cost helpers ──────────────────────────────────────────────────────────────

export function geminiCost(promptTokens: number, completionTokens: number): number {
  return (
    (promptTokens    / 1_000_000) * GEMINI_INPUT_PER_M_TOKEN +
    (completionTokens / 1_000_000) * GEMINI_OUTPUT_PER_M_TOKEN
  );
}

export function ttsCost(characters: number): number {
  return (characters / 1_000) * EL_TTS_PER_K_CHARS;
}

export function convaiCost(durationSeconds: number): number {
  return (durationSeconds / 60) * EL_CONVAI_PER_MINUTE;
}

// ── Log helpers (fire-and-forget — never block the caller) ────────────────────

interface BaseCtx {
  sessionId?: mongoose.Types.ObjectId | string;
  companyId?: mongoose.Types.ObjectId | string;
  userId?:    mongoose.Types.ObjectId | string;
}

export function logGeminiUsage(opts: {
  operation: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
} & BaseCtx): void {
  const cost = geminiCost(opts.promptTokens, opts.completionTokens);
  UsageLog.create({
    service: 'gemini' as UsageService,
    operation: opts.operation,
    modelName: opts.model,
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    userId: opts.userId,
    promptTokens: opts.promptTokens,
    completionTokens: opts.completionTokens,
    estimatedCostUsd: cost,
  }).catch(() => {}); // never throw
}

export function logTtsUsage(opts: {
  operation: string;
  characters: number;
} & BaseCtx): void {
  const cost = ttsCost(opts.characters);
  UsageLog.create({
    service: 'elevenlabs_tts' as UsageService,
    operation: opts.operation,
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    userId: opts.userId,
    characters: opts.characters,
    estimatedCostUsd: cost,
  }).catch(() => {});
}

export function logConvaiUsage(opts: {
  durationSeconds: number;
} & BaseCtx): void {
  const cost = convaiCost(opts.durationSeconds);
  UsageLog.create({
    service: 'elevenlabs_convai' as UsageService,
    operation: 'conversation',
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    userId: opts.userId,
    durationSeconds: opts.durationSeconds,
    estimatedCostUsd: cost,
  }).catch(() => {});
}
