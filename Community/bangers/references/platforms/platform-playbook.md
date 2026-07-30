# PLATFORM PLAYBOOK

> Freshness status, 2026-07-25: legacy claims are unaudited. Treat every numeric benchmark, algorithm assertion, feature-availability claim, and policy statement below as a research lead, not current truth, until `references/research/source-ledger.md` contains a non-expired supporting entry. Official technical specifications should also be reverified when the platform may have changed.

This file collects candidate platform mechanics for the BANGERS suite. Read the relevant section before platform-specific work, but use only currently supported claims in outward-facing advice.

## TABLE OF CONTENTS
1. YouTube long-form · 2. YouTube Shorts · 3. TikTok · 4. Instagram (Reels + Carousels) · 5. X/Twitter · 6. LinkedIn · 7. Substack · 8. Bluesky · 9. Facebook Groups · 10. Cross-platform repurposing waterfall

---

## 1. YOUTUBE LONG-FORM
**SPECS:** 16:9. 1080p min (upload 1440p/4K for crisper thumbnails). 24–60fps. H.264/MP4, AAC 48kHz. Thumbnail 1280×720, <2MB. Title ~70 chars, front-load the payoff. Chapters need ≥3 timestamps, first at 00:00, each ≥10s.
**RULES:**
- Optimize for **session contribution + satisfaction**, not raw watch time. YouTube now weights whether you keep the viewer on YouTube afterward, and discounts watch time by satisfaction signals (surveys, "not interested"). Satisfaction now sits ABOVE raw watch time.
- **Win the first 30 seconds** — lead with the title's payoff, cut intros/preamble. Leading with the key insight raised past-30s retention 15–20pts in a cited case.
- Retention benchmarks (avg % viewed): <5min → 50–70%; 5–15 → 40–55%; 15–30 → 30–45%; 30+ → 25–35%.
- CTR: aim >4% overall; smaller channels run higher. Do NOT pair high CTR with a fast drop-off — YouTube checks first-30s retention against the click and demotes clickbait mismatch.
- **Comments > likes** for ranking. Prompt discussion. Build SERIES, not one-offs (repeat viewing within a topic gets boosted).
- Cadence: ~1/week minimum for algo trust; 2/week grows ~3× faster at equal quality. SEO: keyword in title + first 1–2 description lines + spoken audio (transcript is indexed). Tags are low-weight now.
- Reach-killers: channel-intro cold opens, thumbnail/title mismatch, topic-hopping (breaks niche clustering), <1/week, mass-produced/reused content (demonetization risk). **Label AI content** (mandatory disclosure; unlabeled = reduced distribution).

## 2. YOUTUBE SHORTS
**SPECS:** 9:16, 1080×1920. Max 180s; ideal 15–45s (13s and 60s test well). 30fps, H.264. **Safe zones:** keep text/faces out of top 288px, bottom 672px, left 48px, right 192px — effective safe area ≈ centered 840×960.
**RULES:**
- A "view" now counts on every start/replay (since Mar 2025). Optimize for **"Engaged views"** (Analytics → Advanced) — monetization runs on engaged views, not the vanity count.
- **Win seconds 1–3 or die** (explore/exploit: a seed audience decides expansion). Watch "Viewed vs. Swiped Away." **Engineer the loop** — seamless start/end so it replays.
- Shorts are **decoupled from long-form** (late 2025) — each Short stands alone; subs/long-form history don't guarantee reach. Caption everything (watched muted); say the topic aloud early.
- Cadence 3+/week (daily works). #shorts + 1–3 tags; trending audio helps.
- Reach-killers: letterboxed/horizontal footage, text under the button rails, teaser clips that only make sense with the long video, no hook.

## 3. TIKTOK
**SPECS:** 9:16, 1080×1920, 30fps, MP4/H.264. Ideal 21–34s (go 1–3min only if completion holds). Photo Mode: 9:16 images, 5–7 slides. **Safe zones:** top ~90px, bottom ~330px (caption/audio), left/right ~65px.
**RULES:**
- Algorithm rewards **rewatches/completion far above likes**; diversifies the feed; pushes longer content when completion holds.
- **Search is a primary surface** — TikTok SEO is real (+20–40% visibility): put your keyword in three places — spoken in the first line (speech-to-text), bold on-screen text in first 2–3s (OCR), and caption first 100–150 chars.
- **Photo Mode is the sleeper format** (~5× views, ~80% completion) — test it for how-to/list content.
- Hook in first 3s; add captions (30%+ watch muted); use a trending sound (+52% views avg). 3–5 hashtags max (broad + niche). Cadence ~1×/day (min 3×/week).
- Reach-killers: watermarked/reused imports, keyword-stuffing, 15+ hashtags, low-quality filler, driving users off-platform in-video.

## 4. INSTAGRAM (REELS + CAROUSELS)
**SPECS — Reels:** 9:16, 1080×1920, 30fps, H.264. Ideal <90s (15–90s sweet spot). Cover: design at 1080×1920 but keep key elements in center 1080×1080 (grid crop). Safe zones: clear top ~220px, bottom ~450px, ~35px sides.
**SPECS — Carousels:** up to 20 slides, 8–10 optimal (under 5 underperforms). 4:5 (1080×1350) for max feed real estate, or 1:1. Can mix images + 1–2 video slides.
**RULES:**
- Top signals: **sends/DM shares (≈3–5× a like) and saves**, then watch time, then comments/likes. Explicitly ask "send this to someone who…" / "save for later."
- **No blanket format preference** — IG shows Reels to video-watchers, carousels to photo-engagers. Reels = top-of-funnel reach & new audience; carousels = saves, depth, and mature/large accounts (carousels get a re-serve second impression using different cover slides — make slide 1 AND slide 2 strong).
- Hashtags don't drive reach anymore — **keyword SEO** in caption/on-screen text/profile is the lever; 3–5 tags (search-only).
- **Trial Reels** (1K+ followers): publish to non-followers only, get metrics in 24–72h, then share to followers — a low-risk A/B surface.
- Original content gets 40–60% more distribution; 10+ reposts/month risks recommendation exclusion. Never post TikTok-watermarked files. Cadence 4–5/week; space posts out (dumping several triggers balancing).

## 5. X / TWITTER
**SPECS:** 280 chars free / 25,000 Premium (only first ~280 render before "Show more" — front-load the hook). Native video ≤2:20 free; 9:16 favored for the Video Tab, 1080×1920, MP4/H.264, ≤512MB, captions. Threads = chained 280-char posts.
**RULES:**
- Engagement weights (open-source-derived): **Reply ≈ 13.5–27× a Like, Repost ≈ 20×, Bookmark ≈ 10–12×, Quote ≈ 10×**, Like 1×. Negative: Report −369×, Block −74×, Mute −31×, **external link ≈ −8× / 50–90% reach cut**.
- **Keep links OUT of the main post** — put the URL in a reply. Lead with a scroll-stopping first line. Prioritize replies/reposts; reply to your own comments in the first 15–30 min. First **15 minutes** decide virality (10+ early engagements amplifies; <3 kills it); visibility halves ~every 6h.
- Post 3–5×/day, spaced. 0–1 hashtag (3+ trips spam filters; Grok reads the text now). Premium ≈ 2–4× reach.
- Don't: engagement pods/bought engagement, delete-and-repost, AI-slop replies (downvotable as spam since Mar 2026).

## 6. LINKEDIN
**SPECS:** text ≤3,000 chars, sweet spot **800–1,600**; "see more" cutoff ≈ first ~150 chars mobile — put the hook there. **Document/PDF carousel (highest reach):** 5–10 slides, 1080×1080 or 1080×1350, one takeaway/slide, strong slide 1. Native video: **30–90s**, 1:1 or 9:16, captions mandatory. Newsletters bypass the feed (notify + email all subs, Google-indexed).
**RULES:**
- 360Brew (2026) distributes on an **interest graph**, not your social graph — a niche post from a small account can outreach a generic post from a big one. Keep a consistent narrow topic so it locks your "topic DNA."
- Signals: **dwell time, saves, shares, comment-thread depth**. Dwell curve: 0–3s ≈1.2% eng → 31–60s = max distribution → 61+s ≈15.6% (a ~13× gap). Engineer dwell: question in first line (+32% comments), 3–4-line paragraphs, white space.
- **Golden hour** (first 30–60 min) decides trajectory; reply to every comment within 60–120 min. Comments ≈ 2× likes.
- **Links out of the post body** (~60% reach cut) — AND the link-in-first-comment workaround is now also penalized (early 2026); add the link after traction or in a follow-up.
- Post 3–5×/week. Don't: engagement bait ("Agree? 👇"), polls (~0.07% eng, dead), pods/automation, editing after posting, "bro-etry," AI-slop.

## 7. SUBSTACK
**SPECS:** title/subject ≤100 chars, subtitle ≤250, body unlimited. Cover 1200×630 (also the OG/email-preview image). Video posts ≤1080p/4GB. Notes = short-form; best Notes are 1–3 punchy sentences.
**RULES:**
- Distribution now driven by **Notes + Recommendations network**, not just email. **Restacks are one of the single most important signals** — write Notes designed to be restacked (a strong standalone idea/mini-story/hot take), not bare links. Notes reach = audience overlap (shown to non-subscribers who overlap with you + adjacent pubs); restacks/replies/quotes >> likes.
- Turn on **Recommendations** and recommend overlapping publications (reciprocity fuels growth — historically ~40% of subs came through the network). Grow the free list first; convert later (don't hard-paywall early).
- "10-minute restack system": restack yesterday's post AM, a strong old Note midday, 1–2 niche writers PM. Substack pushes video/Live (auto-clips → YouTube Shorts). Post consistently.

## 8. BLUESKY
**SPECS:** post ≤300 chars (hard). Up to 4 images (4:5/16:9/1:1), use alt text. Video MP4/MOV, ≤~60s, <100MB. No native scheduling, **no editing after posting**. 2–3 hashtags.
**RULES:**
- No single central algo — users pin their own feeds. **Following feed = strictly chronological** (timing matters). **Discover feed** surfaces conversation momentum (recent replies, quotes, network proximity, recency) — posts that spark back-and-forth rise; passive likes don't.
- Replies are distribution. Get into/create **Starter Packs** (up to ~150 accounts, network-proximity boost) and niche **custom feeds** (hashtags route posts there). Pin your best EVERGREEN post, not your newest.
- Post 1–3×/day (<10k followers). Don't verbatim-cross-post from X/LinkedIn — it performs poorly. Mix ~60% educational/entertaining, 30% conversational, 10% promo.

## 9. FACEBOOK GROUPS
**SPECS:** ideal text post ≤20 words (question-led). Native video square 1:1, captions required, 3-sec hook. Facebook Live = highest-reach format. Polls punch above weight.
**RULES:**
- Groups reach **20–40% of members** (vs ~1.6–5.9% for Pages) — the highest-ROI free surface on FB. Members get direct notifications (~4× feed open rate).
- **Engagement velocity is the top signal** — comments in the first 30–60 min multiply distribution; comments > reactions; shares-with-commentary rank highest. Engineer early comments with a direct pain-point question.
- Content ranking: native/Live video > photos > links > text-only. Never post a bare YouTube link (links rank lowest) — upload native. Target engaged niche groups (~4.5k–18k members, ~42% higher engagement) over giant link-dump groups. Drip posts over the day; don't bulk-dump.
- Don't: engagement bait ("Like if you agree"), duplicate/repetitive content, breaking group rules, late-night posting.

---

## 10. CROSS-PLATFORM REPURPOSING WATERFALL
**Principle: stop cross-posting, start repurposing. "Film once, cut everywhere."** Identical files everywhere trip duplicate-detection (up to ~42% Reels reach cut for detected duplicates, ~72% if a TikTok watermark is visible). Deriving platform-native variants from one source does NOT.

**Source-capture specs (shoot once, derive everything):** 4K (3840×2160) so you can crop 16:9 → 9:16 / 1:1 / 4:5 with room. 24/30fps (60 for slow-mo). Film 16:9 horizontal as master. **Center-safe composition:** frame subject + any text within the center ~80% (title-safe); keep top 10–15%, bottom 15–25%, right 10% clear for platform UI. Record a clean verbal hook in the first 3s; plan to swap in each platform's native trending audio.

**The waterfall (one shoot → many assets):**
1. YouTube long-form (16:9, 8–20min) — the anchor.
2. Mid-form cutdowns (2–4) from distinct chapters → standalone YouTube/LinkedIn-native videos.
3. Short-form clips (10–30) from best 15–60s moments → 9:16, burned-in captions, hook-first → Shorts/Reels/TikTok, each with a DIFFERENT intro frame + native audio + caption style + pacing.
4. Carousel (1–3) from a framework/list → 4:5 or 1:1 → Instagram + LinkedIn.
5. X thread from transcript hooks; attach a clip to the top post.
6. LinkedIn post (one story/lesson), professional reframe.
7. Substack/newsletter — chapter summaries + embeds (owned-audience layer).
8. Bluesky/Threads — atomized one-liners.
9. Facebook Group — a discussion-starter question + native clip.

**RULES:**
- Export a **clean master with NO watermark** before it ever touches TikTok; distribute that master downstream.
- Give each short-form clip a unique first frame + native trending audio + caption styling — don't ship the same MP4 to all three (duplicate detection weights the first ~0.5s heavily).
- Adapt the text container per platform: X = strong first line then media; LinkedIn = short-line mini-essay; IG caption front-loaded (truncates fast).
- Upload native files per platform (scheduler or native app — both fine; schedulers do NOT penalize reach). **Stagger publishing 24–72h** and hit each platform's best time.
- Tooling: Opus Clip (long→short at scale), Descript (transcript-based editing), CapCut (per-platform finishing), Repurpose.io (hands-off distribution), Metricool/Buffer/Later (native scheduling + trending-audio discovery).
