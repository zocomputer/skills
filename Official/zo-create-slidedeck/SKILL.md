---
name: create-slidedeck
description: Turn any reference material into a polished, visually cohesive slide deck.
metadata:
  author: rob.zo.computer
  category: Official
  display-name: Create a slide deck
  emoji: 🎞️
---

# Slide Deck Production Recipe

This recipe runs the full pipeline for creating a short slide deck with a consistent visual language. Follow the numbered steps every time, and do not stop until all slides have been generated, exported, and organized.

## Steps

0. **Understand the source material and plan the narrative.**
   - Read the source document (article, blog post, PDF, etc.) or any other content the user explicitly references.
   - Clarify what the user wants to communicate—what angle, insight, or storyline should the deck highlight.
   - Outline the full sequence of slides before generating visuals, noting the key message for each slide (including a cover/intro slide plus the content slides) so you can describe the plan in later edit_image prompts.

1. **Define the visual language with Generate Image.**
   - Use `generate_image` to produce a single “style prototype” slide. The image should look like a slide and explicitly showcase the complete design system: color palette swatches, representative graphical motifs (diagrams, textures, or shapes), and typographic treatments for titles and body copy. Treat this image as the canonical reference for all future slides.
   - Save the generated style prototype somewhere convenient (e.g., `Images/<deck-name>-style-template.png`). Once you have this style image, all subsequent slide rendering steps must refer to it explicitly (e.g., “use the visual style of `<attached template>`”).

2. **Establish the workspace structure.**
   - Ensure there is a `slide-decks/` directory at the workspace root; create it if it does not exist.
   - For the current project, create a kebab-case subdirectory under `slide-decks/` (e.g., `slide-decks/history-of-corporation/`). This folder will house the generated slides.
   - Each slide should be produced as a separate image file named with an ordinal prefix (e.g., `slide-00-cutline.png` for cover, `slide-01.png`, `slide-02.png`, …) so the sequence is clear.

3. **Create the cover slide (slide 0).**
   - Generate the cover slide first with `edit_image`, referencing the style prototype. The prompt should describe the deck title, subtitle/tagline, and visual cues that hint at the theme (e.g., historical, analytical, futuristic).
   - Briefly describe the planned flow of the remaining slides so the model understands it is part of a series, but make it clear the prompt is only for slide 0—do not attempt to depict content from other slides.
   - Once the cover is approved, store it as `slide-00.png` in the deck folder, then proceed to the body slides.

4. **Render each body slide via edit_image.**
   - For every remaining slide in the deck, follow the edit_image process: pass the style prototype, identify the current slide number, and describe what that one slide must communicate.
   - Do not attempt to include other slides’ content in the current prompt. Mention the overall deck’s theme briefly so the model knows it fits into a larger story, but focus the description solely on the current idea, headline(s), diagrams, and annotations for this slide alone.
   - Use the standard prompt format:
     > “Generate slide x of n slide deck communicating <slide topic> using the visual style of <attached template> following this description: …”
   - Specify diagrammatic or textual requirements, headlines, timelines/labels, and connect the instructions to the overall style so the palette, fonts, and graphical language remain cohesive.
   - Continue until all slides in the planned sequence are complete.

5. **Document the sequence.**
   - After all slides are generated, list the final slide paths in the deck folder (include captions/headlines) so the user knows the order.
   - Optionally describe how the slides flow together, referencing the style template and how each slide builds on the previous narrative.

6. **Finalize and organize.**
   - Move the style prototype into the deck folder as `style-template.png`. This ensures all deck assets live together and the template sorts last alphabetically after the `slide-XX.png` files.

7. **Export final artifacts.**
   - Generate a PowerPoint file (`<deck-name>.pptx`) from the slide images, placing each image as a full-bleed slide in sequence.
   - Generate a PDF file (`<deck-name>.pdf`) from the same images.
   - Save both files in the deck folder alongside the images. These are the shareable, final artifacts.
   - When you finish, mention the directory and list all files created in your final response.

Future instructions (from users) that reference “this deck” should rely on the style prototype image created in step 1 and the slide files stored under the appropriate `slide-decks/` subdirectory. Always tie edit_image prompts back to the prototype so the deck remains visually cohesive.

## Guidelines

- Generally, decks should stay short: plan for no more than 16 slides, and often much fewer. Keep each slide focused on a single idea and avoid redundant panels.
- Favor narrative flow: the cover should frame the problem or theme, the middle slides develop the insight tell the story, and the final slides summarize implications or next steps.
- Keep visuals consistent: reuse the palette, typography, and diagramming language from the style prototype to reinforce cohesion across slides.

