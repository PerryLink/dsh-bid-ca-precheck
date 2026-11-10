# Public World Bank benchmark — `dsh-bid-ca-precheck`

> **The bid side is synthetic.** The World Bank notices are requirements-side public data. The bidder name, responses, verdicts, evidence placeholders and injected defects are generated fixtures. They are not real bidder submissions and say nothing about any company's compliance, eligibility or outcome.

Generated 2026-11-10T12:58:14.435Z · plugin 0.2.14 · tool `bid_ca_precheck` · entry point `lib/index.mjs`

## At a glance

| Mode | Rules scored | Expected hits | TP | FP | FN | Precision | Recall | F1 | Clean | Mutations | Case exact |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| default | 4/10 | 10 | 10 | 0 | 0 | 1.000 | 1.000 | 1.000 | 8/8 | 10/10 | 26/26 |
| configured | 10/10 | 14 | 14 | 0 | 0 | 1.000 | 1.000 | 1.000 | 8/8 | 14/14 | 26/26 |

The shipped pack executes 4 of 10 rules per case. BC-002 and BC-005 report themselves in `skipped` because their lists ship empty. The configured mode runs the same six rules with only those two lists filled; it scores all 10 rules.

## Source and license

- **Publisher:** World Bank
- **Dataset:** Procurement Notice — World Bank Data Catalog 0037776, Finances One DS00979
- **API:** `https://search.worldbank.org/api/v2/procnotices?format=json&rows=200&page=1&qterm=construction`
- **Retrieved:** 2026-11-10T11:48:24.771Z
- **Raw SHA-256:** `7bba29c6bb54df3a5fe6bb983e1555b389dd5202ce9b6d93f689a4bcc88d7ce1`
- **License status: verified at the dataset level — CC BY 4.0.**
  - [Data Catalog dataset page](https://datacatalog.worldbank.org/search/dataset/0037776/procurement-notice)
  - [Data Catalog metadata API](https://datacatalogapi.worldbank.org/dexapps/fone/api/metadata?assetId=DS00979) — the `license` field reads "Creative Commons Attribution 4.0 International"
  - [World Bank public licenses page](https://datacatalog.worldbank.org/public-licenses)
  - [World Bank Group site terms](https://www.worldbank.org/ext/en/legal/terms-conditions) — the general site terms, which incorporate the dataset-specific terms by reference.
  - The API response itself does not carry a license field, so the evidence is the dataset metadata, not the API payload. The general World Bank site terms also apply; this is not legal advice. Individual notice text may contain third-party content.

**Attribution:** "Source: World Bank, Procurement Notice dataset (DS00979), accessed via the World Bank Procurement Notices API on 2026-11-10. License: CC BY 4.0. Changes: filtered to construction-related Invitation for Bids, selected 8 notices, projected fields, and generated synthetic bid-side fixtures. Bid responses are not World Bank data."

## Method

1. `fetch.mjs` downloads one page of the public API, records the exact URL, retrieval time and SHA-256, and writes the raw JSON under `.data/`.
2. `adapter.mjs` filters to `Invitation for Bids` notices with a parseable deadline, a construction-related description, all six consumed fields and no BC-006 placeholder. It selects one notice per country first (sorted by country then reference), fills the rest deterministically, and writes the requirements pack.
3. The adapter writes one clean case per selected notice. Every bid-side cell is a `SYNTHETIC_` marker; the source notice fields are mirrored into the row but no bidder is claimed. It then injects one labelled defect per mutation case and four explicit blind-spot probes.
4. `evaluate.mjs` imports `../../lib/index.mjs`, registers the real `bid_ca_precheck` tool through `ctx.tools.register`, and calls `tool.execute({ material })` with the generated JSON. No check is reimplemented; the only configuration is `rulesFile` pointing at the generated overlay in configured mode.
5. Scoring is count-based per rule and case: `TP += min(expected, actual)`, `FP += max(0, actual - expected)`, `FN += max(0, expected - actual)`. Clean cases expect zero issues; mutation cases expect exactly one issue of the target rule; blind-spot probes expect zero issues and are excluded from P/R.

`fetch` selected 8 notices from 200 API rows (18 candidates passed the filter; 169 non-IFB, 13 non-construction, 0 without the high-risk keyword, 0 with placeholders, 0 duplicate references were rejected).

Selected notices:

| Reference | Country / region | Notice type | Deadline | Method |
|---|---|---|---|---|
| `MOEYS-HEIP2-ITC-ICB-W-001` | Cambodia | Invitation for Bids | 2026-12-04T00:00:00Z | Request for Bids |
| `CM-MINEPAT-570276-CW-RFB` | Cameroon | Invitation for Bids | 2026-12-04T00:00:00Z | Request for Bids |
| `TD-CILOP-552032-CW-RFB` | Chad | Invitation for Bids | 2026-11-20T00:00:00Z | Request for Bids |
| `ET-SWEPR-573634-CW-RFB` | Eastern and Southern Africa | Invitation for Bids | 2026-12-07T00:00:00Z | Request for Bids |
| `ET-AFR-RPCU-589814-CW-RFB` | Ethiopia | Invitation for Bids | 2026-12-07T00:00:00Z | Request for Bids |
| `MW-NSDC-565038-CW-RFB` | Malawi | Invitation for Bids | 2026-11-23T00:00:00Z | Request for Bids |
| `PRDP-SU-IB-R009-ZDN-009-SER-001-2026-PWS` | Philippines | Invitation for Bids | 2026-12-09T00:00:00Z | Request for Bids |
| `BF-CILSS-BF-574726-CW-RFB` | Western and Central Africa | Invitation for Bids | 2027-01-07T00:00:00Z | Request for Bids |

## Cases

| Case | Kind | Target | Expected | Default | Configured | What it probes |
|---|---|---|---|---|---|---|
| `clean-01-moeys-heip2-itc-icb-w-001` | clean | — | none | pass | pass | Clean synthetic register for MOEYS-HEIP2-ITC-ICB-W-001 (Cambodia); the response, verdict and evidence cells are synthetic placeholders, not… |
| `clean-02-cm-minepat-570276-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for CM-MINEPAT-570276-CW-RFB (Cameroon); the response, verdict and evidence cells are synthetic placeholders, not … |
| `clean-03-td-cilop-552032-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for TD-CILOP-552032-CW-RFB (Chad); the response, verdict and evidence cells are synthetic placeholders, not bidder… |
| `clean-04-et-swepr-573634-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for ET-SWEPR-573634-CW-RFB (Eastern and Southern Africa); the response, verdict and evidence cells are synthetic p… |
| `clean-05-et-afr-rpcu-589814-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for ET-AFR-RPCU-589814-CW-RFB (Ethiopia); the response, verdict and evidence cells are synthetic placeholders, not… |
| `clean-06-mw-nsdc-565038-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for MW-NSDC-565038-CW-RFB (Malawi); the response, verdict and evidence cells are synthetic placeholders, not bidde… |
| `clean-07-prdp-su-ib-r009-zdn-009-ser-001-2026-pws` | clean | — | none | pass | pass | Clean synthetic register for PRDP-SU-IB-R009-ZDN-009-SER-001-2026-PWS (Philippines); the response, verdict and evidence cells are synthetic… |
| `clean-08-bf-cilss-bf-574726-cw-rfb` | clean | — | none | pass | pass | Clean synthetic register for BF-CILSS-BF-574726-CW-RFB (Western and Central Africa); the response, verdict and evidence cells are synthetic… |
| `bc001-missing-response-a` | mutation | BC-001 | BC-001 ×1 | pass | pass | Clean register with the response cell blank on one notice (requirement present, response missing). |
| `bc001-missing-response-b` | mutation | BC-001 | BC-001 ×1 | pass | pass | Clean register with the response cell blank on a second notice. |
| `bc002-off-vocabulary-a` | mutation | BC-002 | BC-002 ×1 | not scored (rule skipped) | pass | Verdict changed to a value outside the benchmark-local vocabulary (only executed by the configured overlay). |
| `bc002-off-vocabulary-b` | mutation | BC-002 | BC-002 ×1 | not scored (rule skipped) | pass | Second notice carries an off-vocabulary verdict. |
| `bc003-duplicate-clause-exact` | mutation | BC-003 | BC-003 ×1 | pass | pass | The same notice is registered twice with the same clause number. |
| `bc003-duplicate-clause-whitespace` | mutation | BC-003 | BC-003 ×1 | pass | pass | A clause number repeats after BC-003 removes whitespace; the values differ only by an internal space. |
| `bc004-missing-project` | mutation | BC-004 | BC-004 ×1 | pass | pass | Register header omits the project name; the bidder remains. |
| `bc004-missing-bidder` | mutation | BC-004 | BC-004 ×1 | pass | pass | Register header omits the bidder; the project remains. |
| `bc004-missing-both` | mutation | BC-004 | BC-004 ×1 | pass | pass | Register header omits both project and bidder; BC-004 reports one header finding, not two. |
| `bc005-missing-evidence-a` | mutation | BC-005 | BC-005 ×1 | not scored (rule skipped) | pass | A high-risk requirement carries a blank evidence cell (only executed by the configured overlay). |
| `bc005-missing-evidence-b` | mutation | BC-005 | BC-005 ×1 | not scored (rule skipped) | pass | A second high-risk requirement carries a blank evidence cell. |
| `bc006-placeholder-double-brace` | mutation | BC-006 | BC-006 ×1 | pass | pass | The requirement column keeps a {{TBD}} template placeholder. |
| `bc006-placeholder-cjk-bracket` | mutation | BC-006 | BC-006 ×1 | pass | pass | The requirement column keeps a 【待填】 placeholder. |
| `bc006-placeholder-xxx` | mutation | BC-006 | BC-006 ×1 | pass | pass | The requirement column keeps an XXX placeholder. |
| `blind-wrong-deadline` | blind-spot | — | none | 0 issue(s) (probe) | 0 issue(s) (probe) | The bid-side deadline differs from the notice by one day; the register is otherwise clean. |
| `blind-wrong-notice-type` | blind-spot | — | none | 0 issue(s) (probe) | 0 issue(s) (probe) | The bid-side notice type is Contract Award while the notice is Invitation for Bids. |
| `blind-extra-bid-row` | blind-spot | — | none | 0 issue(s) (probe) | 0 issue(s) (probe) | The bid carries an extra row whose clause is absent from the requirements pack. |
| `blind-missing-bid-row` | blind-spot | — | none | 0 issue(s) (probe) | 0 issue(s) (probe) | A requirement in the pack has no corresponding bid row; the bid register has only the other notice. |

## Per-rule precision / recall

### Shipped rule pack — default mode

| Rule | Severity | Title | Expected | Actual | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BC-001 | warn | Every tender requirement has a recorded response | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-003 | warn | Clause numbers are unique in the register | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-004 | warn | The register names its project and bidder | 3 | 3 | 3 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-006 | warn | The requirement column has no unreplaced placeholder | 3 | 3 | 3 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| **Total** | | | **10** | **10** | **10** | **0** | **0** | **1.000** | **1.000** | **1.000** |

BC-002 and BC-005 are not scored here: the shipped pack ships `values: []` and `highRiskKeywords: []`, so both rules report themselves in `skipped` in every case (26 and 26 case-level skips respectively). The two mutation cases that target them are marked "not scored" in the case table.

### Configured overlay — all six rules

| Rule | Severity | Title | Expected | Actual | TP | FP | FN | Precision | Recall | F1 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BC-001 | warn | Every tender requirement has a recorded response | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-002 | info | The verdict uses the configured vocabulary (off by default) | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-003 | warn | Clause numbers are unique in the register | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-004 | warn | The register names its project and bidder | 3 | 3 | 3 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-005 | warn | High-risk clauses carry evidence (off by default) | 2 | 2 | 2 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-006 | warn | The requirement column has no unreplaced placeholder | 3 | 3 | 3 | 0 | 0 | 1.000 | 1.000 | 1.000 |
| BC-007 | info | Bid deadline equals the notice deadline | 0 | 0 | 0 | 0 | 0 | n/a | n/a | n/a |
| BC-008 | info | Notice type allows the material category | 0 | 0 | 0 | 0 | 0 | n/a | n/a | n/a |
| BC-009 | info | A response row carries its requirement | 0 | 0 | 0 | 0 | 0 | n/a | n/a | n/a |
| BC-010 | info | The register key set equals the external clause list | 0 | 0 | 0 | 0 | 0 | n/a | n/a | n/a |
| **Total** | | | **14** | **14** | **14** | **0** | **0** | **1.000** | **1.000** | **1.000** |

The overlay fills only BC-002 `values` (["SYNTHETIC_ACK"]) and BC-005 `highRiskKeywords` (["Construction","construction","CONSTRUCTION"]). Everything else is the shipped pack. The overlay is generated into `.data/` and is not a release artifact.

## Blind spots (expected misses, not scored failures)

These four probes change something the six-rule pack does not check: a row field it ignores (deadline, notice type) or the row set itself (extra or missing row). Zero issues is the expected result and confirms the scope limit; it is not a correct assessment of the mismatch.

| Probe | Field | Requirements side | Bid side | Issues reported (configured) | Reading |
|---|---|---|---|---:|---|
| `blind-wrong-deadline` | submission_deadline_date | 2026-12-04T00:00:00Z | 2026-12-05T00:00:00.000Z | 0 | The six-rule pack has no deadline check and no rule compares a bid row against the notice. The register columns it reads are clause, requirement, response, verdict, evidence and header. |
| `blind-wrong-notice-type` | notice_type | Invitation for Bids | Contract Award | 0 | The six-rule pack has no notice-type check. Neither BC-001 nor BC-004 reads notice_type; the value is retained by the reader but no rule consumes it. |
| `blind-extra-bid-row` | clause | — | SYNTHETIC-PHANTOM-NOT-IN-REQUIREMENTS | 0 | The plugin checks the register it is given; it has no reference set and no referential-integrity rule. It cannot know that a clause is absent from the requirements pack. |
| `blind-missing-bid-row` | clause | CM-MINEPAT-570276-CW-RFB | — | 0 | BC-001 checks rows that are present; it cannot report a row that was never in the material. No rule compares the register against an external requirements pack. |

## Limitations and known failures

- The bid side is synthetic. The notices are requirements-side public data; the bidder name, responses, verdicts, evidence placeholders and injected defects are generated fixtures. No real bidder submission, compliance conclusion or award outcome is claimed.
- The plugin is a Chinese tender compliance-register checker. This bench uses World Bank notices only as a public source of requirement text; the plugin's cited clauses are Chinese tendering-law provisions, not World Bank procurement rules. No legal conclusion about a World Bank procurement is drawn.
- The plugin checks register-internal completeness and consistency. It does not judge whether a response satisfies a requirement, whether evidence is authentic or sufficient, or whether a bid is valid, responsive or should be rejected.
- Blind spots: the eight-rule pack compares bid deadline to notice deadline (BC-007) and a response to its requirement (BC-009), but it still has no rule for a wrong notice type, an extra bid row absent from the requirements pack, or a requirement with no bid row at all. The four probes are expected to report zero issues and are excluded from P/R; they are listed separately.
- BC-007 and BC-009 are new shipped rules: deadline equality and response-to-requirement presence. Detecting missing or extra rows against an external requirements pack still needs a new check kind or code; those remain blind spots.
- BC-002 and BC-005 ship disabled because their lists are institution/project policy. The configured mode is a benchmark-local overlay generated from the shipped pack; it is not a plugin release artifact and does not change the default deployment.
- The API is live. Selection is deterministic for one fetched page but the notice set can change between runs. Results are tied to the retrieval timestamp and raw SHA-256 recorded in summary.json; re-run fetch -> adapter -> evaluate to refresh.
- The search term is broad: qterm=construction returns contract awards and other notice types too. The adapter filters locally to Invitation for Bids notices whose descriptions contain "construct", carry a parseable deadline and carry the six consumed fields.
- The four blind-spot probes are negative controls, not ground truth about the plugin's usefulness. A zero-issue result on a wrong deadline or notice type confirms a scope limitation, not a correct assessment.
- Case labels are injected defects, not annotations of a real tender or bid. Precision/recall describe how faithfully the tool reproduces these labels, not how well it would score a real procurement.
- The dataset-level license is CC BY 4.0 (verified 2026-11-10 in the World Bank Data Catalog). The API response itself carries no license field; the general World Bank site terms also apply. Individual notice text may contain third-party content. Re-verify before redistribution; this README is not legal advice.

**Scored failures in this run:** none. All scored case labels were reproduced exactly in both modes.

## Reproduction

```sh
cd /mnt/d/Projects/dsh/checkers/dsh-bid-ca-precheck
node bench/public-worldbank/fetch.mjs
node bench/public-worldbank/adapter.mjs
node bench/public-worldbank/evaluate.mjs
```

Observed in this run: 8 clean notices, 26 cases (8 clean, 14 mutation, 4 blind-spot); default mode P/R 1.000/1.000 on 10 injected hits; configured mode P/R 1.000/1.000 on 14 injected hits.

## Provenance

| Artifact | SHA-256 |
|---|---|
| `bench/public-worldbank/.data/wb-procnotices.construction.json` | `7bba29c6bb54df3a5fe6bb983e1555b389dd5202ce9b6d93f689a4bcc88d7ce1` |
| `bench/public-worldbank/.data/requirements.json` | `e0730ff32a6c499a31df57039acb8dd0be6932943cf7ff62cddb61f635c26bbf` |
| `bench/public-worldbank/.data/cases.json` | `fef64931aefb3ad6d5632bccb3f94bc0f85fa6355740b626261c58cfd3a92865` |
| `bench/public-worldbank/.data/rules-configured.yaml` | `620a5dd63a6643a94cb8ad624c12077b72b0a4b84e799ecba9e79d177aedf046` |
| `lib/index.mjs` | `b28b605b9868d1c96433105dc1c352430a96d9bfb60b40ba19ad5ba3f0e9a930` |

## Files

- `bench/public-worldbank/fetch.mjs` — reproducible API download plus metadata sidecar.
- `bench/public-worldbank/adapter.mjs` — notices to requirements pack, clean/mutation/blind-spot cases, configured overlay.
- `bench/public-worldbank/evaluate.mjs` — real tool registration, runs, P/R, `summary.json`, `RESULTS.md`.
- `bench/public-worldbank/summary.json` — machine-readable results and provenance.
- `bench/public-worldbank/RESULTS.md` — this report.
- `bench/public-worldbank/.gitignore` — ignores `.data/` (raw response, cases, results, overlay).

> The bid side is synthetic. Do not read this benchmark as evidence that any real bidder responded, complied, failed or won. The notices are public World Bank requirements-side data; the bid registers are generated fixtures.
