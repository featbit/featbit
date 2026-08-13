# Migration 1：PostgreSQL Events 数据迁移计划（5.4.6 → 6.0.0）

## 目标与边界

把 PostgreSQL 5.4.6 `events` 中的历史事件迁入 v6.0.0 的 release-decision 事件表，使 Feature Flag Insights 和新的实验统计能够读取历史事件。

- 源数据库在迁移期间没有新增事件，不需要双写、watermark 或增量追赶。
- 本计划只处理 PostgreSQL。
- 本计划只迁移事件证据，不处理 metric 定义、experiment 或 iteration。

## 涉及的表

| 角色 | 表 | 用途 |
|---|---|---|
| 源表 | `events` | 5.4.6 的 FlagValue 与 metric events |
| 目标表 | `release_decision_exposure_events` | Feature Flag evaluation/exposure events |
| 目标表 | `release_decision_metric_events` | CustomEvent、PageView、Click 等 metric events |
| 校验 lookup | `feature_flags`、`environments` | 校验环境、flag key 和 variation；不修改 |

5.4.6 PostgreSQL 的 `events` 结构是：

```text
id uuid primary key
distinct_id varchar not null
env_id varchar
event varchar
properties jsonb
timestamp timestamp without time zone
```

## 5.4.6 tag 语义

PostgreSQL 中不存在独立的 `tag_0` 列；它们是 `properties` JSONB 内的字段。5.4.6 Evaluation Server 通常同时写入具名属性和 tag，但旧 DAS 的 PostgreSQL 查询实际读取的是 tag，因此迁移时不能忽略它们。

| 事件 | `tag_0` | `tag_1` | `tag_2` | `tag_3` |
|---|---|---|---|---|
| `FlagValue` | user key | variation ID | `sendToExperiment` 的 `"true"` / `"false"` | user name |
| Metric event | user key | numeric value 的字符串形式 | user name | 通常不存在 |

迁移规则：tag 与具名属性都存在且一致时正常迁移；只存在 tag 时仍需迁移；两者不一致时记录 mismatch，并采用旧 PostgreSQL DAS 实际使用的 tag 值。完整 `properties` 必须原样保留。

## 数据映射

### 1. `FlagValue` → `release_decision_exposure_events`

所有字段完整且可识别的 `FlagValue` 都迁移，包括 `sendToExperiment=false`。后者仍属于 Feature Flag Insights；`sendToExperiment` 保留在 `properties` 中，不作为本次迁移的过滤条件。

| 源数据 | 目标字段 | 规则 |
|---|---|---|
| `events.id` | `id` | 保持 UUID 不变 |
| `events.env_id` | `env_id` | 校验并转换为 UUID |
| `properties.featureFlagKey` | `flag_key` | 缺失时仅可通过移除 `distinct_id` 的精确前缀 `env_id + '-'` 推导；两者冲突则报告 |
| `properties.tag_0` / `properties.userKeyId` | `user_key` | tag 优先，具名字段 fallback |
| `properties.tag_1` / `properties.variationId` | `variation_id` | tag 优先，具名字段 fallback |
| 无可靠历史字段 | `variation_value` | 写 `NULL`；5.4.6 payload 未记录该值，不使用当前 flag 配置反推历史值 |
| `events.timestamp` | `exposed_at` | 按 UTC 解释后写入 `timestamptz` |
| `events.properties` | `properties` | 完整保留，包括所有 tag |
| 迁移执行时间 | `created_at` | UTC |

### 2. 其他事件 → `release_decision_metric_events`

该路径与 v6 当前 ingestion 一致：除 `FlagValue` 之外、具备必要字段的事件进入 metric event 表。

| 源数据 | 目标字段 | 规则 |
|---|---|---|
| `events.id` | `id` | 保持 UUID 不变 |
| `events.env_id` | `env_id` | 校验并转换为 UUID |
| `properties.tag_0` / `properties.userKeyId` / `properties.user.keyId` | `user_key` | tag 优先，其余作为 fallback |
| `events.distinct_id` / `properties.eventName` | `event_name` | `distinct_id` 优先，因为旧 DAS 以它查询；冲突时记录 mismatch |
| `events.event` | `event_type` | 原值保留，例如 `CustomEvent`、`PageView`、`Click` |
| `properties.tag_1` / `properties.numericValue` | `numeric_value` | 优先解析 tag 字符串，再读取 JSON number；缺失时按 v6 ingestion 行为写 `0` |
| `events.timestamp` | `occurred_at` | 按 UTC 解释后写入 `timestamptz` |
| `events.properties` | `properties` | 完整保留，包括所有 tag |
| 迁移执行时间 | `created_at` | UTC |

`tag_2`/`tag_3` 中的 user name 没有对应目标列，但不会丢失，因为完整 JSON 会写入 `properties`。

## 执行步骤

1. 对数据库做可恢复快照，并先部署 v6.0.0 schema，确认两个目标表及索引存在。
2. 执行只读预检查：
   - 按 `event` 统计源数据量；
   - 统计非法 `env_id`、缺少必要字段、无法解析的 numeric value；
   - 统计 tag-only、named-only、tag/named mismatch；
   - 检查目标表中是否已有相同 `id`，并区分内容相同与内容冲突。
3. 将可迁移的 `FlagValue` 写入 exposure 表，再将其他事件写入 metric event 表。大数据量时分批执行，但每批都使用确定性的源 `id`。
4. 相同 `id` 且内容一致视为已迁移；相同 `id` 但内容不同必须停止并报告，不能静默覆盖。
5. 输出 migration report：源数据量、插入量、已存在量、非法量、mismatch 数量及对应 ID。
6. 完成对账后再结束迁移窗口。源表继续保留，作为回查依据。

迁移必须可重复执行：第二次执行不新增重复记录，也不改变第一次迁移的结果。

## 测试计划

使用临时 PostgreSQL，创建真实的 5.4.6 `events` schema 和当前 v6.0.0 目标 schema。

测试数据至少覆盖：

- `FlagValue`、`CustomEvent`、`PageView`、`Click`；
- named-only、tag-only、两者一致、两者冲突；
- `sendToExperiment=true` 与 `false`；
- nested user、top-level user 和 `tag_0`；
- JSON numeric value、字符串 `tag_1`、缺失或非法 numeric value；
- flag key 含连字符，以及通过 `distinct_id` fallback 的情况；
- 非法 env UUID、缺少必要字段和空 properties；
- 非 UTC PostgreSQL session 下的时间迁移；
- 目标表已有相同记录、已有冲突记录，以及连续执行两次迁移。

核心断言：

1. 每个源 ID 最终只能属于 exposure、metric、已存在或 rejected 四类之一。
2. `源总数 = 新增数 + 已存在且一致数 + rejected 数`。
3. 字段映射正确，`properties` JSON 语义等价，tag 没有丢失。
4. `sendToExperiment=false` 的有效 FlagValue 也存在于 exposure 表。
5. 时间点与源事件代表的 UTC instant 完全一致。
6. 第二次运行新增数为 0；源 `events` 的行数和内容没有变化。
7. 用目标表重算的典型 flag count、binary once 和 numeric sum 与 5.4.6 PostgreSQL DAS 在同一数据集上的结果一致。

## 回滚与完成标准

写入前记录目标表已有 ID；如需回滚，只删除本次新增的目标 ID，不触碰迁移前已有记录和源 `events`。迁移完成的标准是所有对账断言通过、冲突均有明确报告、重复执行无副作用。
