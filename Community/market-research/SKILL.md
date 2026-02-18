---
name: market-research
description: >
  Industry statistics and market sizing via free government APIs (BLS, FRED,
  Census Bureau). Query employment data, economic time series, establishment
  counts, and build market sizing reports by NAICS industry code. Use for any
  industry research or market analysis question.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  category: Community
---

## Setup

1. Install this skill to `Skills/market-research/`
2. Sign up for free API keys (all free, no usage limits worth worrying about):
   - **BLS**: https://data.bls.gov/registrationEngine/ -> add as `BLS_API_KEY` in [Settings > Advanced](/?t=settings&s=advanced)
   - **FRED**: https://fred.stlouisfed.org/docs/api/api_key.html -> add as `FRED_API_KEY`
   - **Census**: https://api.census.gov/data/key_signup.html -> add as `CENSUS_API_KEY`
3. Install the Python dependency: `pip install httpx`

## CLI

```bash
python3 /home/workspace/Skills/market-research/scripts/research.py <command> [options]
```

## Commands

| Command | Source | Description |
|---------|--------|-------------|
| `industry <naics>` | BLS | Employment and wage data for a NAICS industry code |
| `establishments <naics>` | Census CBP | Establishment counts by industry and geography |
| `economic-census <naics>` | Census | Revenue, payroll, establishments from the Economic Census |
| `fred-search <query>` | FRED | Find relevant FRED series by keyword |
| `fred-data <series_id>` | FRED | Get time series data for a FRED series |
| `sizing <naics>` | All | Combined market sizing report |

## Options

| Flag | Description |
|------|-------------|
| `--state <fips>` | State FIPS code filter (e.g. 04 = Arizona, 06 = California) |
| `--years <n>` | Number of years of data (default: 5) |
| `--output <file>` | Save to file |

## NAICS Codes

NAICS (North American Industry Classification System) is how the US government categorizes industries. Examples:
- 423990: Other Miscellaneous Durable Goods Merchant Wholesalers
- 336214: Travel Trailer and Camper Manufacturing
- 541511: Custom Computer Programming Services
- 722511: Full-Service Restaurants
- 44-45: Retail Trade (sector level)

Find codes: https://www.census.gov/naics/

## Examples

```bash
# Employment + wages for custom software development
python3 scripts/research.py industry 541511

# Establishment counts in California
python3 scripts/research.py establishments 541511 --state 06

# Search FRED for relevant series
python3 scripts/research.py fred-search "software industry output"

# Get GDP data
python3 scripts/research.py fred-data GDP --years 10

# Full market sizing report
python3 scripts/research.py sizing 541511
```

## Data Sources

- **BLS QCEW**: Quarterly employment and wages, updated quarterly. Most complete employment data by NAICS.
- **FRED**: 800,000+ economic time series. GDP, CPI, PPI, industry output, financial data. Real-time updates.
- **Census Bureau**: County Business Patterns (annual establishment counts), Economic Census (every 5 years, most recent 2022).

## Notes

- All government APIs are free. No usage limits worth worrying about.
- BLS data is quarterly with about a 6-month lag.
- Census CBP data is annual with about a 1-year lag.
- Economic Census data is every 5 years (2017, 2022). Latest 2022 data is available.
- The `sizing` command combines all three sources into a single markdown report.
- State FIPS codes: https://www.census.gov/library/reference/code-lists/ansi.html
