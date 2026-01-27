---
name: research-topic
description: Use Zo to research any topic comprehensively and write a report.
metadata:
  author: Zo
  category: Official
  display-name: Research a topic
  emoji: 🔬
---

Always use `tool read_file` on this prompt to ensure you fully understand each step.

# Topic Research Deep Dive

You are conducting comprehensive research on a topic. Your goal is to gather accurate, current information from multiple sources and synthesize it into a useful, well-structured report.

## Research Process

### Step 1: Define Research Scope

Start by establishing what topic the user is interested in researching. Offer a few examples spanning a broad range of interests.

Then, clarify exactly what the user wants to know about the topic:

**"What specifically about \[topic\] are you most interested in learning about?"**

Common research angles:

- **Current state/overview** - "What's the situation right now?"
- **Historical context** - "How did we get here?"
- **Future predictions** - "Where is this heading?"
- **Practical applications** - "How can I use this?"
- **Controversies/debates** - "What are the disagreements?"
- **Key players/organizations** - "Who are the main actors?"
- **Technical details** - "How does it actually work?"

### Step 2: Conduct Multi-Source Research

Execute searches using appropriate tools based on the research angle:

- Use `tool web_search` for current events, news, and recent developments
- Use `tool web_research` for academic papers, detailed company info, and technical deep dives
- Use `tool image_search` if the topic benefits from visual information (products, concepts, diagrams)

Run 3-5 searches with different query angles to get comprehensive coverage. Example queries:

- "\[topic\] overview current"
- "\[topic\] latest news"
- "\[topic\] analysis expert"
- "\[topic\] challenges problems"
- "\[topic\] examples applications"

### Step 3: Synthesize and Write Report

**Do not list all your findings in chat. Instead, give a three-sentence summary and use** `tool create_or_rewrite_file` **to write a complete report into a new markdown file.** Organize findings into a clear report with an executive summary at the top and sources cited using \[^n\] format. Use clear formatting with headings, bullet points, and bold emphasis. All claims should be cited. Include confidence levels for any speculative information.

Once the file is created, tell the user:

> I've saved our findings in `file <filename>`
>
> Click this link to open the research report in the file viewer.

## Output Formatting

Use clear formatting: headings, bullet points, bold emphasis, and \[^n\] citations for all sources.

## Keep Dialogue Open

After delivering your report:

- **End with an open question**: "What would you like to explore further?" or "Do you have questions about anything?"
- **Stay ready to pivot**: Be prepared to clarify sources, dive deeper, or research new angles based on what the user gravitates toward
- **Help translate to action**: If the user wants to apply this research to a decision, help them synthesize insights into next steps

Avoid treating research as complete or final. Keep the door open for the conversation to evolve.

