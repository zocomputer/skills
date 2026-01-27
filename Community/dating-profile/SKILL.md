---
name: Create ideal dating profile
description: Creates an ideal dating profile by writing your bio and choosing the best photos in the right order
metadata:
  author: tiff.zo.computer
  category: Community
  emoji: 💌
---

# Prerequisites

- [ ] User should have their name and user bio filled out in Settings

- [ ] User should have images uploaded that they would consider using for their dating profile

- [ ] Optionally, user should have additional files uploaded, whatever they please

---

# Input

- Location of the images to use for the dating profile
- Optionally, a vibe the user is going for

---

# Protocol

1. Ensure the user has given you a folder of potential images to use for their dating profile.
2. Carefully consider the user's requested vibe, as well as their user bio in Zo. Use a combination of `tool run_bash_command`  and `tool read_file`  to examine any relevant files in the user's workspace.
3. Use the information you have gathered to create an ideal bio for the user's dating profile, prioritizing the vibe the user has requested.
4. Still considering the information, select the top 5 images the user should use for their bio and in the best ordering.
5. Present to the user your proposed bio and images in their order, and explain your reasoning.

