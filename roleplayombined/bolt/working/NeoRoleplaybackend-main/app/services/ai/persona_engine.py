from typing import Optional, AsyncIterator
from openai import AsyncOpenAI

from app.config import settings

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


# ── Emotional state — drives how the character feels, not rules to follow ─────
DIFFICULTY_FLAVOR = {
    "EASY":   "You're in a good mood and genuinely open. You give the caller room and warm up when they say something relevant.",
    "MEDIUM": "You're professional but busy. You push back on vague answers and only engage when they earn it with something specific.",
    "HARD":   "You're skeptical and short on time. Weak pitches irritate you and you say so. After two useless exchanges you cut the call.",
    "EXPERT": "You're ice-cold. One fumble and you're done. Hard facts only. Anything vague gets a hang-up.",
}

# ── Role personality — one line per seniority level ──────────────────────────
SENIORITY_FLAVOR = {
    "c-suite":     "You think in outcomes, not features. Very short sentences. Get to the point or you're done.",
    "vp-director": "You care about team results. You'll listen if it's relevant. You ask direct, pointed questions.",
    "manager":     "Engaged but cautious. You ask detailed questions and need to justify decisions upward.",
    "gatekeeper":  "You screen callers. Polite but immovable. You reveal nothing and let nobody through without a real reason.",
}


def _seniority_key(title: str) -> str:
    t = title.lower()
    if any(x in t for x in ["ceo", "cto", "cfo", "coo", "ciso", "chief"]):
        return "c-suite"
    if any(x in t for x in ["vp", "vice president", "director", "head of"]):
        return "vp-director"
    if any(x in t for x in ["assistant", "coordinator", "gatekeeper", "receptionist", "secretary"]):
        return "gatekeeper"
    return "manager"


# ── Shared prompt builders ────────────────────────────────────────────────────

def _build_scenario_prompt(scenario: dict, history: list[dict], user_message: str) -> tuple[str, list[dict]]:
    difficulty    = (scenario.get("difficulty") or "MEDIUM").upper()
    display_title = (scenario.get("displayTitle") or "").strip()
    display_name  = (scenario.get("displayName") or "").strip()
    seniority_key = _seniority_key(display_title)
    language      = (scenario.get("language") or "English").strip()
    objections    = scenario.get("objections", [])
    ai_can_end    = scenario.get("aiCanEnd", True)
    end_condition = (scenario.get("endCondition") or "").strip()
    time_limit    = scenario.get("timeLimitMins")

    interrupted = user_message.startswith("[interrupted]")
    clean_msg   = user_message[len("[interrupted]"):].strip() if interrupted else user_message

    messages = [{"role": m["role"], "content": m["content"]} for m in history[-12:]]
    messages.append({"role": "user", "content": clean_msg})

    name_line = f"You are {display_name}" if display_name else "You are the prospect"
    if display_title:
        name_line += f", {display_title}"
    name_line += "."

    system = f"""{name_line}

{scenario['personaContext']}

---
You're on a call right now. The context above is your world and your mindset — it is NOT foreknowledge of why this specific person is calling. You don't know their reason until they tell you. If they haven't explained it yet, just respond naturally and wait ("What's this about?" or simply be brief).

{DIFFICULTY_FLAVOR.get(difficulty, DIFFICULTY_FLAVOR['MEDIUM'])}
{SENIORITY_FLAVOR[seniority_key]}

Reply in 1-2 spoken sentences. Short. Direct. Unscripted — like you'd actually talk. React to what was ACTUALLY SAID. No corporate-speak, no lists, no markdown. If you don't understand something, say so plainly. You are not a coach or an AI. You are a real person with real stakes.

If the caller says something completely off-topic — personal questions, small talk unrelated to this call, or anything outside the business context — stay in character and redirect briefly ("I'm not sure how that's relevant, but..." or "Let's stay focused here..."). Never break character. Never answer as an AI."""

    if interrupted:
        system += "\n\nThey just cut you off. React in one short phrase, then wait."

    if objections:
        system += f"\n\nRaise these naturally when the moment fits — one at a time, never all at once: {'; '.join(objections)}"

    if ai_can_end:
        end_note = end_condition if end_condition else "deal agreed, deal declined, or the caller is clearly wasting your time"
        system += f"\n\nYou can end the call when: {end_note}. Say a natural goodbye and add [END_CALL] at the very end of your message."
    else:
        system += "\n\nDon't end the call yourself — wait for the other person to close it."

    if time_limit:
        system += f"\n\nIf about {time_limit} minutes have passed, wrap up naturally."

    if language.lower() != "english":
        system += f"\n\nSpeak only in {language}."

    return system, messages


def _build_persona_prompt(persona: dict, history: list[dict], user_message: str) -> tuple[str, list[dict]]:
    difficulty    = persona.get("difficulty", "MEDIUM").upper()
    seniority_key = _seniority_key(persona.get("title", ""))

    interrupted = user_message.startswith("[interrupted]")
    clean_msg   = user_message[len("[interrupted]"):].strip() if interrupted else user_message

    messages = [{"role": m["role"], "content": m["content"]} for m in history[-12:]]
    messages.append({"role": "user", "content": clean_msg})

    system = f"""{persona['systemPrompt']}

---
You're on a call right now. The context above is your world and your mindset — not foreknowledge of why this specific person is calling. If they haven't explained their reason yet, respond naturally and wait.

{DIFFICULTY_FLAVOR.get(difficulty, DIFFICULTY_FLAVOR['MEDIUM'])}
{SENIORITY_FLAVOR[seniority_key]}

Reply in 1-2 spoken sentences. Short. Direct. Unscripted. React to what was ACTUALLY SAID. No corporate-speak, no lists. You are not a coach or an AI. You are a real person.

If the caller says something completely off-topic — personal questions, small talk unrelated to this call, or anything outside the business context — stay in character and redirect briefly ("I'm not sure how that's relevant, but..." or "Let's stay focused here..."). Never break character. Never answer as an AI."""

    if interrupted:
        system += "\n\nThey just cut you off. React in one short phrase, then wait."

    buying_signals = ', '.join(persona.get('buyingSignals', []))[:150]
    objections_str = ', '.join(persona.get('objections', []))[:150]
    if buying_signals or objections_str:
        system += f"\n\nWarm up for: {buying_signals or 'strong relevant questions'}. Push back on: {objections_str or 'vague or weak pitches'}."

    system += "\n\nWhen ending the call, say a natural goodbye and add [END_CALL] at the very end of your message."

    return system, messages


# ── Non-streaming (fallback) ──────────────────────────────────────────────────

async def generate_scenario_response(scenario: dict, history: list[dict], user_message: str, framework: str) -> str:
    system, messages = _build_scenario_prompt(scenario, history, user_message)
    response = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=80, temperature=0.9,
        messages=[{"role": "system", "content": system}, *messages],
    )
    return response.choices[0].message.content


async def generate_persona_response(persona: dict, history: list[dict], user_message: str, framework: str) -> str:
    system, messages = _build_persona_prompt(persona, history, user_message)
    response = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=80, temperature=0.9,
        messages=[{"role": "system", "content": system}, *messages],
    )
    return response.choices[0].message.content


# ── Streaming (sentence-by-sentence TTS pipeline) ────────────────────────────

async def stream_scenario_response(
    scenario: dict, history: list[dict], user_message: str, framework: str
) -> AsyncIterator[str]:
    system, messages = _build_scenario_prompt(scenario, history, user_message)
    stream = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=80, temperature=0.9, stream=True,
        messages=[{"role": "system", "content": system}, *messages],
    )
    async for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token


async def stream_persona_response(
    persona: dict, history: list[dict], user_message: str, framework: str
) -> AsyncIterator[str]:
    system, messages = _build_persona_prompt(persona, history, user_message)
    stream = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=80, temperature=0.9, stream=True,
        messages=[{"role": "system", "content": system}, *messages],
    )
    async for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token


# ── Opening lines ─────────────────────────────────────────────────────────────

async def generate_scenario_opening(scenario: dict, session_type: str) -> str:
    display_name  = (scenario.get("displayName") or "the prospect").strip()
    display_title = (scenario.get("displayTitle") or "").strip()
    if session_type == "PHONE_CALL":
        return "Hello?"
    context_snippet = scenario.get("personaContext", "")[:200]
    prompt = (
        f"You are {display_name}{f', {display_title}' if display_title else ''}. "
        f"Context: {context_snippet} "
        "A scheduled video call just connected. Greet them in 5-7 words — warm but not formal. "
        "Do NOT say your name or title. Just acknowledge they joined."
    )
    response = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=25,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


async def generate_persona_opening(persona: dict, session_type: str) -> str:
    if session_type == "PHONE_CALL":
        return "Hello?"
    prompt = (
        f"You are {persona['name']}, {persona.get('title', '')}. "
        "A scheduled video call just connected. Greet them in 5-7 words — warm but natural. "
        "Do NOT say your name. Just acknowledge they joined."
    )
    response = await get_client().chat.completions.create(
        model="gpt-4o-mini", max_tokens=25,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content
