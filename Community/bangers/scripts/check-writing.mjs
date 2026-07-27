#!/usr/bin/env node
import fs from "node:fs";

const args = process.argv.slice(2);
const allowedOptions = new Set(["--no-em-dash"]);
const unknownOptions = args.filter((arg) => arg.startsWith("--") && !allowedOptions.has(arg));
if (unknownOptions.length > 0) {
  console.error(`writing-check: unknown option(s): ${unknownOptions.join(", ")}`);
  process.exit(2);
}
const noEmDash = args.includes("--no-em-dash");
const files = args.filter((arg) => !arg.startsWith("--"));
if (files.length === 0) {
  console.error("writing-check: pass one or more UTF-8 file paths; piped text can lose punctuation in Windows PowerShell");
  process.exit(2);
}
const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

const findings = [];
if (noEmDash && text.includes("\u2014")) {
  findings.push({ severity: "error", rule: "no-em-dash", count: text.split("\u2014").length - 1 });
}

const softPatterns = [
  ["fast-paced-world", /in today['’]s fast-paced world/gi],
  ["not-just-but", /not just\b[^.!?]{0,100}\bbut\b/gi],
  ["experts-agree", /experts agree/gi],
  ["delve", /\bdelve(?:s|d)?\b/gi],
  ["game-changer", /\bgame[- ]changer\b/gi],
  ["unlock-potential", /\bunlock(?:ing|s|ed)? (?:the |your )?potential\b/gi]
];
for (const [rule, pattern] of softPatterns) {
  const matches = text.match(pattern);
  if (matches) findings.push({ severity: "warning", rule, count: matches.length });
}

if (findings.length === 0) {
  console.log("writing-check: clean");
  process.exit(0);
}
for (const finding of findings) {
  console.log(`${finding.severity}: ${finding.rule} (${finding.count})`);
}
process.exit(findings.some((finding) => finding.severity === "error") ? 1 : 0);