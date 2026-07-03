# Health scoring guide

Source of truth for the framework: [`docs/PRINCIPLES.md` Principle 2](../../../docs/PRINCIPLES.md#2-thesis-first-always), [`docs/ALLOCATION-POLICY.md`](../../../docs/ALLOCATION-POLICY.md), and [`lib/ai_buffett_zo/theses/health.py`](../../../lib/ai_buffett_zo/theses/health.py).

This file is a quick-reference for interpreting the dashboard.

## The six components

| Component | What it measures | Auto-scored? |
|---|---|---|
| **Valuation Safety** | Margin of safety: current price vs base-case fair value | Yes (when `base_case_fair_value` in metadata) |
| **Business Health** | Revenue, margin, FCF trends from latest filing | Carried forward in v1; future LLM-driven |
| **Insider Alignment** | Recent Form 4 activity, executive ownership | Carried forward in v1; future WebSearch-driven |
| **Catalyst Proximity** | Days until expected catalyst | Yes (when `catalyst_date` in metadata) |
| **Thesis Integrity** | Whether evidence in the thesis still holds | Carried forward in v1; future LLM-driven |
| **Risk Environment** | Regime × bucket compatibility | **Always** auto-scored |

## Scoring scales

### Valuation Safety
| Margin of safety | Score |
|---|---|
| > 40% | 90 |
| 25-40% | 75 |
| 10-25% | 60 |
| 0-10% | 45 |
| -20% to 0% | 30 |
| < -20% | 15 |

### Catalyst Proximity
| Days to catalyst | Score |
|---|---|
| 0-30 | 85 |
| 31-90 | 75 |
| 91-180 | 60 |
| > 180 (or none) | 50-55 |
| Catalyst missed (negative) | 35 |

### Risk Environment (regime × bucket)
| Bucket → / Regime ↓ | Value | Systematic | Short | YOLO |
|---|---|---|---|---|
| Green / Blue | 80 | 70 | 40 | 70 |
| Orange | 60 | 60 | 65 | 50 |
| Red | 40 | 50 | 85 | 35 |
| Danger | 30 | 40 | 85 | 30 |

## Action map

Overall score = weighted average of components (weights sum to 100). Action is then derived from the table below and adjusted for regime.

| Score | Base action | Description |
|---|---|---|
| 0-39 | EXIT | Thesis is broken. Close the position. |
| 40-54 | REDUCE | Thesis weakening. Trim to minimum band size. |
| 55-74 | HOLD | Thesis intact. Maintain position. |
| 75-100 | ADD | Thesis strong. Add on dips within sizing limits. |

## Regime adjustments

| Regime | Adjustment |
|---|---|
| Green / Blue | None |
| Orange | None |
| Red | YOLO downgrades one level; shorts upgrade one level |
| Danger | All downgrade one level; shorts upgrade one level |

## Hard override

**A triggered kill condition forces EXIT regardless of score.** The whole point of kill conditions is they're decided when conviction is high; they exist for the moments when conviction wavers. Do not weaken kill conditions retroactively. (See [`docs/PRINCIPLES.md` Principle 2](../../../docs/PRINCIPLES.md#2-thesis-first-always).)
