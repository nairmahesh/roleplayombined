import axios, { AxiosInstance } from 'axios';
import { useAuthStore } from './store';
import type {
  DashboardStats,
  DashboardFrameworkStat,
  DashboardRecentSession,
  TeamMemberSummary,
  LeaderboardEntry,
  Session,
  Persona,
  User,
  TeamRoleplay,
  CompanyDetail,
  EvaluationPrompt,
  PeerSession,
} from '@/types';

// ── Axios instance ────────────────────────────────────────────────────────────

const http: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((cfg) => {
  const token = useAuthStore.getState().accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Demo users (localStorage auth) ───────────────────────────────────────────

const DEMO_COMPANY = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Demo Company',
  slug: 'demo',
  defaultFramework: 'MEDDIC' as const,
  passThreshold: 70,
  industry: 'Technology',
};

const DEMO_USERS: Record<string, User & { password: string }> = {
  'superadmin@demo.com': {
    id: '10000000-0000-0000-0000-000000000001',
    email: 'superadmin@demo.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'SUPER_ADMIN',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'admin@demo.com': {
    id: '10000000-0000-0000-0000-000000000002',
    email: 'admin@demo.com',
    firstName: 'Company',
    lastName: 'Admin',
    role: 'COMPANY_ADMIN',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'manager@demo.com': {
    id: '10000000-0000-0000-0000-000000000003',
    email: 'manager@demo.com',
    firstName: 'Demo',
    lastName: 'Manager',
    role: 'MANAGER',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
  'agent@demo.com': {
    id: '10000000-0000-0000-0000-000000000004',
    email: 'agent@demo.com',
    firstName: 'Demo',
    lastName: 'Agent',
    role: 'AGENT',
    companyId: DEMO_COMPANY.id,
    company: DEMO_COMPANY,
    isActive: true,
    password: 'Demo1234!',
  },
};

const LS_KEY = 'pitchiq-session';

function makeToken(userId: string) {
  return btoa(JSON.stringify({ userId, exp: Date.now() + 86400_000 }));
}

// ── Auth API (localStorage-backed) ───────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const record = DEMO_USERS[email.toLowerCase()];
    if (!record || record.password !== password) {
      throw { response: { data: { detail: 'Invalid email or password' } } };
    }
    const { password: _pw, ...user } = record;
    const accessToken = makeToken(user.id);
    const refreshToken = makeToken(user.id + '-refresh');
    localStorage.setItem(LS_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    return { user, accessToken, refreshToken };
  },

  register: async (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    companyName?: string;
    companySlug?: string;
  }) => {
    const user: User = {
      id: crypto.randomUUID(),
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: 'AGENT',
      companyId: '',
      isActive: true,
    };
    const accessToken = makeToken(user.id);
    const refreshToken = makeToken(user.id + '-refresh');
    localStorage.setItem(LS_KEY, JSON.stringify({ user, accessToken, refreshToken }));
    return { user, accessToken, refreshToken };
  },

  logout: async () => {
    localStorage.removeItem(LS_KEY);
  },

  me: async (): Promise<User> => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error('Not authenticated');
    return JSON.parse(raw).user as User;
  },

  restoreSession: (): { user: User; accessToken: string; refreshToken: string } | null => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },
};

// ── Mock data store (localStorage-backed) ────────────────────────────────────

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const MOCK_PERSONAS: Persona[] = [
  {
    id: 'p1', name: 'Sarah Chen', title: 'VP of Engineering', company: 'TechCorp', industry: 'SaaS',
    emoji: '👩‍💻', difficulty: 'MEDIUM', personality: 'Analytical, data-driven, skeptical of ROI claims',
    systemPrompt: 'You are Sarah Chen, VP of Engineering at TechCorp. You are evaluating sales pitches carefully.',
    objections: ['We already have an internal solution', 'The timeline is too aggressive', 'Budget is frozen until Q4'],
    buyingSignals: ['How does it integrate with our stack?', 'What does onboarding look like?'],
    frameworks: ['MEDDIC', 'SPIN'],
    isPreset: true,
  },
  {
    id: 'p2', name: 'Marcus Johnson', title: 'CFO', company: 'RetailCo', industry: 'Retail',
    emoji: '💼', difficulty: 'HARD', personality: 'Numbers-focused, time-constrained, needs clear ROI',
    systemPrompt: 'You are Marcus Johnson, CFO at RetailCo. You focus on financial impact and risk.',
    objections: ['What is the total cost of ownership?', 'We need to see proof of ROI first', 'Our board is risk-averse'],
    buyingSignals: ['What payback period can we expect?', 'Do you have case studies from our sector?'],
    frameworks: ['BANT', 'MEDDIC'],
    isPreset: true,
  },
  {
    id: 'p3', name: 'Priya Patel', title: 'Head of Sales', company: 'GrowthCo', industry: 'FinTech',
    emoji: '🎯', difficulty: 'EASY', personality: 'Collaborative, growth-focused, open to new tools',
    systemPrompt: 'You are Priya Patel, Head of Sales at GrowthCo. You are exploring tools to help your team hit targets.',
    objections: ['Will this slow my team down?', 'What training is required?'],
    buyingSignals: ['How quickly can we deploy?', 'Can we run a pilot?'],
    frameworks: ['SPIN', 'CHALLENGER', 'SNAP'],
    isPreset: true,
  },
  {
    id: 'p4', name: 'James Wright', title: 'CTO', company: 'HealthTech Inc', industry: 'Healthcare',
    emoji: '🏥', difficulty: 'EXPERT', personality: 'Security-conscious, compliance-driven, deeply technical',
    systemPrompt: 'You are James Wright, CTO at HealthTech Inc. Security and compliance are your top priorities.',
    objections: ['How do you handle HIPAA compliance?', 'What are your SLA guarantees?', 'We cannot move data to the cloud'],
    buyingSignals: ['Tell me about your security architecture', 'Who are your other healthcare clients?'],
    frameworks: ['MEDDIC', 'MEDDICC'],
    isPreset: true,
  },
];

const MOCK_SESSIONS: Session[] = [
  {
    id: 's1', type: 'PHONE_CALL', status: 'COMPLETED', framework: 'MEDDIC',
    totalScore: 81, durationSeconds: 492,
    startedAt: new Date(Date.now() - 86400000).toISOString(),
    endedAt: new Date(Date.now() - 83400000).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    persona: { id: 'p1', name: 'Sarah Chen', title: 'VP of Sales', emoji: '👩‍💼', difficulty: 'MEDIUM' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    scenarioConfig: {
      industry: 'SaaS', roleplayType: 'Discovery Call',
      personaContext: 'You are Sarah Chen, VP of Sales at TechCorp.',
      displayName: 'Sarah Chen', displayTitle: 'VP of Sales', displayEmoji: '👩‍💼',
      difficulty: 'MEDIUM', suggestedQuestions: [],
      objections: ["Too expensive for what you're offering", 'We already use Gong for this', 'Not the right time — end of quarter'],
    },
    messages: [
      { id: 'm1', sessionId: 's1', role: 'user', content: "Hi Sarah, this is Alex from PitchIQ. I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B. Do you have 30 seconds?", timestampMs: 5000 },
      { id: 'm2', sessionId: 's1', role: 'assistant', content: 'Sure, 30 seconds. What is this about?', timestampMs: 18000 },
      { id: 'm3', sessionId: 's1', role: 'user', content: 'Thanks. We help VP-level sales leaders quantify where rep performance breaks down. Companies like yours typically see a 20% lift in quota attainment in 90 days. Is that on your radar?', timestampMs: 28000 },
      { id: 'm4', sessionId: 's1', role: 'assistant', content: "We do have challenges. Reps are ramping slowly and we're missing numbers. But we already have Gong.", timestampMs: 52000 },
      { id: 'm5', sessionId: 's1', role: 'user', content: 'Interesting — what does Gong show you today? Is it pinpointing which MEDDIC component each rep struggles with, or more call activity?', timestampMs: 68000 },
      { id: 'm6', sessionId: 's1', role: 'assistant', content: "Honestly mostly call activity. We can see what reps are doing but not exactly why deals fall through.", timestampMs: 95000 },
      { id: 'm7', sessionId: 's1', role: 'user', content: "That's the exact gap we solve. If you could pinpoint within 24 hours which MEDDIC component each rep struggles with, how would that change your coaching time?", timestampMs: 118000 },
      { id: 'm8', sessionId: 's1', role: 'assistant', content: "It would be transformative. I spend 3 hours per week just listening to random calls.", timestampMs: 145000 },
      { id: 'm9', sessionId: 's1', role: 'user', content: "At $200/hr loaded cost, that's $600 a week — $31K a year — just on manual call review. What does a 10% miss on your team look like in dollars?", timestampMs: 165000 },
      { id: 'm10', sessionId: 's1', role: 'assistant', content: "...that's painful. 20 reps at $1.2M quota — a 10% miss is $2.4 million.", timestampMs: 198000 },
      { id: 'm11', sessionId: 's1', role: 'user', content: "Exactly. Can we book 30 minutes with you and your CRO next week to walk through how we'd close that gap?", timestampMs: 218000 },
      { id: 'm12', sessionId: 's1', role: 'assistant', content: "I need to think about it. The pricing seems steep for what you're describing.", timestampMs: 248000 },
      { id: 'm13', sessionId: 's1', role: 'user', content: "That's fair — let's build the ROI model together on the call. Does Thursday at 2pm work?", timestampMs: 265000 },
      { id: 'm14', sessionId: 's1', role: 'assistant', content: "Send me a calendar invite. If the ROI model holds up, I'll have Marcus join.", timestampMs: 295000 },
      { id: 'm15', sessionId: 's1', role: 'user', content: "Perfect. One last thing — what would a successful next call look like from your side?", timestampMs: 310000 },
      { id: 'm16', sessionId: 's1', role: 'assistant', content: "Show me real data from a company our size. Not case study fluff — actual before/after quota numbers.", timestampMs: 345000 },
    ],
    frameworkScores: [
      { id: 'fs1', component: 'Metrics', score: 88, feedback: 'Excellent quantitative framing. You anchored with a 20% lift, then helped Sarah self-calculate — $31K/year in coaching time and $2.4M quota miss risk.', evidence: ['Cited 20% quota attainment lift at 0:28', 'Calculated $31K/year coaching cost at 2:45', 'Surfaced $2.4M quota miss at 3:18'] },
      { id: 'fs2', component: 'Economic Buyer', score: 74, feedback: "You identified the CRO (Marcus) and secured a conditional commitment to include him. Didn't ask what Marcus specifically cares about — a gap for the next call.", evidence: ['Identified CRO (Marcus) as EB at 4:55', 'Secured conditional next-call commitment at 4:55'] },
      { id: 'fs3', component: 'Decision Criteria', score: 70, feedback: "Touched on attainment and ROI as likely criteria but never asked Sarah directly: 'What would a successful vendor need to prove to you?'", evidence: ["Assumed attainment % is the primary criterion — never confirmed at 1:58"] },
      { id: 'fs4', component: 'Identify Pain', score: 92, feedback: 'Outstanding pain discovery. Three distinct layers: slow ramp, 3hrs/week manual coaching cost, and $2.4M quota miss. Let Sarah do the maths herself.', evidence: ['Slow ramp & missed numbers at 0:52', 'Manual coaching cost surfaced at 2:25', 'Prospect self-calculated $2.4M miss at 3:18'] },
      { id: 'fs5', component: 'Champion', score: 62, feedback: "Sarah is a potential champion but you didn't arm her — no internal pitch, no one-pager offer, no 'how do you sell this internally' question.", evidence: ['Did not ask Sarah what she needs to present internally at 3:58', 'Did not offer internal talking points'] },
    ],
    timelineEvents: [
      { id: 'te1', type: 'GOOD', timestampMs: 5000, title: 'Strong permission-based opener', description: "Opened with a specific research reference to the Series B and asked for only 30 seconds — low-friction entry.", transcriptRef: "I was looking at TechCorp's recent expansion into the enterprise segment — congrats on the Series B" },
      { id: 'te2', type: 'GOOD', timestampMs: 68000, title: 'Competitor probe without attacking', description: "Rather than dismissing Gong, asked what it measures — turned the objection into a discovery question.", transcriptRef: 'what does Gong show you today?' },
      { id: 'te3', type: 'GOOD', timestampMs: 165000, title: "ROI in prospect's own numbers", description: "Converted coaching time to dollars using Sarah's own data — far more compelling than a benchmark.", transcriptRef: "At $200/hr loaded cost, that's $600 a week" },
      { id: 'te4', type: 'WARNING', timestampMs: 218000, title: 'Moved to close without confirming criteria', description: 'Jumped to booking a meeting before asking what Sarah would need to feel confident. Recovered later but created a resistance moment.', suggestion: "Before asking for the meeting, ask: 'What would need to be true for you to feel this is worth 30 minutes of your CRO's time?'" },
      { id: 'te5', type: 'ISSUE', timestampMs: 248000, title: 'Price objection handled defensively', description: "When Sarah said 'pricing seems steep', you reframed without exploring what 'steep' means to her first.", suggestion: "Probe before reframing: 'When you say steep — is that relative to budget, or to what you'd expect for a tool like this?'", transcriptRef: "The pricing seems steep for what you're describing", betterResponse: "Totally fair — before I defend the number, can I ask: when you say steep, is that relative to your current budget cycle, or to what you'd expect this type of tool to cost?" },
      { id: 'te6', type: 'GOOD', timestampMs: 310000, title: 'Pre-call success criteria asked', description: "Asked Sarah what a successful next call looks like — gives a clear mandate for Thursday's meeting.", transcriptRef: 'what would a successful next call look like from your side?' },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Strong discovery call with excellent pain quantification. You let Sarah do the maths herself, which is far more persuasive than presenting a number. The main gap is champion development — you left without arming Sarah for her internal conversation with Marcus.',
      strengths: [
        'Opened with a research-backed, low-friction permission ask',
        'Converted abstract pain into dollar figures using the prospect\'s own data',
        'Recovered from the price objection and secured a conditional next step with the CRO',
        'Closed by asking for next-call success criteria — textbook pre-frame',
      ],
      improvements: [
        'Ask the Economic Buyer\'s success criteria before the next call',
        'Build Sarah as champion: offer an internal one-pager or talking points for Marcus',
        'Probe objections before reframing — ask what "steep" means to her first',
      ],
      proTip: 'After the ROI calculation lands, ask: "So on that basis, what\'s the cost of doing nothing for another 6 months?" — this closes the urgency loop before you ask for the meeting.',
      scorecardGroups: [
        {
          group: 'Introduction & Agenda',
          maxPoints: 2, earnedPoints: 1,
          criteria: [
            { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', passed: false, reasoning: "Rep asked for 30 seconds but didn't set a full agenda or invite Sarah to add topics at 0:05." },
            { question: 'Did the seller introduce an Upfront Contract?', passed: true, reasoning: 'Permission-based opener at 0:05 established a clear mutual expectation.' },
          ],
        },
        {
          group: 'Pain & Metrics Discovery',
          maxPoints: 2, earnedPoints: 2,
          criteria: [
            { question: 'Did the seller uncover specific pain points?', passed: true, reasoning: 'Three distinct pain layers uncovered: slow ramp at 0:52, coaching cost at 2:25, quota miss at 3:18.' },
            { question: 'Did the seller uncover relevant metrics?', passed: true, reasoning: "Quantified $31K/year coaching cost and $2.4M quota miss at 2:45 and 3:18 using Sarah's own numbers." },
          ],
        },
        {
          group: 'Objection Handling',
          maxPoints: 1, earnedPoints: 0,
          criteria: [
            { question: 'Did the seller handle objections effectively using the FFF framework?', passed: false, reasoning: 'Price objection at 4:08 was reframed before the root cause was explored.' },
          ],
        },
        {
          group: 'Customer Reference & Value',
          maxPoints: 2, earnedPoints: 1,
          criteria: [
            { question: 'Did the seller present a customer reference?', passed: false, reasoning: 'No customer reference or case study cited during the call.' },
            { question: "Did the seller explore the prospect's goal-setting framework?", passed: true, reasoning: 'Asked for next-call success criteria at 5:10 — surfaced need for real before/after quota data.' },
          ],
        },
        {
          group: 'Closing',
          maxPoints: 2, earnedPoints: 1,
          criteria: [
            { question: 'Did the seller revisit the upfront contract and define next steps?', passed: true, reasoning: 'Calendar invite agreed for Thursday at 2pm at 4:25, with CRO conditionally included.' },
            { question: 'Did the seller qualify out or in effectively?', passed: false, reasoning: 'Call ended without confirming whether this is a qualified opportunity — next step is conditional.' },
          ],
        },
      ],
    }),
  },
  {
    id: 's2', type: 'ONLINE_MEETING', status: 'COMPLETED', framework: 'SPIN',
    totalScore: 72, durationSeconds: 540,
    startedAt: new Date(Date.now() - 172800000).toISOString(),
    endedAt: new Date(Date.now() - 168600000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    persona: { id: 'p2', name: 'Marcus Johnson', title: 'CFO', emoji: '💼', difficulty: 'HARD' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    scenarioConfig: {
      industry: 'FinTech', roleplayType: 'Discovery Call',
      personaContext: 'You are Marcus Johnson, CFO at RetailCo.',
      displayName: 'Marcus Johnson', displayTitle: 'CFO', displayEmoji: '💼',
      difficulty: 'HARD', suggestedQuestions: [],
      objections: ['We need to see proof of ROI first', 'Our board is risk-averse', 'Budget is already allocated'],
    },
    messages: [
      { id: 'm1', sessionId: 's2', role: 'user', content: "Marcus, thanks for making time. Can you tell me about how your team currently handles financial reporting across regions — specifically where the biggest lag is?", timestampMs: 8000 },
      { id: 'm2', sessionId: 's2', role: 'assistant', content: "The lag is in consolidation. We have 8 subsidiaries and it takes us 12 days to close the books each month. Industry standard is 5.", timestampMs: 28000 },
      { id: 'm3', sessionId: 's2', role: 'user', content: "12 days vs 5 — what does that 7-day gap cost you in terms of decision-making latency? Are there deals or investments that get delayed?", timestampMs: 45000 },
      { id: 'm4', sessionId: 's2', role: 'assistant', content: "Absolutely. Last quarter we missed a forex hedging window because we didn't have consolidated data in time. That cost us roughly $400K.", timestampMs: 68000 },
      { id: 'm5', sessionId: 's2', role: 'user', content: "A $400K miss from a 7-day lag. If that happens twice a year, you're looking at $800K in avoidable losses. Is that figure on the board's radar?", timestampMs: 88000 },
      { id: 'm6', sessionId: 's2', role: 'assistant', content: "It is now. I brought it up in our last board meeting. They want a solution but they also want proof it won't create new risk.", timestampMs: 112000 },
      { id: 'm7', sessionId: 's2', role: 'user', content: "What would proof look like for your board — a pilot with one region, or reference clients in similar-sized companies?", timestampMs: 130000 },
      { id: 'm8', sessionId: 's2', role: 'assistant', content: "Both. And they'll want to see the security architecture. We had a bad experience with a vendor last year.", timestampMs: 158000 },
    ],
    frameworkScores: [
      { id: 'fs7', component: 'Situation Questions', score: 82, feedback: 'Good situational grounding. Asked about the current process before pitching — established credibility and surfaced the 12-day close as the core constraint.', evidence: ['Asked about regional reporting lag at 0:08', 'Established 12-day close vs 5-day benchmark at 0:28'] },
      { id: 'fs8', component: 'Problem Questions', score: 78, feedback: 'Strong problem identification. Surfaced both the technical issue (consolidation lag) and the business cost ($400K forex miss). Let Marcus put the number on the table himself.', evidence: ['Uncovered forex hedging miss at 1:08', '$400K direct cost confirmed by Marcus at 1:08'] },
      { id: 'fs9', component: 'Implication Questions', score: 65, feedback: "You asked good implication questions but stopped at one chain. Extended the $400K to $800K/year — good. But didn't ask about team credibility or board political implications.", evidence: ['$800K annual risk projected at 1:28', 'Board visibility confirmed at 1:52 — but deeper implications not probed'] },
      { id: 'fs10', component: 'Need-Payoff Questions', score: 64, feedback: "The proof question at 2:10 was good but came slightly early. Marcus hadn't fully expressed the implication of the board pressure before you pivoted to solution.", evidence: ['Need-payoff question asked at 2:10 — slightly premature', 'Marcus articulated proof requirements himself at 2:38'] },
    ],
    timelineEvents: [
      { id: 'te1', type: 'GOOD', timestampMs: 8000, title: 'Process-first opener', description: "Opened by asking about the current reporting process before pitching — earned immediate credibility with a CFO.", transcriptRef: 'how your team currently handles financial reporting across regions' },
      { id: 'te2', type: 'GOOD', timestampMs: 88000, title: 'Annualised risk calculation', description: "Converted a one-time $400K miss into an $800K annual exposure — made the cost of inaction concrete.", transcriptRef: "you're looking at $800K in avoidable losses" },
      { id: 'te3', type: 'WARNING', timestampMs: 130000, title: 'Need-payoff question too early', description: "Moved to 'what would proof look like' before Marcus had fully expressed the board pressure implications.", suggestion: "Ask one more implication: 'What does it mean for your credibility with the board if this happens again in Q3?' — then ask the proof question." },
      { id: 'te4', type: 'ISSUE', timestampMs: 158000, title: 'Prior vendor incident not explored', description: "Marcus mentioned a bad experience with a previous vendor — you acknowledged it but didn't probe what happened. This shapes the entire evaluation.", suggestion: "Ask: 'What happened with that vendor? Understanding it will help me make sure we don't repeat the same pattern for you.'", transcriptRef: "We had a bad experience with a vendor last year." },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'A technically fluent SPIN session with strong situation and problem discovery. Your implication questions were effective but didn\'t chain deeply enough before moving to need-payoff. The prior vendor incident is a qualification risk you need to understand before the next call.',
      strengths: [
        'Process-first opener earned instant credibility with a CFO',
        'Let Marcus quantify the $400K loss himself — far more credible than citing a benchmark',
        'Annualised the risk to $800K — made the cost of inaction visceral',
      ],
      improvements: [
        'Chain implication questions deeper: after $800K, ask "What does it do to your board credibility if this happens again?"',
        'Always probe prior vendor incidents before moving forward — they define your evaluation criteria',
        'Let implication pain fully land before pivoting to need-payoff — wait for the silence',
      ],
      proTip: "After a strong implication, pause. Don't fill the silence. Let Marcus sit with the $800K risk before you ask the payoff question — the discomfort is what creates urgency.",
      scorecardGroups: [
        {
          group: 'Situation Questions',
          maxPoints: 2, earnedPoints: 2,
          criteria: [
            { question: 'Did the seller establish the current situation before pitching?', passed: true, reasoning: 'Asked about regional reporting process at 0:08 — strong grounding before any pitch.' },
            { question: 'Did the seller ask about team capacity and constraints?', passed: true, reasoning: '12-day close vs 5-day benchmark surfaced at 0:28 — clear constraint established.' },
          ],
        },
        {
          group: 'Problem Questions',
          maxPoints: 2, earnedPoints: 2,
          criteria: [
            { question: 'Did the seller uncover the core business problem?', passed: true, reasoning: 'Forex hedging miss due to data lag surfaced at 1:08.' },
            { question: 'Did the seller quantify the problem impact?', passed: true, reasoning: '$400K direct cost confirmed by Marcus at 1:08.' },
          ],
        },
        {
          group: 'Implication Questions',
          maxPoints: 2, earnedPoints: 1,
          criteria: [
            { question: 'Did the seller chain implication questions across multiple levels?', passed: false, reasoning: 'Only one implication chain explored — board credibility and political implications not probed at 1:28.' },
            { question: 'Did the seller connect implications to strategic risk?', passed: true, reasoning: '$800K annual exposure surfaced at 1:28 — strong strategic implication.' },
          ],
        },
        {
          group: 'Need-Payoff Questions',
          maxPoints: 1, earnedPoints: 0,
          criteria: [
            { question: 'Did the seller let the prospect articulate the value themselves?', passed: false, reasoning: 'Need-payoff question at 2:10 came before implications fully landed — slightly rushed.' },
          ],
        },
      ],
    }),
  },
  {
    id: 's3', type: 'PHONE_CALL', status: 'COMPLETED', framework: 'BANT',
    totalScore: 88, durationSeconds: 372,
    startedAt: new Date(Date.now() - 259200000).toISOString(),
    endedAt: new Date(Date.now() - 256200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    persona: { id: 'p3', name: 'Priya Patel', title: 'Head of Sales', emoji: '🎯', difficulty: 'EASY' },
    user: { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent' },
    scenarioConfig: {
      industry: 'FinTech', roleplayType: 'Cold Call',
      personaContext: 'You are Priya Patel, Head of Sales at GrowthCo.',
      displayName: 'Priya Patel', displayTitle: 'Head of Sales', displayEmoji: '🎯',
      difficulty: 'EASY', suggestedQuestions: [],
      objections: ['Will this slow my team down?', 'What training is required?', 'We already have a tool for this'],
    },
    messages: [
      { id: 'm1', sessionId: 's3', role: 'user', content: "Hi Priya, quick question — are your reps hitting quota consistently, or is it a top-20% problem where a few carry the team?", timestampMs: 5000 },
      { id: 'm2', sessionId: 's3', role: 'assistant', content: "Honestly, it's the latter. My top 3 reps do 60% of revenue. The rest are inconsistent.", timestampMs: 20000 },
      { id: 'm3', sessionId: 's3', role: 'user', content: "That's the pattern we see most. Have you been able to pinpoint what the top 3 do differently, or is it still a black box?", timestampMs: 35000 },
      { id: 'm4', sessionId: 's3', role: 'assistant', content: "We have some theories — they ask better questions, they're more persistent — but we can't systematically teach it.", timestampMs: 55000 },
      { id: 'm5', sessionId: 's3', role: 'user', content: "What's your current approach to closing that gap? Are you using any roleplay or practice tools, or is it mostly call shadowing?", timestampMs: 72000 },
      { id: 'm6', sessionId: 's3', role: 'assistant', content: "Call shadowing mostly. It's time-consuming and the feedback isn't consistent. I've been looking at tools but haven't committed.", timestampMs: 95000 },
      { id: 'm7', sessionId: 's3', role: 'user', content: "Do you have budget set aside for a sales enablement tool, or would this need a new approval process?", timestampMs: 115000 },
      { id: 'm8', sessionId: 's3', role: 'assistant', content: "I have discretionary budget up to $50K. Above that I need my CRO. What are we looking at?", timestampMs: 138000 },
      { id: 'm9', sessionId: 's3', role: 'user', content: "We'd be well within your discretionary range. What's your ideal timeline — are you trying to solve this before Q3 starts?", timestampMs: 155000 },
      { id: 'm10', sessionId: 's3', role: 'assistant', content: "Yes, ideally onboarded before July. That gives my reps a quarter to build the habit before our busiest period.", timestampMs: 178000 },
      { id: 'm11', sessionId: 's3', role: 'user', content: "July is very achievable — we're 3 weeks to live. Can we get 30 minutes in your calendar this week to walk through how we'd specifically solve the top-20% problem for your team?", timestampMs: 195000 },
      { id: 'm12', sessionId: 's3', role: 'assistant', content: "Yes, Thursday works. Send me a calendar invite.", timestampMs: 215000 },
    ],
    frameworkScores: [
      { id: 'fs11', component: 'Budget', score: 90, feedback: 'Excellent budget qualification. Surfaced the $50K discretionary threshold and confirmed the deal fits within it — no approval escalation needed. Could have pushed to understand what happens if the solution costs $60K.', evidence: ['$50K discretionary budget threshold confirmed at 2:18', 'Confirmed deal fits within range at 2:35'] },
      { id: 'fs12', component: 'Authority', score: 92, feedback: "Outstanding authority identification. Priya controls budget up to $50K — you confirmed she's the decision maker before presenting scope. Also identified CRO as the threshold trigger.", evidence: ['Priya confirmed as decision maker at 2:18', 'CRO threshold identified at 2:18'] },
      { id: 'fs13', component: 'Need', score: 88, feedback: "Strong need discovery. Top-20% problem → $60% revenue concentration → inability to systematically teach best practices. Let Priya articulate the gap herself — didn't project or assume.", evidence: ['Top-20% problem confirmed at 0:20', 'Systematic teaching gap surfaced at 0:55', 'Call shadowing as current (inadequate) solution at 1:35'] },
      { id: 'fs14', component: 'Timeline', score: 82, feedback: "Good timeline discovery — July deadline surfaced and 3-week implementation confirmed as feasible. Didn't probe what happens if July slips — what's the cost of going into the busy period without a solution?", evidence: ['July deadline confirmed at 2:58', '3-week implementation window confirmed at 3:15'] },
    ],
    timelineEvents: [
      { id: 'te1', type: 'GOOD', timestampMs: 5000, title: 'Pain-diagnostic opener', description: "Opened with a direct question about the top-20% problem — immediately relevant to any sales leader and skips generic rapport-building.", transcriptRef: "are your reps hitting quota consistently, or is it a top-20% problem" },
      { id: 'te2', type: 'GOOD', timestampMs: 35000, title: 'Probed root cause before pitching', description: "Asked whether the top-3 advantage is understood or still a black box — shows curiosity and sets up the solution naturally.", transcriptRef: "is it still a black box?" },
      { id: 'te3', type: 'GOOD', timestampMs: 115000, title: 'Budget qualified early', description: "Asked about budget in the second discovery exchange — efficient qualification without being transactional.", transcriptRef: "Do you have budget set aside, or would this need approval?" },
      { id: 'te4', type: 'WARNING', timestampMs: 155000, title: 'Timeline urgency not fully closed', description: "Surfaced the July deadline but didn't ask what happens to the team if they go into their busiest period without solving this.", suggestion: "Ask: 'What happens to your Q3 numbers if your bottom 80% are still inconsistent going into July?' — this makes the timeline non-negotiable." },
    ],
    aiFeedback: JSON.stringify({
      overallFeedback: 'Efficient BANT qualification with excellent authority mapping and need discovery. You opened with a diagnostic question that immediately revealed the core problem — and let Priya articulate it. The only gap is timeline urgency: you surfaced the deadline but didn\'t make the cost of missing it visceral.',
      strengths: [
        'Opened with a diagnostic question that immediately surfaced the top-20% problem',
        'Let Priya identify the teaching gap herself — never projected or assumed',
        'Surfaced budget threshold and decision authority in the same exchange',
        'Confirmed implementation feasibility against her timeline proactively',
      ],
      improvements: [
        "Close the urgency loop: 'What happens to your Q3 numbers if the bottom 80% are still inconsistent going into July?'",
        'Ask about what she\'s already tried with other tools — "haven\'t committed" suggests evaluation history worth understanding',
        'Offer a social proof reference at the close — "a similar team went from 60% concentration to 45% in one quarter"',
      ],
      proTip: "The top-20% problem is an identity threat for a Head of Sales — she can't admit to her CRO that 80% of her team underperforms. Use that: 'What does it say about team culture if your best reps can't teach others what they know?'",
      scorecardGroups: [
        {
          group: 'Opener',
          maxPoints: 2, earnedPoints: 2,
          criteria: [
            { question: 'Permission-based opener?', passed: true, reasoning: "Said 'quick question' at 0:05 — minimal friction, prospect-first." },
            { question: 'Used research on prospect?', passed: true, reasoning: 'Top-20% framing shows knowledge of common sales team dynamics — relevant to any Head of Sales.' },
          ],
        },
        {
          group: 'Discovery',
          maxPoints: 1, earnedPoints: 1,
          criteria: [
            { question: 'SDR asked for preconceptions of product?', passed: true, reasoning: 'Asked about current approach (call shadowing) at 1:12 before presenting any solution.' },
          ],
        },
        {
          group: 'Social Proof',
          maxPoints: 2, earnedPoints: 1,
          criteria: [
            { question: 'Provided social proof?', passed: false, reasoning: 'No customer reference cited — missed opportunity to build credibility at the close.' },
            { question: 'Asked if social proof was relevant?', passed: true, reasoning: 'By asking about current tools at 1:12, rep checked relevance implicitly before proceeding.' },
          ],
        },
        {
          group: 'Closing',
          maxPoints: 2, earnedPoints: 2,
          criteria: [
            { question: 'Next steps agreed upon?', passed: true, reasoning: '30-minute meeting proposed and accepted at 3:15.' },
            { question: 'Follow-up meeting booked?', passed: true, reasoning: "Thursday meeting confirmed at 3:35 — calendar invite to follow." },
          ],
        },
      ],
    }),
  },
];

const MOCK_MEMBERS: TeamMemberSummary[] = [
  { id: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent', sessionCount: 3, avgScore: 82, sessionsThisWeek: 2 },
  { id: 'u2', firstName: 'Alex', lastName: 'Rivera', sessionCount: 18, avgScore: 88, sessionsThisWeek: 4 },
  { id: 'u3', firstName: 'Jordan', lastName: 'Kim', sessionCount: 14, avgScore: 79, sessionsThisWeek: 3 },
  { id: 'u4', firstName: 'Taylor', lastName: 'Brooks', sessionCount: 9, avgScore: 74, sessionsThisWeek: 1 },
  { id: 'u5', firstName: 'Morgan', lastName: 'Lee', sessionCount: 6, avgScore: 68, sessionsThisWeek: 0 },
  { id: 'u6', firstName: 'Casey', lastName: 'Park', sessionCount: 4, avgScore: 71, sessionsThisWeek: 0 },
];

const FRAMEWORK_STATS: DashboardFrameworkStat[] = [
  { component: 'Metrics', avgScore: 83, count: 12 },
  { component: 'Economic Buyer', avgScore: 77, count: 12 },
  { component: 'Decision Criteria', avgScore: 71, count: 12 },
  { component: 'Decision Process', avgScore: 68, count: 12 },
  { component: 'Identify Pain', avgScore: 85, count: 12 },
  { component: 'Champion', avgScore: 74, count: 12 },
];

function recentSessionsFromMock(): DashboardRecentSession[] {
  return MOCK_SESSIONS.map(s => ({
    id: s.id,
    endedAt: s.endedAt,
    durationSeconds: s.durationSeconds,
    framework: s.framework,
    sessionType: s.type,
    personaName: s.persona?.name ?? 'Unknown',
    personaEmoji: s.persona?.emoji ?? '🎭',
    userFirstName: s.user?.firstName ?? '',
    userLastName: s.user?.lastName ?? '',
    totalScore: s.totalScore,
  }));
}

function delay<T>(val: T, ms = 300): Promise<T> {
  return new Promise(res => setTimeout(() => res(val), ms));
}

// ── Sessions API ──────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: async (_params?: Record<string, unknown>) =>
    delay({ sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }),
  listAll: async (_params?: Record<string, unknown>) =>
    delay({ sessions: MOCK_SESSIONS, total: MOCK_SESSIONS.length }),
  getPeerScores: async (_sessionId: string) => delay([] as { userId: string; name: string; score: number; rank: number }[]),
  create: async (payload: { type: string; framework: string; personaId?: string; scenarioConfig?: unknown }) => {
    const newSession: Session = {
      id: `s-${Date.now()}`,
      type: payload.type as Session['type'],
      status: 'PENDING',
      framework: payload.framework as Session['framework'],
      createdAt: new Date().toISOString(),
    };
    return delay(newSession);
  },
  get: async (id: string) => {
    const s = MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0];
    return delay({ ...s, id });
  },
  start: async (_id: string) => delay({ status: 'IN_PROGRESS' }),
  end: async (id: string, _payload?: unknown) => {
    const s = MOCK_SESSIONS.find(s => s.id === id) ?? MOCK_SESSIONS[0];
    return delay({ ...s, status: 'COMPLETED' as Session['status'] });
  },
  addMessage: async (_id: string, _payload: unknown) => delay({}),
  getAIResponse: async (_id: string, _userMessage: string) =>
    delay({ response: "That's a great point. Can you tell me more about your current process and where the biggest pain points are?" }),
  share: async (_id: string) => delay({ shareUrl: `${window.location.origin}/sessions/shared` }),
};

// ── Personas API ──────────────────────────────────────────────────────────────

const LS_PERSONAS = 'pitchiq-personas';

function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(LS_PERSONAS);
    return raw ? JSON.parse(raw) : MOCK_PERSONAS;
  } catch { return MOCK_PERSONAS; }
}

function savePersonas(personas: Persona[]) {
  localStorage.setItem(LS_PERSONAS, JSON.stringify(personas));
}

export const personasApi = {
  list: async () => delay(loadPersonas()),
  create: async (payload: Partial<Persona>) => {
    const personas = loadPersonas();
    const newP: Persona = { ...payload, id: `p-${Date.now()}`, isPreset: false } as Persona;
    savePersonas([...personas, newP]);
    return delay(newP);
  },
  update: async (id: string, payload: Partial<Persona>) => {
    const personas = loadPersonas().map(p => p.id === id ? { ...p, ...payload } : p);
    savePersonas(personas);
    return delay(personas.find(p => p.id === id)!);
  },
  delete: async (id: string) => {
    savePersonas(loadPersonas().filter(p => p.id !== id));
    return delay(undefined as void);
  },
  clone: async (persona: Persona) => {
    const newP: Persona = { ...persona, id: `p-${Date.now()}`, name: `${persona.name} (Copy)`, isPreset: false };
    const personas = loadPersonas();
    savePersonas([...personas, newP]);
    return delay(newP);
  },
  getAnalytics: async (_id: string) =>
    delay({ usageCount: Math.floor(Math.random() * 20), avgScore: 75 + Math.floor(Math.random() * 20), lastUsed: new Date(Date.now() - 86400000).toISOString(), topUsers: [] }),
};

// ── Analytics API ─────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: async (): Promise<DashboardStats> => {
    const savedSession = localStorage.getItem('pitchiq-session');
    const role = savedSession ? JSON.parse(savedSession).user?.role : 'AGENT';

    const base: DashboardStats = {
      totalSessions: 44,
      avgScore: 79,
      activeUsers: 6,
      passRate: 77,
      recentSessions: recentSessionsFromMock(),
      frameworkStats: FRAMEWORK_STATS,
    };

    if (role === 'AGENT') {
      return delay({
        ...base,
        totalSessions: 3,
        agentExtra: { sessionsThisWeek: 2, streak: 3, rank: 2 },
      });
    }
    if (role === 'MANAGER') {
      return delay({
        ...base,
        managerExtra: { teamSize: MOCK_MEMBERS.length, members: MOCK_MEMBERS },
      });
    }
    return delay({
      ...base,
      managerExtra: { teamSize: MOCK_MEMBERS.length, members: MOCK_MEMBERS },
    });
  },

  leaderboard: async (_period?: string): Promise<LeaderboardEntry[]> =>
    delay(
      [...MOCK_MEMBERS]
        .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
        .map((m, i) => ({
          rank: i + 1,
          user: { id: m.id, firstName: m.firstName, lastName: m.lastName },
          avgScore: m.avgScore ?? 0,
          sessionCount: m.sessionCount,
        }))
    ),
};

// ── Users API ─────────────────────────────────────────────────────────────────

const LS_USERS = 'pitchiq-users';

function loadUsers(): User[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return MOCK_MEMBERS.map(m => ({
    id: m.id,
    email: `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase()}@demo.com`,
    firstName: m.firstName,
    lastName: m.lastName,
    role: 'AGENT' as const,
    companyId: DEMO_COMPANY_ID,
    isActive: true,
    avgScore: m.avgScore,
    sessionCount: m.sessionCount,
  }));
}

export const usersApi = {
  list: async () => delay(loadUsers()),
  invite: async (payload: Partial<User> & { password?: string }) => {
    const users = loadUsers();
    const newUser: User = {
      id: `u-${Date.now()}`,
      email: payload.email ?? '',
      firstName: payload.firstName ?? '',
      lastName: payload.lastName ?? '',
      role: payload.role ?? 'AGENT',
      companyId: DEMO_COMPANY_ID,
      isActive: true,
    };
    localStorage.setItem(LS_USERS, JSON.stringify([...users, newUser]));
    return delay({ user: newUser, tempPassword: 'TempPass123!' });
  },
  update: async (id: string, payload: Partial<User>) => {
    const users = loadUsers().map(u => u.id === id ? { ...u, ...payload } : u);
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    return delay(users.find(u => u.id === id)!);
  },
  stats: async (_id: string) => delay({ sessionCount: 3, avgScore: 79 }),
  resetPassword: async (_id: string) => delay({ tempPassword: 'TempPass123!' }),
};

// ── Superadmin API ────────────────────────────────────────────────────────────

const MOCK_COMPANIES: CompanyDetail[] = [
  {
    id: DEMO_COMPANY_ID, name: 'Demo Company', slug: 'demo', defaultFramework: 'MEDDIC',
    passThreshold: 70, isActive: true, industry: 'Technology',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    agentCount: 6, adminCount: 1, totalSessions: 44,
    admins: [{ id: '10000000-0000-0000-0000-000000000002', email: 'admin@demo.com', firstName: 'Company', lastName: 'Admin', isActive: true }],
  },
  {
    id: 'c2', name: 'Acme Sales Co', slug: 'acme', defaultFramework: 'SPIN',
    passThreshold: 65, isActive: true, industry: 'Manufacturing',
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    agentCount: 12, adminCount: 2, totalSessions: 127,
    admins: [],
  },
  {
    id: 'c3', name: 'FinPro Partners', slug: 'finpro', defaultFramework: 'BANT',
    passThreshold: 75, isActive: true, industry: 'Financial Services',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    agentCount: 8, adminCount: 1, totalSessions: 89,
    admins: [],
  },
];

const LS_COMPANIES = 'pitchiq-companies';

function loadCompanies(): CompanyDetail[] {
  try {
    const raw = localStorage.getItem(LS_COMPANIES);
    return raw ? JSON.parse(raw) : MOCK_COMPANIES;
  } catch { return MOCK_COMPANIES; }
}

export const superadminApi = {
  setup: async (_payload: unknown) => delay({}),
  getStats: async () => delay({
    totalCompanies: 3, activeCompanies: 3,
    totalUsers: 26, totalSessions: 260, activeUsersThisMonth: 18,
  }),
  listCompanies: async () => delay(loadCompanies()),
  createCompany: async (payload: Partial<CompanyDetail> & { adminEmail?: string; adminFirstName?: string; adminLastName?: string }) => {
    const companies = loadCompanies();
    const newCo: CompanyDetail = {
      id: `c-${Date.now()}`,
      name: payload.name ?? 'New Company',
      slug: payload.slug ?? `co-${Date.now()}`,
      defaultFramework: payload.defaultFramework ?? 'MEDDIC',
      passThreshold: payload.passThreshold ?? 70,
      isActive: true,
      industry: payload.industry,
      createdAt: new Date().toISOString(),
      agentCount: 0, adminCount: payload.adminEmail ? 1 : 0, totalSessions: 0,
      admins: payload.adminEmail ? [{ id: `a-${Date.now()}`, email: payload.adminEmail, firstName: payload.adminFirstName ?? '', lastName: payload.adminLastName ?? '', isActive: true }] : [],
    };
    localStorage.setItem(LS_COMPANIES, JSON.stringify([...companies, newCo]));
    return delay({ ...newCo, tempPassword: 'TempPass123!', adminEmail: payload.adminEmail });
  },
  getCompany: async (id: string) => {
    const co = loadCompanies().find(c => c.id === id) ?? MOCK_COMPANIES[0];
    return delay({ ...co, id });
  },
  updateCompany: async (id: string, payload: Partial<CompanyDetail>) => {
    const companies = loadCompanies().map(c => c.id === id ? { ...c, ...payload } : c);
    localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));
    return delay(companies.find(c => c.id === id)!);
  },
  getCompanyUsers: async (_id: string) => delay(loadUsers()),
  updateCompanyUser: async (_companyId: string, userId: string, payload: Partial<User>) => {
    const users = loadUsers().map(u => u.id === userId ? { ...u, ...payload } : u);
    localStorage.setItem(LS_USERS, JSON.stringify(users));
    return delay(users.find(u => u.id === userId));
  },
  syncPersonaAgents: async () => delay({ synced: 0, results: [] as { name: string; agentId: string | null; status: string }[] }),
};

// ── Voice API ─────────────────────────────────────────────────────────────────

export interface AgentConfig {
  name?: string;
  conversation_config?: {
    agent?: { prompt?: { prompt?: string; llm?: string; temperature?: number }; first_message?: string; language?: string };
    tts?: { voice_id?: string; model_id?: string };
  };
}

export interface AgentSummary {
  agent_id: string;
  name: string;
  created_at_unix_secs?: number;
}

export const voiceApi = {
  getSignedUrl: async (_personaId?: string): Promise<string> => delay(''),
  getTTSUrl: (_voiceId: string) => `/api/voice/tts/${_voiceId}`,
  listVoices: async () => delay([] as { voice_id: string; name: string }[]),
  health: async () => delay({ ttsAvailable: false, convaiAvailable: false, agentConfigured: false, issues: ['No backend connected — demo mode'] }),
  listAgents: async () => delay([] as AgentSummary[]),
  getAgent: async (_agentId: string) => delay({}),
  createAgent: async (_payload: AgentConfig) => delay({ agent_id: '' }),
  updateAgent: async (_agentId: string, _payload: AgentConfig) => delay({}),
  deleteAgent: async (_agentId: string) => delay(undefined as void),
};

// ── Practice API ──────────────────────────────────────────────────────────────

export const practiceApi = {
  generateScenario: async (_payload: unknown) => delay({
    displayName: 'Custom Scenario',
    displayTitle: 'Prospect',
    displayEmoji: '🎯',
    difficulty: 'MEDIUM',
    personaContext: 'A mid-market prospect evaluating your solution.',
    suggestedQuestions: ['What are your biggest pain points today?', 'What does success look like?'],
  }),
  generateQuestions: async (_payload: unknown) => delay({
    questions: ['What is your current process?', 'Where do you see the biggest inefficiency?', 'What would an ideal solution look like?'],
  }),
};

// ── Team Roleplays API ────────────────────────────────────────────────────────

const LS_ROLEPLAYS = 'pitchiq-roleplays';

const DEMO_USER_ID  = '10000000-0000-0000-0000-000000000004'; // agent (me)
const ADMIN_USER_ID = '10000000-0000-0000-0000-000000000002'; // company admin (manager)

const SEED_ROLEPLAYS: TeamRoleplay[] = [
  // ── Assigned to me (createdById = admin / manager) ────────────────────────
  {
    id: 'seed-tr-1',
    name: 'Enterprise SaaS Discovery',
    description: 'Practice uncovering pain, budget, and decision process with a skeptical VP of Sales.',
    isActive: true,
    createdById: ADMIN_USER_ID,
    createdBy: { id: ADMIN_USER_ID, firstName: 'Jamie', lastName: 'Scott' },
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    completionCount: 14,
    assignmentTarget: { scope: 'all' },
    scenarioConfig: {
      industry: 'SaaS', roleplayType: 'Discovery Call', difficulty: 'Hard',
      sessionType: 'ONLINE_MEETING',
      displayName: 'Sarah Mitchell', displayTitle: 'VP of Sales, NovaCorp', displayEmoji: '',
      avatarId: 'sarah',
      personaContext: 'You are the VP of Sales at NovaCorp, a 300-person SaaS company.',
      suggestedQuestions: ['Why should we switch?', 'What ROI have others achieved?'],
      objections: ['We already use Gong', 'Budget is frozen until Q3'],
      timeLimitMins: 5,
    },
  },
  {
    id: 'seed-tr-2',
    name: 'CFO Price Objection Drill',
    description: 'Handle a tough CFO who leads with cost objections and demands ROI evidence.',
    isActive: true,
    createdById: ADMIN_USER_ID,
    createdBy: { id: ADMIN_USER_ID, firstName: 'Jamie', lastName: 'Scott' },
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    completionCount: 9,
    assignmentTarget: { scope: 'all' },
    scenarioConfig: {
      industry: 'Banking', roleplayType: 'Objection Handling', difficulty: 'Expert',
      sessionType: 'PHONE_CALL',
      displayName: 'Marcus Johnson', displayTitle: 'CFO, RetailCo', displayEmoji: '',
      avatarId: 'marcus',
      personaContext: 'You are the CFO of RetailCo. You focus on financial impact and risk.',
      suggestedQuestions: ['What is the TCO?', 'What does payback period look like?'],
      objections: ['Your competitor is 30% cheaper', 'We need to see ROI first', 'Budget is allocated'],
      timeLimitMins: 4,
    },
  },
  {
    id: 'seed-tr-3',
    name: 'Healthcare Compliance Discovery',
    description: 'Navigate a CMO who is deeply focused on HIPAA compliance and EHR integration.',
    isActive: true,
    createdById: ADMIN_USER_ID,
    createdBy: { id: ADMIN_USER_ID, firstName: 'Jamie', lastName: 'Scott' },
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    completionCount: 6,
    assignmentTarget: { scope: 'all' },
    scenarioConfig: {
      industry: 'Healthcare', roleplayType: 'Discovery Call', difficulty: 'Medium',
      sessionType: 'ONLINE_MEETING',
      displayName: 'Dr. Elena Reyes', displayTitle: 'CMO, Regional Health System', displayEmoji: '',
      avatarId: 'emma',
      personaContext: 'You are the CMO of a regional health system with 8 hospitals. Compliance is your top priority.',
      suggestedQuestions: ['How does your solution handle HIPAA?', 'What EHR systems do you integrate with?'],
      objections: ['We had a bad vendor experience last year', 'IT will block this if it\'s not HIPAA certified'],
      timeLimitMins: 5,
    },
  },
  {
    id: 'seed-tr-4',
    name: 'Cold Call — Fintech CRO',
    description: 'A 3-minute cold call with a FinTech CRO who hates unsolicited pitches.',
    isActive: true,
    createdById: ADMIN_USER_ID,
    createdBy: { id: ADMIN_USER_ID, firstName: 'Jamie', lastName: 'Scott' },
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    completionCount: 22,
    assignmentTarget: { scope: 'all' },
    scenarioConfig: {
      industry: 'FinTech', roleplayType: 'Cold Call', difficulty: 'Hard',
      sessionType: 'PHONE_CALL',
      displayName: 'Jordan Kim', displayTitle: 'CRO, FlexPay', displayEmoji: '',
      avatarId: 'jordan',
      personaContext: 'You are the CRO of a fast-growing FinTech startup. You are busy and skeptical of cold callers.',
      suggestedQuestions: ['How did you get my number?', 'Give me the 20-second version.'],
      objections: ['I have 3 similar vendors pitching me this week', 'Not the right time — end of quarter'],
      timeLimitMins: 3,
    },
  },

  // ── Created by me (createdById = DEMO_USER_ID) ────────────────────────────
  {
    id: 'seed-tr-5',
    name: 'My Account Expansion Script',
    description: 'Upsell from Growth to Enterprise plan with an existing customer who loves the product but hates paying more.',
    isActive: true,
    createdById: DEMO_USER_ID,
    createdBy: { id: DEMO_USER_ID, firstName: 'Demo', lastName: 'Agent' },
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    completionCount: 3,
    scenarioConfig: {
      industry: 'SaaS', roleplayType: 'Account Expansion', difficulty: 'Medium',
      sessionType: 'ONLINE_MEETING',
      displayName: 'Priya Kapoor', displayTitle: 'Head of Operations, ScaleUp Inc', displayEmoji: '',
      avatarId: 'priya',
      personaContext: 'You are the Head of Operations at a fast-growing startup on the Growth plan for 18 months.',
      suggestedQuestions: ['Show me utilization data', 'What\'s the ROI on the upgrade?'],
      objections: ['We already pay enough', 'Can we trial the new features first?'],
      timeLimitMins: 5,
    },
  },
  {
    id: 'seed-tr-6',
    name: 'Insurance Renewal — Tough CFO',
    description: 'Retain an insurance client whose premiums rose 12% with a competing broker offering lower rates.',
    isActive: true,
    createdById: DEMO_USER_ID,
    createdBy: { id: DEMO_USER_ID, firstName: 'Demo', lastName: 'Agent' },
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    completionCount: 1,
    scenarioConfig: {
      industry: 'Insurance', roleplayType: 'Negotiation', difficulty: 'Hard',
      sessionType: 'PHONE_CALL',
      displayName: 'Layla Hassan', displayTitle: 'CFO, MidWest Logistics', displayEmoji: '',
      avatarId: 'layla',
      personaContext: 'You are the CFO of a mid-size logistics company. Your premiums rose 12% and a competitor broker is pitching you.',
      suggestedQuestions: ['What savings can you show me?', 'Why should I stay?'],
      objections: ['The other broker is 15% cheaper', 'We\'ve been loyal for 5 years — where\'s our loyalty discount?'],
      timeLimitMins: 4,
    },
  },
];

function loadRoleplays(): TeamRoleplay[] {
  try {
    const raw = localStorage.getItem(LS_ROLEPLAYS);
    const stored: TeamRoleplay[] = raw ? JSON.parse(raw) : [];
    // Merge seed data with stored — stored items override seed items with same id
    const storedIds = new Set(stored.map(r => r.id));
    const seedOnly = SEED_ROLEPLAYS.filter(r => !storedIds.has(r.id));
    return [...seedOnly, ...stored];
  } catch { return SEED_ROLEPLAYS; }
}

export const teamRoleplaysApi = {
  list: async () => delay(loadRoleplays()),
  create: async (payload: Partial<TeamRoleplay>) => {
    const items = loadRoleplays();
    const newItem: TeamRoleplay = {
      id: `tr-${Date.now()}`,
      name: payload.name ?? 'New Roleplay',
      scenarioConfig: payload.scenarioConfig!,
      isActive: true,
      createdById: '10000000-0000-0000-0000-000000000002',
      createdBy: { id: '10000000-0000-0000-0000-000000000002', firstName: 'Company', lastName: 'Admin' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...payload,
    } as TeamRoleplay;
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify([...items, newItem]));
    return delay(newItem);
  },
  update: async (id: string, payload: Partial<TeamRoleplay>) => {
    const items = loadRoleplays().map(r => r.id === id ? { ...r, ...payload, updatedAt: new Date().toISOString() } : r);
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify(items));
    return delay(items.find(r => r.id === id)!);
  },
  delete: async (id: string) => {
    localStorage.setItem(LS_ROLEPLAYS, JSON.stringify(loadRoleplays().filter(r => r.id !== id)));
    return delay(undefined as void);
  },
  getTargetOptions: async () => delay({
    teams: ['Enterprise', 'SMB', 'SDR Team'],
    regions: ['EMEA', 'APAC', 'North America'],
    territories: ['East', 'West', 'Central'],
    users: loadUsers().map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, team: u.team, region: u.region })),
  }),
};

// ── Evaluation Prompts API ────────────────────────────────────────────────────

const MOCK_EVAL_PROMPTS: EvaluationPrompt[] = [
  {
    id: 'ep1', roleplayType: 'cold_call', displayName: 'Cold Call', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert SDR coach evaluating a cold call roleplay. Score each criterion 0 (not done) or 1 (done well), with a one-sentence evidence quote from the transcript.`,
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
          { question: 'SDR asked for preconceptions of product?', hint: 'Did the rep ask about current awareness or opinion of the product/category before pitching?' },
        ],
      },
      {
        group: 'Social Proof',
        criteria: [
          { question: 'Provided social proof?', hint: 'Cited a relevant customer reference, metric, or case study.' },
          { question: 'Asked if social proof was relevant?', hint: 'Checked whether the example resonated with this specific prospect.' },
        ],
      },
      {
        group: 'Takeaway',
        criteria: [
          { question: 'Re-confirmed that the time works for the prospect?', hint: 'Checked that timing still worked before closing.' },
          { question: 'Asked for success criteria for next call?', hint: 'Asked what a successful next call would look like for the prospect.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Next steps agreed upon?', hint: 'Both parties agreed on a clear next step.' },
          { question: 'Follow-up meeting booked?', hint: 'A specific date/time for a follow-up was confirmed.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep2', roleplayType: 'discovery_call', displayName: 'Discovery Call', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert AE coach evaluating a discovery call roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Introduction & Agenda',
        criteria: [
          { question: 'Did the seller discuss the agenda and ask for prospect\'s input?', hint: 'Set an agenda AND asked if the prospect wants to add anything.' },
          { question: 'Did the seller introduce an Upfront Contract?', hint: 'Established mutual expectations: what will happen and what the outcome will be.' },
        ],
      },
      {
        group: 'Pain & Metrics Discovery',
        criteria: [
          { question: 'Did the seller uncover specific pain points?', hint: 'At least one concrete, specific problem the prospect is experiencing.' },
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
        group: 'Customer Reference & Value Pyramid Discovery',
        criteria: [
          { question: 'Did the seller present a customer reference?', hint: 'Referenced a similar customer and their outcome.' },
          { question: 'Did the seller explore the prospect\'s goal-setting framework?', hint: 'Asked how the prospect measures success or sets targets.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Did the seller revisit the upfront contract and define next steps?', hint: 'Closed by referencing the start-of-call agreement and confirming concrete next steps.' },
          { question: 'Did the seller qualify out or in effectively?', hint: 'Reached a clear conclusion about whether this is a qualified opportunity.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep3', roleplayType: 'sales_pitch', displayName: 'Sales Pitch', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating a sales pitch roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Value Proposition',
        criteria: [
          { question: 'Was the value proposition clear and specific?', hint: 'Articulated what the product does and who it helps in concrete terms.' },
          { question: 'Was the pitch personalised to the prospect\'s situation?', hint: 'Referenced specific context or pain points of this prospect.' },
        ],
      },
      {
        group: 'Differentiation',
        criteria: [
          { question: 'Did the rep differentiate from competition?', hint: 'Explained what makes this solution different from alternatives.' },
          { question: 'Was a customer story or case study used?', hint: 'Backed claims with a real customer outcome.' },
        ],
      },
      {
        group: 'ROI & Business Case',
        criteria: [
          { question: 'Was ROI or business value quantified?', hint: 'Provided a number, time saving, or cost reduction estimate.' },
        ],
      },
      {
        group: 'Objection Handling',
        criteria: [
          { question: 'Were objections handled effectively?', hint: 'Acknowledged, explored, and reframed at least one objection.' },
          { question: 'Was momentum maintained after objections?', hint: 'Returned to the pitch without losing energy after handling pushback.' },
        ],
      },
      {
        group: 'Closing',
        criteria: [
          { question: 'Was a clear next step defined?', hint: 'Both parties agreed on a specific next action.' },
          { question: 'Was urgency or a reason to act now established?', hint: 'Gave a compelling reason to move forward now vs. later.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep4', roleplayType: 'objection_handling', displayName: 'Objection Handling', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating an objection handling roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Acknowledgement',
        criteria: [
          { question: 'Did the rep acknowledge the objection without defending?', hint: 'Showed they heard the concern before responding.' },
          { question: 'Did the rep explore the root cause with a question?', hint: 'Asked a clarifying question to understand the objection deeper.' },
        ],
      },
      {
        group: 'Response',
        criteria: [
          { question: 'Did the rep provide relevant evidence or reframe?', hint: 'Used a customer story, data point, or reframe to address the concern.' },
          { question: 'Did the rep confirm the objection was resolved?', hint: 'Checked: "Does that make sense?" or similar before moving on.' },
        ],
      },
      {
        group: 'Momentum',
        criteria: [
          { question: 'Did the rep maintain momentum toward the next step?', hint: 'Transitioned back to the opportunity without losing energy.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep5', roleplayType: 'negotiation', displayName: 'Negotiation', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert sales coach evaluating a negotiation roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Anchoring',
        criteria: [
          { question: 'Did the rep anchor high before conceding?', hint: 'Opened at full price/terms before negotiating.' },
          { question: 'Did the rep trade concessions (not give without getting)?', hint: 'Every concession was paired with a request for something in return.' },
        ],
      },
      {
        group: 'Value Protection',
        criteria: [
          { question: 'Did the rep protect margin and core terms?', hint: 'Avoided discounting on price without moving something else (scope, timeline, terms).' },
          { question: 'Did the rep use value justification before conceding?', hint: 'Re-stated ROI or business case before offering any flexibility.' },
        ],
      },
      {
        group: 'Outcome',
        criteria: [
          { question: 'Was a mutually agreed outcome reached?', hint: 'Both parties aligned on a specific deal or next step.' },
          { question: 'Was the relationship maintained throughout?', hint: 'Tone remained collaborative, not adversarial.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep6', roleplayType: 'account_expansion', displayName: 'Account Expansion', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert CSM/AE coach evaluating an account expansion roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Relationship & Context',
        criteria: [
          { question: 'Did the rep reference the existing relationship and past wins?', hint: 'Opened by acknowledging what\'s already been achieved together.' },
          { question: 'Did the rep identify a new business need or expansion trigger?', hint: 'Surfaced a specific new problem, team, or use case not yet solved.' },
        ],
      },
      {
        group: 'Expansion Discovery',
        criteria: [
          { question: 'Did the rep map to additional stakeholders?', hint: 'Identified or asked about other decision-makers or teams that could benefit.' },
          { question: 'Did the rep present an expansion business case with ROI?', hint: 'Showed the financial or operational value of the expanded solution.' },
        ],
      },
      {
        group: 'Next Steps',
        criteria: [
          { question: 'Was a clear next step for the expansion defined?', hint: 'Agreed on a specific action to advance the expansion conversation.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'ep7', roleplayType: 'customer_support', displayName: 'Customer Support', isActive: true,
    companyId: DEMO_COMPANY_ID,
    promptTemplate: `You are an expert customer success coach evaluating a customer support roleplay. Score each criterion 0 or 1 with one-sentence transcript evidence.`,
    scoringCriteria: [
      {
        group: 'Empathy & Acknowledgement',
        criteria: [
          { question: 'Did the rep acknowledge the customer\'s frustration?', hint: 'Validated the customer\'s feelings before problem-solving.' },
          { question: 'Did the rep apologise or take ownership appropriately?', hint: 'Took responsibility without over-promising or deflecting.' },
        ],
      },
      {
        group: 'Problem Resolution',
        criteria: [
          { question: 'Did the rep ask clarifying questions to understand the issue?', hint: 'Gathered enough detail before proposing a solution.' },
          { question: 'Was a clear resolution or next step provided?', hint: 'Customer left knowing exactly what happens next.' },
        ],
      },
      {
        group: 'Experience & Retention',
        criteria: [
          { question: 'Did the rep confirm customer satisfaction before closing?', hint: 'Asked if the resolution met the customer\'s needs.' },
          { question: 'Did the rep look for an opportunity to add value or expand?', hint: 'Mentioned a related feature, resource, or upsell where appropriate.' },
        ],
      },
    ],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];

const LS_EVAL = 'pitchiq-eval-prompts';
const EVAL_VERSION = 'v3'; // bump to force-refresh cached rubrics

function loadEvalPrompts(): EvaluationPrompt[] {
  try {
    const version = localStorage.getItem(LS_EVAL + '-version');
    if (version !== EVAL_VERSION) {
      localStorage.removeItem(LS_EVAL);
      localStorage.setItem(LS_EVAL + '-version', EVAL_VERSION);
    }
    const raw = localStorage.getItem(LS_EVAL);
    return raw ? JSON.parse(raw) : MOCK_EVAL_PROMPTS;
  } catch { return MOCK_EVAL_PROMPTS; }
}

export const evaluationPromptsApi = {
  list: async () => delay(loadEvalPrompts()),
  get: async (roleplayType: string) => delay(loadEvalPrompts().find(e => e.roleplayType === roleplayType) ?? null),
  update: async (id: string, payload: Partial<EvaluationPrompt>) => {
    const items = loadEvalPrompts().map(e => e.id === id ? { ...e, ...payload, updatedAt: new Date().toISOString() } : e);
    localStorage.setItem(LS_EVAL, JSON.stringify(items));
    return delay(items.find(e => e.id === id)!);
  },
};

// ── Peer Sessions API ─────────────────────────────────────────────────────────

export const peerSessionsApi = {
  list: async (_sessionId: string) => delay([] as PeerSession[]),
};

// ── Usage / Cost API ──────────────────────────────────────────────────────────

export interface UsageSummary {
  period: { days: number; since: string };
  totals: { totalCostUsd: number; geminiPromptTokens: number; geminiOutputTokens: number; ttsCharacters: number; convaiMinutes: number; callCount: number; requestCount: number };
  byService: { _id: string; costUsd: number; requestCount: number }[];
  dailyTrend: { _id: string; costUsd: number; sessions: number }[];
  recent: { service: string; operation: string; model?: string; promptTokens?: number; completionTokens?: number; characters?: number; durationSeconds?: number; estimatedCostUsd: number; createdAt: string }[];
  pricing: { geminiInputPerMToken: number; geminiOutputPerMToken: number; ttsPerKChars: number; convaiPerMinute: number };
}

export interface UserUsageStat {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  sessions: number;
  callMinutes: number;
  tokensUsed: number;
  costUsd: number;
  // admin-set caps
  sessionCap: number | null;   // null = unlimited
  minutesCap: number | null;
  tokensCap: number | null;
}

export interface PlatformUsageSummary extends UsageSummary {
  // superadmin-only fields
  actualCostUsd: number;          // what we actually pay the APIs
  billedCostUsd: number;          // what we charge companies (plan pricing)
  marginUsd: number;
  marginPct: number;
  byCompany: { companyId: string; companyName: string; sessions: number; costUsd: number; billedUsd: number }[];
}

const LS_USER_CAPS = 'pitchiq-user-caps';

function loadUserCaps(): Record<string, { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null }> {
  try { return JSON.parse(localStorage.getItem(LS_USER_CAPS) || '{}'); } catch { return {}; }
}
function saveUserCaps(caps: Record<string, { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null }>) {
  localStorage.setItem(LS_USER_CAPS, JSON.stringify(caps));
}

// Generate stable daily trend for last N days
function makeDailyTrend(days: number) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400000);
    const seed = d.getDate() + d.getMonth();
    return {
      _id: d.toISOString().slice(0, 10),
      costUsd: +(0.05 + (seed % 7) * 0.04 + Math.sin(i * 0.6) * 0.03).toFixed(4),
      sessions: 1 + (seed % 5),
    };
  });
}

const MOCK_USER_USAGE: Omit<UserUsageStat, 'sessionCap' | 'minutesCap' | 'tokensCap'>[] = [
  { userId: '10000000-0000-0000-0000-000000000002', firstName: 'Company', lastName: 'Admin', email: 'admin@demo.com', role: 'COMPANY_ADMIN', sessions: 12, callMinutes: 48, tokensUsed: 24000, costUsd: 0.84 },
  { userId: '10000000-0000-0000-0000-000000000003', firstName: 'Demo', lastName: 'Manager', email: 'manager@demo.com', role: 'MANAGER', sessions: 8, callMinutes: 32, tokensUsed: 16000, costUsd: 0.56 },
  { userId: '10000000-0000-0000-0000-000000000004', firstName: 'Demo', lastName: 'Agent', email: 'agent@demo.com', role: 'AGENT', sessions: 24, callMinutes: 96, tokensUsed: 48000, costUsd: 1.68 },
  { userId: 'agent-002', firstName: 'Sarah', lastName: 'Chen', email: 'sarah@demo.com', role: 'AGENT', sessions: 18, callMinutes: 72, tokensUsed: 36000, costUsd: 1.26 },
  { userId: 'agent-003', firstName: 'Marcus', lastName: 'Lee', email: 'marcus@demo.com', role: 'AGENT', sessions: 6, callMinutes: 24, tokensUsed: 12000, costUsd: 0.42 },
  { userId: 'agent-004', firstName: 'Priya', lastName: 'Nair', email: 'priya@demo.com', role: 'AGENT', sessions: 3, callMinutes: 12, tokensUsed: 6000, costUsd: 0.21 },
];

export const usageApi = {
  getSummary: async (days = 30, _companyId?: string): Promise<UsageSummary> => delay({
    period: { days, since: new Date(Date.now() - days * 86400000).toISOString() },
    totals: { totalCostUsd: 4.97, geminiPromptTokens: 142000, geminiOutputTokens: 52000, ttsCharacters: 21000, convaiMinutes: 284, callCount: 71, requestCount: 142 },
    byService: [
      { _id: 'gemini', costUsd: 3.10, requestCount: 71 },
      { _id: 'elevenlabs_tts', costUsd: 0.95, requestCount: 71 },
      { _id: 'elevenlabs_convai', costUsd: 0.92, requestCount: 71 },
    ],
    dailyTrend: makeDailyTrend(days),
    recent: [],
    pricing: { geminiInputPerMToken: 0.35, geminiOutputPerMToken: 1.05, ttsPerKChars: 0.18, convaiPerMinute: 0.10 },
  }),

  getUserStats: async (_days = 30, _companyId?: string): Promise<UserUsageStat[]> => {
    const caps = loadUserCaps();
    return delay(MOCK_USER_USAGE.map(u => ({
      ...u,
      sessionCap: caps[u.userId]?.sessionCap ?? null,
      minutesCap: caps[u.userId]?.minutesCap ?? null,
      tokensCap:  caps[u.userId]?.tokensCap  ?? null,
    })));
  },

  updateUserCap: async (userId: string, caps: { sessionCap: number | null; minutesCap: number | null; tokensCap: number | null }): Promise<void> => {
    const all = loadUserCaps();
    all[userId] = caps;
    saveUserCaps(all);
    return delay(undefined);
  },

  getPlatformSummary: async (days = 30): Promise<PlatformUsageSummary> => {
    const base = await usageApi.getSummary(days);
    return delay({
      ...base,
      actualCostUsd: 4.97,
      billedCostUsd: 14.90,  // plan pricing charged to companies
      marginUsd: 9.93,
      marginPct: 66.6,
      byCompany: [
        { companyId: DEMO_COMPANY.id, companyName: 'Demo Company', sessions: 71, costUsd: 4.97, billedUsd: 14.90 },
        { companyId: 'comp-2', companyName: 'Acme Corp', sessions: 43, costUsd: 2.89, billedUsd: 8.70 },
        { companyId: 'comp-3', companyName: 'Nexus Sales', sessions: 29, costUsd: 1.94, billedUsd: 5.80 },
        { companyId: 'comp-4', companyName: 'TechFlow Inc', sessions: 12, costUsd: 0.76, billedUsd: 2.30 },
      ],
    });
  },
};

export const api = http;
