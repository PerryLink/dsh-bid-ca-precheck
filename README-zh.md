# dsh-bid-ca-precheck — 投标文件符合性预检

`dsh-bid-ca-precheck` 读取一份投标符合性响应台账——招标文件的要求与投标人的响应，按台账自己的中英文列名取值——套用一版规则库，核对这份台账自身的齐备与自洽：每条招标要求是否记录了响应、响应结论是否取自你配置的取值清单、条款号在台账内是否唯一、台账是否声明了项目与投标人、你标记为高风险的条款是否填写了证明材料、招标要求栏里是不是真实要求而不是模板占位符。

## 它回答什么问题

| 你会问 | 它怎么答 |
|---|---|
| 某条招标要求的 `response` 栏是空的，会报出来吗？ | 会。`BC-001` 会报出这一行，因为每条招标要求都应当有响应记录。它只核对 `response` 栏是否填写，不判断该响应是否满足这条要求——那是评标委员会的判断。 |
| 我在 `verdict` 栏填了值，报告却说这条规则没跑起来，为什么？ | `BC-002` 拿每个值与你自己配置的结论取值清单比对，而该清单出厂为空，所以在填好 `values` 之前，本条报告「无法执行」（`skipped`），而不是替你猜。配置之后它也只报出不在清单里的值，不判断该结论本身是否正确。 |
| 同一台账里有两行的条款号相同。 | `BC-003` 会报出重复的 `clause` 值：同一个编号出现两次，就无法判断哪一行对应哪一条要求。比较时忽略空白字符，`3.2` 与 ` 3.2 ` 算同一个编号。它只核对唯一性，不判断这两行哪一行是对的；命中通常意味着重复登记，或条款号抄错。 |
| 台账没有写明是哪个项目、哪家投标人。 | `BC-004` 会报出缺失的表头栏，它要求 `project` 与 `bidder` 都存在。这两栏的必要性来自可追溯性——结论若不能对应到具体项目与投标人，事后就无从复核——而不是来自要求台账写表头的条文。 |
| 哪些行必须填写证明材料？ | `BC-005`：凡是 `requirement` 栏文本按包含匹配命中你所填高风险关键词的行。`highRiskKeywords` 出厂为空，所以在填好它之前本条报告「无法执行」，而不是静默通过。它只核对 `evidence` 栏是否填写，不判断证明材料是否真实、是否充分。 |
| 有几行的招标要求栏里还写着【……】或 `待填`。 | `BC-006` 会报出这些行：`requirement` 栏里残留 `【`、`】`、`{{`、`}}`、`XXX`、`待填`、`TBD` 之类的词，通常说明台账是照模板抄的、并没有真正填过。这个词表可以按你自己的模板调整。本条只报出占位符，不判断这条要求本身是否真实。 |

## 依据的标准

| 文件 | 文号 | 引用它的规则 |
|---|---|---|
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正（全国人大常委会《关于修改〈中华人民共和国招标投标法〉、〈中华人民共和国计量法〉的决定》），本法自2000年1月1日起施行 | BC-001, BC-003, BC-004, BC-006 |
| 《中华人民共和国招标投标法实施条例》 | 国务院令第613号（2011 年 12 月 20 日公布，2017 年 3 月 1 日修订，自 2012 年 2 月 1 日起施行） | BC-002 |
| 《中华人民共和国招标投标法》 | 1999年8月30日通过，2017年12月27日修正，自2000年1月1日起施行 | BC-005 |

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

| 项目 | 状态 |
|---|---|
| Harness | 对等版本范围 `>=0.1.2-rc.1 <0.2.0 \|\| >=0.2.0-0 <0.3.0` —— 已实测同时接受 `0.2.0-rc.2` 与 `0.2.1-alpha.1`。**刻意不声明 `engines.dsh`**：它没有任何读取者，也无法拒装任何宿主 |
| Node | `^22.19.0 || >=24.0.0` |
| 平台 | 全平台（纯 ESM；无原生代码、无联网、不调用模型） |
| 工具模式 | `native` / `ptc` / `both` 均可；批量校验整个目录时建议 `ptc`，schema 成本只付一次 |

## What it does

规则表、字段说明与行为细节见 [README.md](README.md#what-it-does)（英文主版本）。本插件只列出材料与所引条款之间的字面差异，并对无法执行的检查在 `skipped` 中逐项说明。

## Install

```sh
dsh plugin --profile <name> add dsh-bid-ca-precheck
dsh --profile <name> --dump-config | grep 'dsh-bid-ca-precheck'
```

## Configuration

全部可调参数都在 `src/config.ts` 的 Schemastery schema 中，只改 `cordis.yml` 即可生效，无需改代码；逐条阈值在 `rules/` 下的规则库文件里。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `rulesFile` | string | `rules/bid-ca-precheck.yaml` | 规则库文件路径，相对插件包根目录 |
| `disabledRules` | string[] | `[]` | 要停用的规则 id 列表；每条都会出现在 `skipped` 中 |
| `onlyRules` | string[] | `[]` | 只执行这些规则 id；留空表示执行全部规则 |
| `skipNotes` | string | `""` | 附加到每条 `skipped` 说明后的备注 |
| `timeoutMs` | number | `120000` | 工具协作式超时预算（毫秒） |

## Material format

支持 JSON 与 YAML。完整字段示例见 [README.md](README.md#material-format)（英文主版本）。字段在读取层是可选的，由检查引擎校验，因此部分导出的材料会产生"缺项"类差异，而不是让程序崩溃。

## Rule sources

规则数据与代码分离，每条规则都带文件名、文号、按原文自身编号体系的条款号、逐字摘录与来源地址。加载期强制：摘录必须是真实引文且不少于八个字符；依据仅为原则性条款（`kind: derived-from-principle`，严重级上限 `warn`）或本机构配置（`kind: institutional-configuration`，上限 `info`）的检查不得标为 `error`。夸大依据的规则库会在加载期失败，而不会产出一份看起来很有底气的报告。

核验中确认的边界与"刻意没有作出的结论"见 [README.md](README.md#rule-sources)（英文主版本）与随包的 `rules/evidence/` 目录。

## Troubleshooting

- **插件装上了但工具不出现**：确认 `main` 指向 `lib/index.mjs` 且 `pnpm run build` 已生成该文件；`main` 写错会让加载器静默跳过该条目。
- **`dsh plugin add` 报版本不兼容**：peer 范围覆盖 `0.1.x` 与 `0.2.x`；若运行时在其之外，可显式豁免：`dsh plugin --profile <name> allow-version <包名@版本> --dsh-version <runtime> --accept-risk`
- **某条规则没有执行**：查看 `skipped` 数组，其中写明了规则 id 与原因。
- **`check` 报 `manifest-peers` 失败**：静态检查器比对的是一份早于 0.2 世代的硬编码 peer 范围；安装期的 peer 校验以运行时为准。这是 `dsh-plugin-dev` 的已知上游问题。
- **时间看起来偏移**：全部计算都是对输入字符串做墙上时钟运算，不做时区换算。

## Development

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
node ../scripts/sync-shared.mjs dsh-bid-ca-precheck
```

第 4 项把 `../_shared` 的共享件同步进 `src/shared/`；每次改动共享件后都要重跑。

## License

[Apache License 2.0](LICENSE) © 2026 dsh-bid-ca-precheck contributors.
