#!/usr/bin/env bun
/**
 * Unlock Article - Paywall Bypass Tool
 * Uses agent-browser for better paywall bypass capabilities
 */

import { $ } from "bun";

interface ArticleResult {
  success: boolean;
  filepath?: string;
  title?: string;
  error?: string;
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").replace(/\./g, "-");
  } catch {
    return "unknown";
  }
}

function sanitizeFilename(title: string): string {
  return title
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

async function tryArchiveServices(url: string): Promise<string | null> {
  const services = [
    `https://r.jina.ai/http://${url}`,
    `https://r.jina.ai/http://cc.bingj.com/cache.aspx?d=503-3904-1769&u=${encodeURIComponent(url)}`,
  ];

  for (const serviceUrl of services) {
    try {
      const response = await fetch(serviceUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (response.ok) {
        const text = await response.text();
        if (text.length > 500) {
          return text;
        }
      }
    } catch (e) {
      // Continue to next service
    }
  }

  return null;
}

async function tryAgentBrowser(url: string): Promise<string | null> {
  try {
    // Use agent-browser to render the page fully
    const result = await $`agent-browser page ${url} --format markdown --wait 3000`.text();
    
    if (result.includes("security verification") || result.includes("CAPTCHA") || result.includes("bot")) {
      return null;
    }
    
    return result.length > 500 ? result : null;
  } catch {
    return null;
  }
}

async function tryZoReadWebpage(url: string): Promise<string | null> {
  try {
    // Try using read_webpage via Zo API
    const response = await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.ZO_CLIENT_IDENTITY_TOKEN || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: `Read and extract the full article content from this URL: ${url}\n\nReturn the article title and full text content as markdown. If there's a paywall, try to bypass it using archive services or any available method.`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.output;
    }
    return null;
  } catch {
    return null;
  }
}

async function extractWithReadability(html: string, url: string): Promise<{ title: string; content: string } | null> {
  try {
    // Use Mozilla's Readability via a simple extraction
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || "Untitled Article";

    // Basic content extraction - look for article content
    let content = html;

    // Remove script and style tags
    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

    // Look for article or main content
    const articleMatch = content.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const contentMatch = content.match(/<div[^>]*class=["'][^"']*(?:content|article|post)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    let extractedContent = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || content;

    // Convert to markdown
    extractedContent = extractedContent
      .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "");

    // Clean up
    extractedContent = extractedContent
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { title, content: extractedContent };
  } catch {
    return null;
  }
}

async function saveArticle(
  title: string,
  content: string,
  url: string,
  outputDir: string
): Promise<string> {
  const domain = extractDomain(url);
  const safeTitle = sanitizeFilename(title);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${safeTitle}_${timestamp}.md`;

  const articleDir = `${outputDir}/${domain}`;
  await $`mkdir -p ${articleDir}`;

  const filepath = `${articleDir}/${filename}`;

  const markdown = `---
title: ${title}
source_url: ${url}
date_saved: ${new Date().toISOString()}
---

# ${title}

*Source: [${url}](${url})*

---

${content}
`;

  await Bun.write(filepath, markdown);
  return filepath;
}

async function unlockArticle(url: string, outputDir: string): Promise<ArticleResult> {
  console.log(`Unlocking: ${url}`);

  let content: string | null = null;
  let source = "";

  // Try text extraction services first (fastest)
  console.log("  Trying text extraction services...");
  content = await tryArchiveServices(url);
  if (content) source = "extraction service";

  // Try agent-browser with wait
  if (!content) {
    console.log("  Trying browser automation...");
    content = await tryAgentBrowser(url);
    if (content) source = "browser";
  }

  // Try Zo API as last resort
  if (!content) {
    console.log("  Trying Zo webpage reader...");
    content = await tryZoReadWebpage(url);
    if (content) source = "Zo reader";
  }

  if (!content) {
    return {
      success: false,
      error: "Could not bypass paywall. This article may require authentication, have a hard paywall, or use strong bot protection.",
    };
  }

  console.log(`  Content retrieved via ${source}`);

  // Check if we got clean markdown directly
  let title: string;
  let articleContent: string;

  if (content.includes("#") && content.length > 1000) {
    // Looks like markdown already
    const titleMatch = content.match(/^#\s+(.+)$/m);
    title = titleMatch?.[1] || "Article";
    articleContent = content;
  } else {
    // Need to extract
    const extracted = await extractWithReadability(content, url);
    if (!extracted || extracted.content.length < 100) {
      return {
        success: false,
        error: "Could not extract readable article content from the retrieved page.",
      };
    }
    title = extracted.title;
    articleContent = extracted.content;
  }

  const filepath = await saveArticle(title, articleContent, url, outputDir);

  console.log(`\n✓ Article saved to: ${filepath}`);
  console.log(`  Title: ${title}`);
  console.log(`  Length: ${articleContent.length} characters`);

  return {
    success: true,
    filepath,
    title,
  };
}

// CLI
const url = process.argv[2];
const outputDir = process.argv[3] || "/home/workspace/Articles";

if (!url) {
  console.log("Usage: bun run unlock.ts <article-url> [output-directory]");
  process.exit(1);
}

if (!url.startsWith("http")) {
  console.log("Error: URL must start with http:// or https://");
  process.exit(1);
}

const result = await unlockArticle(url, outputDir);

if (!result.success) {
  console.error(`\n✗ ${result.error}`);
  process.exit(1);
}
