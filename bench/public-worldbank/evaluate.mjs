#!/usr/bin/env node
/**
 * Run the real dsh-bid-ca-precheck tool over the generated World Bank material and
 * report per-rule precision/recall.
 *
 * This file contains no check logic. It imports the built plugin entry point
 * (`../../lib/index.mjs`), registers the tool through a minimal `ctx.tools.register`,
 * and calls `tool.execute()` with inline JSON for every case.
 *
 * Two modes:
 *   default     the shipped rule pack: BC-001/003/004/006 execute, BC-002/005 skip.
 *   configured  a generated overlay that fills only BC-002 `values` and BC-005
 *               `highRiskKeywords`; all six rules execute.
 *
 * Outputs:
 *   bench/public-worldbank/summary.json
 *   bench/public-worldbank/RESULTS.md
 *   bench/public-worldbank/.data/results/<mode>/<case>.json  (ignored audit copies)
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plugin from '../../lib/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../..')
const DATA_DIR = resolve(HERE, '.data')
const RESULTS_DIR = resolve(DATA_DIR, 'results')

const RULES = ['BC-001', 'BC-002', 'BC-003', 'BC-004', 'BC-005', 'BC-006', 'BC-007', 'BC-008', 'BC-009', 'BC-010']
const DEFAULT_SCORED_RULES = ['BC-001', 'BC-003', 'BC-004', 'BC-006']
const MODES = ['default', 'configured']

const RULE_META = {
  'BC-001': { severity: 'warn', title: 'Every tender requirement has a recorded response' },
  'BC-002': { severity: 'info', title: 'The verdict uses the configured vocabulary (off by default)' },
  'BC-003': { severity: 'warn', title: 'Clause numbers are unique in the register' },
  'BC-004': { severity: 'warn', title: 'The register names its project and bidder' },
  'BC-005': { severity: 'warn', title: 'High-risk clauses carry evidence (off by default)' },
  'BC-006': { severity: 'warn', title: 'The requirement column has no unreplaced placeholder' },
  'BC-007': { severity: 'info', title: 'Bid deadline equals the notice deadline' },
  'BC-008': { severity: 'info', title: 'Notice type allows the material category' },
  'BC-010': { severity: 'info', title: 'The register key set equals the external clause list' },
  'BC-009': { severity: 'info', title: 'A response row carries its requirement' },
}

const LIMITATIONS = [
  'The bid side is synthetic. The notices are requirements-side public data; the bidder name, responses, verdicts, evidence placeholders and injected defects are generated fixtures. No real bidder submission, compliance conclusion or award outcome is claimed.',
  'The plugin is a Chinese tender compliance-register checker. This bench uses World Bank notices only as a public source of requirement text; the plugin\'s cited clauses are Chinese tendering-law provisions, not World Bank procurement rules. No legal conclusion about a World Bank procurement is drawn.',
  'The plugin checks register-internal completeness and consistency. It does not judge whether a response satisfies a requirement, whether evidence is authentic or sufficient, or whether a bid is valid, responsive or should be rejected.',
  'Blind spots: the eight-rule pack compares bid deadline to notice deadline (BC-007) and a response to its requirement (BC-009), but it still has no rule for a wrong notice type, an extra bid row absent from the requirements pack, or a requirement with no bid row at all. The four probes are expected to report zero issues and are excluded from P/R; they are listed separately.',
  'BC-007 and BC-009 are new shipped rules: deadline equality and response-to-requirement presence. Detecting missing or extra rows against an external requirements pack still needs a new check kind or code; those remain blind spots.',
  'BC-002 and BC-005 ship disabled because their lists are institution/project policy. The configured mode is a benchmark-local overlay generated from the shipped pack; it is not a plugin release artifact and does not change the default deployment.',
  'The API is live. Selection is deterministic for one fetched page but the notice set can change between runs. Results are tied to the retrieval timestamp and raw SHA-256 recorded in summary.json; re-run fetch -> adapter -> evaluate to refresh.',
  'The search term is broad: qterm=construction returns contract awards and other notice types too. The adapter filters locally to Invitation for Bids notices whose descriptions contain "construct", carry a parseable deadline and carry the six consumed fields.',
  'The four blind-spot probes are negative controls, not ground truth about the plugin\'s usefulness. A zero-issue result on a wrong deadline or notice type confirms a scope limitation, not a correct assessment.',
  'Case labels are injected defects, not annotations of a real tender or bid. Precision/recall describe how faithfully the tool reproduces these labels, not how well it would score a real procurement.',
  'The dataset-level license is CC BY 4.0 (verified 2026-11-10 in the World Bank Data Catalog). The API response itself carries no license field; the general World Bank site terms also apply. Individual notice text may contain third-party content. Re-verify before redistribution; this README is not legal advice.',
]

function usage() {
  console.log(`Run the public World Bank benchmark for dsh-bid-ca-precheck.

Usage: node bench/public-worldbank/evaluate.mjs

Prerequisites:
  node bench/public-worldbank/fetch.mjs
  node bench/public-worldbank/adapter.mjs
`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function relativeToRepo(path) {
  return relative(REPO_ROOT, path).replaceAll('\\', '/')
}

function truncate(value, max) {
  const text = String(value ?? '')
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator
}

function f1Of(precision, recall) {
  if (precision === null || recall === null) return null
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)
}

function ratioText(value) {
  return value === null ? 'n/a' : value.toFixed(3)
}

function escapeCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s*\n\s*/g, ' ')
}

function expectedCounts(caseDef) {
  const counts = Object.fromEntries(RULES.map((rule) => [rule, 0]))
  for (const [rule, count] of Object.entries(caseDef.expected ?? {})) {
    assert(RULES.includes(rule), `${caseDef.id}: unknown expected rule ${rule}`)
    counts[rule] = count
  }
  return counts
}

function actualCounts(report) {
  const counts = Object.fromEntries(RULES.map((rule) => [rule, 0]))
  for (const issue of report.issues ?? []) {
    if (!RULES.includes(issue.ruleId)) {
      throw new Error(`tool returned an unknown rule id: ${issue.ruleId}`)
    }
    counts[issue.ruleId] += 1
  }
  return counts
}

function runExact(run, mode) {
  const scored = mode === 'default' ? DEFAULT_SCORED_RULES : RULES
  const expected = expectedCounts(run.case)
  const actual = actualCounts(run.report)
  return scored.every((rule) => expected[rule] === actual[rule])
}

function scoreMode(mode, runs) {
  const scoredRules = mode === 'default' ? DEFAULT_SCORED_RULES : RULES
  const perRule = {}
  for (const rule of scoredRules) {
    perRule[rule] = {
      rule,
      ...RULE_META[rule],
      expected: 0,
      actual: 0,
      tp: 0,
      fp: 0,
      fn: 0,
      cases: 0,
      precision: null,
      recall: null,
      f1: null,
    }
  }

  const failed = []
  let caseExact = 0
  let cleanTotal = 0
  let cleanPass = 0
  let mutationTotal = 0
  let mutationPass = 0
  let blindSpotTotal = 0
  let blindSpotDetected = 0
  const skippedByRule = {}
  const executionTotals = { total: 0, executed: 0, skipped: 0, manual: 0, unsupported: 0 }

  for (const run of runs) {
    const expected = expectedCounts(run.case)
    const actual = actualCounts(run.report)
    const scoredExpected = {}
    const scoredActual = {}
    let exact = true

    for (const rule of scoredRules) {
      const expectedHere = expected[rule]
      const actualHere = actual[rule]
      scoredExpected[rule] = expectedHere
      scoredActual[rule] = actualHere
      const row = perRule[rule]
      row.expected += expectedHere
      row.actual += actualHere
      row.cases += 1
      row.tp += Math.min(expectedHere, actualHere)
      row.fp += Math.max(0, actualHere - expectedHere)
      row.fn += Math.max(0, expectedHere - actualHere)
      if (expectedHere !== actualHere) exact = false
    }

    if (exact) caseExact += 1
    if (run.case.kind === 'clean') {
      cleanTotal += 1
      if ((run.report.issues ?? []).length === 0) cleanPass += 1
    }
    if (run.case.kind === 'mutation') {
      const targetScored = run.case.targetRule === null || scoredRules.includes(run.case.targetRule)
      if (targetScored) {
        mutationTotal += 1
        if (exact) mutationPass += 1
      }
    }
    if (run.case.kind === 'blind-spot') {
      blindSpotTotal += 1
      if ((run.report.issues ?? []).length > 0) blindSpotDetected += 1
    }

    for (const entry of run.report.skipped ?? []) {
      skippedByRule[entry.rule] = (skippedByRule[entry.rule] ?? 0) + 1
    }
    if (run.report.execution !== undefined) {
      for (const key of Object.keys(executionTotals)) {
        executionTotals[key] += run.report.execution[key] ?? 0
      }
    }

    if (!exact) {
      failed.push({
        caseId: run.case.id,
        expected: scoredExpected,
        actual: scoredActual,
        issues: (run.report.issues ?? []).map((issue) => ({
          ruleId: issue.ruleId,
          severity: issue.severity,
          found: truncate(issue.found, 300),
        })),
        skipped: run.report.skipped,
      })
    }
  }

  for (const rule of scoredRules) {
    const row = perRule[rule]
    row.precision = ratio(row.tp, row.tp + row.fp)
    row.recall = ratio(row.tp, row.tp + row.fn)
    row.f1 = f1Of(row.precision, row.recall)
  }

  const total = scoredRules.reduce(
    (accumulator, rule) => {
      const row = perRule[rule]
      accumulator.expected += row.expected
      accumulator.actual += row.actual
      accumulator.tp += row.tp
      accumulator.fp += row.fp
      accumulator.fn += row.fn
      return accumulator
    },
    { expected: 0, actual: 0, tp: 0, fp: 0, fn: 0, precision: null, recall: null, f1: null },
  )
  total.precision = ratio(total.tp, total.tp + total.fp)
  total.recall = ratio(total.tp, total.tp + total.fn)
  total.f1 = f1Of(total.precision, total.recall)

  return {
    mode,
    rulesetVersion: runs[0]?.report.rulesetVersion ?? null,
    scoredRules,
    notScoredRules: RULES.filter((rule) => !scoredRules.includes(rule)),
    perRule,
    totals: total,
    caseExact,
    caseTotal: runs.length,
    cleanTotal,
    cleanPass,
    mutationTotal,
    mutationPass,
    blindSpotTotal,
    blindSpotDetected,
    skippedByRule,
    executionTotals,
    failed,
  }
}

function summarizeRun(run, mode) {
  return {
    rulesetVersion: run.report.rulesetVersion,
    issueCount: run.report.issues.length,
    summary: run.report.summary,
    skippedRules: (run.report.skipped ?? []).map((entry) => entry.rule),
    execution: run.report.execution ?? null,
    actual: actualCounts(run.report),
    issues: (run.report.issues ?? []).map((issue) => ({
      ruleId: issue.ruleId,
      severity: issue.severity,
      locator: issue.locator,
      found: truncate(issue.found, 300),
    })),
    exact: runExact(run, mode),
    durationMs: run.durationMs,
  }
}

function perRuleTable(modeResult) {
  const lines = []
  lines.push('| Rule | Severity | Title | Expected | Actual | TP | FP | FN | Precision | Recall | F1 |')
  lines.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const rule of modeResult.scoredRules) {
    const row = modeResult.perRule[rule]
    lines.push(
      `| ${rule} | ${row.severity} | ${escapeCell(row.title)} | ${row.expected} | ${row.actual} | ` +
        `${row.tp} | ${row.fp} | ${row.fn} | ${ratioText(row.precision)} | ${ratioText(row.recall)} | ${ratioText(row.f1)} |`,
    )
  }
  const total = modeResult.totals
  lines.push(
    `| **Total** | | | **${total.expected}** | **${total.actual}** | **${total.tp}** | **${total.fp}** | **${total.fn}** | ` +
      `**${ratioText(total.precision)}** | **${ratioText(total.recall)}** | **${ratioText(total.f1)}** |`,
  )
  return lines.join('\n')
}

function caseStatus(caseResult, modeResult, mode) {
  const run = caseResult[mode]
  if (caseResult.kind === 'blind-spot') return `${run.issueCount} issue(s) (probe)`
  if (caseResult.kind === 'mutation') {
    const target = caseResult.targetRule
    if (target !== null && !modeResult.scoredRules.includes(target)) return 'not scored (rule skipped)'
  }
  return run.exact ? 'pass' : 'FAIL'
}

function buildResultsMarkdown(summary) {
  const defaultMode = summary.modes.default
  const configuredMode = summary.modes.configured
  const lines = []

  lines.push('# Public World Bank benchmark — `dsh-bid-ca-precheck`')
  lines.push('')
  lines.push(
    '> **The bid side is synthetic.** The World Bank notices are requirements-side public data. ' +
      'The bidder name, responses, verdicts, evidence placeholders and injected defects are generated fixtures. ' +
      'They are not real bidder submissions and say nothing about any company\'s compliance, eligibility or outcome.',
  )
  lines.push('')
  lines.push(
    `Generated ${summary.generatedAt} · plugin ${summary.plugin.version} · tool \`${summary.plugin.tool}\` · ` +
      `entry point \`${summary.plugin.entrypoint}\``,
  )
  lines.push('')

  lines.push('## At a glance')
  lines.push('')
  lines.push('| Mode | Rules scored | Expected hits | TP | FP | FN | Precision | Recall | F1 | Clean | Mutations | Case exact |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const modeResult of [defaultMode, configuredMode]) {
    const total = modeResult.totals
    lines.push(
      `| ${modeResult.mode} | ${modeResult.scoredRules.length}/${RULES.length} | ${total.expected} | ${total.tp} | ` +
        `${total.fp} | ${total.fn} | ${ratioText(total.precision)} | ${ratioText(total.recall)} | ${ratioText(total.f1)} | ` +
        `${modeResult.cleanPass}/${modeResult.cleanTotal} | ${modeResult.mutationPass}/${modeResult.mutationTotal} | ` +
        `${modeResult.caseExact}/${modeResult.caseTotal} |`,
    )
  }
  lines.push('')
  lines.push(
    `The shipped pack executes ${defaultMode.scoredRules.length} of ${RULES.length} rules per case. ` +
      `BC-002 and BC-005 report themselves in \`skipped\` because their lists ship empty. ` +
      `The configured mode runs the same six rules with only those two lists filled; ` +
      `it scores all ${configuredMode.scoredRules.length} rules.`,
  )
  lines.push('')

  lines.push('## Source and license')
  lines.push('')
  lines.push(`- **Publisher:** ${summary.source.publisher}`)
  lines.push(
    `- **Dataset:** ${summary.source.dataset.title} — World Bank Data Catalog ` +
      `${summary.source.dataset.catalogId}, Finances One ${summary.source.dataset.financesOneId}`,
  )
  lines.push(`- **API:** \`${summary.source.endpoint}\``)
  lines.push(`- **Retrieved:** ${summary.source.retrievedAt}`)
  lines.push(`- **Raw SHA-256:** \`${summary.source.rawSha256}\``)
  lines.push(`- **License status: verified at the dataset level — CC BY 4.0.**`)
  lines.push(`  - [Data Catalog dataset page](${summary.source.dataset.catalogUrl})`)
  lines.push(
    `  - [Data Catalog metadata API](https://datacatalogapi.worldbank.org/dexapps/fone/api/metadata?assetId=${summary.source.dataset.financesOneId}) — the \`license\` field reads "Creative Commons Attribution 4.0 International"`,
  )
  lines.push(`  - [World Bank public licenses page](${summary.source.dataset.licenseUrl})`)
  lines.push(
    '  - [World Bank Group site terms](https://www.worldbank.org/ext/en/legal/terms-conditions) — the general site terms, which incorporate the dataset-specific terms by reference.',
  )
  lines.push(
    `  - The API response itself does not carry a license field, so the evidence is the dataset metadata, ` +
      `not the API payload. The general World Bank site terms also apply; this is not legal advice. ` +
      `Individual notice text may contain third-party content.`,
  )
  lines.push('')
  lines.push(
    `**Attribution:** "Source: World Bank, Procurement Notice dataset (${summary.source.dataset.financesOneId}), ` +
      `accessed via the World Bank Procurement Notices API on ${summary.source.retrievedAt.slice(0, 10)}. ` +
      `License: CC BY 4.0. Changes: filtered to construction-related Invitation for Bids, selected ` +
      `${summary.selection.selected} notices, projected fields, and generated synthetic bid-side fixtures. ` +
      `Bid responses are not World Bank data."`,
  )
  lines.push('')

  lines.push('## Method')
  lines.push('')
  lines.push('1. `fetch.mjs` downloads one page of the public API, records the exact URL, retrieval time and SHA-256, and writes the raw JSON under `.data/`.')
  lines.push(
    '2. `adapter.mjs` filters to `Invitation for Bids` notices with a parseable deadline, a construction-related description, all six consumed fields and no BC-006 placeholder. ' +
      'It selects one notice per country first (sorted by country then reference), fills the rest deterministically, and writes the requirements pack.',
  )
  lines.push(
    '3. The adapter writes one clean case per selected notice. Every bid-side cell is a `SYNTHETIC_` marker; the source notice fields are mirrored into the row but no bidder is claimed. ' +
      'It then injects one labelled defect per mutation case and four explicit blind-spot probes.',
  )
  lines.push(
    '4. `evaluate.mjs` imports `../../lib/index.mjs`, registers the real `bid_ca_precheck` tool through `ctx.tools.register`, and calls `tool.execute({ material })` with the generated JSON. ' +
      'No check is reimplemented; the only configuration is `rulesFile` pointing at the generated overlay in configured mode.',
  )
  lines.push(
    '5. Scoring is count-based per rule and case: `TP += min(expected, actual)`, `FP += max(0, actual - expected)`, `FN += max(0, expected - actual)`. ' +
      'Clean cases expect zero issues; mutation cases expect exactly one issue of the target rule; blind-spot probes expect zero issues and are excluded from P/R.',
  )
  lines.push('')
  lines.push(
    `\`fetch\` selected ${summary.selection.selected} notices from ${summary.candidates.input} API rows ` +
      `(${summary.candidates.accepted} candidates passed the filter; ${summary.candidates.notInvitationForBids} non-IFB, ` +
      `${summary.candidates.notConstruction} non-construction, ${summary.candidates.noHighRiskKeyword} without the high-risk keyword, ` +
      `${summary.candidates.placeholder} with placeholders, ${summary.candidates.duplicateReference} duplicate references were rejected).`,
  )
  lines.push('')
  lines.push('Selected notices:')
  lines.push('')
  lines.push('| Reference | Country / region | Notice type | Deadline | Method |')
  lines.push('|---|---|---|---|---|')
  for (const notice of summary.selection.notices) {
    lines.push(
      `| \`${escapeCell(notice.bid_reference_no)}\` | ${escapeCell(notice.project_ctry_name)} | ` +
        `${escapeCell(notice.notice_type)} | ${escapeCell(notice.submission_deadline_date)} | ` +
        `${escapeCell(notice.procurement_method_name)} |`,
    )
  }
  lines.push('')

  lines.push('## Cases')
  lines.push('')
  lines.push('| Case | Kind | Target | Expected | Default | Configured | What it probes |')
  lines.push('|---|---|---|---|---|---|---|')
  for (const caseResult of summary.caseResults) {
    const expected = Object.entries(caseResult.expected)
      .filter(([, count]) => count > 0)
      .map(([rule, count]) => `${rule} ×${count}`)
      .join(', ')
    lines.push(
      `| \`${escapeCell(caseResult.id)}\` | ${caseResult.kind} | ${caseResult.targetRule ?? '—'} | ` +
        `${expected === '' ? 'none' : expected} | ${caseStatus(caseResult, defaultMode, 'default')} | ` +
        `${caseStatus(caseResult, configuredMode, 'configured')} | ${escapeCell(truncate(caseResult.description, 140))} |`,
    )
  }
  lines.push('')

  lines.push('## Per-rule precision / recall')
  lines.push('')
  lines.push('### Shipped rule pack — default mode')
  lines.push('')
  lines.push(perRuleTable(defaultMode))
  lines.push('')
  lines.push(
    `BC-002 and BC-005 are not scored here: the shipped pack ships \`values: []\` and \`highRiskKeywords: []\`, ` +
      `so both rules report themselves in \`skipped\` in every case (${defaultMode.skippedByRule['BC-002'] ?? 0} and ` +
      `${defaultMode.skippedByRule['BC-005'] ?? 0} case-level skips respectively). ` +
      `The two mutation cases that target them are marked "not scored" in the case table.`,
  )
  lines.push('')
  lines.push('### Configured overlay — all six rules')
  lines.push('')
  lines.push(perRuleTable(configuredMode))
  lines.push('')
  lines.push(
    `The overlay fills only BC-002 \`values\` (${JSON.stringify(summary.overlayFills['BC-002'].values)}) and ` +
      `BC-005 \`highRiskKeywords\` (${JSON.stringify(summary.overlayFills['BC-005'].highRiskKeywords)}). ` +
      `Everything else is the shipped pack. The overlay is generated into \`.data/\` and is not a release artifact.`,
  )
  lines.push('')

  lines.push('## Blind spots (expected misses, not scored failures)')
  lines.push('')
  lines.push(
    'These four probes change something the six-rule pack does not check: a row field it ignores (deadline, notice type) or the row set itself (extra or missing row). ' +
      'Zero issues is the expected result and confirms the scope limit; it is not a correct assessment of the mismatch.',
  )
  lines.push('')
  lines.push('| Probe | Field | Requirements side | Bid side | Issues reported (configured) | Reading |')
  lines.push('|---|---|---|---|---:|---|')
  for (const probe of summary.blindSpots) {
    const requirementValue = probe.requirementValue === null ? '—' : escapeCell(probe.requirementValue)
    const bidValue = probe.bidValue === null ? '—' : escapeCell(probe.bidValue)
    lines.push(
      `| \`${escapeCell(probe.id)}\` | ${escapeCell(probe.field)} | ${requirementValue} | ${bidValue} | ` +
        `${probe.issuesReported.configured} | ${escapeCell(probe.why)} |`,
    )
  }
  lines.push('')

  lines.push('## Limitations and known failures')
  lines.push('')
  for (const limitation of summary.limitations) lines.push(`- ${limitation}`)
  lines.push('')
  if (summary.failures.length === 0) {
    lines.push('**Scored failures in this run:** none. All scored case labels were reproduced exactly in both modes.')
  } else {
    lines.push('**Scored failures in this run:**')
    for (const failure of summary.failures) lines.push(`- \`${failure.caseId}\``)
  }
  lines.push('')

  lines.push('## Reproduction')
  lines.push('')
  lines.push('```sh')
  lines.push('cd /mnt/d/Projects/dsh/checkers/dsh-bid-ca-precheck')
  lines.push('node bench/public-worldbank/fetch.mjs')
  lines.push('node bench/public-worldbank/adapter.mjs')
  lines.push('node bench/public-worldbank/evaluate.mjs')
  lines.push('```')
  lines.push('')
  lines.push(`Observed in this run: ${summary.selection.selected} clean notices, ${summary.caseCounts.total} cases ` +
    `(${summary.caseCounts.clean} clean, ${summary.caseCounts.mutation} mutation, ${summary.caseCounts.blindSpot} blind-spot); ` +
    `default mode P/R ${ratioText(defaultMode.totals.precision)}/${ratioText(defaultMode.totals.recall)} on ` +
    `${defaultMode.totals.expected} injected hits; configured mode P/R ` +
    `${ratioText(configuredMode.totals.precision)}/${ratioText(configuredMode.totals.recall)} on ` +
    `${configuredMode.totals.expected} injected hits.`)
  lines.push('')

  lines.push('## Provenance')
  lines.push('')
  lines.push('| Artifact | SHA-256 |')
  lines.push('|---|---|')
  lines.push(`| \`${summary.hashes.rawFile}\` | \`${summary.hashes.raw}\` |`)
  lines.push(`| \`${summary.hashes.requirementsFile}\` | \`${summary.hashes.requirements}\` |`)
  lines.push(`| \`${summary.hashes.casesFile}\` | \`${summary.hashes.cases}\` |`)
  lines.push(`| \`${summary.hashes.overlayFile}\` | \`${summary.hashes.overlay}\` |`)
  lines.push(`| \`${summary.plugin.entrypoint}\` | \`${summary.plugin.entrypointSha256}\` |`)
  lines.push('')

  lines.push('## Files')
  lines.push('')
  lines.push('- `bench/public-worldbank/fetch.mjs` — reproducible API download plus metadata sidecar.')
  lines.push('- `bench/public-worldbank/adapter.mjs` — notices to requirements pack, clean/mutation/blind-spot cases, configured overlay.')
  lines.push('- `bench/public-worldbank/evaluate.mjs` — real tool registration, runs, P/R, `summary.json`, `RESULTS.md`.')
  lines.push('- `bench/public-worldbank/summary.json` — machine-readable results and provenance.')
  lines.push('- `bench/public-worldbank/RESULTS.md` — this report.')
  lines.push('- `bench/public-worldbank/.gitignore` — ignores `.data/` (raw response, cases, results, overlay).')
  lines.push('')
  lines.push(
    '> The bid side is synthetic. Do not read this benchmark as evidence that any real bidder responded, complied, ' +
      'failed or won. The notices are public World Bank requirements-side data; the bid registers are generated fixtures.',
  )
  lines.push('')

  return lines.join('\n')
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage()
    return
  }

  const casesPath = resolve(DATA_DIR, 'cases.json')
  const adapterMetaPath = resolve(DATA_DIR, 'adapter-meta.json')
  const overlayPath = resolve(DATA_DIR, 'rules-configured.yaml')
  const fetchMetaPath = resolve(DATA_DIR, 'wb-procnotices.construction.meta.json')
  const requirementsPath = resolve(DATA_DIR, 'requirements.json')

  const casesDocument = await readJson(casesPath)
  const adapterMeta = await readJson(adapterMetaPath)
  const fetchMeta = await readJson(fetchMetaPath)
  const cases = casesDocument.cases
  assert(Array.isArray(cases) && cases.length > 0, `${casesPath} has no cases`)

  const overlayText = await readFile(overlayPath, 'utf8')
  const overlaySha = sha256(overlayText)
  assert(overlaySha === adapterMeta.hashes.overlay, 'overlay hash does not match adapter metadata; re-run adapter.mjs')

  const pluginPackage = JSON.parse(await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8'))
  const libPath = resolve(REPO_ROOT, 'lib/index.mjs')
  const libText = await readFile(libPath, 'utf8')

  const registered = []
  const ctx = {
    tools: {
      register: (tool) => {
        registered.push(tool)
        return () => {}
      },
    },
  }
  plugin.apply(ctx, plugin.Config ? plugin.Config({}) : {})
  const tool = registered.find((candidate) => candidate.name === plugin.TOOL_NAME)
  assert(tool !== undefined, `the plugin did not register ${plugin.TOOL_NAME}`)
  assert(typeof tool.execute === 'function', `${plugin.TOOL_NAME} has no execute function`)

  const runs = []
  for (const caseDef of cases) {
    for (const mode of MODES) {
      const material = JSON.stringify(caseDef.bid)
      const args = mode === 'configured' ? { material, rulesFile: overlayPath } : { material }
      const startedAt = Date.now()
      const result = await tool.execute(args, { signal: AbortSignal.timeout(120_000) })
      const durationMs = Date.now() - startedAt

      assert(typeof result.reportJson === 'string', `${caseDef.id}/${mode}: tool returned no reportJson`)
      const report = JSON.parse(result.reportJson)
      assert(Array.isArray(report.issues), `${caseDef.id}/${mode}: report.issues is not an array`)
      assert(result.issueCount === report.issues.length, `${caseDef.id}/${mode}: issueCount mismatch`)
      assert(report.plugin === 'dsh-bid-ca-precheck', `${caseDef.id}/${mode}: wrong plugin name`)
      assert(report.target === '(内联材料)', `${caseDef.id}/${mode}: material target was not inline`)
      assert(report.execution !== undefined, `${caseDef.id}/${mode}: no execution accounting`)

      const expectedVersion =
        mode === 'default' ? casesDocument.rulesets.shippedVersion : casesDocument.rulesets.configuredVersion
      assert(
        report.rulesetVersion === expectedVersion,
        `${caseDef.id}/${mode}: rulesetVersion ${report.rulesetVersion} != ${expectedVersion}`,
      )

      if (mode === 'default') {
        assert(report.execution.total === RULES.length, `${caseDef.id}/default: execution.total != ${RULES.length}`)

        const skipped = new Set((report.skipped ?? []).map((entry) => entry.rule))
        assert(skipped.has('BC-002') && skipped.has('BC-005'), `${caseDef.id}/default: BC-002/BC-005 should be skipped`)
      } else {
        assert(report.execution.total === RULES.length, `${caseDef.id}/configured: execution.total != ${RULES.length}`)

      }
      assert(report.execution.unsupported === 0, `${caseDef.id}/${mode}: unsupported rule count != 0`)

      const auditDir = resolve(RESULTS_DIR, mode)
      await mkdir(auditDir, { recursive: true })
      await writeFile(
        resolve(auditDir, `${caseDef.id}.json`),
        `${JSON.stringify(
          {
            caseId: caseDef.id,
            mode,
            input: { material, ...(mode === 'configured' ? { rulesFile: relativeToRepo(overlayPath) } : {}) },
            durationMs,
            result,
            report,
          },
          null,
          2,
        )}\n`,
        'utf8',
      )

      runs.push({ case: caseDef, mode, result, report, durationMs })
    }
  }

  const defaultRuns = runs.filter((run) => run.mode === 'default')
  const configuredRuns = runs.filter((run) => run.mode === 'configured')
  const defaultScore = scoreMode('default', defaultRuns)
  const configuredScore = scoreMode('configured', configuredRuns)

  const runsByCase = new Map()
  for (const caseDef of cases) runsByCase.set(caseDef.id, {})
  for (const run of runs) runsByCase.get(run.case.id)[run.mode] = run

  const caseResults = cases.map((caseDef) => {
    const pair = runsByCase.get(caseDef.id)
    return {
      id: caseDef.id,
      kind: caseDef.kind,
      targetRule: caseDef.targetRule,
      description: caseDef.description,
      expected: expectedCounts(caseDef),
      default: summarizeRun(pair.default, 'default'),
      configured: summarizeRun(pair.configured, 'configured'),
    }
  })

  const blindSpots = cases
    .filter((caseDef) => caseDef.kind === 'blind-spot')
    .map((caseDef) => {
      const pair = runsByCase.get(caseDef.id)
      return {
        id: caseDef.id,
        ...caseDef.blindSpot,
        issuesReported: {
          default: pair.default.report.issues.length,
          configured: pair.configured.report.issues.length,
        },
        detected: pair.configured.report.issues.length > 0,
      }
    })

  const failures = [...defaultScore.failed, ...configuredScore.failed]
  const requirementsText = await readFile(requirementsPath, 'utf8')
  const casesText = await readFile(casesPath, 'utf8')

  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    benchmark: 'public-worldbank',
    command: 'node bench/public-worldbank/evaluate.mjs',
    syntheticBidWarning:
      'The notices are requirements-side public data. Everything on the bid side (bidder, response, verdict, evidence, mutations) is synthetic and is not a real bidder submission or outcome.',
    plugin: {
      name: 'dsh-bid-ca-precheck',
      version: pluginPackage.version,
      tool: plugin.TOOL_NAME,
      injected: plugin.inject,
      entrypoint: relativeToRepo(libPath),
      entrypointSha256: sha256(libText),
      shippedRulesetVersion: casesDocument.rulesets.shippedVersion,
      configuredRulesetVersion: casesDocument.rulesets.configuredVersion,
    },
    source: {
      publisher: adapterMeta.source.publisher,
      dataset: adapterMeta.source.dataset,
      endpoint: adapterMeta.source.endpoint,
      retrievedAt: adapterMeta.source.retrievedAt,
      rawFile: adapterMeta.source.raw,
      rawSha256: adapterMeta.source.rawSha256,
      api: adapterMeta.source.api,
      license: adapterMeta.license,
    },
    selection: adapterMeta.selection,
    candidates: adapterMeta.selection.candidateStats,
    caseCounts: adapterMeta.cases,
    overlayFills: casesDocument.rulesets.overlayFills,
    modes: {
      default: defaultScore,
      configured: configuredScore,
    },
    caseResults,
    blindSpots,
    failures,
    limitations: LIMITATIONS,
    hashes: {
      raw: fetchMeta.sha256,
      rawFile: adapterMeta.source.raw,
      requirements: sha256(requirementsText),
      requirementsFile: relativeToRepo(requirementsPath),
      cases: sha256(casesText),
      casesFile: relativeToRepo(casesPath),
      overlay: overlaySha,
      overlayFile: relativeToRepo(overlayPath),
    },
  }

  await writeFile(resolve(HERE, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  await writeFile(resolve(HERE, 'RESULTS.md'), buildResultsMarkdown(summary), 'utf8')

  console.log('dsh-bid-ca-precheck · public World Bank benchmark')
  console.log(
    `plugin ${summary.plugin.version} · tool ${summary.plugin.tool} · shipped rules ${summary.plugin.shippedRulesetVersion} · ` +
      `configured rules ${summary.plugin.configuredRulesetVersion}`,
  )
  console.log(`raw: ${summary.source.rawSha256} (${summary.source.retrievedAt})`)
  console.log(
    `cases: ${summary.caseCounts.total} (${summary.caseCounts.clean} clean, ${summary.caseCounts.mutation} mutation, ` +
      `${summary.caseCounts.blindSpot} blind-spot)`,
  )
  for (const modeResult of [defaultScore, configuredScore]) {
    console.log(
      `${modeResult.mode}: ${modeResult.scoredRules.length}/${RULES.length} rules scored · ` +
        `TP ${modeResult.totals.tp} FP ${modeResult.totals.fp} FN ${modeResult.totals.fn} · ` +
        `P ${ratioText(modeResult.totals.precision)} R ${ratioText(modeResult.totals.recall)} · ` +
        `clean ${modeResult.cleanPass}/${modeResult.cleanTotal} · exact ${modeResult.caseExact}/${modeResult.caseTotal}`,
    )
  }
  console.log(
    `blind-spot probes: ${configuredScore.blindSpotTotal} · detected by the tool: ${configuredScore.blindSpotDetected} ` +
      '(expected: no notice-type or external row-set rule)',
  )
  console.log(`wrote ${relativeToRepo(resolve(HERE, 'summary.json'))}`)
  console.log(`wrote ${relativeToRepo(resolve(HERE, 'RESULTS.md'))}`)
  if (failures.length > 0) {
    console.log(`scored failures: ${failures.map((failure) => failure.caseId).join(', ')}`)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
