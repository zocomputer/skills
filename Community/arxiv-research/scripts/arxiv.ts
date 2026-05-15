#!/usr/bin/env bun

import { parseArgs } from "util";
import { mkdir, readdir, readFile, writeFile, exists } from "node:fs/promises";
import { join } from "node:path";

const STORAGE_PATH = "/home/workspace/Research/arxiv-papers";

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  authors: string[];
  published: string;
  updated: string;
  categories: string[];
  pdf_url: string;
  primary_category: string;
}

interface SearchOptions {
  max?: number;
  from?: string;
  categories?: string;
}

async function ensureStorage() {
  await mkdir(STORAGE_PATH, { recursive: true });
}

async function searchPapers(query: string, options: SearchOptions = {}): Promise<ArxivEntry[]> {
  const max = options.max || 10;
  const maxResults = Math.min(max, 50);

  let url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

  if (options.from) {
    url += `&submittedDateFrom=${options.from}`;
  }

  if (options.categories) {
    const cats = options.categories.split(",").map(c => c.trim());
    const catQuery = cats.map(c => `cat:${c}`).join("+OR+");
    url = url.replace(`all:${encodeURIComponent(query)}`, `(${catQuery})+AND+all:${encodeURIComponent(query)}`);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  return parseArxivFeed(xml);
}

function parseArxivFeed(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const idMatch = entryXml.match(/<id>([^<]+)<\/id>/);
    const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
    const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);
    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);

    const authorMatches = [...entryXml.matchAll(/<author>\s*<name>([^<]+)<\/name>\s*<\/author>/g)];
    const authors = authorMatches.map(m => m[1]);

    const categoryMatches = [...entryXml.matchAll(/<category term="([^"]+)"/g)];
    const categories = categoryMatches.map(m => m[1]);

    const primaryCatMatch = entryXml.match(/<arxiv:primary_category term="([^"]+)"/);
    const primary_category = primaryCatMatch ? primaryCatMatch[1] : categories[0] || "";

    const arxivIdMatch = idMatch ? idMatch[1].match(/arxiv\.org\/abs\/(.+?)$/)
      : entryXml.match(/<arxiv:id>([^<]+)<\/arxiv:id>/);
    const arxivId = arxivIdMatch ? arxivIdMatch[1] : idMatch ? idMatch[1].split("/").pop() || "" : "";

    entries.push({
      id: arxivId,
      title: titleMatch ? cleanText(titleMatch[1]) : "",
      summary: summaryMatch ? cleanText(summaryMatch[1]) : "",
      authors,
      published: publishedMatch ? publishedMatch[1] : "",
      updated: updatedMatch ? updatedMatch[1] : "",
      categories,
      pdf_url: `https://arxiv.org/pdf/${arxivId}.pdf`,
      primary_category: primary_category
    });
  }

  return entries;
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
}

async function downloadPaper(paperId: string, silent = false): Promise<string> {
  await ensureStorage();

  const cleanId = paperId.replace(/^arxiv:/, "").trim();
  const pdfPath = join(STORAGE_PATH, `${cleanId}.pdf`);
  const metaPath = join(STORAGE_PATH, `${cleanId}.json`);

  if (await exists(pdfPath)) {
    if (!silent) console.log(`Paper ${cleanId} already downloaded.`);
    return pdfPath;
  }

  const pdfUrl = `https://arxiv.org/pdf/${cleanId}.pdf`;
  if (!silent) console.log(`Downloading ${cleanId}...`);

  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const pdfBuffer = await response.arrayBuffer();
  await writeFile(pdfPath, Buffer.from(pdfBuffer));

  try {
    const metaUrl = `http://export.arxiv.org/api/query?id_list=${cleanId}`;
    const metaResponse = await fetch(metaUrl);
    if (metaResponse.ok) {
      const xml = await metaResponse.text();
      const entries = parseArxivFeed(xml);
      if (entries.length > 0) {
        await writeFile(metaPath, JSON.stringify(entries[0], null, 2));
      }
    }
  } catch {
    // Metadata fetch failed, but PDF is downloaded
  }

  if (!silent) console.log(`Downloaded to ${pdfPath}`);
  return pdfPath;
}

async function listPapers(json = false): Promise<{ id: string; title: string; path: string }[]> {
  await ensureStorage();

  const files = await readdir(STORAGE_PATH);
  const pdfs = files.filter(f => f.endsWith(".pdf"));

  const papers: { id: string; title: string; path: string; hasMarkdown: boolean }[] = [];

  for (const pdf of pdfs) {
    const paperId = pdf.replace(".pdf", "");
    const metaPath = join(STORAGE_PATH, `${paperId}.json`);
    const pdfPath = join(STORAGE_PATH, pdf);
    const mdPath = join(STORAGE_PATH, `${paperId}.md`);

    let title = "Unknown";
    try {
      if (await exists(metaPath)) {
        const meta = JSON.parse(await readFile(metaPath, "utf-8"));
        title = meta.title || "Unknown";
      }
    } catch {
      // Ignore
    }

    papers.push({ id: paperId, title, path: pdfPath, hasMarkdown: await exists(mdPath) });
  }

  if (!json) {
    if (papers.length === 0) {
      console.log("No papers downloaded yet.");
    } else {
      console.log(`Found ${papers.length} paper(s):\n`);
      for (const paper of papers) {
        const mdIndicator = paper.hasMarkdown ? " [MD]" : "";
        console.log(`  ${paper.id}: ${paper.title}${mdIndicator}`);
      }
    }
  }

  return papers.map(p => ({ id: p.id, title: p.title, path: p.path }));
}

async function readPaperContent(paperId: string, format?: "text" | "markdown", withPageMarkers = false): Promise<string | null> {
  const cleanId = paperId.replace(/^arxiv:/, "").trim();
  const pdfPath = join(STORAGE_PATH, `${cleanId}.pdf`);
  const mdPath = join(STORAGE_PATH, `${cleanId}.md`);

  if (!(await exists(pdfPath))) {
    return null;
  }

  const hasMarkdown = await exists(mdPath);

  // Determine format: explicit > auto-detect
  if (format === "markdown") {
    if (hasMarkdown) {
      console.error("[Reading from Markdown]");
      return await readFile(mdPath, "utf-8");
    }
    throw new Error(`Markdown not found for ${cleanId}. Run: bun arxiv.ts convert ${cleanId}`);
  }

  if (format === "text" || !hasMarkdown) {
    if (!format) console.error("[Reading from PDF]");
    let text: string;

    // Try pdftotext first (fastest)
    const proc = Bun.spawn(["which", "pdftotext"], { stdout: "pipe" });
    const hasPdftotext = (await new Response(proc.stdout).text()).trim() !== "";

    if (hasPdftotext) {
      if (withPageMarkers) {
        const result = Bun.spawn(["pdftotext", "-layout", pdfPath, "-"], { stdout: "pipe" });
        text = await new Response(result.stdout).text();
      } else {
        const result = Bun.spawn(["pdftotext", pdfPath, "-"], { stdout: "pipe" });
        text = await new Response(result.stdout).text();
      }
    } else {
      // Fallback to external Python script
      const scriptDir = import.meta.dirname || import.meta.url.replace("file://", "").replace(/\/[^\/]+$/, "");
      const pyScript = join(scriptDir, "extract_text.py");
      
      const result = Bun.spawn(["python3", pyScript, pdfPath, withPageMarkers ? "true" : "false"], { 
        stdout: "pipe", 
        stderr: "pipe" 
      });
      text = await new Response(result.stdout).text();
      
      if (!text.trim()) {
        const err = await new Response(result.stderr).text();
        if (err.includes("No module named")) {
          throw new Error("PDF extraction requires PyPDF2. Install with: pip3 install PyPDF2");
        }
      }
    }

    return text;
  }

  // Auto: markdown exists and no explicit format
  console.error("[Reading from Markdown]");
  return await readFile(mdPath, "utf-8");
}

async function convertToMarkdown(paperId: string): Promise<string> {
  const cleanId = paperId.replace(/^arxiv:/, "").trim();
  const pdfPath = join(STORAGE_PATH, `${cleanId}.pdf`);
  const mdPath = join(STORAGE_PATH, `${cleanId}.md`);

  if (!(await exists(pdfPath))) {
    throw new Error(`Paper ${cleanId} not found. Download it first.`);
  }

  if (await exists(mdPath)) {
    console.log(`Markdown already exists for ${cleanId}`);
    return mdPath;
  }

  const scriptDir = import.meta.dirname || import.meta.url.replace("file://", "").replace(/\/[^\/]+$/, "");
  const pyScript = join(scriptDir, "convert_to_markdown.py");
  
  console.log(`Converting ${cleanId} to Markdown...`);
  
  const result = Bun.spawn(["python3", pyScript, pdfPath, mdPath], { 
    stdout: "pipe", 
    stderr: "pipe" 
  });
  const output = await new Response(result.stdout).text();
  const stderr = await new Response(result.stderr).text();

  if (!output.trim() && stderr.includes("No module named")) {
    throw new Error("PDF conversion requires PyMuPDF. Install with: pip3 install PyMuPDF");
  }

  console.log(`Converted to ${mdPath}`);
  return mdPath;
}

async function readPaper(paperId: string, maxChars = 5000, format?: "text" | "markdown"): Promise<void> {
  const text = await readPaperContent(paperId, format);

  if (text === null) {
    console.log(`Paper ${paperId} not found. Download it first:`);
    console.log(`  bun arxiv.ts download ${paperId}`);
    return;
  }

  const preview = text.slice(0, maxChars);
  console.log(preview);
  if (text.length > maxChars) {
    console.log(`\n... (${text.length - maxChars} more characters)`);
  }
}

async function getPaperMetadata(paperId: string): Promise<ArxivEntry | null> {
  const cleanId = paperId.replace(/^arxiv:/, "").trim();
  const metaPath = join(STORAGE_PATH, `${cleanId}.json`);

  if (await exists(metaPath)) {
    try {
      return JSON.parse(await readFile(metaPath, "utf-8"));
    } catch {
      return null;
    }
  }
  return null;
}

// MCP-compatible functions
async function mcpSearchPapers(args: { query: string; max_results?: number; date_from?: string; categories?: string[] }) {
  try {
    const catString = args.categories?.join(",");
    const results = await searchPapers(args.query, {
      max: args.max_results,
      from: args.date_from,
      categories: catString
    });

    const formatted = results.map(p => ({
      id: p.id,
      title: p.title,
      authors: p.authors,
      published: p.published,
      categories: p.categories,
      summary: p.summary,
      pdf_url: p.pdf_url
    }));

    return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
}

async function mcpDownloadPaper(args: { paper_id: string }) {
  try {
    const path = await downloadPaper(args.paper_id, true);
    return { content: [{ type: "text", text: JSON.stringify({ success: true, paper_id: args.paper_id, path }) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
  }
}

async function mcpListPapers() {
  const papers = await listPapers(true);
  return { content: [{ type: "text", text: JSON.stringify(papers, null, 2) }] };
}

async function mcpReadPaper(args: { paper_id: string }) {
  const text = await readPaperContent(args.paper_id);
  if (text === null) {
    return { content: [{ type: "text", text: `Paper ${args.paper_id} not found. Download it first.` }], isError: true };
  }
  return { content: [{ type: "text", text }] };
}

async function main() {
  const { positionals, values } = parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      max: { type: "string" },
      from: { type: "string" },
      categories: { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" }
    }
  });

  const command = positionals[0];
  const arg = positionals[1];

  const commandMap: Record<string, string> = {
    "search_papers": "search",
    "download_paper": "download",
    "list_papers": "list",
    "read_paper": "read"
  };
  const normalizedCommand = commandMap[command] || command;

  if (values.help || !command) {
    console.log(`
ArXiv Research Tool - MCP Compatible

Usage:
  bun arxiv.ts <command> [options]

Commands:
  search <query>              Search for papers
  search_papers <query>       MCP alias for search
  download <paper-id>         Download a paper by arXiv ID
  download_paper <paper-id>   MCP alias for download
  list                        List all downloaded papers
  list_papers                 MCP alias for list
  read <paper-id>             Read content of a downloaded paper
  read_paper <paper-id>       MCP alias for read
  convert <paper-id>          Convert PDF to Markdown (best for citations)
  mcp <tool> <args>           Execute MCP tool directly (JSON I/O)

Options:
  --max <n>            Max results (default: 10, max: 50)
  --from <date>        Date filter (YYYY-MM-DD format)
  --categories <cats>  Comma-separated arXiv categories
  --json               Output as JSON (for programmatic use)
  -h, --help           Show this help

Examples:
  bun arxiv.ts search "transformer architecture" --max 5
  bun arxiv.ts search_papers "quantum" --categories cs.AI,quant-ph
  bun arxiv.ts download 2401.12345
  bun arxiv.ts download_paper 2401.12345
  bun arxiv.ts list --json
  bun arxiv.ts convert 2401.12345
  bun arxiv.ts read 2401.12345
  bun arxiv.ts mcp search_papers '{"query": "AI", "max_results": 5}'

Prompt:
  deep-paper-analysis  <paper_id>
    Comprehensive analysis workflow that automatically downloads,
    reads, and analyzes a paper. Only requires a paper ID.
`);
    process.exit(0);
  }

  if (normalizedCommand === "mcp") {
    const toolName = arg;
    const argsJson = positionals.slice(2).join(" ") || "{}";
    const args = JSON.parse(argsJson);

    let result;
    switch (toolName) {
      case "search_papers":
        result = await mcpSearchPapers(args);
        break;
      case "download_paper":
        result = await mcpDownloadPaper(args);
        break;
      case "list_papers":
        result = await mcpListPapers();
        break;
      case "read_paper":
        result = await mcpReadPaper(args);
        break;
      default:
        console.error(`Unknown MCP tool: ${toolName}`);
        process.exit(1);
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (normalizedCommand === "deep-paper-analysis") {
    if (!arg) {
      console.error("Error: Paper ID required for deep analysis");
      console.error("  bun arxiv.ts deep-paper-analysis <paper-id>");
      process.exit(1);
    }

    const paperId = arg.replace(/^arxiv:/, "").trim();
    console.log(`=== Deep Paper Analysis: ${paperId} ===\n`);

    console.log("Step 1: Checking downloaded papers...");
    const papers = await listPapers(true);
    const paperExists = papers.some(p => p.id === paperId);

    if (!paperExists) {
      console.log(`Step 2: Downloading paper ${paperId}...`);
      try {
        await downloadPaper(paperId, true);
        console.log("Downloaded successfully.\n");
      } catch (error) {
        console.error(`Failed to download: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    } else {
      console.log("Step 2: Paper already downloaded.\n");
    }

    console.log("Step 3: Retrieving metadata...");
    const metadata = await getPaperMetadata(paperId);
    if (metadata) {
      console.log(`Title: ${metadata.title}`);
      console.log(`Authors: ${metadata.authors.join(", ")}`);
      console.log(`Published: ${metadata.published.split("T")[0]}`);
      console.log(`Categories: ${metadata.categories.join(", ")}`);
      console.log(`Summary: ${metadata.summary.slice(0, 300)}...\n`);
    }

    console.log("Step 4: Converting to Markdown (if needed)...");
    try {
      await convertToMarkdown(paperId);
      console.log("Markdown ready.\n");
    } catch {
      console.log("PDF text extraction will be used.\n");
    }

    console.log("Step 5: Reading paper content...");
    const content = await readPaperContent(paperId);
    if (content === null) {
      console.error("Failed to read paper content.");
      process.exit(1);
    }
    console.log(`Extracted ${content.length.toLocaleString()} characters.\n`);

    const output = {
      paper_id: paperId,
      metadata: metadata || null,
      content_length: content.length,
      content_preview: content.slice(0, 10000),
      instructions: "Analyze this paper comprehensively covering: executive summary, research context, methodology, results, practical implications, theoretical contributions, future directions, and critical assessment."
    };

    console.log("=== ANALYSIS DATA ===");
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  try {
    switch (normalizedCommand) {
      case "search":
      case "search_papers": {
        if (!arg) {
          console.error("Error: Search query required");
          process.exit(1);
        }
        const results = await searchPapers(arg, {
          max: values.max ? parseInt(values.max) : undefined,
          from: values.from,
          categories: values.categories
        });

        if (values.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log(`Found ${results.length} paper(s):\n`);
          for (const paper of results) {
            console.log(`ID:        ${paper.id}`);
            console.log(`Title:     ${paper.title}`);
            console.log(`Authors:   ${paper.authors.join(", ")}`);
            console.log(`Published: ${paper.published.split("T")[0]}`);
            console.log(`Category:  ${paper.primary_category}`);
            console.log(`Summary:   ${paper.summary.slice(0, 200)}...`);
            console.log("---");
          }
        }
        break;
      }

      case "download":
      case "download_paper": {
        if (!arg) {
          console.error("Error: Paper ID required");
          process.exit(1);
        }
        const path = await downloadPaper(arg);
        if (values.json) {
          console.log(JSON.stringify({ success: true, paper_id: arg, path }));
        }
        break;
      }

      case "list":
      case "list_papers": {
        if (values.json) {
          const papers = await listPapers(true);
          console.log(JSON.stringify(papers, null, 2));
        } else {
          await listPapers(false);
        }
        break;
      }

      case "read":
      case "read_paper": {
        if (!arg) {
          console.error("Error: Paper ID required");
          process.exit(1);
        }
        if (values.json) {
          const text = await readPaperContent(arg);
          if (text === null) {
            console.log(JSON.stringify({ error: "Paper not found", paper_id: arg }));
            process.exit(1);
          }
          console.log(JSON.stringify({ paper_id: arg, content: text }));
        } else {
          await readPaper(arg);
        }
        break;
      }

      case "convert": {
        if (!arg) {
          console.error("Error: Paper ID required");
          console.error("  bun arxiv.ts convert <paper-id>");
          process.exit(1);
        }
        await convertToMarkdown(arg);
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        console.error("Run 'bun arxiv.ts --help' for usage");
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

main();
