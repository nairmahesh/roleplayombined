/**
 * Seed script — populates MongoDB with demo data for PitchIQ.
 * Run with: npm run seed
 * All mock data previously in frontend/src/lib/api.ts is moved here.
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
import { createAgent, checkHealth, getOrCreateAgentId } from './services/elevenlabs';

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await Promise.all([
    Company.deleteMany({}),
    User.deleteMany({}),
    Persona.deleteMany({}),
    Session.deleteMany({}),
    TeamRoleplay.deleteMany({}),
    EvaluationPrompt.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Company ────────────────────────────────────────────────────────────────
  const company = await Company.create({
    name: 'TechCorp',
    slug: 'techcorp',
    defaultFramework: 'MEDDIC',
    passThreshold: 70,
    isActive: true,
    industry: 'SaaS',
    planTier: 'pro',
  });

  const company2 = await Company.create({
    name: 'FinanceFlow',
    slug: 'financeflow',
    defaultFramework: 'BANT',
    passThreshold: 75,
    isActive: true,
    industry: 'FinTech',
    planTier: 'growth',
  });

  const company3 = await Company.create({
    name: 'RetailPro',
    slug: 'retailpro',
    defaultFramework: 'SPIN',
    passThreshold: 65,
    isActive: false,
    industry: 'Retail',
    planTier: 'starter',
  });

  console.log('Created companies:', company.name, company2.name, company3.name);

  // ── Users ──────────────────────────────────────────────────────────────────
  const pw = (plain: string) => bcrypt.hashSync(plain, 12);

  const superAdmin = await User.create({
    email: 'superadmin@demo.com',
    passwordHash: pw('Demo1234!'),
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
    isActive: true,
  });

  const companyAdmin = await User.create({
    email: 'admin@demo.com',
    passwordHash: pw('Demo1234!'),
    firstName: 'Dana',
    lastName: 'Brooks',
    role: 'COMPANY_ADMIN',
    companyId: company._id,
    isActive: true,
  });

  const manager = await User.create({
    email: 'manager@demo.com',
    passwordHash: pw('Demo1234!'),
    firstName: 'Jamie',
    lastName: 'Scott',
    role: 'MANAGER',
    companyId: company._id,
    isActive: true,
    location: 'London',
    region: 'EMEA',
    team: 'Enterprise',
  });

  const agent = await User.create({
    email: 'agent@demo.com',
    passwordHash: pw('Demo1234!'),
    firstName: 'Alex',
    lastName: 'Rivera',
    role: 'AGENT',
    companyId: company._id,
    managerId: manager._id,
    isActive: true,
    location: 'New York',
    region: 'North America',
    team: 'Enterprise',
    territory: 'East Coast',
    zone: 'Northeast',
  });

  const agents = await User.insertMany([
    { email: 'jordan@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Jordan', lastName: 'Lee', role: 'AGENT', companyId: company._id, isActive: true, location: 'San Francisco', region: 'North America', team: 'Enterprise', territory: 'West Coast', zone: 'Pacific' },
    { email: 'taylor@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Taylor', lastName: 'Morgan', role: 'AGENT', companyId: company._id, isActive: true, location: 'Chicago', region: 'North America', team: 'Enterprise', territory: 'Midwest', zone: 'Central' },
    { email: 'morgan@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Morgan', lastName: 'Kim', role: 'AGENT', companyId: company._id, isActive: true, location: 'Austin', region: 'North America', team: 'SMB', territory: 'South', zone: 'Central' },
    { email: 'sam@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Sam', lastName: 'Patel', role: 'AGENT', companyId: company._id, isActive: true, location: 'London', region: 'EMEA', team: 'SMB', territory: 'UK & Ireland', zone: 'Northern Europe' },
    { email: 'casey@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Casey', lastName: 'Zhang', role: 'AGENT', companyId: company._id, isActive: true, location: 'Singapore', region: 'APAC', team: 'Enterprise', territory: 'SEA', zone: 'Southeast Asia' },
    { email: 'riley@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Riley', lastName: 'Johnson', role: 'AGENT', companyId: company._id, isActive: true, location: 'Sydney', region: 'APAC', team: 'SMB', territory: 'ANZ', zone: 'Pacific' },
    { email: 'drew@demo.com', passwordHash: pw('Demo1234!'), firstName: 'Drew', lastName: 'Okonkwo', role: 'MANAGER', companyId: company._id, isActive: true, location: 'London', region: 'EMEA', team: 'Enterprise', territory: 'UK & Europe', zone: 'Northern Europe' },
  ]);

  console.log('Created', 4 + agents.length, 'users');

  // ── Personas ───────────────────────────────────────────────────────────────
  const personas = await Persona.insertMany([
    {
      name: 'Sarah Chen', title: 'VP of Sales', company: 'TechCorp', industry: 'SaaS',
      emoji: '', difficulty: 'MEDIUM', isPreset: true,
      personality: 'Analytical, data-driven, results-focused',
      systemPrompt: 'You are Sarah Chen, VP of Sales at TechCorp. You are analytical and data-driven. You have been in sales leadership for 10 years. You are busy and skeptical of vendors but can be won over with hard ROI data. Push back on vague claims. You care deeply about team quota attainment.',
      objections: ['Too expensive', 'Already have a solution', 'Not the right time'],
      buyingSignals: ['Asking about ROI', 'Mentioning budget', 'Asking about implementation timeline'],
      frameworks: ['MEDDIC', 'BANT'],
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    {
      name: 'Marcus Thompson', title: 'CTO', company: 'FinanceFlow', industry: 'FinTech',
      emoji: '', difficulty: 'HARD', isPreset: true,
      personality: 'Technical, skeptical, security-conscious',
      systemPrompt: 'You are Marcus Thompson, CTO at FinanceFlow. You are highly technical and deeply skeptical of marketing claims. You care about security, scalability, and integration complexity. Ask probing technical questions. You need to understand the architecture before agreeing to any demo.',
      objections: ['Security concerns', 'Integration complexity', 'We can build it ourselves'],
      buyingSignals: ['Technical deep-dive questions', 'Asking about API docs', 'Security certifications'],
      frameworks: ['SPIN', 'MEDDICC'],
      voiceId: 'ErXwobaYiN019PkySvjV',
    },
    {
      name: 'Priya Patel', title: 'Head of Engineering', company: 'BuildFast', industry: 'Construction Tech',
      emoji: '', difficulty: 'MEDIUM', isPreset: true,
      personality: 'Practical, ROI-focused, process-oriented',
      systemPrompt: 'You are Priya Patel, Head of Engineering at BuildFast. You are practical and focused on ROI. You care about implementation timelines and team adoption. You have been burned by vendors who overpromise. Ask about customer references and post-sale support.',
      objections: ['Implementation time', 'Team adoption challenges', 'Hidden costs'],
      buyingSignals: ['Asking about timelines', 'Requesting customer references', 'Asking about onboarding'],
      frameworks: ['BANT', 'CHALLENGER'],
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    {
      name: 'Robert Blake', title: 'CFO', company: 'RetailPro', industry: 'Retail',
      emoji: '', difficulty: 'EXPERT', isPreset: true,
      personality: 'Cost-conscious, risk-averse, numbers-driven',
      systemPrompt: 'You are Robert Blake, CFO at RetailPro. You are extremely cost-conscious and risk-averse. Every decision must be justified with a clear business case and payback period. You have rejected three similar vendors this year. You want proof, not promises.',
      objections: ['High cost', 'Not a priority', 'Already tried something similar', 'Prove the ROI first'],
      buyingSignals: ['Asking about payment terms', 'Requesting financial projections', 'Asking about pilot programs'],
      frameworks: ['MEDDIC', 'SNAP'],
    },
    {
      name: 'Emma Wilson', title: 'Marketing Director', company: 'GrowthCo', industry: 'Marketing',
      emoji: '', difficulty: 'EASY', isPreset: true,
      personality: 'Creative, results-oriented, collaborative',
      systemPrompt: 'You are Emma Wilson, Marketing Director at GrowthCo. You are creative and open to new ideas. You care about campaign results and brand impact. You are willing to explore new tools if they promise measurable results. You are collaborative and like working with vendors as partners.',
      objections: ['Internal bandwidth', 'Timing not right', 'Need board approval'],
      buyingSignals: ['Campaign ideas', 'Asking about case studies', 'Discussing collaboration'],
      frameworks: ['SPIN', 'SNAP'],
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
    },
    {
      name: 'Carlos Rodriguez', title: 'Operations Manager', company: 'LogiSync', industry: 'Logistics',
      emoji: '', difficulty: 'MEDIUM', isPreset: true,
      personality: 'Process-driven, methodical, detail-oriented',
      systemPrompt: 'You are Carlos Rodriguez, Operations Manager at LogiSync. You are process-driven and methodical. Any new tool must fit seamlessly into existing workflows. You are concerned about process disruption and training time. You want detailed implementation plans before committing.',
      objections: ['Process disruption', 'Training required', 'Need IT approval'],
      buyingSignals: ['Asking about workflow integration', 'Requesting implementation plan', 'Asking about training'],
      frameworks: ['BANT', 'CHALLENGER'],
    },
  ]);

  console.log('Created', personas.length, 'preset personas');

  // ── Create ElevenLabs agents for each preset persona ──────────────────────
  console.log('\nChecking ElevenLabs access...');
  const health = await checkHealth();

  if (!health.ttsAvailable) {
    console.log('  ✗ TTS unavailable —', health.issues[0] ?? 'unknown error');
    console.log('    Skipping agent creation. Voice features will not work until the API key is fixed.');
  } else if (!health.convaiAvailable) {
    console.log('  ✓ TTS available (basic voice/TTS works)');
    console.log('  ✗ Conversational AI unavailable');
    if (health.issues.length) {
      health.issues.filter(i => i.includes('ConvAI') || i.includes('Conversational')).forEach(i => console.log('   ', i));
    }
    console.log('    → Live call sessions require a Creator plan: https://elevenlabs.io/pricing');
    console.log('    → Skipping per-persona agent creation (no ConvAI access)');
  } else {
    console.log('  ✓ TTS available');
    console.log('  ✓ Conversational AI available — creating per-persona agents...');

    for (const persona of personas) {
      try {
        const result = await createAgent({
          name: `${persona.name} — ${persona.title}`,
          conversation_config: {
            agent: {
              first_message: 'Hello?',
              language: 'en',
              prompt: {
                prompt: persona.systemPrompt,
                llm: 'gemini-2.0-flash',
                temperature: 0.8,
              },
            },
            tts: {
              voice_id: persona.voiceId || 'EXAVITQu4vr4xnSDxMaL',
              model_id: 'eleven_turbo_v2',
            },
          },
        });
        await Persona.findByIdAndUpdate(persona._id, { agentId: result.agent_id });
        console.log(`  ✓ ${persona.name}: agent ${result.agent_id}`);
      } catch (err) {
        console.warn(`  ⚠ ${persona.name}: ${(err as Error).message}`);
      }
    }

    // Create/locate the global default agent.
    try {
      const globalAgentId = await getOrCreateAgentId();
      console.log(`  ✓ Global default agent ready: ${globalAgentId}`);
    } catch (err) {
      console.warn(`  ⚠ Global default agent setup failed: ${(err as Error).message}`);
    }
  }

  // ── Sessions ───────────────────────────────────────────────────────────────
  const now = Date.now();

  const session1 = await Session.create({
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'MEDDIC',
    totalScore: 81,
    durationSeconds: 720,
    startedAt: new Date(now - 3_700_000),
    endedAt: new Date(now - 3_600_000),
    userId: agent._id,
    personaId: personas[0]._id,
    companyId: company._id,
    scenarioConfig: {
      industry: 'SaaS',
      roleplayType: 'Discovery Call',
      personaContext: personas[0].systemPrompt,
      displayName: personas[0].name,
      displayTitle: personas[0].title,
      displayEmoji: '',
      difficulty: 'MEDIUM',
      suggestedQuestions: ['What metrics matter most to your CRO?', 'How do you currently track rep performance?', "What's your ramp time for new AEs?"],
    },
    messages: [
      { role: 'user', content: "Hi Sarah, this is Alex from PitchIQ. I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B. Do you have 30 seconds?", timestampMs: 5000 },
      { role: 'assistant', content: 'Sure, go ahead. What is this about?', timestampMs: 18000 },
      { role: 'user', content: 'Thanks. We help VP-level sales leaders quantify rep performance gaps. Companies like yours typically see a 20% lift in quota attainment within 90 days. Is improving team efficiency something on your radar right now?', timestampMs: 28000 },
      { role: 'assistant', content: 'We do have some challenges there, yes. Our reps are ramping slowly and we\'re not hitting our numbers. But we already have a tool for this.', timestampMs: 55000 },
      { role: 'user', content: 'Interesting — what does that tool measure today? And is it giving you the visibility you need on where deals are actually stalling?', timestampMs: 75000 },
      { role: 'assistant', content: 'Honestly it mostly tracks CRM activity, not skill gaps. We can see what reps are doing but not why deals fall through.', timestampMs: 100000 },
      { role: 'user', content: "That's the exact gap we solve. If you could pinpoint within 24 hours which MEDDIC component each rep is weak on, how would that change your coaching rhythm?", timestampMs: 120000 },
      { role: 'assistant', content: "That would be huge. Right now I'm spending 3 hours per week listening to random calls.", timestampMs: 148000 },
    ],
    frameworkScores: [
      { component: 'Metrics', score: 85, feedback: 'Strong quantitative framing. Anchored the value conversation with a 20% efficiency figure early and followed up by helping the prospect self-calculate the cost of inaction.', evidence: ['Mentioned 20% quota attainment lift at 0:28', 'Calculated the cost of 3hrs/week coaching time at 2:45'] },
      { component: 'Economic Buyer', score: 78, feedback: 'Correctly identified that the CRO has final say. However, did not ask what the CRO\'s specific success criteria are.', evidence: ['Asked about decision makers — correctly surfaced Marcus and the CRO'] },
      { component: 'Decision Criteria', score: 72, feedback: 'Touched on attainment metrics as a success criterion but did not explicitly ask Sarah what the evaluation criteria would be.', evidence: ['Assumed attainment % is the key metric without confirmation'] },
      { component: 'Identify Pain', score: 92, feedback: 'Excellent pain discovery. Uncovered 3 distinct pain points without being pushy.', evidence: ['Uncovered "ramps slowly" at 0:55', 'Surfaced skill gap vs. activity tracking at 1:40'] },
      { component: 'Champion', score: 65, feedback: 'Identified Marcus as an influencer but did not do the work to build a champion.', evidence: ['Named Marcus as an influencer — good', 'Did not ask if Sarah would be the internal champion'] },
    ],
    timelineEvents: [
      { type: 'GOOD', timestampMs: 5000, title: 'Permission-based opener', description: 'Opened with a specific research reference and asked for 30 seconds.', transcriptRef: "I was looking at TechCorp's recent expansion" },
      { type: 'GOOD', timestampMs: 75000, title: 'Probed existing solution gap', description: 'Rather than attacking the competitor, asked what the current tool measures.', transcriptRef: 'what does that tool measure today?' },
      { type: 'ISSUE', timestampMs: 218000, title: 'Pricing objection glossed over', description: 'The prospect said "pricing seems steep" and you immediately pivoted.', suggestion: 'Acknowledge and reframe: quantify the ROI before defending price', transcriptRef: 'pricing seems steep for what you\'re describing' },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain identification. You quantified business impact naturally and secured a clear next step.',
      strengths: ['Opened with a permission-based, research-backed hook', 'Let the prospect quantify pain in her own words'],
      improvements: ['Ask explicitly for the Economic Buyer\'s success criteria', 'Build Sarah as a champion before the next meeting'],
      proTip: 'Use the "impact gap" close: after uncovering pain, ask "What happens if this is still unsolved in 6 months?"',
      scorecardGroups: [
        { group: 'Pain & Metrics Discovery', maxPoints: 2, earnedPoints: 2, criteria: [{ question: 'Did the seller uncover specific pain points?', passed: true, reasoning: 'Three distinct pains uncovered by 1:40.' }] },
      ],
    }),
  });

  // Additional sessions for other agents
  await Session.insertMany([
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'SPIN', totalScore: 68,
      durationSeconds: 540, startedAt: new Date(now - 87_000_000), endedAt: new Date(now - 86_400_000),
      userId: agents[0]._id, personaId: personas[1]._id, companyId: company._id,
      messages: [], frameworkScores: [
        { component: 'Situation Questions', score: 75, feedback: 'Good situational awareness', evidence: [] },
        { component: 'Problem Questions', score: 62, feedback: 'Could dig deeper', evidence: [] },
        { component: 'Implication Questions', score: 58, feedback: 'Surface-level implications', evidence: [] },
        { component: 'Need-Payoff Questions', score: 77, feedback: 'Good need-payoff alignment', evidence: [] },
      ], timelineEvents: [],
      aiFeedback: JSON.stringify({ overallFeedback: 'A decent SPIN session but implication questions need more depth.', strengths: ['Good situation framing'], improvements: ['Deepen implication questions'], proTip: 'Chain your implication questions.' }),
      scenarioConfig: { industry: 'FinTech', roleplayType: 'Discovery Call', personaContext: '', displayName: 'Marcus Thompson', displayTitle: 'CTO', displayEmoji: '', difficulty: 'HARD', suggestedQuestions: [] },
    },
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'BANT', totalScore: 75,
      durationSeconds: 900, startedAt: new Date(now - 2 * 86_400_000 - 600_000), endedAt: new Date(now - 2 * 86_400_000),
      userId: agents[1]._id, personaId: personas[2]._id, companyId: company._id,
      messages: [], frameworkScores: [
        { component: 'Budget', score: 70, feedback: 'Budget discussed but not qualified', evidence: [] },
        { component: 'Authority', score: 80, feedback: 'Clearly identified decision maker', evidence: [] },
        { component: 'Need', score: 85, feedback: 'Strong need identification', evidence: [] },
        { component: 'Timeline', score: 65, feedback: 'Timeline discussion was vague', evidence: [] },
      ], timelineEvents: [],
      aiFeedback: JSON.stringify({ overallFeedback: 'Good BANT qualification with strong need identification.', strengths: ['Strong authority identification'], improvements: ['Qualify budget more precisely'], proTip: 'When asking about budget, try "What investment range have you allocated for solving this?"' }),
      scenarioConfig: { industry: 'Construction Tech', roleplayType: 'Cold Call', personaContext: '', displayName: 'Priya Patel', displayTitle: 'Head of Engineering', displayEmoji: '', difficulty: 'MEDIUM', suggestedQuestions: [] },
    },
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'CHALLENGER', totalScore: 55,
      durationSeconds: 480, startedAt: new Date(now - 4 * 86_400_000 - 480_000), endedAt: new Date(now - 4 * 86_400_000),
      userId: agents[2]._id, personaId: personas[3]._id, companyId: company._id,
      messages: [], frameworkScores: [], timelineEvents: [],
      scenarioConfig: { industry: 'Retail', roleplayType: 'Sales Pitch', personaContext: '', displayName: 'Robert Blake', displayTitle: 'CFO', displayEmoji: '', difficulty: 'EXPERT', suggestedQuestions: [] },
    },
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'SNAP', totalScore: 88,
      durationSeconds: 660, startedAt: new Date(now - 6 * 86_400_000 - 660_000), endedAt: new Date(now - 6 * 86_400_000),
      userId: agents[3]._id, personaId: personas[4]._id, companyId: company._id,
      messages: [], frameworkScores: [], timelineEvents: [],
      scenarioConfig: { industry: 'Marketing', roleplayType: 'Cold Call', personaContext: '', displayName: 'Emma Wilson', displayTitle: 'Marketing Director', displayEmoji: '', difficulty: 'EASY', suggestedQuestions: [] },
    },
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'MEDDICC', totalScore: 62,
      durationSeconds: 1020, startedAt: new Date(now - 10 * 86_400_000 - 1020_000), endedAt: new Date(now - 10 * 86_400_000),
      userId: agent._id, personaId: personas[5]._id, companyId: company._id,
      messages: [], frameworkScores: [], timelineEvents: [],
      scenarioConfig: { industry: 'Logistics', roleplayType: 'Discovery Call', personaContext: '', displayName: 'Carlos Rodriguez', displayTitle: 'Operations Manager', displayEmoji: '', difficulty: 'MEDIUM', suggestedQuestions: [] },
    },
  ]);

  console.log('Created demo sessions');

  // ── Team Roleplays ─────────────────────────────────────────────────────────
  const drewUser = agents.find((a) => a.email === 'drew@demo.com')!;

  await TeamRoleplay.insertMany([
    {
      name: 'Cold Call Blitz',
      description: 'Practice rapid cold calling with a skeptical VP. Required for all Enterprise reps before Q4.',
      scenarioConfig: {
        industry: 'SaaS', roleplayType: 'Cold Call',
        personaContext: 'You are a skeptical VP of Sales at a mid-sized SaaS company. You are busy, dismissive of cold callers, but can be won over with a sharp, research-backed opener. Push back on anything vague.',
        displayName: 'Sarah Chen', displayTitle: 'VP of Sales, TechCorp', displayEmoji: '', difficulty: 'Hard',
        suggestedQuestions: ['How did you get this number?', 'What makes you different?', "I'm busy — 30 seconds.", 'What does it cost?'],
      },
      isActive: true, companyId: company._id, createdById: drewUser._id,
      assignmentTarget: { scope: 'team', teamIds: ['Enterprise'] },
      allowPeerListening: true, completionCount: 6,
    },
    {
      name: 'EMEA Discovery Call',
      description: 'Regional discovery call practice — banking & fintech personas for the EMEA market.',
      scenarioConfig: {
        industry: 'Banking', roleplayType: 'Discovery Call',
        personaContext: 'You are the Head of Treasury at a European bank evaluating a new fintech partnership. You are compliance-focused and risk-averse. Ask about SLAs, data residency (GDPR), and integration timelines.',
        displayName: 'Emma Hartmann', displayTitle: 'Head of Treasury, Erste Bank', displayEmoji: '', difficulty: 'Hard',
        suggestedQuestions: ['Is your platform GDPR-compliant?', 'Where is data hosted?', 'What are your SLAs?'],
      },
      isActive: true, companyId: company._id, createdById: drewUser._id,
      assignmentTarget: { scope: 'region', regions: ['EMEA'] },
      allowPeerListening: true, completionCount: 3,
    },
    {
      name: 'SMB Objection Drill',
      description: 'Handle the toughest SMB price objections. All SMB reps must complete before end of month.',
      scenarioConfig: {
        industry: 'SaaS', roleplayType: 'Objection Handling',
        personaContext: "You are the owner of a 50-person company being pitched a SaaS product you cannot afford. Your main objection is price — you like the product but the budget simply isn't there. Push hard on discounts, payment terms, and ROI justification.",
        displayName: 'Carlos Mendez', displayTitle: 'CEO, GrowthBridge', displayEmoji: '', difficulty: 'Medium',
        suggestedQuestions: ["That's too expensive.", 'Can you do a free trial?', "What's the minimum to get started?"],
      },
      isActive: true, companyId: company._id, createdById: drewUser._id,
      assignmentTarget: { scope: 'team', teamIds: ['SMB'] },
      allowPeerListening: false, completionCount: 8,
    },
  ]);

  console.log('Created team roleplays');

  // ── Evaluation Prompts ─────────────────────────────────────────────────────
  await EvaluationPrompt.insertMany([
    {
      roleplayType: 'cold_call',
      displayName: 'Cold Call',
      isActive: true,
      scoringCriteria: [
        { group: 'Opener', criteria: [{ question: 'Permission-based opener?', hint: 'Did the rep ask for a brief moment before pitching?' }, { question: 'Used research on prospect?', hint: 'Referenced something specific about the prospect or company.' }] },
        { group: 'Discovery', criteria: [{ question: 'SDR asked for preconceptions of product?', hint: "Did the rep ask about the prospect's current awareness before pitching?" }] },
        { group: 'Social Proof', criteria: [{ question: 'Provided social proof?', hint: 'Cited a relevant customer reference, metric, or case study.' }, { question: 'Asked if social proof was relevant?', hint: 'Checked whether the social proof was relevant to this specific prospect.' }] },
        { group: 'Takeaway', criteria: [{ question: 'Re-confirmed that the time works?', hint: 'Checked timing still works before closing.' }, { question: 'Asked for success criteria for next call?', hint: 'Asked what a successful next call would look like.' }] },
        { group: 'Closing', criteria: [{ question: 'Next steps agreed upon?', hint: 'Both parties agreed on a clear, specific next step.' }, { question: 'Follow-up meeting booked?', hint: 'A specific date/time for a follow-up was confirmed.' }] },
      ],
      promptTemplate: `You are an expert SDR coach evaluating a cold call roleplay.

SCORECARD — for each criterion, determine if it was done (passed: true) or not (passed: false) and provide one sentence of evidence from the transcript.

Criterion Groups:
- Opener (2 pts): Permission-based opener? | Used research on prospect?
- Discovery (1 pt): Asked for preconceptions of product?
- Social Proof (2 pts): Provided social proof? | Asked if social proof was relevant?
- Takeaway (2 pts): Re-confirmed timing works? | Asked for success criteria for next call?
- Closing (2 pts): Next steps agreed upon? | Follow-up meeting booked?

TRANSCRIPT:
{transcript}

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "overallFeedback": "<2-3 sentence summary>",
  "scorecardGroups": [{ "group": "<name>", "maxPoints": <int>, "earnedPoints": <int>, "criteria": [{ "question": "<q>", "passed": <bool>, "reasoning": "<1 sentence>" }] }],
  "timelineEvents": [{ "type": "<ISSUE|GOOD|WARNING|NEUTRAL>", "timestampMs": <ms>, "title": "<short>", "description": "<what>", "suggestion": "<tip or null>", "transcriptRef": "<quote or null>", "betterResponse": "<alt or null>" }],
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "proTip": "<single most impactful tip>"
}`,
    },
    {
      roleplayType: 'discovery_call',
      displayName: 'Discovery Call',
      isActive: true,
      scoringCriteria: [
        { group: 'Introduction & Agenda', criteria: [{ question: "Did the seller discuss the agenda and ask for prospect's input?", hint: 'Set an agenda AND asked the prospect if there\'s anything they want to cover.' }, { question: 'Did the seller introduce an Upfront Contract?', hint: 'Established mutual expectations: what will happen, what the outcome will be.' }] },
        { group: 'Pain & Metrics Discovery', criteria: [{ question: 'Did the seller uncover specific pain points?', hint: 'At least one concrete, specific problem uncovered.' }, { question: 'Did the seller uncover relevant metrics?', hint: 'Quantified impact — time lost, revenue lost, cost, or other measurable metric.' }] },
        { group: 'Objection Handling', criteria: [{ question: 'Did the seller handle objections effectively using the FFF framework?', hint: 'Acknowledged, empathised (Feel-Felt-Found), then reframed any objection raised.' }] },
        { group: 'Customer Reference & Value', criteria: [{ question: 'Did the seller present a customer reference?', hint: 'Referenced a similar customer and their outcome.' }, { question: "Did the seller explore the prospect's goal-setting framework?", hint: 'Asked how the prospect measures success or sets targets.' }] },
        { group: 'Closing', criteria: [{ question: 'Did the seller revisit the upfront contract and define next steps?', hint: 'Closed by referencing what was agreed at the start.' }, { question: 'Did the seller qualify out or in effectively?', hint: 'Reached a clear conclusion about whether this is a qualified opportunity.' }] },
      ],
      promptTemplate: `You are an expert AE coach evaluating a discovery call roleplay.

SCORECARD — for each criterion, determine if it was done (passed: true) or not (passed: false) and provide one sentence of evidence.

Criterion Groups:
- Introduction & Agenda (2 pts): Discussed agenda and asked for prospect input? | Introduced an Upfront Contract?
- Pain & Metrics Discovery (2 pts): Uncovered specific pain points? | Uncovered relevant metrics?
- Objection Handling (1 pt): Handled objections using FFF (Feel-Felt-Found) or equivalent?
- Customer Reference & Value (2 pts): Presented a customer reference? | Explored prospect's goal-setting framework?
- Closing (2 pts): Revisited upfront contract and defined next steps? | Qualified in or out effectively?

TRANSCRIPT:
{transcript}

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "overallFeedback": "<2-3 sentence summary>",
  "scorecardGroups": [...],
  "timelineEvents": [...],
  "strengths": ["..."],
  "improvements": ["..."],
  "proTip": "<single most impactful tip>"
}`,
    },
    {
      roleplayType: 'sales_pitch',
      displayName: 'Sales Pitch',
      isActive: true,
      scoringCriteria: [
        { group: 'Value Proposition', criteria: [{ question: 'Did the seller open with a clear, specific value proposition?', hint: "Value stated in prospect's language, not feature-speak." }, { question: 'Did the seller differentiate from competition?', hint: 'Explicitly addressed why they are different from alternatives.' }] },
        { group: 'Business Case', criteria: [{ question: 'Did the seller build a ROI / business case?', hint: "Quantified the return or cost of inaction in prospect's terms." }, { question: 'Did the seller use a customer reference or proof point?', hint: 'Referenced a relevant case study or social proof.' }] },
        { group: 'Objection Handling', criteria: [{ question: 'Did the seller handle questions and objections confidently?', hint: 'Acknowledged, explored, and reframed without becoming defensive.' }] },
        { group: 'Closing', criteria: [{ question: 'Did the seller define a clear next step?', hint: 'Specific, time-bound next action agreed.' }, { question: "Did the seller confirm prospect's commitment to next step?", hint: 'Prospect verbally agreed to the proposed next step.' }] },
      ],
      promptTemplate: `You are an expert sales coach evaluating a sales pitch roleplay.
TRANSCRIPT: {transcript}
Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, proTip.`,
    },
    {
      roleplayType: 'objection_handling',
      displayName: 'Objection Handling',
      isActive: true,
      scoringCriteria: [
        { group: 'Objection Response', criteria: [
          { question: 'Did the seller acknowledge the objection without defending?', hint: 'Validated the concern before responding.' },
          { question: 'Did the seller explore the root cause with a question?', hint: "Asked a clarifying question to understand what's driving the objection." },
          { question: 'Did the seller provide relevant evidence or reframe?', hint: 'Addressed the objection with a specific fact, story, or reframe.' },
          { question: 'Did the seller confirm the objection was resolved?', hint: 'Checked that the prospect was satisfied with the response.' },
          { question: 'Did the seller maintain momentum toward next step?', hint: 'Moved the conversation forward after resolving the objection.' },
        ]},
      ],
      promptTemplate: `You are an expert sales coach evaluating an objection handling roleplay.
TRANSCRIPT: {transcript}
Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, proTip.`,
    },
    {
      roleplayType: 'negotiation',
      displayName: 'Negotiation',
      isActive: true,
      scoringCriteria: [
        { group: 'Negotiation Technique', criteria: [
          { question: 'Did the seller anchor high before conceding?', hint: 'Started from a strong position before making any concessions.' },
          { question: 'Did the seller trade concessions (not give without getting)?', hint: 'Every concession was paired with a request in return.' },
          { question: 'Did the seller protect margin and key terms?', hint: 'Avoided giving away price or terms without protecting core value.' },
          { question: 'Did the seller reach a mutually agreed outcome?', hint: 'Both parties reached explicit agreement on terms.' },
          { question: 'Did the seller maintain relationship throughout?', hint: 'Tone stayed professional and collaborative despite pressure.' },
        ]},
      ],
      promptTemplate: `You are an expert sales coach evaluating a negotiation roleplay.
TRANSCRIPT: {transcript}
Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, proTip.`,
    },
    {
      roleplayType: 'account_expansion',
      displayName: 'Account Expansion',
      isActive: true,
      scoringCriteria: [
        { group: 'Expansion Discovery', criteria: [
          { question: 'Did the seller reference existing relationship or wins?', hint: 'Grounded the conversation in proven value already delivered.' },
          { question: 'Did the seller identify a new business need or expansion trigger?', hint: 'Found a new pain point or growth opportunity in the account.' },
        ]},
        { group: 'Expansion Business Case', criteria: [
          { question: 'Did the seller map to additional stakeholders?', hint: 'Identified new decision-makers or champions for the expansion.' },
          { question: 'Did the seller present an expansion business case with ROI?', hint: 'Quantified the value of expanding the engagement.' },
          { question: 'Did the seller define next steps for the expansion?', hint: 'Agreed on a specific next step to move the expansion forward.' },
        ]},
      ],
      promptTemplate: `You are an expert account manager coach evaluating an account expansion roleplay.
TRANSCRIPT: {transcript}
Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, proTip.`,
    },
    {
      roleplayType: 'customer_support',
      displayName: 'Customer Support',
      isActive: true,
      scoringCriteria: [
        { group: 'Issue Resolution', criteria: [
          { question: 'Did the rep acknowledge and empathise with the customer?', hint: "Showed genuine understanding of the customer's frustration." },
          { question: 'Did the rep correctly diagnose the issue?', hint: 'Asked clarifying questions to understand the root cause.' },
          { question: 'Did the rep offer a clear solution or next step?', hint: 'Provided a specific resolution path, not just "I\'ll look into it".' },
          { question: 'Did the rep set accurate expectations?', hint: 'Was honest about timelines and what can/cannot be done.' },
          { question: 'Did the rep confirm customer satisfaction before closing?', hint: 'Checked the customer was happy with the resolution.' },
        ]},
      ],
      promptTemplate: `You are an expert customer support coach evaluating a support call roleplay.
TRANSCRIPT: {transcript}
Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, proTip.`,
    },
  ]);

  console.log('Created evaluation prompts');

  console.log('\n✓ Seed complete!');
  console.log('\nDemo accounts (password: Demo1234!):');
  console.log('  superadmin@demo.com — Super Admin');
  console.log('  admin@demo.com      — Company Admin (TechCorp)');
  console.log('  manager@demo.com    — Manager (TechCorp)');
  console.log('  agent@demo.com      — Agent (TechCorp)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
