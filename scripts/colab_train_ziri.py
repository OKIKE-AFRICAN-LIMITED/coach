"""
=============================================================================
Google Colab Fine-Tuning Script for Coach Ziri (Unsloth + QLoRA)
=============================================================================
Instructions for Google Colab (100% Free T4 GPU):
1. Open https://colab.research.google.com and click 'New Notebook'.
2. In the Colab menu, go to Runtime -> Change runtime type -> Select 'T4 GPU'.
3. Upload your 'coach_ziri_train.jsonl' file (click the folder icon on the left panel).
4. Paste and run this script block by block!
=============================================================================
"""

# Cell 1: Install Unsloth and training libraries
"""
%%capture
!pip install --no-deps "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps trl peft accelerate bitsandbytes
!pip install datasets
"""

# Cell 2: Load the Base Model (Qwen 2.5 7B pre-quantized 4-bit)
"""
from unsloth import FastLanguageModel
import torch

max_seq_length = 2048
dtype = None # Auto detection
load_in_4bit = True # 4bit quantization fits in 15GB T4 GPU

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/Qwen2.5-7B-Instruct-bnb-4bit",
    max_seq_length = max_seq_length,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)
"""

# Cell 3: Configure LoRA Adapters
"""
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, # LoRA rank
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0, # Optimized by Unsloth
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
    max_seq_length = max_seq_length,
)
"""

# Cell 4: Load and Format the Dataset
"""
from datasets import load_dataset

dataset = load_dataset("json", data_files="coach_ziri_train.jsonl", split="train")

def formatting_prompts_func(examples):
    convos = examples["messages"]
    texts = [tokenizer.apply_chat_template(convo, tokenize=False, add_generation_prompt=False) for convo in convos]
    return { "text" : texts }

dataset = dataset.map(formatting_prompts_func, batched = True)
print("First formatted sample:")
print(dataset[0]["text"][:500])
"""

# Cell 5: Train with SFTTrainer
"""
from trl import SFTTrainer
from transformers import TrainingArguments
from unsloth import is_bfloat16_supported

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length = max_seq_length,
    dataset_num_proc = 2,
    packing = False, # Faster for short convos
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 5,
        max_steps = 60, # Adjust between 60 - 150 depending on dataset size
        learning_rate = 2e-4,
        fp16 = not is_bfloat16_supported(),
        bf16 = is_bfloat16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "linear",
        seed = 3407,
        output_dir = "outputs",
    ),
)

trainer_stats = trainer.train()
"""

# Cell 6: Save and Push to Hugging Face
"""
# Save LoRA adapter locally
model.save_pretrained("coach_ziri_lora")
tokenizer.save_pretrained("coach_ziri_lora")

# Optional: Push directly to your Hugging Face account
# from huggingface_hub import login
# login() # Paste your HF write token
# model.push_to_hub("your-username/coach-ziri-qwen-7b", token = "hf_...")
# tokenizer.push_to_hub("your-username/coach-ziri-qwen-7b", token = "hf_...")
"""

