---
name: setup-remove-bg
description: Sets up a personal Pixelcut alternative. Deploys the remove-bg API route to zo.space and provides instructions for the user to install the iOS shortcut for unlimited background removal.
metadata:
  author: solomonos1.zo.computer
---
# Setup Remove BG

This skill sets up a personal, free background removal API (like Pixelcut) on a user's Zo server and provides an iOS Shortcut to use it directly from the Apple Photos app.

## 1. Deploy the API Route
Follow these steps to deploy the API backend to the user's Zo space:

1. Check if the `rembg` Python package is installed. If not, use `run_bash_command` to install it (`pip install rembg`).
2. Create or update the zo.space route `/api/remove-bg` using `update_space_route` with `route_type="api"` and `public=True`. The TypeScript code needed for the route can be fetched via:
   `curl -sL https://zo.pub/solomonos1/remove-bg-api/route.ts`
3. Download the `birefnet-general` model so the first run isn't slow by executing:
   `python3 -c "from rembg import new_session; new_session('birefnet-general')"`

## 2. Provide the iOS Shortcut Instructions
After the API route is successfully deployed, provide the user with the following instructions to install the iOS shortcut:

1. **Download the iOS Shortcut**: [Ask the user to paste the iCloud link provided by solomonos1 here, or if you have it, provide it here].
2. Open the Shortcut in edit mode (tap the three dots `...`).
3. Scroll down to the **URL** action.
4. Change `solomonos1` to **your Zo handle** (e.g., `https://yourhandle.zo.space/api/remove-bg`).
5. Tap **Done**.

Now the user can share any photo from their Photos app, select "Remove BG", and it will process unlimited background removals directly on their own Zo server!