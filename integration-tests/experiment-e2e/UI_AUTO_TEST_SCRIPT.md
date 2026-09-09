# FeatBit UI 自动测试脚本

本脚本的配置目标为七个实验：四个 Bayesian、三个 Bandit。指定测试环境初始化完成后应有 10 个 metric、7 个 feature flag、7 个实验和 1 个 Layer；每个实验只使用一个 Run 1（当前 UI 显示为 `run-1`）。按 2026-09-09 用户最新要求，保留 Healthy，并恢复 Once Bandit 及专用 flag，使三个实验覆盖同一 Layer。

本脚本负责资源配置、调用数据程序、操作 UI 和判断结果。数据参数以 [scenarios.json](./ui-data-runner/scenarios.json) 为准，程序负责注入、入库对账和按实际比例检查分流。概率、置信区间与推荐算法的独立数值核验后续再补。

2026-09-09 新增用户指定的 [2,000 UUID 精确 Binary 数据程序](./BINARY_EXACT_DATA.md)：对 `e2e-scenario-balanced` 各评估一次，然后在实际 true/false 组中按指定人数生成 Binary、Count、Sum 事件。此独立入口默认仅离线预览；它不使用下文 `bayesian-binary/main` 的 800 人概率设计。执行此精确用例时只调用该入口，不同时叠加下文普通或诊断批次。经用户确认，本批已执行并完成逐用户入库对账，实际人数与地址见 [本批执行报告](./reports/binary-exact-20260909/exact-binary/report.md)。

按 2026-09-09 用户更正，七个 flag 的 traffic split 全部配置在 **Default rule → When flag is ON → Rollout percentage**；Targeting rules 和 Individual targeting 均为空。生成器对普通批次和诊断批次都不做 Layer 预筛选，固定全量用户经过 SDK 默认分流后，由分析服务应用 Layer。以下人数设计以这个方式为准；旧报告中的预筛选批次保留为历史证据，不能当作新设计已执行。

配置清单与现有数据覆盖须分别报告：当前数据程序仍包含四个 Bayesian、Sum 和 Average 两个 Bandit，共六个 case；恢复的 Once Bandit 尚未接入该数据程序，也未执行本轮 A/B 数据流程。第 8–14 步的固定批次和人数适用于这六个 case，不能把 Once 的配置恢复或空窗口 Analyze 记为数据测试已通过。

| 步骤 | 内容 | 完成条件 |
| --- | --- | --- |
| 1–6 | 环境、资源初始化与基础 UI 检查 | 绑定、角色、方向和持久化正确 |
| 7–8 | 初始分流、数据程序调用前检查 | 目标、配置、窗口和调用入口就绪 |
| 9 | 四个 Bayesian 的数据与分析 | 样本提示、正向/负向结果、两种护栏方向正确 |
| 10–12 | 两个 Bandit 的两轮数据与分流更新 | 数据 → Analyze → 更新分流 → 新用户 → 再 Analyze |
| 13–14 | 数据回归、截图和报告 | 调用结果与 UI 一致，逐阶段证据完整 |

按用户指定的步骤范围执行；仅初始化时完成第 1–6 步。复用符合配置的对象，缺失时创建；`e2e-bandit-numeric-once-per-user-primary` 及专用 flag `rd-notification-style` 属于保留目标。若此前已经删除，则重建并记录新旧 Experiment / Run / variation ID，不声称恢复了被删除对象的历史分析。其他未列明对象先核对用途并记录差异，不按总数批量删除。报告分别记录配置、UI 回归和数据覆盖，不能因配置齐全而忽略失败或未执行用例。实际 ID、执行进度、缺陷和截图记录在 `reports/<sessionId>/report.md`。

Metrics、Layers、实验配置和 Analyze 使用 Computer Use。Feature flag 配置可使用管理 API，保存后须通过 UI 核验。调用数据程序不替代上述 UI 操作；[REST E2E runner](./TEST_SCRIPT.md) 不是本脚本的数据入口。

## 1. 确认项目、环境和服务

- 项目：`E2E API Project ui-e2e-20260904-1417`；Project key：`e2e-api-ui-e2e-20260904-1417`。
- 环境：`auto-test-001`；组织：`FeatBit`。每次在 UI 页面头部核对。
- 核对七个目标实验与 flag；Once Bandit 和 Healthy 均应保留。已有 Once 配置直接复核，缺失时按第 4–5 步恢复；共享 metrics 复用原定义。
- 按 `.aspire/README.md`，用 `aspire ps --non-interactive` 和 `aspire describe --format Json --non-interactive` 发现本次地址，复用当前会话。测试目标为 `ui`（`modules/front-end`），不要把 `release-decision-web` 比较界面当作本轮验收界面。
- 第 1–6 步要求 `ui`、`api-server` 及其依赖可用，并分别执行 `aspire wait ui --timeout 600 --non-interactive`、`aspire wait api-server --non-interactive`。`evaluation-server` 是后续 SDK 数据步骤的前置条件；仅初始化时记录其状态，不因它缺失而阻断管理 UI 检查。调用数据程序前必须确认其服务和项目/环境与 UI 一致。
- 本次执行使用唯一 sessionId；记录代码版本、时间、步骤范围、原有配置及分析状态。报告和截图不包含凭据。

## 2. 创建并核对 metrics

在 `/en/metrics` 创建或核对以下指标。Name、Key、Description 均为第一列；`guarail` 拼写原样保留。

| Name / Key / Description | Type | Aggregation |
| --- | --- | --- |
| binary-primary-metric | Binary conversion | Once per user |
| numeric-binary-conversion-guarail-metric | Binary conversion | Once per user |
| numeric-count-all-guarail-metric | Numeric value | Count all |
| numeric-count-all-primary-metric | Numeric value | Count all |
| numeric-once-per-user-guarail-metric | Numeric value | Once per user |
| numeric-once-per-user-primary-metric | Numeric value | Once per user |
| numeric-sum-guarail-metric | Numeric value | Sum values |
| numeric-sum-primary-metric | Numeric value | Sum values |
| numeric-average-guarail-metric | Numeric value | Average values |
| numeric-average-primary-metric | Numeric value | Average values |

逐项核对类型、聚合和描述，重新打开表单并刷新列表，确认十个目标指标保留正确。指标方向在第 5 步的实验绑定中配置，不在 Metrics 的指标定义表单中配置；同一 key 被多个实验复用时，不能通过修改共享定义来改变某一个实验的护栏方向。

## 3. 创建并核对 Layer

在 `/en/layers` 创建或核对：

| Name / Key | Assignment Unit | Description |
| --- | --- | --- |
| layer-001 | user.keyId | Shared layer for UI experiment tests |

Bayesian Count 使用 `[0,33)`，Bandit Once 使用 `[33,66)`，Bandit Sum 使用 `[66,100)`；其他四个 Run 不绑定 Layer。三个切片无重叠、无空隙，共占 100%。Run 关联在第 5 步保存后回到 Layers 验证，不能只凭 Layer 描述判断覆盖已完成。

分配条只统计观察窗口覆盖当前时间的 Run。三个窗口均有效时，应显示三个关联、No conflicts、100% reserved、0% free；均已结束时，关联保留，但分配条为 No allocation、0% reserved、100% free。本次用户要求将七个 Run 的窗口终点延至 2026-09-10 16:55（Asia/Shanghai），起点保持 2026-09-09 16:20；验证当前满覆盖，结束后释放分配属于时间规则。

## 4. 创建并核对 feature flags

Name 与 Key 相同；字符串值不含引号。创建可使用管理 API，结果必须通过 UI 刷新确认。

| Name / Key | Type | 实际 variation values |
| --- | --- | --- |
| e2e-scenario-balanced | Boolean | true, false |
| search-ranking | String | algo-a, algo-b |
| ai-assistant-route | String | path-a, path-b |
| e2e-healthy-conversion | Boolean | true, false |
| rd-notification-style | String | style-a, style-b, style-c |
| rd-risk-threshold | String | bar-low, bar-medium, bar-high |
| rd-average-value | String | avg-a, avg-b, avg-c |

记录实际 variation ID/value，后续配置与结果使用该映射。Boolean 的 UI 名称可能是 `True` / `False`，实际值是 `true` / `false`；角色按实际值及其 ID 选择，不按列表位置猜测。确认七个目标 flag 的类型和全部变体正确。仅执行第 1–6 步时，新 flag 保持 OFF；已有 flag 记录当前启用状态，分流与实验采集留到第 7 步配置。恢复已进入数据测试阶段的 Once 时，按第 7 步恢复其初始测试分流，不重置其他 flag 的已应用推荐。

## 5. 配置七个实验及各自唯一的 Run 1

在 `/en/experiments` 逐个按实验全名查找，缺失时通过 New experiment 创建，再依次操作：

1. Exposure 的 Select flag / Change flag 绑定目标 flag；Add metrics / Edit metrics 选择 Primary 和两个 Guardrails，设置方向后 Save metrics。
2. Measuring 的 New run 中选择方法、Control / Baseline 和 Treatment / Arms，并填写必填的 Observation window 起点。新建表单可能默认选中第一个变体；Binary 与 Healthy 必须显式确认 **false 为 Control、true 为 Treatment**。
3. 创建后通过 Edit assignment 配置 Layer、区间、Assignment unit、Analysis sampling 和 Audience filters。新建 Run 对话框不提供这些完整配置项，不能把保存 New run 当作 Layer 已配置。
4. 刷新并重开 Exposure 和 Measuring，确认仍为同一个 `run-1`、相同 Run ID；返回 Layers 核对关联。已有 Run 直接复核，不重新点击 Create run。

| Case ID / 简称 | 实验名称 | Flag | Run type | Control / Baseline | Treatment / Arms | Layer slice |
| --- | --- | --- | --- | --- | --- | --- |
| bayesian-binary / Binary | e2e-bayesian-binary-primary | e2e-scenario-balanced | Bayesian A/B/n | false | true | 无 |
| bayesian-count / Count | e2e-bayesian-numeric-count-all-primary | search-ranking | Bayesian A/B/n | algo-a | algo-b | [0,33) |
| bayesian-average / Bayesian Average | e2e-bayesian-numeric-average-primary | ai-assistant-route | Bayesian A/B/n | path-a | path-b | 无 |
| bayesian-healthy / Healthy | e2e-bayesian-numeric-once-per-user-primary | e2e-healthy-conversion | Bayesian A/B/n | false | true | 无 |
| bandit-once / Once（当前仅配置） | e2e-bandit-numeric-once-per-user-primary | rd-notification-style | Bandit | style-a | style-b, style-c，均勾选 | [33,66) |
| bandit-sum / Sum | e2e-bandit-numeric-sum-primary | rd-risk-threshold | Bandit | bar-low | bar-medium, bar-high，均勾选 | [66,100) |
| bandit-average / Bandit Average | e2e-bandit-numeric-average-primary | rd-average-value | Bandit | avg-a | avg-b, avg-c，均勾选 | 无 |

| Case ID | Primary | Guardrail 1 | Guardrail 2 |
| --- | --- | --- | --- |
| bayesian-binary | binary-primary-metric | numeric-count-all-guarail-metric | numeric-sum-guarail-metric |
| bayesian-count | numeric-count-all-primary-metric | numeric-binary-conversion-guarail-metric | numeric-once-per-user-guarail-metric |
| bayesian-average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-count-all-guarail-metric |
| bayesian-healthy | numeric-once-per-user-primary-metric | numeric-average-guarail-metric | numeric-binary-conversion-guarail-metric |
| bandit-once | numeric-once-per-user-primary-metric | numeric-binary-conversion-guarail-metric | numeric-count-all-guarail-metric |
| bandit-sum | numeric-sum-primary-metric | numeric-once-per-user-guarail-metric | numeric-sum-guarail-metric |
| bandit-average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-binary-conversion-guarail-metric |

所有 Primary 使用 Higher is better。所有 Guardrails 使用 Increase is bad，只有 **Healthy 的 Guardrail 2 使用 Decrease is bad**。

| 含义 | 护栏编辑框选择 | Exposure 显示 | 分析结果方向 |
| --- | --- | --- | --- |
| 下降更好（decrease is better） | Alert if → Increases | Increase is bad | Lower is better |
| 上升更好 | Alert if → Decreases | Decrease is bad | Higher is better |

“下降更好”与“下降时告警”含义相反，不可选错。Healthy 中一个护栏下降、另一个上升，预期都改善；与 Bayesian Count 共用的 Binary metric 在两个实验中使用相反方向，刷新后必须各自正确保留。

Assignment unit 为 `user.keyId`；各选中变体 analysis sampling 为 100%；不添加额外 Run audience filters。核对 flag、三个 metric 的类型/聚合/方向、方法、角色、Layer 和 sampling。已有 Run 若与目标不符，先记录差异，不为凑齐清单重复创建 Run 或覆盖历史分析。

新建 Run 的窗口可先使用当前本地时间、No fixed end，并记录时区；第 8 步发送数据前再设定隔离窗口。仅初始化时不点击 Analyze latest data，不要求已有分析被清空。没有分析的新 Run 可显示 No evaluable data / Window: Not recorded，这不代表配置窗口未保存；以 Observation window 编辑入口的回显为准。当前 UI 没有最低样本数设置入口，第 8 步的每变体 500 人门槛不能计为本步骤已完成配置。

## 6. 初始化期间的其他 UI 测试

以下用例逐项记录；新建与编辑、Bayesian 与 Bandit 的角色校验分别判定，不能互相代替。

| Case | 操作与通过条件 |
| --- | --- |
| 6.1 必填与固定聚合 | 空的 New metric、New layer、New experiment 禁止创建；Binary aggregation 固定为禁用的 Once per user。另在未保存的 New run 草稿清空 Start date and time 后提交，必须提示必填且不产生 Run；不要求该按钮一定事先禁用。 |
| 6.2 搜索恢复 | 搜索不存在的 metric，等待显示 No metrics match your search；Clear search 或实际清空输入后恢复十个目标指标。不能把搜索防抖期间的旧列表当作最终结果。 |
| 6.3 回显与取消 | 重开指标编辑表单并刷新，类型、聚合、描述保持；临时修改名称或描述后 Cancel，原值保持。实验方向在 Exposure 刷新及 Edit metrics 回显中核对。 |
| 6.4 指标去重 | 已选 Primary 不能再作为 Guardrail；已选 Guardrail 不能再选为另一项。核对被禁用的具体 metric key。 |
| 6.5 新建 Run 空选 | 分别打开 Bayesian、Bandit 的 New run 草稿，确认唯一 Control / Baseline；逐项取消所有 Treatment / Arms。最后一项必须保持未勾选，Create run 应禁用，不能自动重新勾选。只检查草稿，不提交角色负例。 |
| 6.6 编辑 Run 空选 | 分别在已有 Bayesian、Bandit 的 Edit assignment 取消所有 Treatment / Arms，Save changes 应禁用且空选保持；Cancel 后原有配置保持。 |
| 6.7 取消草稿 | 取消所有未保存的 New run 草稿；刷新后目标实验仍只有原 Run 1、原 Run ID，没有额外 Run。 |
| 6.8 Bandit 与 Layer | 三个 Bandit 的两个 Arms 均保留；Layers 有 Count、Once、Sum 三个 Run 关联，依次为 `[0,33)`、`[33,66)`、`[66,100)`。三个观察窗口都覆盖当前时间时为 No conflicts、100% reserved、0% free；均已结束时为 No allocation，关联仍在。展开 Show more 核对全部三个关联，再收起 Show less。配置满覆盖与 SDK 三实验互斥数据验证分别判定。 |
| 6.9 按实验筛选 Metrics | 对七个实验分别输入完整名称，等待筛选完成，恰好返回对应的三项 metric。共享指标行仍可能展示其他实验，需展开 Show more 后核对**目标实验**的一个 Primary、两个 Guardrails 和 `run-1`，不要求隐藏其他关联。 |
| 6.10 最终清单与方向隔离 | 清空筛选并刷新列表：七个实验为四个 Bayesian、三个 Bandit，每个只有一个 `run-1`；逐项核对完整名称。七个目标 flag 活动，十个共享 metrics 保留；重建 Once 时记录新 ID，不能保留重复对象或旧 Run 关联。保存 Healthy 的 Binary 护栏后，刷新 Count 与 Healthy：同一 key 分别保持 Increase is bad、Decrease is bad。 |

截至 2026-09-09 的 UI 复核，6.5 在 Bayesian 和 Bandit 新建表单均存在“取消最后一项后自动重新勾选”的缺陷（`RUN-EMPTY-SELECTION-001`，旧报告 F01）；6.6 的编辑表单可正确阻止空选保存。重测仍出现时记 FAIL，保留取消前后的选中状态，不把旧报告的通过数量沿用到当前执行，也不把自动全选改成预期行为。按目标选择完整变体的 Run 配置可单独通过。

## 7. 配置初始 feature flag 分流并截图

1. 备份七个目标 flag 的启用状态、规则、默认返回、revision、变体映射和实验采集配置。
2. 清空这七个测试 flag 的 Targeting rules 与 Individual targeting。只在 Default rule → When flag is ON 选择 Rollout percentage，按 `keyId` 分流；开启默认分流的实验采集，所有变体采集 100%（管理 API：`fallthrough.includedInExpt=true`、各项 `exptRollout=1`）。不添加测试专用属性条件。
3. 启用目标 flag，新一轮测试使用下表初始分流。迁移已有测试现场时，把当前生效比例移到默认分流，保留已应用的 Bandit 推荐比例、变体映射及 OFF 返回值。打开 Targeting、刷新核对默认比例、No rules yet 和 No users added，并保存截图及配置 JSON。
4. 将三个 Bandit 的初始分流记录为 A 配置；Layer 和 analysis sampling 沿用第 5 步。中途恢复 Once 时只配置它的初始分流，保留 Sum、Average 已应用的阶段 B 配置及证据。

| Flag | 初始分流 |
| --- | --- |
| e2e-scenario-balanced | false 50%，true 50% |
| search-ranking | algo-a 50%，algo-b 50% |
| ai-assistant-route | path-a 50%，path-b 50% |
| e2e-healthy-conversion | false 50%，true 50% |
| rd-notification-style | style-a 70%，style-b 15%，style-c 15% |
| rd-risk-threshold | bar-low 70%，bar-medium 15%，bar-high 15% |
| rd-average-value | avg-a 70%，avg-b 15%，avg-c 15% |

通过条件：目标及变体映射正确，默认比例总和 100%，flag 和默认实验采集已启用，没有 targeting rules 或个人定向覆盖，刷新后保持。截图：`07-<flag>-initial-targeting`，规则区不在同一屏时补图。UI 可能以整数显示比例，精确权重以同一 revision 的配置 JSON 为准。

## 8. 调用数据程序并检查前置条件

使用 [run-ui-experiment-data.ps1](./run-ui-experiment-data.ps1) 统一入口。复制 [config.example.json](./ui-data-runner/config.example.json) 为同目录的 `config.local.json`，填写当前服务地址；凭据通过 `FEATBIT_UI_ACCESS_TOKEN` 或 `FEATBIT_UI_LOGIN_EMAIL` / `FEATBIT_UI_LOGIN_PASSWORD` 进程环境变量提供。检查本次业务环境的 preflight 报告；前置条件不满足时，将依赖步骤记为 BLOCKED。

从仓库根目录设置本次调用参数并检查目标：

```powershell
$runner = ".\integration-tests\experiment-e2e\run-ui-experiment-data.ps1"
$testSession = "<session-id>"
& $runner -SessionId $testSession -Action preflight
```

核对返回报告中的项目/环境、六个 case、对象 ID、指标方向、默认分流、窗口和服务状态。preflight 须拒绝任何 targeting rule、个人定向或默认曝光采集不完整的配置，并使用没有测试定向属性的用户确认 SDK 已同步。通过 UI 保存本次观察窗口，排除历史数据；窗口起点覆盖本次首次曝光，采集期间终点保持开放。保存空窗口 Analyze 的结果，确认没有把历史数据当成本轮样本。

| Case ID | 单批 / A 发送人数 | B 新用户发送人数 | 累计发送人数 | 预计分析样本（Layer 后） | 预计初始分析分组 |
| --- | ---: | ---: | ---: | --- | --- |
| bayesian-binary | 800 | — | 800 | 800 | 400 / 400 |
| bayesian-count | 2,000 | — | 2,000 | 约 660（33%） | 约 330 / 330 |
| bayesian-average | 5,000 | — | 5,000 | 5,000 | 2,500 / 2,500 |
| bayesian-healthy | 3,000 | — | 3,000 | 3,000 | 1,500 / 1,500 |
| bandit-sum | 2,000 | 3,000 | 5,000 | A 约 680，B 约 1,020，累计约 1,700（34%） | A 约 476 / 102 / 102 |
| bandit-average | 3,000 | 5,000 | 8,000 | 8,000 | A：2,100 / 450 / 450 |

主批次计划固定发送 **23,800 名用户**，Layer 后预计约 19,160 个分析样本（假设全部按计划发送、曝光入库、窗口及 sampling 不再排除用户）。表中乘以 slice 宽度的数字是理论期望，不能当成精确断言；精确人数由固定 user key、实际曝光和 Layer hash 决定。两个 Bandit 的前 150 名发送用户包含在 A 内，Sum 另有累计发送 600 人检查点；不按 Layer 或变体补人。

生成器先固定连续的全量 user key，不依据 Layer hash、slice、变体或分析结果筛人；所有用户都调用 SDK 默认分流并产生对应事件。Layer 资格只用于发送后的账本预期计算，服务端实际人数另行查询对账。默认 50/50 是全量用户的变体分配，与 Layer 的 33% 入选范围分别校验。

每批 `population.json` 必须分别记录实际发送人数、同一窗口内不考虑 Layer 的账本去重曝光人数、预计 Layer 内人数、预计排除人数，以及 `verify` 查询得到的带 Layer / 不带 Layer 实际累计人数；同时区分本批和累计。程序用相同 flag、用户池、窗口查询服务端的两套统计并对账，无 Layer 对照原始响应保存在 `observed-without-layer.json`，查询不修改 Run 配置。B 的增量实际统计另见 `increment.json`。不能把先筛出的 2,000 人与 2,000 名原始用户混为一谈，也不能只看 UI 总数接近就认定 Layer 无效。

生成方式已升级为 session/receipt formatVersion 2，`userPoolPolicy=unfiltered-default-split-v1`。开始新一轮数据测试须使用新 sessionId，旧批次的原始数据、窗口、收据和截图保留；迁移默认分流本身不会重写旧样本，也不代表新批次已经执行。

Bayesian 样本门槛用例以每变体 500 人为目标；800 人必有一组不足。当前 UI 没有最低人数设置入口：已配置为 500 时检验不足/通过；未配置时应显示未设置最低人数，将指定门槛用例记为前置缺口，继续其他用例。不能仅凭总人数认定样本充足，也不能把样本通过当作效果明确。

各数据步骤调用以下两个命令，分别用于注入和入库对账。以表中的 Case ID 与 Batch ID 替换占位符；随后通过 UI Analyze、判断结果并截图：

```powershell
& $runner -SessionId $testSession -Action inject -Case "<case-id>" -Batch "<batch-id>"
& $runner -SessionId $testSession -Action verify -Case "<case-id>" -Batch "<batch-id>"
```

读取命令的状态、收据和差异报告。注入完成不等于入库完成；入库完成不等于已经重新分析。发送状态不确定时停止重试并保留证据；命令返回成功也不能代替 UI 断言。

## 9. Bayesian：调用、Analyze 与结果判断

四个 Bayesian 的 Batch ID 均为 `main`。下表数字是理论均值或触发率，顺序为 Control / Treatment；精确统计以程序的预期/实际对账为准。

| Case ID | Primary | Guardrail 1 | Guardrail 2 | 预期业务结果 |
| --- | --- | --- | --- | --- |
| bayesian-binary | 转化率 30% / 31% | Count：0.10 / 0.10 | Sum：10 / 8 | 800 人、小差异，效果可能不明确；样本提示按实际门槛判断 |
| bayesian-count | Count：2 / 3 | Binary：2% / 12% | Numeric Once：3% / 3% | 主指标改善，但 Binary 护栏恶化 |
| bayesian-average | Average：50 / 45 | Average：4 / 3 | Count：0.10 / 0.30 | 主指标下降，一项护栏改善、一项恶化 |
| bayesian-healthy | Numeric Once：30% / 45% | Average：4 / 2，下降更好 | Binary：60% / 80%，上升更好 | 样本较充分，主指标和两项护栏均改善 |

每个实验依次执行：

1. 保存注入前页面和分析时间；调用 `inject`，再调用 `verify`。
2. 核对新增/累计人数及三个指标的统计；数据对账失败时记录差异，不继续把分析当成通过。
3. 在现有 Run 1 点击 Analyze，等待完成及 computed_at 更新；截图主指标、样本提示和两个护栏。
4. 在 UI 核对分析人数、指标均值、方法、角色和方向；人数与均值应与数据报告一致。记录概率和区间的显示结果，其独立数值重算暂缓。
5. Healthy 必须单独检查：Primary 正向、Average 下降被判为改善、Binary 上升也被判为改善；两项 P(harm) 和护栏结论应支持正向结果，不能只因“未报警”就通过。若结果不符合，按真实数据和验证报告定位，不重新抽数。
6. Count / Average 中预设的负向业务结果应被正确显示；稳定护栏可能为 inconclusive，不强求 clear。
7. 刷新后确认配置与结果保留；每次分析立即保存快照，避免后续诊断覆盖。

截图：`09-<case>-before-data`、`09-<case>-data-ready`、`09-<case>-analysis-primary`、`09-<case>-analysis-guardrails`、`09-<case>-after-refresh`。

## 10. Bandit：第一批数据与分析

两个 Bandit 按 Baseline / Arm 1 / Arm 2 判断：

| Case ID | Primary | Guardrail 1 | Guardrail 2 | A 的测试目的 |
| --- | --- | --- | --- | --- |
| bandit-sum | Sum：10 / 14 / 18，含少量大值 | Numeric Once：4% / 2% / 2% | Sum：1 / 1 / 1 | 多事件求和和不确定性；护栏没有预设恶化，可进入下一阶段 |
| bandit-average | Average：50 / 65 / 57.5 | Average：4 / 3 / 3 | Binary：3% / 2% / 2% | avg-b 表现最好，检查三臂结果和推荐 |

1. 保存初始 Targeting、Measuring 和 A 配置就绪报告。
2. 两个 case 各调用 `inject -Batch a-150`，完成数据对账、UI Analyze、结果检查和截图。三个变体不可能同时达到 100 人；预期未完成 burn-in，不显示有效推荐，不更新分流。
3. Sum 调用 `inject -Batch a-600` 并重复检查。累计发送 600 人，Layer 后预计约 204 人，三组约 142.8/30.6/30.6；不再把它命名为 100 人门槛附近的检查点，ready 按实际组人数判断。
4. 各调用 `inject -Batch a-full`，Sum 累计发送 2,000 人（预计 Layer 内约 680），Average 发送 3,000 人。先对账并截图数据就绪状态，再 UI Analyze；完整保存 A 的结果。
5. 检查三个变体均参与，ready 与各组人数是否都达到 100 一致。记录 P(best)、推荐权重、停止提示和护栏；停止提示应符合样本已就绪且页面 P(best) 达到 0.95 的条件。概率和推荐算法的独立数值核验暂缓。
6. 若实际仍有组不足或数据异常，阻断该 case 后续更新，不为通过而补齐某组人数。Sum A 的两小组期望仅约 102，可能不足 100；届时第 11–12 步记 BLOCKED，不能把后续 B 的计划人数写成已发送。

截图：`10-<case>-burn-in-150`、`10-bandit-sum-sent-600`、`10-<case>-phase-a-data-ready`、`10-<case>-phase-a-analysis-primary`、`10-<case>-phase-a-analysis-guardrails`。

## 11. Bandit：应用推荐分流并截图

1. A 的数据、分流对账须先通过，UI 分析结果已检查并截图，burn-in 完成；出现非预期护栏告警时记录并阻断该实验更新。稳定护栏的 inconclusive 可继续本测试的预定探索，但不能写成已证明安全。
2. 从刚保存的 A 分析读取真实推荐比例，按实际 variation ID 更新 Default rule → When flag is ON 的分流；不添加 targeting rule，不手写理想比例。Baseline 与两个 Arms 均参与。
3. 保存后在 Targeting 刷新，确认默认比例与推荐及其舍入一致、总和 100%、各变体非零，Targeting rules 和 Individual targeting 仍为空；截图更新结果。
4. 保存 B 的配置与生效确认报告。程序检查 A 分析的新鲜度、实际分流与该次推荐一致，再确认 SDK 配置生效；B 收据保留使用的 A 分析快照。这些是发送前置检查，不代表推荐算法已通过独立数值核验。

Analyze 本身不等于已经修改分流。P(best) 与推荐比例含义不同，不要求两者相等。截图：`11-<case>-updated-targeting`；未满足前置条件时保存 `11-<case>-update-blocked`。

## 12. Bandit：第二批新用户与再次分析

满足第 11 步条件的 case 调用 `inject -Batch b`；Sum 发送 3,000 名新用户（Layer 内预计约 1,020），Average 发送 5,000 名新用户。

| Case ID | B 的 Primary | B 的 Guardrail 1 | B 的 Guardrail 2 | 检查重点 |
| --- | --- | --- | --- | --- |
| bandit-sum | 仍为 10 / 14 / 18 | 4% / 2% / 15% | 1 / 1 / 4 | bar-high 的两项护栏在 B 恶化；观察累计风险，不继续放量 |
| bandit-average | 50 / 65 / 85 | 仍为 4 / 3 / 3 | 仍为 3% / 2% / 2% | avg-c 的新用户表现改善，累计证据与推荐应随重新分析更新 |

1. 完成 B 数据对账，分别核对 B 和 A+B。Sum 累计发送 5,000 人、Layer 内预计约 1,700，Average 累计发送并纳入 8,000 人；精确样本数与回执和查询对账，确认都是新用户，A 没有重复计入。
2. Analyze 前截图并记录旧 computed_at；调用后的数据回执与当时页面分别标明。
3. 通过 UI 再 Analyze，检查并保存三个变体的人数、主指标、P(best)、推荐、停止提示和两个护栏。
4. 累计人数与指标均值应与程序的 A+B 数据报告一致，不能直接等于 B 的目标均值。B 实际分流与保存配置一致。
5. 第二轮只观察结果，不自动应用下一轮推荐。Sum 的护栏风险应被报告；测试停止继续放量，不声称产品已自动拦截。
6. 刷新后确认仍为同一个 Run 1，方向、角色和分析结果保留。

截图：`12-<case>-phase-b-data-ready`、`12-<case>-phase-b-analysis-primary`、`12-<case>-phase-b-analysis-guardrails`、`12-<case>-after-refresh`。

## 13. 数据回归与独立诊断

### 13.1 对账与 SRM

- 每个 metric 的用户数、转化人数、均值/累计值及其类型，与程序的精确预期/实际对账一致；多事件、零值、重复事件和无事件用户均有覆盖。
- 页面 SRM、程序按阶段实际默认比例的分流校验、Layer 纳入人数及精确采集计数分别记录。70/15/15 应对 Layer 内分析样本按该比例校验，不按三组等量判断；不能用全量发送人数代替分析人数。
- 当前产品可能因等量假设误报 SRM；现场复现记为 `SRM-DYNAMIC-001`，保留原始页面和程序报告，对应 UI 用例记 FAIL。已有问题不能掩盖真实漏报。
- 比较 A、B、A+B 与分析时间，检查旧结果、串批和重复计数。具体校验算法由独立程序负责。

### 13.2 调用诊断批次并判断

先保存主批次的完整分析与封闭窗口。以下共 412 名额外诊断用户使用独立窗口，不改变第 8 步主批次人数；按回执通过 UI 选择窗口、Analyze、对账和截图。全部结束后默认恢复主窗口并重新 Analyze。当前产品使用同一个 Observation window 计算分析范围和 Layer 的有效占用时间；固定窗口已经结束时，Layers 分配条释放占用，Run 关联和历史分析保留。若用户明确要求延长窗口（本次为 2026-09-10 16:55），先保留主批次截图及 JSON，再通过 UI 修改并重新 Analyze；扩展窗口会包含诊断数据，报告必须分列原主批次与扩展窗口人数，不重放已有数据。

| Batch ID | Case ID / 范围 | 预期数据与 UI 判断 |
| --- | --- | --- |
| probe-zero-events | 六个 case 各调用一次 | 各发送 32 人，有曝光、无指标；没有 Layer 的 case 分析为 32 人，Count/Sum 只纳入 slice 内人数，以账本精确值为准。重复曝光不增加去重样本；指标为零，与没有曝光的空状态区分 |
| probe-zero-control | bayesian-binary | 64 人，Control 转化为 0、Treatment 全转化；相对效果不可计算时显示原因，不出现 NaN/Infinity |
| probe-constant | bayesian-average | 64 人，Primary 恒 50、Average 护栏恒 4、Count 护栏每人 1 次；完全持平应为零提升，P(win)=0.5，图表正常 |
| probe-attribution | bayesian-count | 固定发送 32 人；不考虑 Layer 时，窗口内 conversions=16、Count 总值=24、平方和=40。实际分析仅纳入 slice 内用户，对这部分重新算精确预期；曝光前和窗口外的事件不能混入 |
| probe-layer | layer-isolation（诊断标识） | 当前程序对 60 人共同池只发送 Count、Sum 两个 flag 的曝光，检查这两个 Run 每人最多进入一个。Once 恢复后，[33,66) 已有配置占用，但历史探针没有它的曝光；不能把中间切片的候选人数当成 Once 实际样本，也不能声称三个 Run 的数据互斥已通过。三实验数据验证须先扩展数据程序，再用新的共同用户池执行 |

使用第 8 步命令，填入上表 Case ID / Batch ID；`layer-isolation` 返回两个目标 Run 的独立结果，分别在 UI 验证。某组没有用户时记录实际零样本分支，不按变体补人。

精确的 99/100/101、499/500/501 人数边界与分析计算器的独立数值核验后续再补，本轮不计为已覆盖的 UI 用例。

### 13.3 全量用户的 Layer 人数对照

不能用历史预筛选批次证明 Layer 对全量用户的比例。需要复核同一实验在 slice 与 100% 下的人数时，使用独立的 `probe-layer-population` 诊断批次，固定发送 5,000 名连续 user key 的新用户，不按 Layer 或变体筛人，不补人。它不计入第 8 步主批次或第 13.2 步的 412 人；必须使用新 sessionId，单独报告。

1. 备份原分析、窗口和 assignment；保留当前默认分流，确认没有 rules 或个人定向。此诊断沿用该 case 的 A 指标分布，只检验采集、Layer 纳入和统计，不作为 Bandit B 阶段的延续。
2. 对绑定 Layer 的 case 调用 `inject -Batch probe-layer-population`，再 `verify`。所有 5,000 人均经过真实 SDK；核对同一窗口的带 Layer / 不带 Layer 服务端原始响应和精确账本。
3. 通过 UI 把观察起点设为新批次回执的 WindowStart，排除原预筛选数据。一般使用回执的独立窗口；用户要求终点保持明天时可保留该终点，并核对期间没有额外数据。保存后重新打开或刷新确认起点；Analyze 后还要核对结果的 Window，不能仅凭保存提示判定成功。
4. 在原 Layer slice 下 Analyze 并保存样本、窗口、Layer 和时间截图；再切到事先核实无冲突的 `layer-empty` `[0,100)`，保持同一窗口重新 Analyze 并截图。只切配置和重算，不再发送第二批用户。
5. 100% 时应为 5,000 人；33% 约 1,650，34% 约 1,700，精确人数与固定用户池的 Layer hash 和服务端结果一致。按总样本核对，不要求每个变体比例与理论值完全相等。
6. 恢复原 Layer slice 并重新 Analyze，最终页面展示这批未预筛用户的结果；原窗口、旧统计与截图在报告中保留，可回看历史。若其他实验仍显示原数据，明确区分各自批次，不声称它们也已重跑。

截图：`13-layer-population-before`、`13-layer-population-slice`、`13-layer-population-full`、`13-layer-population-restored`。报告把两次 UI 样本数与相同的 5,000 名用户回执并列展示。

## 14. 截图与报告

两个 Bandit 均保留以下六阶段证据，并附 150 人检查点，Sum 另附 600 人检查点：

| 阶段 | 必须保留的证据 |
| --- | --- |
| 初始分流 | Default rule 的变体、比例、启用状态，以及空 Targeting rules / Individual targeting |
| 第一批数据 | 数据就绪页面、A 收据及对账；标明页面是否仍为旧分析 |
| 第一次 Analyze | 人数、Primary、推荐、护栏、computed_at |
| 更新分流 | 刷新后的 Targeting 和配置生效报告 |
| 第二批新用户 | B 与 A+B 收据和对账；标明当时分析时间 |
| 再次 Analyze | 累计人数、推荐变化、护栏变化和刷新结果 |

四个 Bayesian 保留注入前、数据就绪、Primary、Guardrails 和刷新后的证据；Healthy 明确展示两种方向均判为改善。诊断窗口与恢复后的主结果另存截图。

截图必须由 Computer Use 取得，并实际保存到本次报告目录的 `screenshots/`；长页面分图时保持同一分析时间。开始测试时先确认至少一张截图可落盘，之后在各检查点及时保存，报告内联展示图片并链接原图。仅在对话中展示图片、记录观察编号，不算完成截图归档。

若工具只返回内联图片，先检查当前任务会话是否保留原始图片载荷，并将原图直接导出；记录原工具时间、调用标识和图片校验值。工具附带的页面缩略图可能缓存旧状态，不得未经核验充当检查点截图。历史图片无法取得时，将对应截图交付标为 BLOCKED；不能重放用户数据、修改历史结果或制作图片来假装原始证据。

页面若不展示实时统计，附程序报告并标明来源，不能用自制图冒充 UI。Bandit 证据应按初始分流、A 数据、第一次 Analyze、实际调整、B 新用户、再次 Analyze 排列，把每阶段的截图与对应收据、统计和配置版本放在一起。交付前检查图片可解码、全部图片/数据链接有效；只链接真实保存的文件。

报告目录：`integration-tests/experiment-e2e/reports/<sessionId>/`。`report.md` 内联展示截图，链接每批数据收据、对账、分析和分流快照，并记录时间、对象 ID、URL、配置版本及失败说明。

| Case / Step | 输入与操作 | 预期 | 实际 | PASS / FAIL / BLOCKED / SKIPPED | 证据 |
| --- | --- | --- | --- | --- | --- |
| 执行时填写 | 实际调用与 UI 操作 | 本脚本断言 | 现场观察 | 不得预填 PASS | 截图及程序报告 |

只有执行且断言满足的用例记 PASS；数据、UI、方向、动态分流和 SRM 分别判定。前置条件失败时保留阻断现场，后续依赖步骤记 BLOCKED。保留测试数据和 Aspire 会话，不创建额外 Run 或提交上线决定。
