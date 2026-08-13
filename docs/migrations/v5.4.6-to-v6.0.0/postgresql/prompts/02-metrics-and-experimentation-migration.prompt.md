# Migration 2：PostgreSQL Metrics 与 Experimentation 数据迁移计划（5.4.6 → 6.0.0）

## 目标与边界

把 5.4.6 的 metric 定义、experiment 元数据及 `iterations` 历史结果迁入 v6.0.0 release-decision 数据模型。

- 源数据库在迁移期间没有新增数据，不需要双写或增量追赶。
- 本计划只处理 PostgreSQL。
- 不迁移 `events`，也不写 `release_decision_exposure_events` 或 `release_decision_metric_events`。
- 不从事件重新计算历史 iteration 结果。
- 不为旧实验虚构 layer 或 assignment，因此不写 `release_decision_layers` 和 `release_decision_run_assignments`。
- 原 `experiment_metrics`、`experiments` 及 lookup 表保留不变。

## 涉及的表

| 角色 | 表 | 用途 |
|---|---|---|
| 源表 | `experiment_metrics` | 5.4.6 metric 定义 |
| 源表 | `experiments` | 5.4.6 experiment 与 `iterations` JSONB |
| Lookup | `feature_flags` | flag key、name、variations |
| Lookup | `environments` | experiment 到 project 的关联 |
| Lookup | `projects` | project key |
| 目标表 | `release_decision_metrics` | v6 metric registry |
| 目标表 | `release_decision_experiments` | v6 experiment workspace |
| 目标表 | `release_decision_experiment_runs` | 每个旧 iteration 对应一个 run |
| 目标表 | `release_decision_activities` | 记录迁移来源及无法直接映射的旧状态 |

## 数据映射

### 1. `experiment_metrics` → `release_decision_metrics`

5.4.6 enum：`event_type` 为 Custom=1、PageView=2、Click=3；`custom_event_track_option` 为 Undefined=0、Conversion=1、Numeric=2；`custom_event_success_criteria` 为 Undefined=0、Higher=1、Lower=2。

| 源字段 | 目标字段 | 规则 |
|---|---|---|
| `id` | `id` | 无 key 合并时保持 UUID 不变 |
| `env_id` | `featbit_env_id` | 保持 UUID 不变 |
| `name` | `name` | 原值 |
| `event_name` | `key` | 原值；目标唯一键为 `(featbit_env_id, key)` |
| `description` | `description` | 原值 |
| `event_type` + `custom_event_track_option` | `metric_type` | Custom + Numeric → `continuous`；其他 → `binary` |
| 同上 | `metric_agg` | Custom + Numeric → `sum`；其他 → `once` |
| `custom_event_success_criteria` | `expected_direction` | Lower → `decrease_good`；Higher/Undefined → `increase_good`，Undefined 同时进入报告 |
| `is_arvhived` | `status` | true → `archived`；false → `active` |
| `created_at`、`updated_at` | 同名字段 | 原时间点 |

`maintainer_user_id`、`custom_event_unit`、`element_targets`、`target_urls` 在目标 metric 表没有等价字段：不把它们拼进 description；数据继续保留在旧表，并在 migration report 中列出。

旧表可能存在相同 `(env_id, event_name)`：

- 配置完全兼容的重复项合并为一个目标 metric，并建立 `old_metric_id → target_metric_id` 映射供 experiment 使用；
- metric type、aggregation 或 direction 冲突时先报告并人工确认，不能通过改 key 静默绕开，因为 key 必须继续匹配历史事件名。

### 2. `experiments` → `release_decision_experiments`

| 源数据 | 目标字段 | 规则 |
|---|---|---|
| `experiments.id` | `id` | 保持 UUID 不变 |
| `experiments.env_id` | `featbit_env_id` | 原值 |
| `feature_flags.key` | `flag_key` | 通过 `feature_flag_id` lookup |
| `environments.project_id → projects.key` | `featbit_project_key` | lookup |
| flag name + metric name | `name` | 生成可识别且不超过 256 字符的名称 |
| 无直接来源 | `description` | `NULL`，不把 flag description 冒充 experiment description |
| iteration 数量 | `stage` | 无 iteration → `implementing`；有 iteration → `measuring` |
| 已迁移 metric | `primary_metric` | 使用 v6 JSON 结构：name、event、metricType、metricAgg、expectedDirection、description |
| `feature_flags.variations` | `variants` | 转为 v6 数组：`key`、`name`、`value`、`description` |
| `created_at`、`updated_at` | 同名字段 | 原时间点 |

旧 `status`、`is_archived` 没有等价的 v6 workspace 字段。每个 experiment 在 `release_decision_activities` 写一条 migration activity，记录源 experiment ID、旧 status、archive 状态、metric ID、feature flag ID、alpha 和 iteration 数量。不要因为旧实验结束就伪造 hypothesis、decision 或 learning。

### 3. `experiments.iterations[]` → `release_decision_experiment_runs`

5.4.6 的 `iterations` 是 JSONB 数组，正常字段使用 camelCase，例如 `id`、`startTime`、`endTime`、`eventType`、`eventName`、`customEventTrackOption`、`customEventSuccessCriteria`、`results`、`isFinish`。

| 源 iteration | 目标字段 | 规则 |
|---|---|---|
| `id` | `id`、`run_id` | 正常值为 UUID 字符串；目标 UUID 保持一致，原字符串同时写入 `run_id` |
| JSON 数组顺序 | `slug` | 生成稳定的 `legacy-1`、`legacy-2`…… |
| `isFinish`、`results` | `status` | 未结束且无结果 → `collecting`；已有结果或已结束 → `analyzing`；不伪造 `decided` |
| 固定迁移标识 | `method` | `legacy_frequentist`，不能标成 `bayesian_ab` 或 `bandit` |
| iteration event snapshot | `primary_metric_event/type/agg` | 优先使用 iteration 自身字段，而不是可能已被修改的 metric 当前值 |
| `baseline_variation_id` | `control_variant` | 原 variation ID |
| iteration result variation IDs | `treatment_variant` | 除 baseline 外用 `|` 连接；无结果时 fallback 到 flag variations |
| `startTime`、`endTime` | `observation_start`、`observation_end` | 原时间点 |
| `results` + experiment `alpha` | `analysis_result` | 保存为带版本和来源标识的 legacy artifact，完整保留旧结果，不转换成 v6 Bayesian/Bandit 输出 |
| 无可靠来源 | `input_data` | `NULL`；不能从汇总结果伪造原始观测数据 |
| `startTime` | `created_at` | 原时间点 |
| `updatedAt` / `endTime` / `startTime` | `updated_at` | 按顺序 fallback |

legacy `analysis_result` 必须在当前读取路径中明确显示为“从 5.4.6 导入、未重新计算”的只读历史结果，并保留原始 `IterationResult` 字段，例如 variationId、conversion、conversionRate、average、uniqueUsers、totalEvents、confidenceInterval、pValue、effectSize、isWinner 和 reason。不得把旧 `alpha` 映射成 Bayesian prior。

## 执行步骤

1. 对数据库做可恢复快照，并先部署 v6.0.0 schema。
2. 执行只读预检查：
   - metric enum 值及 `(env_id, event_name)` 重复/冲突；
   - experiment 对 environment、project、flag、metric 的缺失引用；
   - `iterations` 是否为合法数组，iteration ID 是否为 UUID，时间和 results 是否可解析；
   - baseline/result variation 是否存在于相应 flag；
   - 目标表中相同 ID 或唯一 key 的已有记录及内容冲突。
3. 按依赖顺序迁移：metrics → experiments → runs → migration activities。迁移期间保存 old metric ID 到 target metric ID 的映射。
4. 相同 ID/key 且内容一致视为已迁移；内容不同则停止并报告，不覆盖用户已有的 v6 数据。
5. 输出 migration report：每类源记录的 migrated、merged、already-present、rejected 数量，以及所有缺失引用、冲突和无法直接映射的字段。
6. 完成 API/UI smoke test 和总量对账后结束迁移窗口。

迁移必须可重复执行；第二次运行不得产生重复 metric、experiment、run 或 activity。

## 测试计划

使用临时 PostgreSQL，加载真实的 5.4.6 schema 和当前 v6.0.0 schema。至少覆盖：

- Custom Conversion、Custom Numeric、PageView、Click，以及 Higher、Lower、Undefined；
- active/archived metric；
- 相同 event name 的兼容重复与冲突重复；
- 零个、一个、多个 iterations；
- 正在运行、已结束、已归档、缺少 results 的 iteration；
- binary 与 numeric 历史结果、baseline 加多个 treatment；
- 缺失 flag/metric/project、非法 iteration JSON 和非法 iteration ID；
- 目标表已有一致记录、已有冲突记录，以及连续执行两次迁移。

核心断言：

1. 每个源 metric 都被 migrated、merged、already-present 或 rejected，并有 old-to-target ID 映射。
2. 每个源 experiment 都被 migrated、already-present 或 rejected；每个合法 iteration 恰好对应一个 run。
3. metric type/agg/direction、flag/project、primary metric、variants、control/treatments 和 observation window 映射正确。
4. legacy result 和 alpha 完整保留，并被标记为 5.4.6 历史结果；迁移及首次读取不会触发重新分析。
5. API 能列出迁移后的 metrics/experiments，UI 能打开 experiment 和 legacy run，不把旧结果显示为新的 Bayesian/Bandit 结论。
6. 第二次运行新增数为 0；源表内容不变；事件相关三张表完全未被本迁移修改。

## 回滚与完成标准

写入前记录目标表已有记录。若需回滚，按 activities → runs → experiments → metrics 的逆序，仅删除本次新增记录；被合并到迁移前已有 metric 的记录不能删除。全部映射、数量、API/UI smoke test、历史结果标识和幂等测试通过后，Migration 2 才算完成。
