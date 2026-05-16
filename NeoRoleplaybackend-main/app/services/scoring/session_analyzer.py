import json
import asyncio
from typing import Optional
from loguru import logger
from openai import AsyncOpenAI

from app.config import settings

FRAMEWORK_COMPONENTS = {
    "MEDDIC": ["Metrics", "Economic Buyer", "Decision Criteria", "Decision Process", "Identify Pain", "Champion"],
    "MEDDICC": ["Metrics", "Economic Buyer", "Decision Criteria", "Decision Process", "Identify Pain", "Champion", "Competition"],
    "SPIN": ["Situation Questions", "Problem Questions", "Implication Questions", "Need-Payoff Questions"],
    "BANT": ["Budget", "Authority", "Need", "Timeline"],
    "CHALLENGER": ["Teaching", "Tailoring", "Taking Control"],
    "SNAP": ["Simple", "iNvaluable", "Aligned", "Priority"],
}


async def analyze_session(session_id: str, messages: list[dict], framework: str, sio=None) -> Optional[dict]:
    try:
        transcript_text = "\n".join(
            f"{'Rep' if m['role'] == 'user' else 'Prospect'} [{m['timestampMs']}ms]: {m['content']}"
            for m in messages
        )
        components = FRAMEWORK_COMPONENTS.get(framework, [])
        component_list = "\n".join(f"- {c}" for c in components)

        prompt = f"""You are an expert sales coach analyzing a mock sales call.

FRAMEWORK: {framework}
COMPONENTS TO SCORE:
{component_list}

TRANSCRIPT:
{transcript_text}

Analyze this call and return ONLY valid JSON in this exact structure:
{{
  "overallScore": <0-100>,
  "grade": "<A+|A|B+|B|C|D>",
  "overallFeedback": "<executive summary 2-3 sentences>",
  "frameworkScores": [
    {{
      "component": "<component name>",
      "score": <0-100>,
      "feedback": "<specific feedback>",
      "evidence": ["<direct quote from transcript>"]
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
      "transcriptRef": "<exact quote from the rep's transcript>",
      "betterResponse": "<for ISSUE and WARNING only: a concrete alternative the rep could have said instead, written as a natural spoken sentence — null for GOOD and NEUTRAL>"
    }}
  ],
  "strengths": ["<strength>"],
  "improvements": ["<improvement>"],
  "coachingTip": "<single most impactful tip>"
}}"""

        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=1500,
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are an expert sales coach. Always respond with valid JSON only, no markdown or prose."},
                {"role": "user", "content": prompt},
            ],
        )

        raw = response.choices[0].message.content.strip()
        analysis = json.loads(raw)

        # Persist results via direct DB import to avoid circular dep
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
                "grade": analysis.get("grade"),
                "overallFeedback": analysis.get("overallFeedback"),
                "skills": analysis.get("skills"),
                "strengths": analysis.get("strengths"),
                "improvements": analysis.get("improvements"),
                "proTip": analysis.get("coachingTip"),
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
                "sessionId": session_id,
                "overallScore": analysis.get("overallScore"),
                "grade": analysis.get("grade"),
            }, room=f"session:{session_id}")

        return analysis

    except Exception as e:
        logger.error(f"analyzeSession failed for {session_id}: {e}")
        if sio:
            await sio.emit("analysis:failed", {"sessionId": session_id}, room=f"session:{session_id}")
        return None
