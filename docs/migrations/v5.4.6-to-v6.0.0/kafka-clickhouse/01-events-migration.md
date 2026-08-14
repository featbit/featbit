# Migration 1：Kafka + ClickHouse Events 数据迁移计划（5.4.6 → 6.0.0）

## 目标与边界

把 5.4.6 已经落入 ClickHouse `featbit.events` 的历史事件迁入 v6.0.0 的两个 release-decision 事件表：

- `FlagValue` → `featbit.release_decision_exposure_events`
- 其他有效 insight event → `featbit.release_decision_metric_events`

Kafka 的 `featbit-insights` 是传输通道，不是历史数据的最终来源。本迁移以 ClickHouse `events` 为准，不通过重放 Kafka topic 搬运历史数据。

假设迁移期间不再产生新事件，因此不需要双写或增量追赶；但切换前仍要确认 5.4.6 consumer 已经处理完 topic 中原有的 backlog。

本计划只处理事件数据。Metric 定义、Experiment、Iteration 不在 Kafka/ClickHouse 中，见第二份计划。

## 新旧对象

| 角色 | 对象 | 用途 |
|---|---|---|
| 5.4.6 Kafka topic | `featbit-insights` | Evaluation Server 发送 insight messages |
| 5.4.6 Kafka engine table | `featbit.kafka_events_queue` | 消费 topic；不作为迁移源 |
| 5.4.6 materialized view | `featbit.events_mv` | 把 Kafka messages 写入旧事实表 |
| 5.4.6 源表 | `featbit.events` | 本次迁移的持久化事实来源 |
| 5.4.6 集群查询表 | `featbit.distributed_events` | 仅在 replication/sharding 部署中存在 |
| v6 目标表 | `featbit.release_decision_exposure_events` | Feature Flag Insights 和实验 exposure |
| v6 目标表 | `featbit.release_decision_metric_events` | 实验 metric events |
| v6 Kafka engine table | `featbit.kafka_insight_events_queue` | 切换后消费新的 insight messages |
| v6 materialized views | `release_decision_exposure_events_mv`、`release_decision_metric_events_mv` | 切换后把新消息写入两个目标表 |

5.4.6 `events` 的实际结构是：

```text
uuid UUID
distinct_id String
env_id String
event String
properties String
timestamp DateTime64(6, 'UTC')
tag_0 ... tag_19 String MATERIALIZED from properties
_timestamp DateTime
_offset UInt64
```

`_timestamp` 和 `_offset` 是旧 Kafka ingestion 元数据，不迁入新事件表。旧表也没有保存 Kafka partition，因此 offset 切换必须从 Kafka consumer group 查询，不能从 `events._offset` 反推。

## 5.4.6 tag 语义

5.4.6 Evaluation Server 同时发送具名 properties 和 tag；旧 ClickHouse DAS 查询实际使用 tag，因此迁移不能只按 v6 materialized view 的具名字段解析。

| 事件 | `tag_0` | `tag_1` | `tag_2` | `tag_3` |
|---|---|---|---|---|
| `FlagValue` | user key | variation ID | `sendToExperiment` 的 `"true"` / `"false"` | user name |
| Metric event | user key | numeric value 的字符串形式 | user name | 通常不存在 |

映射时优先保留旧 DAS 看见的值：user、variation、numeric value 使用 tag 优先；flag 和 metric event name 使用旧 DAS 查询所使用的 `distinct_id` 优先。具名 property 作为 fallback，并用于 mismatch 检查。完整 `properties` 原字符串保留，因此其余 tag 不会丢失。

## 数据映射

### 1. `FlagValue` → `release_decision_exposure_events`

所有字段有效的 `FlagValue` 都迁移，包括 `sendToExperiment=false`。后者仍属于 Feature Flag Insights，不以 `tag_2` 作为迁移过滤条件。

| 5.4.6 源数据 | v6 目标字段 | 规则 |
|---|---|---|
| `uuid` | `id` | UUID 原值 |
| `env_id` | `env_id` | `String` 校验并转为 `UUID` |
| `distinct_id` | `flag_key` | 精确移除前缀 `env_id + '-'`；无法推导时 fallback 到 `properties.featureFlagKey` |
| `tag_0` / `properties.userKeyId` | `user_key` | tag 优先 |
| `tag_3` / `properties.userName` | `user_name` | tag 优先；均缺失时写空字符串 |
| `tag_1` / `properties.variationId` | `variation_id` | tag 优先 |
| `properties.variationValue` | `variation_value` | 5.4.6 标准 payload 没有该字段，缺失时写空字符串；不从当前 flag 配置反推历史值 |
| `timestamp` | `exposed_at` | 原 `DateTime64(6, 'UTC')` instant |
| `properties` | `properties` | 原始 JSON string 完整保留 |
| 迁移执行时间 | `created_at` | UTC `DateTime64(6)` |

如果 `distinct_id` 推导出的 flag key 与 `properties.featureFlagKey` 不同，仍按旧 DAS 的 `distinct_id` 语义迁移，但必须记录 mismatch。tag 与具名字段冲突时同样记录，并采用 tag 值。

### 2. 其他事件 → `release_decision_metric_events`

`event != 'FlagValue'` 且具备有效 env、user、event name 的记录进入 metric event 表。典型类型包括 `CustomEvent`、`PageView` 和 `Click`。

| 5.4.6 源数据 | v6 目标字段 | 规则 |
|---|---|---|
| `uuid` | `id` | UUID 原值 |
| `env_id` | `env_id` | `String` 校验并转为 `UUID` |
| `tag_0` / `properties.userKeyId` / `properties.user.keyId` | `user_key` | tag 优先，其余 fallback |
| `tag_2` / `properties.user.name` | `user_name` | tag 优先；均缺失时写空字符串 |
| `distinct_id` / `properties.eventName` | `event_name` | `distinct_id` 优先，因为 5.4.6 DAS 以它查询 |
| `event` | `event_type` | 原值 |
| `tag_1` / `properties.numericValue` | `numeric_value` | 优先解析 tag，再读取 JSON number；均缺失或无法解析时按 v6 ingestion 语义写 `0` 并报告 |
| `timestamp` | `occurred_at` | 原 `DateTime64(6, 'UTC')` instant |
| `properties` | `properties` | 原始 JSON string 完整保留 |
| 迁移执行时间 | `created_at` | UTC `DateTime64(6)` |

`distinct_id` 与 `properties.eventName` 冲突、tag 与具名 user/numeric value 冲突时，采用旧 DAS 使用的字段并记录 mismatch。

## 执行计划

1. 停止产生新 insight event；保留旧 Kafka → ClickHouse pipeline，直到旧 consumer group `ch_group` 在 `featbit-insights` 的每个 partition 上 `lag=0`。保存 topic 的 partition、log-end offset 和旧 group committed offset。
2. 停止旧 DAS，并停止旧 `events_mv` 消费；对 ClickHouse 数据和 Kafka offsets 做可恢复快照。
3. 在已有 ClickHouse 数据卷上显式执行 v6 DDL，只先创建两个持久化目标表，不启动新的 Kafka table/materialized views。不能依赖 `docker-entrypoint-initdb.d/init.sql` 自动执行，因为已有 volume 不会重新初始化。
4. 预检查并生成 report：按 event/env/month 的源数量、重复 `uuid`、非法 env UUID、非法 JSON、缺失字段、tag-only、named-only、tag/named mismatch，以及目标中已经存在的相同 ID。
5. 按上面的映射从旧持久化表批量写入两个目标表。迁移期间保持新 ingestion 停止，并按 `id` 排除目标中已存在且内容一致的记录；同 ID 内容不同则停止并报告。ClickHouse MergeTree 不保证 `id` 唯一，因此不能依赖表引擎自动去重。
6. 对单节点直接读取 `featbit.events`。对 replicated/sharded 集群，只能选择一种方式执行：从一个 coordinator 读取 `distributed_events` 并写入目标 Distributed 表，或逐 shard 读取 local `events` 一次；不能在每个 replica 重复执行。当前 v6 DDL如果尚未提供 replicated local tables 和 Distributed tables，应先补齐集群 DDL，再执行迁移。
7. 完成数量和查询对账后，在新 consumer group `featbit_clickhouse_release_decision` 没有 active member 时，将它在每个 partition 的 offset 设置到步骤 1 保存的 cutover offset。因为已确认旧 group `lag=0` 且期间没有新消息，该 offset 也是本次切换边界。
8. 创建或 attach v6 `kafka_insight_events_queue` 和两个 materialized views，启动 v6 服务，再发送少量新事件做 smoke test。

迁移必须可重复执行：第二次运行新增行数为 0。源 `events`、旧 consumer group offsets 和 Kafka topic 在完成验收前保留。

## 测试计划

使用与部署版本一致的 Kafka 和 ClickHouse，先运行真实的 5.4.6 Kafka → `events` pipeline，再执行 v6 migration。

测试数据至少覆盖：

- `FlagValue`、`CustomEvent`、`PageView`、`Click`；
- `sendToExperiment=true` 和 `false`；
- tag 与具名字段一致、tag-only、named-only、两者冲突；
- flag key 和 event name 含连字符；
- numeric value 为整数、小数、负数、缺失和非法字符串；
- user name 缺失、额外的 `tag_4 ... tag_19` 及额外 customer properties；
- 非法 env UUID、非法 JSON、缺少 user/variation/event name；
- 重复源 UUID、目标已有一致 ID、目标已有冲突 ID；
- 单 partition、多 partition；如支持集群部署，再覆盖多 shard + replica；
- topic 有 backlog、旧 group 完全追平、切换后发送新事件，以及连续执行两次迁移。

核心断言：

1. 每条源记录恰好属于 exposure、metric、already-present 或 rejected，并且总数完全对账。
2. UUID、env、flag/event name、user、variation、numeric value 和 UTC 时间映射正确。
3. 目标 `properties` 与源 JSON string 完全一致，所有 tag 和额外 property 都保留。
4. `sendToExperiment=false` 的有效 `FlagValue` 也存在于 exposure 表。
5. 用新表计算的 flag count、end-user projection、binary once 和 numeric sum，与 5.4.6 DAS 在同一标准数据集上的结果一致。
6. Kafka cutover 后没有重放历史记录；新消息只进入新表，不再进入旧表。
7. 第二次迁移新增数为 0；集群部署没有因 replica 重复迁入数据。
8. v6 API 配置为 `OLAPProvider=ClickHouse` 后，Feature Flag Insights 和 experiment stats 能从两个新表读取结果。

## 回滚与完成标准

回滚时先停止 v6 materialized views，再按 migration report 删除本次新增的目标 ID；如果目标表在迁移前为空，也可以直接恢复其迁移前快照。恢复旧 consumer 和旧服务时使用步骤 1 保存的 offsets。不得删除旧 `events`、Kafka topic 或迁移前已有的目标数据。

所有字段映射、数量、统计查询、Kafka cutover、集群拓扑和幂等断言通过后，Migration 1 才算完成。
