/**
 * dsh-bid-ca-precheck — pre-check a bid against the tender's compliance items.
 *
 * The plugin is data-only: the table shape lives in `model.ts`, the reader and the
 * check engine come from the shared kit, and the rule pack declares every check.
 * That keeps the plugin reviewable in minutes and makes the rule set replaceable
 * without a code change — which matters, because tender documents differ per
 * procurement and the compliance item list is the buyer's, not a standard's.
 */

import { canonicaliseRow, parseTable, type TableSpec } from './shared/table.ts'
import { runTableCheck, type TableCheckOptions, type TableInput } from './shared/rows.ts'
import type { Ruleset } from './shared/rules.ts'

/** Tool id exposed to the model, and the row id in `cordis.patch.yml`. */
export const TOOL_NAME = 'bid_ca_precheck'

/** The register's column aliases, declared once so both the spec and the guard see them. */
const COLUMNS = {
  clause: ['条款号', '序号', '项号', 'clause', 'item'],
  requirement: ['招标要求', '招标文件要求', '要求', '条款内容', 'requirement'],
  response: ['投标响应', '响应情况', '响应内容', '投标响应内容', 'response'],
  verdict: ['响应结论', '结论', '判定', '是否符合', 'verdict', 'compliance'],
  evidence: ['证明材料', '证明文件', '支撑材料', '页码', 'evidence', 'reference'],
  note: ['备注', '说明', 'note', 'remark'],
} as const

/**
 * The compliance register's own column names.
 *
 * A pre-check register carries the requirement, the response, and the verdict that
 * connects them. Aliases cover both the wording a Chinese register uses and the
 * English headings a generated export produces.
 */
export const SPEC: TableSpec = {
  rowKeys: ['rows', 'items', 'clauses', '条款'],
  columns: COLUMNS,
  header: {
    project: ['project', '项目名称', '招标项目名称', '工程名称'],
    tenderNo: ['tenderNo', '招标编号', '项目编号'],
    bidder: ['bidder', '投标人', '投标单位名称'],
  },
}

/** Fields the material must carry somewhere for the reader to accept it. */
export const REQUIRE_ANY_OF = [
  ...COLUMNS.clause,
  ...COLUMNS.requirement,
  ...COLUMNS.response,
  ...COLUMNS.verdict,
]

/**
 * Parse a compliance register and attach its canonical field names.
 * @param source - JSON or YAML text.
 * @param target - description of where the material came from.
 * @returns the normalized table, with each row's aliases resolved to field names.
 */
export function parseMaterial(source: string, target: string): TableInput {
  const table = parseTable(source, target, { ...SPEC, requireAnyOf: REQUIRE_ANY_OF })
  for (const row of table.rows) canonicaliseRow(row, SPEC)
  return table
}

/**
 * Run the rule pack against a compliance register.
 * @param input - normalized table.
 * @param ruleset - validated rule pack.
 * @param options - plugin identity, clock value, rule selection and overrides.
 * @returns the report.
 */
export function runCheck(input: TableInput, ruleset: Ruleset, options: TableCheckOptions) {
  return runTableCheck(input, ruleset, options)
}

export type { TableCheckOptions, TableInput }
