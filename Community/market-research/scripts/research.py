#!/usr/bin/env python3
"""Market research via BLS, FRED, and Census Bureau APIs."""

import argparse
import json
import os
import sys
from datetime import datetime

import httpx


def bls_api(series_ids: list[str], start_year: int = None, end_year: int = None) -> dict:
    key = os.environ.get("BLS_API_KEY", "")
    now = datetime.now().year
    if not end_year:
        end_year = now
    if not start_year:
        start_year = now - 5
    payload = {
        "seriesid": series_ids,
        "startyear": str(start_year),
        "endyear": str(end_year),
    }
    if key:
        payload["registrationkey"] = key
    r = httpx.post("https://api.bls.gov/publicAPI/v2/timeseries/data/", json=payload, timeout=30)
    r.raise_for_status()
    return r.json()


def fred_api(endpoint: str, params: dict = None) -> dict:
    key = os.environ.get("FRED_API_KEY", "")
    if not key:
        print("Error: FRED_API_KEY not set in Zo secrets.", file=sys.stderr)
        sys.exit(1)
    base_params = {"api_key": key, "file_type": "json"}
    if params:
        base_params.update(params)
    r = httpx.get(f"https://api.stlouisfed.org/fred/{endpoint}", params=base_params, timeout=30)
    r.raise_for_status()
    return r.json()


def census_api(dataset: str, params: dict, year: str = "2022") -> list:
    key = os.environ.get("CENSUS_API_KEY", "")
    base = f"https://api.census.gov/data/{year}/{dataset}"
    p = dict(params)
    if key:
        p["key"] = key
    r = httpx.get(base, params=p, timeout=30)
    r.raise_for_status()
    return r.json()


def cmd_industry(args):
    """BLS QCEW data for a NAICS code. Uses the QCEW flat files API."""
    naics = args.naics
    now = datetime.now().year
    years_back = args.years

    results = []
    for year in range(now - years_back, now + 1):
        for qtr in ["1", "2", "3", "4", "a"]:
            url = f"https://data.bls.gov/cew/data/api/{year}/{qtr}/industry/{naics}.csv"
            try:
                r = httpx.get(url, timeout=15)
                if r.status_code != 200:
                    continue
                lines = r.text.strip().split("\n")
                if len(lines) < 2:
                    continue
                headers = lines[0].split(",")
                headers = [h.strip().strip('"') for h in headers]
                for line in lines[1:]:
                    vals = line.split(",")
                    vals = [v.strip().strip('"') for v in vals]
                    row = dict(zip(headers, vals))
                    if row.get("own_code") == "5" and row.get("area_fips", "").startswith("US"):
                        if args.state:
                            continue
                        results.append({
                            "year": year,
                            "quarter": qtr,
                            "establishments": row.get("qtrly_estabs"),
                            "employment": row.get("month3_emplvl"),
                            "avg_weekly_wage": row.get("avg_wkly_wage"),
                            "total_wages": row.get("total_qtrly_wages"),
                        })
                    elif args.state and row.get("own_code") == "5" and row.get("area_fips", "").startswith(args.state):
                        results.append({
                            "year": year,
                            "quarter": qtr,
                            "area_fips": row.get("area_fips"),
                            "establishments": row.get("qtrly_estabs"),
                            "employment": row.get("month3_emplvl"),
                            "avg_weekly_wage": row.get("avg_wkly_wage"),
                            "total_wages": row.get("total_qtrly_wages"),
                        })
            except Exception:
                continue

    if not results:
        annual_url = f"https://data.bls.gov/cew/data/api/{now-1}/a/industry/{naics}.csv"
        print(f"[info] No data found. Try checking: {annual_url}", file=sys.stderr)

    print(json.dumps(results, indent=2))


def cmd_establishments(args):
    """Census County Business Patterns -- establishment counts."""
    naics = args.naics
    get_vars = "NAME,NAICS2017_LABEL,ESTAB,EMP,PAYANN"
    p = {"get": get_vars, "for": "us:*", "NAICS2017": naics}
    if args.state:
        p["for"] = f"state:{args.state}"

    results = []
    for year in ["2021", "2020", "2019"]:
        try:
            data = census_api("cbp", p, year=year)
            if len(data) > 1:
                headers = data[0]
                for row in data[1:]:
                    entry = dict(zip(headers, row))
                    entry["year"] = year
                    results.append(entry)
        except Exception as e:
            print(f"[warn] CBP {year}: {e}", file=sys.stderr)
            continue

    print(json.dumps(results, indent=2))


def cmd_economic_census(args):
    """Census Economic Census data."""
    naics = args.naics
    get_vars = "NAME,NAICS2017_LABEL,ESTAB,RCPTOT,PAYANN,EMP"
    p = {"get": get_vars, "for": "us:*", "NAICS2017": naics}
    if args.state:
        p["for"] = f"state:{args.state}"

    results = []
    for year in ["2022", "2017"]:
        try:
            data = census_api("ecnbasic", p, year=year)
            if len(data) > 1:
                headers = data[0]
                for row in data[1:]:
                    entry = dict(zip(headers, row))
                    entry["year"] = year
                    results.append(entry)
        except Exception as e:
            print(f"[warn] EconCensus {year}: {e}", file=sys.stderr)

    if not results:
        for year in ["2022", "2017"]:
            for dataset in ["ecnbasic", "ecnsize", "ecncomp"]:
                try:
                    p2 = {"get": "NAME,NAICS2017_LABEL,ESTAB,RCPTOT,PAYANN,EMP", "for": "us:*", "NAICS2017": naics}
                    data = census_api(dataset, p2, year=year)
                    if len(data) > 1:
                        headers = data[0]
                        for row in data[1:]:
                            entry = dict(zip(headers, row))
                            entry["year"] = year
                            entry["dataset"] = dataset
                            results.append(entry)
                except Exception:
                    continue

    print(json.dumps(results, indent=2))


def cmd_fred_search(args):
    """Search FRED for economic data series."""
    data = fred_api("series/search", {
        "search_text": args.query,
        "limit": str(args.limit),
        "order_by": "popularity",
        "sort_order": "desc",
    })
    results = []
    for s in data.get("seriess", []):
        results.append({
            "id": s.get("id"),
            "title": s.get("title"),
            "frequency": s.get("frequency"),
            "units": s.get("units"),
            "seasonal_adjustment": s.get("seasonal_adjustment"),
            "last_updated": s.get("last_updated"),
            "popularity": s.get("popularity"),
            "observation_start": s.get("observation_start"),
            "observation_end": s.get("observation_end"),
        })
    print(json.dumps(results, indent=2))


def cmd_fred_data(args):
    """Get time series observations from FRED."""
    now = datetime.now()
    start = f"{now.year - args.years}-01-01"
    data = fred_api("series/observations", {
        "series_id": args.series_id,
        "observation_start": start,
    })
    series_info = fred_api("series", {"series_id": args.series_id})
    info = {}
    for s in series_info.get("seriess", []):
        info = {
            "id": s.get("id"),
            "title": s.get("title"),
            "units": s.get("units"),
            "frequency": s.get("frequency"),
        }

    observations = []
    for obs in data.get("observations", []):
        observations.append({
            "date": obs.get("date"),
            "value": obs.get("value"),
        })

    print(json.dumps({"series": info, "observations": observations}, indent=2))


def cmd_sizing(args):
    """Combined market sizing report from all sources."""
    naics = args.naics
    report_parts = []
    report_parts.append(f"# Market Sizing Report: NAICS {naics}\n")
    report_parts.append(f"Generated: {datetime.now().strftime('%Y-%m-%d')}\n")

    # BLS employment data
    report_parts.append("\n## Employment & Wages (BLS QCEW)\n")
    now = datetime.now().year
    bls_data = []
    for year in [now - 1, now - 2]:
        url = f"https://data.bls.gov/cew/data/api/{year}/a/industry/{naics}.csv"
        try:
            r = httpx.get(url, timeout=15)
            if r.status_code != 200:
                continue
            lines = r.text.strip().split("\n")
            if len(lines) < 2:
                continue
            headers = [h.strip().strip('"') for h in lines[0].split(",")]
            for line in lines[1:]:
                vals = [v.strip().strip('"') for v in line.split(",")]
                row = dict(zip(headers, vals))
                if row.get("own_code") == "5" and row.get("area_fips", "").startswith("US"):
                    bls_data.append({
                        "year": year,
                        "establishments": row.get("annual_avg_estabs", "N/A"),
                        "employment": row.get("annual_avg_emplvl", "N/A"),
                        "avg_annual_pay": row.get("avg_annual_pay", "N/A"),
                        "total_wages": row.get("total_annual_wages", "N/A"),
                    })
        except Exception:
            continue

    if bls_data:
        report_parts.append("| Year | Establishments | Employment | Avg Annual Pay | Total Wages |")
        report_parts.append("|------|---------------|------------|----------------|-------------|")
        for d in bls_data:
            report_parts.append(f"| {d['year']} | {d['establishments']} | {d['employment']} | ${d['avg_annual_pay']} | ${d['total_wages']} |")
    else:
        report_parts.append("No BLS data found for this NAICS code.")

    # Census CBP
    report_parts.append("\n## Establishment Counts (Census CBP)\n")
    cbp_data = []
    for year in ["2021", "2020", "2019"]:
        try:
            key = os.environ.get("CENSUS_API_KEY", "")
            p = {"get": "NAME,NAICS2017_LABEL,ESTAB,EMP,PAYANN", "for": "us:*", "NAICS2017": naics}
            if key:
                p["key"] = key
            data = census_api("cbp", p, year=year)
            if len(data) > 1:
                headers = data[0]
                for row in data[1:]:
                    entry = dict(zip(headers, row))
                    entry["year"] = year
                    cbp_data.append(entry)
        except Exception:
            continue

    if cbp_data:
        report_parts.append("| Year | Industry | Establishments | Employment | Annual Payroll ($1000s) |")
        report_parts.append("|------|----------|---------------|------------|----------------------|")
        for d in cbp_data:
            report_parts.append(f"| {d.get('year')} | {d.get('NAICS2017_LABEL', 'N/A')} | {d.get('ESTAB', 'N/A')} | {d.get('EMP', 'N/A')} | {d.get('PAYANN', 'N/A')} |")
    else:
        report_parts.append("No Census CBP data found for this NAICS code.")

    # FRED related series
    report_parts.append("\n## Related Economic Indicators (FRED)\n")
    try:
        fred_key = os.environ.get("FRED_API_KEY", "")
        if fred_key:
            search_data = fred_api("series/search", {
                "search_text": f"NAICS {naics}",
                "limit": "5",
                "order_by": "popularity",
                "sort_order": "desc",
            })
            for s in search_data.get("seriess", []):
                report_parts.append(f"- **{s.get('id')}**: {s.get('title')} ({s.get('frequency')}, {s.get('units')})")
            if not search_data.get("seriess"):
                report_parts.append("No directly matching FRED series found.")
    except Exception:
        report_parts.append("Could not query FRED.")

    report_parts.append("\n---\n*Data sourced from BLS QCEW, Census Bureau CBP, and FRED.*")

    report = "\n".join(report_parts)
    if args.output:
        from pathlib import Path
        Path(args.output).write_text(report)
        print(f"Report saved to {args.output}", file=sys.stderr)
    else:
        print(report)


def main():
    parser = argparse.ArgumentParser(description="Market research via government APIs")
    sub = parser.add_subparsers(dest="command", required=True)

    def add_common(p):
        p.add_argument("--state", help="State FIPS code (e.g. 04=AZ, 06=CA)")
        p.add_argument("--years", type=int, default=5, help="Years of data")
        p.add_argument("--limit", type=int, default=20)
        p.add_argument("--output", help="Save to file")

    sp = sub.add_parser("industry", help="BLS employment + wage data by NAICS")
    sp.add_argument("naics", help="NAICS industry code")
    add_common(sp)

    sp = sub.add_parser("establishments", help="Census establishment counts")
    sp.add_argument("naics", help="NAICS industry code")
    add_common(sp)

    sp = sub.add_parser("economic-census", help="Economic Census data")
    sp.add_argument("naics", help="NAICS industry code")
    add_common(sp)

    sp = sub.add_parser("fred-search", help="Search FRED for series")
    sp.add_argument("query", help="Search terms")
    add_common(sp)

    sp = sub.add_parser("fred-data", help="Get FRED time series data")
    sp.add_argument("series_id", help="FRED series ID (e.g. GDP, UNRATE)")
    add_common(sp)

    sp = sub.add_parser("sizing", help="Combined market sizing report")
    sp.add_argument("naics", help="NAICS industry code")
    add_common(sp)

    args = parser.parse_args()
    cmds = {
        "industry": cmd_industry, "establishments": cmd_establishments,
        "economic-census": cmd_economic_census, "fred-search": cmd_fred_search,
        "fred-data": cmd_fred_data, "sizing": cmd_sizing,
    }
    cmds[args.command](args)


if __name__ == "__main__":
    main()
