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
2. Create or update the zo.space route `/api/remove-bg` using `update_space_route` with `route_type="api"`, `public=True`, and the following TypeScript code:
   ```typescript
   import type { Context } from "hono";
   import { writeFile, readFile, unlink, mkdir } from "fs/promises";
   import { randomUUID } from "crypto";
   import path from "path";
   import { exec } from "child_process";
   import { promisify } from "util";

   const execAsync = promisify(exec);
   const TMP_DIR = "/tmp/photo-studio";

   async function getImageBuffer(c: Context): Promise<{ buf: Buffer; name: string } | null> {
     const contentType = c.req.header("content-type") || "";

     if (contentType.includes("multipart") || contentType.includes("form")) {
       try {
         const body = await c.req.parseBody();
         for (const key of ["image", "file", "photo"]) {
           const file = body[key];
           if (file && typeof file !== "string") {
             return { buf: Buffer.from(await file.arrayBuffer()), name: file.name || "image.jpg" };
           }
         }
         for (const [, val] of Object.entries(body)) {
           if (val && typeof val !== "string" && typeof (val as any).arrayBuffer === "function") {
             return { buf: Buffer.from(await (val as any).arrayBuffer()), name: (val as any).name || "image.jpg" };
           }
         }
       } catch (e) {
         console.log("Multipart parse failed, trying raw body:", e);
       }
     }

     if (contentType.includes("image") || contentType.includes("octet-stream")) {
       const buf = Buffer.from(await c.req.arrayBuffer());
       if (buf.length > 0) return { buf, name: "image.jpg" };
     }

     try {
       const buf = Buffer.from(await c.req.arrayBuffer());
       if (buf.length > 1000) return { buf, name: "image.jpg" };
     } catch {}

     return null;
   }

   const PYTHON_SCRIPT = \`
   from rembg import remove, new_session
   from PIL import Image
   import sys

   session = new_session("birefnet-general")
   img = Image.open(sys.argv[1])
   result = remove(img, session=session)
   result.save(sys.argv[2])
   print(f"OK {result.size[0]}x{result.size[1]}")
   \`.trim();

   export default async (c: Context) => {
     if (c.req.method === "GET") {
       return c.json({ status: "ok", usage: "POST with an image (multipart form, or raw body)" });
     }

     try {
       await mkdir(TMP_DIR, { recursive: true });

       const image = await getImageBuffer(c);
       if (!image) {
         return c.json({ error: "No image file provided. Send multipart with field 'image'" }, 400);
       }

       const id = randomUUID();
       const ext = path.extname(image.name) || ".jpg";
       const inputPath = \`\${TMP_DIR}/\${id}\${ext}\`;
       const outputPath = \`\${TMP_DIR}/\${id}_nobg.png\`;

       await writeFile(inputPath, image.buf);
       console.log("Processing image:", image.buf.length, "bytes,", image.name);

       const scriptPath = \`\${TMP_DIR}/\${id}_process.py\`;
       await writeFile(scriptPath, PYTHON_SCRIPT);

       const { stdout } = await execAsync(
         \`python3 "\${scriptPath}" "\${inputPath}" "\${outputPath}"\`,
         { timeout: 180000, maxBuffer: 50 * 1024 * 1024 }
       );
       console.log("rembg:", stdout.trim());

       const result = await readFile(outputPath);
       console.log("Output:", result.length, "bytes");

       unlink(inputPath).catch(() => {});
       unlink(outputPath).catch(() => {});
       unlink(scriptPath).catch(() => {});

       return new Response(result, {
         headers: {
           "Content-Type": "image/png",
           "Content-Disposition": \`attachment; filename="\${path.basename(image.name, ext)}_nobg.png"\`,
         },
       });
     } catch (err: any) {
       console.error("remove-bg error:", err);
       return c.json({ error: err.message || "Processing failed" }, 500);
     }
   };
   ```
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