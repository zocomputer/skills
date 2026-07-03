# SEC EDGAR Filing Types Reference

## Most Common Forms

| Form | Full Name | What It Contains | Index Mode |
|------|-----------|------------------|------------|
| **10-K** | Annual Report | Business description, Risk Factors (Item 1A), MD&A (Item 7), Financial Statements (Item 8) | Full tree |
| **10-Q** | Quarterly Report | Financial Statements, MD&A (Part I Item 2), Risk Factors (Part II Item 1A) | Full tree |
| **8-K** | Current Report | Material events: earnings (Item 2.02), leadership changes (Item 5.02), acquisitions (Item 8.01) | Raw or tree |
| **DEF 14A** | Proxy Statement | Executive compensation, Board of Directors, Shareholder Proposals | Full tree |
| **Form 3** | Initial Insider Ownership | First filing when someone becomes an insider | Raw |
| **Form 4** | Insider Transaction | Changes in beneficial ownership | Raw |
| **Form 5** | Annual Insider Transaction | Annual summary of certain transactions | Raw |
| **S-1** | Registration Statement | IPO prospectus: Risk Factors, Use of Proceeds, Business | Full tree |
| **S-1/A** | S-1 Amendment | Updates to S-1 | Full tree |
| **S-3** | Shelf Registration | For well-known seasoned issuers | Full tree |
| **S-4** | Business Combination | M&A registration statement | Full tree |
| **20-F** | Foreign Annual Report | Non-US issuer annual (similar to 10-K) | Full tree |
| **6-K** | Foreign Current Report | Non-US issuer current events | Raw |
| **13F** | Institutional Holdings | Quarterly portfolio of institutional managers | Raw |
| **13D** | Beneficial Ownership (>5%) | Initial filing when acquiring >5% stake | Raw |
| **13G** | Beneficial Ownership (>5%, passive) | For passive investors | Raw |
| **144** | Proposed Sale | Notice of proposed sale of restricted securities | Raw |
| **424B5** | Prospectus Supplement | Pricing information for registered offerings | Full tree |

## Amendments

Forms with `/A` suffix are amendments. Examples:
- `10-K/A` — Amended annual report
- `10-Q/A` — Amended quarterly report
- `S-1/A` — Amended registration statement

Amendments are stored independently from the original filing.

## Filing Frequency

| Form | Typical Frequency |
|------|-------------------|
| 10-K | Annually (within 60-90 days of fiscal year end) |
| 10-Q | Quarterly (within 40-45 days of quarter end) |
| 8-K | As needed (within 4 business days of material event) |
| DEF 14A | Annually (before annual meeting) |
| Form 3 | Once (when becoming insider) |
| Form 4 | Within 2 business days of transaction |
| 13F | Quarterly (within 45 days of quarter end) |

## SEC Section Numbering (10-K / 10-Q)

### 10-K Structure
```
Part I
  Item 1. Business
  Item 1A. Risk Factors
  Item 1B. Unresolved Staff Comments
  Item 2. Properties
  Item 3. Legal Proceedings
  Item 4. Mine Safety Disclosures

Part II
  Item 5. Market for Registrant's Common Equity
  Item 6. [Reserved]
  Item 7. Management's Discussion and Analysis (MD&A)
  Item 7A. Quantitative and Qualitative Disclosures About Market Risk
  Item 8. Financial Statements and Supplementary Data
  Item 9. Changes in and Disagreements with Accountants
  Item 9A. Controls and Procedures
  Item 9B. Other Information
  Item 9C. Disclosure Regarding Foreign Jurisdictions

Part III
  Item 10. Directors, Executive Officers and Corporate Governance
  Item 11. Executive Compensation
  Item 12. Security Ownership of Certain Beneficial Owners
  Item 13. Certain Relationships and Related Transactions
  Item 14. Principal Accounting Fees and Services

Part IV
  Item 15. Exhibits and Financial Statement Schedules
  Item 16. Form 10-K Summary
```

### 10-Q Structure
```
Part I - Financial Information
  Item 1. Financial Statements
  Item 2. Management's Discussion and Analysis
  Item 3. Quantitative and Qualitative Disclosures About Market Risk
  Item 4. Controls and Procedures

Part II - Other Information
  Item 1. Legal Proceedings
  Item 1A. Risk Factors
  Item 2. Unregistered Sales of Equity Securities
  Item 3. Defaults Upon Senior Securities
  Item 4. Mine Safety Disclosures
  Item 5. Other Information
  Item 6. Exhibits
```
