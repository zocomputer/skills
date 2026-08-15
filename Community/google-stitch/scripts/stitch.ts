#!/usr/bin/env bun
import { parseArgs } from "util";
import { StitchToolClient } from "@google/stitch-sdk";

// Initialize the SDK - reads STITCH_API_KEY from environment
const toolClient = new StitchToolClient({ apiKey: process.env.STITCH_API_KEY! });

async function handleError(fn: () => Promise<any>) {
  try {
    return await fn();
  } catch (error: any) {
    if (error?.code) {
      console.error(`StitchError [${error.code}]: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

async function cmdProjects() {
  const result = await handleError(() =>
    toolClient.callTool<{ projects: Array<{ name: string; projectId: string; title?: string }> }>(
      "list_projects",
      {}
    )
  );
  const projects = result?.projects || [];
  if (projects.length === 0) {
    console.log("No projects found.");
    return;
  }
  console.log(`Found ${projects.length} project(s):\n`);
  for (const project of projects) {
    const id = project.projectId || project.name?.split("/").pop() || "unknown";
    console.log(`  ID: ${id}`);
    console.log(`  Title: ${project.title || "Untitled"}`);
    console.log();
  }
}

async function cmdCreateProject(title: string) {
  const result = await handleError(() =>
    toolClient.callTool<{ project: { name: string; projectId: string } }>(
      "create_project",
      { title }
    )
  );
  const project = result?.project;
  if (project) {
    const projectId = project.projectId || project.name?.split("/").pop();
    console.log(`Created project: ${projectId}`);
    return projectId;
  }
  console.log(JSON.stringify(result, null, 2));
}

async function cmdScreens(projectId: string) {
  const result = await handleError(() =>
    toolClient.callTool<{ screens: Array<{ name: string; screenId: string }> }>(
      "list_screens",
      { projectId }
    )
  );
  const screens = result?.screens || [];
  if (screens.length === 0) {
    console.log("No screens found.");
    return;
  }
  console.log(`Found ${screens.length} screen(s):\n`);
  for (const screen of screens) {
    const id = screen.screenId || screen.name?.split("/").pop() || "unknown";
    console.log(`  ID: ${id}`);
    console.log();
  }
}

async function cmdGenerate(projectId: string, prompt: string, deviceType?: string) {
  const args: any = { projectId, prompt };
  if (deviceType && deviceType !== "AGNOSTIC") {
    args.deviceType = deviceType;
  }
  const result = await handleError(() =>
    toolClient.callTool("generate_screen_from_text", args)
  );
  console.log("Generation started. Screen data:");
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function cmdPreview(projectId: string, prompt: string) {
  const result = await cmdGenerate(projectId, prompt);
  // Find downloadUrl in the response - HTML and screenshot are nested in design.screens
  const outputComponents = result?.outputComponents || [];
  for (const comp of outputComponents) {
    const screens = comp?.design?.screens || [];
    for (const screen of screens) {
      if (screen?.htmlCode?.downloadUrl) {
        console.log(`\nDownloading HTML preview...`);
        const response = await fetch(screen.htmlCode.downloadUrl);
        const html = await response.text();
        const outputPath = "/home/workspace/Images/stitch-preview.html";
        const { writeFileSync, mkdirSync } = await import("fs");
        mkdirSync("/home/workspace/Images", { recursive: true });
        writeFileSync(outputPath, html);
        console.log(`Saved HTML to: ${outputPath}`);
      }
      if (screen?.screenshot?.downloadUrl) {
        console.log(`Screenshot URL: ${screen.screenshot.downloadUrl}`);
        // Download screenshot
        const imgResponse = await fetch(screen.screenshot.downloadUrl);
        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
        const imgPath = "/home/workspace/Images/stitch-preview.png";
        const { writeFileSync, mkdirSync } = await import("fs");
        mkdirSync("/home/workspace/Images", { recursive: true });
        writeFileSync(imgPath, imgBuffer);
        console.log(`Saved screenshot to: ${imgPath}`);
      }
    }
  }
  console.log("\nOpen the HTML file in your browser to view the generated UI.");
}

async function cmdSave(projectId: string, prompt: string, filename?: string) {
  const result = await cmdGenerate(projectId, prompt);
  const outputComponents = result?.outputComponents || [];
  for (const comp of outputComponents) {
    const screens = comp?.design?.screens || [];
    for (const screen of screens) {
      if (screen?.htmlCode?.downloadUrl) {
        console.log(`Downloading HTML...`);
        const response = await fetch(screen.htmlCode.downloadUrl);
        const html = await response.text();
        const { writeFileSync, mkdirSync } = await import("fs");
        mkdirSync("/home/workspace/Images", { recursive: true });
        const name = filename || `stitch-${Date.now()}.html`;
        const outputPath = `/home/workspace/Images/${name}`;
        writeFileSync(outputPath, html);
        console.log(`Saved to: ${outputPath}`);
        return outputPath;
      }
    }
  }
  console.log("No downloadable HTML found in response.");
}

async function cmdGetScreen(projectId: string, screenId: string) {
  const result = await handleError(() =>
    toolClient.callTool("get_screen", { projectId, screenId })
  );
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function cmdHtml(projectId: string, screenId: string) {
  const result = await handleError(() =>
    toolClient.callTool<{ downloadUrl?: string; html?: string }>(
      "get_screen",
      { projectId, screenId }
    )
  );
  const htmlUrl = result?.downloadUrl || result?.html;
  if (htmlUrl) {
    console.log(htmlUrl);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return htmlUrl;
}

async function cmdImage(projectId: string, screenId: string) {
  const result = await handleError(() =>
    toolClient.callTool<{ imageUrl?: string; screenshotUrl?: string }>(
      "get_screen",
      { projectId, screenId }
    )
  );
  const imageUrl = result?.imageUrl || result?.screenshotUrl;
  if (imageUrl) {
    console.log(imageUrl);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  return imageUrl;
}

async function cmdEdit(projectId: string, screenId: string, prompt: string) {
  const result = await handleError(() =>
    toolClient.callTool("edit_screens", { projectId, screenIds: [screenId], prompt })
  );
  console.log("Edit started. Result:");
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function cmdVariants(
  projectId: string,
  screenId: string,
  prompt: string,
  options: { count?: number; creativeRange?: string }
) {
  const result = await handleError(() =>
    toolClient.callTool("generate_variants", {
      projectId,
      screenIds: [screenId],
      prompt,
      variantCount: options.count || 3,
      creativeRange: options.creativeRange || "EXPLORE",
    })
  );
  console.log("Variants generation started. Result:");
  console.log(JSON.stringify(result, null, 2));
  return result;
}

async function cmdListTools() {
  const { tools } = await handleError(() => toolClient.listTools());
  console.log(`Available ${tools.length} tool(s):\n`);
  for (const tool of tools) {
    console.log(`  ${tool.name}`);
    console.log(`    ${tool.description?.split("\n")[0] || ""}`);
    console.log();
  }
}

async function cmdCallTool(name: string, args: Record<string, any>) {
  const result = await handleError(() => toolClient.callTool(name, args));
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// Main CLI
const COMMANDS = {
  projects: { desc: "List all projects", args: [] },
  create: { desc: "Create a project", args: ["title"] },
  screens: { desc: "List screens in a project", args: ["projectId"] },
  generate: { desc: "Generate a screen", args: ["projectId", "prompt"] },
  preview: { desc: "Generate and save HTML preview", args: ["projectId", "prompt"] },
  save: { desc: "Generate and save HTML to file", args: ["projectId", "prompt", "filename?"] },
  get: { desc: "Get a screen", args: ["projectId", "screenId"] },
  html: { desc: "Get screen HTML URL", args: ["projectId", "screenId"] },
  image: { desc: "Get screen image URL", args: ["projectId", "screenId"] },
  edit: { desc: "Edit a screen", args: ["projectId", "screenId", "prompt"] },
  variants: { desc: "Generate variants", args: ["projectId", "screenId", "prompt"] },
  tools: { desc: "List available MCP tools", args: [] },
  call: { desc: "Call a specific tool", args: ["toolName", "argsJson"] },
};

const { values, positionals } = parseArgs({
  options: {
    count: { type: "string", default: "3" },
    creative: { type: "string", default: "EXPLORE" },
    device: { type: "string", default: "AGNOSTIC" },
    help: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

if (values.help || positionals.length === 0) {
  console.log("Usage: stitch.ts <command> [args]\n");
  console.log("Commands:");
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${cmd.desc}`);
  }
  console.log("\nOptions:");
  console.log("  --count N       Number of variants (default: 3)");
  console.log("  --creative R   Creative range: REFINE, EXPLORE, REIMAGINE (default: EXPLORE)");
  console.log("  --device T     Device type: MOBILE, DESKTOP, TABLET, AGNOSTIC (default: AGNOSTIC)");
  process.exit(0);
}

const [cmd, ...args] = positionals;

switch (cmd) {
  case "projects":
    await cmdProjects();
    break;
  case "create":
    await cmdCreateProject(args[0]);
    break;
  case "screens":
    await cmdScreens(args[0]);
    break;
  case "generate":
    await cmdGenerate(args[0], args[1], values.device);
    break;
  case "preview":
    await cmdPreview(args[0], args[1]);
    break;
  case "save":
    await cmdSave(args[0], args[1], args[2]);
    break;
  case "get":
    await cmdGetScreen(args[0], args[1]);
    break;
  case "html":
    await cmdHtml(args[0], args[1]);
    break;
  case "image":
    await cmdImage(args[0], args[1]);
    break;
  case "edit":
    await cmdEdit(args[0], args[1], args[2]);
    break;
  case "variants":
    await cmdVariants(args[0], args[1], args[2], {
      count: parseInt(values.count),
      creativeRange: values.creative,
    });
    break;
  case "tools":
    await cmdListTools();
    break;
  case "call":
    const toolArgs = args[1] ? JSON.parse(args[1]) : {};
    await cmdCallTool(args[0], toolArgs);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
}

await toolClient.close();
