/**
 * PitchIQ seed — fresh data aligned with the updated practice flow.
 *
 * Terminology:
 *   Prospect     = AI buyer/interviewer character (formerly "Persona")
 *   Scenario     = manager-assigned practice template (formerly "Team Roleplay")
 *   Conversation Objective = call type (formerly "Roleplay Type")
 *   Rep          = user role AGENT (DB enum unchanged; display label is "Rep")
 *   Voice Agent  = ElevenLabs ConvAI template (3–5 shared templates, NOT per-prospect)
 *
 * Run: npm run seed
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { Company } from './models/Company';
import { User } from './models/User';
import { Persona } from './models/Persona';
import { Session } from './models/Session';
import { TeamRoleplay } from './models/TeamRoleplay';
import { EvaluationPrompt } from './models/EvaluationPrompt';
import { UsageLog } from './models/UsageLog';
import { checkHealth, createAgent, getOrCreateAgentId } from './services/elevenlabs';
import { SystemConfig } from './models/SystemConfig';

const pw = (plain: string) => bcrypt.hashSync(plain, 12);

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  // ── Wipe everything ────────────────────────────────────────────────────────
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({}),
    Persona.deleteMany({}),
    Session.deleteMany({}),
    TeamRoleplay.deleteMany({}),
    EvaluationPrompt.deleteMany({}),
    UsageLog.deleteMany({}),
    SystemConfig.deleteMany({}),   // clears stale agent IDs from previous seed runs
  ]);
  console.log('Cleared all collections');

  // ── Companies ──────────────────────────────────────────────────────────────
  const acme = await Company.create({
    name: 'Acme SaaS', slug: 'acme-saas', defaultFramework: 'MEDDIC',
    passThreshold: 70, isActive: true, industry: 'SaaS', planTier: 'pro',
  });
  const finbridge = await Company.create({
    name: 'FinBridge', slug: 'finbridge', defaultFramework: 'BANT',
    passThreshold: 75, isActive: true, industry: 'Banking', planTier: 'growth',
  });
  console.log(`Created companies: ${acme.name}, ${finbridge.name}`);

  // ── Users ──────────────────────────────────────────────────────────────────
  await User.create({
    email: 'superadmin@demo.com', passwordHash: pw('Demo1234!'),
    firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN', isActive: true,
  });

  const admin = await User.create({
    email: 'admin@demo.com', passwordHash: pw('Demo1234!'),
    firstName: 'Dana', lastName: 'Brooks', role: 'COMPANY_ADMIN',
    companyId: acme._id, isActive: true,
  });

  const manager = await User.create({
    email: 'manager@demo.com', passwordHash: pw('Demo1234!'),
    firstName: 'Jamie', lastName: 'Scott', role: 'MANAGER',
    companyId: acme._id, isActive: true,
    location: 'London', region: 'EMEA', team: 'Enterprise',
  });

  const rep = await User.create({
    email: 'rep@demo.com', passwordHash: pw('Demo1234!'),
    firstName: 'Alex', lastName: 'Rivera', role: 'AGENT',
    companyId: acme._id, managerId: manager._id, isActive: true,
    location: 'New York', region: 'North America', team: 'Enterprise',
    territory: 'East Coast', zone: 'Northeast',
  });

  const reps = await User.insertMany([
    { email: 'jordan@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Jordan', lastName: 'Lee',     role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'San Francisco', region: 'North America', team: 'Enterprise', territory: 'West Coast',   zone: 'Pacific' },
    { email: 'taylor@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Taylor', lastName: 'Morgan',  role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'Chicago',       region: 'North America', team: 'Enterprise', territory: 'Midwest',      zone: 'Central' },
    { email: 'morgan@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Morgan', lastName: 'Kim',     role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'Austin',        region: 'North America', team: 'SMB',        territory: 'South',        zone: 'Central' },
    { email: 'sam@demo.com',    passwordHash: pw('Demo1234!'), firstName: 'Sam',    lastName: 'Patel',   role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'London',        region: 'EMEA',          team: 'SMB',        territory: 'UK & Ireland', zone: 'Northern Europe' },
    { email: 'casey@demo.com',  passwordHash: pw('Demo1234!'), firstName: 'Casey',  lastName: 'Zhang',   role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'Singapore',     region: 'APAC',          team: 'Enterprise', territory: 'SEA',          zone: 'Southeast Asia' },
    { email: 'riley@demo.com',  passwordHash: pw('Demo1234!'), firstName: 'Riley',  lastName: 'Johnson', role: 'AGENT', companyId: acme._id, managerId: manager._id, isActive: true, location: 'Sydney',        region: 'APAC',          team: 'SMB',        territory: 'ANZ',          zone: 'Pacific' },
  ]);

  await User.create({
    email: 'financeadmin@demo.com', passwordHash: pw('Demo1234!'),
    firstName: 'Lisa', lastName: 'Park', role: 'COMPANY_ADMIN',
    companyId: finbridge._id, isActive: true,
  });
  await User.insertMany([
    { email: 'noah@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Noah', lastName: 'Webb',   role: 'AGENT', companyId: finbridge._id, isActive: true, location: 'New York', region: 'North America', team: 'Sales' },
    { email: 'mia@demo.com',  passwordHash: pw('Demo1234!'), firstName: 'Mia',  lastName: 'Torres', role: 'AGENT', companyId: finbridge._id, isActive: true, location: 'London',   region: 'EMEA',          team: 'Sales' },
  ]);
  console.log('Created users');

  // ── Prospects (AI buyer/interviewer characters) ────────────────────────────
  // agentId is intentionally omitted — personality is injected dynamically
  // into a shared voice agent template at runtime.
  const prospects = await Persona.insertMany([
    {
      name: 'Sarah Mitchell', title: 'VP of Sales', company: 'Accenture', industry: 'SaaS',
      emoji: '', difficulty: 'MEDIUM', isPreset: true, personaType: 'Skeptical',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Analytical, data-driven, results-focused. Under pressure from the CRO to hit quota.',
      systemPrompt: `You are Sarah Mitchell, VP of Sales at Accenture. You have ten years in sales leadership and have heard every pitch. You push back on anything without hard ROI data. Your team is behind on quota and you are pressed for time. You are open to tools that can prove results, but skeptical by default. Keep responses short — this is a business call.`,
      objections: ['Too expensive — what\'s the ROI?', 'We already use Gong for this', 'Not the right time — end of quarter'],
      buyingSignals: ['Asking about ROI and payback period', 'Mentioning team size or quota numbers', 'Asking about implementation timeline'],
      frameworks: ['MEDDIC', 'BANT'], voiceId: 'EXAVITQu4vr4xnSDxMaL', avatarId: 'sarah',
    },
    {
      name: 'Marcus Thompson', title: 'CTO', company: 'FinBridge', industry: 'Banking',
      emoji: '', difficulty: 'HARD', isPreset: true, personaType: 'Skeptical',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Technical, security-conscious. Has been burned by vendors who over-promised.',
      systemPrompt: `You are Marcus Thompson, CTO at FinBridge. You are a seasoned engineer who can spot vaporware instantly. You demand technical specifics — architecture, security certifications, API docs — before agreeing to anything. You are not interested in demos until you understand how the system works. Keep responses short and pointed.`,
      objections: ['Security and compliance concerns', 'Integration complexity with our core banking stack', 'We can build this in-house'],
      buyingSignals: ['Asking for API documentation', 'Security certification questions', 'Requesting a technical deep-dive'],
      frameworks: ['SPIN', 'MEDDICC'], voiceId: 'ErXwobaYiN019PkySvjV', avatarId: 'marcus',
    },
    {
      name: 'Priya Kapoor', title: 'Head of Engineering', company: 'BuildFast', industry: 'Manufacturing',
      emoji: '', difficulty: 'MEDIUM', isPreset: true, personaType: 'Neutral',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Pragmatic, ROI-obsessed. Has been through two failed software rollouts.',
      systemPrompt: `You are Priya Kapoor, Head of Engineering at BuildFast. You are pragmatic and ROI-obsessed — if a tool doesn't deliver measurable value within 90 days, your team will abandon it. You ask hard questions about implementation timelines, customer references, and post-contract support. Process disruption is your biggest fear. You are polite but direct.`,
      objections: ['Implementation time is too long', 'Team adoption will be a problem', 'Hidden costs always emerge post-sale'],
      buyingSignals: ['Asking about customer references in manufacturing', 'Requesting implementation timeline', 'Asking about onboarding and training'],
      frameworks: ['BANT', 'CHALLENGER'], voiceId: 'EXAVITQu4vr4xnSDxMaL', avatarId: 'priya',
    },
    {
      name: 'Robert Hayes', title: 'CFO', company: 'RetailMax', industry: 'Retail',
      emoji: '', difficulty: 'EXPERT', isPreset: true, personaType: 'Aggressive',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Cost-conscious, risk-averse, numbers-driven. Has rejected three similar vendors this year.',
      systemPrompt: `You are Robert Hayes, CFO at RetailMax. Every dollar must be justified with a clear business case and a payback period under 12 months. You are not hostile — you are rigorous. Show real numbers or this conversation ends quickly. You can spot an inflated ROI model instantly.`,
      objections: ['Prove the ROI before I sign anything', 'We tried something similar and it failed', 'Not a priority right now', 'Your cost is too high'],
      buyingSignals: ['Asking about payment terms and pilot options', 'Requesting financial projections', 'Asking about SLA guarantees'],
      frameworks: ['MEDDIC', 'SNAP'], avatarId: 'robert',
    },
    {
      name: 'Emma Chen', title: 'Marketing Director', company: 'GrowthLabs', industry: 'SaaS',
      emoji: '', difficulty: 'EASY', isPreset: true, personaType: 'Warm',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Creative, collaborative. Open to new ideas but needs a clear path to outcomes.',
      systemPrompt: `You are Emma Chen, Marketing Director at GrowthLabs. You are creative, collaborative, and genuinely curious about new tools. You care about campaign results and brand impact. You are open to partnerships — but you need to see a clear path to measurable outcomes before you take anything to the board. Warm but not a pushover.`,
      objections: ['Internal bandwidth is the real constraint', 'Timing is off — we are mid-campaign', 'Need board approval for anything over $20K'],
      buyingSignals: ['Asking about case studies in similar companies', 'Discussing collaboration', 'Inviting you to present to the team'],
      frameworks: ['SPIN', 'SNAP'], voiceId: 'EXAVITQu4vr4xnSDxMaL', avatarId: 'emma',
    },
    {
      name: 'David Park', title: 'Procurement Director', company: 'GlobalCorp', industry: 'Manufacturing',
      emoji: '', difficulty: 'HARD', isPreset: true, personaType: 'Aggressive',
      firstSpeaker: 'user', openingLine: '',
      personality: 'Process-driven, experienced at negotiation. Always has a competing bid — real or implied.',
      systemPrompt: `You are David Park, Procurement Director at GlobalCorp. You run a structured vendor evaluation process and use it as leverage. You always have a competing bid in your back pocket. You care about total cost of ownership, contract terms, and SLA guarantees more than features. Keep answers short. Challenge every claim.`,
      objections: ['Your competitor is 20% cheaper', 'The contract terms are not acceptable', 'Need a 90-day pilot before any commitment', 'Need three reference customers first'],
      buyingSignals: ['Asking about contract flexibility', 'Requesting a pilot structure', 'Asking about long-term pricing guarantees'],
      frameworks: ['MEDDIC', 'BANT'], avatarId: 'robert',
    },
    // Interview prospects
    {
      name: 'Claire Hughes', title: 'Head of Talent Acquisition', company: 'TechScale Inc', industry: 'SaaS',
      emoji: '', difficulty: 'EASY', isPreset: true, personaType: 'Friendly',
      firstSpeaker: 'persona', openingLine: 'Thanks for coming in. Tell me a little about yourself and what drew you to this role.',
      personality: 'Professional, warm. Uses structured competency questions and STAR method.',
      systemPrompt: `You are Claire Hughes, Head of Talent Acquisition at TechScale Inc. You are conducting a structured HR screening for a Sales Development Representative role. You are warm and professional. You ask behavioural questions using the STAR method and probe for specific examples. You are assessing communication, motivation, and cultural alignment — not technical skills. Give the candidate space to speak.`,
      objections: [], buyingSignals: ['Strong STAR-format answers', 'Clear motivation', 'Good questions about team culture'],
      frameworks: [], voiceId: 'EXAVITQu4vr4xnSDxMaL', avatarId: 'sarah',
    },
    {
      name: "James O'Brien", title: 'VP of Enterprise Sales', company: 'CloudSystems', industry: 'SaaS',
      emoji: '', difficulty: 'HARD', isPreset: true, personaType: 'Aggressive',
      firstSpeaker: 'persona', openingLine: "Walk me through your biggest deal — how you found it, how you closed it, and what went wrong along the way.",
      personality: 'Demanding, direct. Stress-tests candidates with rapid-fire questions and challenges.',
      systemPrompt: `You are James O'Brien, VP of Enterprise Sales at CloudSystems. You are interviewing a candidate for a Senior Account Executive role. You are direct, high-pressure, and stress-test candidates to see how they handle adversity. You spend more time on failures than wins — you want to know if they can handle failure and learn from it. Interrupt if answers are vague. Keep responses sharp and short.`,
      objections: [], buyingSignals: ['Specific deal examples with numbers', 'Self-awareness about failures', 'Structured thinking under pressure'],
      frameworks: [], voiceId: 'ErXwobaYiN019PkySvjV', avatarId: 'marcus',
    },
  ]);
  console.log(`Created ${prospects.length} prospects`);

  // ── ElevenLabs voice agents (shared templates — NOT per-prospect) ──────────
  console.log('\nChecking ElevenLabs access…');
  const health = await checkHealth();

  if (!health.ttsAvailable) {
    console.log(`  ✗ TTS unavailable — ${health.issues[0] ?? 'unknown error'}`);
  } else if (!health.convaiAvailable) {
    console.log('  ✓ TTS available');
    console.log('  ✗ Conversational AI unavailable — Creator plan required for live calls');
  } else {
    console.log('  ✓ TTS + ConvAI available — creating shared voice agent templates…');

    // A single system prompt base. The prospect's character is injected at
    // runtime via the signed-URL request, not baked into the agent itself.
    const BASE = `You will receive a character brief at the start of each call (name, title, personality, objectives, objections). Follow it exactly. Stay in character throughout. Do not break character or acknowledge that you are an AI.

Opening rules:
- BUYER / EXECUTIVE: answer with a brief greeting ("Sarah speaking." or "Hi — thanks for joining.") then wait silently for the rep to introduce themselves.
- INTERVIEWER: open with your designated opening question from the character brief.
Keep all responses concise and realistic. You are a busy professional.`;

    const templates = [
      { name: 'Sales Prospect — Template',      voice: 'EXAVITQu4vr4xnSDxMaL', note: 'Senior buyer evaluating a vendor solution.' },
      { name: 'Executive Buyer — Template',     voice: 'ErXwobaYiN019PkySvjV', note: 'C-suite (CTO, CFO, COO). Technical, demanding, data-driven.' },
      { name: 'Procurement Reviewer — Template',voice: 'EXAVITQu4vr4xnSDxMaL', note: 'Procurement / legal. Process-driven, uses competitive pressure.' },
      { name: 'Hiring Manager — Template',      voice: 'ErXwobaYiN019PkySvjV', note: 'Sales hiring manager. Stress-tests candidates.' },
      { name: 'HR Screener — Template',         voice: 'EXAVITQu4vr4xnSDxMaL', note: 'HR / Talent Acquisition. Warm, STAR-method questions.' },
    ];

    let firstAgentId = '';
    for (const t of templates) {
      try {
        const result = await createAgent({
          name: t.name,
          conversation_config: {
            agent: {
              first_message: '',
              language: 'en',
              prompt: { prompt: `${BASE}\n\nDefault character type: ${t.note}`, llm: 'gemini-2.0-flash', temperature: 0.8 },
            },
            tts: { voice_id: t.voice, model_id: 'eleven_turbo_v2' },
          },
        });
        console.log(`  ✓ ${t.name}: ${result.agent_id}`);
        if (!firstAgentId) firstAgentId = result.agent_id;
      } catch (err) {
        console.warn(`  ⚠ ${t.name}: ${(err as Error).message}`);
      }
    }

    // Store the first template agent as the global fallback so the backend
    // never tries to reuse a stale ID from a previous seed run.
    if (firstAgentId) {
      await SystemConfig.findOneAndUpdate(
        { key: 'defaultAgentId' },
        { value: firstAgentId },
        { upsert: true }
      );
      console.log(`  ✓ Default agent set to: ${firstAgentId}`);
    } else {
      try {
        const fallback = await getOrCreateAgentId();
        console.log(`  ✓ Global fallback agent: ${fallback}`);
      } catch (err) {
        console.warn(`  ⚠ Global fallback: ${(err as Error).message}`);
      }
    }
  }

  // ── Team Scenarios ─────────────────────────────────────────────────────────
  await TeamRoleplay.insertMany([
    {
      name: 'Enterprise Discovery — Q3 Push',
      description: 'Structured discovery with an enterprise VP evaluating multiple vendors. Focus on MEDDIC qualification and pain quantification.',
      companyId: acme._id, createdById: manager._id, isActive: true, allowPeerListening: true, completionCount: 0,
      assignmentTarget: { scope: 'all' },
      scenarioConfig: {
        industry: 'SaaS', roleplayType: 'Discovery Call',
        displayName: 'Sarah Mitchell', displayTitle: 'VP of Sales, Accenture', displayEmoji: '', difficulty: 'MEDIUM',
        personaContext: prospects[0].systemPrompt,
        suggestedQuestions: ['What metrics matter most to your CRO this quarter?', 'How do you currently track rep performance?', 'What would a 10% improvement in quota attainment mean in dollars?'],
        objections: ['Too expensive — what\'s the ROI?', 'We already have Gong', 'Not the right time — end of quarter'],
      },
    },
    {
      name: 'Cold Call — CFO Gatekeeper',
      description: 'Break through a numbers-driven CFO who has rejected three similar vendors. Must build a business case in under 5 minutes.',
      companyId: acme._id, createdById: manager._id, isActive: true, allowPeerListening: false, completionCount: 0,
      assignmentTarget: { scope: 'team', teamIds: ['Enterprise'] },
      scenarioConfig: {
        industry: 'Retail', roleplayType: 'Cold Call',
        displayName: 'Robert Hayes', displayTitle: 'CFO, RetailMax', displayEmoji: '', difficulty: 'EXPERT',
        personaContext: prospects[3].systemPrompt,
        suggestedQuestions: ['What\'s your biggest cost issue heading into next year?', 'How do you evaluate ROI for operational tools?', 'What payback period would make this a no-brainer?'],
        objections: ['Prove the ROI before I sign anything', 'We tried something similar and it failed', 'Not a priority right now'],
      },
    },
    {
      name: 'Procurement Negotiation — Multi-Vendor',
      description: 'Negotiate contract terms with a seasoned procurement director who always has a competing offer. Focus on value defence and creative deal structuring.',
      companyId: acme._id, createdById: manager._id, isActive: true, allowPeerListening: true, completionCount: 0,
      assignmentTarget: { scope: 'all' },
      scenarioConfig: {
        industry: 'Manufacturing', roleplayType: 'Procurement Negotiation',
        displayName: 'David Park', displayTitle: 'Procurement Director, GlobalCorp', displayEmoji: '', difficulty: 'HARD',
        personaContext: prospects[5].systemPrompt,
        suggestedQuestions: ['What are your top three vendor evaluation criteria?', 'What does a successful pilot look like?', 'What contract flexibility matters most — term, payment, or SLA?'],
        objections: ['Your competitor is 20% cheaper', 'Contract terms are not acceptable', 'Need a 90-day pilot first'],
      },
    },
    {
      name: 'Sales Interview — AE Role',
      description: 'High-pressure interview simulation with a VP who stress-tests candidates. Practice STAR answers and deal walk-throughs.',
      companyId: acme._id, createdById: manager._id, isActive: true, allowPeerListening: false, completionCount: 0,
      assignmentTarget: { scope: 'all' },
      scenarioConfig: {
        industry: 'SaaS', roleplayType: 'Sales Interview',
        displayName: "James O'Brien", displayTitle: 'VP of Enterprise Sales, CloudSystems', displayEmoji: '', difficulty: 'HARD',
        personaContext: prospects[7].systemPrompt,
        suggestedQuestions: ['Walk me through your largest closed-won deal.', 'Tell me about a deal you lost — what did you learn?', 'How do you manage a 40+ account pipeline without dropping the ball?'],
        objections: [],
      },
    },
  ]);
  console.log('Created 4 team scenarios');

  // ── Evaluation prompts ─────────────────────────────────────────────────────
  await EvaluationPrompt.insertMany([
    {
      roleplayType: 'Discovery Call',
      displayName: 'Discovery Call — Standard',
      isActive: true,
      promptTemplate: 'You are an expert sales coach. Evaluate this discovery call transcript and return ONLY valid JSON.\n\nTRANSCRIPT:\n{transcript}\n\nReturn JSON with keys: overallScore (0-100), overallFeedback (string), strengths (string[]), improvements (string[]), proTip (string), scorecardGroups (array of {group, maxPoints, earnedPoints, criteria: [{question, passed, reasoning}]}), timelineEvents (array of {type (GOOD/WARNING/ISSUE), timestampMs, title, description, suggestion}).',
      scoringCriteria: [
        { group: 'Opening & Agenda', criteria: [
          { question: 'Did the rep establish a clear agenda and invite the prospect to add topics?', hint: 'Look for an explicit agenda statement and an invitation for input.' },
          { question: 'Did the rep use a permission-based opener?', hint: 'Low-friction, time-bounded opener that respects the prospect\'s time.' },
        ]},
        { group: 'Pain & Metrics Discovery', criteria: [
          { question: 'Did the rep uncover at least two specific pain points?', hint: 'Surface-level pain + business impact layer.' },
          { question: 'Did the rep quantify the business impact in the prospect\'s own numbers?', hint: 'Dollar figures, percentages, or time costs stated by the prospect themselves.' },
        ]},
        { group: 'Objection Handling', criteria: [
          { question: 'Did the rep acknowledge objections before responding?', hint: 'Feel-Felt-Found or similar acknowledgement before reframing.' },
          { question: 'Did the rep probe to understand the root cause of each objection?', hint: 'At least one clarifying question before defending value.' },
        ]},
        { group: 'Next Steps & Closing', criteria: [
          { question: 'Did the rep define clear, mutually agreed next steps?', hint: 'Specific date, time, attendees, and purpose confirmed.' },
          { question: 'Did the rep ask for the prospect\'s success criteria for the next meeting?', hint: '"What would you need to see to feel good about moving forward?"' },
        ]},
      ],
    },
    {
      roleplayType: 'Cold Call',
      displayName: 'Cold Call — Standard',
      isActive: true,
      promptTemplate: 'You are an expert sales coach. Evaluate this cold call transcript and return ONLY valid JSON.\n\nTRANSCRIPT:\n{transcript}\n\nReturn JSON with keys: overallScore (0-100), overallFeedback (string), strengths (string[]), improvements (string[]), proTip (string), scorecardGroups (array of {group, maxPoints, earnedPoints, criteria: [{question, passed, reasoning}]}), timelineEvents (array of {type (GOOD/WARNING/ISSUE), timestampMs, title, description, suggestion}).',
      scoringCriteria: [
        { group: 'Opener', criteria: [
          { question: 'Did the rep lead with a specific, relevant value proposition in the first 15 seconds?', hint: 'A concrete outcome — not a company intro or feature list.' },
          { question: 'Did the rep demonstrate research about the prospect or company?', hint: 'Reference to a specific event, metric, or challenge relevant to the prospect.' },
        ]},
        { group: 'Qualification', criteria: [
          { question: 'Did the rep qualify budget or authority within the first two minutes?', hint: 'Surfaced who owns the decision or whether budget exists.' },
          { question: 'Did the rep uncover a relevant pain or business problem?', hint: 'A specific problem the prospect confirmed — not assumed.' },
        ]},
        { group: 'Close', criteria: [
          { question: 'Did the rep secure a specific next step?', hint: 'Meeting booked or specific follow-up action agreed.' },
          { question: 'Did the rep ask for success criteria for the next interaction?', hint: '"What would you need to see to feel good about taking a meeting?"' },
        ]},
      ],
    },
    {
      roleplayType: 'Procurement Negotiation',
      displayName: 'Procurement Negotiation — Standard',
      isActive: true,
      promptTemplate: 'You are an expert sales coach. Evaluate this procurement negotiation transcript and return ONLY valid JSON.\n\nTRANSCRIPT:\n{transcript}\n\nReturn JSON with keys: overallScore (0-100), overallFeedback (string), strengths (string[]), improvements (string[]), proTip (string), scorecardGroups (array of {group, maxPoints, earnedPoints, criteria: [{question, passed, reasoning}]}), timelineEvents (array of {type (GOOD/WARNING/ISSUE), timestampMs, title, description, suggestion}).',
      scoringCriteria: [
        { group: 'Value Defence', criteria: [
          { question: 'Did the rep defend price with specific ROI evidence rather than discounting?', hint: 'Customer proof points, ROI model, or payback period cited.' },
          { question: 'Did the rep understand the competitor\'s offer before conceding anything?', hint: 'Asked what the competing bid includes before responding to price pressure.' },
        ]},
        { group: 'Deal Structure', criteria: [
          { question: 'Did the rep offer creative deal structures (pilot, milestone payment, phased rollout)?', hint: 'At least one alternative to a straight discount.' },
          { question: 'Did the rep trade concessions — never give without getting?', hint: '"I can do X if you can commit to Y."' },
        ]},
        { group: 'Closing', criteria: [
          { question: 'Did the rep advance to a signed commitment or concrete next step?', hint: 'A specific decision deadline or signature path agreed.' },
        ]},
      ],
    },
    {
      roleplayType: 'Sales Interview',
      displayName: 'Sales Interview — Standard',
      isActive: true,
      promptTemplate: 'You are an expert interview coach. Evaluate this sales interview practice session transcript and return ONLY valid JSON.\n\nTRANSCRIPT:\n{transcript}\n\nReturn JSON with keys: overallScore (0-100), overallFeedback (string), strengths (string[]), improvements (string[]), proTip (string), scorecardGroups (array of {group, maxPoints, earnedPoints, criteria: [{question, passed, reasoning}]}), timelineEvents (array of {type (GOOD/WARNING/ISSUE), timestampMs, title, description, suggestion}).',
      scoringCriteria: [
        { group: 'Communication', criteria: [
          { question: 'Did the candidate use structured STAR-format answers?', hint: 'Situation, Task, Action, Result — all four elements present.' },
          { question: 'Did the candidate provide specific numbers and outcomes, not generalities?', hint: 'Quota attainment %, deal size, pipeline values, or time-based results.' },
        ]},
        { group: 'Sales Acumen', criteria: [
          { question: 'Did the candidate demonstrate understanding of a full sales cycle?', hint: 'Referenced prospecting, discovery, qualification, proposal, and close.' },
          { question: 'Did the candidate show self-awareness about past failures and learnings?', hint: 'A specific failure example with a clear lesson extracted.' },
        ]},
        { group: 'Fit & Motivation', criteria: [
          { question: 'Did the candidate ask insightful questions about the role or team?', hint: 'Questions that show research and genuine interest — not generic.' },
          { question: 'Did the candidate clearly articulate their motivation for the specific role?', hint: 'Specific reason tied to this company/role, not just "I love sales".' },
        ]},
      ],
    },
    {
      roleplayType: 'Executive Pitch',
      displayName: 'Executive Pitch — Standard',
      isActive: true,
      promptTemplate: 'You are an expert sales coach. Evaluate this executive pitch transcript and return ONLY valid JSON.\n\nTRANSCRIPT:\n{transcript}\n\nReturn JSON with keys: overallScore (0-100), overallFeedback (string), strengths (string[]), improvements (string[]), proTip (string), scorecardGroups (array of {group, maxPoints, earnedPoints, criteria: [{question, passed, reasoning}]}), timelineEvents (array of {type (GOOD/WARNING/ISSUE), timestampMs, title, description, suggestion}).',
      scoringCriteria: [
        { group: 'Relevance', criteria: [
          { question: 'Did the rep tailor the pitch to the executive\'s specific strategic priorities?', hint: 'Referenced a known initiative, metric, or challenge relevant to the executive\'s agenda.' },
          { question: 'Did the rep avoid product features and focus on business outcomes?', hint: 'No feature list — only outcomes, ROI, and strategic impact.' },
        ]},
        { group: 'Business Case', criteria: [
          { question: 'Did the rep quantify the ROI or business impact?', hint: 'Specific dollar figure, percentage improvement, or payback period.' },
          { question: 'Did the rep reference a comparable customer or case study?', hint: 'A named or described customer in a similar situation with measurable results.' },
        ]},
      ],
    },
  ]);
  console.log('Created evaluation prompts');

  // ── Sessions ───────────────────────────────────────────────────────────────
  const now = Date.now();

  // Rich session 1: MEDDIC Discovery Call — Alex Rivera
  await Session.create({
    type: 'PHONE_CALL', status: 'COMPLETED', framework: 'MEDDIC',
    totalScore: 81, durationSeconds: 492,
    startedAt: new Date(now - 3_700_000), endedAt: new Date(now - 3_208_000),
    userId: rep._id, personaId: prospects[0]._id, companyId: acme._id,
    scenarioConfig: {
      industry: 'SaaS', roleplayType: 'Discovery Call',
      personaContext: prospects[0].systemPrompt,
      displayName: 'Sarah Mitchell', displayTitle: 'VP of Sales, Accenture',
      displayEmoji: '', difficulty: 'MEDIUM', avatarId: 'sarah',
      suggestedQuestions: ['What metrics matter most to your CRO?', 'How do you track rep performance?', 'What does a 10% quota miss cost you?'],
      objections: ['Too expensive', 'We already have Gong', 'Not the right time'],
    },
    messages: [
      { role: 'user',      content: 'Hi Sarah, this is Alex from PitchIQ. I was looking at your expansion into the enterprise segment — congratulations on the Series B. Do you have 30 seconds?', timestampMs: 5000 },
      { role: 'assistant', content: 'Sure, 30 seconds. What is this about?', timestampMs: 18000 },
      { role: 'user',      content: 'We help VP-level sales leaders quantify exactly where rep performance breaks down. Companies our size typically see a 20% lift in quota attainment in the first 90 days. Is that on your radar?', timestampMs: 28000 },
      { role: 'assistant', content: 'We do have challenges there. Reps are ramping slowly and we\'re missing numbers. But we already have Gong.', timestampMs: 52000 },
      { role: 'user',      content: 'What does Gong show you today — call activity, or where deals stall by MEDDIC component?', timestampMs: 68000 },
      { role: 'assistant', content: 'Mostly call activity. We can see what reps are doing but not why specific deals fall through.', timestampMs: 95000 },
      { role: 'user',      content: 'That\'s the exact gap we solve. If you could pinpoint within 24 hours which MEDDIC component each rep struggles with, how would that change your coaching?', timestampMs: 118000 },
      { role: 'assistant', content: 'It would be transformative. I spend 3 hours a week just listening to random calls hoping to catch something.', timestampMs: 145000 },
      { role: 'user',      content: 'At $200 an hour loaded cost, that\'s $31K a year on manual call review. What does a 10% quota miss look like in dollars for your team?', timestampMs: 165000 },
      { role: 'assistant', content: '...painful. We have 20 reps at $1.2M quota each — a 10% miss is $2.4 million.', timestampMs: 198000 },
      { role: 'user',      content: 'So the question isn\'t whether the cost justifies a tool — it does. Can we book 30 minutes with you and your CRO next week to walk through how we\'d close that gap?', timestampMs: 218000 },
      { role: 'assistant', content: 'I need to think about it. The pricing seems steep for what you\'re describing.', timestampMs: 248000 },
      { role: 'user',      content: 'Fair — it should feel that way before you\'ve seen the ROI model. What if we built it together on the call? Thursday at 2pm?', timestampMs: 265000 },
      { role: 'assistant', content: 'Send me a calendar invite. If the ROI holds up, I\'ll have Marcus join.', timestampMs: 295000 },
      { role: 'user',      content: 'Perfect. What would a successful next call look like from your side?', timestampMs: 310000 },
      { role: 'assistant', content: 'Show me real data from a company our size. Actual before/after quota numbers — not case study fluff.', timestampMs: 345000 },
    ],
    frameworkScores: [
      { component: 'Metrics', score: 88, feedback: 'Excellent quantitative framing. Helped Sarah self-calculate her own cost — $31K/year and $2.4M quota miss. Metrics surfaced in the prospect\'s own terms.', evidence: ['20% quota lift at 0:28', '$31K coaching cost at 2:45', '$2.4M miss at 3:18'] },
      { component: 'Economic Buyer', score: 74, feedback: 'Identified Marcus as CRO and secured a conditional commitment to bring him. Did not ask what Marcus specifically cares about.', evidence: ['Marcus identified at 4:55', 'Conditional commitment secured at 4:55'] },
      { component: 'Decision Criteria', score: 70, feedback: 'Assumed attainment improvement is the criterion but never asked directly: "What would a successful vendor need to prove to you?"', evidence: ['Criterion assumed not confirmed at 1:58'] },
      { component: 'Identify Pain', score: 92, feedback: 'Outstanding. Three pain layers uncovered: slow ramp, 3hrs/week manual coaching, $2.4M quota miss. Let Sarah do the maths herself.', evidence: ['Slow ramp at 0:52', 'Manual coaching cost at 2:25', '$2.4M self-calculated at 3:18'] },
      { component: 'Champion', score: 62, feedback: 'Sarah is a potential champion but was not armed. No internal pitch, no one-pager offer, no "how do you sell this internally?" question.', evidence: ['Champion not built at 3:58', 'No talking points offered'] },
    ],
    timelineEvents: [
      { type: 'GOOD',    timestampMs: 5000,   title: 'Research-backed opener',            description: 'Led with a Series B reference and asked for only 30 seconds — low-friction, credible entry.' },
      { type: 'GOOD',    timestampMs: 68000,  title: 'Competitor probe without attacking', description: 'Turned the Gong objection into a discovery question — textbook move.' },
      { type: 'GOOD',    timestampMs: 165000, title: 'ROI in prospect\'s own numbers',    description: 'Converted coaching time to dollars using Sarah\'s own data.' },
      { type: 'WARNING', timestampMs: 218000, title: 'Moved to close without confirming criteria', description: 'Jumped to booking the meeting before asking what Sarah would need to see.', suggestion: '"What would need to be true for you to feel this is worth 30 minutes of your CRO\'s time?"' },
      { type: 'ISSUE',   timestampMs: 248000, title: 'Price objection reframed before probing', description: 'Moved to reframe before exploring what "steep" means.', suggestion: '"When you say steep — is that relative to budget, or relative to what you\'ve seen for similar tools?"' },
      { type: 'GOOD',    timestampMs: 310000, title: 'Pre-call success criteria',          description: 'Asked for next-call success criteria — gives a clear mandate for Thursday.' },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain quantification. You let Sarah do the maths herself — far more persuasive than presenting a number. The main gap is champion development: you left without arming Sarah for her internal conversation with Marcus.',
      strengths: ['Research-backed, low-friction opener', 'Converted abstract pain into concrete dollars using prospect\'s own data', 'Recovered from price objection and secured conditional CRO next step', 'Closed by asking for next-call success criteria'],
      improvements: ['Ask what Marcus specifically cares about before the next call', 'Build Sarah as champion — offer an internal one-pager or talking points', 'Probe objections before reframing — ask what "steep" means before defending value'],
      proTip: 'After the ROI calculation lands, ask: "What\'s the cost of doing nothing for another 6 months?" — this closes the urgency loop before you ask for the meeting.',
      scorecardGroups: [
        { group: 'Opening & Agenda', maxPoints: 2, earnedPoints: 1, criteria: [
          { question: 'Did the rep establish a clear agenda and invite input?', passed: false, reasoning: 'Asked for 30 seconds but did not set a full agenda.' },
          { question: 'Did the rep use a permission-based opener?', passed: true, reasoning: 'Permission-based opener at 0:05.' },
        ]},
        { group: 'Pain & Metrics Discovery', maxPoints: 4, earnedPoints: 4, criteria: [
          { question: 'Did the rep uncover at least two specific pain points?', passed: true, reasoning: 'Three layers: slow ramp, manual coaching, quota miss.' },
          { question: 'Did the rep quantify impact in the prospect\'s own numbers?', passed: true, reasoning: '$31K/year and $2.4M miss using Sarah\'s own data.' },
        ]},
        { group: 'Objection Handling', maxPoints: 2, earnedPoints: 1, criteria: [
          { question: 'Did the rep acknowledge objections before responding?', passed: true, reasoning: '"That\'s fair — it should feel that way" at 4:08.' },
          { question: 'Did the rep probe to understand the root cause?', passed: false, reasoning: 'Moved to reframe before exploring what "steep" means.' },
        ]},
        { group: 'Next Steps & Closing', maxPoints: 2, earnedPoints: 2, criteria: [
          { question: 'Did the rep define clear mutually agreed next steps?', passed: true, reasoning: 'Calendar invite for Thursday at 2pm.' },
          { question: 'Did the rep ask for success criteria?', passed: true, reasoning: 'Asked at 5:10 — Sarah requested real quota data.' },
        ]},
      ],
    }),
  });

  // Lean sessions for leaderboard / analytics coverage
  await Session.insertMany([
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'SPIN', totalScore: 72,
      durationSeconds: 540, startedAt: new Date(now - 87_000_000), endedAt: new Date(now - 86_460_000),
      userId: reps[0]._id, personaId: prospects[1]._id, companyId: acme._id,
      scenarioConfig: { industry: 'Banking', roleplayType: 'Discovery Call', personaContext: '', displayName: 'Marcus Thompson', displayTitle: 'CTO, FinBridge', displayEmoji: '', difficulty: 'HARD', suggestedQuestions: [], avatarId: 'marcus' },
      messages: [
        { role: 'user',      content: 'Marcus, how does your team currently handle API rate limiting across your microservices?', timestampMs: 8000 },
        { role: 'assistant', content: 'Custom Redis solution. Works but causes issues during peak traffic — two incidents last month.', timestampMs: 28000 },
        { role: 'user',      content: 'Two incidents — what\'s the downstream impact? Transaction processing or just the gateway?', timestampMs: 45000 },
        { role: 'assistant', content: 'Both. Last incident: 40-minute payment processing degradation. Not acceptable for a fintech.', timestampMs: 65000 },
      ],
      frameworkScores: [
        { component: 'Situation Questions',   score: 82, feedback: 'Good situational grounding before pitching.',                                    evidence: ['Asked about architecture at 0:08'] },
        { component: 'Problem Questions',     score: 78, feedback: 'Strong — surfaced technical issue and business symptom.',                        evidence: ['Two incidents at 0:28', '40-min degradation at 1:05'] },
        { component: 'Implication Questions', score: 65, feedback: 'Quantified $50K cost but didn\'t chain deeper into enterprise churn risk.',      evidence: [] },
        { component: 'Need-Payoff Questions', score: 64, feedback: 'Need-payoff question came slightly early — let the pain land fully first.',      evidence: [] },
      ],
      timelineEvents: [
        { type: 'GOOD',  timestampMs: 8000,   title: 'Context-first opener',      description: 'Asked about current setup before pitching.' },
        { type: 'ISSUE', timestampMs: 65000,  title: 'Did not chain implication',  description: 'Stopped at first-level cost without connecting to enterprise churn.', suggestion: '"What happens to your relationship with that $800K client if this happens again in Q4?"' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Solid SPIN structure. Implication questions didn\'t chain deeply enough before moving to need-payoff.', strengths: ['Context-first opener earned credibility'], improvements: ['Chain implications before pivoting to payoff', 'Surface change-freeze constraints earlier'], proTip: 'After a strong implication, pause. Let the silence sit before asking the payoff question.', scorecardGroups: [] }),
    },
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'BANT', totalScore: 75,
      durationSeconds: 372, startedAt: new Date(now - 2 * 86_400_000 - 600_000), endedAt: new Date(now - 2 * 86_400_000 - 228_000),
      userId: reps[1]._id, personaId: prospects[2]._id, companyId: acme._id,
      scenarioConfig: { industry: 'Manufacturing', roleplayType: 'Cold Call', personaContext: '', displayName: 'Priya Kapoor', displayTitle: 'Head of Engineering, BuildFast', displayEmoji: '', difficulty: 'MEDIUM', suggestedQuestions: [], avatarId: 'priya' },
      messages: [
        { role: 'user',      content: 'Hi Priya, this is Taylor. Brief question — we help manufacturing companies cut project delivery time by 15% with predictive scheduling. Is reducing delays on your radar?', timestampMs: 5000 },
        { role: 'assistant', content: 'It is. Three projects this quarter came in late from supplier delays. Go on.', timestampMs: 22000 },
        { role: 'user',      content: 'That\'s exactly what we solve. Have you budgeted for tools to address this, or would it need approval?', timestampMs: 38000 },
        { role: 'assistant', content: 'Most of the tools budget is allocated. New spend needs COO sign-off.', timestampMs: 60000 },
      ],
      frameworkScores: [
        { component: 'Budget',    score: 78, feedback: 'Surfaced allocation status and approval threshold early.', evidence: ['COO sign-off at 1:00'] },
        { component: 'Authority', score: 85, feedback: 'Decision structure mapped within 90 seconds.',            evidence: ['COO identified at 1:35'] },
        { component: 'Need',      score: 88, feedback: 'Supplier delays confirmed immediately as live pain.',      evidence: ['Three late projects at 0:22'] },
        { component: 'Timeline',  score: 58, feedback: 'September deadline surfaced but cost of missing it not explored.', evidence: [] },
      ],
      timelineEvents: [
        { type: 'GOOD',    timestampMs: 5000,  title: 'Benefit-led opener',        description: 'Specific outcome in the first sentence — immediately relevant.' },
        { type: 'WARNING', timestampMs: 60000, title: 'Timeline urgency not closed', description: 'COO approval gate found but urgency not quantified.', suggestion: '"What happens to your at-risk Q4 projects if this isn\'t live by September 30?"' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Efficient BANT qualification. Authority mapped and business case requirement surfaced within two minutes. Gap: timeline urgency not made visceral.', strengths: ['Specific outcome opener', 'Budget and authority identified quickly'], improvements: ['Close the urgency loop on the September deadline', 'Ask what happened with the previous failed rollout'], proTip: 'Before every COO meeting, pre-call your champion: "What does David care about most and what does he need to say yes?"', scorecardGroups: [] }),
    },
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'CHALLENGER', totalScore: 55,
      durationSeconds: 480, startedAt: new Date(now - 4 * 86_400_000), endedAt: new Date(now - 4 * 86_400_000 + 480_000),
      userId: reps[2]._id, personaId: prospects[3]._id, companyId: acme._id,
      scenarioConfig: { industry: 'Retail', roleplayType: 'Executive Pitch', personaContext: '', displayName: 'Robert Hayes', displayTitle: 'CFO, RetailMax', displayEmoji: '', difficulty: 'EXPERT', suggestedQuestions: [], avatarId: 'robert' },
      messages: [
        { role: 'user',      content: 'Robert, our data shows 73% of companies implementing cost-reduction tools in a downturn actually increase operational spend the following year. Do you know why?', timestampMs: 8000 },
        { role: 'assistant', content: 'That\'s an odd statistic. Why would that be?', timestampMs: 32000 },
        { role: 'user',      content: 'Because they optimise for the wrong metric — they cut line-items but miss systemic inefficiencies that compound.', timestampMs: 45000 },
        { role: 'assistant', content: 'I\'ve been pitched "systemic efficiency" tools before. None delivered. Prove yours does.', timestampMs: 72000 },
      ],
      frameworkScores: [
        { component: 'Teach',        score: 70, feedback: 'Good reframe but no proof when challenged.',        evidence: ['Counter-intuitive stat at 0:08'] },
        { component: 'Tailor',       score: 48, feedback: 'Insight generic — not tailored to retail CFO.',    evidence: ['Stat not tailored at 0:08'] },
        { component: 'Take Control', score: 48, feedback: 'No evidence ready when Robert challenged the claim.', evidence: [] },
      ],
      timelineEvents: [
        { type: 'GOOD',  timestampMs: 8000,  title: 'Counter-intuitive opener', description: 'Led with a surprising statistic — classic Challenger technique.' },
        { type: 'ISSUE', timestampMs: 72000, title: 'No proof when challenged',  description: 'Robert asked for proof and you had nothing ready.', suggestion: 'Prepare 2–3 customer proof points for every reframe before the call.' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Promising Challenger opening that stalled when challenged. Insights require evidence to land.', strengths: ['Counter-intuitive opener created curiosity'], improvements: ['Prepare proof points for every reframe', 'Tailor the insight to retail CFO specifically'], proTip: 'Challenger: Teach → Tailor → Take Control. Never deliver Teach without the other two steps ready.', scorecardGroups: [] }),
    },
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'SNAP', totalScore: 88,
      durationSeconds: 384, startedAt: new Date(now - 6 * 86_400_000), endedAt: new Date(now - 6 * 86_400_000 + 384_000),
      userId: reps[3]._id, personaId: prospects[4]._id, companyId: acme._id,
      scenarioConfig: { industry: 'SaaS', roleplayType: 'Cold Call', personaContext: '', displayName: 'Emma Chen', displayTitle: 'Marketing Director, GrowthLabs', displayEmoji: '', difficulty: 'EASY', suggestedQuestions: [], avatarId: 'emma' },
      messages: [
        { role: 'user',      content: 'Emma, quick question — are you running ABM campaigns right now that are underperforming on conversion?', timestampMs: 5000 },
        { role: 'assistant', content: 'Yes — top-of-funnel is great but we\'re losing leads between MQL and SQL. Driving me crazy.', timestampMs: 20000 },
        { role: 'user',      content: 'That\'s exactly what I wanted to talk about. Is your MQL-to-SQL rate tracked in HubSpot?', timestampMs: 35000 },
        { role: 'assistant', content: 'HubSpot. Our rate is 22% — industry benchmark is 35%. I know we have a problem.', timestampMs: 58000 },
        { role: 'user',      content: '22% is fixable. If I could show you how to move that 8–10 points in 60 days, is that worth 20 minutes?', timestampMs: 75000 },
        { role: 'assistant', content: 'If you can actually deliver that, yes. What does it involve?', timestampMs: 98000 },
      ],
      frameworkScores: [
        { component: 'Simple',   score: 92, feedback: 'Every message was one clear idea — no jargon.',                             evidence: ['Single question at 0:05'] },
        { component: 'Invaluable', score: 88, feedback: 'Connected to a metric Emma tracks and offered a specific outcome.',         evidence: ['8–10 point promise at 1:15'] },
        { component: 'Align',     score: 85, feedback: 'Listened to the MQL-SQL friction before connecting the solution.',           evidence: ['Listened at 0:20 before pitching'] },
        { component: 'Priority',  score: 85, feedback: 'Asked for only 20 minutes and made the ROI case first.',                    evidence: ['Low-friction ask at 1:15'] },
      ],
      timelineEvents: [
        { type: 'GOOD', timestampMs: 5000,  title: 'Pain-first opener',            description: 'Opened with a specific pain question — not a product pitch.' },
        { type: 'GOOD', timestampMs: 58000, title: 'Prospect self-identified gap', description: 'Emma volunteered her conversion rate and benchmark gap unprompted.' },
        { type: 'GOOD', timestampMs: 75000, title: 'Specific time-bound value',    description: '8–10 points in 60 days — not a vague "we can help".' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Textbook SNAP call. Simple, relevant, aligned, closed with a low-friction ask. You listened first, pitched second, made value specific and time-bound.', strengths: ['Specific pain-first opener', 'Let Emma self-identify the gap', 'Specific time-bound value promise'], improvements: ['Add a relevant customer reference', 'Ask what Emma has already tried'], proTip: 'The SNAP close works best when the time ask matches the trust level you have built.', scorecardGroups: [] }),
    },
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'MEDDIC', totalScore: 62,
      durationSeconds: 612, startedAt: new Date(now - 10 * 86_400_000), endedAt: new Date(now - 10 * 86_400_000 + 612_000),
      userId: rep._id, personaId: prospects[5]._id, companyId: acme._id,
      scenarioConfig: { industry: 'Manufacturing', roleplayType: 'Procurement Negotiation', personaContext: '', displayName: 'David Park', displayTitle: 'Procurement Director, GlobalCorp', displayEmoji: '', difficulty: 'HARD', suggestedQuestions: [], avatarId: 'robert' },
      messages: [
        { role: 'user',      content: 'David, what are the top criteria your team uses to evaluate vendors in this category?', timestampMs: 8000 },
        { role: 'assistant', content: 'Total cost of ownership, SLA guarantees, and reference customers. And I always have a competing bid.', timestampMs: 25000 },
        { role: 'user',      content: 'Before we talk price, what are the documented costs of the current process this would replace?', timestampMs: 45000 },
        { role: 'assistant', content: 'Two SLA breaches last month — $80K in penalties. But that doesn\'t mean I\'ll pay whatever you\'re asking.', timestampMs: 65000 },
        { role: 'user',      content: 'An $80K penalty is a strong business case anchor. If we structure a pilot with milestone-based payment and an SLA guarantee, does that change the conversation?', timestampMs: 85000 },
        { role: 'assistant', content: 'It might. What does the pilot look like and what does it cost?', timestampMs: 108000 },
      ],
      frameworkScores: [
        { component: 'Metrics',          score: 78, feedback: 'Surfaced $80K penalty quickly. Could have annualised the risk.',              evidence: ['$80K penalty at 1:05'] },
        { component: 'Economic Buyer',   score: 55, feedback: 'Did not identify David\'s internal reporting line or executive sponsor.',       evidence: [] },
        { component: 'Decision Criteria', score: 82, feedback: 'Asked for evaluation criteria before pitching — rare and effective.',          evidence: ['Asked for criteria at 0:08'] },
        { component: 'Identify Pain',    score: 75, feedback: 'Pain identified via penalty costs but not layered into strategic risk.',        evidence: ['$80K penalty at 1:05'] },
        { component: 'Champion',         score: 48, feedback: 'Did not explore whether David can champion this internally.',                   evidence: [] },
        { component: 'Competition',      score: 60, feedback: 'Competing bid acknowledged but not probed for what it actually offers.',        evidence: ['Competitor mentioned at 0:25'] },
      ],
      timelineEvents: [
        { type: 'GOOD',    timestampMs: 8000,  title: 'Criteria-first approach',       description: 'Asked for evaluation criteria before pitching — shows maturity.' },
        { type: 'GOOD',    timestampMs: 85000, title: 'Creative pilot structure',       description: 'Milestone-based payment and SLA guarantee reduces procurement risk.' },
        { type: 'WARNING', timestampMs: 65000, title: 'Penalty not annualised',         description: 'Stopped at $80K without projecting quarterly or annual exposure.', suggestion: '"Two events in one month — annualised that\'s $480K. Does that change how quickly this needs to move?"' },
        { type: 'ISSUE',   timestampMs: 25000, title: 'Competing bid not explored',     description: 'David mentioned a competing bid but you moved past it.', suggestion: '"What does the competing bid offer that you\'d give up by choosing us? Better to know now than during contracting."' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Solid procurement approach. Asking for criteria before pitching is a differentiating move. The pilot structure was creative. Gaps: the competing bid was not explored and the penalty risk was not annualised.', strengths: ['Asked for evaluation criteria before pitching', 'Proposed creative pilot to reduce risk', 'Connected SLA penalty to business case anchor'], improvements: ['Annualise the $80K penalty to build full urgency', 'Probe the competing bid — what does it offer?', 'Identify David\'s internal sponsor'], proTip: 'In procurement negotiation, never give a concession without getting one: "I can offer milestone payment if you commit to a 30-day decision timeline."', scorecardGroups: [] }),
    },
    // Below-threshold session for score distribution
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'BANT', totalScore: 42,
      durationSeconds: 180, startedAt: new Date(now - 14 * 86_400_000), endedAt: new Date(now - 14 * 86_400_000 + 180_000),
      userId: reps[4]._id, personaId: prospects[0]._id, companyId: acme._id,
      scenarioConfig: { industry: 'SaaS', roleplayType: 'Cold Call', personaContext: '', displayName: 'Sarah Mitchell', displayTitle: 'VP of Sales, Accenture', displayEmoji: '', difficulty: 'MEDIUM', suggestedQuestions: [], avatarId: 'sarah' },
      messages: [
        { role: 'user',      content: 'Hi Sarah, my name is Casey and I\'m calling from PitchIQ. We are a sales training company and we help sales teams improve their performance. Do you have a minute?', timestampMs: 5000 },
        { role: 'assistant', content: 'What specifically do you do?', timestampMs: 20000 },
        { role: 'user',      content: 'We use AI to analyse sales calls and give reps feedback. We have features like transcription, coaching, analytics—', timestampMs: 30000 },
        { role: 'assistant', content: 'We already have tools for this. Not interested. Thanks.', timestampMs: 55000 },
      ],
      frameworkScores: [
        { component: 'Budget',    score: 20, feedback: 'Budget never qualified.',                                                          evidence: [] },
        { component: 'Authority', score: 35, feedback: 'Did not confirm Sarah is the right decision-maker.',                               evidence: [] },
        { component: 'Need',      score: 55, feedback: 'Never asked a discovery question before pitching.',                                evidence: [] },
        { component: 'Timeline',  score: 18, feedback: 'Call ended before timeline was discussed.',                                        evidence: [] },
      ],
      timelineEvents: [
        { type: 'ISSUE', timestampMs: 5000,  title: 'Generic opener',               description: 'Led with company name and category — no specific value, no research.', suggestion: '"We help VP Sales reduce ramp time by 30% — is that on your radar?" replaces the generic intro.' },
        { type: 'ISSUE', timestampMs: 30000, title: 'Feature dump triggered rejection', description: 'Listed features without uncovering pain — prospect disengaged immediately.', suggestion: 'Ask a discovery question first: "What\'s your biggest challenge with rep performance?" before describing the product.' },
      ],
      aiFeedback: JSON.stringify({ overallFeedback: 'Below threshold. The generic opener and feature dump triggered an immediate rejection. Cold calls require a specific value hook and a discovery question — not a product list.', strengths: [], improvements: ['Replace the generic opener with a specific, researched value hook', 'Ask a discovery question before describing the product', 'Qualify relevance before pitching'], proTip: 'The goal of a cold call opener is not to explain what you do — it\'s to earn 30 more seconds by being immediately relevant.', scorecardGroups: [] }),
    },
  ]);
  console.log('Created sessions');

  // ── Usage logs ────────────────────────────────────────────────────────────
  const allRepIds = [rep._id, ...reps.map(r => r._id)];
  const logs: object[] = [];
  for (let i = 0; i < 30; i++) {
    const isGemini = i % 3 !== 0;
    logs.push(isGemini ? {
      service: 'gemini',
      operation: 'session_analysis',
      userId: allRepIds[i % allRepIds.length],
      companyId: acme._id,
      sessionId: new mongoose.Types.ObjectId(),
      modelName: 'gemini-2.0-flash',
      promptTokens: Math.floor(Math.random() * 2000) + 400,
      completionTokens: Math.floor(Math.random() * 800) + 100,
      estimatedCostUsd: parseFloat((Math.random() * 0.02 + 0.001).toFixed(4)),
      createdAt: new Date(now - i * 86_400_000 * 0.7),
    } : {
      service: 'elevenlabs_convai',
      operation: 'call_session',
      userId: allRepIds[i % allRepIds.length],
      companyId: acme._id,
      sessionId: new mongoose.Types.ObjectId(),
      durationSeconds: Math.floor(Math.random() * 900) + 120,
      estimatedCostUsd: parseFloat((Math.random() * 0.15 + 0.02).toFixed(4)),
      createdAt: new Date(now - i * 86_400_000 * 0.7),
    });
  }
  await UsageLog.insertMany(logs);
  console.log('Created usage logs');

  await mongoose.disconnect();

  console.log('\n── Seed complete ─────────────────────────────────────────────');
  console.log('  superadmin@demo.com   Demo1234!  (Super Admin)');
  console.log('  admin@demo.com        Demo1234!  (Admin — Acme SaaS)');
  console.log('  manager@demo.com      Demo1234!  (Manager — Acme SaaS)');
  console.log('  rep@demo.com          Demo1234!  (Rep — Alex Rivera)');
  console.log('  jordan@demo.com       Demo1234!  (Rep — Jordan Lee)');
  console.log('  taylor@demo.com       Demo1234!  (Rep — Taylor Morgan)');
  console.log('  financeadmin@demo.com Demo1234!  (Admin — FinBridge)');
  console.log('──────────────────────────────────────────────────────────────\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
