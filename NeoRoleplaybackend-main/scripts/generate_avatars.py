"""
One-time script to generate AI professional headshots for all avatars using DALL-E 3.
Run from the project root:  python backend_py/scripts/generate_avatars.py

Images are saved to frontend/public/avatars/{id}.jpg
Each image costs ~$0.04 (DALL-E 3 standard 1024x1024).
Already-generated images are skipped automatically.
"""

import asyncio
import sys
from pathlib import Path

# Allow importing from backend_py
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import httpx
from openai import AsyncOpenAI

OUTPUT_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "avatars"

AVATAR_PROMPTS = [
    ("alex",   "professional headshot of an East Asian male in his 30s, wearing a dark business suit, confident expression, neutral light grey background"),
    ("sarah",  "professional headshot of a white female in her early 30s, wearing a navy blazer, warm professional smile, neutral light background"),
    ("james",  "professional headshot of a white male in his mid 30s, wearing a charcoal suit and tie, confident look, neutral light grey background"),
    ("maria",  "professional headshot of a Hispanic Latina female in her 30s, wearing a dark blazer, friendly smile, neutral light background"),
    ("robert", "professional headshot of a white male in his late 50s, salt and pepper hair, wearing a navy suit, authoritative expression, neutral background"),
    ("emma",   "professional headshot of a white British female in her late 20s, wearing a professional blazer, polished look, neutral light background"),
    ("priya",  "professional headshot of a South Asian Indian female in her 30s, wearing a dark professional blazer, confident smile, neutral light background"),
    ("jordan", "professional headshot of an East Asian male in his mid 20s, wearing a modern slim-fit suit, relaxed confident look, neutral background"),
    ("marcus", "professional headshot of a Black African-American male in his 30s, wearing a dark business suit, strong confident expression, neutral light grey background"),
    ("layla",  "professional headshot of a Middle Eastern Arab female in her 30s, wearing a dark professional blazer, elegant look, neutral light background"),
    ("ravi",   "professional headshot of a South Asian Indian male in his late 20s, wearing a dark suit, approachable smile, neutral light background"),
    ("yuki",   "professional headshot of an East Asian Japanese female in her late 20s, wearing a dark professional blazer, calm professional expression, neutral light background"),
    ("aisha",  "professional headshot of a Black African-American female in her 30s, wearing a dark blazer, bright confident smile, neutral light background"),
    ("carlos", "professional headshot of a Hispanic Latino male in his 30s, wearing a dark business suit, friendly confident expression, neutral light background"),
]

BASE_PROMPT_SUFFIX = (
    ". Ultra-realistic corporate headshot photograph. Direct eye contact, shoulders visible, "
    "studio lighting, sharp focus on face. Photorealistic DSLR portrait style. No text, no watermarks."
)


async def generate_avatar(client: AsyncOpenAI, http: httpx.AsyncClient, avatar_id: str, prompt: str) -> None:
    output_path = OUTPUT_DIR / f"{avatar_id}.jpg"
    if output_path.exists():
        print(f"  skip  {avatar_id}.jpg (already exists)")
        return

    print(f"  gen   {avatar_id} ...", end="", flush=True)
    try:
        response = await client.images.generate(
            model="dall-e-3",
            prompt=prompt + BASE_PROMPT_SUFFIX,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="url",
        )
        url = response.data[0].url
        img_resp = await http.get(url, timeout=60)
        img_resp.raise_for_status()
        output_path.write_bytes(img_resp.content)
        print(f" saved ({len(img_resp.content) // 1024}KB)")
    except Exception as e:
        print(f" FAILED: {e}")


async def main() -> None:
    # Load env vars from .env
    env_path = Path(__file__).resolve().parents[2] / "backend_py" / ".env"
    api_key = ""
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                api_key = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

    if not api_key:
        print("ERROR: OPENAI_API_KEY not found in backend_py/.env")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Saving to: {OUTPUT_DIR}\n")

    client = AsyncOpenAI(api_key=api_key)
    async with httpx.AsyncClient() as http:
        for avatar_id, prompt in AVATAR_PROMPTS:
            await generate_avatar(client, http, avatar_id, prompt)

    print("\nDone. Run the frontend dev server and refresh to see the new photos.")


if __name__ == "__main__":
    asyncio.run(main())
