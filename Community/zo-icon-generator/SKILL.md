---
name: zo-icon-generator
description: Generates custom themed versions of the Zo Computer logomark while strictly preserving the original shapes and lines.
category: Media & Graphics
metadata:
  author: YOUR_HANDLE.zo.computer
  emojis: ["🖼️", "🦄", "🎨"]
tags:
  - images
  - design
  - branding
  - logo
---

# Zo Icon Generator

This skill modifies the original Zo Computer logomark to match a desired theme or color scheme. It strictly adheres to the constraint of preserving the original shapes and lines. You are only allowed to modify the logomark's color and add styling elements to the background or surroundings.

## Instructions

1.  **Acquire Source Image:** You need the original Zo logomark image file to act as the base. If the user hasn't provided one in the current context, ask them to provide it or reference a previously uploaded logomark (e.g., the standard Black or White Logomark PNGs).
2.  **Gather Requirements:** Identify the user's desired color scheme and theme (e.g., "electric blue and cyan", "synthwave", "nature background").
3.  **Apply Edits:** Use the `edit_image` tool to apply the transformation. 
    *   **CRITICAL RESTRICTION:** You must use `edit_image` on the original file. Do NOT use `generate_image` as it will not preserve the exact lines.
    *   **PROMPT STRUCTURE:** Your prompt to the `edit_image` tool MUST follow this constraint: "Keep the exact original lines and shapes of the logo. Change the logo color to [User's Colors]. Add [User's Theme] styling elements to the background of the square icon."
4.  **Verification:** Review the output image. Ensure that the original geometric shape of the Pegasus logomark remains completely undistorted and intact. If it distorted the shape, run the edit again with stricter constraints in the prompt.
5.  **Delivery:** Save the final image to an appropriate folder (e.g., `Images/`) and present it to the user. If communicating via Discord, use the `zo-discord files` command to upload the image directly to the thread.
