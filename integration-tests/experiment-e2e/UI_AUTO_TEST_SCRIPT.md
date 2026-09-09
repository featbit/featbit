# FeatBit UI 自动测试脚本

本脚本验证六个实验：四个 Bayesian、两个 Bandit。测试资源包括 10 个 metric、6 个 feature flag 和 1 个 Layer；每个目标实验只使用一个 Run 1。

本脚本负责资源配置、调用数据程序、操作 UI 和判断结果。数据参数以 [scenarios.json](./ui-data-runner/scenarios.json) 为准，程序负责注入、入库对账和按实际比例检查分流。概率、置信区间与推荐算法的独立数值核验后续再补。

| 步骤 | 内容 | 完成条件 |
| --- | --- | --- |
| 1–6 | 环境、资源初始化与基础 UI 检查 | 绑定、角色、方向和持久化正确 |
| 7–8 | 初始分流、数据程序调用前检查 | 目标、配置、窗口和调用入口就绪 |
| 9 | 四个 Bayesian 的数据与分析 | 样本提示、正向/负向结果、两种护栏方向正确 |
| 10–12 | 两个 Bandit 的两轮数据与分流更新 | 数据 → Analyze → 更新分流 → 新用户 → 再 Analyze |
| 13–14 | 数据回归、截图和报告 | 调用结果与 UI 一致，逐阶段证据完整 |

按用户指定的步骤范围执行；仅初始化时完成第 1–6 步。复用符合配置的对象，缺失时创建；本表范围外的已有对象保留，资源数量检查以目标清单为准。实际 ID、执行进度、缺陷和截图记录在 `reports/<sessionId>/report.md`。

Metrics、Layers、实验配置和 Analyze 使用 Computer Use。Feature flag 配置可使用管理 API，保存后须通过 UI 核验。调用数据程序不替代上述 UI 操作；[REST E2E runner](./TEST_SCRIPT.md) 不是本脚本的数据入口。

## 1. 确认项目、环境和服务

- 项目：`E2E API Project ui-e2e-20260904-1417`；Project key：`e2e-api-ui-e2e-20260904-1417`。
- 环境：`auto-test-001`；组织：`FeatBit`。每次在 UI 页面头部核对。
- Aspire 参考地址：`https://localhost:61611/`；UI 参考地址：`http://localhost:61612/`。按 `.aspire/README.md` 确认本次实际地址，并复用当前会话。
- 确认 `ui`、`api-server`、`evaluation-server` 及其依赖可用；数据程序的目标必须与 UI 一致。
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

逐项核对类型、聚合和描述，重新打开表单并刷新列表，确认十个目标指标保留正确。

## 3. 创建并核对 Layer

在 `/en/layers` 创建或核对：

| Name / Key | Assignment Unit | Description |
| --- | --- | --- |
| layer-001 | user.keyId | for 3 experimentations |

本剧本中 Bayesian Count 使用 `[0,33)`，Bandit Sum 使用 `[66,100)`，其他目标 Run 不绑定 Layer。核对两个目标 Run 的切片无重叠；Layer 中可能存在其他已有 Run，按实际关联清单检查占用和冲突，不强求关联总数等于本轮实验数。

## 4. 创建并核对 feature flags

Name 与 Key 相同；字符串值不含引号。创建可使用管理 API，结果必须通过 UI 刷新确认。

| Name / Key | Type | 实际 variation values |
| --- | --- | --- |
| e2e-scenario-balanced | Boolean | true, false |
| search-ranking | String | algo-a, algo-b |
| ai-assistant-route | String | path-a, path-b |
| e2e-healthy-conversion | Boolean | true, false |
| rd-risk-threshold | String | bar-low, bar-medium, bar-high |
| rd-average-value | String | avg-a, avg-b, avg-c |

记录实际 variation ID/value，后续配置与结果使用该映射。确认六个目标 flag 的类型和全部变体正确。

## 5. 配置六个实验及各自唯一的 Run 1

在 `/en/experiments` 依次操作：Exposure 绑定 flag、Primary 和两个 Guardrails，并设置方向；Measuring 创建或核对 Run 1；保存并刷新两处页面。

| Case ID / 简称 | 实验名称 | Flag | Run type | Control / Baseline | Treatment / Arms | Layer slice |
| --- | --- | --- | --- | --- | --- | --- |
| bayesian-binary / Binary | e2e-bayesian-binary-primary | e2e-scenario-balanced | Bayesian A/B/n | false | true | 无 |
| bayesian-count / Count | e2e-bayesian-numeric-count-all-primary | search-ranking | Bayesian A/B/n | algo-a | algo-b | [0,33) |
| bayesian-average / Average | e2e-bayesian-numeric-average-primary | ai-assistant-route | Bayesian A/B/n | path-a | path-b | 无 |
| bayesian-healthy / Healthy | e2e-bayesian-numeric-once-per-user-primary | e2e-healthy-conversion | Bayesian A/B/n | false | true | 无 |
| bandit-sum / Sum | e2e-bandit-numeric-sum-primary | rd-risk-threshold | Bandit | bar-low | bar-medium, bar-high，均勾选 | [66,100) |
| bandit-average / Average | e2e-bandit-numeric-average-primary | rd-average-value | Bandit | avg-a | avg-b, avg-c，均勾选 | 无 |

| Case ID | Primary | Guardrail 1 | Guardrail 2 |
| --- | --- | --- | --- |
| bayesian-binary | binary-primary-metric | numeric-count-all-guarail-metric | numeric-sum-guarail-metric |
| bayesian-count | numeric-count-all-primary-metric | numeric-binary-conversion-guarail-metric | numeric-once-per-user-guarail-metric |
| bayesian-average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-count-all-guarail-metric |
| bayesian-healthy | numeric-once-per-user-primary-metric | numeric-average-guarail-metric | numeric-binary-conversion-guarail-metric |
| bandit-sum | numeric-sum-primary-metric | numeric-once-per-user-guarail-metric | numeric-sum-guarail-metric |
| bandit-average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-binary-conversion-guarail-metric |

所有 Primary 使用 Higher is better。所有 Guardrails 使用 Increase is bad，只有 **Healthy 的 Guardrail 2 使用 Decrease is bad**。

| 含义 | 护栏编辑框选择 | Exposure 显示 | 分析结果方向 |
| --- | --- | --- | --- |
| 下降更好（decrease is better） | Alert if → Increases | Increase is bad | Lower is better |
| 上升更好 | Alert if → Decreases | Decrease is bad | Higher is better |

“下降更好”与“下降时告警”含义相反，不可选错。Healthy 中一个护栏下降、另一个上升，预期都改善；与 Bayesian Count 共用的 Binary metric 在两个实验中使用相反方向，刷新后必须各自正确保留。

Assignment unit 为 `user.keyId`；各选中变体 analysis sampling 为 100%；不添加额外 Run audience filters。核对 flag、三个 metric 的类型/聚合/方向、方法、角色、Layer 和 sampling。已有 Run 若与目标不符，先记录差异，不为凑齐清单重复创建 Run 或覆盖历史分析。

## 6. 初始化期间的其他 UI 测试

- 空必填项不能创建；Binary aggregation 固定为 Once per user。
- 搜索不存在的 metric 显示空状态；清空搜索恢复列表。
- 重开表单与刷新后类型、聚合、描述和方向保持；取消编辑不改变记录。
- Primary / Guardrails 不能重复选择同一 metric。
- 新建和编辑 Run 必须选择 Control / Baseline 和至少一个 Treatment / Arm；取消最后一项后应阻止空选保存，不能自动重新勾选。取消草稿不产生额外 Run。
- 两个 Bandit 的两个 Arms 均保存；Layer 的两个目标 Run 关联与切片正确，展开/收起正常。
- 按实验筛选 metrics，显示一个 Primary 和两个 Guardrails。
- 六个目标实验为四个 Bayesian、两个 Bandit，每个只有一个 Run 1；相同 metric key 的不同实验方向互不影响。

## 7. 配置初始 feature flag 分流并截图

1. 备份六个目标 flag 的启用状态、规则、默认返回、revision、变体映射和实验采集配置。
2. 添加或更新 `UI SDK experiment test` 规则，匹配 `expt_simulator IsOneOf [ui-sdk-e2e-v1]`；使用用户 key 分流并开启该规则的实验采集。
3. 启用目标 flag，保存下表分流；保留无关规则。打开 Targeting、刷新核对并截图。
4. 将两个 Bandit 的初始分流记录为 A 配置；Layer 和 analysis sampling 沿用第 5 步。

| Flag | 初始分流 |
| --- | --- |
| e2e-scenario-balanced | false 50%，true 50% |
| search-ranking | algo-a 50%，algo-b 50% |
| ai-assistant-route | path-a 50%，path-b 50% |
| e2e-healthy-conversion | false 50%，true 50% |
| rd-risk-threshold | bar-low 70%，bar-medium 15%，bar-high 15% |
| rd-average-value | avg-a 70%，avg-b 15%，avg-c 15% |

通过条件：目标及变体映射正确，比例总和 100%，测试规则和采集已启用，刷新后保持。截图：`07-<flag>-initial-targeting`。

## 8. 调用数据程序并检查前置条件

使用 [run-ui-experiment-data.ps1](./run-ui-experiment-data.ps1) 统一入口。复制 [config.example.json](./ui-data-runner/config.example.json) 为同目录的 `config.local.json`，填写当前服务地址；凭据通过 `FEATBIT_UI_ACCESS_TOKEN` 或 `FEATBIT_UI_LOGIN_EMAIL` / `FEATBIT_UI_LOGIN_PASSWORD` 进程环境变量提供。检查本次业务环境的 preflight 报告；前置条件不满足时，将依赖步骤记为 BLOCKED。

从仓库根目录设置本次调用参数并检查目标：

```powershell
$runner = ".\integration-tests\experiment-e2e\run-ui-experiment-data.ps1"
$testSession = "<session-id>"
& $runner -SessionId $testSession -Action preflight
```

核对返回报告中的项目/环境、六个 case、对象 ID、指标方向、实际分流、窗口和服务状态。通过 UI 保存本次观察窗口，排除历史数据；窗口起点覆盖本次首次曝光，采集期间终点保持开放。保存空窗口 Analyze 的结果，确认没有把历史数据当成本轮样本。

| Case ID | 单批 / A 总人数 | B 新用户 | 最终累计 | 预期初始分组人数 |
| --- | ---: | ---: | ---: | --- |
| bayesian-binary | 800 | — | 800 | 400 / 400 |
| bayesian-count | 2,000 | — | 2,000 | 1,000 / 1,000 |
| bayesian-average | 5,000 | — | 5,000 | 2,500 / 2,500 |
| bayesian-healthy | 3,000 | — | 3,000 | 1,500 / 1,500 |
| bandit-sum | 2,000 | 3,000 | 5,000 | A：1,400 / 300 / 300 |
| bandit-average | 3,000 | 5,000 | 8,000 | A：2,100 / 450 / 450 |

主批次共 **23,800 名合格曝光用户**。表中分组人数是期望，精确人数取程序回执；B 按实际推荐比例检查。两个 Bandit 的前 150 人包含在 A 内，Sum 另有累计 600 人检查点。

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
3. Sum 调用 `inject -Batch a-600` 并重复检查。约 420/90/90，是否 ready 按实际最小组人数判断。
4. 各调用 `inject -Batch a-full`，Sum 累计达到 2,000，Average 达到 3,000。先对账并截图数据就绪状态，再 UI Analyze；完整保存 A 的结果。
5. 检查三个变体均参与，ready 与各组人数是否都达到 100 一致。记录 P(best)、推荐权重、停止提示和护栏；停止提示应符合样本已就绪且页面 P(best) 达到 0.95 的条件。概率和推荐算法的独立数值核验暂缓。
6. 若实际仍有组不足或数据异常，阻断该 case 后续更新，不为通过而补齐某组人数。

截图：`10-<case>-burn-in-150`、`10-bandit-sum-near-minimum-600`、`10-<case>-phase-a-data-ready`、`10-<case>-phase-a-analysis-primary`、`10-<case>-phase-a-analysis-guardrails`。

## 11. Bandit：应用推荐分流并截图

1. A 的数据、分流对账须先通过，UI 分析结果已检查并截图，burn-in 完成；出现非预期护栏告警时记录并阻断该实验更新。稳定护栏的 inconclusive 可继续本测试的预定探索，但不能写成已证明安全。
2. 从刚保存的 A 分析读取真实推荐比例，按实际 variation ID 更新对应测试规则；不手写理想比例。Baseline 与两个 Arms 均参与。
3. 保存后在 Targeting 刷新，确认最终比例与推荐及其舍入一致、总和 100%、各变体非零；截图更新结果。
4. 保存 B 的配置与生效确认报告。程序检查 A 分析的新鲜度、实际分流与该次推荐一致，再确认 SDK 配置生效；B 收据保留使用的 A 分析快照。这些是发送前置检查，不代表推荐算法已通过独立数值核验。

Analyze 本身不等于已经修改分流。P(best) 与推荐比例含义不同，不要求两者相等。截图：`11-<case>-updated-targeting`；未满足前置条件时保存 `11-<case>-update-blocked`。

## 12. Bandit：第二批新用户与再次分析

两个 case 均调用 `inject -Batch b`；Sum 新增 3,000 人，Average 新增 5,000 人。

| Case ID | B 的 Primary | B 的 Guardrail 1 | B 的 Guardrail 2 | 检查重点 |
| --- | --- | --- | --- | --- |
| bandit-sum | 仍为 10 / 14 / 18 | 4% / 2% / 15% | 1 / 1 / 4 | bar-high 的两项护栏在 B 恶化；观察累计风险，不继续放量 |
| bandit-average | 50 / 65 / 85 | 仍为 4 / 3 / 3 | 仍为 3% / 2% / 2% | avg-c 的新用户表现改善，累计证据与推荐应随重新分析更新 |

1. 完成 B 数据对账，分别核对 B 和 A+B。Sum 最终 5,000 人，Average 最终 8,000 人；确认都是新用户，A 没有重复计入。
2. Analyze 前截图并记录旧 computed_at；调用后的数据回执与当时页面分别标明。
3. 通过 UI 再 Analyze，检查并保存三个变体的人数、主指标、P(best)、推荐、停止提示和两个护栏。
4. 累计人数与指标均值应与程序的 A+B 数据报告一致，不能直接等于 B 的目标均值。B 实际分流与保存配置一致。
5. 第二轮只观察结果，不自动应用下一轮推荐。Sum 的护栏风险应被报告；测试停止继续放量，不声称产品已自动拦截。
6. 刷新后确认仍为同一个 Run 1，方向、角色和分析结果保留。

截图：`12-<case>-phase-b-data-ready`、`12-<case>-phase-b-analysis-primary`、`12-<case>-phase-b-analysis-guardrails`、`12-<case>-after-refresh`。

## 13. 数据回归与独立诊断

### 13.1 对账与 SRM

- 每个 metric 的用户数、转化人数、均值/累计值及其类型，与程序的精确预期/实际对账一致；多事件、零值、重复事件和无事件用户均有覆盖。
- 页面 SRM、程序按阶段实际比例的分流校验、精确采集计数分别记录。70/15/15 应按该比例校验，不按三组等量判断。
- 当前产品可能因等量假设误报 SRM；现场复现记为 `SRM-DYNAMIC-001`，保留原始页面和程序报告，对应 UI 用例记 FAIL。已有问题不能掩盖真实漏报。
- 比较 A、B、A+B 与分析时间，检查旧结果、串批和重复计数。具体校验算法由独立程序负责。

### 13.2 调用诊断批次并判断

先保存主批次的完整分析与封闭窗口。以下共 412 名额外诊断用户使用独立窗口，不改变第 8 步主批次人数；按回执通过 UI 选择窗口、Analyze、对账和截图。全部结束后恢复主窗口并重新 Analyze。

| Batch ID | Case ID / 范围 | 预期数据与 UI 判断 |
| --- | --- | --- |
| probe-zero-events | 六个 case 各调用一次 | 各 32 人，有曝光、无指标；重复曝光后仍为 32。指标为零，与没有曝光的空状态区分 |
| probe-zero-control | bayesian-binary | 64 人，Control 转化为 0、Treatment 全转化；相对效果不可计算时显示原因，不出现 NaN/Infinity |
| probe-constant | bayesian-average | 64 人，Primary 恒 50、Average 护栏恒 4、Count 护栏每人 1 次；完全持平应为零提升，P(win)=0.5，图表正常 |
| probe-attribution | bayesian-count | 32 人；窗口内总 conversions=16、Count 总值=24、平方和=40；曝光前和窗口外的事件不能混入 |
| probe-layer | layer-isolation（诊断标识） | 60 人共同池检查两个分层目标 Run；每人最多进入一个。中间 [33,66) 不属于本轮两个 Run，人数按程序回执核对 |

使用第 8 步命令，填入上表 Case ID / Batch ID；`layer-isolation` 返回两个目标 Run 的独立结果，分别在 UI 验证。某组没有用户时记录实际零样本分支，不按变体补人。

精确的 99/100/101、499/500/501 人数边界与分析计算器的独立数值核验后续再补，本轮不计为已覆盖的 UI 用例。

## 14. 截图与报告

两个 Bandit 均保留以下六阶段证据，并附 150 人检查点，Sum 另附 600 人检查点：

| 阶段 | 必须保留的证据 |
| --- | --- |
| 初始分流 | Targeting 的变体、比例、启用状态和规则 |
| 第一批数据 | 数据就绪页面、A 收据及对账；标明页面是否仍为旧分析 |
| 第一次 Analyze | 人数、Primary、推荐、护栏、computed_at |
| 更新分流 | 刷新后的 Targeting 和配置生效报告 |
| 第二批新用户 | B 与 A+B 收据和对账；标明当时分析时间 |
| 再次 Analyze | 累计人数、推荐变化、护栏变化和刷新结果 |

四个 Bayesian 保留注入前、数据就绪、Primary、Guardrails 和刷新后的证据；Healthy 明确展示两种方向均判为改善。诊断窗口与恢复后的主结果另存截图。

截图必须由 Computer Use 取得；长页面分图时保持同一分析时间。页面若不展示实时统计，附程序报告并标明来源，不能用自制图冒充 UI。只链接真实保存的文件；仅有内联截图时记录观察标识及导出限制。

报告目录：`integration-tests/experiment-e2e/reports/<sessionId>/`。`report.md` 内联展示截图，链接每批数据收据、对账、分析和分流快照，并记录时间、对象 ID、URL、配置版本及失败说明。

| Case / Step | 输入与操作 | 预期 | 实际 | PASS / FAIL / BLOCKED / SKIPPED | 证据 |
| --- | --- | --- | --- | --- | --- |
| 执行时填写 | 实际调用与 UI 操作 | 本脚本断言 | 现场观察 | 不得预填 PASS | 截图及程序报告 |

只有执行且断言满足的用例记 PASS；数据、UI、方向、动态分流和 SRM 分别判定。前置条件失败时保留阻断现场，后续依赖步骤记 BLOCKED。保留测试数据和 Aspire 会话，不创建额外 Run 或提交上线决定。
