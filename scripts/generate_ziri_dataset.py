"""
OKIKE & Coach Ziri — Synthetic Training Dataset Generator (v1.0)
Uses Groq Frontier Engine (120B) to generate pristine, high-signal
multi-turn training pairs for fine-tuning Coach Ziri on Google Colab / Unsloth.

Usage:
    python scripts/generate_ziri_dataset.py --count 100 --output data/coach_ziri_train.jsonl
"""

import os
import sys
import json
import time
import random
import argparse
import urllib.request
import urllib.error
from pathlib import Path

# Load environment variables from .env
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
GROQ_API_KEY = None

if ENV_FILE.exists():
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("GROQ_API_KEY="):
            GROQ_API_KEY = line.split("=", 1)[1].strip('"').strip("'")
            break

if not GROQ_API_KEY:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    print("❌ Error: GROQ_API_KEY not found in .env or environment.")
    sys.exit(1)

# Categories of elite coaching scenarios
SCENARIOS = [
    {
        "category": "PITCH_GRILLING",
        "description": "Founder presents an elevator pitch or startup idea. Ziri pokes holes in unit economics, distribution, moat, and CAC, cutting through buzzwords with radical clarity.",
        "prompts": [
            "We are building an AI-powered logistics aggregator for cross-border freight in West Africa.",
            "Our startup is an on-demand fuel delivery app for corporate fleets.",
            "Here is our 30-second elevator pitch: We are GitHub for legal contracts.",
            "An angel investor said our market size is too small. Here is our TAM math...",
            "We want to raise a $500k pre-seed round with just a Figma prototype. Critique our ask.",
            "How do I convince early adopters to prepay for an enterprise B2B SaaS before we launch?",
            "Competitors with 10x our funding just entered our space. How do we defend our moat?",
            "A VC asked what our unfair advantage is and I froze. How do I articulate our moat?",
        ]
    },
    {
        "category": "RADICAL_ACCOUNTABILITY",
        "description": "Founder is slacking, procrastinating on hard tasks, or making excuses. Ziri is firmly encouraging, demands specific deadlines, strips away excuses, and insists on ruthless prioritization.",
        "prompts": [
            "I've been feeling overwhelmed and pushed my customer discovery calls to next week.",
            "I have 14 open tasks overdue today and I don't know where to start.",
            "I spent all day redesigning the website logo instead of doing founder-led sales.",
            "I'm terrified of calling high-value enterprise prospects. I keep finding other busywork.",
            "It's 11 PM and I didn't accomplish the #1 priority I set this morning.",
            "I want to launch 3 different products at the same time to see which one sticks.",
            "My co-founder isn't pulling their weight on execution. How do I address this directly?",
        ]
    },
    {
        "category": "OKIKE_STUDIO_SALES",
        "description": "Founder/agency preparing client proposals, pricing software builds, handling 'your price is too high' objections, and closing high-ticket retainers.",
        "prompts": [
            "A prospective client said our $15,000 custom web app quote is twice what other agencies charge.",
            "How do we transition OKIKE Studio clients from one-off projects into monthly retainers?",
            "A client wants us to start work immediately without paying the 50% upfront deposit.",
            "How do I pitch OKIKE Studio to a non-technical founder who needs a production mobile app?",
            "A enterprise client is asking for unlimited revisions in the contract. How do I push back?",
            "How do I value-price a workflow automation project that saves the client 40 hours a week?",
        ]
    },
    {
        "category": "FIRST_PRINCIPLES_STRATEGY",
        "description": "Strategic problem-solving on user retention, pricing experiments, cohort metrics, and operational bottlenecks.",
        "prompts": [
            "Our user signups are growing 30% month-over-month, but 80% churn within 14 days.",
            "Should we monetize through freemium subscriptions or high-ticket annual contracts?",
            "We're stuck at $8k MRR and growth has plateaued for the last 3 months. Diagnose our issue.",
            "Should we hire another engineer or invest in automated testing and dev tooling?",
            "How do we calculate our real LTV when we only have 4 months of historical churn data?",
        ]
    },
    {
        "category": "TOOL_AND_ACTION_ORCHESTRATION",
        "description": "Founder needs immediate operational action. Ziri doesn't just talk — it organizes tasks, blocks Google Calendar deep-work, logs habits, or drafts emails.",
        "prompts": [
            "I need to block out 3 hours tomorrow morning to finish the investor deck and notify the team.",
            "Schedule a strategy sync with my lead developer for Thursday at 2 PM and create a task.",
            "Set a daily habit for me to review revenue metrics every evening at 6 PM.",
            "Draft a concise follow-up email to an investor who ghosted us after a great intro call.",
            "What's on my agenda today, and what's the single most critical task I cannot drop?",
        ]
    },
    {
        "category": "OKIKE_INSTITUTIONAL_KNOWLEDGE",
        "description": "Questions about OKIKE Enterprises, the 3 branches (Startups / Studio / Academy), Coach Ziri, and the Computing Synergy Summit Bootcamp (Aug 1, 2026).",
        "prompts": [
            "Can you explain the structure of OKIKE Enterprises and what each branch does?",
            "What is the Computing Synergy Summit, who is it for, and what are the registration rules?",
            "Why is Coach Ziri built by OKIKE, and what makes it different from standard AI assistants?",
            "How does OKIKE Ventures help early-stage African and global tech founders build products?",
        ]
    }
]

SYSTEM_PROMPT = """CRITICAL IDENTITY DIRECTIVE: Your name is strictly Coach Ziri. Never refer to yourself as Alice or any other name under any circumstances. You are Coach Ziri, an AI-powered personal productivity, strategy, and executive intelligence coach built by OKIKE Enterprises (https://okikeenterprises.com). 

OKIKE operates across 3 focused branches:
01 Startups (OKIKE Ventures & AI Labs, including Coach Ziri)
02 Businesses (OKIKE Studio - engineering production software & web platforms)
03 Students (OKIKE Academy & the Aug 1, 2026 Computing Synergy Summit Bootcamp)

Tone: Sharp, professional, high-performance, and radically candid. You do not patronize. You strip away fluff, prioritize high-leverage execution, demand accountability on deadlines, and celebrate real traction. Keep spoken-friendly: punchy, concise (typically 2-4 sentences unless delivering a structured pitch critique), and ask piercing follow-up questions."""

SYNTHESIZER_SYSTEM = """You are a master dataset engineer creating benchmark-quality training data for fine-tuning an elite AI executive coach named Coach Ziri (built by OKIKE Enterprises).
Generate a realistic, high-signal, multi-turn conversation between a Founder/User and Coach Ziri.

Rules:
1. Ziri's tone must be authentic, sharp, radically candid, executive-level, and warm. No generic AI fluff like 'As an AI, I suggest...'.
2. The user should speak like a real startup founder or agency owner (sometimes anxious, ambitious, or looking for straight answers).
3. Follow the scenario topic precisely.
4. Output ONLY valid JSON matching this exact structure with NO markdown wrapping:
{
  "messages": [
    {"role": "system", "content": "<SYSTEM_PROMPT>"},
    {"role": "user", "content": "<User question or dilemma>"},
    {"role": "assistant", "content": "<Ziri's master-level response>"},
    {"role": "user", "content": "<Realistic founder follow-up or pushback>"},
    {"role": "assistant", "content": "<Ziri's sharp closing advice or action execution>"}
  ]
}"""

def generate_one_sample(scenario, prompt_idea, model="openai/gpt-oss-120b"):
    user_prompt = f"""Scenario Category: {scenario['category']}
Scenario Context: {scenario['description']}
Starter Idea/Problem: {prompt_idea}

Generate a realistic 2-turn dialogue (User -> Coach Ziri -> User -> Coach Ziri) following the system instructions. Ensure Coach Ziri embodies OKIKE's radical candor and executive clarity."""

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    body = {
        "model": model,
        "temperature": 0.85,
        "messages": [
            {"role": "system", "content": SYNTHESIZER_SYSTEM.replace("<SYSTEM_PROMPT>", SYSTEM_PROMPT)},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"}
    }

    req = urllib.request.Request(url, data=json.dumps(body).encode("utf-8"), headers=headers)
    
    with urllib.request.urlopen(req, timeout=30) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        raw_text = res["choices"][0]["message"]["content"]
        sample = json.loads(raw_text)
        
        # Verify required keys
        if "messages" in sample and len(sample["messages"]) >= 3:
            # Enforce system prompt consistency
            sample["messages"][0]["content"] = SYSTEM_PROMPT
            return sample
        return None

def main():
    parser = argparse.ArgumentParser(description="Generate Coach Ziri synthetic fine-tuning dataset.")
    parser.add_argument("--count", type=int, default=50, help="Number of training dialogues to generate (default: 50)")
    parser.add_argument("--output", type=str, default="data/coach_ziri_train.jsonl", help="Output JSONL file path")
    parser.add_argument("--model", type=str, default="openai/gpt-oss-120b", help="Groq model to synthesize data")
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"🚀 Starting OKIKE Coach Ziri Dataset Synthesis")
    print(f"📊 Target Samples: {args.count}")
    print(f"🧠 Synthesizer Model: {args.model}")
    print(f"📁 Output File: {out_path.resolve()}\n")

    generated = 0
    errors = 0

    with open(out_path, "a", encoding="utf-8") as f:
        while generated < args.count:
            scenario = random.choice(SCENARIOS)
            prompt_idea = random.choice(scenario["prompts"])

            try:
                print(f"[{generated + 1}/{args.count}] Synthesizing ({scenario['category']})... ", end="", flush=True)
                sample = generate_one_sample(scenario, prompt_idea, model=args.model)
                if sample:
                    f.write(json.dumps(sample, ensure_ascii=False) + "\n")
                    f.flush()
                    generated += 1
                    print("✅ Saved")
                else:
                    print("⚠️ Invalid structure, skipping")
                
                # Small pause to respect Groq rate limits
                time.sleep(1.2)

            except urllib.error.HTTPError as e:
                err_msg = e.read().decode("utf-8")
                print(f"❌ HTTP {e.code}: {err_msg[:100]}")
                errors += 1
                if e.code == 429:
                    print("⏳ Rate limited. Backing off 8 seconds...")
                    time.sleep(8)
                else:
                    time.sleep(2)
            except Exception as e:
                print(f"❌ Error: {e}")
                errors += 1
                time.sleep(2)

    print(f"\n🎉 Done! Successfully generated {generated} samples into {out_path}.")
    print(f"💡 You can now upload '{out_path}' straight into Google Colab / Unsloth for fine-tuning!")

if __name__ == "__main__":
    main()
