// Mock API — no backend required for preview
import type {
  DashboardStats,
  LeaderboardEntry,
  Session,
  Persona,
  User,
  TeamRoleplay,
  Framework,
  CompanyDetail,
  EvaluationPrompt,
} from '@/types';

const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USER: User = {
  id: 'u1',
  email: 'agent@demo.com',
  firstName: 'Alex',
  lastName: 'Rivera',
  role: 'AGENT',
  companyId: 'c1',
  avgScore: 74,
  sessionCount: 12,
  location: 'New York',
};

const MOCK_DASHBOARD: DashboardStats = {
  totalSessions: 12,
  avgScore: 74,
  activeUsers: 8,
  passRate: 67,
  recentSessions: [
    { id: 's1', endedAt: new Date(Date.now() - 3_600_000).toISOString(), durationSeconds: 720, framework: 'MEDDIC', sessionType: 'PHONE_CALL', personaName: 'Sarah Chen', personaEmoji: '', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 81 },
    { id: 's2', endedAt: new Date(Date.now() - 86_400_000).toISOString(), durationSeconds: 540, framework: 'SPIN', sessionType: 'ONLINE_MEETING', personaName: 'Marcus Thompson', personaEmoji: '', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 68 },
    { id: 's3', endedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), durationSeconds: 900, framework: 'BANT', sessionType: 'PHONE_CALL', personaName: 'Priya Patel', personaEmoji: '', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 75 },
    { id: 's4', endedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), durationSeconds: 480, framework: 'MEDDIC', sessionType: 'ONLINE_MEETING', personaName: 'James Kim', personaEmoji: '', userFirstName: 'Alex', userLastName: 'Rivera', totalScore: 55 },
  ],
  frameworkStats: [
    { component: 'Metrics', avgScore: 82, count: 8 },
    { component: 'Economic Buyer', avgScore: 71, count: 8 },
    { component: 'Decision Criteria', avgScore: 65, count: 8 },
    { component: 'Decision Process', avgScore: 78, count: 8 },
    { component: 'Identify Pain', avgScore: 88, count: 8 },
    { component: 'Champion', avgScore: 60, count: 8 },
  ],
  agentExtra: { sessionsThisWeek: 3, streak: 2, rank: 4 },
};

const MOCK_SESSIONS: Session[] = [
  {
    id: 's1',
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'MEDDIC',
    totalScore: 81,
    durationSeconds: 720,
    recordingUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    startedAt: new Date(Date.now() - 3_700_000).toISOString(),
    endedAt: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 3_700_000).toISOString(),
    user: { id: 'u1', firstName: 'Alex', lastName: 'Rivera', avatarUrl: undefined },
    persona: { id: 'p1', name: 'Sarah Chen', title: 'VP of Sales', emoji: '', difficulty: 'MEDIUM' },
    messages: [
      { id: 'm1', sessionId: 's1', role: 'user', content: "Hi Sarah, this is Alex from PitchIQ. I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B. Do you have 30 seconds?", timestampMs: 5000 },
      { id: 'm2', sessionId: 's1', role: 'assistant', content: "Sure, go ahead. What is this about?", timestampMs: 18000 },
      { id: 'm3', sessionId: 's1', role: 'user', content: "Thanks. We help VP-level sales leaders quantify rep performance gaps. Companies like yours typically see a 20% lift in quota attainment within 90 days. Is improving team efficiency something on your radar right now?", timestampMs: 28000 },
      { id: 'm4', sessionId: 's1', role: 'assistant', content: "We do have some challenges there, yes. Our reps are ramping slowly and we're not hitting our numbers. But we already have a tool for this.", timestampMs: 55000 },
      { id: 'm5', sessionId: 's1', role: 'user', content: "Interesting — what does that tool measure today? And is it giving you the visibility you need on where deals are actually stalling?", timestampMs: 75000 },
      { id: 'm6', sessionId: 's1', role: 'assistant', content: "Honestly it mostly tracks CRM activity, not skill gaps. We can see what reps are doing but not why deals fall through.", timestampMs: 100000 },
      { id: 'm7', sessionId: 's1', role: 'user', content: "That's the exact gap we solve. If you could pinpoint within 24 hours which MEDDIC component each rep is weak on, how would that change your coaching rhythm?", timestampMs: 120000 },
      { id: 'm8', sessionId: 's1', role: 'assistant', content: "That would be huge. Right now I'm spending 3 hours per week listening to random calls.", timestampMs: 148000 },
      { id: 'm9', sessionId: 's1', role: 'user', content: "And the cost of that — 3 hours a week, 52 weeks, plus the deals lost to uncoached reps — what's that worth to TechCorp?", timestampMs: 165000 },
      { id: 'm10', sessionId: 's1', role: 'assistant', content: "Probably significant. I hadn't quantified it but you're right.", timestampMs: 188000 },
      { id: 'm11', sessionId: 's1', role: 'user', content: "What's the budget range you'd be working with for a solution like this?", timestampMs: 200000 },
      { id: 'm12', sessionId: 's1', role: 'assistant', content: "That's too early to say. I'd need to see a demo first. Also, pricing seems steep for what you're describing.", timestampMs: 218000 },
      { id: 'm13', sessionId: 's1', role: 'user', content: "Totally fair — let's validate the value first. Who else would typically be part of evaluating something like this at TechCorp? Would you loop in your VP of RevOps?", timestampMs: 240000 },
      { id: 'm14', sessionId: 's1', role: 'assistant', content: "Yes, probably Marcus in RevOps and our CRO would have final say.", timestampMs: 268000 },
      { id: 'm15', sessionId: 's1', role: 'user', content: "Perfect. If Marcus and your CRO saw a 20% lift in attainment in our pilot data, is that the kind of metric that would move this forward quickly?", timestampMs: 290000 },
      { id: 'm16', sessionId: 's1', role: 'assistant', content: "For the CRO, yes — attainment numbers are everything.", timestampMs: 320000 },
      { id: 'm17', sessionId: 's1', role: 'user', content: "Great. Can we get 30 minutes on the calendar this week with you and Marcus? I'll prepare a benchmark report for TechCorp's size and stage.", timestampMs: 340000 },
      { id: 'm18', sessionId: 's1', role: 'assistant', content: "Send me a calendar link and I'll check with Marcus.", timestampMs: 370000 },
    ],
    frameworkScores: [
      {
        id: 'fs1',
        component: 'Metrics',
        score: 85,
        feedback: 'Strong quantitative framing. You anchored the value conversation with a 20% efficiency figure early and followed up by helping the prospect self-calculate the cost of inaction (3 hours/week × 52 weeks). This is textbook MEDDIC — make the prospect own the number.',
        evidence: [
          'You mentioned a 20% quota attainment lift at 0:28',
          'You calculated the cost of 3hrs/week coaching time at 2:45',
          'You tied metrics directly to the CRO\'s attainment focus at 4:50',
        ],
      },
      {
        id: 'fs2',
        component: 'Economic Buyer',
        score: 78,
        feedback: 'You correctly identified that the CRO has final say and Marcus in RevOps is a key influencer. However, you did not ask what the CRO\'s specific success criteria are, or whether Sarah has budget authority herself. Knowing who signs the check — not just who approves — is critical.',
        evidence: [
          'Asked about decision makers at 4:00 — correctly surfaced Marcus and the CRO',
          'Did not ask about Sarah\'s own budget authority',
          'Missed: "What would the CRO need to see to sign off within Q2?"',
        ],
      },
      {
        id: 'fs3',
        component: 'Decision Criteria',
        score: 72,
        feedback: 'You touched on attainment metrics as a success criterion but did not explicitly ask Sarah what the evaluation criteria would be. The prospect needs to articulate their own criteria — then you can map your product to each one. Without this, you\'re guessing what to demo.',
        evidence: [
          'You assumed attainment % is the key metric without confirmation',
          'Missed: "What would a successful vendor look like to you and Marcus?"',
          'Missed: "What does the current solution lack that you\'d need replaced?"',
        ],
      },
      {
        id: 'fs4',
        component: 'Identify Pain',
        score: 92,
        feedback: 'Excellent pain discovery. You uncovered 3 distinct pain points without being pushy: slow ramp time, CRM activity tracking without skill visibility, and 3 hours/week wasted on random call reviews. You let the prospect articulate the pain herself rather than telling her what it should be.',
        evidence: [
          'Uncovered "ramps slowly and not hitting numbers" at 0:55',
          'Surfaced skill gap vs. activity tracking distinction at 1:40',
          'Quantified coaching time waste at 2:28 — prospect owned the number',
        ],
      },
      {
        id: 'fs5',
        component: 'Champion',
        score: 65,
        feedback: 'You identified Marcus as an influencer but did not do the work to build a champion. A champion is someone who will sell for you internally. You need to ask: "Is Marcus the type who would advocate for a solution if he believed in it?" and give them a reason to do so before the meeting.',
        evidence: [
          'Named Marcus as an influencer at 4:08 — good',
          'Did not ask if Sarah would be the internal champion',
          'Missed: "Would you be comfortable bringing this to Marcus as your recommendation?"',
          'Missed: "What would make you confident enough to sponsor this internally?"',
        ],
      },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain identification. You quantified business impact naturally and secured a clear next step. The main area to develop is Champion-building — you identified influencers but didn\'t activate them as internal advocates.',
      strengths: [
        'Opened with a permission-based, research-backed hook',
        'Let the prospect quantify pain in her own words',
        'Linked product value directly to CRO-level metric (quota attainment)',
      ],
      improvements: [
        'Ask explicitly for the Economic Buyer\'s success criteria, not just who they are',
        'Build Sarah as a champion before the next meeting — give her a narrative to use',
        'Qualify decision criteria before jumping to the demo request',
      ],
      proTip: 'Use the "impact gap" close: after uncovering pain, ask "What happens if this is still unsolved in 6 months?" — it creates urgency without pressure and lets the prospect sell themselves on the timeline.',
      scorecardGroups: [
        {
          group: 'Introduction & Agenda',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', passed: false, reasoning: 'Rep jumped straight into pitch at 0:05 without setting a mutual agenda or asking what Sarah wanted to cover.' },
            { question: 'Did the seller introduce an Upfront Contract?', passed: true, reasoning: 'Rep asked for 30 seconds at 0:05 before proceeding — implicit upfront contract established early.' },
          ],
        },
        {
          group: 'Pain & Metrics Discovery',
          maxPoints: 2,
          earnedPoints: 2,
          criteria: [
            { question: 'Did the seller uncover specific pain points?', passed: true, reasoning: 'Three distinct pains uncovered by 1:40: slow ramp, CRM tracking vs skill gaps, and 3hrs/week coaching waste.' },
            { question: 'Did the seller uncover relevant metrics?', passed: true, reasoning: 'Rep quantified 20% attainment lift at 0:28 and helped prospect self-calculate weekly coaching cost at 2:45.' },
          ],
        },
        {
          group: 'Objection Handling',
          maxPoints: 1,
          earnedPoints: 0,
          criteria: [
            { question: 'Did the seller handle objections effectively using the FFF framework?', passed: false, reasoning: '"Pricing seems steep" at 3:38 was deflected with a pivot rather than acknowledged and reframed with ROI evidence.' },
          ],
        },
        {
          group: 'Customer Reference & Value',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller present a customer reference?', passed: true, reasoning: 'Rep cited 20% quota attainment lift from similar companies at 0:28 as social proof.' },
            { question: 'Did the seller explore the prospect\'s goal-setting framework?', passed: false, reasoning: 'Rep never asked how the CRO or Sarah measures team success — missed between 4:00 and 4:50.' },
          ],
        },
        {
          group: 'Closing',
          maxPoints: 2,
          earnedPoints: 1,
          criteria: [
            { question: 'Did the seller revisit the upfront contract and define next steps?', passed: true, reasoning: 'Closed at 5:40 with a specific 30-minute ask, named stakeholders, and a benchmark report offer.' },
            { question: 'Did the seller qualify out or in effectively?', passed: false, reasoning: 'Rep did not explicitly confirm this is a qualified opportunity or establish a go/no-go milestone before 6:10.' },
          ],
        },
      ],
    }),
    timelineEvents: [
      { id: 'te1', type: 'GOOD', timestampMs: 5000, title: 'Permission-based opener', description: 'Opened with a specific research reference (Series B, enterprise expansion) and asked for 30 seconds. This signals preparation and respects the prospect\'s time.', suggestion: undefined, transcriptRef: 'I was looking at TechCorp\'s recent expansion into the enterprise segment' },
      { id: 'te2', type: 'GOOD', timestampMs: 75000, title: 'Probed existing solution gap', description: 'Rather than attacking the competitor, you asked what the current tool measures — revealing its blind spot without being adversarial.', suggestion: undefined, transcriptRef: 'what does that tool measure today?' },
      { id: 'te3', type: 'GOOD', timestampMs: 165000, title: 'Cost of inaction quantified', description: 'You helped the prospect calculate the cost of the problem herself. Self-calculated pain is far more powerful than vendor-stated pain.', suggestion: undefined, transcriptRef: '3 hours a week, 52 weeks, plus the deals lost' },
      { id: 'te4', type: 'ISSUE', timestampMs: 218000, title: 'Pricing objection glossed over', description: 'The prospect said "pricing seems steep" and you immediately pivoted to the demo. This leaves a doubt unaddressed that will resurface harder later.', suggestion: 'Acknowledge and reframe: quantify the ROI before defending price', betterResponse: 'That\'s fair — before we talk price, let\'s make sure the value is clear. If we can show a 20% attainment lift on your current team size, what would that be worth annually?' , transcriptRef: 'pricing seems steep for what you\'re describing' },
      { id: 'te5', type: 'WARNING', timestampMs: 240000, title: 'Champion not activated', description: 'You asked who else is involved (good) but didn\'t set up Sarah to be your internal advocate. You\'re relying on her to bring Marcus without giving her the tools to make a compelling case.', suggestion: 'Ask: "Would you be comfortable sponsoring this to Marcus?" and arm her with a clear 2-sentence pitch', transcriptRef: 'Who else would typically be part of evaluating something like this' },
      { id: 'te6', type: 'GOOD', timestampMs: 340000, title: 'Clean next step secured', description: 'Specific ask (30 min, this week, with a named stakeholder), offered clear value-add (benchmark report). This is how you close a discovery call.', suggestion: undefined, transcriptRef: 'Can we get 30 minutes on the calendar this week with you and Marcus' },
    ],
  },
  {
    id: 's2',
    type: 'ONLINE_MEETING',
    status: 'COMPLETED',
    framework: 'SPIN',
    totalScore: 68,
    durationSeconds: 540,
    startedAt: new Date(Date.now() - 87_000_000).toISOString(),
    endedAt: new Date(Date.now() - 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 87_000_000).toISOString(),
    user: { id: 'u2', firstName: 'Jordan', lastName: 'Lee', avatarUrl: undefined },
    persona: { id: 'p2', name: 'Marcus Thompson', title: 'CTO', emoji: '', difficulty: 'HARD' },
    frameworkScores: [
      { id: 'fs5', component: 'Situation Questions', score: 75, feedback: 'Good situational awareness', evidence: [] },
      { id: 'fs6', component: 'Problem Questions', score: 62, feedback: 'Could dig deeper into problems', evidence: [] },
      { id: 'fs7', component: 'Implication Questions', score: 58, feedback: 'Implication questions were surface-level', evidence: [] },
      { id: 'fs8', component: 'Need-Payoff Questions', score: 77, feedback: 'Good need-payoff alignment', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'A decent SPIN session but implication questions need more depth to create compelling urgency.',
      strengths: ['Good situation framing', 'Strong need-payoff close'],
      improvements: ['Deepen implication questions', 'Spend more time on problem exploration'],
      proTip: 'Chain your implication questions: each answer should naturally lead to the next deeper implication.',
    }),
    timelineEvents: [],
  },
  {
    id: 's3',
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'BANT',
    totalScore: 75,
    durationSeconds: 900,
    startedAt: new Date(Date.now() - 2 * 86_400_000 - 600_000).toISOString(),
    endedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 86_400_000 - 600_000).toISOString(),
    user: { id: 'u3', firstName: 'Taylor', lastName: 'Morgan', avatarUrl: undefined },
    persona: { id: 'p3', name: 'Priya Patel', title: 'Head of Engineering', emoji: '', difficulty: 'MEDIUM' },
    frameworkScores: [
      { id: 'fs9', component: 'Budget', score: 70, feedback: 'Budget discussed but not qualified', evidence: [] },
      { id: 'fs10', component: 'Authority', score: 80, feedback: 'Clearly identified decision maker', evidence: [] },
      { id: 'fs11', component: 'Need', score: 85, feedback: 'Strong need identification', evidence: [] },
      { id: 'fs12', component: 'Timeline', score: 65, feedback: 'Timeline discussion was vague', evidence: [] },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Good BANT qualification with strong need identification. Budget and timeline need more precision.',
      strengths: ['Strong authority identification', 'Clear need articulation'],
      improvements: ['Qualify budget more precisely', 'Establish concrete timeline milestones'],
      proTip: 'When asking about budget, try "What investment range have you allocated for solving this?" instead of a direct budget question.',
    }),
    timelineEvents: [],
  },
  {
    id: 's4',
    type: 'ONLINE_MEETING',
    status: 'COMPLETED',
    framework: 'CHALLENGER',
    totalScore: 55,
    durationSeconds: 480,
    startedAt: new Date(Date.now() - 4 * 86_400_000 - 480_000).toISOString(),
    endedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 86_400_000 - 480_000).toISOString(),
    user: { id: 'u4', firstName: 'Morgan', lastName: 'Kim', avatarUrl: undefined },
    persona: { id: 'p4', name: 'Robert Blake', title: 'CFO', emoji: '', difficulty: 'EXPERT' },
    frameworkScores: [],
    timelineEvents: [],
  },
  {
    id: 's5',
    type: 'PHONE_CALL',
    status: 'COMPLETED',
    framework: 'SNAP',
    totalScore: 88,
    durationSeconds: 660,
    startedAt: new Date(Date.now() - 6 * 86_400_000 - 660_000).toISOString(),
    endedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 86_400_000 - 660_000).toISOString(),
    user: { id: 'u5', firstName: 'Sam', lastName: 'Patel', avatarUrl: undefined },
    persona: { id: 'p5', name: 'Emma Wilson', title: 'Marketing Director', emoji: '', difficulty: 'EASY' },
    frameworkScores: [],
    timelineEvents: [],
  },
  {
    id: 's6',
    type: 'ONLINE_MEETING',
    status: 'COMPLETED',
    framework: 'MEDDICC',
    totalScore: 62,
    durationSeconds: 1020,
    startedAt: new Date(Date.now() - 10 * 86_400_000 - 1020_000).toISOString(),
    endedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    createdAt: new Date(Date.now() - 10 * 86_400_000 - 1020_000).toISOString(),
    user: { id: 'u1', firstName: 'Alex', lastName: 'Rivera', avatarUrl: undefined },
    persona: { id: 'p6', name: 'Carlos Rodriguez', title: 'Operations Manager', emoji: '', difficulty: 'MEDIUM' },
    frameworkScores: [],
    timelineEvents: [],
  },
];

const MOCK_PERSONAS: Persona[] = [
  { id: 'p1', name: 'Sarah Chen', title: 'VP of Sales', company: 'TechCorp', industry: 'SaaS', emoji: '', difficulty: 'MEDIUM', personality: 'Analytical, data-driven', systemPrompt: '', objections: ['Too expensive', 'Already have a solution'], buyingSignals: ['Asking about ROI', 'Mentioning budget'], frameworks: ['MEDDIC', 'BANT'], isPreset: true },
  { id: 'p2', name: 'Marcus Thompson', title: 'CTO', company: 'FinanceFlow', industry: 'FinTech', emoji: '', difficulty: 'HARD', personality: 'Technical, skeptical', systemPrompt: '', objections: ['Security concerns', 'Integration complexity'], buyingSignals: ['Technical deep-dive questions'], frameworks: ['SPIN', 'MEDDICC'], isPreset: true },
  { id: 'p3', name: 'Priya Patel', title: 'Head of Engineering', company: 'BuildFast', industry: 'Construction Tech', emoji: '', difficulty: 'MEDIUM', personality: 'Practical, ROI-focused', systemPrompt: '', objections: ['Implementation time', 'Team adoption'], buyingSignals: ['Asking about timelines'], frameworks: ['BANT', 'CHALLENGER'], isPreset: true },
  { id: 'p4', name: 'Robert Blake', title: 'CFO', company: 'RetailPro', industry: 'Retail', emoji: '', difficulty: 'EXPERT', personality: 'Cost-conscious, risk-averse', systemPrompt: '', objections: ['High cost', 'Not priority', 'Already tried similar'], buyingSignals: ['Asking about payment terms'], frameworks: ['MEDDIC', 'SNAP'], isPreset: true },
  { id: 'p5', name: 'Emma Wilson', title: 'Marketing Director', company: 'GrowthCo', industry: 'Marketing', emoji: '', difficulty: 'EASY', personality: 'Creative, results-oriented', systemPrompt: '', objections: ['Internal bandwidth', 'Timing'], buyingSignals: ['Campaign ideas', 'Asking about case studies'], frameworks: ['SPIN', 'SNAP'], isPreset: true },
  { id: 'p6', name: 'Carlos Rodriguez', title: 'Operations Manager', company: 'LogiSync', industry: 'Logistics', emoji: '', difficulty: 'MEDIUM', personality: 'Process-driven, methodical', systemPrompt: '', objections: ['Process disruption', 'Training required'], buyingSignals: ['Asking about workflow integration'], frameworks: ['BANT', 'CHALLENGER'], isPreset: true },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, user: { id: 'u2', firstName: 'Jordan', lastName: 'Lee', avatarUrl: undefined }, avgScore: 91, sessionCount: 24 },
  { rank: 2, user: { id: 'u3', firstName: 'Taylor', lastName: 'Morgan', avatarUrl: undefined }, avgScore: 87, sessionCount: 18 },
  { rank: 3, user: { id: 'u4', firstName: 'Morgan', lastName: 'Kim', avatarUrl: undefined }, avgScore: 83, sessionCount: 21 },
  { rank: 4, user: { id: 'u1', firstName: 'Alex', lastName: 'Rivera', avatarUrl: undefined }, avgScore: 74, sessionCount: 12 },
  { rank: 5, user: { id: 'u5', firstName: 'Sam', lastName: 'Patel', avatarUrl: undefined }, avgScore: 71, sessionCount: 15 },
  { rank: 6, user: { id: 'u6', firstName: 'Casey', lastName: 'Zhang', avatarUrl: undefined }, avgScore: 68, sessionCount: 9 },
  { rank: 7, user: { id: 'u7', firstName: 'Riley', lastName: 'Johnson', avatarUrl: undefined }, avgScore: 65, sessionCount: 7 },
  { rank: 8, user: { id: 'u8', firstName: 'Drew', lastName: 'Okonkwo', avatarUrl: undefined }, avgScore: 59, sessionCount: 5 },
];

const MOCK_TEAM_USERS: User[] = [
  { id: 'u2', email: 'jordan@demo.com', firstName: 'Jordan', lastName: 'Lee', role: 'AGENT', companyId: 'c1', avgScore: 91, sessionCount: 24, location: 'San Francisco', region: 'North America', team: 'Enterprise', territory: 'West Coast', zone: 'Pacific' },
  { id: 'u3', email: 'taylor@demo.com', firstName: 'Taylor', lastName: 'Morgan', role: 'AGENT', companyId: 'c1', avgScore: 87, sessionCount: 18, location: 'Chicago', region: 'North America', team: 'Enterprise', territory: 'Midwest', zone: 'Central' },
  { id: 'u4', email: 'morgan@demo.com', firstName: 'Morgan', lastName: 'Kim', role: 'AGENT', companyId: 'c1', avgScore: 83, sessionCount: 21, location: 'Austin', region: 'North America', team: 'SMB', territory: 'South', zone: 'Central' },
  { id: 'u5', email: 'sam@demo.com', firstName: 'Sam', lastName: 'Patel', role: 'AGENT', companyId: 'c1', avgScore: 71, sessionCount: 15, location: 'London', region: 'EMEA', team: 'SMB', territory: 'UK & Ireland', zone: 'Northern Europe' },
  { id: 'u6', email: 'casey@demo.com', firstName: 'Casey', lastName: 'Zhang', role: 'AGENT', companyId: 'c1', avgScore: 68, sessionCount: 9, location: 'Singapore', region: 'APAC', team: 'Enterprise', territory: 'SEA', zone: 'Southeast Asia' },
  { id: 'u7', email: 'riley@demo.com', firstName: 'Riley', lastName: 'Johnson', role: 'AGENT', companyId: 'c1', avgScore: 65, sessionCount: 7, location: 'Sydney', region: 'APAC', team: 'SMB', territory: 'ANZ', zone: 'Pacific' },
  { id: 'u8', email: 'drew@demo.com', firstName: 'Drew', lastName: 'Okonkwo', role: 'MANAGER', companyId: 'c1', avgScore: 79, sessionCount: 12, location: 'London', region: 'EMEA', team: 'Enterprise', territory: 'UK & Europe', zone: 'Northern Europe' },
  { ...MOCK_USER, region: 'North America', team: 'Enterprise', territory: 'East Coast', zone: 'Northeast' },
];

const MOCK_TEAM_ROLEPLAYS: TeamRoleplay[] = [
  {
    id: 'tr1',
    name: 'Cold Call Blitz',
    description: 'Practice rapid cold calling with a skeptical VP. Required for all Enterprise reps before Q4.',
    scenarioConfig: {
      industry: 'SaaS',
      roleplayType: 'Cold Call',
      personaContext: 'You are a skeptical VP of Sales at a mid-sized SaaS company. You are busy, dismissive of cold callers, but can be won over with a sharp, research-backed opener. Push back on anything vague.',
      displayName: 'Sarah Chen',
      displayTitle: 'VP of Sales, TechCorp',
      displayEmoji: '',
      difficulty: 'Hard',
      suggestedQuestions: ['How did you get this number?', 'What makes you different?', "I'm busy — 30 seconds.", 'What does it cost?'],
    },
    isActive: true,
    allowPeerListening: true,
    completionCount: 6,
    createdById: 'u8',
    createdBy: { id: 'u8', firstName: 'Drew', lastName: 'Okonkwo' },
    assignmentTarget: { scope: 'team', teamIds: ['Enterprise'] },
    createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  },
  {
    id: 'tr2',
    name: 'EMEA Discovery Call',
    description: 'Regional discovery call practice — banking & fintech personas for the EMEA market.',
    scenarioConfig: {
      industry: 'Banking',
      roleplayType: 'Discovery Call',
      personaContext: 'You are the Head of Treasury at a European bank evaluating a new fintech partnership. You are compliance-focused and risk-averse. Ask about SLAs, data residency (GDPR), and integration timelines.',
      displayName: 'Emma Hartmann',
      displayTitle: 'Head of Treasury, Erste Bank',
      displayEmoji: '',
      difficulty: 'Hard',
      suggestedQuestions: ['Is your platform GDPR-compliant?', 'Where is data hosted?', 'What are your SLAs?'],
    },
    isActive: true,
    allowPeerListening: true,
    completionCount: 3,
    createdById: 'u8',
    createdBy: { id: 'u8', firstName: 'Drew', lastName: 'Okonkwo' },
    assignmentTarget: { scope: 'region', regions: ['EMEA'] },
    createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    id: 'tr3',
    name: 'SMB Objection Drill',
    description: 'Handle the toughest SMB price objections. All SMB reps must complete before end of month.',
    scenarioConfig: {
      industry: 'SaaS',
      roleplayType: 'Objection Handling',
      personaContext: 'You are the owner of a 50-person company being pitched a SaaS product you cannot afford. Your main objection is price — you like the product but the budget simply isn\'t there. Push hard on discounts, payment terms, and ROI justification.',
      displayName: 'Carlos Mendez',
      displayTitle: 'CEO, GrowthBridge',
      displayEmoji: '',
      difficulty: 'Medium',
      suggestedQuestions: ["That's too expensive.", 'Can you do a free trial?', 'What\'s the minimum to get started?'],
    },
    isActive: true,
    allowPeerListening: false,
    completionCount: 8,
    createdById: 'u8',
    createdBy: { id: 'u8', firstName: 'Drew', lastName: 'Okonkwo' },
    assignmentTarget: { scope: 'team', teamIds: ['SMB'] },
    createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    updatedAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
  },
];

// ── Peer sessions (for leaderboard tab listening) ─────────────────────────────

import type { PeerSession } from '@/types';

const MOCK_PEER_SESSIONS: PeerSession[] = [
  {
    sessionId: 's-peer-1', userId: 'u2', userName: 'Jordan Lee', userLocation: 'San Francisco',
    userTeam: 'Enterprise', score: 88, rank: 1, durationSeconds: 734, canListen: true,
    playbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    completedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
  {
    sessionId: 's-peer-2', userId: 'u3', userName: 'Taylor Morgan', userLocation: 'Chicago',
    userTeam: 'Enterprise', score: 84, rank: 2, durationSeconds: 680, canListen: true,
    playbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    completedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
  {
    sessionId: 's1', userId: 'u1', userName: 'Alex Rivera', userLocation: 'New York',
    userTeam: 'Enterprise', score: 81, rank: 3, durationSeconds: 720, canListen: true,
    playbackUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    completedAt: new Date(Date.now() - 3_600_000).toISOString(),
  },
  {
    sessionId: 's-peer-4', userId: 'u4', userName: 'Morgan Kim', userLocation: 'Austin',
    userTeam: 'SMB', score: 76, rank: 4, durationSeconds: 590, canListen: true,
    playbackUrl: undefined,
    completedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  },
  {
    sessionId: 's-peer-5', userId: 'u5', userName: 'Sam Patel', userLocation: 'London',
    userTeam: 'SMB', score: 71, rank: 5, durationSeconds: 810, canListen: false,
    playbackUrl: undefined,
    completedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  },
  {
    sessionId: 's-peer-6', userId: 'u6', userName: 'Casey Zhang', userLocation: 'Singapore',
    userTeam: 'Enterprise', score: 65, rank: 6, durationSeconds: 445, canListen: false,
    playbackUrl: undefined,
    completedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
  },
  {
    sessionId: 's-peer-7', userId: 'u7', userName: 'Riley Johnson', userLocation: 'Sydney',
    userTeam: 'SMB', score: 58, rank: 7, durationSeconds: 360, canListen: false,
    playbackUrl: undefined,
    completedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  },
];

export const peerSessionsApi = {
  list: async (_sessionId: string): Promise<PeerSession[]> => {
    await delay(300);
    return MOCK_PEER_SESSIONS;
  },
};

// ── Auth API ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, _password: string) => {
    await delay(400);
    const roleMap: Record<string, typeof MOCK_USER> = {
      'agent@demo.com': MOCK_USER,
      'admin@demo.com': { ...MOCK_USER, id: 'u-admin', email: 'admin@demo.com', firstName: 'Dana', lastName: 'Brooks', role: 'COMPANY_ADMIN' },
      'manager@demo.com': { ...MOCK_USER, id: 'u-mgr', email: 'manager@demo.com', firstName: 'Jamie', lastName: 'Scott', role: 'MANAGER' },
      'superadmin@demo.com': { ...MOCK_USER, id: 'u-sa', email: 'superadmin@demo.com', firstName: 'Super', lastName: 'Admin', role: 'SUPER_ADMIN' },
    };
    const user = roleMap[email] ?? MOCK_USER;
    return { user, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },
  register: async (data: any) => {
    await delay(400);
    return { user: { ...MOCK_USER, ...data, id: 'u-new' }, accessToken: 'mock-token', refreshToken: 'mock-refresh' };
  },
  logout: async (_refreshToken?: string) => { await delay(100); },
  me: async () => { await delay(100); return MOCK_USER; },
};

// ── Sessions API ──────────────────────────────────────────────────────────────

const MOCK_PEER_SCORES = [
  { userId: 'u2', name: 'Jordan Lee', score: 88, rank: 1 },
  { userId: 'u3', name: 'Taylor Morgan', score: 84, rank: 2 },
  { userId: 'u1', name: 'Alex Rivera', score: 81, rank: 3 },
  { userId: 'u4', name: 'Morgan Kim', score: 76, rank: 4 },
  { userId: 'u5', name: 'Sam Patel', score: 71, rank: 5 },
  { userId: 'u6', name: 'Casey Zhang', score: 65, rank: 6 },
  { userId: 'u7', name: 'Riley Johnson', score: 58, rank: 7 },
];

export const sessionsApi = {
  list: async (_params?: any) => { await delay(300); return { sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }; },
  listAll: async (_params?: any) => { await delay(300); return { sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }; },
  getPeerScores: async (_sessionId: string) => { await delay(200); return MOCK_PEER_SCORES; },
  create: async (_data: any) => {
    await delay(300);
    return { ...MOCK_SESSIONS[0], id: `s-new-${Date.now()}`, status: 'PENDING' };
  },
  get: async (id: string) => { await delay(200); return MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0]; },
  start: async (_id: string) => { await delay(200); return { status: 'IN_PROGRESS' }; },
  end: async (_id: string, _data: any) => { await delay(300); return MOCK_SESSIONS[0]; },
  addMessage: async (_id: string, data: any) => { await delay(100); return { id: `m-${Date.now()}`, ...data }; },
  getAIResponse: async (_id: string, _userMessage: string) => {
    await delay(800);
    return { response: "That's an interesting point. Can you tell me more about your current process and where the bottlenecks are?" };
  },
  share: async (_id: string) => { await delay(200); return { shareUrl: '#' }; },
};

// ── Personas API ──────────────────────────────────────────────────────────────

const MOCK_PERSONA_ANALYTICS: Record<string, { usageCount: number; avgScore: number; lastUsed: string | null; topUsers: Array<{ name: string; count: number }> }> = {
  'p1': { usageCount: 47, avgScore: 72, lastUsed: new Date(Date.now() - 2 * 86_400_000).toISOString(), topUsers: [{ name: 'Jordan Lee', count: 12 }, { name: 'Taylor Morgan', count: 9 }, { name: 'Morgan Kim', count: 7 }] },
  'p2': { usageCount: 31, avgScore: 65, lastUsed: new Date(Date.now() - 1 * 86_400_000).toISOString(), topUsers: [{ name: 'Taylor Morgan', count: 11 }, { name: 'Jordan Lee', count: 8 }] },
  'p3': { usageCount: 24, avgScore: 78, lastUsed: new Date(Date.now() - 3 * 86_400_000).toISOString(), topUsers: [{ name: 'Morgan Kim', count: 9 }, { name: 'Sam Patel', count: 6 }] },
  'p4': { usageCount: 18, avgScore: 61, lastUsed: new Date(Date.now() - 5 * 86_400_000).toISOString(), topUsers: [{ name: 'Casey Zhang', count: 7 }, { name: 'Jordan Lee', count: 5 }] },
  'p5': { usageCount: 39, avgScore: 81, lastUsed: new Date(Date.now() - 1 * 86_400_000).toISOString(), topUsers: [{ name: 'Jordan Lee', count: 14 }, { name: 'Riley Johnson', count: 10 }] },
  'p6': { usageCount: 12, avgScore: 74, lastUsed: new Date(Date.now() - 7 * 86_400_000).toISOString(), topUsers: [{ name: 'Sam Patel', count: 5 }] },
};

export const personasApi = {
  list: async () => { await delay(200); return MOCK_PERSONAS; },
  create: async (data: any) => { await delay(300); return { ...data, id: `p-${Date.now()}`, isPreset: false }; },
  update: async (id: string, data: any) => { await delay(300); return { ...data, id, isPreset: false }; },
  clone: async (persona: any) => {
    await delay(300);
    return { ...persona, id: `p-${Date.now()}`, name: `${persona.name} (Copy)`, isPreset: false };
  },
  delete: async (_id: string) => { await delay(200); },
  getAnalytics: async (id: string) => {
    await delay(200);
    return MOCK_PERSONA_ANALYTICS[id] ?? { usageCount: 0, avgScore: 0, lastUsed: null, topUsers: [] };
  },
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async () => { await delay(350); return MOCK_DASHBOARD; },
  leaderboard: async (_period?: string) => { await delay(300); return MOCK_LEADERBOARD; },
};

// ── Users API ─────────────────────────────────────────────────────────────────

export const usersApi = {
  list: async () => { await delay(250); return MOCK_TEAM_USERS; },
  invite: async (data: any) => { await delay(300); return { ...data, id: `u-${Date.now()}` }; },
  update: async (id: string, data: any) => { await delay(200); return { id, ...data }; },
  stats: async (_id: string) => { await delay(200); return { sessionCount: 12, avgScore: 74 }; },
  resetPassword: async (_id: string) => { await delay(200); return { tempPassword: 'TempPass123!' }; },
};

// ── Superadmin API ────────────────────────────────────────────────────────────

const MOCK_COMPANIES: CompanyDetail[] = [
  { id: 'c1', name: 'TechCorp', slug: 'techcorp', defaultFramework: 'MEDDIC' as Framework, passThreshold: 70, isActive: true, industry: 'SaaS', agentCount: 8, adminCount: 2, totalSessions: 127, createdAt: new Date(Date.now() - 90 * 86_400_000).toISOString(), admins: [] },
  { id: 'c2', name: 'FinanceFlow', slug: 'financeflow', defaultFramework: 'BANT' as Framework, passThreshold: 75, isActive: true, industry: 'FinTech', agentCount: 12, adminCount: 3, totalSessions: 214, createdAt: new Date(Date.now() - 180 * 86_400_000).toISOString(), admins: [] },
  { id: 'c3', name: 'RetailPro', slug: 'retailpro', defaultFramework: 'SPIN' as Framework, passThreshold: 65, isActive: false, industry: 'Retail', agentCount: 5, adminCount: 1, totalSessions: 43, createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(), admins: [] },
];

export const superadminApi = {
  setup: async (data: any) => { await delay(400); return data; },
  getStats: async () => {
    await delay(300);
    return { totalCompanies: 3, activeCompanies: 2, totalUsers: 25, totalSessions: 384, activeUsersThisMonth: 18 };
  },
  listCompanies: async () => { await delay(300); return MOCK_COMPANIES; },
  createCompany: async (data: any) => { await delay(400); return { ...data, id: `c-${Date.now()}`, isActive: true, agentCount: 0, adminCount: 0, totalSessions: 0, admins: [] }; },
  getCompany: async (id: string) => { await delay(200); return MOCK_COMPANIES.find(c => c.id === id) ?? MOCK_COMPANIES[0]; },
  updateCompany: async (id: string, data: any) => { await delay(300); return { id, ...data }; },
  getCompanyUsers: async (_id: string) => { await delay(200); return MOCK_TEAM_USERS; },
  updateCompanyUser: async (_companyId: string, userId: string, data: any) => { await delay(200); return { id: userId, ...data }; },
};

// ── Voice API ─────────────────────────────────────────────────────────────────

export const voiceApi = {
  getTTSUrl: (_voiceId: string) => '',
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (_data: any) => {
    await delay(600);
    return {
      personaContext: 'You are a skeptical VP of Sales at a mid-sized SaaS company.',
      displayName: 'Jennifer Walsh',
      displayTitle: 'VP of Sales',
      displayEmoji: '',
      difficulty: 'MEDIUM',
      suggestedQuestions: [
        "What's your current sales cycle length?",
        "How are you measuring team performance today?",
        "What would success look like in 90 days?",
      ],
      objections: ["We already have a solution", "Not in budget right now"],
    };
  },
  generateQuestions: async (_data: any) => {
    await delay(400);
    return {
      questions: [
        "What's your biggest challenge with your current process?",
        "How does this impact your revenue targets?",
        "Who else is involved in this decision?",
      ],
    };
  },
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

export const teamRoleplaysApi = {
  list: async () => { await delay(200); return MOCK_TEAM_ROLEPLAYS; },
  create: async (data: any) => {
    await delay(300);
    return {
      ...data,
      id: `tr-${Date.now()}`,
      isActive: true,
      completionCount: 0,
      createdById: 'u1',
      createdBy: { id: 'u1', firstName: 'Alex', lastName: 'Rivera' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },
  update: async (id: string, data: any) => { await delay(200); return { id, ...data }; },
  delete: async (_id: string) => { await delay(200); },
  // Returns all distinct regions and teams across users — for targeting UI
  getTargetOptions: async () => {
    await delay(100);
    return {
      regions: ['North America', 'EMEA', 'APAC', 'LATAM'],
      teams: ['Enterprise', 'SMB', 'SDR Team', 'Customer Success'],
      territories: ['East Coast', 'West Coast', 'Midwest', 'UK & Ireland', 'DACH', 'Nordics', 'SEA', 'ANZ'],
      users: MOCK_TEAM_USERS.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, team: u.team, region: u.region })),
    };
  },
};

// ── Evaluation Prompts API ────────────────────────────────────────────────────

const DEFAULT_EVALUATION_PROMPTS: EvaluationPrompt[] = [
  {
    id: 'ep-cold-call',
    companyId: undefined,
    roleplayType: 'cold_call',
    displayName: 'Cold Call',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Opener',
        criteria: [
          { question: 'Permission-based opener?', hint: 'Did the rep ask for a brief moment before pitching? e.g. "Do you have 30 seconds?"' },
          { question: 'Used research on prospect?', hint: 'Referenced something specific about the prospect or company to personalise the opener.' },
        ],
      },
      {
        group: 'Discovery',
        criteria: [
          { question: 'SDR asked for preconceptions of product?', hint: 'Did the rep ask about the prospect\'s current awareness or opinion before pitching?' },
        ],
      },
      {
        group: 'Social Proof',
        criteria: [
          { question: 'Provided social proof?', hint: 'Cited a relevant customer reference, metric, or case study.' },
          { question: 'Asked if social proof was relevant?', hint: 'Checked whether the social proof was relevant to this specific prospect.' },
        ],
      },
      {
        group: 'Takeaway',
        criteria: [
          { question: 'Re-confirmed that the time works for the prospect?', hint: 'Checked the timing still works before closing the conversation.' },
          { question: 'Asked for success criteria for next call?', hint: 'Asked what a successful next call or meeting would look like.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Next steps agreed upon?', hint: 'Both parties agreed on a clear, specific next step.' },
          { question: 'Follow-up meeting booked?', hint: 'A specific date/time for a follow-up was confirmed.' },
        ],
      },
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
  "scorecardGroups": [
    {
      "group": "<group name>",
      "maxPoints": <int>,
      "earnedPoints": <int>,
      "criteria": [
        { "question": "<criterion question>", "passed": <true|false>, "reasoning": "<1 sentence from transcript>" }
      ]
    }
  ],
  "timelineEvents": [
    { "type": "<ISSUE|GOOD|WARNING|NEUTRAL>", "timestampMs": <ms>, "title": "<short>", "description": "<what happened>", "suggestion": "<coaching tip>", "transcriptRef": "<exact quote>", "betterResponse": "<alternative or null>" }
  ],
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "coachingTip": "<single most impactful tip>"
}`,
  },
  {
    id: 'ep-discovery-call',
    companyId: undefined,
    roleplayType: 'discovery_call',
    displayName: 'Discovery Call',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Introduction & Agenda',
        criteria: [
          { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', hint: 'Set an agenda AND asked the prospect if there\'s anything they want to cover.' },
          { question: 'Did the seller introduce an Upfront Contract?', hint: 'Established mutual expectations: what will happen, what the outcome will be.' },
        ],
      },
      {
        group: 'Pain & Metrics Discovery',
        criteria: [
          { question: 'Did the seller uncover specific pain points?', hint: 'At least one concrete, specific problem uncovered.' },
          { question: 'Did the seller uncover relevant metrics?', hint: 'Quantified impact — time lost, revenue lost, cost, or other measurable metric.' },
        ],
      },
      {
        group: 'Objection Handling',
        criteria: [
          { question: 'Did the seller handle objections effectively using the FFF framework?', hint: 'Acknowledged, empathised (Feel-Felt-Found), then reframed any objection raised.' },
        ],
      },
      {
        group: 'Customer Reference & Value',
        criteria: [
          { question: 'Did the seller present a customer reference?', hint: 'Referenced a similar customer and their outcome.' },
          { question: 'Did the seller explore the prospect\'s goal-setting framework?', hint: 'Asked how the prospect measures success or sets targets.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Did the seller revisit the upfront contract and define next steps?', hint: 'Closed by referencing what was agreed at the start and confirming concrete next steps.' },
          { question: 'Did the seller qualify out or in effectively?', hint: 'Reached a clear conclusion about whether this is a qualified opportunity.' },
        ],
      },
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
  "coachingTip": "<single most impactful tip>"
}`,
  },
  {
    id: 'ep-sales-pitch',
    companyId: undefined,
    roleplayType: 'sales_pitch',
    displayName: 'Sales Pitch',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Value Proposition',
        criteria: [
          { question: 'Did the seller open with a clear, specific value proposition?', hint: 'Value stated in prospect\'s language, not feature-speak.' },
          { question: 'Did the seller differentiate from competition?', hint: 'Explicitly addressed why they are different from alternatives.' },
        ],
      },
      {
        group: 'Business Case',
        criteria: [
          { question: 'Did the seller build a ROI / business case?', hint: 'Quantified the return or cost of inaction in prospect\'s terms.' },
          { question: 'Did the seller use a customer reference or proof point?', hint: 'Referenced a relevant case study or social proof.' },
        ],
      },
      {
        group: 'Objection Handling',
        criteria: [
          { question: 'Did the seller handle questions and objections confidently?', hint: 'Acknowledged, explored, and reframed without becoming defensive.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Did the seller define a clear next step?', hint: 'Specific, time-bound next action agreed.' },
          { question: 'Did the seller confirm prospect\'s commitment to next step?', hint: 'Prospect verbally agreed to the proposed next step.' },
        ],
      },
    ],
    promptTemplate: `You are an expert sales coach evaluating a sales pitch roleplay.

SCORECARD — judge each criterion pass/fail with one sentence of evidence.

Criterion Groups:
- Value Proposition (2 pts): Clear specific value prop? | Differentiated from competition?
- Business Case (2 pts): Built ROI/business case? | Used customer reference?
- Objection Handling (1 pt): Handled objections confidently?
- Closing (2 pts): Defined clear next step? | Confirmed prospect commitment?

TRANSCRIPT:
{transcript}

Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, coachingTip.`,
  },
  {
    id: 'ep-objection-handling',
    companyId: undefined,
    roleplayType: 'objection_handling',
    displayName: 'Objection Handling',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Objection Response',
        criteria: [
          { question: 'Did the seller acknowledge the objection without defending?', hint: 'Validated the concern before responding.' },
          { question: 'Did the seller explore the root cause with a question?', hint: 'Asked a clarifying question to understand what\'s driving the objection.' },
          { question: 'Did the seller provide relevant evidence or reframe?', hint: 'Addressed the objection with a specific fact, story, or reframe.' },
          { question: 'Did the seller confirm the objection was resolved?', hint: 'Checked that the prospect was satisfied with the response.' },
          { question: 'Did the seller maintain momentum toward next step?', hint: 'Moved the conversation forward after resolving the objection.' },
        ],
      },
    ],
    promptTemplate: `You are an expert sales coach evaluating an objection handling roleplay.

SCORECARD — judge each criterion pass/fail with one sentence of evidence.

Criterion Group:
- Objection Response (5 pts): Acknowledged without defending? | Explored root cause? | Provided relevant evidence/reframe? | Confirmed objection resolved? | Maintained momentum?

TRANSCRIPT:
{transcript}

Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, coachingTip.`,
  },
  {
    id: 'ep-negotiation',
    companyId: undefined,
    roleplayType: 'negotiation',
    displayName: 'Negotiation',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Negotiation Technique',
        criteria: [
          { question: 'Did the seller anchor high before conceding?', hint: 'Started from a strong position before making any concessions.' },
          { question: 'Did the seller trade concessions (not give without getting)?', hint: 'Every concession was paired with a request in return.' },
          { question: 'Did the seller protect margin and key terms?', hint: 'Avoided giving away price or terms without protecting core value.' },
          { question: 'Did the seller reach a mutually agreed outcome?', hint: 'Both parties reached explicit agreement on terms.' },
          { question: 'Did the seller maintain relationship throughout?', hint: 'Tone stayed professional and collaborative despite pressure.' },
        ],
      },
    ],
    promptTemplate: `You are an expert sales coach evaluating a negotiation roleplay.

SCORECARD — judge each criterion pass/fail.

Criterion Group:
- Negotiation Technique (5 pts): Anchored high first? | Traded concessions? | Protected margin/terms? | Reached mutual outcome? | Maintained relationship?

TRANSCRIPT:
{transcript}

Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, coachingTip.`,
  },
  {
    id: 'ep-account-expansion',
    companyId: undefined,
    roleplayType: 'account_expansion',
    displayName: 'Account Expansion',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Expansion Discovery',
        criteria: [
          { question: 'Did the seller reference existing relationship or wins?', hint: 'Grounded the conversation in proven value already delivered.' },
          { question: 'Did the seller identify a new business need or expansion trigger?', hint: 'Found a new pain point or growth opportunity in the account.' },
        ],
      },
      {
        group: 'Expansion Business Case',
        criteria: [
          { question: 'Did the seller map to additional stakeholders?', hint: 'Identified new decision-makers or champions for the expansion.' },
          { question: 'Did the seller present an expansion business case with ROI?', hint: 'Quantified the value of expanding the engagement.' },
          { question: 'Did the seller define next steps for the expansion?', hint: 'Agreed on a specific next step to move the expansion forward.' },
        ],
      },
    ],
    promptTemplate: `You are an expert account manager coach evaluating an account expansion roleplay.

SCORECARD — judge each criterion pass/fail.

Criterion Groups:
- Expansion Discovery (2 pts): Referenced existing wins? | Identified expansion trigger?
- Expansion Business Case (3 pts): Mapped to additional stakeholders? | Presented ROI business case? | Defined expansion next steps?

TRANSCRIPT:
{transcript}

Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, coachingTip.`,
  },
  {
    id: 'ep-customer-support',
    companyId: undefined,
    roleplayType: 'customer_support',
    displayName: 'Customer Support',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scoringCriteria: [
      {
        group: 'Issue Resolution',
        criteria: [
          { question: 'Did the rep acknowledge and empathise with the customer?', hint: 'Showed genuine understanding of the customer\'s frustration.' },
          { question: 'Did the rep correctly diagnose the issue?', hint: 'Asked clarifying questions to understand the root cause.' },
          { question: 'Did the rep offer a clear solution or next step?', hint: 'Provided a specific resolution path, not just "I\'ll look into it".' },
          { question: 'Did the rep set accurate expectations?', hint: 'Was honest about timelines and what can/cannot be done.' },
          { question: 'Did the rep confirm customer satisfaction before closing?', hint: 'Checked the customer was happy with the resolution.' },
        ],
      },
    ],
    promptTemplate: `You are an expert customer support coach evaluating a support call roleplay.

SCORECARD — judge each criterion pass/fail.

Criterion Group:
- Issue Resolution (5 pts): Acknowledged and empathised? | Diagnosed issue correctly? | Offered clear solution? | Set accurate expectations? | Confirmed satisfaction?

TRANSCRIPT:
{transcript}

Return valid JSON with overallScore, overallFeedback, scorecardGroups, timelineEvents, strengths, improvements, coachingTip.`,
  },
];

export const evaluationPromptsApi = {
  list: async (): Promise<EvaluationPrompt[]> => {
    await delay(200);
    return DEFAULT_EVALUATION_PROMPTS;
  },
  get: async (roleplayType: string): Promise<EvaluationPrompt | null> => {
    await delay(100);
    return DEFAULT_EVALUATION_PROMPTS.find(p => p.roleplayType === roleplayType) ?? null;
  },
  update: async (id: string, data: Partial<EvaluationPrompt>): Promise<EvaluationPrompt> => {
    await delay(300);
    const existing = DEFAULT_EVALUATION_PROMPTS.find(p => p.id === id) ?? DEFAULT_EVALUATION_PROMPTS[0];
    return { ...existing, ...data, updatedAt: new Date().toISOString() };
  },
};

// Stub axios instance used by a few pages directly (VoicePicker, FeedbackPage)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _apiStub: any = {
  get: (_url: string, _config?: any) => Promise.resolve({ data: {} as any }),
  post: (_url: string, _data?: any) => Promise.resolve({ data: {} as any }),
  patch: (_url: string, _data?: any) => Promise.resolve({ data: {} as any }),
  delete: (_url: string) => Promise.resolve({ data: {} as any }),
};
export const api: any = _apiStub;
