import { GoogleGenerativeAI } from '@google/generative-ai';
import mongoose from 'mongoose';
import { config } from '../config';
import { logGeminiUsage } from './usage';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);
const MODEL  = 'gemini-2.0-flash';
const model  = genAI.getGenerativeModel({ model: MODEL });

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Ctx {
  sessionId?: mongoose.Types.ObjectId | string;
  companyId?: mongoose.Types.ObjectId | string;
  userId?:    mongoose.Types.ObjectId | string;
}

function logUsage(
  operation: string,
  metadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined,
  ctx: Ctx,
): void {
  if (!metadata) return;
  logGeminiUsage({
    operation,
    model: MODEL,
    promptTokens:     metadata.promptTokenCount     ?? 0,
    completionTokens: metadata.candidatesTokenCount ?? 0,
    ...ctx,
  });
}

export async function generatePersonaResponse(
  systemPrompt: string,
  history: ConversationMessage[],
  framework: string,
  personaName: string,
  personaTitle: string,
  objections: string[],
  ctx: Ctx = {},
): Promise<string> {
  const fullSystem = `${systemPrompt}

You are ${personaName}, ${personaTitle}. Stay in character at all times.
The sales rep is practicing the ${framework} framework.
Your objections include: ${objections.join(', ')}.
Keep responses concise (1-3 sentences), realistic, and conversational.
Do not break character or mention the roleplay.`;

  const geminiHistory = history.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: geminiHistory, systemInstruction: fullSystem });
  const lastMessage = history[history.length - 1];
  const result = await chat.sendMessage(lastMessage?.content ?? '');
  logUsage('persona_response', result.response.usageMetadata, ctx);
  return result.response.text();
}

export async function generateSessionFeedback(
  transcript: string,
  framework: string,
  promptTemplate: string,
  ctx: Ctx = {},
): Promise<string> {
  const prompt = promptTemplate.replace('{transcript}', transcript).replace('{framework}', framework);
  const result = await model.generateContent(prompt);
  logUsage('session_feedback', result.response.usageMetadata, ctx);
  return result.response.text();
}

export async function generateScenario(
  industry: string,
  roleplayType: string,
  difficulty: string,
  ctx: Ctx = {},
): Promise<{
  personaContext: string;
  displayName: string;
  displayTitle: string;
  displayEmoji: string;
  difficulty: string;
  suggestedQuestions: string[];
  objections: string[];
}> {
  const prompt = `Create a realistic sales roleplay persona for the following scenario:
Industry: ${industry}
Roleplay type: ${roleplayType}
Difficulty: ${difficulty}

Return ONLY valid JSON with this exact structure:
{
  "personaContext": "<detailed system prompt for the AI persona, 3-5 sentences describing their personality, job pressures, and how they respond to sales reps>",
  "displayName": "<realistic full name>",
  "displayTitle": "<job title>, <company name>",
  "displayEmoji": "",
  "difficulty": "${difficulty}",
  "suggestedQuestions": ["<4 realistic questions or objections the prospect might ask>"],
  "objections": ["<2-3 common objections this persona would have>"]
}`;

  const result = await model.generateContent(prompt);
  logUsage('generate_scenario', result.response.usageMetadata, ctx);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(text);
}

export async function generatePracticeQuestions(
  industry: string,
  roleplayType: string,
  framework: string,
  ctx: Ctx = {},
): Promise<{ questions: string[] }> {
  const prompt = `Generate 5 coaching questions a sales trainer would ask a rep to self-reflect after a ${roleplayType} in the ${industry} industry using the ${framework} sales framework.
Return ONLY valid JSON: { "questions": ["<question>", ...] }`;

  const result = await model.generateContent(prompt);
  logUsage('practice_questions', result.response.usageMetadata, ctx);
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(text);
}
