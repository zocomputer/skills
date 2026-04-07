# Midjourney Portrait Prompts for AI Characters

## Base Portrait Formula

```
[SUBJECT], [STYLE MODIFIERS], [LIGHTING], [CAMERA], [QUALITY] --ar [RATIO] --style raw
```

## Style Categories

### Photorealistic
```
Portrait of [NAME], [AGE] [GENDER], [HERITAGE], wearing [CLOTHING], [LOCATION], soft [LIGHTING TYPE] lighting, [LENS] lens, f/[APERTURE], highly detailed [FEATURES], [SKIN TEXTURE], [COLOR GRADING], 8k uhd --ar 2:3 --style raw
```

**Example:**
```
Portrait of Aria, 28 year old woman, mixed Asian-European heritage, wearing minimalist black turtleneck, modern studio, soft diffused lighting, 85mm lens, f/1.8, highly detailed facial features, natural skin texture, warm color grading, 8k uhd --ar 2:3 --style raw
```

### Cyberpunk / Neon
```
[SUBJECT], neon-lit environment, [COLOR] and [COLOR] accent lighting, cyberpunk aesthetic, [CLOTHING DESCRIPTION], holographic elements, [WEATHER/ATMOSPHERE], futuristic city background, volumetric fog, cinematic composition, octane render, unreal engine 5 --ar 2:3 --style raw
```

**Example:**
```
Digital avatar portrait, neon-lit environment, cyan and magenta accent lighting, cyberpunk aesthetic, futuristic streetwear with glowing trim, holographic interface elements, rainy atmosphere, futuristic city background, volumetric fog, cinematic composition, octane render, unreal engine 5 --ar 2:3 --style raw
```

### 3D Clay / Pixar Style
```
3D character portrait, [SUBJECT], clay material, soft rounded sculptural forms, [EXPRESSION], [COLOR PALETTE] color scheme, clean minimal background, studio lighting, subsurface scattering on skin, pixar/disney 3D style, high quality render, octane render --ar 2:3 --style raw
```

**Example:**
```
3D character portrait of young professional, clay material, soft rounded sculptural forms, friendly confident smile, pastel mint and coral color scheme, clean white background, studio lighting three-point, subsurface scattering on skin, pixar style character, high quality render, octane render --ar 2:3 --style raw
```

### Anime / Manga
```
[SUBJECT], anime style portrait, [HAIR COLOR] hair, [EYE COLOR] eyes, [EXPRESSION], [CLOTHING], clean line art, cel shaded, vibrant [COLOR PALETTE] colors, [BACKGROUND TYPE] background, studio ghibli inspired, makoto shinkai lighting, detailed face, 8k --ar 2:3 --niji 6
```

**Example:**
```
Professional woman character, anime style portrait, silver hair with blue gradient tips, amber eyes, determined expression, modern business casual outfit, clean line art, cel shaded, vibrant teal and orange color palette, city skyline background at sunset, studio ghibli inspired, makoto shinkai lighting, detailed face, 8k --ar 2:3 --niji 6
```

## Consistency Parameters

### Using Character References
```
[BASE PROMPT] --cref [IMAGE_URL] --cw [0-100]
```
- `--cw 0` = Face only
- `--cw 50` = Face + some attributes
- `--cw 100` = Face + full character reference

### Using Seeds
```
[BASE PROMPT] --seed [NUMBER] --ar 2:3
```
Use the same seed number to get similar compositions.

## Pose Variations

Add these to the end of your prompt:

- **Neutral/Professional:** professional headshot, neutral expression, looking at camera
- **Smiling/Friendly:** warm genuine smile, approachable expression, slight head tilt
- **Serious/Thoughtful:** contemplative expression, hand near chin, intellectual pose
- **Excited/Energetic:** dynamic pose, enthusiastic expression, action shot
- **Casual/Relaxed:** relaxed posture, candid moment, natural laugh

## Aspect Ratio Guide

- `--ar 2:3` - Portrait (best for characters)
- `--ar 1:1` - Square (profile pictures)
- `--ar 16:9` - Landscape (banners)
- `--ar 9:16` - Vertical (TikTok/Reels)

## Style Reference Tips

1. **For consistent characters:** Use `--cref` with your best generation
2. **For style consistency:** Use `--sref` with style reference images
3. **For precise control:** Use `--no` to exclude unwanted elements
4. **For variations:** Use the same seed with slight prompt changes
