---
name: indic-tts
description: Indian TTS for everyone - High-quality text-to-speech for 11 Indian languages using Sarvam AI's Bulbul v3 model. Features 30+ voices, natural prosody, and support for Hindi, Bengali, Tamil, Telugu, Gujarati, Kannada, Malayalam, Marathi, Punjabi, Odia, and English.
metadata:
  author: ankitjh4
  category: External
  display-name: Indian TTS for everyone
---

# Indian TTS for everyone

High-quality Text-to-Speech for Indian languages using [Sarvam AI](https://sarvam.ai).

## ⚠️ Required: API Key

**You must have a Sarvam API key to use this skill.**

Get your free API key at: https://dashboard.sarvam.ai

### Setup

1. Go to [Sarvam Dashboard](https://dashboard.sarvam.ai) and generate an API key
2. Add it to Zo's secrets: [Settings → Advanced](/?t=settings&s=advanced)
3. Add secret: `SARVAM_API_KEY` = your-api-key

---

## Quick Start

```bash
tts "नमस्ते, आप कैसे हैं?" --language hi-IN --speaker meera
```

## Supported Languages

| Code | Language |
|------|----------|
| `hi-IN` | Hindi |
| `bn-IN` | Bengali |
| `ta-IN` | Tamil |
| `te-IN` | Telugu |
| `gu-IN` | Gujarati |
| `kn-IN` | Kannada |
| `ml-IN` | Malayalam |
| `mr-IN` | Marathi |
| `pa-IN` | Punjabi |
| `od-IN` | Odia |
| `en-IN` | English |

## Speakers

**Female**: Meera (default), Priya, Neha, Simran, Kavya, Ishita, Shreya, Roopa, Tanya, Shruti, Suhani, Kavitha, Rupali, Amelia, Sophia

**Male**: Shubh, Aditya, Rahul, Amit, Dev, Arjun, Ratan, Varun, Manan, Sumit, Kabir, Aayan, Ashutosh, Advait, Anand, Tarun, Sunny, Mani, Gokul, Vijay, Mohit, Rehan, Soham

## Usage

```python
from sarvamai import SarvamAI
import os

client = SarvamAI(api_subscription_key=os.environ["SARVAM_API_KEY"])

# Generate speech
response = client.text_to_speech.convert(
    text="नमस्ते, आप कैसे हैं?",
    target_language_code="hi-IN",
    model="bulbul:v3",
    speaker="meira"
)

# Save to file
from sarvamai.play import save
save(response, "output.wav")
```

## Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `text` | - | Text to convert (max 2500 chars) |
| `language` | hi-IN | Target language code |
| `speaker` | meira | Voice speaker |
| `model` | bulbul:v3 | TTS model |
| `pitch` | 0.0 | Pitch adjustment (-0.75 to 0.75) |
| `pace` | 1.0 | Speech pace (0.5 to 2.0) |
| `loudness` | 1.0 | Audio loudness (0.3 to 3.0) |
| `sample_rate` | 24000 | Audio sample rate |

## Resources

- Dashboard: https://dashboard.sarvam.ai
- Docs: https://docs.sarvam.ai
- Cookbook: https://github.com/sarvamai/sarvam-ai-cookbook
