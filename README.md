# dsh-bid-ca-precheck

**Boundary:** this plugin checks a **投标符合性响应台账** for what a register can be held to — that every
tender requirement has a recorded response, that verdicts come from your vocabulary and clause numbers are
unique, that a high-risk clause carries evidence, and that the requirement column still holds real
requirements rather than template placeholders. It does **not** decide whether a bid is valid, whether it
should be rejected, or whether a response is a material deviation. **Those calls belong to the evaluation
committee, and this plugin never makes them** — a test asserts that no rule here can be `error`.

> ### ⚠️ Read this before trusting a citation in the report
>
> **Every `excerpt` in this plugin's rule pack says, in so many words, that the clause text was not
> obtained.** The regime lives in 《招标投标法》, 《招标投标法实施条例》 and each project's 评标办法. The
> verification pass for this plugin could not retrieve verbatim clause text from them, so rather than
> paraphrase a quotation the pack states the gap in the `excerpt` field itself and puts the honest
> reasoning in `note`. Every rule is therefore `warn` or `info`, and a test asserts that no rule claims a
> quotation it does not have. **When the texts are in hand, two things must be done: replace each
> `excerpt` with the real clause, and raise `kind` to `direct`.**
>
> The worst failure mode of a register tool is a register copied from a template and mistaken for a
> checked one, so `BC-006` looks for exactly that: `【】`, `{{}}`, `XXX`, `待填`, `TBD` left in the
> requirement column.
>
> Two lists are yours, not a standard's: the verdict vocabulary (`BC-002`) and the high-risk keywords
> (`BC-005`). Both ship **empty**, and a rule whose list is unset reports itself in `skipped` rather than
> passing silently.

## Compatibility

| Surface | Status |
|---|---|
| Harness | Peer range `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` — verified to accept both `0.2.0-rc.2` and `0.2.1-alpha.1`. `engines.dsh` is deliberately not declared: it has no reader and cannot reject a host |
| Node | `^22.19.0 || >=24.0.0` |
| Platforms | All (plain ESM; no native code, no network, no model call) |
| Tool mode | Works in `native`, `ptc` and `both`; for a batch of registers use `ptc` |

## What it does

Registers the `bid_ca_precheck` tool. It reads one compliance register — the tender's requirements and the
bidder's responses, keyed by the register's own column names in Chinese or English — applies a versioned
rule pack, and returns a report.

| Rule | Check | Severity | Basis kind |
|---|---|---|---|
| `BC-001` | every requirement has a recorded response | warn | principle |
| `BC-002` | the verdict uses your vocabulary (off by default) | info | local |
| `BC-003` | clause numbers are unique in the register | warn | principle |
| `BC-004` | the register names its project and its bidder | warn | principle |
| `BC-005` | a high-risk clause carries evidence (off by default) | warn | principle |
| `BC-006` | the requirement column holds no unreplaced placeholder | warn | principle |

## Install

```sh
dsh plugin --profile <name> add dsh-bid-ca-precheck
dsh --profile <name> --dump-config | grep 'dsh-bid-ca-precheck'
```

## Configuration

| Key | Type | Default | Description |
|---|---|---|---|
| `rulesFile` | string | `rules/bid-ca-precheck.yaml` | Rule-pack path, relative to the package root |
| `disabledRules` | string[] | `[]` | Rule ids to stop running; each appears in `skipped` |
| `onlyRules` | string[] | `[]` | Run only these rule ids; empty runs every rule |
| `skipNotes` | string | `""` | Note appended to every `skipped` reason |
| `timeoutMs` | number | `120000` | Cooperative tool timeout budget |

Rule-level parameters worth knowing:

- `BC-002` `values` — your verdict vocabulary, e.g. `[满足, 部分满足, 不满足, 待确认]`. Empty means the
  rule does not run. It can also be passed per call.
- `BC-005` `highRiskKeywords` — the words that mark a clause as needing evidence, e.g.
  `[资格, 业绩, 实质性, 星号条款]`. Empty means the rule does not run.
  `evidenceField` and `requirementField` rename the two columns it reads.
- `BC-006` `terms` — the placeholders to look for; the default list covers `【】`, `{{}}`, `XXX`, `待填`,
  `待补充`, `TBD`, `todo`.

## Material format

The tool accepts JSON or YAML:

```yaml
project: 某某厂房工程
bidder: 某某建设有限公司
rows:
  - { 条款号: "2.1", 招标要求: 投标人应具有建筑工程施工总承包二级及以上资质,
      投标响应: 已提供资质证书复印件，等级为二级, 响应结论: 满足, 证明材料: 资格文件第 12 页 }
  - { Clause: "2.2", Requirement: 近三年至少完成两项同类业绩,
      Response: 已提供合同及验收证明, Verdict: 满足, Evidence: 业绩文件第 3 页 }
```

Column names are matched case-insensitively and ignoring spaces, underscores and hyphens, so `招标要求`
and `requirement` resolve to the same field; the register's own column names are kept, so a finding names
the column it actually read. A row may declare its own number via `row`, `序号` or `行号`.

## Rule sources

Rule data lives in `rules/bid-ca-precheck.yaml`. The pack's header states the citation gap in full, and
each rule's `note` repeats the part that matters for that rule. The load-time guard that normally enforces
"an excerpt must be a real quotation of at least eight characters" cannot tell a quotation from a
description — so this pack leans on the header, the per-rule notes and a test that asserts every `excerpt`
admits the gap.

## Troubleshooting

- **`BC-002` or `BC-005` report themselves as skipped.** Their lists are empty. Both depend on your
  project, not on a regulation, and the plugin will not guess them.
- **`BC-006` fires on a requirement I meant literally.** The word `XXX` or `待填` appears in it. Narrow the
  `terms` list, or fix the register.
- **The reader refuses a register it used to accept.** It found none of the known column names; the error
  names the columns it saw. Rename one column to a known alias, or add the alias to the plugin's column
  spec.
- **`BC-001` fires on rows I consider informational.** A blank response means "not checked", which is the
  one thing a pre-check register must never be. If a clause genuinely needs no response, record that in
  the register rather than leaving it blank.
- **The plugin installs but the tool never appears.** Check that `main` resolves to `lib/index.mjs` and
  that `pnpm run build` produced it; a wrong `main` makes the loader skip the entry silently.
- **`dsh plugin add` refuses the package as incompatible.** The peer range covers `0.1.x` and `0.2.x`; if
  your runtime sits outside it, grant an explicit exemption:
  `dsh plugin --profile <name> allow-version dsh-bid-ca-precheck@0.1.0 --dsh-version <runtime> --accept-risk`
- **`check` reports `manifest-peers` as failed.** The static checker compares against a hard-coded peer
  range that predates the 0.2 line. The runtime enforces peer compatibility at install time, so the
  declared range is the correct one; this is a known upstream issue in `dsh-plugin-dev`.

## Development

```sh
pnpm install
pnpm run typecheck   # tsc --noEmit
pnpm test            # vitest, paired fixtures per rule
pnpm run build       # tsdown -> lib/index.mjs + lib/index.d.mts
node ../scripts/sync-shared.mjs dsh-bid-ca-precheck   # refresh src/shared from ../_shared
```

The plugin is **data-only**: `src/model.ts` declares the table shape, the shared kit supplies the reader
and the check engine, and the rule pack declares every check. A new check that fits an existing kind needs
a rule pack edit and nothing else.

## License

[Apache License 2.0](LICENSE) © 2026 dsh-bid-ca-precheck contributors.
