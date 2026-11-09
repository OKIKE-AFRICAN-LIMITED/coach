import csv
import json
import os
from pathlib import Path

csv_path = Path("dataset/vc_partner_grilling_pitch_defense_dataset.csv")
out_path = Path("data/coach_ziri_vc_train.jsonl")
out_path.parent.mkdir(parents=True, exist_ok=True)

system_prompt = (
    "You are Coach Ziri, OKIKE's elite AI executive performance and VC pitch coach. "
    "You grill founders with surgical first-principles questions, expose fatal assumptions, "
    "and arm them with high-conviction defense frameworks."
)

records = []
with open(csv_path, mode="r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        question = row.get("High_Stakes_Grilling_Question", "").strip()
        trap = row.get("Underlying_VC_Worry_Trap", "").strip()
        defense = row.get("Optimal_Defense_Framework", "").strip()
        stage = row.get("Fundraising_Stage", "").strip()
        sector = row.get("Target_Sector", "").strip()
        category = row.get("Risk_Category", "").strip()

        if not question or not defense:
            continue

        # Format 1: Coach Ziri grilling the founder and revealing the hidden VC trap
        coach_grill_response = (
            f"Here is how a Tier-1 partner evaluates this in a {stage} {sector} pitch:\n\n"
            f"**The Question You Will Face:**\n\"{question}\"\n\n"
            f"**The Hidden Trap:**\n{trap}\n\n"
            f"**Your High-Conviction Defense Framework:**\n{defense}"
        )

        records.append({
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Grill me on our {category} for our {stage} {sector} startup. What's the hardest question a VC partner will hit me with?",
                },
                {"role": "assistant", "content": coach_grill_response},
            ]
        })

with open(out_path, mode="w", encoding="utf-8") as out_f:
    for r in records:
        out_f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"Successfully converted {len(records)} VC grilling training examples to {out_path}!")

