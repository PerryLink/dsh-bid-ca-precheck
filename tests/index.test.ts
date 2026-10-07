import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadRuleset } from '../src/shared/ruleset.ts'
import { numberOf } from '../src/shared/rows.ts'
import { MaterialError } from '../src/shared/table.ts'
import { parseMaterial, runCheck, SPEC } from '../src/model.ts'
import { buildView } from '../src/view.ts'
import { findForbiddenWording } from '../src/shared/wording.ts'
import { addDays, diffDays, parseWallClock } from '../src/shared/datetime.ts'
import { parseYaml } from '../src/shared/yaml.ts'
import { Config as ConfigSchema } from '../src/config.ts'
import { inject, name as pluginName, resolvePackageFile, TOOL_NAME } from '../src/index.ts'
import type { Report } from '../src/shared/report.ts'
import type { TableCheckOptions } from '../src/shared/rows.ts'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(here, '..')
const rulesPath = join(packageRoot, 'rules', 'bid-ca-precheck.yaml')
const fixturesRoot = join(here, 'fixtures')
const CHECKED_AT = '2026-10-06T00:00:00.000Z'

interface CaseFile {
  ruleId: string
  configure?: Record<string, Record<string, unknown>>
  pairs: { name: string; material: string; expect: { ruleId: string; count: number } }[]
}

async function loadPack() {
  return loadRuleset(await readFile(rulesPath, 'utf8'))
}

function runOptions(overrides: Partial<TableCheckOptions> = {}): TableCheckOptions {
  return { plugin: pluginName, checkedAt: CHECKED_AT, disabledRules: [], onlyRules: [], ...overrides }
}

async function runFixture(materialText: string, target: string, configure?: CaseFile['configure']): Promise<Report> {
  const ruleset = await loadPack()
  return runCheck(parseMaterial(materialText, target), ruleset, runOptions({ overrides: configure }))
}

function issuesOf(report: Report, ruleId: string) {
  return report.issues.filter((issue) => issue.ruleId === ruleId)
}

async function ruleDirectories(): Promise<string[]> {
  const entries = await readdir(fixturesRoot, { withFileTypes: true })
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
}

async function readCases(directory: string): Promise<CaseFile> {
  return JSON.parse(await readFile(join(fixturesRoot, directory, 'cases.json'), 'utf8')) as CaseFile
}

const GOOD = {
  project: '某某厂房工程',
  bidder: '某某建设有限公司',
  rows: [
    {
      条款号: '2.1',
      招标要求: '投标人应具有建筑工程施工总承包二级及以上资质',
      投标响应: '已提供资质证书复印件',
      响应结论: '满足',
      证明材料: '资格文件第 12 页',
    },
  ],
}

describe('rule pack', () => {
  it('declares a citable basis for every rule', async () => {
    const ruleset = await loadPack()
    expect(ruleset.plugin).toBe(pluginName)
    expect(ruleset.rules.length).toBeGreaterThanOrEqual(6)
    for (const rule of ruleset.rules) {
      expect(rule.basis.document, `${rule.id} document`).not.toBe('')
      expect(rule.basis.clause, `${rule.id} clause`).not.toBe('')
      expect(rule.basis.excerpt.length, `${rule.id} excerpt`).toBeGreaterThanOrEqual(8)
      expect(rule.basis.source, `${rule.id} source`).toMatch(/^https?:\/\//)
      expect(['direct', 'derived-from-principle', 'institutional-configuration']).toContain(rule.basis.kind)
    }
  })

  it('never lets a principle-derived or locally configured check be an error', async () => {
    const ruleset = await loadPack()
    for (const rule of ruleset.rules) {
      if (rule.basis.kind === 'derived-from-principle') expect(rule.severity, rule.id).not.toBe('error')
      if (rule.basis.kind === 'institutional-configuration') expect(rule.severity, rule.id).toBe('info')
    }
    // Nothing here may be an error: this plugin does not adjudicate a bid.
    expect(ruleset.rules.filter((rule) => rule.severity === 'error')).toHaveLength(0)
  })

  it('never advertises a quotation it cannot show', async () => {
    const ruleset = await loadPack()
    // Each excerpt is in one of two honest states: it quotes the clause verbatim (several now do,
    // following the 2026-10 verification of the 2017 修正 text), or it says plainly that the text was
    // not obtained. The silent middle — text reading as a quotation while admitting nothing — is what
    // this forbids. Re-verifying a quote against its source is the job of the evidence report, not
    // of this assertion.
    const ADMISSIONS = ['本次未取得', '不存在可引用的标准条文', '本规则库不伪造引文']
    for (const rule of ruleset.rules) {
      const excerpt = rule.basis.excerpt
      if (ADMISSIONS.some((marker) => excerpt.includes(marker))) continue
      expect(excerpt.length, `${rule.id}: excerpt looks neither like a quotation nor an admission`).toBeGreaterThan(12)
    }
    const source = await readFile(rulesPath, 'utf8')
    // The pack must still record that quotations are only added once verified.
    expect(source).toContain('取得条文后必须做两件事')
  })

  it('states plainly that it never adjudicates validity, rejection or material deviation', async () => {
    const source = await readFile(rulesPath, 'utf8')
    expect(source).toContain('**本插件绝不判定投标是否有效、是否废标、')
    expect(source).toContain('是否构成实质性偏离**')
  })

  it('refuses a rule pack that overstates a principle-derived check', () => {
    const overstated = [
      'plugin: probe',
      'version: "0"',
      'rules:',
      '  - id: X-001',
      '    title: probe',
      '    severity: error',
      '    basis:',
      '      document: 《X》',
      '      number: X〔2020〕1号',
      '      clause: 第一条',
      '      excerpt: 这是一个足够长的逐字摘录示例。',
      '      kind: derived-from-principle',
      '      source: https://example.invalid/x',
    ].join('\n')
    expect(() => loadRuleset(overstated)).toThrow(/strongest permitted severity/)
  })
})

describe('paired fixtures', () => {
  it('has both a compliant and a violating sample for every rule', async () => {
    const ruleset = await loadPack()
    const covered = new Set<string>()
    for (const directory of await ruleDirectories()) {
      const cases = await readCases(directory)
      expect(cases.pairs.filter((pair) => pair.expect.count === 0).length, `${directory} compliant sample`).toBeGreaterThanOrEqual(1)
      expect(cases.pairs.filter((pair) => pair.expect.count > 0).length, `${directory} violating sample`).toBeGreaterThanOrEqual(1)
      for (const pair of cases.pairs) {
        const material = await readFile(join(fixturesRoot, directory, pair.material), 'utf8')
        const report = await runFixture(material, pair.material, cases.configure)
        const matched = issuesOf(report, cases.ruleId)
        expect(
          matched.length,
          `${directory}/${pair.name} expected ${pair.expect.count} × ${cases.ruleId}, got ${matched.map((issue) => issue.found).join(' | ')}`,
        ).toBe(pair.expect.count)
        covered.add(cases.ruleId)
      }
    }
    for (const rule of ruleset.rules) expect(covered.has(rule.id), `covered ${rule.id}`).toBe(true)
  })

  it('gives every issue a citable basis and a stable id', async () => {
    for (const directory of await ruleDirectories()) {
      const cases = await readCases(directory)
      for (const pair of cases.pairs) {
        const material = await readFile(join(fixturesRoot, directory, pair.material), 'utf8')
        const report = await runFixture(material, pair.material, cases.configure)
        for (const issue of report.issues) {
          expect(issue.basis).toContain('「')
          expect(issue.id).toMatch(/^dsh-bid-ca-precheck\.BC-\d{3}\.[0-9a-f]{8}$/)
          expect(issue.found).not.toBe('')
          expect(issue.expected).not.toBe('')
        }
      }
    }
  })
})

describe('reader', () => {
  it('resolves Chinese and English column names to the same fields', () => {
    const chinese = parseMaterial(JSON.stringify(GOOD), 'inline')
    expect(chinese.rows[0]?.fields.requirement).toContain('施工总承包')
    const english = parseMaterial(
      JSON.stringify({
        project: 'p',
        bidder: 'b',
        rows: [{ Clause: '2.1', Requirement: 'qualification', Response: 'provided', Verdict: 'met' }],
      }),
      'inline',
    )
    expect(english.rows[0]?.fields.response).toBe('provided')
    expect(english.rows[0]?.fields.verdict).toBe('met')
  })

  it('keeps the original column names so a finding can cite the right one', () => {
    const table = parseMaterial(JSON.stringify(GOOD), 'inline')
    expect(Object.keys(table.rows[0]?.fields ?? {})).toContain('招标要求')
    expect(table.columns).toContain('招标要求')
  })

  it('honours a declared row number', () => {
    const table = parseMaterial(JSON.stringify({ project: 'p', bidder: 'b', rows: [{ 序号: '7', 条款号: '2.1' }] }), 'inline')
    expect(table.rows[0]?.row).toBe(7)
  })

  it('refuses material carrying none of the known columns', () => {
    expect(() => parseMaterial(JSON.stringify({ rows: [{ 备注: '甲' }] }), 'inline')).toThrow(MaterialError)
    expect(() => parseMaterial(JSON.stringify({ rows: [{ 备注: '甲' }] }), 'inline')).toThrow(/没有可识别的字段/)
  })

  it('rejects empty material and a missing row list', () => {
    expect(() => parseMaterial('   ', 'inline')).toThrow(/材料为空/)
    expect(() => parseMaterial('project: p', 'inline')).toThrow(/任一列表/)
  })

  it('names the row keys it accepts', () => {
    expect(SPEC.rowKeys).toContain('rows')
  })
})

describe('skipped reporting', () => {
  it('admits that the verdict vocabulary is not configured', async () => {
    const report = await runFixture(JSON.stringify(GOOD), 'inline')
    expect(report.skipped.find((entry) => entry.rule === 'BC-002')?.reason).toContain('未配置')
  })

  it('admits that the high-risk keywords are not configured', async () => {
    const report = await runFixture(JSON.stringify(GOOD), 'inline')
    expect(report.skipped.find((entry) => entry.rule === 'BC-005')?.reason).toContain('未配置 highRiskKeywords')
  })

  it('names disabled rules exactly once and appends the configured note', async () => {
    const ruleset = await loadPack()
    const table = parseMaterial(JSON.stringify(GOOD), 'inline')
    const report = runCheck(table, ruleset, runOptions({ disabledRules: ['BC-004'], skipNotes: '本机构预检表' }))
    const entries = report.skipped.filter((item) => item.rule === 'BC-004')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.reason).toContain('禁用')
    expect(entries[0]?.reason).toContain('本机构预检表')
  })

  it('reports a rule that did not run only once', async () => {
    const report = await runFixture(JSON.stringify(GOOD), 'inline')
    const rules = report.skipped.map((entry) => entry.rule)
    expect(new Set(rules).size).toBe(rules.length)
  })
})

describe('report rendering', () => {
  it('never uses adjudicating wording and always carries the disclaimer', async () => {
    const material = await readFile(join(fixturesRoot, 'BC-001', 'BC-001-unsafe.json'), 'utf8')
    const report = await runFixture(material, 'BC-001-unsafe.json')
    const view = buildView(report)
    expect(findForbiddenWording(view.markdown)).toEqual([])
    expect(view.markdown).toContain('免责声明')
    expect(view.markdown).toContain('未执行的检查')
    expect(JSON.parse(view.reportJson)).toMatchObject({ plugin: pluginName, summary: report.summary })
  })
})

describe('plugin contract', () => {
  it('declares a static inject array covering every service apply touches', () => {
    expect(Array.isArray(inject)).toBe(true)
    expect(inject).toContain('tools')
  })

  it('exposes a Schemastery Config with serializable defaults', () => {
    const resolved = ConfigSchema(null)
    expect(resolved.rulesFile).toBe('rules/bid-ca-precheck.yaml')
    expect(resolved.disabledRules).toEqual([])
    expect(resolved.timeoutMs).toBeGreaterThan(0)
  })

  it('resolves the packaged rule pack and rejects a missing one', () => {
    expect(resolvePackageFile('rules/bid-ca-precheck.yaml')).toBe(rulesPath)
    expect(() => resolvePackageFile('rules/does-not-exist.yaml')).toThrow(/未找到/)
  })

  it('names the tool after the package family convention', () => {
    expect(TOOL_NAME).toBe('bid_ca_precheck')
  })
})

describe('shared kit', () => {
  it('reads numbers in the shapes a spreadsheet export produces', () => {
    expect(numberOf('1,200')).toBe(1200)
    expect(numberOf('１２')).toBe(12)
    expect(numberOf('50%')).toBe(50)
    expect(numberOf('若干')).toBeUndefined()
  })

  it('parses wall-clock timestamps and rejects impossible dates', () => {
    expect(parseWallClock('2026-03-15')).toEqual({ date: '2026-03-15', time: '00:00', hasTime: false, minutes: 0 })
    expect(parseWallClock('2026-02-30')).toBeUndefined()
  })

  it('does calendar arithmetic', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01')
    expect(diffDays('2026-03-01', '2026-03-06')).toBe(5)
  })

  it('reads the supported YAML subset and rejects the rest', () => {
    expect(parseYaml('a: 1\nb:\n  - x\n')).toEqual({ a: 1, b: ['x'] })
    expect(() => parseYaml('a: 1\na: 2\n')).toThrow(/duplicate/)
  })
})
