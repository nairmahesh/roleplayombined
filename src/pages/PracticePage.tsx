import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Phone, Monitor, Sparkles, Loader as Loader2, ChevronDown, ChevronUp, RefreshCw, Play, Plus, X, Settings, Info, Pencil, Trash2, ArrowLeft, BookOpen, Lock, Check, User, Layers, Globe, Database, FileText, ClipboardList, CircleCheck, Wand as Wand2 } from 'lucide-react';
import { practiceApi, sessionsApi, personasApi, teamRoleplaysApi, evaluationPromptsApi } from '@/lib/api';
import type { AssignmentScope, AssignmentTarget, EvaluationGroupDef } from '@/types';
import { Framework, SessionType, FRAMEWORK_INFO, ScenarioConfig, Persona, TeamRoleplay, KnowledgeBaseEntry } from '@/types';
import { CallInterface, PersonaDisplay } from '@/components/practice/CallInterface';
import { OnlineMeetingRoom } from '@/components/practice/OnlineMeetingRoom';
import { PersonaBuilder } from '@/components/practice/PersonaBuilder';
import { AvatarDisplay, EthnicityAvatarPicker, AVATAR_VOICE_CONFIG, AVATARS, type AvatarId } from '@/components/practice/PersonaAvatars';
import { VoicePickerModal } from '@/components/practice/VoicePickerModal';
import { CURATED_VOICES } from '@/components/practice/VoicePicker';
import { KnowledgeBaseEditor } from '@/components/practice/KnowledgeBaseEditor';
import { PreCallBriefing } from '@/components/practice/PreCallBriefing';
import { PlanGate } from '@/components/PlanGate';
import { useAuthStore, usePlanStore } from '@/lib/store';
import clsx from 'clsx';

// ── Static config ─────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'SaaS', 'Banking', 'Insurance', 'Healthcare',
  'Manufacturing', 'Retail', 'Consulting', 'Real Estate', 'Education',
];

const ROLEPLAY_TYPES = [
  'Sales Pitch', 'Cold Call', 'Discovery Call', 'Negotiation',
  'Customer Support', 'Interview', 'Leadership Conversation',
  'Conflict Resolution', 'Account Expansion', 'Objection Handling',
];

const LANGUAGES = [
  'English', 'Hindi', 'Spanish', 'French', 'German',
  'Portuguese', 'Arabic', 'Chinese', 'Japanese', 'Italian', 'Swahili',
];


const TEMPLATES: Array<ScenarioConfig & { id: string; label: string; avatarId: string; sessionType?: SessionType; userBriefing?: KnowledgeBaseEntry[]; botKnowledge?: KnowledgeBaseEntry[] }> = [
  {
    id: 't1', label: 'Enterprise CRM Pitch', avatarId: 'alex',
    industry: 'SaaS', roleplayType: 'Sales Pitch', displayEmoji: '',
    displayName: 'Alex Chen', displayTitle: 'Head of Sales, Accenture',
    difficulty: 'Hard', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      'Why should we switch from Salesforce?', 'What ROI have your existing clients achieved?',
      'How long does implementation take?', 'How disruptive will migration be for my team?',
      'How does your pricing compare to Salesforce?', 'What support do you provide post-sale?',
    ],
    personaContext: `You are the Head of Sales at Accenture, taking a pitch meeting with someone selling a CRM solution for your team. You agreed to this meeting but you are not an easy sell — you are analytical, ask pointed questions, and need to see clear ROI before considering any change.

Your current situation: You use Salesforce across your 200+ person sales org. While it works, you find it expensive, over-complex for your needs, and difficult to customize without expensive consultants. Switching CRMs is a massive undertaking and you're skeptical it's worth the disruption.

How to behave: Start by briefly welcoming the rep and asking them to walk you through their solution. Push back on vague claims — ask for specifics, case studies, and data. If impressed, express cautious interest and ask about next steps. Keep responses concise and businesslike.`,
  },
  {
    id: 't2', label: 'SaaS Cold Call', avatarId: 'james',
    industry: 'SaaS', roleplayType: 'Cold Call', displayEmoji: '',
    displayName: "James O'Brien", displayTitle: 'VP of Engineering, TechCorp',
    difficulty: 'Hard', sessionType: 'PHONE_CALL',
    suggestedQuestions: [
      'How did you get this number?', 'What makes you different from the 10 tools we already use?',
      "I'm busy — give me the 30-second version.", 'Do you have case studies from companies our size?',
      'What does implementation look like?', 'What does it cost?',
    ],
    personaContext: `You are the VP of Engineering at a 500-person SaaS company. You just received an unexpected cold call during a busy workday. You are polite but visibly impatient — you hate unsolicited calls and get them constantly.

Your current situation: Your engineering team uses a patchwork of tools and there's real pain around developer productivity tracking, but you haven't prioritized solving it. Budget is tight this quarter.

How to behave: Be initially dismissive and short. Give the caller 60 seconds. If they grab your attention with something specific and relevant, soften slightly. If the rep is generic, cut them off. If they're sharp, agree to a follow-up — nothing more.`,
  },
  {
    id: 't3', label: 'Healthcare Discovery Call', avatarId: 'sarah',
    industry: 'Healthcare', roleplayType: 'Discovery Call', displayEmoji: '',
    displayName: 'Sarah Mitchell', displayTitle: 'CMO, Regional Health System',
    difficulty: 'Medium', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      'How does your solution handle HIPAA compliance?', 'What EHR systems does this integrate with?',
      'What does the implementation timeline look like?', 'How have other health systems measured outcomes?',
      'Who typically champions this internally?', 'What does the pricing model look like for a system our size?',
    ],
    personaContext: `You are the Chief Medical Officer of a regional health system with 8 hospitals and 3,000 staff. You are cautiously open-minded but highly compliance-focused.

Your current situation: Clinical staff spends 40% of their time on documentation. Burnout is a serious problem. You've evaluated two vendors in the past 18 months but couldn't get IT and compliance aligned.

How to behave: Probe deeply on compliance, integration, and implementation risk. Ask about real case studies from comparable health systems. Be warmer than typical if the rep listens well and asks good discovery questions.`,
  },
  {
    id: 't4', label: 'Objection Handling — Price', avatarId: 'robert',
    industry: 'Consulting', roleplayType: 'Objection Handling', displayEmoji: '',
    displayName: 'Robert Hayes', displayTitle: 'Procurement Director, Global Corp',
    difficulty: 'Expert', sessionType: 'PHONE_CALL',
    suggestedQuestions: [
      "Your competitor is 30% cheaper — why should we pay more?",
      'Can you justify that price with concrete ROI data?',
      "We don't have budget approved for this quarter.",
      "What's the minimum we need to get started?",
      'Can you do a trial before we commit?',
      "What happens if we're not satisfied after 3 months?",
    ],
    personaContext: `You are the Procurement Director at a large global corporation evaluating a consulting services contract. You are a tough negotiator whose mandate is to reduce costs by 20% this fiscal year.

How to behave: Lead with price objections immediately. Push hard on discounts, payment terms, and scope reduction. If the rep caves immediately, lose respect for them. If they defend value confidently with data, acknowledge it grudgingly and ask about compromise structures.`,
  },
  {
    id: 't5', label: 'Banking Negotiation', avatarId: 'emma',
    industry: 'Banking', roleplayType: 'Negotiation', displayEmoji: '',
    displayName: 'Emma Wilson', displayTitle: 'Head of Treasury, First National Bank',
    difficulty: 'Hard', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      'What are your regulatory compliance certifications?', 'How does your risk model handle market volatility?',
      'What service SLAs can you commit to?', 'What does the integration with our core banking system look like?',
      'Who are your other tier-1 banking clients?', "What are the exit terms if things don't work out?",
    ],
    personaContext: `You are the Head of Treasury at a major regional bank negotiating terms for a new financial technology partnership. You are methodical, risk-averse, and focused on regulatory compliance and service reliability.

How to behave: Clarify key terms you need addressed: SLAs, regulatory compliance, data security, and exit clauses. Ask for specifics on every claim. Push for stronger SLAs and lower pricing. If the rep handles compliance questions confidently, warm up and discuss a phased rollout.`,
  },
  {
    id: 't6', label: 'Account Expansion', avatarId: 'priya',
    industry: 'SaaS', roleplayType: 'Account Expansion', displayEmoji: '',
    displayName: 'Priya Kapoor', displayTitle: 'Head of Operations, ScaleUp Inc',
    difficulty: 'Medium', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      "We're already paying for your product — why should we pay more?",
      "What value haven't we gotten from the current plan?",
      'Show me utilization data for what we have now.',
      "What's the ROI on the expanded package?",
      'Can we do a 30-day trial of the new features first?',
      "What's the discount for a multi-year commitment?",
    ],
    personaContext: `You are the Head of Operations at a fast-growing startup that has been using a SaaS platform for 18 months on the Growth plan. The rep is calling to discuss upgrading to Enterprise. You are satisfied with the product but cost-conscious.

How to behave: Be friendly — you have a good relationship. But be analytically skeptical about the upgrade. Ask to see data on how other similarly-sized companies use Enterprise features. Push back on pricing. Commit only if the business case is rock-solid.`,
  },
  {
    id: 't7', label: 'Insurance Cold Call', avatarId: 'layla',
    industry: 'Insurance', roleplayType: 'Cold Call', displayEmoji: '',
    displayName: 'Layla Hassan', displayTitle: 'CFO, MidWest Logistics',
    difficulty: 'Hard', sessionType: 'PHONE_CALL',
    suggestedQuestions: [
      'We already have a broker — why would we switch?',
      'What savings have you actually delivered for similar companies?',
      "I'm happy with our current coverage — what's missing?",
      'What makes your claims process faster?',
      'Can you give me a quote without a full audit first?',
      'What happens to our rates after the first year?',
    ],
    personaContext: `You are the CFO of a mid-size logistics company. You just received an unexpected call from an insurance broker. You are polite but guarded — you've been with your current broker for 5 years and see no urgent reason to change.

Your current situation: Your premiums went up 12% this year. You're quietly frustrated but haven't actively shopped around. A compelling cost argument or risk story could get your attention.

How to behave: Be initially dismissive. If the rep leads with cost savings and risk reduction specific to logistics, soften slightly. Ask sharp questions about claims handling and rate stability. Only agree to a follow-up meeting if they can demonstrate clear value.`,
  },
  {
    id: 't8', label: 'Real Estate Pitch', avatarId: 'carlos',
    industry: 'Real Estate', roleplayType: 'Sales Pitch', displayEmoji: '',
    displayName: 'Carlos Rivera', displayTitle: 'Head of Acquisitions, Apex Properties',
    difficulty: 'Medium', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      'What comparable deals have you closed in this market?',
      'How are you valuing this property — what assumptions are you making?',
      "We've seen similar properties at lower cap rates. Why the premium?",
      "What's your timeline to close?",
      'What are the financing terms?',
      'Have you had any other offers?',
    ],
    personaContext: `You are the Head of Acquisitions at a commercial real estate investment firm. You are evaluating a pitch for a mixed-use development opportunity in a competitive urban market. You are experienced, data-driven, and have seen dozens of deals fall apart on due diligence.

How to behave: Ask tough questions about valuation methodology, market comparables, and exit assumptions. Push back on optimistic projections. If the rep knows their numbers and handles your pushback with confidence, express measured interest and ask about exclusivity terms.`,
  },
  {
    id: 't9', label: 'HR / Talent Platform', avatarId: 'aisha',
    industry: 'Consulting', roleplayType: 'Discovery Call', displayEmoji: '',
    displayName: 'Aisha Brown', displayTitle: 'Chief People Officer, GrowthCo',
    difficulty: 'Easy', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      "We already use LinkedIn Recruiter — what does yours do differently?",
      'How does your platform reduce time-to-hire?',
      'Can it integrate with our existing ATS?',
      'What does onboarding look like?',
      'How do you handle candidate data privacy?',
      "We're a 200-person company — is this built for our scale?",
    ],
    personaContext: `You are the Chief People Officer at a fast-growing tech consultancy. You are on a discovery call with a talent acquisition platform vendor. You are genuinely open to new solutions — your current hiring process is slow and manual, and you're under pressure to scale the team.

Your current situation: Time-to-hire is averaging 67 days. The hiring manager experience is poor. Budget is available if the ROI story is solid.

How to behave: Be warm and engaged. Ask practical questions about implementation, integration, and measurable outcomes. Be receptive to demos and case studies. Agree to a follow-up if the rep listens well and addresses your specific pain points.`,
  },
  {
    id: 't10', label: 'Manufacturing Demo', avatarId: 'marcus',
    industry: 'Manufacturing', roleplayType: 'Sales Pitch', displayEmoji: '',
    displayName: 'Marcus Johnson', displayTitle: 'VP of Operations, PrecisionMfg',
    difficulty: 'Hard', sessionType: 'PHONE_CALL',
    suggestedQuestions: [
      'How does this integrate with our existing MES and ERP systems?',
      "We've tried automation before — it broke our line for 3 weeks. Why is this different?",
      "What's your uptime guarantee and SLA?",
      'What training is required for floor staff?',
      'Show me a real ROI case from a plant our size.',
      'What happens when something goes wrong on the line?',
    ],
    personaContext: `You are the VP of Operations at a precision manufacturing firm with 3 production facilities and 800 employees. You are evaluating an industrial automation and analytics platform. You are deeply skeptical of tech vendors who don't understand manufacturing realities.

Your current situation: Unplanned downtime is costing ~$180K/month. Your maintenance team is reactive, not predictive. You've been burned by a failed automation project 2 years ago and are cautious.

How to behave: Be gruff and direct. Challenge every claim with real-world edge cases. Demand specifics on integration complexity and downtime risk. If the rep demonstrates genuine manufacturing knowledge and credible ROI data, warm up gradually and ask about a pilot program.`,
  },
  {
    id: 't_demo_kb', label: 'FinTech Partnership Negotiation (Demo)', avatarId: 'emma',
    industry: 'Banking', roleplayType: 'Negotiation', displayEmoji: '',
    displayName: 'Emma Wilson', displayTitle: 'Head of Treasury, First National Bank',
    difficulty: 'Hard', sessionType: 'ONLINE_MEETING',
    suggestedQuestions: [
      "What's your uptime SLA and what's the compensation for breaches?",
      'How do you handle regulatory audits and data residency requirements?',
      'We need 99.99% availability — can you guarantee that contractually?',
      "What's your exit clause and data portability policy?",
      'Why should we choose you over an established banking software vendor?',
      'What does the 24-month pricing look like after the introductory rate expires?',
    ],
    personaContext: `You are the Head of Treasury at First National Bank, a regional bank with $14B in assets. You are in a negotiation meeting with a FinTech vendor who wants to power your new real-time payments infrastructure.

Your current situation: The bank's board has approved a digital transformation budget of $2.4M. You've shortlisted two vendors. This vendor has the better technology but is pushing for a 3-year contract with steep early-termination fees. Your legal team flagged concerns about data sovereignty and SLA enforcement.

How to behave: Be methodical and risk-averse. Clarify every contractual term. Push back firmly on pricing and lock-in. Ask for references from comparable banks. If the rep handles regulatory and SLA questions confidently, begin to warm up and explore partnership terms.`,
    userBriefing: [
      {
        id: 'kb-demo-1',
        label: 'First National Bank — Account Overview',
        type: 'text' as const,
        forRole: 'user' as const,
        createdAt: new Date().toISOString(),
        content: `FIRST NATIONAL BANK — ACCOUNT BRIEF

Assets Under Management: $14.2B
Headquarters: Chicago, IL
Employees: 2,400
Core Banking Platform: Fiserv Premier (legacy, 12 years old)
Annual IT Budget: $28M (18% allocated to transformation projects)

Key Pain Points:
• Real-time payment processing currently takes 4–6 hours (ACH batch)
• Fraud detection is rule-based, generating ~1,200 false positives/day
• Regulatory reporting takes 3 FTE-days per quarter to compile manually
• Mobile app NPS score: 34 (industry average: 52)

Decision Makers:
• Emma Wilson — Head of Treasury (primary contact, final sign-off)
• David Park — CTO (technical evaluation lead)
• Janet Reyes — Chief Compliance Officer (veto power on data/regulatory issues)
• Board approval required for contracts over $1.5M

Budget Confirmed: $2.4M approved for Year 1. Multi-year deals require board re-approval annually.

Competitor in Play: Temenos Payments Hub (shortlisted alongside us). Emma prefers our tech but Temenos has an existing relationship from a subsidiary project.`,
      },
      {
        id: 'kb-demo-2',
        label: 'Our Product — Key Capabilities & Differentiators',
        type: 'text' as const,
        forRole: 'user' as const,
        createdAt: new Date().toISOString(),
        content: `PITCHIQ PAYMENTS PLATFORM — PRODUCT BRIEF

Core Product: Real-Time Payments Infrastructure (ISO 20022 compliant)

Key Features:
• Sub-second payment processing (avg 340ms, 99th percentile < 1.2s)
• AI-powered fraud detection — reduces false positives by 73% vs rule-based systems
• Regulatory reporting: automated DFAST, BSA/AML, and Reg E reports
• Cloud-native: AWS GovCloud + Azure Government dual-deployment
• Open API (REST + webhooks) — integrates with Fiserv, Jack Henry, FIS core systems
• SOC 2 Type II certified, PCI DSS Level 1, FFIEC compliant

Pricing (for this deal):
• Year 1: $1.8M (implementation $400K + $1.4M platform license)
• Year 2–3: $1.2M/year platform license (15% discount locked in)
• Standard contract: 3-year term, 18-month early termination fee
• NEGOTIATION ROOM: Can offer 2-year term, reduce ETF to 6 months, add 99.95% SLA with 10% monthly credit for breaches

SLA: Standard 99.9% uptime. Can commit to 99.95% with credit provisions.
Data Residency: US-only deployment, data never leaves AWS us-east-1 / us-west-2.
References Available: Midwest Community Bank ($8B assets), Pacific Savings ($11B assets)`,
      },
      {
        id: 'kb-demo-3',
        label: 'Negotiation Strategy & Objection Handling Guide',
        type: 'text' as const,
        forRole: 'user' as const,
        createdAt: new Date().toISOString(),
        content: `NEGOTIATION BRIEF — FIRST NATIONAL BANK

YOUR GOAL: Close a 2-year minimum deal at $2.85M total value.

EMMA'S KNOWN CONCERNS (from discovery call notes):
1. Contract lock-in risk — she's been burned by a 5-year Fiserv contract she can't exit
2. SLA enforceability — wants financial penalties, not just "best efforts" language
3. Data sovereignty — CCO Janet Reyes specifically flagged EU data residency. Address: we are US-only.
4. Pricing post-Year-1 — fears "introductory rate" pricing that escalates
5. Temenos relationship — don't mention them; let her bring it up if she chooses

CONCESSIONS YOU CAN MAKE (in order — don't give these all at once):
• Shorten contract from 3 years to 2 years (use as opener if pushed)
• Reduce early termination fee from 18 months to 6 months of fees
• Add 99.95% SLA with 10% monthly credit for each 0.01% below threshold
• Include a 90-day pilot clause with a cap of $180K before full commitment
• Provide Midwest Community Bank reference call within 5 business days

DO NOT concede on:
• Year 1 pricing below $1.8M (margin floor)
• Implementation timeline under 6 months (realistic delivery risk)
• Unlimited liability clauses

KEY QUESTION TO ASK: "If we address the contract term and SLA concerns, what would the path to a decision look like on your end?"`,
      },
      {
        id: 'kb-demo-4',
        label: "Emma Wilson — LinkedIn & Background Research",
        type: 'text' as const,
        forRole: 'user' as const,
        createdAt: new Date().toISOString(),
        content: `EMMA WILSON — RESEARCH NOTES

LinkedIn: linkedin.com/in/emmawilson-treasury
Current Role: Head of Treasury, First National Bank (6 years)
Previous: VP Treasury Operations, JPMorgan Chase (8 years); Senior Analyst, Deloitte Financial Advisory (4 years)
Education: MBA, University of Chicago Booth School of Business; B.S. Finance, University of Michigan

Publications / Talks:
• Speaker at Bank Director Annual Conference 2023: "Real-Time Payments: Risk or Opportunity?"
• Co-authored FNB internal white paper: "Digital Transformation Governance Framework" (2022)

Personal Style (from discovery call):
• Very analytical — will fact-check claims in real time
• Values long-term partnerships over transactional deals
• Responds well to peer references ("what are banks like us actually doing")
• Dislikes high-pressure tactics; walked out of a vendor meeting last year for this reason
• Has a sense of humor — opens up when rapport is established

Tip: Reference her Bank Director talk early. She mentioned real-time payments being "the biggest risk and the biggest opportunity of the decade" — align your positioning to this framing.`,
      },
    ],
  },
];

// ── QuickLaunchTabs — tabbed context/knowledge/questions inside the launch modal ──

function QuickLaunchTabs({
  tabs,
  personaContext,
  userBriefing,
  suggestedQuestions,
}: {
  tabs: { id: string; label: string }[];
  personaContext: string;
  userBriefing: KnowledgeBaseEntry[];
  suggestedQuestions: string[];
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'context');
  const [expandedKb, setExpandedKb] = useState<string | null>(null);

  return (
    <div className="rounded-[12px] border border-white/[0.08] overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)' }}>
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.07]">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 px-3 py-2.5 text-[11.5px] font-semibold transition-all relative',
              activeTab === tab.id
                ? 'text-white'
                : 'text-white/40 hover:text-white/70'
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t" style={{ background: 'var(--accent)' }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content — max-height adapts: taller on mobile (more vertical room needed), shorter on desktop */}
      <div className="overflow-y-auto" style={{ maxHeight: 'min(45vh, 280px)' }}>
        {activeTab === 'context' && personaContext && (
          <p className="text-[12px] sm:text-[12.5px] text-white/80 leading-relaxed whitespace-pre-wrap p-3 sm:p-4 pr-2 sm:pr-3">{personaContext}</p>
        )}

        {activeTab === 'knowledge' && (
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {userBriefing.map((entry, i) => {
              const isOpen = expandedKb === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    onClick={() => setExpandedKb(isOpen ? null : entry.id)}
                    className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[10px] font-mono text-white/25 flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1 text-[12px] sm:text-[12.5px] font-medium text-white/80 truncate">{entry.label}</span>
                    <ChevronDown size={12} className={clsx('flex-shrink-0 text-white/30 transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="px-3 sm:px-4 pb-3 pt-0.5">
                      <p className="text-[11.5px] sm:text-[12px] text-white/65 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="flex flex-col gap-1.5 p-3 sm:p-4">
            {suggestedQuestions.map((q, i) => (
              <div key={i} className="flex items-start gap-2 px-2.5 sm:px-3 py-2 rounded-[9px] bg-white/[0.03] border border-white/[0.05]">
                <span className="text-[10px] font-mono text-white/25 flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[11.5px] sm:text-[12px] text-white/65 leading-snug">{q}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function pickFramework(roleplayType: string): Framework {
  const t = roleplayType.toLowerCase();
  if (t.includes('cold call') || t.includes('discovery')) return 'SPIN';
  if (t.includes('negotiation') || t.includes('objection')) return 'CHALLENGER';
  if (t.includes('account expansion')) return 'MEDDIC';
  if (t.includes('support') || t.includes('conflict') || t.includes('leadership')) return 'SNAP';
  if (t.includes('interview')) return 'BANT';
  return 'MEDDIC';
}

interface FrameworkRec {
  framework: Framework;
  reason: string;
  confidence: 'High' | 'Medium';
}

function recommendFramework(
  roleplayType: string,
  industry: string,
  difficulty: string,
  personaTitle: string,
): FrameworkRec {
  const t = roleplayType.toLowerCase();
  const i = industry.toLowerCase();
  const p = personaTitle.toLowerCase();

  // Cold Call
  if (t.includes('cold call')) return {
    framework: 'SPIN',
    reason: `Cold calls focus on uncovering pain quickly. SPIN's Situation → Problem → Implication → Need-Payoff sequence guides reps from rapport to urgency in under 5 minutes.`,
    confidence: 'High',
  };

  // Discovery
  if (t.includes('discovery')) return {
    framework: 'SPIN',
    reason: `Discovery calls are where SPIN shines — systematic questioning moves the prospect from describing their situation to feeling the full impact of their problem.`,
    confidence: 'High',
  };

  // Complex enterprise / VP / C-suite + negotiation/pitch
  if ((p.includes('vp') || p.includes('cro') || p.includes('ceo') || p.includes('chief') || p.includes('director')) &&
    (t.includes('pitch') || t.includes('discovery') || t.includes('expansion'))) return {
    framework: 'MEDDIC',
    reason: `Senior buyers require proof of economic impact and clear decision processes. MEDDIC ensures you map Metrics, the Economic Buyer, and Champion before pushing to close.`,
    confidence: 'High',
  };

  // Negotiation
  if (t.includes('negotiation')) return {
    framework: 'CHALLENGER',
    reason: `Negotiations reward reps who control the conversation with insight rather than concession. Challenger's Teach-Tailor-Take Control model keeps you from being commoditised on price.`,
    confidence: 'High',
  };

  // Pitching / Sales pitch
  if (t.includes('pitch') || t.includes('sales pitch')) {
    if (i.includes('saas') || i.includes('tech') || i.includes('software')) return {
      framework: 'MEDDIC',
      reason: `SaaS pitches involve multiple stakeholders and long cycles. MEDDIC aligns your pitch to measurable ROI and ensures you're talking to the Economic Buyer.`,
      confidence: 'High',
    };
    return {
      framework: 'CHALLENGER',
      reason: `Sales pitches benefit from the Challenger approach — teach the prospect something they don't know, then position your solution as the only logical answer.`,
      confidence: 'Medium',
    };
  }

  // Account expansion / upsell
  if (t.includes('expansion') || t.includes('upsell') || t.includes('renewal')) return {
    framework: 'MEDDICC',
    reason: `Expansion deals face internal competition from the status quo. MEDDICC adds Competition awareness on top of MEDDIC — critical when justifying incremental spend to existing buyers.`,
    confidence: 'High',
  };

  // Fast-cycle / transactional / startup / SMB
  if (difficulty.toLowerCase() === 'easy' || i.includes('retail') || i.includes('smb')) return {
    framework: 'BANT',
    reason: `For transactional or early-stage conversations, BANT quickly qualifies Budget, Authority, Need and Timeline — efficient when deal cycles are short.`,
    confidence: 'Medium',
  };

  // Customer support / leadership / HR
  if (t.includes('support') || t.includes('conflict') || t.includes('leadership') || t.includes('hr')) return {
    framework: 'SNAP',
    reason: `Non-sales conversations require empathy and alignment over pushing. SNAP keeps interactions Simple, Invaluable, Aligned and Priority-focused.`,
    confidence: 'High',
  };

  // Default
  return {
    framework: 'MEDDIC',
    reason: `MEDDIC is the gold standard for B2B sales. It ensures you qualify rigorously on Metrics, Economic Buyer, Decision Criteria, Process, Pain and Champion before advancing.`,
    confidence: 'Medium',
  };
}

interface FrameworkSelectorProps {
  framework: Framework;
  setFramework: (f: Framework) => void;
  roleplayType: string;
  industry: string;
  difficulty: string;
  personaTitle: string;
  compact?: boolean;
}

function FrameworkSelector({ framework, setFramework, roleplayType, industry, difficulty, personaTitle, compact }: FrameworkSelectorProps) {
  const [showRec, setShowRec] = useState(false);
  const hasContext = !!(roleplayType || industry || personaTitle);
  const rec = hasContext ? recommendFramework(roleplayType, industry, difficulty, personaTitle) : null;
  const recDiffers = rec && rec.framework !== framework;

  return (
    <div className="flex flex-col gap-2">
      {/* Label + AI button */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">Sales Framework</p>
        {hasContext && (
          <button
            onClick={() => setShowRec(v => !v)}
            className={clsx(
              'flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[9.5px] font-semibold border transition-all',
              showRec
                ? 'bg-accent/15 border-accent/40 text-accent'
                : recDiffers
                  ? 'bg-amber-400/10 border-amber-400/30 text-amber-400 hover:bg-amber-400/15'
                  : 'bg-accent/[0.07] border-accent/20 text-accent/70 hover:text-accent hover:bg-accent/10'
            )}
          >
            <Wand2 size={9} />
            AI Suggest
            {recDiffers && !showRec && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-0.5" />
            )}
          </button>
        )}
      </div>

      {/* Recommendation panel */}
      <AnimatePresence>
        {showRec && rec && (
          <motion.div
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-[10px] p-3 flex flex-col gap-2"
              style={{
                background: 'rgba(91,111,255,0.07)',
                border: '1px solid rgba(91,111,255,0.2)',
              }}
            >
              <div className="flex items-center gap-2">
                <Wand2 size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="text-[10.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                  AI recommends: {FRAMEWORK_INFO[rec.framework].label}
                </span>
                <span
                  className="ml-auto text-[8.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{
                    background: rec.confidence === 'High' ? 'rgba(6,214,160,0.12)' : 'rgba(255,209,102,0.12)',
                    color: rec.confidence === 'High' ? '#06D6A0' : '#FFD166',
                    border: `1px solid ${rec.confidence === 'High' ? 'rgba(6,214,160,0.25)' : 'rgba(255,209,102,0.25)'}`,
                  }}
                >
                  {rec.confidence} confidence
                </span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>{rec.reason}</p>
              <div className="flex gap-2 mt-0.5">
                {rec.framework !== framework && (
                  <button
                    onClick={() => { setFramework(rec.framework); setShowRec(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    <Check size={10} /> Use {FRAMEWORK_INFO[rec.framework].label}
                  </button>
                )}
                <button
                  onClick={() => setShowRec(false)}
                  className="px-3 py-1.5 rounded-[8px] text-[11px] font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text3)' }}
                >
                  {rec.framework === framework ? 'Good choice' : 'Keep current'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selector */}
      <div className="relative">
        <select
          value={framework}
          onChange={e => setFramework(e.target.value as Framework)}
          className={clsx('w-full appearance-none input-base font-medium pr-7 cursor-pointer', compact ? 'text-[12.5px]' : 'text-[13px]')}
          style={{ backgroundImage: 'none' }}
        >
          {rec && (
            <option key="ai-rec" value={rec.framework}>
              ✦ AI Recommended — {FRAMEWORK_INFO[rec.framework].label} ({rec.confidence} confidence)
            </option>
          )}
          {(Object.keys(FRAMEWORK_INFO) as Framework[]).map(f => (
            <option key={f} value={f}>
              {FRAMEWORK_INFO[f].label} — {FRAMEWORK_INFO[f].components.slice(0, 2).join(', ')}{FRAMEWORK_INFO[f].components.length > 2 ? '…' : ''}
            </option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
      </div>

      {/* Component pills */}
      <div className="flex flex-wrap gap-1">
        {FRAMEWORK_INFO[framework].components.map((c, i) => (
          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/[0.06] border border-accent/15 text-accent/70">{i + 1}. {c}</span>
        ))}
      </div>
    </div>
  );
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy:   'text-accent-3 bg-accent-3/10 border-accent-3/20',
  Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Hard:   'text-accent-4 bg-accent-4/10 border-accent-4/20',
  Expert: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

type GalleryTab = 'assigned' | 'mine' | 'library';
type SetupMode = 'view' | 'edit';

// ── Main component ────────────────────────────────────────────────────────────

export function PracticePage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  // ── View / navigation ──────────────────────────────────────────────────────
  const [view, setView]               = useState<'gallery' | 'setup'>('gallery');
  const [galleryTab, setGalleryTab]   = useState<GalleryTab>('assigned');
  const [setupMode, setSetupMode]     = useState<SetupMode>('view');
  const [currentStep, setCurrentStep] = useState(1);
  const stepDirection                 = useRef<1 | -1>(1); // for slide animation

  // ── Selected card metadata ─────────────────────────────────────────────────
  const [selectedLabel, setSelectedLabel]     = useState('');
  const [selectedDesc, setSelectedDesc]       = useState('');
  const [selectedCreator, setSelectedCreator] = useState('');

  // ── Persona fields ─────────────────────────────────────────────────────────
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | undefined>(undefined);
  const [avatarId, setAvatarId]                   = useState('alex');
  const [selectedVoiceId, setSelectedVoiceId]     = useState<string | undefined>(undefined);
  const [voiceOpen, setVoiceOpen]                 = useState(false);
  const [voiceModalOpen, setVoiceModalOpen]       = useState(false);
  const [displayName, setDisplayName]             = useState('Custom Persona');
  const [displayTitle, setDisplayTitle]           = useState('');
  const [displayEmoji, setDisplayEmoji]           = useState('');
  const [personaContext, setPersonaContext]        = useState('');
  const [difficulty, setDifficulty]               = useState('Medium');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showQuestions, setShowQuestions]         = useState(false);
  const [questionInput, setQuestionInput]         = useState('');
  // AI-generated staging: questions returned by AI before user picks them
  const [stagedQuestions, setStagedQuestions]     = useState<string[]>([]);

  // ── Context fields ─────────────────────────────────────────────────────────
  const [industry, setIndustry]         = useState('');
  const [roleplayType, setRoleplayType] = useState('');
  const [language, setLanguage]         = useState('English');
  const [objectionInput, setObjectionInput] = useState('');
  const [objections, setObjections]     = useState<string[]>([]);

  // ── Session settings ───────────────────────────────────────────────────────
  const [framework, setFramework]       = useState<Framework>('MEDDIC');
  const [sessionType, setSessionType]   = useState<SessionType>('PHONE_CALL');
  const [aiCanEnd, setAiCanEnd]         = useState(true);
  const [endCondition, setEndCondition] = useState('');
  const [timeLimitMins, setTimeLimitMins] = useState('3');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [evalRubric, setEvalRubric] = useState<EvaluationGroupDef[] | null>(null);
  const [showRubric, setShowRubric] = useState(false);

  // ── AI generate panel ──────────────────────────────────────────────────────
  const [aiKeywords, setAiKeywords]     = useState('');
  const [generating, setGenerating]     = useState(false);
  const [showAiPanel, setShowAiPanel]   = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);

  // ── Saved personas ─────────────────────────────────────────────────────────
  const [dbPersonas, setDbPersonas]     = useState<Persona[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [showBuilder, setShowBuilder]   = useState(false);

  // ── Team roleplays ─────────────────────────────────────────────────────────
  const [teamRoleplays, setTeamRoleplays]           = useState<TeamRoleplay[]>([]);
  const [loadingTeamRoleplays, setLoadingTeamRoleplays] = useState(true);
  const [activeTeamRoleplayId, setActiveTeamRoleplayId] = useState<string | null>(null);

  // ── Session launch ─────────────────────────────────────────────────────────
  const [starting, setStarting]     = useState(false);
  const [activeSession, setActiveSession] = useState<{
    id: string; personaDisplay: PersonaDisplay;
  } | null>(null);

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [showSaveDropdown, setShowSaveDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal]     = useState(false);
  const [saveRoleplayName, setSaveRoleplayName] = useState('');
  const [saveRoleplayDesc, setSaveRoleplayDesc] = useState('');
  const [savingRoleplay, setSavingRoleplay]   = useState(false);
  const [editingRoleplay, setEditingRoleplay] = useState<TeamRoleplay | null>(null);
  const [editName, setEditName]               = useState('');
  const [editDesc, setEditDesc]               = useState('');
  const [editSaving, setEditSaving]           = useState(false);
  const [quickLaunchData, setQuickLaunchData] = useState<{ label: string; desc: string } | null>(null);

  // ── Multi-persona mode ─────────────────────────────────────────────────────
  const [multiPersonaEnabled, setMultiPersonaEnabled] = useState(false);
  const [personaGroupName, setPersonaGroupName]       = useState('');
  type MultiAttendee = { id: string; name: string; title: string; avatarId: string; isHost: boolean };
  const [multiAttendees, setMultiAttendees]           = useState<MultiAttendee[]>([]);

  const addAttendeeFromCurrent = () => {
    if (!displayName || displayName === 'Custom Persona') return;
    const already = multiAttendees.some(a => a.name === displayName && a.title === displayTitle);
    if (already) return;
    setMultiAttendees(prev => [...prev, {
      id: `ma-${Date.now()}`,
      name: displayName,
      title: displayTitle,
      avatarId: avatarId,
      isHost: prev.length === 0,
    }]);
  };

  const removeAttendee = (id: string) => {
    setMultiAttendees(prev => {
      const next = prev.filter(a => a.id !== id);
      if (next.length > 0 && !next.some(a => a.isHost)) next[0].isHost = true;
      return next;
    });
  };

  // ── Assignment targeting ───────────────────────────────────────────────────
  const [assignScope, setAssignScope]         = useState<AssignmentScope>('all');
  const [assignRegions, setAssignRegions]     = useState<string[]>([]);
  const [assignTeams, setAssignTeams]         = useState<string[]>([]);
  const [assignUserIds, setAssignUserIds]     = useState<string[]>([]);
  const [allowPeerListening, setAllowPeerListening] = useState(true);
  const [targetOptions, setTargetOptions]     = useState<{
    regions: string[]; teams: string[]; territories: string[];
    users: { id: string; name: string; team?: string; region?: string }[];
  } | null>(null);

  const contextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoGenRef      = useRef('');

  // ── Knowledge base state ──────────────────────────────────────────────────
  const [botKnowledge, setBotKnowledge]     = useState<KnowledgeBaseEntry[]>([]);
  const [userBriefing, setUserBriefing]     = useState<KnowledgeBaseEntry[]>([]);
  const [kbEnabled, setKbEnabled]           = useState(true);
  const [botEnabled, setBotEnabled]         = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [botSectionOpen, setBotSectionOpen] = useState(true);
  const [briefingSectionOpen, setBriefingSectionOpen] = useState(true);
  const [showBriefing, setShowBriefing]     = useState(false);
  const [pendingSession, setPendingSession] = useState<{ id: string; personaDisplay: PersonaDisplay } | null>(null);

  const canKnowledgeBase = usePlanStore(s => s.can('knowledgeBase'));
  const canPreCallBriefing = usePlanStore(s => s.can('preCallBriefing'));

  const isManagerOrAdmin  = !!(user?.role && ['COMPANY_ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(user.role));
  const canCreatePersona  = isManagerOrAdmin;
  const myRoleplays       = teamRoleplays.filter(tr => tr.createdById === user?.id);
  const assignedRoleplays = teamRoleplays.filter(tr => tr.createdById !== user?.id);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    teamRoleplaysApi.list()
      .then(setTeamRoleplays)
      .catch(() => {})
      .finally(() => setLoadingTeamRoleplays(false));
  }, []);

  useEffect(() => {
    if (!personaContext.trim() || !roleplayType) return;
    if (contextTimerRef.current) clearTimeout(contextTimerRef.current);
    contextTimerRef.current = setTimeout(() => handleGenerateQuestions(false), 1500);
    return () => { if (contextTimerRef.current) clearTimeout(contextTimerRef.current); };
  }, [personaContext, roleplayType]);

  useEffect(() => {
    if (!roleplayType) return;
    setFramework(pickFramework(roleplayType));
    // Load matching evaluation rubric
    const typeKey = roleplayType.toLowerCase().replace(/\s+/g, '_');
    evaluationPromptsApi.get(typeKey).then(ep => {
      setEvalRubric(ep?.scoringCriteria ?? null);
    }).catch(() => setEvalRubric(null));
  }, [roleplayType]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const goToStep = (n: number) => {
    // When advancing from Context (1) to Persona (2) with a blank persona, auto-apply
    // the best matching template so the user lands on a pre-filled persona they can tweak.
    if (n === 2 && currentStep === 1 && !personaContext.trim()) {
      const match = TEMPLATES.find(t =>
        (!industry || t.industry === industry) &&
        (!roleplayType || t.roleplayType === roleplayType)
      );
      if (match) applyTemplate(match);
      else setAiKeywords([industry, roleplayType].filter(Boolean).join(' '));
    }
    stepDirection.current = n > currentStep ? 1 : -1;
    setCurrentStep(n);
  };

  const openSetup = (mode: SetupMode, label: string, desc: string, creator: string) => {
    setSetupMode(mode);
    setSelectedLabel(label);
    setSelectedDesc(desc);
    setSelectedCreator(creator);
    stepDirection.current = 1;
    setCurrentStep(1);
    setShowAdvanced(false);
    setShowAiPanel(false);
    setView('setup');
  };

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    setAvatarId(t.avatarId);
    setSelectedVoiceId(AVATAR_VOICE_CONFIG[t.avatarId as AvatarId]?.elevenlabsId ?? undefined);
    setDisplayName(t.displayName);
    setDisplayTitle(t.displayTitle);
    setDisplayEmoji(t.displayEmoji);
    setPersonaContext(t.personaContext);
    setDifficulty(t.difficulty);
    setSuggestedQuestions(t.suggestedQuestions);
    setShowQuestions(true);
    setIndustry(t.industry);
    setRoleplayType(t.roleplayType);
    setLanguage('English');
    setObjections([]);
    setAiCanEnd(true);
    setEndCondition('');
    setTimeLimitMins('3');
    if ((t as typeof TEMPLATES[number] & { sessionType?: SessionType }).sessionType) {
      setSessionType((t as typeof TEMPLATES[number] & { sessionType?: SessionType }).sessionType!);
    }
    setActiveTeamRoleplayId(null);
    setBotKnowledge(t.botKnowledge ?? []);
    setUserBriefing(t.userBriefing ?? []);
    autoGenRef.current = `${t.industry}::${t.roleplayType}`;
  };

  const applyTeamRoleplay = (tr: TeamRoleplay) => {
    const sc = tr.scenarioConfig;
    setAvatarId(sc.avatarId || 'alex');
    setSelectedVoiceId(sc.elevenlabsVoiceId ?? undefined);
    setDisplayName(sc.displayName);
    setDisplayTitle(sc.displayTitle);
    setDisplayEmoji(sc.displayEmoji);
    setPersonaContext(sc.personaContext);
    setDifficulty(sc.difficulty);
    setSuggestedQuestions(sc.suggestedQuestions);
    setShowQuestions(true);
    setIndustry(sc.industry);
    setRoleplayType(sc.roleplayType);
    setLanguage((sc as any).language || 'English');
    setObjections(sc.objections ?? []);
    setAiCanEnd(sc.aiCanEnd ?? true);
    setEndCondition(sc.endCondition ?? '');
    setTimeLimitMins(sc.timeLimitMins ? String(sc.timeLimitMins) : '3');
    if (sc.sessionType) setSessionType(sc.sessionType);
    setActiveTeamRoleplayId(tr.id);
    setBotKnowledge(sc.botKnowledge ?? []);
    setUserBriefing(sc.userBriefing ?? []);
    autoGenRef.current = `${sc.industry}::${sc.roleplayType}`;
  };

  const handleSelectAssigned = (tr: TeamRoleplay) => {
    applyTeamRoleplay(tr);
    setQuickLaunchData({ label: tr.name, desc: tr.description ?? '' });
  };

  const handleSelectTemplate = (t: typeof TEMPLATES[number]) => {
    applyTemplate(t);
    setQuickLaunchData({ label: t.label, desc: `${t.industry} · ${t.roleplayType}` });
  };

  const handleSelectMine = (tr: TeamRoleplay) => {
    applyTeamRoleplay(tr);
    setQuickLaunchData({ label: tr.name, desc: tr.description ?? '' });
  };

  const handleEditMine = (tr: TeamRoleplay) => {
    applyTeamRoleplay(tr);
    openSetup('edit', tr.name, tr.description ?? '', `${tr.createdBy.firstName} ${tr.createdBy.lastName}`);
  };

  const handleCreateNew = () => {
    setSelectedPersonaId(undefined);
    setAvatarId('alex');
    setSelectedVoiceId(AVATAR_VOICE_CONFIG['alex']?.elevenlabsId ?? undefined);
    setDisplayName('Custom Persona');
    setDisplayTitle('');
    setDisplayEmoji('🧑‍💼');
    setPersonaContext('');
    setDifficulty('Medium');
    setSuggestedQuestions([]);
    setStagedQuestions([]);
    setShowQuestions(false);
    setQuestionInput('');
    setIndustry('');
    setRoleplayType('');
    setLanguage('English');
    setObjections([]);
    setAiCanEnd(true);
    setEndCondition('');
    setTimeLimitMins('3');
    setActiveTeamRoleplayId(null);
    setBotKnowledge([]);
    setUserBriefing([]);
    autoGenRef.current = '';
    openSetup('edit', 'New Roleplay', '', '');
  };

  // ── API handlers ───────────────────────────────────────────────────────────

  const handleGenerateQuestions = async (showToast = true) => {
    if (!personaContext.trim() || !roleplayType) return;
    setGeneratingQuestions(true);
    try {
      const { questions } = await practiceApi.generateQuestions({ personaContext, roleplayType });
      // Stage them so user can pick which ones to keep
      setStagedQuestions(questions.filter((q: string) => !suggestedQuestions.includes(q)));
      setShowQuestions(true);
      if (showToast) toast.success(`${questions.length} questions generated — select to add`);
    } catch {
      if (showToast) toast.error('Failed to generate questions');
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const handleGenerateScenario = async () => {
    if (!aiKeywords.trim()) return toast.error('Enter keywords first');
    setGenerating(true);
    try {
      const result = await practiceApi.generateScenario({
        keywords: aiKeywords,
        industry: industry || 'SaaS',
        roleplayType: roleplayType || 'Sales Pitch',
      });
      setPersonaContext(result.personaContext);
      setDisplayName(result.displayName);
      setDisplayTitle(result.displayTitle);
      setDisplayEmoji(result.displayEmoji);
      setDifficulty(result.difficulty);
      setSuggestedQuestions(result.suggestedQuestions);
      setShowQuestions(true);
      toast.success('Persona generated');
    } catch {
      toast.error('Generation failed — check your OpenAI key');
    } finally {
      setGenerating(false);
    }
  };

  const openSaveModal = (presetScope?: AssignmentScope) => {
    setSaveRoleplayName(selectedLabel && selectedLabel !== 'New Roleplay' ? selectedLabel : '');
    setSaveRoleplayDesc(selectedDesc || '');
    setAssignScope(presetScope ?? 'all');
    setAssignRegions([]);
    setAssignTeams([]);
    setAssignUserIds([]);
    setAllowPeerListening(true);
    setShowSaveModal(true);
    setShowSaveDropdown(false);
    if (!targetOptions) {
      teamRoleplaysApi.getTargetOptions().then(setTargetOptions).catch(() => {});
    }
  };

  const handleSaveRoleplay = async () => {
    if (!saveRoleplayName.trim()) return toast.error('Enter a name');
    const timeLimitMinsNum = timeLimitMins ? parseInt(timeLimitMins, 10) || null : null;
    const assignmentTarget: AssignmentTarget = {
      scope: assignScope,
      ...(assignScope === 'region' && { regions: assignRegions }),
      ...(assignScope === 'team' && { teamIds: assignTeams }),
      ...(assignScope === 'individual' && { userIds: assignUserIds }),
    };
    setSavingRoleplay(true);
    try {
      const saved = await teamRoleplaysApi.create({
        name: saveRoleplayName.trim(),
        description: saveRoleplayDesc.trim() || undefined,
        assignmentTarget,
        allowPeerListening,
        scenarioConfig: {
          industry, roleplayType, personaContext,
          displayName, displayTitle, displayEmoji,
          difficulty, suggestedQuestions, objections,
          aiCanEnd, endCondition, timeLimitMins: timeLimitMinsNum,
          avatarId, elevenlabsVoiceId: selectedVoiceId,
          language, botKnowledge, userBriefing,
        } as any,
      });
      setTeamRoleplays(prev => [saved, ...prev]);
      setActiveTeamRoleplayId(saved.id);
      setSaveRoleplayName('');
      setSaveRoleplayDesc('');
      setShowSaveModal(false);
      toast.success('Saved as team roleplay');
    } catch {
      toast.error('Failed to save roleplay');
    } finally {
      setSavingRoleplay(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingRoleplay) return;
    setEditSaving(true);
    try {
      const updated = await teamRoleplaysApi.update(editingRoleplay.id, {
        name: editName.trim(), description: editDesc.trim() || undefined,
      });
      setTeamRoleplays(prev => prev.map(tr => tr.id === updated.id ? updated : tr));
      setEditingRoleplay(null);
      toast.success('Roleplay updated');
    } catch {
      toast.error('Failed to update roleplay');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteRoleplay = async (id: string) => {
    try {
      await teamRoleplaysApi.delete(id);
      setTeamRoleplays(prev => prev.filter(tr => tr.id !== id));
      if (activeTeamRoleplayId === id) setActiveTeamRoleplayId(null);
      toast.success('Roleplay removed');
    } catch {
      toast.error('Failed to remove roleplay');
    }
  };

  const addObjection = () => {
    const v = objectionInput.trim();
    if (!v || objections.length >= 15) return;
    setObjections(p => [...p, v]);
    setObjectionInput('');
  };

  const addQuestion = () => {
    const v = questionInput.trim();
    if (!v || suggestedQuestions.length >= 20) return;
    if (suggestedQuestions.includes(v)) { setQuestionInput(''); return; }
    setSuggestedQuestions(p => [...p, v]);
    setQuestionInput('');
  };

  const applyDbPersona = (p: Persona) => {
    setSelectedPersonaId(p.id);
    setPersonaContext(p.systemPrompt);
    setDisplayName(p.name);
    setDisplayTitle(p.title);
    setDisplayEmoji(p.emoji);
    setDifficulty(p.difficulty);
    setSuggestedQuestions([]);
    setShowPersonaPicker(false);
  };

  const loadDbPersonas = () => {
    if (dbPersonas.length > 0) { setShowPersonaPicker(true); return; }
    setLoadingPersonas(true);
    personasApi.list()
      .then(p => { setDbPersonas(p); setShowPersonaPicker(true); })
      .catch(() => toast.error('Failed to load personas'))
      .finally(() => setLoadingPersonas(false));
  };

  const handleStart = async () => {
    if (!industry) return toast.error('Select an industry first (Context step)');
    if (!roleplayType) return toast.error('Select a roleplay type (Context step)');
    if (!personaContext.trim()) return toast.error('Add persona context (Persona step)');
    setStarting(true);
    try {
      const sc: ScenarioConfig = {
        industry, roleplayType, personaContext, displayName, displayTitle,
        displayEmoji, difficulty, suggestedQuestions, objections,
        aiCanEnd, endCondition, timeLimitMins: timeLimitMins ? parseInt(timeLimitMins, 10) || null : null,
        avatarId, elevenlabsVoiceId: selectedVoiceId,
        language, botKnowledge, userBriefing,
      } as ScenarioConfig & { language: string };
      const session = await sessionsApi.create({ scenarioConfig: sc, type: sessionType, framework });
      const pd: PersonaDisplay = { name: displayName, title: displayTitle, emoji: displayEmoji, avatarId, elevenlabsVoiceId: selectedVoiceId, personaId: selectedPersonaId };
      // Show pre-call briefing if user has content to review
      if (canPreCallBriefing && userBriefing.length > 0) {
        setPendingSession({ id: session.id, personaDisplay: pd });
        setShowBriefing(true);
      } else {
        setActiveSession({ id: session.id, personaDisplay: pd });
      }
      setQuickLaunchData(null);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to start session');
    } finally {
      setStarting(false);
    }
  };

  const isReady = !!(industry && roleplayType && personaContext.trim());

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Gallery ──────────────────────────────────────────────────────────── */}
      {view === 'gallery' && (
        <div className="flex flex-col gap-4 max-w-5xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold leading-tight">Practice</h2>
              <p className="text-[12px] text-white/60 mt-0.5">Choose a scenario to begin</p>
            </div>
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] flex-shrink-0"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 12px rgba(91,111,255,0.35)' }}
            >
              <Plus size={15} />
              New Roleplay
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-0 border-b border-white/[0.07] overflow-x-auto scrollbar-none -mx-1 px-1">
            <button
              onClick={() => setGalleryTab('assigned')}
              className={clsx(
                'flex items-center gap-2 px-4 sm:px-5 py-3 text-[12.5px] sm:text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0',
                galleryTab === 'assigned' ? 'border-accent text-white' : 'border-transparent text-white/75 hover:text-white',
              )}
            >
              <Lock size={12} /> Assigned
              {!loadingTeamRoleplays && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.07] text-white/70">
                  {assignedRoleplays.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setGalleryTab('mine')}
              className={clsx(
                'flex items-center gap-2 px-4 sm:px-5 py-3 text-[12.5px] sm:text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0',
                galleryTab === 'mine' ? 'border-accent text-white' : 'border-transparent text-white/75 hover:text-white',
              )}
            >
              <User size={12} /> My Roleplays
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.07] text-white/70">
                {myRoleplays.length}
              </span>
            </button>
            <button
              onClick={() => setGalleryTab('library')}
              className={clsx(
                'flex items-center gap-2 px-4 sm:px-5 py-3 text-[12.5px] sm:text-[13px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex-shrink-0',
                galleryTab === 'library' ? 'border-accent text-white' : 'border-transparent text-white/75 hover:text-white',
              )}
            >
              <BookOpen size={12} /> Bot Library
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.07] text-white/70">
                {TEMPLATES.length}
              </span>
            </button>
          </div>

          {/* ── Assigned to Me ────────────────────────────────────────────── */}
          {galleryTab === 'assigned' && (
            <div className="flex flex-col gap-6">
              {/* Team Roleplays */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Team Roleplays</p>
                  <span className="text-[10px] text-white/65">Assigned by your manager</span>
                </div>
                {loadingTeamRoleplays ? (
                  <div className="flex items-center gap-2 text-[12px] text-white/70 py-4">
                    <Loader2 size={13} className="animate-spin" /> Loading…
                  </div>
                ) : assignedRoleplays.length === 0 ? (
                  <div className="card p-6 flex flex-col items-center gap-2 text-center">
                    <BookOpen size={22} className="text-white/40" />
                    <p className="text-[12.5px] text-white/70">No roleplays assigned yet.</p>
                    <p className="text-[11px] text-white/40">
                      {isManagerOrAdmin
                        ? 'Create one in the "Created by Me" tab and it will appear here for your team.'
                        : 'Ask your manager to create team roleplays for you.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {assignedRoleplays.map(tr => (
                      <GalleryCard
                        key={tr.id}
                        avatarId={tr.scenarioConfig.avatarId}
                        name={tr.name}
                        subtitle={tr.scenarioConfig.displayTitle}
                        industry={tr.scenarioConfig.industry}
                        type={tr.scenarioConfig.roleplayType}
                        difficulty={tr.scenarioConfig.difficulty}
                        timeLimitMins={tr.scenarioConfig.timeLimitMins ?? 3}
                        sessionType={tr.scenarioConfig.sessionType}
                        metaLabel={`by ${tr.createdBy.firstName} ${tr.createdBy.lastName}`}
                        description={tr.description}
                        badge="Assigned"
                        hasKnowledge={
                          (tr.scenarioConfig.botKnowledge?.length ?? 0) > 0 ||
                          (tr.scenarioConfig.userBriefing?.length ?? 0) > 0
                        }
                        onSelect={() => handleSelectAssigned(tr)}
                      />
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ── Created by Me ─────────────────────────────────────────────── */}
          {galleryTab === 'mine' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-white/75">
                  {isManagerOrAdmin
                    ? 'Your roleplays are visible to your whole team in "Assigned to Me".'
                    : 'Create a custom practice session for yourself.'}
                </p>
                <button onClick={handleCreateNew} className="btn-primary gap-2 text-[13px]">
                  <Plus size={14} /> Create New
                </button>
              </div>

              {myRoleplays.length === 0 ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Layers size={24} className="text-accent/60" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold">No roleplays yet</p>
                    <p className="text-[12px] text-white/75 mt-1">
                      {isManagerOrAdmin
                        ? 'Create a roleplay and it will be shared with your team automatically.'
                        : 'Build a custom practice scenario and start training right away.'}
                    </p>
                  </div>
                  <button onClick={handleCreateNew} className="btn-primary gap-2 text-[13px] mt-1">
                    <Plus size={14} /> Create your first roleplay
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {myRoleplays.map(tr => (
                    <GalleryCard
                      key={tr.id}
                      avatarId={tr.scenarioConfig.avatarId}
                      name={tr.name}
                      subtitle={tr.scenarioConfig.displayTitle}
                      industry={tr.scenarioConfig.industry}
                      type={tr.scenarioConfig.roleplayType}
                      difficulty={tr.scenarioConfig.difficulty}
                      timeLimitMins={tr.scenarioConfig.timeLimitMins ?? 3}
                      sessionType={tr.scenarioConfig.sessionType}
                      metaLabel={`by ${tr.createdBy.firstName} ${tr.createdBy.lastName}`}
                      description={tr.description}
                      canEdit
                      hasKnowledge={
                        (tr.scenarioConfig.botKnowledge?.length ?? 0) > 0 ||
                        (tr.scenarioConfig.userBriefing?.length ?? 0) > 0
                      }
                      onSelect={() => handleSelectMine(tr)}
                      onEdit={e => {
                        e.stopPropagation();
                        handleEditMine(tr);
                      }}
                      onDelete={e => {
                        e.stopPropagation();
                        if (confirm(`Remove "${tr.name}"?`)) handleDeleteRoleplay(tr.id);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Bot Library ───────────────────────────────────────────────── */}
          {galleryTab === 'library' && (
            <div className="flex flex-col gap-4">
              <p className="text-[12px] text-white/75">Ready-made practice scenarios included with PitchIQ. Jump straight in — no setup required.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map(t => (
                  <GalleryCard
                    key={t.id}
                    avatarId={t.avatarId}
                    name={t.label}
                    subtitle={t.displayTitle}
                    industry={t.industry}
                    type={t.roleplayType}
                    difficulty={t.difficulty}
                    timeLimitMins={3}
                    sessionType={(t as ScenarioConfig & { id: string; label: string; avatarId: string; sessionType?: SessionType }).sessionType}
                    metaLabel="Built-in"
                    onSelect={() => handleSelectTemplate(t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Setup ──────────────────────────────────────────────────────────────── */}
      {view === 'setup' && (
        <div className="flex flex-col gap-4 max-w-5xl">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('gallery')}
              className="flex items-center gap-1.5 text-[12.5px] text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft size={14} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-[17px] font-bold truncate">{selectedLabel || 'Practice Setup'}</h2>
              {selectedDesc && <p className="text-[11.5px] text-white/75 mt-0.5 truncate">{selectedDesc}</p>}
            </div>
            {setupMode === 'view' && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-white/70 bg-white/[0.05] border border-white/[0.08] px-2.5 py-1 rounded-full flex-shrink-0">
                <Lock size={10} /> View Only
              </span>
            )}
            {setupMode === 'edit' && (
              <div className="relative flex-shrink-0">
                <div className="flex items-stretch rounded-[8px] border border-white/[0.1] overflow-hidden">
                  <button
                    onClick={() => openSaveModal()}
                    disabled={!isReady}
                    className="flex items-center gap-1.5 text-[12.5px] font-medium px-3 py-1.5 text-white/70 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <BookOpen size={13} /> {isManagerOrAdmin ? 'Save for Team' : 'Save Roleplay'}
                  </button>
                  {isManagerOrAdmin && (
                    <button
                      onClick={() => setShowSaveDropdown(v => !v)}
                      disabled={!isReady}
                      className="flex items-center px-2 border-l border-white/[0.1] text-white/50 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronDown size={12} />
                    </button>
                  )}
                </div>
                {showSaveDropdown && isManagerOrAdmin && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSaveDropdown(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 rounded-[10px] border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden min-w-[200px]" style={{ background: 'var(--bg2)' }}>
                      <button
                        onClick={() => openSaveModal('all')}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <User size={13} className="text-white/50" /> Save for All Users
                      </button>
                      <button
                        onClick={() => openSaveModal('team')}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <Layers size={13} className="text-white/50" /> Share with Team
                      </button>
                      <button
                        onClick={() => openSaveModal('individual')}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                      >
                        <User size={13} className="text-white/50" /> Share with Individual
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── VIEW-ONLY: scenario briefing + launch ──────────────────────────── */}
          {setupMode === 'view' && (
            <div className="flex flex-col gap-5 max-w-2xl">

              {/* Scenario header card */}
              <div className="card p-5 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent3))' }} />
                <div className="flex items-start gap-4">
                  <div className="rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0">
                    <AvatarDisplay avatarId={avatarId} size={64} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-[18px] font-bold leading-tight">{displayName}</div>
                    {displayTitle && <div className="text-[13px] text-white/65 mt-0.5">{displayTitle}</div>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={clsx('text-[11px] px-2 py-0.5 rounded border font-medium', DIFFICULTY_COLORS[difficulty] || 'text-white/80 bg-white/5 border-white/10')}>{difficulty}</span>
                      {industry && <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/80">{industry}</span>}
                      {roleplayType && <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/80">{roleplayType}</span>}
                      {language && language !== 'English' && <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/80">{language}</span>}
                    </div>
                  </div>
                  {selectedCreator && (
                    <span className="text-[10.5px] text-white/40 flex-shrink-0 mt-0.5">by {selectedCreator}</span>
                  )}
                </div>
              </div>

              {/* Your mission — what the user needs to do */}
              <div className="card p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-[6px] bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <Info size={12} className="text-accent/70" />
                  </div>
                  <span className="text-[13px] font-semibold">Your Mission</span>
                </div>
                <p className="text-[13px] text-white/80 leading-relaxed">
                  You are going to practice a <strong className="text-white">{roleplayType || 'roleplay'}</strong> with{' '}
                  <strong className="text-white">{displayName}</strong>
                  {displayTitle ? <span className="text-white/70">, {displayTitle}</span> : ''}.
                  {industry ? <span> The scenario is set in the <strong className="text-white">{industry}</strong> industry.</span> : ''}
                  {' '}Your goal is to apply your sales skills and handle the conversation professionally.
                </p>

                {/* Objections the user should prepare for */}
                {objections.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Expect These Objections</p>
                    <div className="flex flex-wrap gap-1.5">
                      {objections.map((obj, i) => (
                        <span key={i} className="flex items-center gap-1 text-[11.5px] px-2.5 py-1 rounded-[8px] border border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-400/50 mr-0.5">!</span>
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested questions to expect */}
                {suggestedQuestions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Questions You May Face</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedQuestions.map((q, i) => (
                        <span key={i} className="text-[11.5px] px-2.5 py-1 rounded-[8px] border border-white/[0.08] bg-white/[0.03] text-white/65">{q}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Session config + start */}
              <div className="flex flex-col gap-3 w-full">
                <div className="card p-4">
                  <FrameworkSelector
                    framework={framework}
                    setFramework={setFramework}
                    roleplayType={roleplayType}
                    industry={industry}
                    difficulty={difficulty}
                    personaTitle={displayTitle}
                    compact
                  />
                </div>
                <div className="card p-4">
                  <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-2.5">Call Format</p>
                  <div className="flex gap-2">
                    <button onClick={() => setSessionType('PHONE_CALL')} className={clsx('flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[12px] font-medium transition-all', sessionType === 'PHONE_CALL' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05]')}>
                      <Phone size={12} /> Phone
                    </button>
                    <button onClick={() => setSessionType('ONLINE_MEETING')} className={clsx('flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[12px] font-medium transition-all', sessionType === 'ONLINE_MEETING' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05]')}>
                      <Monitor size={12} /> Online
                    </button>
                  </div>
                </div>
                <div className="card overflow-hidden">
                  <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center justify-between w-full p-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2">
                      <Settings size={12} className="text-white/70" />
                      <span className="text-[12.5px] font-medium text-white/80">Advanced</span>
                    </div>
                    {showAdvanced ? <ChevronUp size={13} className="text-white/70" /> : <ChevronDown size={13} className="text-white/70" />}
                  </button>
                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[12.5px] font-medium">Natural End</span>
                              <p className="text-[10.5px] text-white/75 mt-0.5">AI ends call when scenario concludes.</p>
                            </div>
                            <button onClick={() => setAiCanEnd(v => !v)} role="switch" aria-checked={aiCanEnd} className={clsx('relative flex-shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5', aiCanEnd ? 'bg-accent' : 'bg-white/[0.18]')}>
                              <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', aiCanEnd ? 'translate-x-4' : 'translate-x-0')} />
                            </button>
                          </div>
                          <textarea value={endCondition} onChange={e => setEndCondition(e.target.value)} placeholder="When should AI end? (optional)" disabled={!aiCanEnd} className={clsx('input-base resize-none min-h-[60px] text-[12px]', !aiCanEnd && 'opacity-35 pointer-events-none')} />
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] text-white/80 flex-1">Time limit</span>
                            {isManagerOrAdmin ? (
                              <>
                                <input type="number" min={1} max={120} value={timeLimitMins} onChange={e => setTimeLimitMins(e.target.value)} placeholder="—" className="input-base w-16 text-[12.5px] text-center" />
                                <span className="text-[12px] text-white/75">min</span>
                              </>
                            ) : (
                              <span className="text-[12.5px] font-semibold text-white/80">{timeLimitMins || '3'} min</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={handleStart} disabled={starting || !isReady} className="w-full btn-primary gap-2 py-3 text-[14px] justify-center disabled:opacity-40">
                  {starting ? <><Loader2 size={15} className="animate-spin" /> Starting…</> : <><Play size={15} /> Start Session</>}
                </button>
                {!isReady && <p className="text-[11px] text-amber-400/60 text-center -mt-1">Complete all steps before launching</p>}
              </div>
            </div>
          )}

          {/* ── EDIT: left sidebar + step content + multi-persona panel ──────────── */}
          {setupMode === 'edit' && (
            <div className="flex flex-col md:flex-row gap-4 items-start">
              {/* Left sidebar */}
              <div className="flex flex-col gap-3 w-full md:w-44 md:flex-shrink-0">
                <div className="card p-2 flex flex-row md:flex-col gap-1">
                  {[
                    { n: 1, label: 'Context', sub: industry || 'Industry & type' },
                    { n: 2, label: 'Persona', sub: displayName !== 'Custom Persona' ? displayName : 'Avatar & context' },
                    { n: 3, label: 'Knowledge', sub: (botKnowledge.length + userBriefing.length) > 0 ? `${botKnowledge.length + userBriefing.length} items` : 'Docs & briefing' },
                    { n: 4, label: 'Launch', sub: roleplayType || 'Settings & start' },
                  ].map(({ n, label, sub }) => {
                    const done = n < currentStep;
                    const active = n === currentStep;
                    return (
                      <button
                        key={n}
                        onClick={() => goToStep(n)}
                        className={clsx(
                          'flex items-center gap-2 md:gap-2.5 flex-1 md:flex-none px-2.5 md:px-3 py-2 md:py-2.5 rounded-[8px] transition-all text-left',
                          active ? 'bg-accent/10 border border-accent/20' : 'hover:bg-white/[0.04]',
                          !done && !active && 'opacity-60'
                        )}
                      >
                        <div className={clsx(
                          'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                          done ? 'bg-accent-3 text-white' : active ? 'bg-accent text-white' : 'bg-white/[0.08] text-white/70 border border-white/[0.12]'
                        )}>
                          {done ? <Check size={9} /> : n}
                        </div>
                        <div className="min-w-0">
                          <div className={clsx('text-[11.5px] font-semibold leading-tight', active ? 'text-white' : 'text-white/70')}>{label}</div>
                          <div className="hidden md:block text-[9.5px] text-white/70 mt-0.5 truncate">{sub}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="hidden md:flex card p-3 flex-col items-center gap-2 text-center">
                  <div className="rounded-full overflow-hidden ring-2 ring-white/10">
                    <AvatarDisplay avatarId={avatarId} size={44} />
                  </div>
                  <div className="min-w-0 w-full">
                    {displayName && displayName !== 'Custom Persona' && (
                      <div className="text-[11.5px] font-semibold truncate">{displayName}</div>
                    )}
                    {displayTitle && <div className="text-[10px] text-white/75 mt-0.5 truncate">{displayTitle}</div>}
                    <span className={clsx('inline-block text-[9.5px] px-1.5 py-0.5 rounded border mt-1', DIFFICULTY_COLORS[difficulty] || 'text-white/80 bg-white/5 border-white/10')}>
                      {difficulty}
                    </span>
                  </div>
                </div>
              </div>

              {/* Step content */}
              <div className="flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait" initial={false}>

                  {currentStep === 1 && (
                    <motion.div
                      key="s1"
                      initial={{ opacity: 0, x: stepDirection.current * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: stepDirection.current * -20 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="card p-4 sm:p-5 flex flex-col gap-4"
                    >
                      {/* Industry + Language + Roleplay Type — compact dropdowns */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                            <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0', industry ? 'bg-accent-3 text-white' : 'bg-white/[0.07] text-white/60 border border-white/[0.1]')}>
                              {industry ? <Check size={7} /> : '1'}
                            </div>
                            Industry
                          </label>
                          <select
                            value={industry}
                            onChange={e => setIndustry(e.target.value)}
                            className={clsx('input-base text-[12.5px] w-full', !industry && 'text-white/45')}
                          >
                            <option value="" disabled>Select industry…</option>
                            {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                            <Globe size={10} className="text-white/50" />
                            Language
                          </label>
                          <select
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                            className="input-base text-[12.5px] w-full"
                          >
                            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                            <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0', roleplayType ? 'bg-accent-3 text-white' : 'bg-white/[0.07] text-white/60 border border-white/[0.1]')}>
                              {roleplayType ? <Check size={7} /> : '2'}
                            </div>
                            Roleplay Type
                          </label>
                          <select
                            value={roleplayType}
                            onChange={e => setRoleplayType(e.target.value)}
                            className={clsx('input-base text-[12.5px] w-full', !roleplayType && 'text-white/45')}
                          >
                            <option value="" disabled>Select type…</option>
                            {ROLEPLAY_TYPES.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-white/[0.07] text-white/70 border border-white/[0.1]">3</div>
                            <p className="text-[12.5px] font-semibold">Objections <span className="text-[11px] text-white/70 font-normal">(optional)</span></p>
                          </div>
                          <span className="text-[10px] text-white/70 tabular-nums">{objections.length}/15</span>
                        </div>
                        <div className="flex gap-2">
                          <input value={objectionInput} onChange={e => setObjectionInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addObjection()} placeholder="e.g. Your competitor is 30% cheaper" className="input-base flex-1 text-[12.5px]" disabled={objections.length >= 15} />
                          <button onClick={addObjection} disabled={!objectionInput.trim() || objections.length >= 15} className="btn-primary px-4 text-[12.5px] flex-shrink-0 disabled:opacity-40">Add</button>
                        </div>
                        {objections.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {objections.map((obj, i) => (
                              <span key={i} className="flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-[8px] border border-white/[0.1] bg-white/[0.04] text-white/80">
                                {obj}
                                <button onClick={() => setObjections(p => p.filter((_, idx) => idx !== i))} className="text-white/70 hover:text-white/70 transition-colors"><X size={10} /></button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Multi-Persona Mode */}
                      <div className="rounded-[12px] border border-white/[0.08] overflow-hidden">
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-white">Multi-Persona Mode</div>
                            <div className="text-[11px] text-white/55 mt-0.5">Simulate a panel or buying committee with multiple AI attendees</div>
                          </div>
                          <button
                            onClick={() => setMultiPersonaEnabled(v => !v)}
                            role="switch"
                            aria-checked={multiPersonaEnabled}
                            className={clsx('relative flex-shrink-0 w-10 h-5 rounded-full transition-colors', multiPersonaEnabled ? 'bg-accent' : 'bg-white/[0.18]')}
                          >
                            <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', multiPersonaEnabled ? 'translate-x-5' : 'translate-x-0')} />
                          </button>
                        </div>
                        <AnimatePresence>
                          {multiPersonaEnabled && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-4 border-t border-white/[0.06] flex flex-col gap-3 pt-3">
                                <div>
                                  <label className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-white/60 mb-1.5 block">Group Name</label>
                                  <input
                                    value={personaGroupName}
                                    onChange={e => setPersonaGroupName(e.target.value)}
                                    placeholder="e.g. Sales Team, Procurement Committee"
                                    maxLength={80}
                                    className="input-base text-[12px] w-full"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9.5px] font-bold uppercase tracking-[1.2px] text-white/60 mb-2 block">Attendees</label>
                                  {multiAttendees.length === 0 ? (
                                    <div className="text-[11.5px] text-white/40 italic py-1">No attendees added yet.</div>
                                  ) : (
                                    <div className="flex flex-col gap-1.5 mb-2">
                                      {multiAttendees.map(a => (
                                        <div key={a.id} className="flex items-center gap-2 px-2.5 py-2 rounded-[9px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
                                            <AvatarDisplay avatarId={a.avatarId} size={28} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-semibold truncate">{a.name}</div>
                                            <div className="text-[10px] text-white/60 truncate">{a.title}</div>
                                          </div>
                                          {a.isHost && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-accent/30 text-accent/80 flex-shrink-0">Host</span>
                                          )}
                                          <button onClick={() => removeAttendee(a.id)} className="text-white/40 hover:text-white/70 transition-colors flex-shrink-0">
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={addAttendeeFromCurrent}
                                      disabled={!displayName || displayName === 'Custom Persona'}
                                      className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[11.5px] font-medium transition-all border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05] disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                      <BookOpen size={11} /> From Library
                                    </button>
                                    <button
                                      onClick={() => { setShowBuilder(true); }}
                                      className="flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[11.5px] font-medium transition-all border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05]"
                                    >
                                      <Plus size={11} /> Create New
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="flex justify-end pt-1 border-t border-white/[0.06]">
                        <button
                          onClick={() => goToStep(2)}
                          disabled={!industry || !roleplayType}
                          className="btn-primary gap-2 text-[13px] disabled:opacity-40"
                        >
                          Persona <ArrowLeft size={12} className="rotate-180" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 2 && (
                    <motion.div
                      key="s2"
                      initial={{ opacity: 0, x: stepDirection.current * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: stepDirection.current * -20 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="card p-4 sm:p-5 flex flex-col gap-4"
                    >
                      {/* Avatar picker with ethnicity + gender filter */}
                      <div>
                        <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-2">Avatar</p>
                        <EthnicityAvatarPicker value={avatarId} onChange={id => {
                          setAvatarId(id);
                          const cfg = AVATAR_VOICE_CONFIG[id as AvatarId];
                          setSelectedVoiceId(cfg?.elevenlabsId ?? undefined);
                          const av = AVATARS.find(a => a.id === id);
                          if (av) setDisplayName(av.name);
                        }} />
                      </div>

                      {/* Voice picker — opens modal */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-[10px] border border-white/[0.07]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider flex-shrink-0">Voice</span>
                          {selectedVoiceId ? (
                            <span className="text-[11px] text-white/75 truncate">
                              {CURATED_VOICES.find(v => v.id === selectedVoiceId)?.name ?? 'Custom'}
                              <span className="ml-1 text-[9px] text-white/35">
                                {CURATED_VOICES.find(v => v.id === selectedVoiceId)?.accent}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-white/40">Browser default</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {selectedVoiceId && (
                            <button
                              type="button"
                              onClick={() => setSelectedVoiceId(undefined)}
                              className="text-[9px] text-white/40 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded border border-white/[0.06] hover:border-white/[0.12]"
                            >
                              Clear
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setVoiceModalOpen(true)}
                            className="btn-ghost text-[11px] px-2.5 py-1 gap-1"
                          >
                            {selectedVoiceId ? 'Change' : 'Choose'}
                          </button>
                        </div>
                      </div>

                      {/* Name + Title + Difficulty */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] text-white/75 block mb-1">Name</label>
                          <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="input-base text-[12.5px]" placeholder="Alex Chen" />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/75 block mb-1">Title & Company</label>
                          <input value={displayTitle} onChange={e => setDisplayTitle(e.target.value)} className="input-base text-[12.5px]" placeholder="VP Sales, Acme" />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/75 block mb-1">Difficulty</label>
                          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="input-base text-[12.5px] w-full">
                            {['Easy', 'Medium', 'Hard', 'Expert'].map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* Pre-built scenario templates — filtered by selected industry/type */}
                      <div>
                        <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-2">
                          Start from Template
                          {(industry || roleplayType) && (
                            <span className="ml-2 normal-case font-normal text-white/50">
                              {[industry, roleplayType].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {TEMPLATES.filter(t =>
                            (!industry || t.industry === industry) &&
                            (!roleplayType || t.roleplayType === roleplayType)
                          ).length > 0
                            ? TEMPLATES.filter(t =>
                                (!industry || t.industry === industry) &&
                                (!roleplayType || t.roleplayType === roleplayType)
                              ).map(t => {
                                const isActive = personaContext === t.personaContext;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => applyTemplate(t)}
                                    title={`${t.displayTitle} · ${t.difficulty}`}
                                    className={clsx(
                                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] font-medium transition-all',
                                      isActive
                                        ? 'bg-accent/10 border-accent/40 text-accent'
                                        : 'border-white/[0.08] text-white/70 hover:text-white hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]'
                                    )}
                                  >
                                    <span className="text-[13px] leading-none">{t.displayEmoji}</span>
                                    <span>{t.label}</span>
                                    <span className={clsx(
                                      'text-[9px] px-1.5 py-0.5 rounded border leading-none',
                                      DIFFICULTY_COLORS[t.difficulty] || 'text-white/80 bg-white/5 border-white/10'
                                    )}>{t.difficulty}</span>
                                  </button>
                                );
                              })
                            : TEMPLATES.map(t => {
                                const isActive = personaContext === t.personaContext;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => applyTemplate(t)}
                                    title={`${t.displayTitle} · ${t.difficulty}`}
                                    className={clsx(
                                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] font-medium transition-all',
                                      isActive
                                        ? 'bg-accent/10 border-accent/40 text-accent'
                                        : 'border-white/[0.08] text-white/70 hover:text-white hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.05]'
                                    )}
                                  >
                                    <span className="text-[13px] leading-none">{t.displayEmoji}</span>
                                    <span>{t.label}</span>
                                    <span className={clsx(
                                      'text-[9px] px-1.5 py-0.5 rounded border leading-none',
                                      DIFFICULTY_COLORS[t.difficulty] || 'text-white/80 bg-white/5 border-white/10'
                                    )}>{t.difficulty}</span>
                                  </button>
                                );
                              })
                          }
                        </div>
                      </div>

                      {/* Persona context */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">Persona Instructions</label>
                          <div className="flex items-center gap-3">
                            {canCreatePersona && (
                              <button onClick={loadDbPersonas} disabled={loadingPersonas} className="flex items-center gap-1 text-[10px] text-white/75 hover:text-white/70 transition-colors">
                                {loadingPersonas ? <Loader2 size={10} className="animate-spin" /> : <BookOpen size={10} />} Saved
                              </button>
                            )}
                            <button onClick={() => setShowAiPanel(v => !v)} className="flex items-center gap-1 text-[10px] text-accent/60 hover:text-accent transition-colors">
                              <Sparkles size={10} /> AI
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {showAiPanel && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-2">
                              <div className="flex gap-2 p-2.5 rounded-[10px] bg-accent/[0.06] border border-accent/20">
                                <input value={aiKeywords} onChange={e => setAiKeywords(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleGenerateScenario()} placeholder="e.g. skeptical CFO enterprise software" className="input-base flex-1 text-[12px] bg-transparent border-white/10" />
                                <button onClick={handleGenerateScenario} disabled={generating || !aiKeywords.trim()} className="btn-primary gap-1 text-[11.5px] px-3 flex-shrink-0 disabled:opacity-50">
                                  {generating ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                  {generating ? '…' : 'Go'}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <textarea value={personaContext} onChange={e => setPersonaContext(e.target.value)} placeholder="Describe the persona and scenario…" className="input-base min-h-[110px] resize-none text-[12.5px] leading-relaxed" />
                      </div>

                      {/* Expected questions */}
                      <div className="rounded-[10px] border border-white/[0.07] p-3 bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-white/70 uppercase tracking-wider">Expected Questions</span>
                            {generatingQuestions && <Loader2 size={10} className="animate-spin text-white/70" />}
                            {suggestedQuestions.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">
                                {suggestedQuestions.length}/20
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerateQuestions(true)}
                            disabled={generatingQuestions || !personaContext.trim()}
                            className="flex items-center gap-1 text-[10px] text-accent/70 hover:text-accent transition-colors disabled:opacity-40"
                          >
                            <Sparkles size={9} /> {generatingQuestions ? 'Generating…' : 'AI Suggest'}
                          </button>
                        </div>

                        {/* Manual add input */}
                        <div className="flex gap-2 mb-2.5">
                          <input
                            value={questionInput}
                            onChange={e => setQuestionInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addQuestion(); } }}
                            placeholder="Type a question and press Add…"
                            className="input-base flex-1 text-[12px]"
                            disabled={suggestedQuestions.length >= 20}
                          />
                          <button
                            onClick={addQuestion}
                            disabled={!questionInput.trim() || suggestedQuestions.length >= 20}
                            className="btn-primary px-3 text-[12px] flex-shrink-0 disabled:opacity-40"
                          >
                            Add
                          </button>
                        </div>

                        {/* AI-staged questions — click to accept */}
                        {stagedQuestions.length > 0 && (
                          <div className="mb-2.5">
                            <p className="text-[9.5px] text-white/50 mb-1.5 flex items-center gap-1">
                              <Sparkles size={8} className="text-accent/50" />
                              AI suggestions — click to add:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {stagedQuestions.map((q, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    if (suggestedQuestions.length >= 20) return;
                                    if (!suggestedQuestions.includes(q)) {
                                      setSuggestedQuestions(prev => [...prev, q]);
                                    }
                                    setStagedQuestions(prev => prev.filter((_, idx) => idx !== i));
                                  }}
                                  disabled={suggestedQuestions.includes(q) || suggestedQuestions.length >= 20}
                                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-[7px] border border-accent/20 bg-accent/[0.04] text-white/60 hover:border-accent/40 hover:bg-accent/[0.08] hover:text-white/80 transition-all text-left disabled:opacity-40"
                                >
                                  <Plus size={8} className="flex-shrink-0 text-accent/60" />
                                  {q}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => {
                                const remaining = 20 - suggestedQuestions.length;
                                const toAdd = stagedQuestions.slice(0, remaining).filter(q => !suggestedQuestions.includes(q));
                                setSuggestedQuestions(prev => [...prev, ...toAdd]);
                                setStagedQuestions([]);
                              }}
                              className="mt-2 text-[9.5px] text-accent/60 hover:text-accent transition-colors"
                            >
                              Add all
                            </button>
                          </div>
                        )}

                        {/* Accepted questions */}
                        {suggestedQuestions.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {suggestedQuestions.map((q, i) => (
                              <span key={i} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-[7px] border border-white/[0.08] bg-white/[0.03] text-white/65">
                                {q}
                                <button
                                  onClick={() => setSuggestedQuestions(prev => prev.filter((_, idx) => idx !== i))}
                                  className="text-white/30 hover:text-white/70 transition-colors ml-0.5 flex-shrink-0"
                                >
                                  <X size={9} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : stagedQuestions.length === 0 && (
                          <p className="text-[11px] text-white/35">Type above or use AI Suggest to generate from your persona context.</p>
                        )}
                        {suggestedQuestions.length >= 20 && (
                          <p className="text-[10px] text-white/40 mt-1.5">Maximum 20 questions reached.</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                        <button onClick={() => goToStep(1)} className="btn-ghost gap-1.5 text-[13px]"><ArrowLeft size={12} /> Context</button>
                        <button onClick={() => goToStep(3)} className="btn-primary gap-2 text-[13px]">Knowledge <ArrowLeft size={12} className="rotate-180" /></button>
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 3 && (
                    <motion.div
                      key="s3-kb"
                      initial={{ opacity: 0, x: stepDirection.current * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: stepDirection.current * -20 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="card p-4 sm:p-5 flex flex-col gap-6"
                    >
                      {/* Header with master toggle */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-[14px] font-bold text-white mb-0.5">Knowledge Base</h3>
                          <p className="text-[11.5px] text-white/70">Attach content to train the AI bot and optionally brief the user before the call starts.</p>
                        </div>
                        <button
                          onClick={() => setKbEnabled(v => !v)}
                          className={clsx(
                            'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5',
                            kbEnabled ? 'bg-accent' : 'bg-white/20',
                          )}
                          title={kbEnabled ? 'Disable Knowledge Base' : 'Enable Knowledge Base'}
                        >
                          <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', kbEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                        </button>
                      </div>

                      {kbEnabled && (
                        <div className="flex flex-col gap-3">
                          {/* Bot Training section */}
                          <div className={clsx('rounded-[12px] border overflow-hidden transition-colors', botEnabled ? 'border-white/[0.09]' : 'border-white/[0.05]')}>
                            <div
                              className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                              onClick={() => { if (botEnabled) setBotSectionOpen(v => !v); }}
                            >
                              <div className="flex items-center gap-2.5">
                                <Database size={13} className={clsx('transition-colors', botEnabled ? 'text-accent/70' : 'text-white/25')} />
                                <span className={clsx('text-[13px] font-semibold transition-colors', botEnabled ? 'text-white' : 'text-white/40')}>Bot Training</span>
                                {botEnabled && botKnowledge.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-accent/10 text-accent">
                                    {botKnowledge.length} item{botKnowledge.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {!botEnabled && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/[0.08] text-white/30">off</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                                {botEnabled && (
                                  <ChevronDown size={13} className={clsx('text-white/40 transition-transform', botSectionOpen ? 'rotate-180' : '')} />
                                )}
                                <button
                                  onClick={() => {
                                    const next = !botEnabled;
                                    setBotEnabled(next);
                                    if (next) setBotSectionOpen(true);
                                  }}
                                  className={clsx(
                                    'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                                    botEnabled ? 'bg-accent' : 'bg-white/[0.15]',
                                  )}
                                  title={botEnabled ? 'Disable Bot Training' : 'Enable Bot Training'}
                                >
                                  <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', botEnabled ? 'translate-x-4' : 'translate-x-0.5')} />
                                </button>
                              </div>
                            </div>
                            <AnimatePresence>
                              {botEnabled && botSectionOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 border-t border-white/[0.06]">
                                    <p className="text-[11px] text-white/50 mt-3 mb-3">Context the AI persona will use during the call — product docs, FAQs, competitor info, pricing.</p>
                                    {canKnowledgeBase ? (
                                      <KnowledgeBaseEditor
                                        label=""
                                        description=""
                                        forRole="bot"
                                        entries={botKnowledge}
                                        onChange={setBotKnowledge}
                                        maxEntries={5}
                                      />
                                    ) : (
                                      <PlanGate feature="knowledgeBase" overlay={false} upgradeLabel="Bot Knowledge Base — Pro feature">
                                        <KnowledgeBaseEditor label="" description="" forRole="bot" entries={[]} onChange={() => {}} />
                                      </PlanGate>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Pre-Call Briefing section */}
                          <div className={clsx('rounded-[12px] border overflow-hidden transition-colors', briefingEnabled ? 'border-white/[0.09]' : 'border-white/[0.05]')}>
                            <div
                              className="flex items-center justify-between w-full px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
                              onClick={() => { if (briefingEnabled) setBriefingSectionOpen(v => !v); }}
                            >
                              <div className="flex items-center gap-2.5">
                                <FileText size={13} className={clsx('transition-colors', briefingEnabled ? 'text-accent/70' : 'text-white/25')} />
                                <span className={clsx('text-[13px] font-semibold transition-colors', briefingEnabled ? 'text-white' : 'text-white/40')}>Pre-Call User Briefing</span>
                                {briefingEnabled && userBriefing.length > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-accent/10 text-accent">
                                    {userBriefing.length} item{userBriefing.length !== 1 ? 's' : ''}
                                  </span>
                                )}
                                {!briefingEnabled && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/[0.08] text-white/30">off</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5" onClick={e => e.stopPropagation()}>
                                {briefingEnabled && (
                                  <ChevronDown size={13} className={clsx('text-white/40 transition-transform', briefingSectionOpen ? 'rotate-180' : '')} />
                                )}
                                <button
                                  onClick={() => {
                                    const next = !briefingEnabled;
                                    setBriefingEnabled(next);
                                    if (next) setBriefingSectionOpen(true);
                                  }}
                                  className={clsx(
                                    'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                                    briefingEnabled ? 'bg-accent' : 'bg-white/[0.15]',
                                  )}
                                  title={briefingEnabled ? 'Disable Pre-Call Briefing' : 'Enable Pre-Call Briefing'}
                                >
                                  <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', briefingEnabled ? 'translate-x-4' : 'translate-x-0.5')} />
                                </button>
                              </div>
                            </div>
                            <AnimatePresence>
                              {briefingEnabled && briefingSectionOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 border-t border-white/[0.06]">
                                    <p className="text-[11px] text-white/50 mt-3 mb-3">Material shown to the user before the call starts — product brochure, LinkedIn profile, website URL. Tests how well they've absorbed the content.</p>
                                    {canPreCallBriefing ? (
                                      <KnowledgeBaseEditor
                                        label=""
                                        description=""
                                        forRole="user"
                                        entries={userBriefing}
                                        onChange={setUserBriefing}
                                        maxEntries={5}
                                      />
                                    ) : (
                                      <PlanGate feature="preCallBriefing" overlay={false} upgradeLabel="Pre-Call Briefing — Pro feature">
                                        <KnowledgeBaseEditor label="" description="" forRole="user" entries={[]} onChange={() => {}} />
                                      </PlanGate>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      )}

                      {!kbEnabled && (
                        <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col items-center gap-2 text-center">
                          <Database size={20} className="text-white/25" />
                          <p className="text-[12px] text-white/40">Knowledge Base is disabled. Toggle it on to add bot training data or user briefing material.</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                        <button onClick={() => goToStep(2)} className="btn-ghost gap-1.5 text-[13px]"><ArrowLeft size={12} /> Persona</button>
                        <button onClick={() => goToStep(4)} className="btn-primary gap-2 text-[13px]">Launch <ArrowLeft size={12} className="rotate-180" /></button>
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 4 && (
                    <motion.div
                      key="s3"
                      initial={{ opacity: 0, x: stepDirection.current * 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: stepDirection.current * -20 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="card p-4 sm:p-5 flex flex-col gap-4"
                    >
                      {/* Summary strip */}
                      <div className="flex items-center gap-3 p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.07]">
                        <div className="rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                          <AvatarDisplay avatarId={avatarId} size={44} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[13.5px] truncate">{displayName}</div>
                          {displayTitle && <div className="text-[11px] text-white/80 truncate">{displayTitle}</div>}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {industry && <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/80">{industry}</span>}
                            {roleplayType && <span className="text-[9.5px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/80">{roleplayType}</span>}
                            {difficulty && <span className={clsx('text-[9.5px] px-1.5 py-0.5 rounded border', DIFFICULTY_COLORS[difficulty] || 'text-white/80 bg-white/5 border-white/10')}>{difficulty}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Framework selector + call format */}
                      <div className="flex flex-col gap-3">
                        <FrameworkSelector
                          framework={framework}
                          setFramework={setFramework}
                          roleplayType={roleplayType}
                          industry={industry}
                          difficulty={difficulty}
                          personaTitle={displayTitle}
                        />

                        <div>
                          <p className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mb-2">Call Format</p>
                          <div className="flex gap-2">
                            <button onClick={() => setSessionType('PHONE_CALL')} className={clsx('flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[12px] font-medium transition-all', sessionType === 'PHONE_CALL' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05]')}>
                              <Phone size={12} /> Phone
                            </button>
                            <button onClick={() => setSessionType('ONLINE_MEETING')} className={clsx('flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-[8px] border text-[12px] font-medium transition-all', sessionType === 'ONLINE_MEETING' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/80 hover:text-white hover:bg-white/[0.05]')}>
                              <Monitor size={12} /> Online
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Scoring Rubric Preview */}
                      {evalRubric && evalRubric.length > 0 && (
                        <div className="rounded-[10px] border border-white/[0.07] overflow-hidden">
                          <button
                            onClick={() => setShowRubric(v => !v)}
                            className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ClipboardList size={12} className="text-white/70" />
                              <span className="text-[12px] font-medium text-white/80">Scoring Rubric</span>
                              <span className="text-[9.5px] px-1.5 py-0.5 rounded-full border border-white/[0.1] text-white/50">
                                {evalRubric.reduce((a, g) => a + g.criteria.length, 0)} criteria
                              </span>
                            </div>
                            {showRubric ? <ChevronUp size={12} className="text-white/40" /> : <ChevronDown size={12} className="text-white/40" />}
                          </button>
                          <AnimatePresence>
                            {showRubric && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 flex flex-col gap-2 border-t border-white/[0.06]">
                                  {evalRubric.map((group, gi) => (
                                    <div key={gi} className="mt-2">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">{group.group}</span>
                                        <span className="text-[9px] text-white/35">{group.criteria.length} pts</span>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {group.criteria.map((c, ci) => (
                                          <div key={ci} className="flex items-start gap-2">
                                            <CircleCheck size={9} className="flex-shrink-0 mt-0.5 text-white/20" />
                                            <span className="text-[11px] text-white/55 leading-relaxed">{c.question}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="mt-1 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                                    <span className="text-[10px] text-white/40">Edit rubric in Settings → Evaluation Prompts</span>
                                    <span className="text-[9.5px] px-1.5 py-0.5 rounded border border-white/[0.08] text-white/35">
                                      {evalRubric.reduce((a, g) => a + g.criteria.length, 0)} / {evalRubric.reduce((a, g) => a + g.criteria.length, 0)} pts max
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Time limit — always visible, manager-editable */}
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-[10px] border border-white/[0.07] bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-white/80">Time Limit</span>
                          {!isManagerOrAdmin && (
                            <span className="flex items-center gap-0.5 text-[9px] text-white/40 border border-white/[0.08] px-1.5 py-0.5 rounded">
                              <Lock size={7} /> Manager only
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isManagerOrAdmin ? (
                            <>
                              <input
                                type="number"
                                min={1}
                                max={120}
                                value={timeLimitMins}
                                onChange={e => setTimeLimitMins(e.target.value)}
                                className="input-base w-14 text-[12.5px] text-center"
                              />
                              <span className="text-[12px] text-white/60">min</span>
                            </>
                          ) : (
                            <span className="text-[13px] font-bold text-white/80">{timeLimitMins || '3'} min</span>
                          )}
                        </div>
                      </div>

                      {/* Advanced */}
                      <div className="border border-white/[0.07] rounded-[12px] overflow-hidden">
                        <button onClick={() => setShowAdvanced(v => !v)} className="flex items-center justify-between w-full p-3.5 hover:bg-white/[0.02] transition-colors">
                          <div className="flex items-center gap-2">
                            <Settings size={12} className="text-white/70" />
                            <span className="text-[12.5px] font-medium text-white/80">Advanced Settings</span>
                          </div>
                          {showAdvanced ? <ChevronUp size={13} className="text-white/70" /> : <ChevronDown size={13} className="text-white/70" />}
                        </button>
                        <AnimatePresence>
                          {showAdvanced && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/[0.06] pt-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <span className="text-[12.5px] font-medium">Natural End Conversation</span>
                                    <p className="text-[11px] text-white/75 mt-0.5">AI ends call when scenario concludes.</p>
                                  </div>
                                  <button onClick={() => setAiCanEnd(v => !v)} role="switch" aria-checked={aiCanEnd} className={clsx('relative flex-shrink-0 w-9 h-5 rounded-full transition-colors mt-0.5', aiCanEnd ? 'bg-accent' : 'bg-white/[0.18]')}>
                                    <span className={clsx('absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform', aiCanEnd ? 'translate-x-4' : 'translate-x-0')} />
                                  </button>
                                </div>
                                <textarea value={endCondition} onChange={e => setEndCondition(e.target.value)} placeholder="Describe when AI should end call (optional)…" disabled={!aiCanEnd} className={clsx('input-base resize-none min-h-[60px] text-[12px]', !aiCanEnd && 'opacity-35 pointer-events-none')} />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Save + Start */}
                      <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.06]">
                        <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-white/[0.03] border border-white/[0.07]">
                          <div className="w-6 h-6 rounded-[7px] bg-accent/[0.1] flex items-center justify-center flex-shrink-0">
                            <BookOpen size={12} className="text-accent/70" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11.5px] font-medium text-white/70">{isManagerOrAdmin ? 'Save for Team' : 'Save Roleplay'}</p>
                            <p className="text-[10px] text-white/70">{isManagerOrAdmin ? 'Publish so your team can practice' : 'Save to reuse in future sessions'}</p>
                          </div>
                          {isManagerOrAdmin ? (
                            <div className="relative flex-shrink-0">
                              <div className="flex items-stretch rounded-[7px] border border-accent/25 overflow-hidden">
                                <button
                                  onClick={() => openSaveModal()}
                                  disabled={!isReady}
                                  className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1.5 text-accent/80 hover:text-accent hover:bg-accent/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setShowSaveDropdown(v => !v)}
                                  disabled={!isReady}
                                  className="flex items-center px-1.5 border-l border-accent/20 text-accent/50 hover:text-accent hover:bg-accent/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                >
                                  <ChevronDown size={11} />
                                </button>
                              </div>
                              {showSaveDropdown && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setShowSaveDropdown(false)} />
                                  <div className="absolute right-0 bottom-full mb-1 z-50 rounded-[10px] border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden min-w-[190px]" style={{ background: 'var(--bg2)' }}>
                                    <button onClick={() => openSaveModal('all')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                                      <User size={12} className="text-white/50" /> Save for All Users
                                    </button>
                                    <button onClick={() => openSaveModal('team')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                                      <Layers size={12} className="text-white/50" /> Share with Team
                                    </button>
                                    <button onClick={() => openSaveModal('individual')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12px] text-white/80 hover:bg-white/[0.06] hover:text-white transition-colors text-left">
                                      <User size={12} className="text-white/50" /> Share with Individual
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => openSaveModal()}
                              disabled={!isReady}
                              className="flex items-center gap-1.5 text-[11.5px] font-medium px-2.5 py-1.5 rounded-[7px] border border-accent/25 text-accent/80 hover:text-accent hover:border-accent hover:bg-accent/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
                            >
                              Save
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => goToStep(3)} className="btn-ghost gap-1.5 text-[13px]"><ArrowLeft size={12} /> Knowledge</button>
                          <button onClick={handleStart} disabled={starting || !isReady} className="flex-1 btn-primary gap-2 py-2.5 text-[13.5px] justify-center disabled:opacity-40">
                            {starting ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><Play size={14} /> Start Session</>}
                          </button>
                        </div>
                        {!isReady && <p className="text-[11px] text-amber-400/60 text-center">Complete Persona and Context steps first</p>}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Saved Persona picker ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPersonaPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPersonaPicker(false)}>
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-bg-2 border border-white/10 rounded-[18px] p-6 w-full max-w-md shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-[15px]">Saved Personas</h3>
                <div className="flex items-center gap-2">
                  {canCreatePersona && <button onClick={() => { setShowPersonaPicker(false); setShowBuilder(true); }} className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 font-medium"><Plus size={11} /> Create</button>}
                  <button onClick={() => setShowPersonaPicker(false)} className="text-white/70 hover:text-white"><X size={16} /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                {dbPersonas.map(p => (
                  <button key={p.id} onClick={() => applyDbPersona(p)} className="flex items-center gap-2.5 p-3 rounded-[10px] border border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03] text-left transition-all">
                    <span className="text-xl flex-shrink-0">{p.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate">{p.name}</div>
                      <div className="text-[10.5px] text-white/75 truncate">{p.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pre-call briefing ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBriefing && pendingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--bg)] overflow-y-auto p-4 md:p-8"
          >
            <PreCallBriefing
              personaName={pendingSession.personaDisplay.name}
              personaTitle={pendingSession.personaDisplay.title}
              avatarId={avatarId}
              industry={industry}
              roleplayType={roleplayType}
              difficulty={difficulty}
              sessionType={sessionType}
              briefing={userBriefing}
              onReady={() => {
                setShowBriefing(false);
                setActiveSession(pendingSession);
                setPendingSession(null);
              }}
              onSkip={() => {
                setShowBriefing(false);
                setActiveSession(pendingSession);
                setPendingSession(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Call / Meeting interface ───────────────────────────────────────────── */}
      <AnimatePresence>
        {activeSession && sessionType === 'PHONE_CALL' && (
          <CallInterface
            sessionId={activeSession.id}
            persona={activeSession.personaDisplay}
            sessionType={sessionType}
            framework={framework}
            timeLimitMins={timeLimitMins ? parseInt(timeLimitMins, 10) || null : null}
            onEnd={sid => { setActiveSession(null); navigate(`/sessions/${sid}/feedback`); }}
          />
        )}
        {activeSession && sessionType === 'ONLINE_MEETING' && (
          <OnlineMeetingRoom
            sessionId={activeSession.id}
            persona={activeSession.personaDisplay}
            sessionType={sessionType}
            framework={framework}
            timeLimitMins={timeLimitMins ? parseInt(timeLimitMins, 10) || null : null}
            multiPersonas={multiPersonaEnabled && multiAttendees.length > 0
              ? multiAttendees.slice(1).map(a => ({
                  name: a.name, title: a.title, emoji: '', avatarId: a.avatarId,
                }))
              : []}
            onEnd={sid => { setActiveSession(null); navigate(`/sessions/${sid}/feedback`); }}
          />
        )}
      </AnimatePresence>

      {/* ── Voice picker modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {voiceModalOpen && (
          <VoicePickerModal
            avatarId={avatarId}
            value={selectedVoiceId}
            onSelect={setSelectedVoiceId}
            onClose={() => setVoiceModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Persona builder ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBuilder && (
          <PersonaBuilder
            onCreated={p => { setDbPersonas(prev => [...prev, p]); applyDbPersona(p); setShowBuilder(false); }}
            onClose={() => setShowBuilder(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Save as Team Roleplay modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {showSaveModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
            <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }} onClick={e => e.stopPropagation()} className="bg-bg-2 border border-white/10 rounded-[18px] p-6 w-full max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-display font-bold text-[16px]">
                    {isManagerOrAdmin
                      ? assignScope === 'individual' ? 'Share with Individual'
                      : assignScope === 'team' ? 'Share with Team'
                      : 'Save for All Users'
                      : 'Save Roleplay'}
                  </h3>
                  <p className="text-[11.5px] text-white/75 mt-0.5">
                    {isManagerOrAdmin
                      ? 'Assign to teammates and configure access.'
                      : 'Saved to "Created by Me" — reuse it anytime.'}
                  </p>
                </div>
                <button onClick={() => setShowSaveModal(false)} className="text-white/70 hover:text-white"><X size={16} /></button>
              </div>

              {/* Persona preview */}
              <div className="flex items-center gap-3 p-3 rounded-[10px] bg-white/[0.04] border border-white/[0.07] mb-4">
                <div className="rounded-full overflow-hidden flex-shrink-0"><AvatarDisplay avatarId={avatarId} size={40} /></div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate">{displayName}</div>
                  <div className="text-[11px] text-white/80">{industry}{roleplayType && ` · ${roleplayType}`}</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Name & Description */}
                <div>
                  <label className="text-[11px] text-white/80 block mb-1.5">Name <span className="text-accent-4">*</span></label>
                  <input value={saveRoleplayName} onChange={e => setSaveRoleplayName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveRoleplay()} placeholder={industry ? `${industry} ${roleplayType}` : 'Enter name…'} className="input-base text-[13px] w-full" maxLength={80} autoFocus />
                </div>
                <div>
                  <label className="text-[11px] text-white/80 block mb-1.5">Description <span className="text-white/65">(optional)</span></label>
                  <textarea value={saveRoleplayDesc} onChange={e => setSaveRoleplayDesc(e.target.value)} placeholder="Brief note about this scenario…" className="input-base resize-none text-[12.5px] w-full min-h-[60px]" maxLength={200} />
                </div>

                {/* Assignment targeting — managers/admins only */}
                {isManagerOrAdmin && (
                  <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col gap-3">
                    <p className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Assign To</p>

                    {/* Scope selector */}
                    <div className="grid grid-cols-2 gap-2">
                      {(['all', 'team', 'region', 'individual'] as AssignmentScope[]).map(scope => {
                        const labels: Record<AssignmentScope, string> = { all: 'All Users', team: 'Team(s)', region: 'Region(s)', individual: 'Individuals' };
                        const icons: Record<AssignmentScope, React.ReactNode> = {
                          all: <User size={11} />,
                          team: <Layers size={11} />,
                          region: <Globe size={11} />,
                          individual: <User size={11} />,
                        };
                        const active = assignScope === scope;
                        return (
                          <button
                            key={scope}
                            onClick={() => setAssignScope(scope)}
                            className={clsx(
                              'flex items-center gap-2 px-3 py-2 rounded-[9px] text-[12px] border transition-all',
                              active
                                ? 'bg-accent/10 border-accent text-accent'
                                : 'border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.05]',
                            )}
                          >
                            {icons[scope]}
                            {labels[scope]}
                          </button>
                        );
                      })}
                    </div>

                    {/* Summary line */}
                    <p className="text-[11px] text-white/50">
                      {assignScope === 'all' && 'Everyone in your company will see this roleplay.'}
                      {assignScope === 'team' && (assignTeams.length > 0 ? `Assigned to: ${assignTeams.join(', ')}` : 'Select one or more teams below.')}
                      {assignScope === 'region' && (assignRegions.length > 0 ? `Assigned to: ${assignRegions.join(', ')}` : 'Select one or more regions below.')}
                      {assignScope === 'individual' && (assignUserIds.length > 0 ? `${assignUserIds.length} user(s) selected.` : 'Search and select individual users below.')}
                    </p>

                    {/* Team picker */}
                    {assignScope === 'team' && targetOptions && (
                      <div className="flex flex-wrap gap-1.5">
                        {targetOptions.teams.map(t => {
                          const sel = assignTeams.includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => setAssignTeams(prev => sel ? prev.filter(x => x !== t) : [...prev, t])}
                              className={clsx(
                                'px-2.5 py-1 rounded-full text-[11px] border transition-all',
                                sel ? 'bg-accent/15 border-accent/50 text-accent' : 'border-white/10 text-white/60 hover:border-white/30',
                              )}
                            >
                              {sel && <Check size={9} className="inline mr-1" />}{t}
                            </button>
                          );
                        })}
                        {targetOptions.teams.length === 0 && <p className="text-[11px] text-white/40">No teams found.</p>}
                      </div>
                    )}

                    {/* Region picker */}
                    {assignScope === 'region' && targetOptions && (
                      <div className="flex flex-wrap gap-1.5">
                        {targetOptions.regions.map(r => {
                          const sel = assignRegions.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => setAssignRegions(prev => sel ? prev.filter(x => x !== r) : [...prev, r])}
                              className={clsx(
                                'px-2.5 py-1 rounded-full text-[11px] border transition-all',
                                sel ? 'bg-accent/15 border-accent/50 text-accent' : 'border-white/10 text-white/60 hover:border-white/30',
                              )}
                            >
                              {sel && <Check size={9} className="inline mr-1" />}{r}
                            </button>
                          );
                        })}
                        {targetOptions.regions.length === 0 && <p className="text-[11px] text-white/40">No regions found.</p>}
                      </div>
                    )}

                    {/* Individual user picker */}
                    {assignScope === 'individual' && targetOptions && (
                      <div className="flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                        {targetOptions.users.map(u => {
                          const sel = assignUserIds.includes(u.id);
                          return (
                            <button
                              key={u.id}
                              onClick={() => setAssignUserIds(prev => sel ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                              className={clsx(
                                'flex items-center gap-2.5 px-3 py-2 rounded-[9px] border text-left transition-all',
                                sel ? 'bg-accent/10 border-accent/40' : 'border-white/[0.07] hover:bg-white/[0.04]',
                              )}
                            >
                              <div className={clsx('w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors', sel ? 'bg-accent border-accent' : 'border-white/20')}>
                                {sel && <Check size={10} color="white" />}
                              </div>
                              <span className="text-[12px] font-medium flex-1">{u.name}</span>
                              <span className="text-[10px] text-white/40">{[u.team, u.region].filter(Boolean).join(' · ')}</span>
                            </button>
                          );
                        })}
                        {targetOptions.users.length === 0 && <p className="text-[11px] text-white/40">No users found.</p>}
                      </div>
                    )}

                    {/* Loading state */}
                    {!targetOptions && (
                      <div className="flex items-center gap-2 text-[11px] text-white/40">
                        <Loader2 size={12} className="animate-spin" /> Loading options…
                      </div>
                    )}

                    {/* Peer listening toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <div>
                        <p className="text-[12px] font-medium text-white/80">Allow peer listening</p>
                        <p className="text-[10.5px] text-white/45 mt-0.5">Team members can replay each other's sessions.</p>
                      </div>
                      <button
                        onClick={() => setAllowPeerListening(v => !v)}
                        className={clsx(
                          'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                          allowPeerListening ? 'bg-accent' : 'bg-white/20',
                        )}
                      >
                        <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', allowPeerListening ? 'translate-x-5' : 'translate-x-0.5')} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={() => setShowSaveModal(false)} className="btn-ghost flex-1">Cancel</button>
                <button onClick={handleSaveRoleplay} disabled={savingRoleplay || !saveRoleplayName.trim()} className="btn-primary flex-1 gap-1.5 disabled:opacity-50">
                  {savingRoleplay ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : (isManagerOrAdmin ? 'Save & Assign' : 'Save Roleplay')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Quick Launch modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {quickLaunchData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setQuickLaunchData(null)}
          >
            <motion.div
              initial={{ scale: 0.97, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-bg-2 border border-white/10 sm:rounded-[18px] rounded-t-[20px] w-full sm:max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.6)] flex flex-col max-h-[92vh] sm:max-h-[90vh]"
            >
              {/* Drag handle on mobile */}
              <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>
              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-4 py-4 sm:p-6 flex flex-col gap-4">
                {/* Persona header */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0 mt-0.5">
                    <AvatarDisplay avatarId={avatarId} size={56} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-[16px] sm:text-[17px] font-bold leading-tight truncate">{displayName}</div>
                    {displayTitle && <div className="text-[12px] sm:text-[12.5px] text-white/65 mt-0.5 truncate">{displayTitle}</div>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', DIFFICULTY_COLORS[difficulty] || 'text-white/80 bg-white/5 border-white/10')}>{difficulty}</span>
                      {industry && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/70">{industry}</span>}
                      {roleplayType && <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/70">{roleplayType}</span>}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 border border-accent/20 text-accent/70 flex items-center gap-1">
                        <Globe size={9} /> {language || 'English'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setQuickLaunchData(null)}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/50 hover:text-white transition-all"
                    aria-label="Close"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Tabbed: Scenario Context / Knowledge / Questions */}
                {(() => {
                  const hasKnowledge = userBriefing.length > 0;
                  const hasQuestions = suggestedQuestions.length > 0;
                  const tabs = [
                    ...(personaContext ? [{ id: 'context', label: 'Scenario Context' }] : []),
                    ...(hasKnowledge   ? [{ id: 'knowledge', label: `Knowledge (${userBriefing.length})` }] : []),
                    ...(hasQuestions   ? [{ id: 'questions', label: 'Expect Questions' }] : []),
                  ];
                  if (tabs.length === 0) return null;

                  return (
                    <QuickLaunchTabs
                      tabs={tabs}
                      personaContext={personaContext}
                      userBriefing={userBriefing}
                      suggestedQuestions={suggestedQuestions}
                    />
                  );
                })()}
              </div>

              {/* Sticky footer */}
              <div className="flex-shrink-0 px-4 py-4 sm:px-6 border-t border-white/[0.07] flex flex-col gap-3">
                {/* Call format */}
                <div>
                  <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Call Format</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setSessionType('PHONE_CALL')}
                      className={clsx(
                        'flex items-center gap-2 justify-center px-3 py-2 rounded-[10px] border text-[12.5px] sm:text-[13px] font-medium transition-all',
                        sessionType === 'PHONE_CALL' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/70 hover:text-white hover:bg-white/[0.05]'
                      )}
                    >
                      <Phone size={13} /> Phone Call
                    </button>
                    <button
                      onClick={() => setSessionType('ONLINE_MEETING')}
                      className={clsx(
                        'flex items-center gap-2 justify-center px-3 py-2 rounded-[10px] border text-[12.5px] sm:text-[13px] font-medium transition-all',
                        sessionType === 'ONLINE_MEETING' ? 'bg-accent/10 border-accent text-accent' : 'border-white/10 text-white/70 hover:text-white hover:bg-white/[0.05]'
                      )}
                    >
                      <Monitor size={13} /> Online
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => setQuickLaunchData(null)} className="btn-ghost flex-shrink-0 px-3 sm:px-4 text-[13px]">
                    Cancel
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={starting || !isReady}
                    className="flex-1 btn-primary gap-2 py-2.5 text-[13.5px] sm:text-[14px] justify-center disabled:opacity-40"
                  >
                    {starting ? <><Loader2 size={14} className="animate-spin" /> Starting…</> : <><Play size={14} /> Start Session</>}
                  </button>
                </div>
                {!isReady && (
                  <p className="text-[11px] text-amber-400/60 text-center">Missing persona context or industry</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GalleryCard({
  avatarId, name, subtitle, industry, type, difficulty,
  timeLimitMins, metaLabel, description, badge, canEdit, sessionType, hasKnowledge,
  onSelect, onEdit, onDelete,
}: {
  avatarId?: string;
  name: string;
  subtitle?: string;
  industry: string;
  type: string;
  difficulty: string;
  timeLimitMins?: number | null;
  metaLabel?: string;
  description?: string;
  badge?: string;
  canEdit?: boolean;
  sessionType?: SessionType;
  hasKnowledge?: boolean;
  onSelect: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}) {
  const diffColor = ({
    Easy:   'text-accent-3 bg-accent-3/10 border-accent-3/20',
    Medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    Hard:   'text-accent-4 bg-accent-4/10 border-accent-4/20',
    Expert: 'text-rose-400 bg-rose-400/10 border-rose-400/20',
  } as Record<string, string>)[difficulty] ?? 'text-white/80 bg-white/5 border-white/10';

  const displayMins = timeLimitMins ?? 3;
  const isOnline = sessionType === 'ONLINE_MEETING';

  return (
    <div
      onClick={onSelect}
      className="group card p-3 sm:p-4 cursor-pointer hover:border-white/15 hover:bg-white/[0.02] transition-all flex gap-3 sm:gap-4 items-start"
    >
      <div className="flex-shrink-0 rounded-full overflow-hidden ring-2 ring-white/[0.07] group-hover:ring-accent/25 transition-all mt-0.5">
        <AvatarDisplay avatarId={avatarId} size={48} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 justify-between">
          <div className="min-w-0">
            <div className="font-semibold text-[13px] leading-snug truncate">{name}</div>
            {subtitle && <div className="text-[11.5px] text-white/70 mt-0.5 truncate">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Session type pill */}
            {sessionType && (
              <span className={clsx(
                'hidden xs:flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0',
                isOnline
                  ? 'text-sky-400 bg-sky-400/10 border-sky-400/20'
                  : 'text-white/60 bg-white/[0.04] border-white/[0.1]',
              )}>
                {isOnline ? <Monitor size={8} /> : <Phone size={8} />}
                {isOnline ? 'Online' : 'Phone'}
              </span>
            )}
            {/* Time limit badge */}
            <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border border-white/[0.1] bg-white/[0.04] text-white/55 font-medium flex-shrink-0">
              {displayMins}m
            </span>
            {/* Knowledge base indicator */}
            {hasKnowledge && (
              <span
                title="Has knowledge base content"
                className="flex items-center justify-center w-5 h-5 rounded-full border border-accent/25 bg-accent/10 text-accent/70 flex-shrink-0"
              >
                <Database size={9} />
              </span>
            )}
            {canEdit && (
              <>
                {onEdit && (
                  <button onClick={onEdit} title="Edit roleplay" className="w-6 h-6 flex items-center justify-center rounded-[6px] bg-white/[0.05] hover:bg-white/[0.12] text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-all">
                    <Pencil size={10} />
                  </button>
                )}
                {onDelete && (
                  <button onClick={onDelete} title="Delete roleplay" className="w-6 h-6 flex items-center justify-center rounded-[6px] bg-accent-4/10 hover:bg-accent-4/20 text-accent-4/60 hover:text-accent-4 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={10} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {description && <p className="text-[11.5px] text-white/65 mt-1.5 line-clamp-2 leading-relaxed">{description}</p>}

        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-white/70">{industry}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.07] text-white/70">{type}</span>
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded border', diffColor)}>{difficulty}</span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/[0.08] border border-accent/15 text-accent/80">{badge}</span>
          )}
          {metaLabel && <span className="text-[10px] text-white/50 ml-auto">{metaLabel}</span>}
        </div>
      </div>
    </div>
  );
}
