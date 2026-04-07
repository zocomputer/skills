# Stable Diffusion LoRAs for Character Consistency

## Recommended Base Models

- **SDXL 1.0** - Best overall quality
- **SDXL Lightning** - Fast generation
- **Flux.1 [dev]** - Best prompt adherence
- **RealVisXL** - Photorealistic portraits
- **DreamShaper XL** - Versatile artistic styles

## Character Consistency LoRAs

### General Character/Identity
| LoRA | Use Case | Trigger Words |
|------|----------|---------------|
| `Detail Tweaker XL` | Enhance details | `<lora:add_detail:0.8>` |
| `Samaritan 3D Cartoon` | 3D cartoon style | `3d cartoon style` |
| `ToonYou` | Anime to 3D | `toonyou style` |

### Photorealistic Enhancers
| LoRA | Use Case | Trigger Words |
|------|----------|---------------|
| `Face Detail XL` | Better faces | `<lora:face_detail:0.6>` |
| `EPI-NoiseOffset` | Better lighting | `<lora:epi_noiseoffset:0.5>` |
| `Skin Texture` | Realistic skin | `detailed skin texture` |

### Style-Specific
| LoRA | Use Case | Trigger Words |
|------|----------|---------------|
| `Cyberpunk Style` | Neon/cyber aesthetic | `cyberpunk style, neon lights` |
| `Claymation Style` | Stop-motion look | `claymation, stop motion` |
| `Ghibli Background` | Studio Ghibli scenes | `ghibli style background` |

## Recommended Prompt Structure

```
(8k, best quality, masterpiece:1.2), [SUBJECT DESCRIPTION], [CLOTHING], [POSE], [EXPRESSION], [ENVIRONMENT], [LIGHTING], [STYLE MODIFIERS], <lora:[LORA_NAME]:[WEIGHT]>
```

## ControlNet for Consistency

### OpenPose (Body/Hand/Face Pose)
Use when you need the character in specific poses:
- OpenPose Full - Full body control
- OpenPose Face - Facial expression control
- OpenPose Hand - Hand gesture control

### Canny/Lineart (Edge Detection)
Use when you want to preserve composition:
- Canny - Hard edges
- Lineart - Soft line detection
- Scribble - Sketch-based control

### Reference (IP-Adapter)
Best for face consistency:
- IP-Adapter FaceID - Strong face reference
- IP-Adapter Plus - Balanced reference
- IP-Adapter Full - Complete image reference

## Example Workflows

### Creating a Consistent Character

1. **Generate base portrait:**
```
portrait of [NAME], [DESCRIPTION], photorealistic, 8k uhd, highly detailed, <lora:add_detail:0.8>
```

2. **Create variations with IP-Adapter:**
- Load base image into IP-Adapter
- Generate with different poses/settings
- Keep weight around 0.6-0.8 for balance

3. **Generate different outfits:**
- Keep IP-Adapter on for face
- Change clothing description
- Use OpenPose for body positioning

### Batch Generation Tips

**Prompt template for variations:**
```
portrait of [NAME], [BASE_DESCRIPTION], [VARIATION: smiling/confident/thoughtful/excited], [CLOTHING_VARIATION], photorealistic, 8k, <lora:add_detail:0.8>
```

**Useful XYZ plot settings:**
- Seeds: 10-20 variations
- CFG Scale: 5-12 range
- Steps: 20-40 range

## Recommended Settings (SDXL)

| Parameter | Recommended |
|-----------|-------------|
| Sampling Method | DPM++ 2M Karras or Euler a |
| Sampling Steps | 30-50 |
| CFG Scale | 7-9 |
| Size | 896×1152 (portrait) |
| Clip Skip | 2 |

## Recommended Settings (Flux)

| Parameter | Recommended |
|-----------|-------------|
| Sampling Method | Euler or DPM++ 2M |
| Sampling Steps | 4-8 (distilled) or 20-30 (standard) |
| CFG Scale | 1 (distilled) or 3-5 (standard) |
| Size | 1024×1280 |

## Resources

- **Civitai** - LoRA model repository
- **Hugging Face** - Base models
- **ComfyUI** - Node-based workflow tool
- **AUTOMATIC1111** - Web UI for SD
