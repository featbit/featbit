# FeatBit UI 自动测试脚本

本脚本使用 `auto-test` 技能，通过 Computer Use 和官方 .NET Server SDK 验证 FeatBit 的实验初始化、事件采集、统计分析与动态分流。测试资源共 10 个 metric、6 个 feature flag、1 个 Layer、6 个实验（三个 Bayesian、三个 Bandit），每个实验只使用一个 Run 1。

| 步骤 | 内容 | 完成条件 |
| --- | --- | --- |
| 1–6 | 环境确认、资源初始化、UI 基础检查 | 资源、绑定、变体角色与刷新持久化正确 |
| 7–8 | 初始分流、SDK 生成器与预期账本 | 分流已生效，SDK 可按计划采集数据 |
| 9 | Bayesian 单批数据与分析 | 三个实验的统计、主指标和护栏符合预期 |
| 10–12 | Bandit 两阶段数据与分流更新 | 第一批数据 → Analyze → 更新分流 → 第二批新用户 → 再次 Analyze |
| 13–14 | 数据校验、截图与报告 | 逐阶段保留预期、实际结果和证据 |

按用户指定的步骤范围执行；仅初始化时完成第 1–6 步。资源存在时先核对并复用，缺失时创建。实际对象 ID、执行进度、缺陷和截图记录在 `reports/<sessionId>/report.md`，不作为脚本的预设结果。

Metrics、Layers、实验配置与分析操作使用 Computer Use；feature flag 配置允许使用管理 API，保存结果须由 UI 核验。evaluation、曝光和 metric track 必须使用官方 `FeatBit.ServerSdk`。管理 API 可读取配置与统计，不得直接构造 insight 请求、写数据库或写入自制 `analysisResult`。[REST API 测试脚本](./TEST_SCRIPT.md) 使用另一套资源，不用于准备本脚本的事件数据。

## 1. 确认项目、环境和运行服务

- 项目：`E2E API Project ui-e2e-20260904-1417`。
- Project key：`e2e-api-ui-e2e-20260904-1417`。
- 环境：`auto-test-001`；组织：`FeatBit`。
- Aspire 地址参考：`https://localhost:61611/`；UI 地址参考：`http://localhost:61612/`。每次执行从现有 Aspire 会话确认实际地址。
- 按 `.aspire/README.md` 检查 `api-server`、`evaluation-server`、`ui` 及依赖服务就绪；复用现有会话。
- UI 页面头部必须显示指定项目和环境；记录实际资源 ID，并核对对象名称、flag 与 Run 归属。
- 执行 SDK 数据步骤时取得 environment ID 和 Server SDK key；密钥仅传入子进程环境，不打印、不写入报告或截图。
- 每次执行使用独立 `sessionId`，在报告中记录步骤范围；数据采集使用独立测试用户 key。复用符合配置的 Run 1，不重复创建。

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
| numeric-average-guarail-metric | Numeric value | Average values |
| numeric-average-primary-metric | Numeric value | Average values |

逐项核对 Name、Key、Description、Type 和 Aggregation；重新打开编辑表单并刷新列表，确认配置保留。最终列表应有表中 10 个指标。

## 3. 创建并核对 layer

通过 Computer Use 在 `/en/layers` 创建或核对：

| Name / Key | Assignment Unit | Description |
| --- | --- | --- |
| layer-001 | user.keyId | for 3 experimentations |

Layer 绑定在第 5 步的 Run assignment 中配置。三个分层 Run 分别使用 `[0,33)`、`[33,66)`、`[66,100)`，无重叠，共占 100%；其余 Run 不绑定 Layer。Layer 切片决定分析准入，feature flag 的变体分流在第 7 步单独配置。

## 4. 创建并核对 feature flags

Name 与 Key 相同；字符串值不包含引号。此步骤允许管理 API，也可通过 UI 完成。

| Name / Key | Type | 实际 variation values |
| --- | --- | --- |
| e2e-scenario-balanced | Boolean | true, false |
| search-ranking | String | algo-a, algo-b |
| ai-assistant-route | String | path-a, path-b |
| rd-notification-style | String | style-a, style-b, style-c |
| rd-risk-threshold | String | bar-low, bar-medium, bar-high |
| rd-average-value | String | avg-a, avg-b, avg-c |

每个 flag 对应第 5 步中的一个实验。绑定和数据校验使用实际 variation ID 与 value 的映射；保存后刷新 Variations 页面，核对类型与全部实际值。最终列表应有表中 6 个 flag。

## 5. 创建并核对六个实验及各自唯一的 Run 1

通过 Computer Use 操作 `/en/experiments`，按以下顺序配置每个实验：

1. 在 Exposure 绑定表中的 flag、一个 Primary 和两个 Guardrails，保存配置。
2. 在 Measuring 创建或核对 Run 1。Bayesian 使用 UI 中的 Bayesian A/B/n；Bandit 使用 Bandit，并配置 Baseline & Arms。角色按实际变体值选择。
3. 配置 Layer、analysis sampling 和 audience filters，保存后刷新 Exposure 与 Measuring。

| 实验名称 | Flag | Run type | Control / Baseline | Treatment / Arms | Layer slice |
| --- | --- | --- | --- | --- | --- |
| e2e-bayesian-binary-primary | e2e-scenario-balanced | Bayesian A/B/n | false | true | 无 |
| e2e-bayesian-numeric-count-all-primary | search-ranking | Bayesian A/B/n | algo-a | algo-b | [0,33) |
| e2e-bayesian-numeric-average-primary | ai-assistant-route | Bayesian A/B/n | path-a | path-b | 无 |
| e2e-bandit-numeric-once-per-user-primary | rd-notification-style | Bandit | style-a | style-b, style-c，均勾选 | [33,66) |
| e2e-bandit-numeric-sum-primary | rd-risk-threshold | Bandit | bar-low | bar-medium, bar-high，均勾选 | [66,100) |
| e2e-bandit-numeric-average-primary | rd-average-value | Bandit | avg-a | avg-b, avg-c，均勾选 | 无 |

| 实验 | Primary | Guardrail 1 | Guardrail 2 |
| --- | --- | --- | --- |
| Bayesian Binary | binary-primary-metric | numeric-count-all-guarail-metric | numeric-sum-guarail-metric |
| Bayesian Count all | numeric-count-all-primary-metric | numeric-binary-conversion-guarail-metric | numeric-once-per-user-guarail-metric |
| Bayesian Average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-count-all-guarail-metric |
| Bandit Once per user | numeric-once-per-user-primary-metric | numeric-binary-conversion-guarail-metric | numeric-count-all-guarail-metric |
| Bandit Sum | numeric-sum-primary-metric | numeric-once-per-user-guarail-metric | numeric-sum-guarail-metric |
| Bandit Average | numeric-average-primary-metric | numeric-average-guarail-metric | numeric-binary-conversion-guarail-metric |

Primary 为 Higher is better；Guardrails 为 Increase is bad。Assignment unit 为 `user.keyId`；每个已选择变体的 analysis sampling 为 100%；不添加额外 Run audience filters。

通过条件：六个实验的 flag、三个指标及其类型/聚合/方向、Run type、变体角色、Layer 切片、sampling 和 filters 均与表中一致，刷新后保留；每个实验只有一个 Run 1。后文使用表中的 Bayesian Binary、Bayesian Count all 等简称。

## 6. 初始化期间的其他自动化测试

通过 Computer Use 检查以下行为，并报告有实质影响的问题：

- 空必填项不能创建；Binary aggregation 固定为 Once per user。
- 搜索不存在的 metric 显示空状态；清空搜索恢复完整列表。
- 重新打开已保存的 metric，确认类型、聚合和描述；取消编辑不改变记录。
- Primary / Guardrails 不能重复选择同一 metric。
- 新建和编辑 Run 时必须选择一个 Control / Baseline 及至少一个 Treatment / Arm；取消最后一项后应阻止空选保存，不能自动重新勾选其他变体。取消草稿不产生额外 Run。
- Layer 显示三个关联 Run、无切片冲突；Show more / Show less 可展开和收起。
- 按实验筛选 metrics，正确显示一个 Primary 和两个 Guardrails。
- 实验列表包含六个目标实验：三个 Bayesian、三个 Bandit，每个只有一个 Run，方法和角色正确。

## 7. 配置初始 feature flag 分流并截图

自动配置六个 flag 的初始分流；管理 API 可以提交配置，保存结果必须通过 Computer Use 打开 Targeting 页面、刷新并验证。

1. 读取并备份六个 flag 的 revision、启用状态、规则、默认返回、variation ID/value 与实验采集配置。
2. 在指定环境为这六个 flag 添加或更新专用规则，例如 `UI SDK experiment test`。规则匹配 `expt_simulator IsOneOf [ui-sdk-e2e-v1]`，放在可覆盖其他匹配规则的位置；SDK 测试用户携带相同属性。保留无关规则和默认返回。
3. 分流使用用户 key；启用这条规则的实验采集，使正常 SDK evaluation 能记录 eligible exposure。启用六个 flag。
4. 保存后重新读取当前 revision，通过 UI 刷新核对下表；为每个 flag 截图。
5. 记录三个 Bandit 的初始配置快照为各自的阶段 A 配置；保持第 5 步的 Layer 和 analysis sampling 配置。

| Flag | 初始分流（按实际 value） |
| --- | --- |
| e2e-scenario-balanced | false 50%，true 50% |
| search-ranking | algo-a 50%，algo-b 50% |
| ai-assistant-route | path-a 50%，path-b 50% |
| rd-notification-style | style-a 70%，style-b 15%，style-c 15% |
| rd-risk-threshold | bar-low 70%，bar-medium 15%，bar-high 15% |
| rd-average-value | avg-a 70%，avg-b 15%，avg-c 15% |

每个 Bandit 使用一个 Baseline 和两个 Arms。阶段 A 的 70%/15%/15% 是本测试的初始配置；阶段 B 按第 11 步应用实际分析推荐的权重。Baseline 参与推荐分配，不设置额外的最低流量约束。

通过条件：flag 已启用、规则匹配测试属性、比例总和 100%、变体与 ID 映射准确、实验采集开启，刷新后保持一致。记录配置单位：UI 百分比 0–100，管理 API 的 rollout 累积边界 0–1；Run Layer slice 是 0–100。不要混用单位。

截图 ID：`07-<flag>-initial-targeting`。在 SDK 初始化后还需核对其收到该配置；管理端保存成功不等于 SDK 已同步。

## 8. 准备 SDK 数据生成器与预期账本

使用官方 `FeatBit.ServerSdk`，实现或核对生成器的 flag、metric、用户池、批次与统计规则，记录实际安装版本。可参考 `tempo/bandit-sdk-simulator/Program.cs` 的 SDK 用法，运行配置以本脚本为准。生成器准备就绪后，分别在第 9、10、12 步采集对应批次的数据。

### 8.1 SDK 和时间约束

- 指定本地 evaluation server 的 Streaming 与 Event 地址，禁止依赖 SDK 的远程默认地址。
- 等待客户端 `Initialized`；fallback、未知 variation、未同步初始规则均不能继续生成业务结果。
- Boolean 使用 `BoolVariationDetail`，String 使用 `StringVariationDetail`；根据 SDK 返回的 value / ValueId 生成该用户的结果。不要自行指定返回变体，不调用 REST evaluation，不直接发送 insight JSON。
- 使用 `Track(user, metricKey, numericValue)` 发送指标。曝光与指标使用同一个稳定用户 key。
- 每批先完成 evaluation，`FlushAndWait`，再发指标并 flush；退出执行 `CloseAsync`。控制队列和批大小，不能以队列溢出换取速度。
- 使用 SDK 调用时的真实时间戳，连续完成各批次，不回填、不构造未来事件、不改系统时钟。
- 注入耗时以 5 分钟内为目标；准备代码、配置、服务等待、分析和截图另计，实际耗时写入报告。
- 先保存 Run 1 的原窗口和已有分析，再通过 UI 将本次窗口起点设在历史数据之后、首次新曝光之前；记录空窗口的统计和 Analyze 结果。主批次采集期间 observationEnd 保持开放。每批 flush 后记录明确 UTC 边界，查询使用精确的 `[start,end)`。不能把历史用户混入 800 / 2,000 / 5,000 等主批次人数。
- 主批次结束后保存真实结束时间并关闭其窗口；第 13.3 节探针使用后续独立窗口，完成后通过 UI 恢复本次主窗口并重新 Analyze。保存切换前的结果；探针不与主批次合并，不创建额外 Run。
- 当前 UI 的窗口编辑草稿保留到分钟。UI 切换窗口时使用整分钟边界，必要时等待下一个真实分钟再开始下一组诊断，避免把最后一分钟的数据截掉或混入下一窗口。API 统计查询仍可按真实 UTC 时间做更细的阶段对账；报告必须区分 UI 保存的窗口与秒/毫秒级采集时间，不能声称 UI 已保存其未支持的精度。

### 8.2 用户和预期账本

- 每次执行使用新 `sessionId`；不同实验使用独立用户池，阶段 B 使用此前未出现的新用户。用户附带 `expt_simulator`、`simulation_batch`、`simulation_phase`。
- 使用固定的结果生成 seed；首次生成用户清单和配置快照后保留它们供复核。不要为得到好看的 SRM 或精确相等的人数而按 SDK 变体挑选、丢弃、补齐用户。
- Layer 准入按保存的 layer key、assignment unit 和 slice 独立计算；可以在求值前筛出属于目标 Layer 的用户以控制有效样本规模，但不能按变体或结果筛选。
- 不同实验共用 metric key，事件本身没有 experiment ID。独立用户池避免相互污染；同一业务事件不能为不同实验再上报一份。
- 保存逐用户的 SDK value / variation ID、阶段、Layer eligibility、每个 metric 的实际调用次数与数值、曝光和发送时间边界。预期聚合来自这些明细，不能从服务端统计反推。
- 附加 Layer / 归因负例单独标记，并明确是否属于主分析的预期分母。严禁把未发送的事件记入已发送计数，或盲目重放发送结果不确定的批次。

观察结果前固定以下主批次规模，共 **23,200 名合格曝光用户**：Bayesian 7,800 人，Bandit 15,400 人。人数是每个实验各变体合计，不是每个变体的人数；Layer 准入之外的候选用户不计入此数。

| 实验 | 单批 / 阶段 A | 阶段 B 新用户 | 最终累计 | 初始分流下的期望人数，按第 5 步角色顺序 |
| --- | ---: | ---: | ---: | --- |
| Bayesian Binary | 800 | — | 800 | 400 / 400 |
| Bayesian Count all | 2,000 | — | 2,000 | 1,000 / 1,000 |
| Bayesian Average | 5,000 | — | 5,000 | 2,500 / 2,500 |
| Bandit Once per user | 1,200 | 1,200 | 2,400 | A：840 / 180 / 180 |
| Bandit Sum | 2,000 | 3,000 | 5,000 | A：1,400 / 300 / 300 |
| Bandit Average | 3,000 | 5,000 | 8,000 | A：2,100 / 450 / 450 |

这些分组人数只是期望，不是配额；实际分组以 SDK 为准。B 的期望人数为该实验 B 总人数乘以实际生效的推荐比例，不沿用 70%/15%/15%。

三个 Bandit 均在 A 累计 150 人时 Analyze 并截图；150 人不可能让三个变体同时达到 100 人，能够确定覆盖 burn-in。Once per user 再在 A 累计 600 人时记录一次接近门槛的状态，期望约为 420 / 90 / 90，但是否通过按实际最小组人数判断。之后各自补到表中的固定 A 总数。检查点用户包含在 A 内，不额外增加主批次人数，不根据分析结果临时追加用户。

Bayesian 的样本提示需要单独核对：当前后端以 `MinimumSample` 作为**每变体**门槛，未配置时按 0 处理；前端显示未设置最低人数，不能把它解释为样本充足。本计划以每组 500 人作为门槛用例的目标配置：800 人必有一组不足 500，2,000 / 5,000 人在 50/50 下通常通过，均按实际人数断言。当前前端代码没有该参数的编辑入口；执行前读取实际 Run 配置，已为 500 则直接测试，否则把此门槛用例记为 BLOCKED（配置入口缺失），继续默认行为、数据和分析用例。不静默改写 Run 或分析 JSON 来制造提示。

样本门槛只是当前产品的检查提示，不阻止 Bayesian 计算概率；即使数据呈现明显提升，也可以同时出现“低于最低人数”。人数通过门槛也不代表差异明确。门槛设置入口与 499 / 500 / 501 的精确边界另列在第 13.4 节。

### 8.3 数据分布和测试目的

下表给出**每个合格曝光用户的理论期望**：百分数表示至少触发一次的概率；“次”表示事件次数；数值表示该 metric 聚合后的用户贡献。Primary 越高越好，两个 Guardrails 越高越坏；metric key 和护栏顺序严格使用第 5 步。具体 Track 数组由第 8.4 节模板生成。

| Bayesian 实验 / 变体顺序 | Primary | Guardrail 1 | Guardrail 2 | 主要测试目的 |
| --- | --- | --- | --- | --- |
| Binary，800 人：false / true | Once：30% / 45% | Count：0.10 / 0.10 次 | Sum：10 / 8 | 主指标 +15 个百分点；低样本门槛提示与较强提升信号可同时存在；重复转化去重 |
| Count all，2,000 人：algo-a / algo-b | Count：2 / 3 次 | Binary Once：2% / 12% | Numeric Once：3% / 3% | 主指标 +50%，但一项护栏明显恶化；不能只看收益判断可放量 |
| Average，5,000 人：path-a / path-b | Average：50 / 45 | Average：4 / 3 | Count：0.10 / 0.30 次 | 大样本主指标下降 10%；一项护栏改善、另一项恶化，检查方向及聚合是否混淆 |

例如 Binary 若恰好分为 400 / 400，期望转化人数约为 120 / 180；Count all 若恰好 1,000 / 1,000，期望主指标事件总数约为 2,000 / 3,000。实际计数不能用这些期望数代替 SDK 明细。

| Bandit 实验 / 阶段 / 变体顺序 | Primary | Guardrail 1 | Guardrail 2 | 主要测试目的 |
| --- | --- | --- | --- | --- |
| Once，A+B：style-a / style-b / style-c | Numeric Once：30% / 31% / 30% | Binary Once：4% / 2% / 2% | Count：均为 0.10 次 | 从 burn-in 到人数满足；即使累计 2,400 人，1 个百分点差异仍可能难分胜负；推荐可以继续探索 |
| Sum，A：bar-low / bar-medium / bar-high | Sum：10 / 14 / 18，含 1% 大值用户 | Numeric Once：4% / 2% / 2% | Sum：均为 1 | 非退化、带大值的多事件求和；完整分析后按真实推荐更新分流 |
| Sum，B：bar-low / bar-medium / bar-high | Sum：仍为 10 / 14 / 18 | Numeric Once：4% / 2% / 15% | Sum：1 / 1 / 4 | 只有 bar-high 的两项护栏在 B 恶化；累计分析也须体现风险，停止进一步放量 |
| Average，A：avg-a / avg-b / avg-c | Average：50 / 65 / 57.5 | Average：4 / 3 / 3 | Binary Once：3% / 2% / 2% | avg-b 表现最好，avg-c 次之；检查三臂分析、用户平均和初次推荐 |
| Average，B：avg-a / avg-b / avg-c | Average：50 / 65 / 85 | Average：仍为 4 / 3 / 3 | Binary Once：仍为 3% / 2% / 2% | avg-c 的新用户表现改善；观察阶段数据、累计 P(best) 和推荐变化，验证重新分析不沿用旧结果 |

Average B 的变化是预设的“业务表现随时间变化”用例，不用它证明算法适合所有非平稳场景。A+B 均值按各变体两阶段实际人数加权。例如若 avg-c 的 A/B 人数为 450 / 2,475，其累计理论均值为 `(450*57.5 + 2475*85)/2925 ≈ 80.77`，不是 85，也不是两阶段均值的简单平均。

所有分布在注入前固定；不同 metric 使用独立的结果随机流，不能从主指标的结果直接复制护栏。同分布的护栏可能显示 inconclusive / monitor，不能要求一律显示 clear；小差异也不能硬性要求某一 Arm 获胜。准确聚合是确定性断言，统计方向/概率须用实际账本与记录的分析参数独立核算，不能把随机波动一概判为产品故障，也不能重抽 seed 直到得到想要的结论。

### 8.4 事件模板与聚合断言

先对每个合格曝光用户在有效曝光后、统计窗口内的事件求贡献，再汇总到变体。所有聚合均包含没有指标事件的曝光用户，其贡献为 0。

| Type / Aggregation | 每用户贡献 | 分析数据结构 |
| --- | --- | --- |
| Binary conversion / Once per user | 有任意事件为 1，否则为 0 | proportion：n、k |
| Numeric value / Once per user | 有任意事件为 1，否则为 0；忽略事件值 | numeric：n、sum、sum_squares |
| Numeric value / Count all | Track 次数 | numeric：n、sum、sum_squares |
| Numeric value / Sum values | numericValue 之和 | numeric：n、sum、sum_squares |
| Numeric value / Average values | 用户内 numericValue 的平均值 | numeric：n、sum、sum_squares |

`n` 为合格曝光用户数，`conversions` 为有事件的用户数；`sum` 和 `sum_squares` 分别汇总每用户贡献及其平方。变体均值为 `sum/n`，每个曝光用户权重相同。未触发用户不发送事件；`Track(..., 0)` 仍算一次事件，不能表示 Once 指标未触发。

每个非空数组元素代表一次真实 SDK Track；`[]` 代表不发送该 metric。生成器按第 8.3 节实际变体/阶段取得参数，再使用独立于分流的固定 seed 选择模板。预先写入剧本的生成规则如下：

| 使用范围 | 每用户的事件生成规则 | 理论贡献均值与覆盖点 |
| --- | --- | --- |
| Binary / Numeric Once，概率 p | 概率 1-p 为 `[]`；触发者等概率选择 `[0]`、`[1]`、`[1,10]`、`[0,10,100]` | 均值 p；零值事件也算触发，多次事件只贡献 1；两种 metric 的分析数据结构不同 |
| Count all，期望 λ 次 | 事件次数 K 取 Poisson(λ)；发 K 次，数值循环为 `0,1,10,100` | 均值 λ；数值大小不影响次数，K=0 的用户仍计入 n |
| 普通 Sum，期望 m | 以下四个数组各 25%：`[]`、`[0.5m]`、`[0.5m,m]`、`[m,m]` | 用户贡献为 0 / 0.5m / 1.5m / 2m，均值 m；用于各 Sum 护栏 |
| 带大值 Sum，期望 m | 25% `[]`；50% `[0.4m,0.6m]`；24% `[0.5m,m]`；1% `[4m,10m]` | 均值 `0.50m+0.24*1.5m+0.01*14m=m`；用户贡献方差为 2m²；用于 Bandit Sum Primary |
| Average Primary，期望 m | 以下四个数组各 25%：`[]`、`[m]`、`[m,1.4m]`、`[1.4m,1.8m,2.2m]` | 用户贡献为 0 / m / 1.2m / 1.8m，均值 m；事件数不同且有无事件用户 |
| Average Guardrail，期望 g | 以下四个数组各 25%：`[]`、`[g]`、`[0.5g,1.5g]`、`[1.5g,2g,2.5g]` | 用户贡献为 0 / g / g / 2g，均值 g；与 Primary 独立抽取模板 |

例如 Bayesian Average 的 path-b 使用 m=45，事件为 `[]`、`[45]`、`[45,63]` 或 `[63,81,99]`；Bandit Sum 的 bar-high 使用 m=18，大值用户发送 `[72,180]`，该用户 Sum 贡献 252。带大值用例应保留这些已上报的值，不能自行去极值或裁剪；报告同时记录事件数、贡献平方和和大值用户数。

先用固定明细验证预期账本计算器：四个用户的事件分别为 `[]`、`[50]`、`[50,70]`、`[70,90,110]`，即 Average Primary 的 m=50、每个模板各一人。每种聚合均有 `n=4`、`conversions=3`。

| 聚合 | 四个用户的贡献 | 贡献总和 | 贡献平方和 | 变体均值 |
| --- | --- | ---: | ---: | ---: |
| Once per user | 0、1、1、1 | 3 | 3 | 0.75 |
| Count all | 0、1、2、3 | 6 | 14 | 1.5 |
| Sum values | 0、50、120、270 | 440 | 89,800 | 110 |
| Average values | 0、50、60、90 | 200 | 14,200 | 50 |

Binary Once 使用 `n=4, k=3`；各 Numeric 聚合按表中值构造 `n/sum/sum_squares`。Average Guardrail 的 g=4 四个模板各取一人时，应为 `n=4, sum=16, sum_squares=96, mean=4`。全部 Primary 事件的均值为 `440/6≈73.33`，可与用户平均值 50 和用户累计值均值 110 区分。这些固定明细用于核对计算器，不要求实际 SDK 分流人数或模板比例被人为配平。

实际验收使用完整发送账本，逐项核对 API 聚合、持久化 inputData、UI 显示值与 metric 类型/聚合。累计分析按 A+B 全部用户重算，不直接平均两阶段的均值。

### 8.5 数据 case 与执行位置

| Case | 数据与检查点 | 应观察或验证的行为 |
| --- | --- | --- |
| DATA-01 | 六个 Run 在本次窗口没有曝光时 Analyze | 空状态，不能把 0 人当作有效推荐；与“有曝光但无指标事件”区分 |
| DATA-02 | Bayesian Binary 800 人，目标每组门槛 500 | 门槛已生效则 below minimum；未设置则显示 no minimum set，门槛 case 按第 8.2 节处理 |
| DATA-03 | Bayesian Count / Average 最终批次 | 核对实际每组人数；若设为 500 且均满足，应显示通过，不以总人数代替组人数 |
| DATA-04 | 三个 Bandit A 的 150 人检查点 | 至少一个变体少于 100，enough_units=false，无有效推荐，禁止更新分流 |
| DATA-05 | Bandit Once A 的 600 人检查点 | 约 420 / 90 / 90；验证看最小组，不看总人数或 Baseline 人数；实际达到门槛时应如实通过 |
| DATA-06 | 三个 Bandit 完整 A | 从不足切换到 ready；若实际仍有一组不足 100，记录并阻断更新，不为通过而补样本 |
| DATA-07 | Bayesian Binary；Bandit Average A | 小样本较大提升、大样本明显优势；概率、区间与统计口径一致 |
| DATA-08 | Bandit Once A 与 A+B | 人数充足但小差异；允许 inconclusive / 继续探索，不能把 ready 当成 stopping met |
| DATA-09 | Bayesian Average | Primary 下降、Average 护栏改善、Count 护栏恶化；三个方向各自正确 |
| DATA-10 | Bayesian Count；Bandit Sum B | 主指标好但护栏有害；推荐与是否继续放量分别判断 |
| DATA-11 | Bandit Average B 与 A+B | 后一阶段表现改变；阶段均值、累计均值、P(best)、权重不能混用 |
| DATA-12 | 三个 Bandit A→B | 实际推荐更新、SDK 生效、新用户、动态分流、累计统计均可追溯 |
| DATA-13 | 所有 Once / Count / Sum / Average 事件模板 | 未触发、零值事件、重复事件、多事件不同值的贡献正确；两类 Once 的数据结构正确 |
| DATA-14 | Bandit Sum Primary 的 1% 大值用户 | 真实记录大值、sum_squares 与不确定性；均值不能只由事件数反推 |
| DATA-15 | 同分布及改善的 Guardrails | 区分 clear、inconclusive、ALARM；“未报警”不等于已证明安全 |
| DATA-16 | 第 13.3 节独立诊断窗口及离线明细 | 重复曝光、曝光先后、共享 key、Layer 准入和时间边界；不改变主批次人数 |
| DATA-17 | 第 13.4 节固定边界明细 | 精确人数门槛、零均值、零方差、漏报诊断，不伪造 UI 执行结果 |
| DATA-18 | 每次 Analyze 前后及刷新 | 数据就绪不等于已重新分析；结果时间、累计人数、角色和配置持久化正确 |

## 9. Bayesian：注入、Analyze、核对和截图

三个 Bayesian 分别执行：

1. 保存本次空窗口的页面、Analyze 结果和最低样本量配置；按第 8 步分别生成 800、2,000、5,000 名合格用户，通过 SDK 上报。
2. 等待统计查询中的新增 `users`、`conversions`、`sumValue`、`sumSquares` 与预期账本一致；计数精确比较，浮点数使用记录在报告中的绝对/相对容差。
3. 通过 Computer Use 在现有 Run 1 点击 Analyze；等待加载结束及 computed_at 更新。单纯刷新页面不算重新分析。
4. 核对 Run type、Control/Treatment、三个 metric、样本量、转化率或均值、提升方向、护栏信号；核对服务端持久化 inputData 的 numeric / proportion 结构与精确统计。
5. Binary 检查提升信号与样本提示能否同时呈现；Count all 检查主指标提升但 Binary 护栏恶化；Average 检查主指标下降、Average 护栏改善、Count 护栏恶化。按第 8.4 节核对聚合口径和数据结构。预设的业务负向结果不是测试失败，错误计算或呈现才是。
6. 刷新后核对结果保留。每次分析立即保存原始 inputData、analysisResult 和截图，不等后续分析覆盖。

截图：`09-<experiment>-before-data`、`09-<experiment>-data-ready`、`09-<experiment>-analysis-primary`、`09-<experiment>-analysis-guardrails`、`09-<experiment>-after-refresh`。

## 10. Bandit：第一批数据与第一次完整分析

对三个 Bandit 实验分别执行阶段 A：

1. 截图初始 Targeting 和现有 Measuring 页面，记录阶段 A 的已生效权重及 SDK 同步证据。
2. 上报 A 的前 150 名合格用户，核对入库，使用 UI Analyze。至少一个 Arm 少于 100 人，预期 `enough_units=false`，P(best) / recommended weights 不应伪装成有效推荐；截图低样本状态。
3. Once per user 在累计 600 人时增加一次 Analyze 和截图，检查是否仍有组低于 100，不假定它必定通过或失败。保持初始分流，分别补至 Once 1,200、Sum 2,000、Average 3,000 人。停止上报并 flush，记录各自 A 结束时间与独立数据快照。
4. 在调用下一次 Analyze 前截图当前页面并保存新的统计查询。页面若仍显示低样本分析，明确标为“尚未重新分析”，不能把旧数字当作新数据结果。
5. 通过 UI Analyze，核对 Baseline 与两个 Arms 均参与分析，`enough_units` 与三个实际人数是否均 >= 100 一致。完整 A 预计均通过，但不按变体补齐人数。Primary 和两个 Guardrails 的统计符合第 8.3–8.4 节；Once 的微小差异不能因 burn-in 完成就被当成确定胜出。
6. 保存 A 的 inputData、analysisResult、完整推荐权重、P(best)、停止提示和 SRM；截图主指标/推荐区及两个护栏。

判定规则：P(best) 与 recommended_weight 各自检查其含义和总和，允许模型抽样误差及显示舍入。当前 Top-Two 算法中 P(best) 接近 100% 的 Arm 仍可能只得到约一半推荐权重，不能要求推荐权重等于 P(best)。当前 stopping 的阈值为 P(best) >= 0.95 且 enough_units=true；它与 ready 不同。护栏结论按实际配置和输出判断，不用手写结论覆盖模型。

截图：`10-<experiment>-burn-in-150`、`10-once-near-minimum-600`、`10-<experiment>-phase-a-data-ready`、`10-<experiment>-phase-a-analysis-primary`、`10-<experiment>-phase-a-analysis-guardrails`。

## 11. Bandit：应用推荐分流并截图

1. A 的精确聚合、按实际初始比例的分流校验和 burn-in 必须先通过。核对护栏；若出现非预期的护栏告警或数据异常，保存证据，阻断该实验的更新，不为演示流程而无条件放量。Once 的主指标暂未分出胜负，以及稳定护栏的 inconclusive / monitor，允许在此测试环境继续预定探索；不得把它写成“已证明安全”。其他独立实验可继续。
2. 读取刚保存的服务端推荐权重，不手写理想比例。读取最新 flag revision，将权重按实际 variation ID 映射到第 7 步测试规则。
3. 按 UI/API 支持的精度将权重归一化；记录舍入前推荐与最终保存比例。三个变体均保留非零流量，总和 100%，最后一个累积边界严格为 1。
4. 提交分流配置，打开 UI Targeting，刷新核对并截图。这是显式更新 flag 的步骤；Analyze 自身不会完成它。
5. 等待 SDK 收到新规则，记录配置摘要和同步证据。阶段之间不再发旧配置数据；B 的新用户必须在同步确认之后开始。若同步无法确认则标为 BLOCKED，不能仅凭管理端保存时间划分阶段。
6. 保存新的阶段 B 配置：实际权重、flag revision、保存时间、SDK 确认时间，以及下一批用户清单标识。运行的 Layer 切片和 analysis sampling 不变。

截图：`11-<experiment>-updated-targeting`；若未满足前置条件，则 `11-<experiment>-update-blocked`，并明确没有执行更新。

## 12. Bandit：第二批新用户、再次 Analyze 和截图

1. 使用全新用户 key，在阶段 B 已生效分流下分别生成 Once 1,200、Sum 3,000、Average 5,000 名合格用户；最终累计分别为 2,400、5,000、8,000。沿用同一个实验和 Run 1。
2. 按 SDK 实际分配的变体产生第 8.3 节阶段 B 结果，不复用 A 用户，不把用户按新权重重新指定变体。
3. 完成 flush，保存 B 的精确账本、服务端增量统计与结束时间。分别核对 A、B 和累计 A+B；第二次累计分析的样本不能只有 B，也不能把 A 重复计算。
4. 再次 Analyze 前截图页面，注明当时仍显示的上一轮 computed_at，并把 B 数据快照与截图关联。
5. 通过 UI 再次 Analyze，保存新的 inputData / analysisResult，截图三个变体的人数、Primary、P(best)、推荐权重、停止提示及两个 Guardrails。
6. 核对 B 的流量符合已生效比例，A+B 的人数、指标统计和 UI 值符合完整账本。Once 关注小差异下的不确定性；Sum 关注 bar-high 两项护栏恶化；Average 关注 avg-c 阶段表现改变后累计证据和推荐是否更新。累计结果按实际两阶段人数计算，不能直接要求累计均值等于 B 的目标值。
7. 第二轮仅观察和核对，不自动应用下一次推荐。测试执行器对 Sum 护栏恶化停止进一步放量，是执行器的决定，不声称产品已经实现自动护栏阻断。
8. 刷新后重新核对配置、累计分析、方法和角色，确认每个实验仍只有 Run 1。

截图：`12-<experiment>-phase-b-data-ready`、`12-<experiment>-phase-b-analysis-primary`、`12-<experiment>-phase-b-analysis-guardrails`、`12-<experiment>-after-refresh`。

## 13. SRM、归因与数据正确性校验

### 13.1 SRM 判定口径与产品限制

SRM 的期望人数必须由实际生效的分流概率计算。已知产品限制是后端 `ExperimentService.SrmCheck(long[] observed)` 使用 `expected = total / observed.Length`，Bayesian 与 Bandit 调用均只传 observed，未传实际 rollout 或配置生效历史。执行时核对该实现是否仍有等量假设，并单独验证页面提示。

以 Bandit Average 为例，阶段 A 的 70%/15%/15% 对应 3,000 名合格用户的期望人数为 2,100/450/450。等量假设会将其与 1,000/1,000/1,000 比较，第一次完整分析就可能误报；另外两个 Bandit 按各自 A 人数同理计算。阶段 B 使用实际保存并同步到 SDK 的推荐比例。页面 SRM、实际分流校验和采集计数需要分别判断。

等量假设导致的误报使用问题标识 `SRM-DYNAMIC-001`。报告区分源码检查与现场复现；未执行动态数据流程时，不声称已验证运行结果。若现场产生误报，保留 UI 和阶段证据，将对应 SRM 用例记为 FAIL。

### 13.2 正确的阶段校验

先做确定性核对，再做分流诊断：

1. 每阶段服务端归因人数必须精确等于 SDK 明细中符合窗口、Layer、角色和 sampling 的用户数；每个指标的贡献与统计精确匹配。这一步检查采集和归因，不依赖 SRM 的概率阈值。
2. 对阶段 `t`，用本阶段有效新曝光总数 `N_t` 和阶段开始前已固定的、实际生效的条件分流概率 `p[t,i]`，计算 `E[t,i] = N_t * p[t,i]`。本脚本只有一条匹配测试规则、固定 Layer 和 100% sampling，且阶段内不变更权重；若实际出现其他分支或变更，先分层/拆阶段，不能直接套用原权重。
3. 在每阶段使用与该阶段概率匹配的多项分布检验或 Pearson chi-square；小期望计数使用精确/Monte Carlo 方法。阶段批量预先固定，不能为得到通过的 p 值根据结果延长、截断或重采样。
4. SRM 检查清单预先固定为三个 Bayesian 批次和三个 Bandit 的 A/B 阶段，共 9 次；报告全部 p 值，族错误率阈值设为 0.01，可用 Bonferroni 得到单次阈值 `0.01/9`。低样本截图和累计快照不额外开展反复显著性检验。
5. 累计期望可以展示为 `E[i] = sum_t N_t * p[t,i]`，但动态权重根据早期结果变化，不能把累计人数直接塞入“各组等量”的检验，也不能把累计期望简单代入固定多项分布就宣称取得严格的全程 p 值。正式的整体自适应检验需要覆盖权重选择过程；本轮采用按阶段校验与精确账本。
6. 报告并列展示“页面 SRM（原始输出）”“按阶段实际比例的校验”“SDK 到服务端的精确计数核对”，分别下结论。阶段检验异常也须调查，不能因为存在已知 SRM 限制而掩盖真实漏报。

计算示例：Bandit Average 的 A 有 3,000 人，按 70%/15%/15% 期望为 2,100/450/450；假设 B 的 5,000 人按 10%/45%/45% 分配，期望为 500/2,250/2,250，则累计期望为 2,600/2,700/2,700。B 比例仅作计算演示，实际执行必须读取推荐结果；不要因为累计接近等分，就忽略每阶段完全不同的分流。

SRM 验收既要覆盖正确动态流量不误报，也要覆盖采集漏报仍能被发现；按首次有效曝光所属阶段及其生效概率解释人数。测试中记录产品限制，不自动修改统计实现。

### 13.3 附加归因测试

主批次保留完整截图和封闭窗口后，再运行以下 **412 名额外诊断用户**。每行使用独立的真实时间窗口、独立用户 key；其中分层实验先按 Layer 准入筛选，不能按 SDK 返回变体筛选。使用同一 Run 1 通过 UI 切换窗口、Analyze、截图；最后恢复主窗口并确认主批次人数未增加。

| 诊断 case | 用户数与 SDK 事件 | 确定性断言 / UI 检查 |
| --- | --- | --- |
| PROBE-01 有曝光、无指标，及重复曝光 | 六个实验各 32 人，只 evaluation，不 Track；各自前 16 人再 evaluation 两次 | 每个实验 n=32，而非 64；所有 metric 的 conversions / sum / sum_squares 为 0。与无曝光的空状态不同，不能展示有效收益推荐 |
| PROBE-02 Control 均值为零 | Bayesian Binary 64 人；实际 false 用户无 Primary 事件，true 用户都发 `[1]`；两个 Guardrails 无事件 | 各组 n 按 SDK，false 转化为 0，true 转化为该组 n；双方均有用户时相对提升无法以 0 为分母，须呈现不可计算原因，不显示 NaN / Infinity 或伪造提升百分比 |
| PROBE-03 完全持平、零方差 | Bayesian Average 64 人；所有变体 Primary `[50,50]`，Average Guardrail `[4,4]`，Count Guardrail `[0]` | 所有用户 Primary=50、Guardrail 1=4、Guardrail 2=1；每变体 sum=50n、sum_squares=2500n。双方有用户时当前平坦先验应给 0 提升、P(win)=0.5；图表和区间不能崩溃 |
| PROBE-04 曝光前、窗口内、窗口后 | Bayesian Count 32 人，按生成顺序分四类各 8 人，不按变体分。第一类曝光前发 `[10]`、曝光后发 `[1,9]`；第二类只在曝光前发 `[10]`；第三类曝光后发 `[0]`；第四类在窗口关闭后发 `[1,1,1]`。其余 metrics 无事件 | 窗口内四类 Primary 用户贡献分别为 2 / 0 / 1 / 0，因此总 n=32、conversions=16、sum=24、sum_squares=40。按真实时序等待并 flush，不能回填时间戳 |
| PROBE-05 共同 Layer 与共享 metric key | 一个 60 人池，每人 evaluation 三个分层 flag；曝光后对三个不同 Primary key 各 Track 一次值 2，对四个不同 Guardrail key 各 Track 一次值 1。同一 key 即使绑定多个实验也只发一次 | 三个 Run 的合格 n 之和应为 60，每人只进入一个 slice；各 Run 的 Count / Once Primary 贡献为 1、Sum Primary 贡献为 2。按用户与 key 去重发送，Shared Guardrail 不因绑定多个实验重复上报 |

PROBE-02 / 03 若某个角色没有用户，记录实际的零样本分支，不按变体补人；精确的零均值 / 零方差边界同时由第 13.4 节固定明细覆盖。主批次的模板还覆盖随机无事件用户、不同事件次数和不同 numericValue；不能将这些用户从 n 中删除。

SDK 发送完成不能替代统计落库确认。网络失败或 flush 不确定时先查明批次状态，不盲目重放整批；每个探针保留已发送事件明细和窗口内实际纳入的明细。

### 13.4 精确边界与离线校验

以下固定明细用于生成器的账本计算器和分析契约检查，不通过 REST 注入，也不写入产品的 inputData / analysisResult。将离线结果与 Computer Use 的现场状态分开报告：它们不能代替 UI PASS。

| Case | 固定输入 | 预期 |
| --- | --- | --- |
| BOUNDARY-01 Bayesian 门槛 | MinimumSample=500；人数依次为 499/501、500/500、501/501 | below minimum / passed / passed；说明合计 1,000 人仍可能不足 |
| BOUNDARY-02 门槛未设置 | MinimumSample 为 null 或 0，n=400/400；另测 0/0 | 有样本时显示 no minimum set；零样本显示无数据，不把后端 ok=true 解释为可下结论 |
| BOUNDARY-03 Bandit 每臂门槛 | Baseline/Arms 人数为 1000/99/100、99/1000/1000、100/100/100、101/101/101 | 前两组 enough_units=false、推荐为 null；后两组 enough_units=true。Baseline 也必须满足 100 |
| BOUNDARY-04 0 次事件与值为 0 | 单用户 `[]` 与 `[0]` | 两者 n 均为 1；conversions / Once / Count 分别为 0 与 1；Sum / Average 均为 0 |
| BOUNDARY-05 聚合及退化值 | 第 8.4 节四用户明细；全 0、全 50、零 Control 的独立明细 | n、k、sum、sum_squares 正确；零方差的持平比较不能随机制造优势；零 Control 的相对效果返回可解释状态 |
| BOUNDARY-06 时间边界 | 计算器中事件恰在 start、end、曝光前和曝光同时 | `[start,end)` 排除 end；指标时间 >= 首次合格曝光才可计入。这是离线边界，不声称 SDK 能指定事件时间 |
| BOUNDARY-07 发现漏报和串批 | 从一份诊断用“观测数据副本”删掉一个曝光或事件；再混入一个 B 用户到 A | 精确账本对账必须失败并定位用户/metric/阶段。原账本和真实数据不修改，不依赖 SRM 才发现漏报 |
| BOUNDARY-08 动态分流 | 用保存的 A/B 实际比例核对阶段人数；另用故意错误的等量期望计算诊断值 | 正确比例与等量假设的结果分别展示；固定 seed 下的统计波动按第 13.2 节判断，不要求每次概率检验都通过 |

Bayesian 门槛的 UI 设置入口当前缺失，是门槛现场 case 的前置缺口；代码中存在 `MinimumSample` 不能算 UI 已可设置。报告记录实际版本与配置，不把待补入口或待运行的检查写成已完成。

## 14. 截图、数据快照与报告交付

每个 Bandit 必须给用户保留完整的六阶段证据，以及 150 人检查点（Once 另有 600 人检查点）。分析会覆盖当前 Run 的结果，因此截图和 JSON 必须在进入下一阶段前保存。若前置条件阻断更新，保留阻断现场，并将后续阶段标为 BLOCKED，不用旧截图补齐。

| 阶段 | 必须呈现的截图/证据 | 需要用户能核对的内容 |
| --- | --- | --- |
| 初始分流 | Targeting 页面 | 三个实际值、比例、flag 状态、匹配规则 |
| 第一批数据 | 数据就绪时页面；A 数据快照 | 新增人数、每个指标聚合、页面当时是否还是旧分析 |
| 第一次 Analyze | Measuring 主指标/推荐区和护栏区 | Baseline 与 Arms 的人数、指标、P(best)、权重、护栏、computed_at |
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
snapshots/<experiment>-checkpoint-<users>-analysis.json
snapshots/<experiment>-probe-<case>-analysis.json
targeting/<flag>-before.json
targeting/<flag>-phase-a.json
targeting/<flag>-phase-b.json
data/users-and-metrics.jsonl
data/expected-and-observed.json
data/phase-srm.json
data/offline-case-results.json
```

截图与快照记录时间、实验/Run ID、阶段、页面 URL、flag revision 或 computed_at。使用运行时支持的截图接口；文件只记录真实保存的路径。若只能内联输出截图，则保留任务中的图片和对应观察标识，明确文件导出限制，不能伪造 PNG 路径。截图缺失的阶段不能标记证据完整。

`report.md` 按阶段内联展示截图，并附预期/实际数值表、源 JSON 链接及失败说明。最终回复给用户实际截图或可浏览的截图报告，明确每阶段执行状态，不只给终态截图。

| Case / Step | 实验 / 阶段 | 操作 | 预期 | 实际 | PASS / FAIL / BLOCKED / SKIPPED | 截图与数据快照 |
| --- | --- | --- | --- | --- | --- | --- |
| 执行时填写 | 执行时填写 | 实际操作 | 事先定义的断言 | 现场观察 | 不得预填 PASS | 真实文件或观察标识 |

只把执行过且断言满足的用例记为 PASS；数据正确、UI 正确、动态分流正确和 SRM 提示正确分别判定。保存所有测试数据和当前 Aspire 会话。第 5 步完成后不额外创建 Run、变更实验方法、提交上线决定或清理历史记录。

## 实现参考

- [REST 测试目录说明](./README.md)：可参考统计查询与断言结构，事件注入须改用 SDK。
- [官方 .NET Server SDK](https://github.com/featbit/featbit-dotnet-sdk)：evaluation、Track、flush 与配置同步。
- [统计聚合与归因](../../modules/back-end/src/Infrastructure/Services/EntityFrameworkCore/ExperimentStatsService.cs)。
- [分析、Bandit 权重与 SRM](../../modules/back-end/src/Infrastructure/Services/EntityFrameworkCore/ExperimentService.cs)。
