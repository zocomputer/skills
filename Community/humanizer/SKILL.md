---
name: humanizer
description: >
  Detect and fix AI writing patterns. Use when writing outbound content like
  emails, proposals, blog posts, client deliverables, or any external-facing
  writing. Also use when asked to humanize, polish, or de-AI text.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# Humanizer

Strip AI writing patterns. Make prose sound like a person wrote it.

## When to Use

- Client deliverables (proposals, reports, analysis)
- Outbound emails, especially cold outreach and client updates
- Blog posts, social copy, marketing material
- Creative writing drafts
- Anything that leaves the workspace

Not needed for: internal notes, task descriptions, meeting records, code comments, chat responses.

## Voice Calibration

When humanizing text, apply the user's voice rules. If the user has a persona configured with specific voice preferences, those override the defaults below.

**Default voice rules (customize to your persona):**
- Brevity over ceremony. One sentence is fine.
- Don't soften bad news.
- Own mistakes quickly. No deflection.
- Prefer active voice and short sentences.
- Vary sentence length. Real writing isn't uniform.

**To customize**: Edit the "Voice Calibration" section above to match your persona's voice rules. For example, if your persona avoids em dashes and emojis, add those as hard rules. If your persona uses humor, specify the style.

## Process

1. Scan for patterns listed below
2. Fix each instance
3. Read the result aloud in your head. Does it sound like a person talking?
4. Check against voice rules
5. Verify: varied sentence length, actual opinions present, no robotic uniformity

## Pattern Catalog

### Content Patterns

**1. Significance inflation**

Puffing up importance with words like "pivotal," "testament," "crucial role," "setting the stage."

Before: The partnership was established in 2023, marking a pivotal moment in the evolution of regional distribution and setting the stage for industry transformation.
After: The partnership started in 2023 and gave them distribution in three new states.

**2. Superficial -ing analyses**

Tacking "-ing" phrases onto sentences for fake depth: "highlighting," "underscoring," "reflecting," "ensuring," "showcasing."

Before: The template uses blue and gold colors, symbolizing trust and premium quality, reflecting the brand's deep connection to its customer base.
After: The template uses blue and gold to match the existing brand palette.

**3. Promotional language**

Sounding like a brochure: "vibrant," "breathtaking," "renowned," "nestled," "in the heart of," "boasts a," "commitment to."

Before: Nestled in the vibrant heart of the city's tech corridor, the company boasts a commitment to premium quality.
After: The company operates out of downtown and focuses on enterprise sales.

**4. Vague attributions**

Attributing opinions to nobody: "Industry experts believe," "Observers have noted," "Some critics argue."

Before: Industry experts believe the market is poised for significant growth.
After: The market grew 12% YoY through Q3, per industry data.

**5. Formulaic "challenges and future" sections**

The "despite challenges, the future looks bright" sandwich.

Before: Despite facing challenges typical of emerging markets, including regulatory uncertainty and market saturation, the company continues to thrive as a key player in the landscape.
After: Regulatory delays pushed the launch from Q1 to Q3. The market is getting crowded but margins held steady.

**6. Generic positive conclusions**

Vague upbeat endings that say nothing.

Before: The future looks bright for the company. Exciting times lie ahead as they continue their journey toward excellence.
After: They plan to add two new accounts by Q2.

### Language Patterns

**7. Em dash overuse**

AI text overuses em dashes. Use periods, commas, semicolons, colons, or restructure the sentence.

Before: The project -- which started in January -- has been making progress -- albeit slower than expected.
After: The project started in January. Progress has been slower than expected.

**8. AI vocabulary words**

Words that appear far more in post-2023 AI text: "Additionally," "delve," "crucial," "foster," "garner," "interplay," "intricate," "landscape" (abstract), "pivotal," "showcase," "tapestry" (abstract), "testament," "underscore," "vibrant," "enhance," "enduring," "align with."

Before: Additionally, a crucial aspect of the strategy is fostering an enduring partnership that underscores the intricate interplay between brand and distributor in the evolving landscape.
After: The strategy depends on keeping distributors happy. Long-term deals beat one-offs.

**9. Copula avoidance**

Using "serves as," "stands as," "represents," "boasts," "features" instead of just "is" or "has."

Before: The dashboard serves as the primary interface for tracking sales metrics. It features four panels and boasts real-time updates.
After: The dashboard is the main sales tracker. It has four panels with real-time updates.

**10. Negative parallelisms**

"Not only... but also," "It's not just about X, it's about Y," "It's not merely X, it's Y."

Before: It's not just about the numbers; it's about building lasting relationships. It's not merely a tool, it's a transformation.
After: The numbers matter, but the repeat orders matter more.

**11. Rule of three overuse**

Forcing ideas into groups of three to sound comprehensive.

Before: The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.
After: The event has talks and panels. There's also time for networking between sessions.

**12. Synonym cycling**

Swapping synonyms to avoid repetition, making text read like a thesaurus exploded.

Before: The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs.
After: The protagonist faces many challenges but eventually gets through them.

### Style Patterns

**13. Emoji overuse**

AI text often adds emojis as decoration. Use them sparingly or not at all, depending on context.

**14. Boldface overuse**

Mechanically bolding every key term.

Before: It blends **OKRs**, **KPIs**, and visual tools like the **Business Model Canvas** and **Balanced Scorecard**.
After: It blends OKRs, KPIs, and visual strategy tools like the Business Model Canvas.

**15. Inline-header vertical lists**

Lists where every item starts with a bolded header and colon.

Before:
- **User Experience:** The interface has been significantly improved.
- **Performance:** Speed has been enhanced through optimized algorithms.
- **Security:** Protection has been strengthened with encryption.

After: The update improves the interface, speeds up load times, and adds end-to-end encryption.

**16. Title case in headings**

Capitalizing Every Word In A Heading.

Before: ## Strategic Negotiations And Global Partnerships
After: ## Strategic negotiations and global partnerships

**17. Curly quotation marks**

Some AI outputs use curly quotes. Use straight quotes for consistency.

**18. False ranges**

"From X to Y" constructions where X and Y aren't on a meaningful scale.

Before: Our journey takes us from the genesis of the brand to the grand vision of national expansion, from humble beginnings to soaring ambitions.
After: The deck covers where the brand started and where it's headed.

### Communication Patterns

**19. Performative helpfulness**

"Great question!", "I'd be happy to help!", "Of course!", "Certainly!", "I hope this helps!", "Let me know if you'd like me to expand on any section."

Strip all of it. Just do the thing.

**20. Sycophantic tone**

Overly positive, people-pleasing language. "That's an excellent point!" "You're absolutely right!"

Before: Great question! You're absolutely right that this is complex. That's an excellent point about the economic factors.
After: The economic factors you mentioned are relevant here.

**21. Knowledge-cutoff disclaimers**

"As of my last update," "While specific details are limited," "Based on available information."

Before: While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s.
After: The company was founded in 1994 per its registration docs.

### Filler and Hedging

**22. Filler phrases**

- "In order to achieve this goal" -> "To do this"
- "Due to the fact that" -> "Because"
- "At this point in time" -> "Now"
- "The system has the ability to" -> "The system can"
- "It is important to note that" -> just state the thing

**23. Excessive hedging**

Over-qualifying everything.

Before: It could potentially possibly be argued that the policy might have some effect on outcomes.
After: The policy may affect outcomes.

**24. Over-qualifying**

"It's worth noting that," "It bears mentioning that," "It should be pointed out that." These add nothing. Delete the qualifier and state the fact.

### Structural Patterns

**25. Symmetrical lists**

AI produces perfectly balanced lists where every item is the same length and weight. Real writing has uneven emphasis because not everything matters equally.

Before:
- Expanded market reach through strategic partnerships
- Enhanced brand visibility through targeted campaigns
- Strengthened customer loyalty through personalized engagement

After:
- Partnered with three new distributors
- Ran a few social campaigns (mixed results)
- Repeat order rate is up, which is the number that actually matters

**26. The summary sandwich**

Opening with a summary, doing the body, then restating the summary. Trust the reader to get it once.

## Reference

Pattern catalog adapted from Wikipedia's "Signs of AI writing" guide, maintained by WikiProject AI Cleanup.
