# Migration 2：MongoDB Metrics 与 Experimentation 数据迁移计划（5.4.6 → 6.0.0）

## 目标与边界

把 MongoDB 5.4.6 的 metric 定义、experiment 元数据和 `iterations` 历史结果迁入 v6.0.0 release-decision collections。

- 源数据库在迁移期间没有新增数据，不需要双写或增量追赶。
- 本计划只处理 MongoDB。
- 不迁移 `Events`，也不写两个 release-decision event collections。
- 不从 event 重算历史 iteration，不伪造 layer、assignment、hypothesis、decision 或 learning。
- 旧 collections 和 lookup collections 保留不变。

## 涉及的 collections

| 角色 | Collection | 用途 |
|---|---|---|
| 源 | `ExperimentMetrics` | 5.4.6 metric 定义 |
| 源 | `Experiments` | 5.4.6 experiment，内嵌 `iterations[]` 和 `results[]` |
| 只读 lookup | `FeatureFlags` | flag key、name、variations |
| 只读 lookup | `Environments` | experiment 到 project 的关联 |
| 只读 lookup | `Projects` | project key |
| 只读 lookup | `Users` | 核对旧 `maintainerUserId`；不修改 |
| 目标 | `ReleaseDecisionMetrics` | v6 metric registry |
| 目标 | `ReleaseDecisionExperiments` | v6 experiment workspace |
| 目标 | `ReleaseDecisionExperimentRuns` | 每个旧 iteration 对应一个 run |
| 目标 | `ReleaseDecisionActivities` | 迁移来源以及完整旧配置快照 |

本迁移不写 `ReleaseDecisionLayers` 和 `ReleaseDecisionRunAssignments`，因为 5.4.6 没有可可靠映射的数据。

5.4.6 和 v6 的 typed MongoDB entities 都采用 camelCase element name；entity `Id` 存为 `_id`，Guid 使用 Standard UUID binary（subtype 4），时间为 BSON Date。目标中的 `primaryMetric`、`variants`、`analysisResult` 和 activity `detail` 是 JSON string，不是 BSON 子文档。

## 全字段使用与映射

### 1. `ExperimentMetrics` → `ReleaseDecisionMetrics`

5.4.6 enum：`eventType` 为 Custom=1、PageView=2、Click=3；`customEventTrackOption` 为 Undefined=0、Conversion=1、Numeric=2；`customEventSuccessCriteria` 为 Undefined=0、Higher=1、Lower=2；`targetUrls[].matchType` 当前只有 Substring=1。

| 5.4.6 字段/property | 旧用途 | v6 处理 |
|---|---|---|
| `_id` | metric ID、experiment 引用 | 无 key 合并时保持 UUID；合并时建立 old-to-target ID map |
| `envId` | 环境隔离和查询 | `featBitEnvId` |
| `name` | catalog/UI 显示 | `name` |
| `description` | catalog/UI 描述 | `description` |
| `maintainerUserId` | old UI maintainer lookup | 目标 metric 无对应字段；写入引用它的 migration activity 完整快照，并列入报告 |
| `eventName` | 从 `Events` 选择 metric event | `key`；保持原 event name |
| `eventType` | Custom/PageView/Click 行为 | 参与计算 `metricType`、`metricAgg`，并保留在 legacy 快照 |
| `customEventTrackOption` | Conversion/Numeric 统计方式 | Custom+Numeric → continuous/sum；其他 → binary/once |
| `customEventUnit` | numeric metric 的单位和旧结果显示 | 保留在 legacy run artifact/activity；目标 metric 和 run 均无对应 unit 字段 |
| `customEventSuccessCriteria` | Higher/Lower 判断 winner | Lower → `decrease_good`；Higher/Undefined → `increase_good`；Undefined 报告 |
| `elementTargets` | Click metric 的元素选择配置 | 保留在 activity/报告；v6 metric registry 无对应字段 |
| `targetUrls` | PageView/Click URL 匹配配置 | 完整保留数组及每项 `id`、`matchType`、`url`；目标 metric 无对应字段 |
| `isArvhived` | 旧 catalog archive 过滤，字段名含历史拼写错误 | true → `status=archived`；false → `status=active` |
| `createdAt`、`updatedAt` | 审计时间 | 原 BSON instant 写入同名目标字段 |

目标 metric 核心映射：

| 源 | 目标 |
|---|---|
| `envId` | `featBitEnvId` |
| `eventName` | `key` |
| Custom + Numeric | `metricType=continuous`、`metricAgg=sum` |
| 其他组合 | `metricType=binary`、`metricAgg=once` |
| Lower | `expectedDirection=decrease_good` |
| Higher / Undefined | `expectedDirection=increase_good` |

旧数据可能有相同 `(envId, eventName)`。配置兼容时合并到一个目标 metric，并保存每个 old metric ID 的映射；type、aggregation 或 direction 冲突时停止该组并报告，不能改 `key` 绕开，因为它必须继续匹配历史 event name。

### 2. `Experiments` → `ReleaseDecisionExperiments`

| 5.4.6 字段/property | 旧用途 | v6 处理 |
|---|---|---|
| `_id` | experiment ID | 保持 UUID |
| `envId` | 环境和 project lookup | `featBitEnvId`；再由 `Environments.projectId → Projects.key` 得到 `featBitProjectKey` |
| `metricId` | primary metric 引用 | 使用 old-to-target metric map 构造 `primaryMetric` JSON string |
| `featureFlagId` | flag 和 variations 引用 | lookup `FeatureFlags`，写 `flagKey` 和 `variants` |
| `isArchived` | 旧 experiment archive 状态 | activity 完整记录；不虚构 v6 workspace 状态 |
| `status` | `NotStarted`、`Paused`、`Recording` 生命周期 | activity 完整记录；不把它当成 v6 decision |
| `baselineVariationId` | iteration baseline | 写入每个目标 run 的 `controlVariant` |
| `iterations` | 每轮配置和历史结果 | 每项生成一个 `ReleaseDecisionExperimentRuns` document |
| `alpha` | 旧 frequentist 显著性阈值 | 完整写入 legacy analysis artifact/activity；不映射为 Bayesian prior |
| `createdAt`、`updatedAt` | 审计时间 | 原 BSON instant |

`ReleaseDecisionExperiments` 的字段映射：

| 目标字段 | 来源/规则 |
|---|---|
| `_id` | 旧 experiment `_id` |
| `name` | flag name + metric name，稳定生成且不超过 256 字符 |
| `description` | `null`；不把 flag description 冒充 experiment description |
| `stage` | 无 iteration → `implementing`；有 iteration → `measuring` |
| `flagKey` | `FeatureFlags.key` |
| `featBitProjectKey` | `Environments.projectId → Projects.key` |
| `featBitEnvId` | `Experiments.envId` |
| `primaryMetric` | 完整 JSON string：`name`、`event`、`metricType`、`metricAgg`、`expectedDirection`、可选 `description` |
| `variants` | 完整 JSON string 数组：每个 `FeatureFlags.variations[]` 映射为 `key=id`、`name`、`value`；`description` 按当前 builder 规则由 name/value 生成 |
| `sandboxStatus` | `idle` |
| `createdAt`、`updatedAt` | 旧审计时间 |

每个迁移后的 experiment 生成一条 `ReleaseDecisionActivities` migration activity。`detail` 使用版本化 Extended JSON string，保存完整源 `Experiments` document、引用的完整 `ExperimentMetrics` document、lookup ID、迁移映射和来源版本。这样 `maintainerUserId`、URL/element tracking 配置、旧状态、alpha 以及未来发现的额外 BSON property 都不会被静默忽略。未被任何 experiment 引用的 metric 的无对应字段仍保留在源 collection，并在 migration report 中完整列出。

| Activity 字段 | 规则 |
|---|---|
| `_id` | 由 migration version + experiment ID 确定性生成 |
| `experimentId` | 目标 experiment `_id` |
| `type`、`title` | `migration` 和明确的 5.4.6 MongoDB 导入标题 |
| `detail` | 上述完整、版本化 Extended JSON snapshot |
| `actorType`、`actorName` | `system` 和 migration 标识；不冒充旧 maintainer |
| `createdAt` | 迁移执行 UTC 时间 |

### 3. `iterations[]` → `ReleaseDecisionExperimentRuns`

旧 iteration 的每个字段都要处理：

| `iterations[]` property | 旧用途 | v6 处理 |
|---|---|---|
| `id` | iteration UUID string | 解析为目标 `_id` UUID binary；原字符串写 `runId` |
| `startTime`、`endTime` | observation window | `observationStart`、`observationEnd` |
| `updatedAt` | iteration 更新时间 | 目标 `updatedAt` fallback 来源 |
| `isArchived` | 旧 iteration archive/lock 语义 | legacy artifact 完整保留 |
| `eventType`、`eventName` | 当次运行的 metric snapshot | 写 `primaryMetricType`、`primaryMetricEvent`；优先使用 snapshot 而不是当前 metric |
| `customEventTrackOption` | 当次 Conversion/Numeric 方式 | 写 `primaryMetricType`、`primaryMetricAgg`，并保留原 enum |
| `customEventUnit` | 当次 numeric unit | legacy artifact 完整保留；目标 run 没有 unit 字段 |
| `customEventSuccessCriteria` | 当次 Higher/Lower 方向 | legacy artifact 保留 |
| `results` | 旧统计结果 | 完整写入 versioned legacy `analysisResult` JSON string |
| `isFinish` | 旧运行完成状态 | 状态映射和 legacy artifact |

`results[]` 中以下 property 必须逐项原值保留，不能只保存 winner：

`changeToBaseline`、`confidenceInterval`、`conversion`、`conversionRate`、`totalEvents`、`average`、`isBaseline`、`isInvalid`、`isWinner`、`pValue`、`uniqueUsers`、`variationId`、`effectSize`、`reason`。

目标 run 映射：

| 目标字段 | 来源/规则 |
|---|---|
| `_id`、`runId` | 旧 iteration `id` |
| `experimentId` | 父 experiment `_id` |
| `slug` | 按源数组顺序稳定生成 `legacy-1`、`legacy-2`…… |
| `status` | 未完成且无结果 → `collecting`；已完成或已有结果 → `analyzing`；不伪造 `decided` |
| `method` | `legacy_frequentist`，明确区别于 v6 `bayesian_ab` / `bandit` |
| `methodReason` | 说明数据从 5.4.6 iteration 导入 |
| `primaryMetricEvent/type/agg` | iteration 自身的 event snapshot |
| `metricDescription` | 原 metric description；旧 unit 仅保留在 legacy artifact，避免改变描述语义 |
| `controlVariant` | experiment `baselineVariationId` |
| `treatmentVariant` | result 中非 baseline variation ID，以 `|` 连接；无结果时 fallback 到 flag variations |
| `observationStart`、`observationEnd` | iteration 时间 |
| `analysisResult` | versioned legacy artifact：完整 iteration、全部 results、experiment alpha、来源 ID 和迁移版本 |
| `inputData` | `null`；不能用聚合结果伪造原始 observation |
| decision/learning 相关字段 | `null`；旧 winner 不是 v6 release decision |
| `createdAt`、`updatedAt` | `startTime`；更新时间依次 fallback `updatedAt`、`endTime`、`startTime` |

legacy run 必须作为“5.4.6 导入、未重新计算”的只读历史结果展示。首次读取不能触发 v6 Bayesian/Bandit 分析并覆盖 `analysisResult`；UI/API 需要能识别 `legacy_frequentist`，而不是把未知 method 显示为 Bayesian。

## 额外 property 检查

执行迁移前，用 `$objectToArray` 和数组展开对以下层级做字段 profile：

- `ExperimentMetrics` 顶层与 `targetUrls[]`；
- `Experiments` 顶层；
- `iterations[]`；
- `iterations[].results[]`；
- `FeatureFlags.variations[]`。

profile 结果必须与上面的字段清单对账。源 collections 必须以原始 `BsonDocument` 读取，不能只反序列化为旧 typed entity；项目的 `IgnoreExtraElements` convention 会令未知字段静默消失。发现未知 property 时，先确认 5.4.6 代码或客户数据是否使用；有业务意义的字段必须增加明确映射或写入 versioned legacy artifact/activity 后才能执行，不能静默 drop。

## 执行步骤

1. 对 MongoDB 做可恢复快照，确认源和目标使用同一个预期 database，并部署可读取 legacy run 的 v6 代码。
2. 只读预检查：完整字段/BSON type profile；metric key 重复；experiment 对 environment/project/flag/metric 的缺失引用；iteration ID、时间、results 和 variation 引用；目标 `_id` 与唯一 key 冲突。
3. 按依赖顺序迁移：`ReleaseDecisionMetrics` → `ReleaseDecisionExperiments` → `ReleaseDecisionExperimentRuns` → `ReleaseDecisionActivities`。所有 `_id` 和 activity ID 都确定性生成。
4. 相同 ID/key 且内容一致视为已迁移；内容不同则停止并报告，不使用 `ReplaceOne` 覆盖已有 v6 document。迁移不依赖跨 collection transaction，也应能安全重跑。
5. 核对目标索引，至少保证 metric `(featBitEnvId, key)` 唯一、run `(experimentId, slug)` 唯一，并覆盖 experiment 的 env/project/flag 查询。
6. 输出 migration report：migrated、merged、already-present、rejected 数量，old-to-target ID map，缺失引用、冲突、未知 property 和无直接目标字段的完整值。

## 测试计划

使用临时 MongoDB，并按真实 BSON 类型加载 5.4.6 documents。至少覆盖：

- Custom Conversion、Custom Numeric、PageView、Click；Higher、Lower、Undefined；active/archived；
- `maintainerUserId`、`customEventUnit`、`elementTargets`、完整 `targetUrls[]`，以及额外未知 property；
- 相同 `(envId,eventName)` 的兼容重复和冲突重复；
- experiment 的 `NotStarted`、`Paused`、`Recording`、archived，零个/一个/多个 iterations；
- iteration 所有字段，binary/numeric results、baseline 加多个 treatment，以及全部 14 个 result property；
- 缺失 flag/metric/project、非法 UUID、BSON type 异常、未知 variation；
- 目标已有一致 document、已有冲突 document，以及连续运行两次。

核心断言：

1. 每个源 metric 和 experiment 都进入 migrated、merged/already-present 或 rejected，并能从 old ID 追踪到目标 ID。
2. 每个合法 iteration 恰好生成一个 run；metric type/agg/direction、flag/project、variants、baseline/treatments 和时间窗口映射正确。
3. activity 的 source snapshot 和 legacy `analysisResult` 包含所有源字段；逐项比较全部 iteration/result/property 名称、值和数组顺序。
4. API 能列出迁移后的 metrics/experiments；UI 能打开 legacy run，并明确显示为 imported frequentist result。
5. 迁移和首次读取不会重新分析或改变旧结果，也不会生成 layer、assignment、decision 或 learning。
6. 第二次运行新增数为 0；源 `ExperimentMetrics`、`Experiments` 和所有 lookup collections 内容不变；event collections 完全未修改。

## 回滚与完成标准

迁移前记录目标 collections 的已有 ID。若需回滚，按 `ReleaseDecisionActivities` → `ReleaseDecisionExperimentRuns` → `ReleaseDecisionExperiments` → `ReleaseDecisionMetrics` 的逆序，只删除本次新增 document；合并到迁移前已有 metric 的记录不能删除。全字段对账、API/UI smoke test、legacy 只读行为和幂等测试全部通过后，Migration 2 才算完成。
