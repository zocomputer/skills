# Regime color guide

Five colors classify the cross-asset risk environment. Each maps to allocation policy bands and an equity hurdle premium.

## GREEN — Risk-on, expansion

**Trigger:** SPY 20d return > 0 AND TLT 20d return < 0.

Bonds selling, equities rising — classic risk-on / expansion regime. Money flowing out of safety into growth.

- Allocation tilt: lean equities (55% Value bucket per ALLOCATION-POLICY)
- Hurdle premium: **+4.0%**
- Action: deploy on quality names that clear hurdle; size full positions

## BLUE — Both up, "everything works"

**Trigger:** SPY 20d return > 0 AND TLT 20d return > 0.

Liquidity-driven — both equities and bonds rising. Strong but verify breadth before sizing up. Often late-cycle.

- Allocation tilt: lean equities (55% Value)
- Hurdle premium: **+4.0%**
- Action: deploy but check the RSP-SPY spread; if breadth is narrowing the regime auto-degrades to ORANGE

## ORANGE — Caution

**Trigger (either):**
- SPY 20d return < 0 AND TLT 20d return > 0 (flight to safety)
- RSP - SPY 60d spread < -5% (narrow leadership / late-cycle concentration)

Default conservative state. Money rotating to bonds, or leadership has narrowed to a few names.

- Allocation: baseline 50/30/10/10
- Hurdle premium: **+6.0%**
- Action: increase T-Bill weight modestly; new positions need a clearer margin of safety

## RED — Correlation breakdown

**Trigger:** SPY 20d return < -5% AND TLT 20d return < 0.

Risk-off without the typical bond bid — bond-equity correlation has broken. Inflation regime, rate shock, or systemic stress.

- Allocation: defensive 45/25/15/10 (more shorts, less Value)
- Hurdle premium: **+8.0%**
- Action: shift weight to short bucket; trim Value names below conviction; raise cash

## DANGER — Severe drawdown

**Trigger:** SPY drawdown ≥ -20% from 252-day high.

Crash regime. Maximum defense. The lesson of every prior cycle is "live to fight again." Capital preservation is paramount.

- Allocation: 40/20/20/5 with explicit cash buffer
- Hurdle premium: **+10.0%**
- Action: no new long entries except deeply discounted forced sales; review every active thesis for kill-condition triggers; preserve liquidity

## Hurdle rate computation

If a 1Y T-bill yield is supplied, the equity hurdle rate equals:

```
hurdle = rf + regime_premium
```

Example: in ORANGE with rf = 4.5%, hurdle = 4.5% + 6.0% = **10.5%**.

A long position must clear this hurdle in expected return to be worth holding. The hurdle rises in worse regimes — we demand more compensation when conditions are less forgiving.
