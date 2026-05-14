# Captions and Subtitles

Use this when adding captions, subtitles, lyrics, karaoke text, or transcript-synced typography.

## Principles

- Captions are design elements, not afterthoughts.
- Use real transcript timing when available.
- Group words into readable phrases unless karaoke emphasis is the point.
- Captions must never clip, overlap key visuals, or drift off safe areas.

## Placement

- Landscape: bottom safe area, usually 96-140px from bottom.
- Portrait: lower third, but leave room for platform UI if targeting TikTok/Reels/Stories.
- Keep captions inside a `max-width` container.
- Avoid absolute top/left caption placement unless the shot demands it.

## Styling

- 34-48px for landscape captions.
- 42-64px for portrait captions.
- Use high contrast and validate.
- Consider translucent backing, shadow, stroke, or blur card only when needed.
- Do not use generic black boxes unless the aesthetic calls for broadcast-style captions.

## Animation

- Caption entrance must align with speech timing.
- Word-level highlight can use `color`, `backgroundColor`, `scale`, or clipping masks.
- Captions must have guaranteed exit before the next caption occupies the same space.
- Avoid long fade-outs that linger under new words.

## Overflow prevention

- Use `max-width`.
- Use natural wrapping.
- Avoid `<br>` except deliberate short title cards.
- For dynamic lines, use `window.__hyperframes.fitTextFontSize(...)`.
