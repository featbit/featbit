# FeatBit UI + .NET Server SDK 自动测试脚本

这是本任务的固定操作步骤，供 `auto-test` 技能通过 Computer Use 执行。第 1–6 步保存用户最初的初始化要求，第 7–14 步补充分流、SDK 数据、分析、动态 Bandit 和截图验收。

文档状态：2026-09-09 整理完成；本次仅编写步骤，未执行第 7–14 步，未生成相应截图或分析结果。初始化的历史执行证据位于 `reports/ui-auto-20260908-initialization/report.md`，不能替代下一次运行的现场检查。

本脚本与 [REST API 测试脚本](./TEST_SCRIPT.md) 是两套独立用例。不要直接运行 REST runner 来准备这里的数据：它会创建和修改另一套资源。这里的 evaluation、曝光与 metric track 必须使用官方 `FeatBit.ServerSdk`；管理 API 可用于资源准备与读取统计，不能直接构造 insight 请求、写数据库或写入自制 `analysisResult`。

## 1. 确认项目、环境和运行服务

- 项目：`E2E API Project ui-e2e-20260904-1417`。
- Project key：`e2e-api-ui-e2e-20260904-1417`。
- 环境：`auto-test-001`；组织：`FeatBit`。
- 最近一次用户提供的 Aspire URL：`https://localhost:61611/`；UI：`http://localhost:61612/`。每次执行仍从现有 Aspire 会话发现地址，不能复用过期端口。
- 按 `.aspire/README.md` 检查 `api-server`、`evaluation-server`、`ui` 及依赖服务就绪；复用现有会话。
- UI 页面头部必须显示指定项目和环境。通过当前资源查询取得 environment ID 和 Server SDK key；密钥仅传入子进程环境，不打印、不写入报告或截图。
- 每次运行创建新的 `sessionId` 和测试用户 key；已经完成初始化时核对并复用对象，不重复创建 Run 1。

## 2. 创建并核对 metrics

通过 Computer Use 在 `/en/metrics` 创建以下指标。Name、Key、Description 均为表中第一列，`guarail` 拼写原样保留。已有指标则检查配置与刷新后的保留情况。

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

## 3. 创建并核对 layer

通过 Computer Use 在 `/en/layers` 创建或核对：

| Name / Key | Assignment Unit | Description |
| --- | --- | --- |
| layer-001 | user.keyId | for 3 experimentations |

第 5 步的三个 Run 分别使用 `[0,33)`、`[33,66)`、`[66,100)`，无重叠，共占 100%。这些是分析准入的 Layer 切片，不是 feature flag 的变体分流比例。

## 4. 创建并核对 feature flags

Name 与 Key 相同；字符串值不包含引号。此步骤允许管理 API，也可通过 UI 完成。

| Name / Key | Type | 实际 variation values | Layer |
| --- | --- | --- | --- |
| e2e-scenario-balanced | Boolean | true, false | 无 |
| ai-assistant-route | String | path-a, path-b | 无 |
| search-ranking | String | algo-a, algo-b | layer-001 |
| rd-notification-style | String | style-a, style-b, style-c | layer-001 |
| rd-risk-threshold | String | bar-low, bar-medium, bar-high | layer-001 |

绑定和数据校验使用实际 variation ID 与 value 的映射，不依赖 UI 展示名称或数组序号。`ai-assistant-route` 没有本轮实验，不参与第 7 步之后的数据流程。

## 5. 创建并核对四个实验及唯一的 Run 1

通过 Computer Use 操作 `/en/experiments`。每个实验在 Exposure 绑定指定 flag、一个 Primary 和两个 Guardrails；在 Measuring 创建唯一的 Run 1，保存后刷新检查。

| 实验名称 | Flag | Run type | Control / Baseline | Treatment / Arms | Layer slice |
| --- | --- | --- | --- | --- | --- |
| e2e-bayesian-binary-primary | e2e-scenario-balanced | Bayesian A/B/n | false | true | 无 |
| e2e-bayesian-numeric-count-all-primary | search-ranking | Bayesian A/B/n | algo-a | algo-b | [0,33) |
| e2e-bandit-numeric-once-per-user-primary | rd-notification-style | Bandit | style-a | style-b, style-c，均勾选 | [33,66) |
| e2e-bandit-numeric-sum-primary | rd-risk-threshold | Bandit | bar-low | bar-medium, bar-high，均勾选 | [66,100) |

| 实验 | Primary | Guardrail 1 | Guardrail 2 |
| --- | --- | --- | --- |
| Bayesian Binary | binary-primary-metric | numeric-count-all-guarail-metric | numeric-sum-guarail-metric |
| Bayesian Count all | numeric-count-all-primary-metric | numeric-binary-conversion-guarail-metric | numeric-once-per-user-guarail-metric |
| Bandit Once per user | numeric-once-per-user-primary-metric | numeric-binary-conversion-guarail-metric | numeric-count-all-guarail-metric |
| Bandit Sum | numeric-sum-primary-metric | numeric-once-per-user-guarail-metric | numeric-sum-guarail-metric |

Primary 为 Higher is better；Guardrails 为 Increase is bad。Assignment unit 为 `user.keyId`；每个已选择变体的 analysis sampling 为 100%；不添加额外 Run audience filters。

历史对象 ID 仅供定位，执行时必须核对名称、flag 和 Run 归属：

| 实验 | Experiment ID | Run 1 ID |
| --- | --- | --- |
| Bayesian Binary | 8a33ab66-22e7-4964-94cf-76fa6c60a35e | b5a12c13-928c-4c4c-a33a-b6570bbae74b |
| Bayesian Count all | a99f8324-2440-45b4-a278-19843a837dac | f2b7cada-43ca-4aa1-ac92-f0c4fe44229c |
| Bandit Once per user | fb1476d1-690d-4c61-a803-e7e064ef48e0 | c9da1f5b-d22e-479b-a346-d3a4ee4f8e20 |
| Bandit Sum | a61daf7e-597a-41d2-9e7a-0a1e67560687 | ed383019-94f7-44aa-8e4e-1ad09c04f84f |

## 6. 初始化期间的其他自动化测试

通过 Computer Use 检查以下行为，并报告有实质影响的问题：

- 空必填项不能创建；Binary aggregation 固定为 Once per user。
- 搜索不存在的 metric 显示空状态；清空搜索恢复完整列表。
- 重新打开已保存的 metric，确认类型、聚合和描述；取消编辑不改变记录。
- Primary / Guardrails 不能重复选择同一 metric。
- Layer 显示三个关联 Run、无切片冲突；Show more / Show less 可展开和收起。
- 按实验筛选 metrics，正确显示一个 Primary 和两个 Guardrails。
- 实验列表恰好包含四个目标实验，每个只有一个 Run，方法和角色正确。

## 7. 配置初始 feature flag 分流并截图

用户无需手动准备分流。自动执行以下操作；管理 API 可以提交配置，保存结果必须通过 Computer Use 打开 Targeting 页面、刷新并验证。

1. 读取并备份四个 flag 的 revision、启用状态、规则、默认返回、variation ID/value 与实验采集配置。
2. 在指定环境为这四个 flag 添加或更新专用规则，例如 `UI SDK experiment test`。规则匹配 `expt_simulator IsOneOf [ui-sdk-e2e-v1]`，放在可覆盖其他匹配规则的位置；SDK 测试用户携带相同属性。保留无关规则和默认返回。
3. 分流使用用户 key；启用这条规则的实验采集，使正常 SDK evaluation 能记录 eligible exposure。启用四个 flag。
4. 保存后重新读取当前 revision，通过 UI 刷新核对下表；为每个 flag 截图。
5. 记录两个 Bandit 的初始配置快照为各自的阶段 A 配置；保持第 5 步的 Layer 和 analysis sampling 配置。

| Flag | 初始分流（按实际 value） |
| --- | --- |
| e2e-scenario-balanced | false 50%，true 50% |
| search-ranking | algo-a 50%，algo-b 50% |
| rd-notification-style | style-a 70%，style-b 15%，style-c 15% |
| rd-risk-threshold | bar-low 70%，bar-medium 15%，bar-high 15% |

这两个 flag 分别专用于对应的 Bandit 实验，均为一个 Baseline 加两个候选 Arm，共三个变体。70%/15%/15% 是本用例选定的初始策略：先保留较多 Baseline 流量，同时让两个候选都有采样机会；它不是 Bandit 算法的固定初始比例。70%/10%/10%/10% 则需要四个实际变体，本轮不额外创建第四个变体或新 flag。

阶段 A 使用上述不等比分流，阶段 B 再应用实际分析推荐的权重。Baseline 不享有算法内置的永久 70% 保留比例；若要求全程保留至少 70%，需要另外定义受约束的分配策略，不能直接套用当前 Top-Two 推荐。先前的三组近似均分方案用于快速收集平衡样本，本版已改为不等比起步，以覆盖用户提出的场景。

通过条件：flag 已启用、规则匹配测试属性、比例总和 100%、变体与 ID 映射准确、实验采集开启，刷新后保持一致。记录配置单位：UI 百分比 0–100，管理 API 的 rollout 累积边界 0–1；Run Layer slice 是 0–100。不要混用单位。

截图 ID：`07-<flag>-initial-targeting`。在 SDK 初始化后还需核对其收到该配置；管理端保存成功不等于 SDK 已同步。

## 8. 准备并运行 .NET Server SDK 数据生成器

使用官方 `FeatBit.ServerSdk`，记录实际安装版本。可参考工作区 `tempo/bandit-sdk-simulator/Program.cs` 的 SDK 用法；该旧模拟器绑定其他实验，不能直接用旧配置运行。完整的四实验生成器需要按本脚本适配，Markdown 不代表它已经实现。

### 8.1 SDK 和时间约束

- 指定本地 evaluation server 的 Streaming 与 Event 地址，禁止依赖 SDK 的远程默认地址。
- 等待客户端 `Initialized`；fallback、未知 variation、未同步初始规则均不能继续生成业务结果。
- Boolean 使用 `BoolVariationDetail`，String 使用 `StringVariationDetail`；根据 SDK 返回的 value / ValueId 生成该用户的结果。不要自行指定返回变体，不调用 REST evaluation，不直接发送 insight JSON。
- 使用 `Track(user, metricKey, numericValue)` 发送指标。曝光与指标使用同一个稳定用户 key。
- 每批先完成 evaluation，`FlushAndWait`，再发指标并 flush；退出执行 `CloseAsync`。控制队列和批大小，不能以队列溢出换取速度。
- 使用 SDK 当时的真实时间戳。一次启动即可完成所有阶段，不等待一小时，不构造未来时间、不改系统时钟。
- 注入耗时以 5 分钟内为目标；准备代码、配置、服务等待、分析和截图另计，实际耗时写入报告。
- Run 1 的 observationStart 覆盖首次曝光，采集期间 observationEnd 保持开放。记录原窗口和实际测试窗口；每批 flush 完成后记录明确 UTC 边界，查询使用精确的 `[start,end)`。已有历史数据必须纳入基线核对，不能混作本次新增。

### 8.2 用户和预期账本

- 每次执行使用新 `sessionId`；不同实验使用独立用户池，阶段 B 使用此前未出现的新用户。用户附带 `expt_simulator`、`simulation_batch`、`simulation_phase`。
- 使用固定的结果生成 seed；首次生成用户清单和配置快照后保留它们供复核。不要为得到好看的 SRM 或精确相等的人数而按 SDK 变体挑选、丢弃、补齐用户。
- Layer 准入按保存的 layer key、assignment unit 和 slice 独立计算；可以在求值前筛出属于目标 Layer 的用户以控制有效样本规模，但不能按变体或结果筛选。
- 不同实验共用 metric key，事件本身没有 experiment ID。独立用户池避免相互污染；同一业务事件不能为不同实验再上报一份。
- 每个 Bayesian 预先固定 2,000 名合格用户。每个 Bandit 阶段 A 固定 3,000 名、阶段 B 固定 3,000 名合格新用户；A 的前 150 人用于低样本检查，包含在 A 的 3,000 人内。固定批量在观察结果之前决定。
- 保存逐用户的 SDK value / variation ID、阶段、Layer eligibility、每个 metric 的实际调用次数与数值、曝光和发送时间边界。预期聚合来自这些明细，不能从服务端统计反推。
- 附加 Layer / 归因负例单独标记，并明确是否属于主分析的预期分母。严禁把未发送的事件记入已发送计数，或盲目重放发送结果不确定的批次。

### 8.3 数据分布和测试目的

以下为生成分布或每用户期望值，不要求随机样本恰好命中这些数字；逐条账本才是精确验收值。指标名称沿用第 5 步，Guardrail 顺序与该表一致。数值指标使用包含零贡献用户的非退化分布，并拆为多次 Track；Count all 事件故意使用不同 numericValue。

| 实验 / 变体顺序 | Primary | Guardrail 1 | Guardrail 2 | 目的 |
| --- | --- | --- | --- | --- |
| Bayesian Binary：false / true | 转化率 30% / 45%，部分转化者重复触发 | 每用户平均 0.10 / 0.10 次 | 每用户累计均值 10 / 9 | Binary 去重、主指标提升、护栏稳定或改善 |
| Bayesian Count all：algo-a / algo-b | 每用户平均 2 / 3 次 | 触发率 2% / 12% | 触发率 3% / 3% | 只计事件次数；主指标提高但一项护栏恶化 |
| Bandit Once：style-a / style-b / style-c，A/B 相同 | 触发率 25% / 45% / 25% | 触发率均为 2% | 每用户平均均为 0.10 次 | 重复触发仍按 0/1；style-b P(best) 较高；验证两轮分流 |
| Bandit Sum：bar-low / bar-medium / bar-high，A | 每用户累计均值 10 / 14 / 18 | 触发率均为 2% | 每用户累计均值均为 1 | 第一轮护栏正常，能够演示更新分流 |
| Bandit Sum：bar-low / bar-medium / bar-high，B | 每用户累计均值 10 / 14 / 18 | 触发率 2% / 2% / 12% | 每用户累计均值 1 / 1 / 4 | 第二轮制造 bar-high 护栏恶化，区分收益推荐与后续放量决定 |

当前实现的聚合口径：

- Binary Once 和 Numeric Once：每用户有任意事件即贡献 1，否则 0。Numeric Once 的分析类型仍应为 numeric。
- Count all：每用户贡献是 Track 次数，不是 numericValue 总和。
- Sum values：先累加每个用户的 numericValue，再做总体统计。
- 未触发用户不发送事件，贡献 0，仍在曝光分母中；`Track(..., 0)` 不能表示 Once 指标未触发。
- `conversions` 是有事件的用户数，即便 Count all 也不等于事件总次数。
- `sumSquares` 是每用户聚合贡献的平方之和，不是所有单条事件值的平方之和。

Average values 的当前口径也需要明确：先对每个用户在有效曝光后、统计窗口内的事件数值求平均；没有指标事件的曝光用户贡献 0。变体分析再对这些用户贡献求平均，每个用户权重相同。它不是把全体事件混在一起求平均，也不是只计算触发过指标的用户。

例如同一变体有三个合格曝光用户：A 上报 10、20、30，B 上报 90，C 没有指标事件。

| 聚合 | A 的贡献 | B 的贡献 | C 的贡献 | 变体分析使用的贡献均值 |
| --- | --- | --- | --- | --- |
| Once per user | 1 | 1 | 0 | 2/3，表示触发用户占比 |
| Count all | 3 | 1 | 0 | 4/3 次/曝光用户 |
| Sum values | 60 | 90 | 0 | 50，即每曝光用户累计值的平均 |
| Average values | 20 | 90 | 0 | 110/3，约 36.67 |

该例原始事件总和为 150，全部四条事件的平均为 37.5；这两个数与 Average values 的变体均值 36.67 不同。Numeric Once per user 也不表示“保留用户第一条事件的 numericValue”：当前实现忽略数值，只根据是否有事件贡献 0/1；其分析数据类型仍与 Binary 区分。

## 9. Bayesian：注入、Analyze、核对和截图

两个 Bayesian 分别执行：

1. 保存注入前页面及当前分析时间；按第 8 步生成固定用户批次，通过 SDK 上报。
2. 等待统计查询中的新增 `users`、`conversions`、`sumValue`、`sumSquares` 与预期账本一致；计数精确比较，浮点数使用记录在报告中的绝对/相对容差。
3. 通过 Computer Use 在现有 Run 1 点击 Analyze；等待加载结束及 computed_at 更新。单纯刷新页面不算重新分析。
4. 核对 Run type、Control/Treatment、三个 metric、样本量、转化率或均值、提升方向、护栏信号；核对服务端持久化 inputData 的 numeric / proportion 结构与精确统计。
5. Bayesian Binary 应显示 true 的转化表现更好；Count all 应同时呈现 algo-b 主指标改善与 Binary guardrail 恶化。护栏恶化是预设结果，正确显示它才通过这一用例。
6. 刷新后核对结果保留。每次分析立即保存原始 inputData、analysisResult 和截图，不等后续分析覆盖。

截图：`09-<experiment>-before-data`、`09-<experiment>-data-ready`、`09-<experiment>-analysis-primary`、`09-<experiment>-analysis-guardrails`、`09-<experiment>-after-refresh`。

## 10. Bandit：第一批数据与第一次完整分析

两个 Bandit 均按相同顺序自动执行：

1. 截图初始 Targeting 和现有 Measuring 页面，记录阶段 A 的已生效权重及 SDK 同步证据。
2. 上报 A 的前 150 名合格用户，核对入库，使用 UI Analyze。至少一个 Arm 少于 100 人，预期 `enough_units=false`，P(best) / recommended weights 不应伪装成有效推荐；截图低样本状态。
3. 使用同一配置完成 A 的剩余用户，累计达到固定的 3,000 人。停止上报并 flush，记录 A 结束时间与独立数据快照。
4. 在调用下一次 Analyze 前截图当前页面并保存新的统计查询。页面若仍显示低样本分析，明确标为“尚未重新分析”，不能把旧数字当作新数据结果。
5. 通过 UI Analyze，核对三个 Arm 都参与、每个 Arm >= 100、Primary 和两个 Guardrails 的聚合准确。
6. 保存 A 的 inputData、analysisResult、完整推荐权重、P(best)、停止提示和 SRM；截图主指标/推荐区及两个护栏。

判定规则：P(best) 与 recommended_weight 各自检查其含义和总和，允许模型抽样误差及显示舍入。当前 Top-Two 算法中 P(best) 接近 100% 的 Arm 仍可能只得到约一半推荐权重，不能要求推荐权重等于 P(best)。护栏结论按实际配置和输出判断，不用手写结论覆盖模型。

截图：`10-<experiment>-burn-in`、`10-<experiment>-phase-a-data-ready`、`10-<experiment>-phase-a-analysis-primary`、`10-<experiment>-phase-a-analysis-guardrails`。

## 11. Bandit：应用推荐分流并截图

1. A 的精确聚合和按实际初始比例的分流校验必须先通过。核对护栏；若出现非预期的护栏告警或数据异常，保存证据，阻断该实验的更新，不为演示流程而无条件放量。其他独立实验可继续。
2. 读取刚保存的服务端推荐权重，不手写理想比例。读取最新 flag revision，将权重按实际 variation ID 映射到第 7 步测试规则。
3. 按 UI/API 支持的精度将权重归一化；记录舍入前推荐与最终保存比例。各 Arm 均保留非零流量，总和 100%，最后一个累积边界严格为 1。
4. 提交分流配置，打开 UI Targeting，刷新核对并截图。这是显式更新 flag 的步骤；Analyze 自身不会完成它。
5. 等待 SDK 收到新规则，记录配置摘要和同步证据。阶段之间不再发旧配置数据；B 的新用户必须在同步确认之后开始。若同步无法确认则标为 BLOCKED，不能仅凭管理端保存时间划分阶段。
6. 保存新的阶段 B 配置：实际权重、flag revision、保存时间、SDK 确认时间，以及下一批用户清单标识。运行的 Layer 切片和 analysis sampling 不变。

截图：`11-<experiment>-updated-targeting`；若未满足前置条件，则 `11-<experiment>-update-blocked`，并明确没有执行更新。

## 12. Bandit：第二批新用户、再次 Analyze 和截图

1. 使用全新用户 key，在阶段 B 已生效分流下生成固定的 3,000 名合格用户；沿用同一个实验和 Run 1。
2. 按 SDK 实际分配的 Arm 产生第 8.3 节阶段 B 结果，不复用 A 用户，不把用户按新权重重新指定 Arm。
3. 完成 flush，保存 B 的精确账本、服务端增量统计与结束时间。分别核对 A、B 和累计 A+B；第二次累计分析的样本不能只有 B，也不能把 A 重复计算。
4. 再次 Analyze 前截图页面，注明当时仍显示的上一轮 computed_at，并把 B 数据快照与截图关联。
5. 通过 UI 再次 Analyze，保存新的 inputData / analysisResult，截图三个 Arm 的人数、Primary、P(best)、推荐权重、停止提示及两个 Guardrails。
6. Once 实验检查新流量按已保存的 B 比例分配、style-b 仍具有较好表现。Sum 实验检查 B 注入的 bar-high 护栏恶化能在相应数据/累计分析中反映。
7. 第二轮仅观察和核对，不自动应用下一次推荐。测试执行器对 Sum 护栏恶化停止进一步放量，是执行器的决定，不声称产品已经实现自动护栏阻断。
8. 刷新后重新核对配置、累计分析、方法和角色，确认每个实验仍只有 Run 1。

截图：`12-<experiment>-phase-b-data-ready`、`12-<experiment>-phase-b-analysis-primary`、`12-<experiment>-phase-b-analysis-guardrails`、`12-<experiment>-after-refresh`。

## 13. SRM、归因与数据正确性校验

### 13.1 已确认的 SRM 实现限制

截至本脚本编写时，后端 `ExperimentService.SrmCheck(long[] observed)` 使用 `expected = total / observed.Length`。Bayesian 与 Bandit 调用均只传 observed，没有传实际 rollout 或配置生效历史。因此它检验的是“各组等量”，不是任意实际分流计划下的样本匹配。

本版 Bandit 阶段 A 已使用 70%/15%/15%，因此第一次完整分析就可能出现由等量假设导致的 SRM 误报，不必等到阶段 B 才检查。A 的 3,000 名合格用户对应期望人数为 2,100/450/450，不能拿 1,000/1,000/1,000 作期望。阶段 B 则使用届时实际保存并同步到 SDK 的推荐比例。不能仅凭页面红色断言 SDK 丢数据，也不能无条件忽略它。

该产品限制单独登记为 `SRM-DYNAMIC-001`。文档规定正确校验方式不等于修复产品；未通过实际动态重放时只能标为“源码已确认，现场待复现”。若现场产生误报，保留 UI 和阶段证据，SRM 用例记录 FAIL（关联此已知问题），不能把整套测试报告写成全通过。

### 13.2 正确的阶段校验

先做确定性核对，再做分流诊断：

1. 每阶段服务端归因人数必须精确等于 SDK 明细中符合窗口、Layer、角色和 sampling 的用户数；每个指标的贡献与统计精确匹配。这一步检查采集和归因，不依赖 SRM 的概率阈值。
2. 对阶段 `t`，用本阶段有效新曝光总数 `N_t` 和阶段开始前已固定的、实际生效的条件分流概率 `p[t,i]`，计算 `E[t,i] = N_t * p[t,i]`。本脚本只有一条匹配测试规则、固定 Layer 和 100% sampling，且阶段内不变更权重；若实际出现其他分支或变更，先分层/拆阶段，不能直接套用原权重。
3. 在每阶段使用与该阶段概率匹配的多项分布检验或 Pearson chi-square；小期望计数使用精确/Monte Carlo 方法。阶段批量预先固定，不能为得到通过的 p 值根据结果延长、截断或重采样。
4. SRM 检查清单预先固定为两个 Bayesian 批次和两个 Bandit 的 A/B 阶段，共 6 次；报告全部 p 值，族错误率阈值设为 0.01，可用 Bonferroni 得到单次阈值 `0.01/6`。低样本截图和累计快照不额外开展反复显著性检验。
5. 累计期望可以展示为 `E[i] = sum_t N_t * p[t,i]`，但动态权重根据早期结果变化，不能把累计人数直接塞入“各组等量”的检验，也不能把累计期望简单代入固定多项分布就宣称取得严格的全程 p 值。正式的整体自适应检验需要覆盖权重选择过程；本轮采用按阶段校验与精确账本。
6. 报告并列展示“页面 SRM（原始输出）”“按阶段实际比例的校验”“SDK 到服务端的精确计数核对”，分别下结论。阶段检验异常也须调查，不能因为存在已知 SRM 限制而掩盖真实漏报。

示例仅用于解释，不是要应用的推荐权重：A 有 3,000 人，三组各 1,000；B 有 3,000 人，权重为 10%/45%/45%，观察到 300/1,350/1,350。累计人数 1,300/2,350/2,350 正好符合两阶段计划；当前实现却将其与 2,000/2,000/2,000 比较，因而会报显著不匹配。

后续产品修复的验收方向：保存分流生效阶段与概率，按首次有效曝光所属阶段解释人数；支持不等比分流，明确不支持的动态情形。既覆盖正确动态流量不误报，也覆盖人为漏报时仍能报警。本轮仅测试与报告，不自动修改统计实现。

### 13.3 附加归因测试

- 同用户重复曝光不增加独立用户数；重复业务 Track 在 Once / Count / Sum 中按各自定义计入。
- 同一小时内使用子窗口验证 `[start,end)` 和曝光先于指标的归因边界；SDK 时间戳保持真实，不回填。
- 用独立的共同 Layer 探针用户池评估三个分层 flag，计算每个用户只有一个 slice 可准入；事件只按定义发一次，探针贡献全部进入预期账本。若与主批次同窗口，主批次汇总应明确包含这些额外用户；否则使用分开的诊断窗口。
- 曝光前事件不计入该用户后续曝光的结果；没有指标事件的曝光用户仍在分母中。
- 确认 SDK 发送完成不能替代统计落库确认；网络失败或 flush 不确定时先查明批次状态，不盲目重放整批。

## 14. 截图、数据快照与报告交付

每个 Bandit 必须给用户保留完整的六阶段证据，分析会覆盖当前 Run 的结果，因此截图和 JSON 必须在进入下一阶段前保存。

| 阶段 | 必须呈现的截图/证据 | 需要用户能核对的内容 |
| --- | --- | --- |
| 初始分流 | Targeting 页面 | 三个实际值、比例、flag 状态、匹配规则 |
| 第一批数据 | 数据就绪时页面；A 数据快照 | 新增人数、每个指标聚合、页面当时是否还是旧分析 |
| 第一次 Analyze | Measuring 主指标/推荐区和护栏区 | Arm 人数、指标、P(best)、权重、护栏、computed_at |
| 更新分流 | 刷新后的 Targeting；SDK 同步记录 | 实际保存比例与推荐的对应关系、生效阶段 |
| 第二批新用户 | 数据就绪时页面；B 与 A+B 快照 | B 新用户计数、归因、累计结果，未分析时不可冒充已更新 |
| 再次 Analyze | Measuring 主指标/推荐区和护栏区；刷新截图 | 两轮累计人数、推荐变化、护栏变化、持久化 |

截图必须由 Computer Use 从真实页面取得；长页面滚动后分图，保持同一 computed_at，不要求一张图挤下所有数据。禁止用自制图替代 FeatBit UI。若 UI 不提供 Analyze 前的实时统计，真实页面截图旁附 SDK/服务端数值表并标明来源；不能假称页面展示了那些数值。

建议产物目录为 `integration-tests/experiment-e2e/reports/<sessionId>/`：

```text
report.md
screenshots/<step>-<experiment>-<state>.png
snapshots/<experiment>-phase-a-input.json
snapshots/<experiment>-phase-a-analysis.json
snapshots/<experiment>-phase-b-input.json
snapshots/<experiment>-phase-b-analysis.json
targeting/<flag>-before.json
targeting/<flag>-phase-a.json
targeting/<flag>-phase-b.json
data/users-and-metrics.jsonl
data/expected-and-observed.json
data/phase-srm.json
```

截图与快照记录时间、实验/Run ID、阶段、页面 URL、flag revision 或 computed_at。使用运行时支持的截图接口；文件只记录真实保存的路径。若只能内联输出截图，则保留任务中的图片和对应观察标识，明确文件导出限制，不能伪造 PNG 路径。截图缺失的阶段不能标记证据完整。

`report.md` 按阶段内联展示截图，并附预期/实际数值表、源 JSON 链接及失败说明。最终回复给用户实际截图或可浏览的截图报告，明确每阶段执行状态，不只给终态截图。

| Case / Step | 实验 / 阶段 | 操作 | 预期 | 实际 | PASS / FAIL / BLOCKED / SKIPPED | 截图与数据快照 |
| --- | --- | --- | --- | --- | --- | --- |
| 执行时填写 | 执行时填写 | 实际操作 | 事先定义的断言 | 现场观察 | 不得预填 PASS | 真实文件或观察标识 |

只把执行过且断言满足的用例记为 PASS；数据正确、UI 正确、动态分流正确和 SRM 提示正确分别判定。保存所有测试数据和当前 Aspire 会话；无需等待一小时，也不自动创建新 Run、变更实验方法、提交上线决定或清理历史记录。

## 待补充的 Average values 覆盖

当前本任务已初始化的范围仍为四个实验：两个 Bayesian、两个 Bandit，各一个 Run 1；八个 metric 中没有 `metricAgg=average`，也没有以 Average values 为 Primary 的实验。

为覆盖 Average 的完整分析路径，后续应补充一个 Bayesian Average-primary 用例和一个 Bandit Average-primary 用例，并准备相应 Numeric / Average values 指标。补齐这两项后，本任务实验数为六个。此处记录的是覆盖缺口，尚未创建对应 metric、flag 或实验；第 1–14 步仍指当前四实验用例。

新增 Average 用例的数据必须让各用户的事件条数不同，并包含已曝光但没有指标事件的用户，才能区分“用户均值的平均”“全部事件的平均”和“每用户累计值”。同时检查 numeric 输入中的 `n`、`sum`、`sum_squares`；不能仅检查页面出现了一个平均数。

## 实现参考

- [REST 测试目录说明](./README.md)：可参考统计查询与断言结构，事件注入须改用 SDK。
- [官方 .NET Server SDK](https://github.com/featbit/featbit-dotnet-sdk)：evaluation、Track、flush 与配置同步。
- [统计聚合与归因](../../modules/back-end/src/Infrastructure/Services/EntityFrameworkCore/ExperimentStatsService.cs)。
- [分析、Bandit 权重与 SRM](../../modules/back-end/src/Infrastructure/Services/EntityFrameworkCore/ExperimentService.cs)。
