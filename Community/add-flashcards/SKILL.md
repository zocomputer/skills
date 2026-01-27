---
name: add-flashcards
description: Converts webpages, articles, or documents into study flashcards that you can review with spaced repetition
compatibility: Requires hashcards-setup skill with flashcards at /home/workspace/flashcards/
metadata:
  author: rc2.zo.computer
  category: Community
  display-name: Generate flashcards from a webpage or document
  emoji: 📇
---

## How to Use This File

This file will be included in a user request. When it is, Zo should interpret this as a task to generate flashcards from source material (URL, document, or notes) and save them to `/home/workspace/flashcards/`. Zo should not ask for confirmation to continue if it has the source material.

## Purpose

This command converts source material (webpages, articles, documents, notes) into effective flashcards in hashcards format. The cards are saved to your flashcards directory and will appear in your SRS reviews.

**Prerequisites**: Set up `hashcards-setup` first so `/home/workspace/flashcards/` exists.

---

# Add Flashcards from Source

Generate SRS flashcards from any source material and add them to your hashcards collection.

## Required Input

- **Source material**: Can be any of:
  - URL to a webpage or article
  - Document path in your workspace
  - Direct text (pasted notes, email content, facts from chat, etc.)
- **Optional topic**: Name for organizing the cards (creates/appends to `/home/workspace/flashcards/[topic].md`)

## Steps

1. Read/fetch the source material (URL, file, or use provided text directly)
2. Extract key facts, concepts, and relationships
3. Generate Q&A flashcards following best practices
4. Save to `/home/workspace/flashcards/[topic].md`
5. Include source reference as HTML comment after the heading (URL, file path, or description for user-provided text)

## Writing Effective Flashcards

When converting material into hashcards, create excellent, learnable cards:

**Principles for effective cards:**

1. **Atomic & focused** - One fact or idea per card, not bundles
2. **Precise & consistent** - Brief, unambiguous answers that produce the same response each review
3. **Effortful** - Require genuine retrieval, not trivial pattern-matching
4. **Two-way & multiple angles** - Create forward/backward pairs (definition↔term); ask formal and informal versions; add intuition questions
5. **Connected** - Link to vivid associations, personal experiences, or humor
6. **Hierarchies & sequences** - For taxonomies: ask top-down and bottom-up; for sequences: use position and neighbor cards
7. **Organize by source** - Group cards by source material (chapter-level for books)

**Further reading:**

- [How to write good prompts](https://andymatuschak.org/prompts/)
- [Effective Spaced Repetition](https://borretti.me/article/effective-spaced-repetition)
- [Using spaced repetition to see through mathematics](https://cognitivemedium.com/srs-mathematics)

## Special Cases

### Poems and Quotes

For poems, create line-by-line cloze deletions where each card shows the previous line as context:

```markdown
# The New Colossus

<!-- Source: https://www.poetryfoundation.org/poems/46550/the-new-colossus -->

Q: _Beginning_, …
A: Not like the brazen giant of Greek fame,

Q: Not like the brazen giant of Greek fame, / …
A: With conquering limbs astride from land to land;

Q: With conquering limbs astride from land to land; / …
A: Here at our sea-washed, sunset gates shall stand
```

This leverages memory for what comes before, making recall progressively easier while building the sequence.

### Procedures and Processes

Extract keywords and transition conditions, not rote steps. Ask "what triggers step X?" and "what happens after Y?"

### Conceptual Knowledge

Use multiple lenses:

- Attributes: "What are the key properties of X?"
- Similarities/differences: "How does X differ from Y?"
- Parts/wholes: "What are the components of X?"
- Causes/effects: "What causes X?" / "What does X lead to?"
- Significance: "Why does X matter?"

## Output Format

Create/append to markdown files in `/home/workspace/flashcards/`:

```markdown
# E. coli Cell Biology

<!-- Source: https://book.bionumbers.org/how-big-is-an-e-coli-cell/ -->

Q: What is the typical volume of an E. coli cell?
A: ~1 μm³ (cubic micrometer)

Q: What shape is a typical E. coli cell?
A: Rod-shaped (cylindrical)
```

For cloze deletions, use the `C:` format:

```markdown
C: The typical E. coli cell is [rod-shaped] with a volume of [~1 μm³].
```

---

## Summary

After running this command, Zo will have created flashcards from your source material and saved them to `/home/workspace/flashcards/`. The cards will appear in your next review session at `https://srs-<your-username>.zocomputer.io`.

