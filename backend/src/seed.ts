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
              first_message: `${persona.name.split(' ')[0]} speaking.`,
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

  // ── Session 1: Rich MEDDIC Discovery Call (agent@demo.com) ───────────────
  await Session.create({
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'MEDDIC',
    totalScore: 81,
    durationSeconds: 492,
    startedAt: new Date(now - 3_700_000),
    endedAt: new Date(now - 3_208_000),
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
      objections: ['Too expensive for what you\'re offering', 'We already use Gong for this', 'Not the right time — end of quarter'],
      avatarId: 'sarah',
    },
    messages: [
      { role: 'user', content: "Hi Sarah, this is Alex from PitchIQ. I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B. Do you have 30 seconds?", timestampMs: 5000 },
      { role: 'assistant', content: 'Sure, 30 seconds. What is this about?', timestampMs: 18000 },
      { role: 'user', content: 'Thanks. We help VP-level sales leaders like you quantify exactly where rep performance breaks down. Companies our size typically see a 20% lift in quota attainment in the first 90 days. Is that something on your radar?', timestampMs: 28000 },
      { role: 'assistant', content: 'We do have challenges there. Our reps are ramping slowly and we\'re missing numbers. But we already have Gong for this.', timestampMs: 52000 },
      { role: 'user', content: 'Interesting — what does Gong measure for you today? And is it showing you where deals stall by MEDDIC component, or more call activity?', timestampMs: 68000 },
      { role: 'assistant', content: 'Honestly mostly call activity. We can see what reps are doing but not exactly why specific deals fall through.', timestampMs: 95000 },
      { role: 'user', content: "That's the exact gap we solve. If you could pinpoint within 24 hours which MEDDIC component each rep struggles with, how would that change your coaching time?", timestampMs: 118000 },
      { role: 'assistant', content: "It would be transformative. I spend about 3 hours per week just listening to random calls hoping to catch something.", timestampMs: 145000 },
      { role: 'user', content: "So at roughly $200 an hour loaded cost, that's $600 a week — $31K a year — just on manual call review. And that's before the quota miss cost. What does a 10% miss on your team look like in dollars?", timestampMs: 165000 },
      { role: 'assistant', content: "...that's a painful number. We have 20 reps at $1.2M quota each — a 10% miss is $2.4 million.", timestampMs: 198000 },
      { role: 'user', content: "Exactly. So the question isn't whether the cost of this problem justifies a tool — it does. The question is whether we're the right fit. Can we book 30 minutes with you and your CRO next week to walk through exactly how we'd close that gap?", timestampMs: 218000 },
      { role: 'assistant', content: "I need to think about it. The pricing seems steep for what you're describing.", timestampMs: 248000 },
      { role: 'user', content: "That's fair — it should feel that way before you've seen the ROI model. What if we built it together on the call? I'll bring our implementation lead and we'll map out the specific ROI for TechCorp. Does Thursday at 2pm work?", timestampMs: 265000 },
      { role: 'assistant', content: "Send me a calendar invite. If the ROI model holds up, I'll have Marcus join.", timestampMs: 295000 },
      { role: 'user', content: "Perfect — sending now. One last thing: what would a successful next call look like from your side? What would you need to see to feel good about taking this to Marcus?", timestampMs: 310000 },
      { role: 'assistant', content: "Show me real data from a company our size. Not case study fluff — actual before/after quota numbers.", timestampMs: 345000 },
    ],
    frameworkScores: [
      {
        component: 'Metrics',
        score: 88,
        feedback: 'Excellent quantitative framing. You anchored with a 20% lift claim, then helped Sarah self-calculate her own cost — $31K/year in coaching time and $2.4M quota miss risk. This is exactly how metrics should be surfaced: in the prospect\'s own terms.',
        evidence: ['Cited 20% quota attainment lift at 0:28', 'Calculated $31K/year coaching cost from her own numbers at 2:45', 'Surfaced $2.4M quota miss figure at 3:18'],
      },
      {
        component: 'Economic Buyer',
        score: 74,
        feedback: 'You identified Marcus as the CRO and secured a commitment to have him join the next call. However, you didn\'t ask what Marcus specifically cares about or what his success criteria are — this is a gap that could create a surprise on the next call.',
        evidence: ['Sarah mentioned Marcus (CRO) at 4:55 — you correctly flagged him as the EB', 'Secured conditional commitment to bring Marcus to next call at 4:55'],
      },
      {
        component: 'Decision Criteria',
        score: 70,
        feedback: 'You touched on attainment improvement and ROI as likely evaluation criteria, but you never asked Sarah directly: "What would a successful vendor need to prove to you?" This leaves you guessing at what the scorecard looks like.',
        evidence: ['Assumed attainment % is the primary criterion — never confirmed at 1:58'],
      },
      {
        component: 'Identify Pain',
        score: 92,
        feedback: 'Outstanding pain discovery. You uncovered 3 distinct layers: slow ramp (surface pain), 3hrs/week manual coaching (business cost), and $2.4M quota miss (organisational impact). You let Sarah do the math herself, which is far more powerful than you stating the number.',
        evidence: ['Slow ramp & missed numbers uncovered at 0:52', 'Manual coaching cost 3hrs/week surfaced at 2:25', 'Prospect self-calculated $2.4M miss at 3:18'],
      },
      {
        component: 'Champion',
        score: 62,
        feedback: 'Sarah is a potential champion but you didn\'t explicitly build her in that role. You got the next step, but you didn\'t arm her — no internal pitch, no one-pager offer, no "how do you sell this internally" question. She may struggle to justify the next call to Marcus without your help.',
        evidence: ['Did not ask Sarah what she needs to present this internally at 3:58', 'Did not offer a one-pager or internal talking points'],
      },
    ],
    timelineEvents: [
      { type: 'GOOD', timestampMs: 5000, title: 'Strong permission-based opener', description: 'Opened with a specific research reference to the Series B and asked for only 30 seconds — low-friction entry.', transcriptRef: "I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B" },
      { type: 'GOOD', timestampMs: 68000, title: 'Competitor probe without attacking', description: "Rather than dismissing Gong, you asked what it measures — turning the objection into a discovery question.", transcriptRef: 'what does Gong measure for you today?' },
      { type: 'GOOD', timestampMs: 165000, title: 'ROI calculation in prospect\'s own numbers', description: 'Converted coaching time to dollars using Sarah\'s own data — much more compelling than quoting a benchmark.', transcriptRef: "So at roughly $200 an hour loaded cost, that's $600 a week" },
      { type: 'WARNING', timestampMs: 218000, title: 'Moved to close without confirming criteria', description: 'You jumped to booking a meeting before asking what Sarah would need to see to feel confident. This was recovered later but created a moment of resistance.', suggestion: 'Before asking for the meeting, ask: "What would need to be true for you to feel this is worth 30 minutes of your CRO\'s time?"' },
      { type: 'ISSUE', timestampMs: 248000, title: 'Price objection handled defensively', description: 'When Sarah said "pricing seems steep", you reframed but did not acknowledge her concern first. Starting with "That\'s fair — it should feel that way" slightly softened it, but you moved to the solution before exploring what "steep" means to her.', suggestion: 'Probe the objection before reframing: "When you say steep — is that relative to budget, or relative to what you\'ve seen for similar tools?"', transcriptRef: "The pricing seems steep for what you're describing", betterResponse: "Totally fair — and I want to earn that. Before I defend the number, can I ask: when you say steep, is that relative to your current budget cycle, or relative to what you\'d expect a tool like this to cost?" },
      { type: 'GOOD', timestampMs: 310000, title: 'Pre-call success criteria asked', description: 'You ended by asking Sarah what a successful next call would look like — this gives you a clear mandate for the Thursday meeting.', transcriptRef: 'what would a successful next call look like from your side?' },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain quantification and a well-executed ROI conversation. You let Sarah do the maths herself, which is far more persuasive than presenting a number. The main gap is champion development — you left the call without arming Sarah for her internal conversation with Marcus.',
      strengths: [
        'Opened with a research-backed, low-friction permission ask',
        'Converted abstract pain into concrete dollar figures using the prospect\'s own data',
        'Recovered from the price objection and secured a conditional next step with the CRO',
        'Closed by asking for next-call success criteria — textbook pre-frame',
      ],
      improvements: [
        'Ask the Economic Buyer\'s success criteria before the next call — "What does Marcus care most about when evaluating a tool like this?"',
        'Build Sarah as champion explicitly: offer an internal one-pager or talking points she can use with Marcus',
        'Probe objections before reframing — ask what "steep" means to her before defending value',
      ],
      proTip: 'After the ROI calculation lands, ask: "So on that basis, what\'s the cost of doing nothing for another 6 months?" — this closes the urgency loop before you ask for the meeting.',
      scorecardGroups: [
        {
          group: 'Introduction & Agenda',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', passed: false, reasoning: 'Rep asked for 30 seconds but did not set a full agenda or invite Sarah to add topics at 0:05.' },
            { question: 'Did the seller introduce an Upfront Contract?', passed: true, reasoning: 'Permission-based opener at 0:05 established a clear ask and implicit mutual expectation.' },
          ],
        },
        {
          group: 'Pain & Metrics Discovery',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Did the seller uncover specific pain points?', passed: true, reasoning: 'Three distinct pain layers uncovered: slow ramp at 0:52, manual coaching cost at 2:25, quota miss at 3:18.' },
            { question: 'Did the seller uncover relevant metrics?', passed: true, reasoning: 'Quantified $31K/year coaching cost and $2.4M quota miss risk at 2:45 and 3:18 using Sarah\'s own numbers.' },
          ],
        },
        {
          group: 'Objection Handling',
          maxPoints: 1,
          earnedPoints: 0,
          criteria: [
            { question: 'Did the seller handle objections effectively using the FFF framework?', passed: false, reasoning: 'Price objection at 4:08 was reframed before the root cause was explored — jumped to solution without full acknowledgement.' },
          ],
        },
        {
          group: 'Customer Reference & Value',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller present a customer reference?', passed: false, reasoning: 'No customer reference or case study was cited during the call — missed opportunity to build credibility.' },
            { question: "Did the seller explore the prospect's goal-setting framework?", passed: true, reasoning: 'Asked Sarah for next-call success criteria at 5:10 — surfaced her need for real before/after quota data.' },
          ],
        },
        {
          group: 'Closing',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Did the seller revisit the upfront contract and define next steps?', passed: true, reasoning: 'Calendar invite agreed for Thursday at 2pm at 4:25, with CRO conditionally included.' },
            { question: 'Did the seller qualify out or in effectively?', passed: true, reasoning: 'Call ended with a clear qualified next step and success criteria defined by the prospect at 5:25.' },
          ],
        },
      ],
    }),
  });

  // ── Session 2: Rich SPIN Discovery (jordan@demo.com) ──────────────────────
  await Session.create({
    type: 'ONLINE_MEETING',
    status: 'COMPLETED',
    framework: 'SPIN',
    totalScore: 72,
    durationSeconds: 540,
    startedAt: new Date(now - 87_000_000),
    endedAt: new Date(now - 86_460_000),
    userId: agents[0]._id,
    personaId: personas[1]._id,
    companyId: company._id,
    scenarioConfig: {
      industry: 'FinTech',
      roleplayType: 'Discovery Call',
      personaContext: personas[1].systemPrompt,
      displayName: personas[1].name,
      displayTitle: personas[1].title,
      displayEmoji: '',
      difficulty: 'HARD',
      suggestedQuestions: ['What does your current integration architecture look like?', 'How long would a typical vendor integration take your team?'],
      objections: ['Security concerns with third-party data access', 'We can build this in-house', 'Integration complexity is too high'],
      avatarId: 'marcus',
    },
    messages: [
      { role: 'user', content: "Marcus, thanks for making time. I know you're heads-down on the Q3 infrastructure push. Can you tell me a bit about how your team currently handles API rate limiting across your microservices?", timestampMs: 8000 },
      { role: 'assistant', content: "We have a custom solution built on Redis. It works but it's been causing issues during peak traffic — we had two incidents last month.", timestampMs: 28000 },
      { role: 'user', content: "Two incidents in a month — what's the downstream impact when that happens? Does it affect transaction processing or just the API gateway?", timestampMs: 45000 },
      { role: 'assistant', content: "Both. During the last incident we had a 40-minute window where payment processing was degraded. That's not acceptable for a fintech.", timestampMs: 65000 },
      { role: 'user', content: "A 40-minute payment degradation — what did that cost you in chargebacks and customer support volume?", timestampMs: 85000 },
      { role: 'assistant', content: "We don't have exact numbers but the support spike alone cost us maybe $50K in escalation costs. Plus reputational risk with our enterprise clients.", timestampMs: 108000 },
      { role: 'user', content: "So if this happens 2 more times this quarter — which it statistically will if the root cause is still there — you're looking at $150K minimum and potential churn from enterprise accounts. What does your average enterprise contract run?", timestampMs: 128000 },
      { role: 'assistant', content: "Around $800K ARR for our top tier. And yes, one of them already flagged SLA concerns after the last incident.", timestampMs: 158000 },
      { role: 'user', content: "That changes the math significantly. If we could eliminate these incidents entirely — not just reduce them — how would that change your relationship with that client?", timestampMs: 178000 },
      { role: 'assistant', content: "It would be a different conversation. Right now I'm managing damage. I'd rather be selling them on expanding the relationship.", timestampMs: 205000 },
      { role: 'user', content: "Exactly. What if I could show you a way to make your current Redis layer incident-proof without a full rip-and-replace? Would a 30-minute technical deep-dive be worth your time?", timestampMs: 225000 },
      { role: 'assistant', content: "Depends on whether it requires touching our core infrastructure. We have a freeze on production changes until the audit is done.", timestampMs: 250000 },
    ],
    frameworkScores: [
      {
        component: 'Situation Questions',
        score: 82,
        feedback: 'Good situational grounding. You asked about the current architecture before pitching, which established credibility and opened up the Redis context. Could have asked one more situation question about team size and capacity before moving to problems.',
        evidence: ['Asked about current API rate limiting setup at 0:08', 'Established Redis as current solution at 0:28'],
      },
      {
        component: 'Problem Questions',
        score: 78,
        feedback: 'Strong problem identification. You surfaced both the technical issue (Redis rate limiting) and the business symptom (payment degradation). The two-incident data point was a natural problem reveal you handled well.',
        evidence: ['Uncovered two infrastructure incidents last month at 0:28', 'Surfaced 40-minute payment degradation impact at 1:05'],
      },
      {
        component: 'Implication Questions',
        score: 65,
        feedback: 'You asked good implication questions but stopped at the first level. You quantified the $50K support cost but didn\'t chain into the enterprise churn risk until prompted by his own answer. A stronger implication chain would have asked: "What does it mean for your team\'s credibility internally if this happens again?"',
        evidence: ['Asked about downstream cost of incidents at 1:25', 'Quantified $150K statistical risk over the quarter at 2:08'],
      },
      {
        component: 'Need-Payoff Questions',
        score: 64,
        feedback: 'The need-payoff question at 2:58 was good but came too early. You moved to "how would eliminating these incidents change your relationship?" before Marcus had fully expressed the implication of losing the $800K client. Let the pain land fully before pivoting to payoff.',
        evidence: ['Need-payoff question asked at 2:58 — slightly premature', 'Marcus articulated value himself at 3:25 — "I\'d rather be selling them on expanding"'],
      },
    ],
    timelineEvents: [
      { type: 'GOOD', timestampMs: 8000, title: 'Context-first opener', description: 'Opened by asking about the current setup rather than pitching — immediately established technical credibility with a CTO.', transcriptRef: 'how your team currently handles API rate limiting across your microservices' },
      { type: 'GOOD', timestampMs: 85000, title: 'ROI quantification from incident data', description: 'Converted abstract "two incidents" into a concrete $50K cost figure and extended it to a statistical quarterly risk.', transcriptRef: 'what did that cost you in chargebacks and customer support volume' },
      { type: 'WARNING', timestampMs: 178000, title: 'Need-payoff question too early', description: 'Moved to the payoff question before Marcus had fully processed the implication of potential enterprise churn. The pain hadn\'t fully landed yet.', suggestion: 'Ask one more implication question: "What does it mean for your team if you lose that $800K account?" — then move to payoff.' },
      { type: 'GOOD', timestampMs: 205000, title: 'Prospect articulated value in own words', description: 'Marcus said "I\'d rather be selling them on expanding the relationship" — this is the most powerful buy-in signal in SPIN: the prospect states the need-payoff themselves.', transcriptRef: "I'd rather be selling them on expanding the relationship" },
      { type: 'ISSUE', timestampMs: 250000, title: 'Objection revealed a qualification blocker', description: 'Production freeze until audit completion is a material timeline constraint that was not uncovered earlier. Should have asked about change freeze policy in the situation phase.', suggestion: 'In future calls, include "Do you have any change freezes or audit cycles coming up?" in your situation questions.', transcriptRef: "We have a freeze on production changes until the audit is done" },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'A technically fluent SPIN session with strong situation and problem discovery. Your implication questions were effective but didn\'t chain deeply enough before moving to need-payoff. The audit freeze revealed a qualification gap — change control policies should be surfaced in situation questions for technical buyers.',
      strengths: [
        'Context-first opener earned instant credibility with a CTO-level prospect',
        'Converted abstract incidents into quantified business risk ($50K support + $800K churn exposure)',
        'Let Marcus articulate the value in his own words at 3:25 — the most persuasive outcome in SPIN',
      ],
      improvements: [
        'Chain implication questions deeper: after $50K cost, ask "What happens to team credibility if this is still happening in Q4?"',
        'Add change control questions to situation phase: "Do you have any infrastructure freezes or audits coming up that would affect implementation timing?"',
        'Let the implication pain fully land before pivoting to need-payoff — wait for the silence',
      ],
      proTip: 'After a strong implication, pause. Don\'t fill the silence. Let Marcus sit with the $800K risk before you ask the payoff question — the discomfort is what creates urgency.',
      scorecardGroups: [
        {
          group: 'Situation Questions',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Did the seller establish the current situation before pitching?', passed: true, reasoning: 'Asked about current API architecture and rate limiting setup at 0:08 — strong technical grounding.' },
            { question: 'Did the seller ask about team capacity and constraints?', passed: true, reasoning: 'Change freeze context emerged at 4:10 — though this should have been surfaced earlier in the situation phase.' },
          ],
        },
        {
          group: 'Problem Questions',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Did the seller uncover the core technical problem?', passed: true, reasoning: 'Redis rate limiting causing payment degradation surfaced at 0:28.' },
            { question: 'Did the seller quantify the problem impact?', passed: true, reasoning: '$50K support escalation cost confirmed by Marcus at 1:48.' },
          ],
        },
        {
          group: 'Implication Questions',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller chain implication questions across multiple levels?', passed: false, reasoning: 'Only one implication chain explored (incident cost) — team credibility and internal political implications were not probed at 1:25.' },
            { question: 'Did the seller connect implications to strategic business risk?', passed: true, reasoning: '$800K enterprise churn risk surfaced at 2:38 — strong strategic implication.' },
          ],
        },
        {
          group: 'Need-Payoff Questions',
          maxPoints: 1,
          earnedPoints: 0,
          criteria: [
            { question: 'Did the seller let the prospect articulate the value themselves?', passed: false, reasoning: 'Need-payoff question came at 2:58 before implications fully landed — slightly rushed the moment.' },
          ],
        },
      ],
    }),
  });

  // ── Session 3: BANT Cold Call (taylor@demo.com) ───────────────────────────
  await Session.create({
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'BANT',
    totalScore: 75,
    durationSeconds: 372,
    startedAt: new Date(now - 2 * 86_400_000 - 600_000),
    endedAt: new Date(now - 2 * 86_400_000 - 228_000),
    userId: agents[1]._id,
    personaId: personas[2]._id,
    companyId: company._id,
    scenarioConfig: {
      industry: 'Construction Tech',
      roleplayType: 'Cold Call',
      personaContext: personas[2].systemPrompt,
      displayName: personas[2].name,
      displayTitle: personas[2].title,
      displayEmoji: '',
      difficulty: 'MEDIUM',
      suggestedQuestions: ["What's your current vendor evaluation process?", 'How long does onboarding typically take for new tools?'],
      objections: ['Implementation time is too long', 'My team won\'t adopt it', 'Hidden costs always emerge post-sale'],
      avatarId: 'priya',
    },
    messages: [
      { role: 'user', content: "Hi Priya, this is Taylor from BuildIQ. I'll be brief — we help construction tech companies cut project delivery time by 15% using predictive scheduling. Is reducing delays something your team is working on?", timestampMs: 5000 },
      { role: 'assistant', content: "It is, actually. We've had three projects this quarter come in late because of supplier delays. Go on.", timestampMs: 22000 },
      { role: 'user', content: "Supplier delays are exactly what we solve. We integrate with your ERP to flag risk 14 days out. Have you budgeted for tools to address this, or would this need to go through approval?", timestampMs: 38000 },
      { role: 'assistant', content: "We have a tools budget for the year, but most of it is already allocated. Any new spend would need sign-off from our COO.", timestampMs: 60000 },
      { role: 'user', content: "Understood. Who's your COO and what does that approval process look like?", timestampMs: 78000 },
      { role: 'assistant', content: "David Park. He's the one who'd need to approve anything over $50K. He needs a clear business case — he won't sign off on anything speculative.", timestampMs: 95000 },
      { role: 'user', content: "That's helpful. With three late projects this quarter, what's the rough penalty cost you've absorbed — are we talking rework, liquidated damages, or both?", timestampMs: 112000 },
      { role: 'assistant', content: "Both. I'd estimate $120K in direct costs this quarter alone. It's becoming a pattern.", timestampMs: 135000 },
      { role: 'user', content: "So $480K annualised if nothing changes. That's a strong business case for David. What's your target timeline for getting something in place — before or after the Q4 project cycle?", timestampMs: 152000 },
      { role: 'assistant', content: "Before Q4 would be ideal. That starts in October, so we'd need to be live by September 30 at the latest.", timestampMs: 175000 },
      { role: 'user', content: "September 30 — we can absolutely hit that with a June start. Typical implementation is 6–8 weeks. Would it make sense to set up a 45-minute call with you and David to walk through the business case together?", timestampMs: 192000 },
      { role: 'assistant', content: "That could work. But I need to warn you — David will ask about implementation risk and hidden costs. He's been burned before.", timestampMs: 220000 },
    ],
    frameworkScores: [
      {
        component: 'Budget',
        score: 78,
        feedback: 'Good budget qualification. You surfaced both the existing tools budget and the $50K approval threshold early. The $480K annualised cost framing gave you a strong ROI anchor for the CFO conversation. You could have pushed harder on whether emergency budget exists given the $120K quarterly loss.',
        evidence: ['Budget mostly allocated, new spend needs COO sign-off confirmed at 1:00', 'Quantified $120K quarterly loss creating natural budget justification at 2:15'],
      },
      {
        component: 'Authority',
        score: 85,
        feedback: 'Excellent authority identification. You quickly mapped the decision structure — Priya as champion, David Park (COO) as economic buyer with a $50K threshold — and immediately pivoted to the business case David would need.',
        evidence: ['Identified David Park (COO) as decision maker at 1:35', 'Understood $50K approval threshold and business-case requirement at 1:35'],
      },
      {
        component: 'Need',
        score: 88,
        feedback: 'Strong need identification with excellent quantification. Supplier delays → three late projects → $120K quarterly cost → $480K annualised risk. You let Priya put the number on the table herself, which is far more credible than citing a benchmark.',
        evidence: ['Supplier delay pain confirmed immediately at 0:22', '$120K quarterly direct cost quantified by Priya at 2:15', '$480K annualised projection made at 2:32'],
      },
      {
        component: 'Timeline',
        score: 58,
        feedback: 'You surfaced the September 30 deadline and confirmed implementation feasibility. However, you didn\'t probe what happens if the timeline slips — what\'s the cost of going into Q4 without a solution? This missed urgency is the difference between a "nice to have" and a "must solve now".',
        evidence: ['September 30 deadline uncovered at 2:55', 'Confirmed 6-8 week implementation fits the window at 3:12', 'Did not ask cost of missing the Q4 deadline at 2:55'],
      },
    ],
    timelineEvents: [
      { type: 'GOOD', timestampMs: 5000, title: 'Sharp, benefit-led opener', description: 'Led with a specific outcome (15% delivery time reduction) in the first sentence — immediately relevant to Priya\'s world.', transcriptRef: 'cut project delivery time by 15% using predictive scheduling' },
      { type: 'GOOD', timestampMs: 38000, title: 'Budget qualification early', description: 'Asked about budget approval process in the second exchange — avoids wasting time on an unqualified prospect.', transcriptRef: 'Have you budgeted for tools to address this, or would this need to go through approval?' },
      { type: 'GOOD', timestampMs: 135000, title: 'Prospect self-quantified pain', description: 'Priya volunteered $120K in direct costs without being pushed — a strong signal that the pain is real and material.', transcriptRef: "I'd estimate $120K in direct costs this quarter alone. It's becoming a pattern." },
      { type: 'WARNING', timestampMs: 152000, title: 'Timeline urgency not closed', description: 'You surfaced the September deadline but didn\'t ask what happens if Q4 starts without a solution — missing the urgency close.', suggestion: 'Ask: "What happens to the three at-risk Q4 projects if you don\'t have this live by September 30?" — this creates the urgency that turns a discovery into a decision.', transcriptRef: "What's your target timeline for getting something in place" },
      { type: 'ISSUE', timestampMs: 220000, title: 'Implementation risk objection not addressed', description: 'Priya flagged David will ask about implementation risk and hidden costs — you acknowledged it but didn\'t address it or offer proof. This will come up in the next call without preparation.', suggestion: 'Respond with: "Let\'s make that the centrepiece of the David call — I\'ll bring our implementation lead and we\'ll walk through exactly how we de-risk it. Can you brief me on the specific incident he\'s referring to before we meet?"', transcriptRef: "David will ask about implementation risk and hidden costs. He's been burned before." },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Efficient BANT qualification with strong authority mapping and need quantification. You identified the economic buyer, the approval threshold, and the business case requirement within the first two minutes. The gap is timeline urgency — you surfaced the deadline but didn\'t make the cost of missing it visceral enough.',
      strengths: [
        'Led with a specific, quantified outcome in the opener — immediately differentiated',
        'Surfaced budget constraints and approval structure in the second exchange',
        'Let Priya quantify her own pain — $120K in her own words is worth more than any benchmark',
        'Connected implementation timeline to the Q4 deadline proactively',
      ],
      improvements: [
        'Close the urgency loop: after confirming the September deadline, ask "What happens to your at-risk Q4 projects if you don\'t have this live in time?"',
        'Proactively address implementation risk before the COO meeting — offer a reference customer or implementation guarantee',
        'Ask Priya what happened with the previous vendor David was burned by — this intelligence shapes the entire next call',
      ],
      proTip: 'Before every COO meeting, do a pre-call with your champion: "Help me understand what David cares about most and what he needs to feel safe saying yes." This turns the discovery call into a closing call.',
      scorecardGroups: [
        {
          group: 'Opener',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Permission-based opener?', passed: true, reasoning: 'Said "I\'ll be brief" at 0:05 — low-friction, respectful of time.' },
            { question: 'Used research on prospect?', passed: true, reasoning: 'Led with a specific outcome relevant to construction project delivery — clearly researched the industry.' },
          ],
        },
        {
          group: 'Discovery',
          maxPoints: 1,
          earnedPoints: 1,
          criteria: [
            { question: 'SDR asked for preconceptions of product?', passed: true, reasoning: 'Asked directly "Is reducing delays something your team is working on?" at 0:05 — checked relevance before pitching.' },
          ],
        },
        {
          group: 'Social Proof',
          maxPoints: 2,
          earnedPoints: 0,
          criteria: [
            { question: 'Provided social proof?', passed: false, reasoning: 'No customer reference or case study cited during the call — missed an opportunity to build credibility for the COO meeting.' },
            { question: 'Asked if social proof was relevant?', passed: false, reasoning: 'Social proof was never introduced so relevance check was not possible.' },
          ],
        },
        {
          group: 'Takeaway',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Re-confirmed that the time works?', passed: false, reasoning: 'Meeting request made at 3:12 but timing was not explicitly confirmed — left open.' },
            { question: 'Asked for success criteria for next call?', passed: true, reasoning: 'Implicitly: Priya flagged what David will need to see at 3:40 — success criteria surfaced.' },
          ],
        },
        {
          group: 'Closing',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Next steps agreed upon?', passed: true, reasoning: '45-minute COO call proposed and conditionally accepted at 3:12.' },
            { question: 'Follow-up meeting booked?', passed: true, reasoning: 'Meeting agreed in principle with Priya at 3:40 — COO invite to follow.' },
          ],
        },
      ],
    }),
  });

  // ── Sessions 4–7: Leaner sessions for other agents ───────────────────────
  await Session.insertMany([
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'CHALLENGER', totalScore: 55,
      durationSeconds: 480, startedAt: new Date(now - 4 * 86_400_000 - 480_000), endedAt: new Date(now - 4 * 86_400_000),
      userId: agents[2]._id, personaId: personas[3]._id, companyId: company._id,
      messages: [
        { role: 'user', content: "Robert, I want to start with something our data shows that most CFOs find surprising. 73% of companies that implement cost-reduction tools in a downturn actually increase operational spend in the following year. Do you know why?", timestampMs: 8000 },
        { role: 'assistant', content: "That's an odd statistic. Why would that be?", timestampMs: 32000 },
        { role: 'user', content: "Because they optimise for the wrong metric. They reduce line-item costs but miss the systemic inefficiencies that compound. It's like treating symptoms instead of the disease.", timestampMs: 45000 },
        { role: 'assistant', content: "Fine, but I've been pitched 'systemic efficiency' tools before. None of them delivered. Prove yours does.", timestampMs: 72000 },
      ],
      frameworkScores: [
        { component: 'Teach', score: 70, feedback: 'Good reframe with the 73% statistic but you didn\'t follow through to show how your solution specifically addresses the systemic issue.', evidence: ['Delivered a counter-intuitive insight at 0:08 — strong Challenger opening'] },
        { component: 'Tailor', score: 48, feedback: 'The insight was generic — it wasn\'t tailored to Robert\'s specific situation as a cost-conscious CFO in retail.', evidence: ['Statistic was industry-agnostic — not tailored to retail CFO context at 0:08'] },
        { component: 'Take Control', score: 48, feedback: 'When Robert challenged you to prove it, you had no specific evidence ready. The Challenger model requires you to have proof before you deliver the reframe.', evidence: ['Failed to respond with specific evidence when challenged at 1:12'] },
      ],
      timelineEvents: [
        { type: 'GOOD', timestampMs: 8000, title: 'Counter-intuitive Challenger opener', description: 'Led with a surprising statistic that reframes the prospect\'s assumptions — classic Challenger technique.', transcriptRef: '73% of companies that implement cost-reduction tools actually increase spend' },
        { type: 'ISSUE', timestampMs: 72000, title: 'No proof when challenged', description: 'Robert asked you to prove your claim and you had no specific evidence ready. Challenger insights require customer evidence to land.', suggestion: 'Have 2–3 specific customer proof points ready for every reframe: "A CFO at a similar company saw X — here\'s what changed."', transcriptRef: "Prove yours does." },
      ],
      aiFeedback: JSON.stringify({
        overallFeedback: 'A promising Challenger opening that stalled when challenged. The 73% statistic was a strong reframe but you had no proof ready when the CFO pushed back. Challenger only works when the insight is backed by evidence.',
        strengths: ['Led with a counter-intuitive, curiosity-provoking statistic — excellent Challenger opener'],
        improvements: ['Prepare 2–3 specific customer proof points for every reframe before the call', 'Tailor the insight to the specific industry and role — generic stats don\'t land with analytical CFOs'],
        proTip: 'The Challenger model is: Teach → Tailor → Take Control. Never deliver the Teach without having the Tailor and Take Control steps prepared.',
        scorecardGroups: [
          { group: 'Value Proposition', maxPoints: 2, earnedPoints: 1, criteria: [
            { question: 'Did the seller open with a clear, specific value proposition?', passed: true, reasoning: 'Counter-intuitive statistic at 0:08 created curiosity and reframed the conversation.' },
            { question: 'Did the seller differentiate from competition?', passed: false, reasoning: 'No differentiation from other "efficiency tools" the prospect has rejected at 1:12.' },
          ]},
          { group: 'Business Case', maxPoints: 2, earnedPoints: 0, criteria: [
            { question: 'Did the seller build a ROI / business case?', passed: false, reasoning: 'No ROI or business case presented — call ended before this phase.' },
            { question: 'Did the seller use a customer reference or proof point?', passed: false, reasoning: 'No customer reference offered when directly challenged at 1:12.' },
          ]},
        ],
      }),
      scenarioConfig: { industry: 'Retail', roleplayType: 'Sales Pitch', personaContext: '', displayName: 'Robert Blake', displayTitle: 'CFO', displayEmoji: '', difficulty: 'EXPERT', suggestedQuestions: [], avatarId: 'robert' },
    },
    {
      type: 'PHONE_CALL', status: 'COMPLETED', framework: 'SNAP', totalScore: 88,
      durationSeconds: 384,
      startedAt: new Date(now - 6 * 86_400_000 - 384_000), endedAt: new Date(now - 6 * 86_400_000),
      userId: agents[3]._id, personaId: personas[4]._id, companyId: company._id,
      messages: [
        { role: 'user', content: "Emma, quick question — are you running any ABM campaigns right now that are underperforming on the conversion side?", timestampMs: 5000 },
        { role: 'assistant', content: "Yes, actually. Our top-of-funnel is great but we're losing leads between MQL and SQL. It's been driving me crazy.", timestampMs: 20000 },
        { role: 'user', content: "That's exactly what I wanted to talk about. We work with marketing directors at SaaS companies to make that specific handoff frictionless. Can I ask — is your MQL-to-SQL conversion tracked in HubSpot or a separate tool?", timestampMs: 35000 },
        { role: 'assistant', content: "HubSpot. Our rate is around 22% — industry benchmark is 35%. I know we have a problem.", timestampMs: 58000 },
        { role: 'user', content: "22% is honest — and fixable. The gap is almost always in the qualification criteria, not the leads themselves. If I could show you how to move that needle 8–10 points in 60 days, is that a conversation worth 20 minutes of your time?", timestampMs: 75000 },
        { role: 'assistant', content: "If you can actually deliver that, yes. What does it involve?", timestampMs: 98000 },
      ],
      frameworkScores: [
        { component: 'Simple', score: 92, feedback: 'Excellent simplicity. Every message was one clear idea. No jargon, no feature list — just a direct connection between their problem and your solution.', evidence: ['Lead with a single, specific question at 0:05', 'Value proposition in one sentence at 1:15'] },
        { component: 'Invaluable', score: 88, feedback: 'Strong. You immediately connected to a metric Emma already tracks (22% vs 35% benchmark) and offered a specific outcome (8–10 points in 60 days). This made the value concrete and believable.', evidence: ['Referenced HubSpot MQL-to-SQL rate at 0:58', 'Specific 8–10 point improvement promise at 1:15'] },
        { component: 'Align', score: 85, feedback: 'Good alignment — you listened to MQL-SQL friction as the pain before connecting your solution. You didn\'t pitch a generic marketing product; you pitched the specific problem Emma was frustrated by.', evidence: ['Listened to "losing leads between MQL and SQL" at 0:20 before pitching', 'Connected solution directly to stated problem at 0:35'] },
        { component: 'Priority', score: 85, feedback: 'Strong close. You asked for only 20 minutes and immediately made the ROI case (8–10 points) that justifies the time investment. The framing "is that a conversation worth 20 minutes" is an elegant SNAP priority ask.', evidence: ['Low-friction ask: 20 minutes at 1:15', 'ROI case made before asking for time at 1:15'] },
      ],
      timelineEvents: [
        { type: 'GOOD', timestampMs: 5000, title: 'Pain-first opener', description: 'Opened with a direct question about a specific pain (ABM conversion) rather than a product pitch — immediately relevant.', transcriptRef: 'are you running any ABM campaigns that are underperforming on the conversion side' },
        { type: 'GOOD', timestampMs: 58000, title: 'Prospect self-identified gap', description: 'Emma volunteered her exact conversion rate and the benchmark gap — the pain is real and the prospect knows it.', transcriptRef: "Our rate is around 22% — industry benchmark is 35%. I know we have a problem." },
        { type: 'GOOD', timestampMs: 75000, title: 'Specific, time-bound value promise', description: 'Offered a concrete outcome (8–10 points in 60 days) tied directly to her stated metric — not a vague "we can help".', transcriptRef: 'move that needle 8–10 points in 60 days' },
      ],
      aiFeedback: JSON.stringify({
        overallFeedback: 'A textbook SNAP call. Simple, relevant, aligned to Emma\'s stated priorities, and closed with a low-friction ask. You listened first, pitched second, and made the value specific and time-bound. This is how a 6-minute call gets a meeting.',
        strengths: [
          'Opened with a specific pain question — no preamble, no credential-building',
          'Let Emma self-identify the gap (22% vs 35%) before connecting your solution',
          'Made the value promise specific: 8–10 points in 60 days, not "improved conversion"',
          'Asked for only 20 minutes — matched the prospect\'s available attention',
        ],
        improvements: [
          'Add a relevant customer reference: "A company like yours went from 23% to 34% in 8 weeks — here\'s how"',
          'Ask Emma what she\'s already tried before offering the solution — shows curiosity and rules out "we tried that"',
        ],
        proTip: 'The SNAP close works best when the time ask matches the trust level. You built enough trust in 6 exchanges for 20 minutes — in a colder context, start with 15.',
        scorecardGroups: [
          { group: 'Opener', maxPoints: 2, earnedPoints: 2, criteria: [
            { question: 'Permission-based opener?', passed: true, reasoning: 'Asked "quick question" at 0:05 — minimal friction, prospect-first.' },
            { question: 'Used research on prospect?', passed: true, reasoning: 'Asked specifically about ABM conversion — clearly understood Emma\'s likely pain as Marketing Director.' },
          ]},
          { group: 'Discovery', maxPoints: 1, earnedPoints: 1, criteria: [
            { question: 'SDR asked for preconceptions of product?', passed: true, reasoning: 'By asking about ABM underperformance, rep checked relevance before pitching.' },
          ]},
          { group: 'Social Proof', maxPoints: 2, earnedPoints: 1, criteria: [
            { question: 'Provided social proof?', passed: false, reasoning: 'No customer reference cited — specific proof point would have strengthened the value claim at 1:15.' },
            { question: 'Asked if social proof was relevant?', passed: false, reasoning: 'Social proof not introduced so relevance check not possible.' },
          ]},
          { group: 'Takeaway', maxPoints: 2, earnedPoints: 2, criteria: [
            { question: 'Re-confirmed that the time works?', passed: true, reasoning: 'Emma confirmed willingness at 1:38: "If you can actually deliver that, yes."' },
            { question: 'Asked for success criteria for next call?', passed: true, reasoning: 'Implicit success criteria established: 8–10 point improvement in 60 days — prospect accepted this as the bar.' },
          ]},
          { group: 'Closing', maxPoints: 2, earnedPoints: 2, criteria: [
            { question: 'Next steps agreed upon?', passed: true, reasoning: '20-minute meeting agreed in principle at 1:38.' },
            { question: 'Follow-up meeting booked?', passed: true, reasoning: 'Prospect agreed to meet — meeting to be booked.' },
          ]},
        ],
      }),
      scenarioConfig: { industry: 'Marketing', roleplayType: 'Cold Call', personaContext: '', displayName: 'Emma Wilson', displayTitle: 'Marketing Director', displayEmoji: '', difficulty: 'EASY', suggestedQuestions: [], avatarId: 'emma' },
    },
    {
      type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'MEDDICC', totalScore: 62,
      durationSeconds: 612,
      startedAt: new Date(now - 10 * 86_400_000 - 612_000), endedAt: new Date(now - 10 * 86_400_000),
      userId: agent._id, personaId: personas[5]._id, companyId: company._id,
      messages: [
        { role: 'user', content: "Carlos, I appreciate you making time. I wanted to start by understanding where your team is feeling the most pain today in operations. What's your biggest constraint right now?", timestampMs: 8000 },
        { role: 'assistant', content: "Honestly, visibility. I have 15 warehouse locations and I'm getting reports 48 hours after the fact. By the time I know there's a bottleneck, it's already cost us.", timestampMs: 25000 },
        { role: 'user', content: "48-hour lag — what does that cost you in a typical week? Are we talking missed SLAs, extra labour, or both?", timestampMs: 45000 },
        { role: 'assistant', content: "Both. We had two missed SLAs last month with a tier-1 client. That triggered a penalty clause — cost us $80K.", timestampMs: 65000 },
        { role: 'user', content: "An $80K penalty from a 48-hour visibility gap. If I could cut that lag to real-time, would that solve the penalty exposure or is there more to it?", timestampMs: 85000 },
        { role: 'assistant', content: "It would solve most of it. But I'll need IT to approve any new system — and they have a 3-month intake process.", timestampMs: 108000 },
      ],
      frameworkScores: [
        { component: 'Metrics', score: 78, feedback: 'Good quantification — you surfaced $80K penalty cost quickly. Could have pushed further to annualise the risk.', evidence: ['$80K SLA penalty surfaced at 1:05', 'Did not annualise the $80K figure or connect to broader revenue risk'] },
        { component: 'Economic Buyer', score: 55, feedback: 'IT approval gate uncovered but you did not identify who in IT makes the decision or what their criteria are.', evidence: ['IT intake process uncovered at 1:48 — qualification blocker not fully explored'] },
        { component: 'Decision Criteria', score: 58, feedback: 'Not explored. You moved from pain to solution without asking what Carlos\'s evaluation criteria are.', evidence: ['No decision criteria questions asked during the call'] },
        { component: 'Identify Pain', score: 82, feedback: 'Strong pain identification — 48-hour lag → $80K penalty → tier-1 client risk. Good layered discovery.', evidence: ['48-hour visibility lag surfaced at 0:25', '$80K penalty and SLA breach confirmed at 1:05'] },
        { component: 'Champion', score: 48, feedback: 'You found a pain owner but didn\'t explore whether Carlos can champion this through IT. Ask: "Is this something you\'d be willing to sponsor through the IT process?"', evidence: ['Carlos is pain owner but IT gate makes him a limited champion at 1:48'] },
        { component: 'Competition', score: 45, feedback: 'No competitive landscape explored. With a 3-month IT intake process, there are almost certainly competing initiatives in the queue.', evidence: ['No competitive questions asked'] },
      ],
      timelineEvents: [
        { type: 'GOOD', timestampMs: 8000, title: 'Open-ended pain discovery opener', description: 'Started with "biggest constraint" — an open question that avoids leading and gets the prospect talking freely.', transcriptRef: "What's your biggest constraint right now?" },
        { type: 'GOOD', timestampMs: 65000, title: 'Penalty cost surfaced', description: '$80K SLA penalty is a concrete, urgent business cost — exactly the kind of metric that drives procurement urgency.', transcriptRef: "cost us $80K" },
        { type: 'WARNING', timestampMs: 85000, title: 'Jumped to solution before full pain stack', description: 'After the $80K figure, you moved straight to a solution pitch. More implication questions would have built urgency before presenting the solution.', suggestion: 'Ask: "How many more tier-1 clients are at similar SLA risk? And what does it do to your team\'s credibility internally if another one triggers a penalty clause?"' },
        { type: 'ISSUE', timestampMs: 108000, title: '3-month IT intake not challenged', description: 'You accepted the IT blocker without exploring it. IT timelines often have exceptions for urgent business cases — especially when penalty exposure is documented.', suggestion: 'Ask: "Has IT ever fast-tracked an intake for a documented business risk? With $80K in documented penalties, this might qualify — who in IT would know?"', transcriptRef: "IT have a 3-month intake process" },
      ],
      aiFeedback: JSON.stringify({
        overallFeedback: 'A solid start with good pain discovery but the call stalled at the IT blocker. You found a strong pain owner with documented cost but didn\'t explore whether the penalty case could accelerate the IT process. MEDDICC requires you to map every gate in the process.',
        strengths: [
          'Open-ended opener surfaced the visibility pain naturally without leading',
          'Quickly quantified pain to $80K in concrete penalty costs',
          'Connected visibility gap directly to solution value proposition',
        ],
        improvements: [
          'Challenge the IT intake timeline with documented penalty evidence: "With $80K in Q1 penalties, does this qualify for an expedited review?"',
          'Ask about competitive initiatives in the IT queue — with a 3-month process, you\'re likely competing with other projects for prioritisation',
          'Build the MEDDICC map explicitly: ask about Decision Criteria before presenting any solution',
        ],
        proTip: 'Every IT intake process has an exception path for documented financial risk. Your job is to help Carlos build the business case that gets you into that lane.',
        scorecardGroups: [
          { group: 'Introduction & Agenda', maxPoints: 2, earnedPoints: 2, criteria: [
            { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', passed: true, reasoning: 'Opened by asking Carlos\'s biggest constraint — agenda set collaboratively at 0:08.' },
            { question: 'Did the seller introduce an Upfront Contract?', passed: true, reasoning: 'Implicit contract: "I want to understand pain" before presenting — expectation set.' },
          ]},
          { group: 'Pain & Metrics Discovery', maxPoints: 2, earnedPoints: 2, criteria: [
            { question: 'Did the seller uncover specific pain points?', passed: true, reasoning: '48-hour visibility lag causing SLA breaches uncovered at 0:25.' },
            { question: 'Did the seller uncover relevant metrics?', passed: true, reasoning: '$80K penalty cost surfaced and confirmed at 1:05.' },
          ]},
          { group: 'Objection Handling', maxPoints: 1, earnedPoints: 0, criteria: [
            { question: 'Did the seller handle objections effectively?', passed: false, reasoning: 'IT blocker at 1:48 was not challenged or reframed — accepted as a hard constraint without exploration.' },
          ]},
          { group: 'Customer Reference & Value', maxPoints: 2, earnedPoints: 0, criteria: [
            { question: 'Did the seller present a customer reference?', passed: false, reasoning: 'No customer reference presented during the call.' },
            { question: "Did the seller explore the prospect's goal-setting framework?", passed: false, reasoning: 'No questions asked about how Carlos measures success or sets targets.' },
          ]},
          { group: 'Closing', maxPoints: 2, earnedPoints: 1, criteria: [
            { question: 'Did the seller revisit the upfront contract and define next steps?', passed: false, reasoning: 'Call ended without clear next steps agreed — IT blocker left unresolved.' },
            { question: 'Did the seller qualify out or in effectively?', passed: true, reasoning: 'IT 3-month intake is a material gate — rep correctly identified this needs resolution before progressing.' },
          ]},
        ],
      }),
      scenarioConfig: { industry: 'Logistics', roleplayType: 'Discovery Call', personaContext: '', displayName: 'Carlos Rodriguez', displayTitle: 'Operations Manager', displayEmoji: '', difficulty: 'MEDIUM', suggestedQuestions: [], avatarId: 'carlos' },
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
