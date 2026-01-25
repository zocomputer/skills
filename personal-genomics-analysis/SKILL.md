---
name: Genome Analysis
description: Analyzes your 23andMe genetic data to identify health risks, drug sensitivities, ancestry, and traits, then generates a personalized report
metadata:
  author: Zo
  emoji: 🧬
---

# Personal Genomics Analysis Pipeline

## How to Use This Prompt

This prompt transforms raw 23andMe genome data into a comprehensive, queryable genomics knowledge base with clinical annotations and personalized health insights.

**Prerequisites:**

- 23andMe raw genome data file (V3, V4, or V5 format, typically \~600k-900k SNPs)
- The file should be in tab-delimited format with columns: rsid, chromosome, position, genotype
- Approximately 10-15 minutes of processing time
- \~5GB of disk space for databases

**What This Pipeline Creates:**

1. **genome.db** - Your personal genome database (631k SNPs, \~50MB)
2. **clinvar.db** - Clinical variant database (3.8M variants, 472k pathogenic, \~600MB)
3. **pharmgkb.db** - Pharmacogenomics database (drug-gene interactions)
4. **Analysis scripts** - Reusable Python tools for querying your genome
5. **Visualizations** - Ancestry charts, trait summaries
6. **Personalized report** - Comprehensive markdown document with all findings

**What You'll Discover:**

- 🧬 **Ancestry composition** - Estimated genetic ancestry from key markers
- 💊 **Pharmacogenomics** - How you metabolize common drugs (critical for medical records!)
- 🧠 **Cognitive/behavioral traits** - COMT, OXTR, BDNF variants
- 💪 **Athletic performance** - ACTN3, ACE genes
- ❤️ **Health risks** - Diabetes, cardiovascular, Alzheimer's markers
- 🍽️ **Dietary genetics** - Lactose tolerance, caffeine metabolism, taste perception
- 👁️ **Physical traits** - Eye color, earwax type, hair characteristics
- 🚨 **Pathogenic variants** - Screened against 472k known disease variants

**Warning:** This analysis is for informational and research purposes only. It is not a substitute for professional genetic counseling or medical advice. Critical findings (especially pharmacogenomics) should be shared with your healthcare provider.

## Database Schemas

### 1. genome.db (Your Personal Genome)

```sql
CREATE TABLE snps (
    rsid TEXT PRIMARY KEY,
    chromosome TEXT NOT NULL,
    position INTEGER NOT NULL,
    genotype TEXT NOT NULL
);

CREATE INDEX idx_chromosome ON snps(chromosome);
CREATE INDEX idx_position ON snps(position);
CREATE INDEX idx_chrom_pos ON snps(chromosome, position);
```

**Fields:**

- `rsid`: SNP identifier (e.g., "rs12913832")
- `chromosome`: Chromosome number (1-22, X, Y, MT)
- `position`: Base pair position on chromosome
- `genotype`: Your two alleles (e.g., "AA", "AG", "GG")

**Example queries:**

```sql
-- Find a specific SNP
SELECT * FROM snps WHERE rsid = 'rs12913832';

-- Count SNPs per chromosome
SELECT chromosome, COUNT(*) as count
FROM snps
GROUP BY chromosome
ORDER BY CAST(chromosome AS INTEGER);

-- Find all SNPs in a gene region (e.g., APOE)
SELECT * FROM snps
WHERE chromosome = '19'
AND CAST(position AS INTEGER) BETWEEN 45409039 AND 45412650;
```

### 2. clinvar.db (Clinical Variants)

```sql
CREATE TABLE clinvar_variants (
    rsid TEXT PRIMARY KEY,
    chromosome TEXT,
    position INTEGER,
    ref_allele TEXT,
    alt_allele TEXT,
    clinical_significance TEXT,
    disease_name TEXT,
    review_status TEXT
);

CREATE INDEX idx_clinvar_significance ON clinvar_variants(clinical_significance);
CREATE INDEX idx_clinvar_chrom_pos ON clinvar_variants(chromosome, position);
```

**Fields:**

- `clinical_significance`: Pathogenic, Likely_pathogenic, Benign, etc.
- `disease_name`: Associated condition
- `review_status`: Evidence quality (e.g., "practice guideline")

### 3. pharmgkb.db (Pharmacogenomics)

```sql
CREATE TABLE pharmgkb_variants (
    rsid TEXT PRIMARY KEY,
    gene TEXT,
    drug TEXT,
    impact TEXT,
    recommendation TEXT,
    evidence_level TEXT,
    pmid TEXT
);
```

**Evidence levels:**

- `1A`: High level of evidence (clinical guidelines)
- `1B`: Moderate level of evidence
- `2A/2B`: Lower levels of evidence
- `3/4`: Preliminary evidence

## Pipeline Procedure

### Step 1: Verify Input File

Locate the 23andMe raw data file. Typical format:

```markdown
# rsid chromosome position genotype

rs12564807 1 734462 AA
rs3131972 1 752721 GG
```

**Validation checks:**

1. File exists and is readable
2. Tab-delimited format
3. Contains `rsid`, `chromosome`, `position`, `genotype` columns
4. At least 500,000 SNPs present
5. Genotypes are valid (AA, AG, GG, AT, etc.)

### Step 2: Create Personal Genome Database

Create a Python script to parse the 23andMe file and populate genome.db:

```python
#!/usr/bin/env python3
import sqlite3
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)sZ %(levelname)s %(message)s")

HEALTH_DIR = Path("<path_to_health_directory>")
GENOME_FILE = HEALTH_DIR / "<23andme_filename>.txt"
DB_FILE = HEALTH_DIR / "genome.db"

def create_database():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS snps (
            rsid TEXT PRIMARY KEY,
            chromosome TEXT NOT NULL,
            position INTEGER NOT NULL,
            genotype TEXT NOT NULL
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chromosome ON snps(chromosome)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_position ON snps(position)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chrom_pos ON snps(chromosome, position)')

    conn.commit()
    return conn

def parse_and_insert(conn):
    cursor = conn.cursor()
    batch = []
    batch_size = 10000
    total_count = 0

    with open(GENOME_FILE, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            parts = line.split('\t')
            if len(parts) != 4:
                continue

            rsid, chrom, pos, geno = parts

            if not rsid.startswith('rs') and not rsid.startswith('i'):
                continue

            batch.append((rsid, chrom, pos, geno))

            if len(batch) >= batch_size:
                cursor.executemany(
                    "INSERT OR REPLACE INTO snps (rsid, chromosome, position, genotype) VALUES (?, ?, ?, ?)",
                    batch
                )
                total_count += len(batch)
                logging.info(f"Inserted {total_count} SNPs...")
                batch = []

        if batch:
            cursor.executemany(
                "INSERT OR REPLACE INTO snps (rsid, chromosome, position, genotype) VALUES (?, ?, ?, ?)",
                batch
            )
            total_count += len(batch)

    conn.commit()
    logging.info(f"Total SNPs in database: {total_count}")

def main():
    conn = create_database()
    parse_and_insert(conn)
    conn.close()
    logging.info(f"Database created: {DB_FILE.absolute()}")

if __name__ == "__main__":
    main()
```

**Expected output:** genome.db with 500k-900k SNPs (depending on 23andMe chip version)

### Step 3: Download and Index ClinVar Database

ClinVar contains all known clinically-relevant genetic variants. Download and parse:

```python
import asyncio
import aiohttp
import gzip
import sqlite3

CLINVAR_URL = "https://ftp.ncbi.nlm.nih.gov/pub/clinvar/tab_delimited/variant_summary.txt.gz"
CLINVAR_DB = Path("<path>") / "clinvar.db"

async def setup_clinvar():
    # Download ClinVar (~50MB compressed, ~5GB uncompressed)
    logging.info("Downloading ClinVar database (~50MB)...")

    async with aiohttp.ClientSession() as session:
        async with session.get(CLINVAR_URL) as response:
            with open(CLINVAR_DB.parent / "variant_summary.txt.gz", 'wb') as f:
                async for chunk in response.content.iter_chunked(8192):
                    f.write(chunk)

    # Decompress and parse
    logging.info("Decompressing and parsing ClinVar...")
    conn = sqlite3.connect(CLINVAR_DB)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clinvar_variants (
            rsid TEXT PRIMARY KEY,
            chromosome TEXT,
            position INTEGER,
            ref_allele TEXT,
            alt_allele TEXT,
            clinical_significance TEXT,
            disease_name TEXT,
            review_status TEXT
        )
    ''')

    batch = []
    with gzip.open(CLINVAR_DB.parent / "variant_summary.txt.gz", 'rt') as f:
        header = f.readline()

        for line in f:
            parts = line.strip().split('\t')
            if len(parts) < 30:
                continue

            # Extract relevant fields (adjust indices based on ClinVar format)
            rsid = parts[9] if parts[9].startswith('rs') else None
            if not rsid:
                continue

            chrom = parts[18]
            pos = parts[19]
            ref = parts[26]
            alt = parts[27]
            clin_sig = parts[6]
            disease = parts[13]
            review = parts[24]

            if 'Pathogenic' in clin_sig or 'Likely pathogenic' in clin_sig:
                batch.append((rsid, chrom, pos, ref, alt, clin_sig, disease, review))

            if len(batch) >= 10000:
                cursor.executemany('''
                    INSERT OR REPLACE INTO clinvar_variants
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', batch)
                conn.commit()
                batch = []

        if batch:
            cursor.executemany('''
                INSERT OR REPLACE INTO clinvar_variants
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', batch)
            conn.commit()

    conn.close()
    logging.info("ClinVar database created")
```

**Note:** This step takes 5-10 minutes and creates a \~600MB database.

### Step 4: Create PharmGKB Database

Pharmacogenomics variants that affect drug metabolism:

```python
def setup_pharmgkb():
    conn = sqlite3.connect(PHARMGKB_DB)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pharmgkb_variants (
            rsid TEXT PRIMARY KEY,
            gene TEXT,
            drug TEXT,
            impact TEXT,
            recommendation TEXT,
            evidence_level TEXT,
            pmid TEXT
        )
    ''')

    # Key pharmacogenomics markers
    variants = [
        ('rs4244285', 'CYP2C19', 'Clopidogrel', 'Poor metabolizer', 'Reduced efficacy', '1A', '23250844'),
        ('rs9923231', 'VKORC1', 'Warfarin', 'Increased sensitivity', 'Lower dose required', '1A', '22617227'),
        ('rs1799853', 'CYP2C9', 'Warfarin', 'Reduced metabolism', 'Lower dose required', '1A', '22617227'),
        ('rs776746', 'CYP3A5', 'Tacrolimus', 'Poor metabolizer', 'Higher drug levels', '1A', '22378157'),
        ('rs1801133', 'MTHFR', 'Methotrexate', 'Reduced activity', 'Toxicity risk', '2A', '21270786'),
        ('rs4680', 'COMT', 'Opioids', 'Pain sensitivity', 'Affects response', '2B', '16331281'),
        ('rs1799971', 'OPRM1', 'Opioids', 'Receptor binding', 'Affects requirement', '2A', '17363983'),
        ('rs12248560', 'CYP2C19', 'PPIs,Clopidogrel', 'Rapid metabolizer', 'Altered response', '1A', '23250844'),
    ]

    cursor.executemany('''
        INSERT OR REPLACE INTO pharmgkb_variants VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', variants)

    conn.commit()
    conn.close()
```

### Step 5: Query Your Genome Against Clinical Databases

Cross-reference your SNPs with ClinVar and PharmGKB:

```python
def query_personal_genome():
    genome_conn = sqlite3.connect(GENOME_DB)
    clinvar_conn = sqlite3.connect(CLINVAR_DB)
    pharmgkb_conn = sqlite3.connect(PHARMGKB_DB)

    # PharmGKB findings
    logging.info("🔬 PHARMACOGENOMICS FINDINGS:")
    cursor = pharmgkb_conn.execute("SELECT * FROM pharmgkb_variants")

    for row in cursor:
        rsid, gene, drug, impact, rec, evidence, pmid = row
        result = genome_conn.execute("SELECT genotype FROM snps WHERE rsid = ?", (rsid,)).fetchone()

        if result:
            genotype = result[0]
            logging.info(f"\n📍 {rsid} ({gene})")
            logging.info(f"   Your genotype: {genotype}")
            logging.info(f"   Affects: {drug}")
            logging.info(f"   Impact: {impact}")
            logging.info(f"   Clinical: {rec}")
            logging.info(f"   Evidence: Level {evidence} | PMID: {pmid}")

    # ClinVar pathogenic variants
    logging.info("\n\n🧬 CLINVAR FINDINGS (Pathogenic/Likely Pathogenic):")

    genome_cursor = genome_conn.execute("SELECT rsid FROM snps")
    my_rsids = {row[0] for row in genome_cursor}

    clinvar_cursor = clinvar_conn.execute("""
        SELECT rsid, disease_name, clinical_significance, review_status
        FROM clinvar_variants
        WHERE clinical_significance LIKE '%Pathogenic%'
        OR clinical_significance LIKE '%Likely_pathogenic%'
    """)

    pathogenic_found = []
    for row in clinvar_cursor:
        rsid, disease, sig, review = row
        if rsid in my_rsids:
            pathogenic_found.append((rsid, disease, sig, review))

    if pathogenic_found:
        for rsid, disease, sig, review in pathogenic_found:
            genotype = genome_conn.execute("SELECT genotype FROM snps WHERE rsid = ?", (rsid,)).fetchone()[0]
            logging.info(f"\n⚠️  {rsid}")
            logging.info(f"   Genotype: {genotype}")
            logging.info(f"   Disease: {disease}")
            logging.info(f"   Significance: {sig}")
            logging.info(f"   Review: {review}")
    else:
        logging.info("\n✅ No pathogenic variants found in ClinVar database")

    genome_conn.close()
    clinvar_conn.close()
    pharmgkb_conn.close()
```

### Step 6: Trait Analysis

Query specific SNPs for traits, ancestry, and health markers:

**Key trait markers to query:**

- `rs12913832` (HERC2) - Eye color
- `rs17822931` (ABCC11) - Earwax type, body odor
- `rs4988235` (LCT) - Lactose tolerance
- `rs762551` (CYP1A2) - Caffeine metabolism
- `rs1815739` (ACTN3) - Athletic performance
- `rs713598` (TAS2R38) - Bitter taste perception
- `rs4680` (COMT) - "Warrior vs Worrier" gene
- `rs7903146` (TCF7L2) - Type 2 diabetes risk
- `rs1333049` (CDKN2A/B) - Coronary artery disease
- `rs429358` + `rs7412` (APOE) - Alzheimer's risk

**Ancestry-informative markers:**

- `rs12913832`, `rs1426654`, `rs16891982` - Pigmentation
- `rs885479` (MC1R region) - African ancestry
- `rs1800407` (OCA2) - Eye/hair color, ancestry
- `rs3827760` (EDAR) - East Asian ancestry

### Step 7: Generate Visualizations

Create ancestry pie charts using matplotlib:

```python
import matplotlib.pyplot as plt

# Calculate ancestry percentages from markers
ancestry_data = {
    'African': 37.6,
    'East Asian': 24.7,
    'South Asian': 22.7,
    'European': 15.1
}

plt.figure(figsize=(10, 6))
plt.pie(ancestry_data.values(), labels=ancestry_data.keys(), autopct='%1.1f%%')
plt.title("Estimated Ancestry Composition")
plt.savefig("ancestry_visualization.png")
```

### Step 8: Create Personalized Health Report

Generate a comprehensive markdown report:

```python
def create_personalized_report():
    output_file = HEALTH_DIR / "personalized_genomics_report.md"

    with open(output_file, 'w') as f:
        f.write("# Personalized Genomics Report\n\n")

        f.write("## Executive Summary\n\n")
        f.write("### 🚨 Critical Findings\n\n")
        # Include pharmacogenomics, health risks

        f.write("### ✅ Protective Factors\n\n")
        # Include beneficial variants

        f.write("## Pharmacogenomics Summary\n\n")
        # Table of drug-gene interactions

        f.write("## Dietary Recommendations\n\n")
        # Based on metabolic genes

        f.write("## Exercise Recommendations\n\n")
        # Based on athletic performance genes

        f.write("## Data Sources\n\n")
        f.write("- Genome: 23andMe (XXX,XXX SNPs)\n")
        f.write("- ClinVar: 3.88M variants\n")
        f.write("- PharmGKB: Clinical pharmacogenomics\n")

    return output_file
```

### Step 9: Create Reusable Query Scripts

Build Python scripts that let you (or anyone else) query the genome easily:

```python
#!/usr/bin/env python3
"""Query a specific SNP from the genome database"""
import sqlite3
import sys

def query_snp(rsid):
    conn = sqlite3.connect("/path/to/genome.db")
    result = conn.execute("SELECT * FROM snps WHERE rsid = ?", (rsid,)).fetchone()

    if result:
        rsid, chrom, pos, geno = result
        print(f"SNP: {rsid}")
        print(f"Location: chr{chrom}:{pos}")
        print(f"Genotype: {geno}")
    else:
        print(f"SNP {rsid} not found in database")

    conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python query_snp.py <rsid>")
        sys.exit(1)

    query_snp(sys.argv[1])
```

## Expected Output

After running this pipeline, you should have:

1. **Databases:**
   - `genome.db` (50-100MB)
   - `clinvar.db` (\~600MB)
   - `pharmgkb.db` (small, &lt;1MB)

2. **Analysis Files:**
   - `file parse_genome.py` - Database creation script
   - `file trait_explorer.py` - Query traits
   - `file health_risk_explorer.py` - Query health markers
   - `file ancestry_analysis.py` - Ancestry visualization
   - `file setup_advanced_genomics.py` - Comprehensive analysis

3. **Visualizations:**
   - `file ancestry_visualization.png` - Pie chart of ancestry
   - Additional charts as needed

4. **Reports:**
   - `file personalized_genomics_report.md` - Comprehensive markdown summary
   - Includes pharmacogenomics, dietary advice, exercise recommendations

5. **VCF Conversion (Optional):**
   - `genome_converted.vcf` - Standard VCF format for other tools

## Critical Pharmacogenomics Findings to Share with Doctor

After analysis, create a "Medical Summary Card" with:

1. **Drug Sensitivities:**
   - Warfarin hypersensitivity (VKORC1/CYP2C9)
   - Clopidogrel reduced efficacy (CYP2C19)
   - Tacrolimus poor metabolism (CYP3A5)
   - Methotrexate toxicity risk (MTHFR)

2. **Relevant Medical Context:**
   - APOE status (Alzheimer's risk)
   - Type 2 diabetes risk (TCF7L2)
   - Cardiovascular genetic risk score

3. **Protective Factors:**
   - ClinVar screen results (pathogenic variants found/not found)

## Technical Notes

- **File format compatibility:** Works with 23andMe V3, V4, V5 raw data
- **Reference genome:** Build 37 (GRCh37/hg19) - most 23andMe data uses this
- **Processing time:**
  - Genome DB creation: 1-2 minutes
  - PharmGKB setup: &lt;1 minute
  - ClinVar download: 5-10 minutes
  - Analysis scripts: 1-2 minutes each
- **Disk space:** \~5GB total (mostly ClinVar)
- **Privacy:** All data stays on your Zo server - never uploaded to third parties

## Limitations and Disclaimers

**Limitations:**

1. 23andMe genotyping covers \~0.02% of your genome (600k out of 3 billion base pairs)
2. Ancestry estimates based on 6-10 markers are rough approximations
3. Many genetic effects require multiple genes or gene-environment interactions
4. Penetrance varies - having a "risk" allele doesn't guarantee disease
5. Research is evolving - interpretations may change over time

**Disclaimers:**

- This is for informational and research purposes only
- Not a diagnostic test or medical advice
- Share critical findings (especially pharmacogenomics) with your healthcare provider
- Consider professional genetic counseling for significant findings
- Do not make medical decisions based solely on this analysis

## Troubleshooting

**"File format not recognized":**

- Ensure your file is tab-delimited
- Check that columns are: rsid, chromosome, position, genotype
- Some 23andMe files have extra header lines (skip lines starting with #)

**"ClinVar download fails":**

- URL may have changed - check NCBI FTP site
- Use alternative: manually download from [https://ftp.ncbi.nlm.nih.gov/pub/clinvar/](https://ftp.ncbi.nlm.nih.gov/pub/clinvar/)
- Place file in health directory and adjust script path

**"Too few SNPs in database":**

- 23andMe V3 has \~500k SNPs
- V4 and V5 have \~600-700k SNPs
- If you have &lt;400k, the file may be truncated or corrupted

**"Python package installation fails":**

- Run: `pip install matplotlib sqlite3 aiohttp`
- Some systems require: `pip3` instead of `pip`
- If gemini-framework fails, skip it (not critical for core analysis)

**"Database locked" errors:**

- Close other connections to the database
- Ensure no other scripts are running
- Try: `rm -f genome.db-journal`

---

This prompt provides a complete, reproducible pipeline for personal genomics analysis that anyone can use with their own 23andMe data on Zo.

