import json
import asyncio
from typing import Optional
from loguru import logger
from openai import AsyncOpenAI

from app.config import settings

# ── Framework methodology components (secondary scoring layer) ────────────────

FRAMEWORK_COMPONENTS = {
    "MEDDIC":    ["Metrics", "Economic Buyer", "Decision Criteria", "Decision Process", "Identify Pain", "Champion"],
    "MEDDICC":   ["Metrics", "Economic Buyer", "Decision Criteria", "Decision Process", "Identify Pain", "Champion", "Competition"],
    "SPIN":      ["Situation Questions", "Problem Questions", "Implication Questions", "Need-Payoff Questions"],
    "BANT":      ["Budget", "Authority", "Need", "Timeline"],
    "CHALLENGER":["Teaching", "Tailoring", "Taking Control"],
    "SNAP":      ["Simple", "iNvaluable", "Aligned", "Priority"],
}

# ── Default rubric-based scoring criteria per roleplay type ───────────────────
# Each entry maps roleplay_type -> list of {group, criteria[{question, hint}]}
# These are overridable per company via the evaluation_prompts DB table.

DEFAULT_RUBRICS: dict[str, list[dict]] = {
    "cold_call": [
        {"group": "Opener", "criteria": [
            {"question": "Permission-based opener?", "hint": "Did the rep ask for a brief moment before pitching?"},
            {"question": "Used research on prospect?", "hint": "Referenced company-specific info to personalise the opener."},
        ]},
        {"group": "Discovery", "criteria": [
            {"question": "SDR asked for preconceptions of product?", "hint": "Asked about the prospect's current awareness before pitching."},
        ]},
        {"group": "Social Proof", "criteria": [
            {"question": "Provided social proof?", "hint": "Cited a relevant customer reference, metric, or case study."},
            {"question": "Asked if social proof was relevant?", "hint": "Checked whether the social proof resonated."},
        ]},
        {"group": "Takeaway", "criteria": [
            {"question": "Re-confirmed that the time works for the prospect?", "hint": "Verified timing before closing."},
            {"question": "Asked for success criteria for next call?", "hint": "Asked what a successful follow-up would look like."},
        ]},
        {"group": "Closing", "criteria": [
            {"question": "Next steps agreed upon?", "hint": "Both parties agreed on a clear next step."},
            {"question": "Follow-up meeting booked?", "hint": "Specific date/time confirmed."},
        ]},
    ],
    "discovery_call": [
        {"group": "Introduction & Agenda", "criteria": [
            {"question": "Did the seller discuss the agenda and ask for prospect's input?", "hint": "Set agenda AND asked what prospect wants to cover."},
            {"question": "Did the seller introduce an Upfront Contract?", "hint": "Established mutual expectations for the call outcome."},
        ]},
        {"group": "Pain & Metrics Discovery", "criteria": [
            {"question": "Did the seller uncover specific pain points?", "hint": "At least one concrete problem uncovered."},
            {"question": "Did the seller uncover relevant metrics?", "hint": "Quantified impact — time, revenue, or cost."},
        ]},
        {"group": "Objection Handling", "criteria": [
            {"question": "Did the seller handle objections effectively using the FFF framework?", "hint": "Acknowledged, empathised, reframed any objection."},
        ]},
        {"group": "Customer Reference & Value", "criteria": [
            {"question": "Did the seller present a customer reference?", "hint": "Referenced a similar customer and their outcome."},
            {"question": "Did the seller explore the prospect's goal-setting framework?", "hint": "Asked how they measure success."},
        ]},
        {"group": "Closing", "criteria": [
            {"question": "Did the seller revisit the upfront contract and define next steps?", "hint": "Referenced start of call and confirmed next steps."},
            {"question": "Did the seller qualify out or in effectively?", "hint": "Reached a clear conclusion about qualification."},
        ]},
    ],
    "sales_pitch": [
        {"group": "Value Proposition", "criteria": [
            {"question": "Did the seller open with a clear, specific value proposition?", "hint": "Value stated in prospect's language."},
            {"question": "Did the seller differentiate from competition?", "hint": "Explicitly addressed why they are different."},
        ]},
        {"group": "Business Case", "criteria": [
            {"question": "Did the seller build a ROI / business case?", "hint": "Quantified return or cost of inaction."},
            {"question": "Did the seller use a customer reference or proof point?", "hint": "Referenced a relevant case study."},
        ]},
        {"group": "Objection Handling", "criteria": [
            {"question": "Did the seller handle questions and objections confidently?", "hint": "Acknowledged, explored, reframed without defending."},
        ]},
        {"group": "Closing", "criteria": [
            {"question": "Did the seller define a clear next step?", "hint": "Specific, time-bound next action agreed."},
            {"question": "Did the seller confirm prospect's commitment to next step?", "hint": "Prospect verbally agreed."},
        ]},
    ],
    "objection_handling": [
        {"group": "Objection Response", "criteria": [
            {"question": "Did the seller acknowledge the objection without defending?", "hint": "Validated the concern before responding."},
            {"question": "Did the seller explore the root cause with a question?", "hint": "Asked a clarifying question to understand the objection."},
            {"question": "Did the seller provide relevant evidence or reframe?", "hint": "Addressed with a specific fact, story, or reframe."},
            {"question": "Did the seller confirm the objection was resolved?", "hint": "Checked the prospect was satisfied."},
            {"question": "Did the seller maintain momentum toward next step?", "hint": "Moved forward after resolving the objection."},
        ]},
    ],
    "negotiation": [
        {"group": "Negotiation Technique", "criteria": [
            {"question": "Did the seller anchor high before conceding?", "hint": "Started from a strong position."},
            {"question": "Did the seller trade concessions (not give without getting)?", "hint": "Every concession paired with a request."},
            {"question": "Did the seller protect margin and key terms?", "hint": "Avoided giving away price without protecting value."},
            {"question": "Did the seller reach a mutually agreed outcome?", "hint": "Both parties reached explicit agreement."},
            {"question": "Did the seller maintain relationship throughout?", "hint": "Tone stayed professional and collaborative."},
        ]},
    ],
    "account_expansion": [
        {"group": "Expansion Discovery", "criteria": [
            {"question": "Did the seller reference existing relationship or wins?", "hint": "Grounded conversation in proven value."},
            {"question": "Did the seller identify a new business need or expansion trigger?", "hint": "Found a new pain or growth opportunity."},
        ]},
        {"group": "Expansion Business Case", "criteria": [
            {"question": "Did the seller map to additional stakeholders?", "hint": "Identified new decision-makers for the expansion."},
            {"question": "Did the seller present an expansion business case with ROI?", "hint": "Quantified value of expanding."},
            {"question": "Did the seller define next steps for the expansion?", "hint": "Agreed on a specific expansion next step."},
        ]},
    ],
    "customer_support": [
        {"group": "Issue Resolution", "criteria": [
            {"question": "Did the rep acknowledge and empathise with the customer?", "hint": "Showed genuine understanding of frustration."},
            {"question": "Did the rep correctly diagnose the issue?", "hint": "Asked clarifying questions to understand root cause."},
            {"question": "Did the rep offer a clear solution or next step?", "hint": "Provided a specific resolution path."},
            {"question": "Did the rep set accurate expectations?", "hint": "Was honest about timelines and capabilities."},
            {"question": "Did the rep confirm customer satisfaction before closing?", "hint": "Checked customer was happy with resolution."},
        ]},
    ],
}

# Normalised roleplay type keys
_ROLEPLAY_ALIAS = {
    "cold call": "cold_call",
    "cold-call": "cold_call",
    "discovery call": "discovery_call",
    "discovery": "discovery_call",
    "discovery-call": "discovery_call",
    "sales pitch": "sales_pitch",
    "pitch": "sales_pitch",
    "objection handling": "objection_handling",
    "objection": "objection_handling",
    "account expansion": "account_expansion",
    "expansion": "account_expansion",
    "customer support": "customer_support",
    "support": "customer_support",
}


def _normalise_roleplay_type(raw: str) -> str:
    return _ROLEPLAY_ALIAS.get(raw.lower().strip(), raw.lower().strip().replace(" ", "_").replace("-", "_"))


def _build_rubric_section(groups: list[dict]) -> str:
    """Convert rubric groups into the prompt criteria block."""
    lines = []
    for g in groups:
        pts = len(g["criteria"])
        lines.append(f"\n{g['group']} ({pts} pt{'s' if pts > 1 else ''}):")
        for c in g["criteria"]:
            hint = f" [{c['hint']}]" if c.get("hint") else ""
            lines.append(f"  - {c['question']}{hint}")
    return "\n".join(lines)


async def _fetch_company_rubric(company_id: str, roleplay_type: str) -> Optional[list[dict]]:
    """Load company-specific rubric from evaluation_prompts table if exists."""
    try:
        from app.database import AsyncSessionLocal
        from sqlalchemy import text
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                text(
                    "SELECT scoring_criteria FROM evaluation_prompts "
                    "WHERE (company_id = :cid OR company_id IS NULL) "
                    "AND roleplay_type = :rt AND is_active = true "
                    "ORDER BY company_id DESC NULLS LAST LIMIT 1"
                ),
                {"cid": company_id, "rt": roleplay_type},
            )
            row = result.fetchone()
            if row and row[0]:
                return row[0] if isinstance(row[0], list) else json.loads(row[0])
    except Exception as e:
        logger.warning(f"Could not load company rubric: {e}")
    return None


async def analyze_session(
    session_id: str,
    messages: list[dict],
    framework: str,
    sio=None,
    roleplay_type: str = "",
    company_id: str = "",
) -> Optional[dict]:
    try:
        # Cap messages to last 20 to control token cost
        capped = messages[-20:]
        transcript_text = "\n".join(
            f"{'Rep' if m['role'] == 'user' else 'Prospect'} [{m['timestampMs']}ms]: {m['content']}"
            for m in capped
        )

        # ── Determine rubric ────────────────────────────────────────────────
        rt = _normalise_roleplay_type(roleplay_type) if roleplay_type else ""
        rubric_groups: list[dict] = []

        if rt and company_id:
            rubric_groups = await _fetch_company_rubric(company_id, rt) or []

        if not rubric_groups and rt:
            rubric_groups = DEFAULT_RUBRICS.get(rt, [])

        # ── Framework methodology components ────────────────────────────────
        components = FRAMEWORK_COMPONENTS.get(framework, [])
        component_list = "\n".join(f"- {c}" for c in components)

        # ── Build prompt ────────────────────────────────────────────────────
        rubric_section = ""
        if rubric_groups:
            rubric_section = f"""
ROLEPLAY SCORECARD RUBRIC ({rt.replace('_', ' ').title()}):
Score each criterion pass (true) or fail (false) with one sentence of evidence from the transcript.
{_build_rubric_section(rubric_groups)}

Include a "scorecardGroups" array in the JSON response using the structure below.
"""

        prompt = f"""You are an expert sales coach analyzing a mock sales call.

SALES METHODOLOGY FRAMEWORK: {framework}
METHODOLOGY COMPONENTS TO SCORE:
{component_list}
{rubric_section}
TRANSCRIPT:
{transcript_text}

Analyze this call and return ONLY valid JSON:
{{
  "overallScore": <0-100>,
  "grade": "<A+|A|B+|B|C|D>",
  "overallFeedback": "<executive summary 2-3 sentences>",
  "frameworkScores": [
    {{
      "component": "<methodology component name>",
      "score": <0-100>,
      "feedback": "<specific feedback 1-2 sentences>",
      "evidence": ["<direct quote or timestamp reference>"]
    }}
  ],
  "scorecardGroups": [
    {{
      "group": "<group name from rubric>",
      "maxPoints": <number of criteria in group>,
      "earnedPoints": <number of criteria passed>,
      "criteria": [
        {{
          "question": "<exact criterion question>",
          "passed": <true|false>,
          "reasoning": "<one sentence citing transcript evidence>"
        }}
      ]
    }}
  ],
  "skills": {{
    "opening": <0-100>,
    "discovery": <0-100>,
    "objectionHandling": <0-100>,
    "closing": <0-100>,
    "rapport": <0-100>
  }},
  "timelineEvents": [
    {{
      "type": "<ISSUE|GOOD|WARNING|NEUTRAL>",
      "timestampMs": <ms>,
      "title": "<short title>",
      "description": "<what happened>",
      "suggestion": "<coaching suggestion — required for ISSUE and WARNING>",
      "transcriptRef": "<exact quote from rep's transcript>",
      "betterResponse": "<for ISSUE/WARNING: a natural spoken alternative — null for GOOD/NEUTRAL>"
    }}
  ],
  "strengths": ["<strength>"],
  "improvements": ["<specific improvement>"],
  "coachingTip": "<single most impactful coaching tip>"
}}

Return empty array [] for scorecardGroups if no rubric was provided."""

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=2000,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert sales coach. Always respond with valid JSON only, no markdown or prose."},
                {"role": "user", "content": prompt},
            ],
        )

        raw = response.choices[0].message.content.strip()
        analysis = json.loads(raw)

        # ── Persist results ─────────────────────────────────────────────────
        from app.database import AsyncSessionLocal
        from app.models.session import Session, FrameworkScore, TimelineEvent
        from app.models.enums import TimelineEventType, SessionStatus
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Session).where(Session.id == session_id))
            session = result.scalar_one_or_none()
            if not session:
                return None

            session.totalScore = analysis.get("overallScore")
            session.aiFeedback = json.dumps({
                "grade":           analysis.get("grade"),
                "overallFeedback": analysis.get("overallFeedback"),
                "skills":          analysis.get("skills"),
                "strengths":       analysis.get("strengths"),
                "improvements":    analysis.get("improvements"),
                "proTip":          analysis.get("coachingTip"),
                "scorecardGroups": analysis.get("scorecardGroups", []),
            })

            for fs in analysis.get("frameworkScores", []):
                db.add(FrameworkScore(
                    sessionId=session_id,
                    component=fs["component"],
                    score=fs["score"],
                    feedback=fs["feedback"],
                    evidence=fs.get("evidence", []),
                ))

            for evt in analysis.get("timelineEvents", []):
                try:
                    evt_type = TimelineEventType(evt["type"])
                except ValueError:
                    evt_type = TimelineEventType.NEUTRAL
                db.add(TimelineEvent(
                    sessionId=session_id,
                    type=evt_type,
                    timestampMs=evt.get("timestampMs", 0),
                    title=evt["title"],
                    description=evt["description"],
                    suggestion=evt.get("suggestion"),
                    transcriptRef=evt.get("transcriptRef"),
                    betterResponse=evt.get("betterResponse"),
                ))

            await db.commit()

        if sio:
            await sio.emit("analysis:complete", {
                "sessionId":   session_id,
                "overallScore": analysis.get("overallScore"),
                "grade":        analysis.get("grade"),
            }, room=f"session:{session_id}")

        return analysis

    except Exception as e:
        logger.error(f"analyzeSession failed for {session_id}: {e}")
        if sio:
            await sio.emit("analysis:failed", {"sessionId": session_id}, room=f"session:{session_id}")
        return None
