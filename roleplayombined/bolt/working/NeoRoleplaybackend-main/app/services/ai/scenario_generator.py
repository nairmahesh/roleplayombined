import json
from typing import Optional
from openai import AsyncOpenAI
from app.config import settings

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def generate_scenario(keywords: str, industry: str, roleplay_type: str) -> dict:
    prompt = f"""You are a sales training expert. Generate a detailed, realistic roleplay scenario.

Industry: {industry}
Roleplay Type: {roleplay_type}
Keywords/Context: {keywords}

Return ONLY a valid JSON object with these exact fields:
{{
  "personaContext": "<Full 3-paragraph scenario. Paragraph 1: Who the persona is (name, role, company, background). Paragraph 2: Their current situation, pain points, and relevant context. Paragraph 3: How they behave — personality, communication style, buying criteria, objections they'll raise, and what would impress them.>",
  "displayName": "<Short role title, e.g. 'VP of Sales'>",
  "displayTitle": "<Full title + company, e.g. 'VP of Sales, Accenture'>",
  "displayEmoji": "<Single relevant emoji>",
  "difficulty": "<Easy|Medium|Hard|Expert>",
  "suggestedQuestions": ["<6 sharp, realistic questions this persona would ask during the conversation>"]
}}

Make the persona specific, believable, and challenging. The scenario must be grounded in real business context."""

    response = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=1200,
        temperature=0.8,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)
    return {
        "personaContext": data.get("personaContext", ""),
        "displayName": data.get("displayName", "Prospect"),
        "displayTitle": data.get("displayTitle", ""),
        "displayEmoji": data.get("displayEmoji", "🧑‍💼"),
        "difficulty": data.get("difficulty", "Medium"),
        "suggestedQuestions": data.get("suggestedQuestions", []),
    }


async def generate_questions(persona_context: str, roleplay_type: str) -> list[str]:
    prompt = f"""You are a sales training expert. Based on this roleplay scenario, generate 6 sharp, realistic questions this persona would ask during a {roleplay_type}.

Scenario:
{persona_context[:2000]}

Return ONLY a valid JSON object:
{{"questions": ["<question 1>", "<question 2>", "<question 3>", "<question 4>", "<question 5>", "<question 6>"]}}

Questions should be specific to the scenario, challenging, and reflect what a real professional in this role would ask."""

    response = await get_client().chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=400,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.choices[0].message.content
    data = json.loads(raw)
    return data.get("questions", [])
