# Typography

Every HyperFrames composition with text needs deliberate typography. Video punishes timid type.

## Minimum sizes

- Headlines: 60px+.
- Body text: 20px+.
- Data labels and captions: 16px+.
- Number columns: `font-variant-numeric: tabular-nums`.

## Font rule

Fonts are written directly in CSS. The compiler embeds supported fonts automatically and warns when a font is not supported.

Do not default to Roboto, Inter, Arial, or system UI unless the project brand explicitly requires it.

## Text wrapping

Do not use `<br>` in normal content. Let text wrap naturally with `max-width`. Forced line breaks plus natural wrapping cause unintended extra breaks and overlap.

Exception: short display titles where each word is deliberately on its own line, such as:

```text
THE
IMMORTAL
GAME
```

## Dynamic text

For dynamic text overflow, use:

```js
window.__hyperframes.fitTextFontSize(text, {
  maxWidth,
  fontFamily,
  fontWeight
});
```

Use this for captions, cards, stats, imported headlines, and anything generated from a transcript or website capture.

## Dark background adjustment

On dark canvases:

- Increase font weight slightly.
- Avoid thin gray text.
- Use warmer off-white rather than pure white when the design allows.
- Check contrast with `npx hyperframes validate`.

## Hierarchy test

Squint at the hero frame. If h1, h2, body, captions, and labels do not separate immediately, the hierarchy fails.
