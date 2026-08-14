# Migration 2：Kafka + ClickHouse 部署下的 Metrics 与 Experimentation 迁移计划（5.4.6 → 6.0.0）

## 结论与边界

Kafka 和 ClickHouse 中没有 5.4.6 的 metric 定义、experiment 元数据或 iteration 历史结果，因此这一部分不存在 `ClickHouse old table → ClickHouse new table` 的迁移。

- Kafka `featbit-insights` 只传输 exposure 和 metric events。
- ClickHouse `events` 只保存事件事实；它属于 Migration 1。
- `ExperimentMetrics`、`Experiments` 和 `Iterations` 由 API Server 的主数据库保存。

所以本计划的工作是：根据客户的 `DbProvider` 运行 PostgreSQL 或 MongoDB 的 Migration 2，然后验证这些控制面数据能够与 Migration 1 迁入 ClickHouse 的事件正确关联。不要从 Kafka messages 或 ClickHouse events 反推 metric 定义、experiment 或历史结果。

## 涉及的数据对象

| 数据 | 5.4.6 来源 | v6 目标 | Kafka/ClickHouse 是否写入 |
|---|---|---|---|
| Metric 定义（PostgreSQL） | `experiment_metrics` | `release_decision_metrics` | 否 |
| Experiment（PostgreSQL） | `experiments` | `release_decision_experiments` | 否 |
| Iteration（PostgreSQL） | `experiments.iterations` JSONB | `release_decision_experiment_runs` | 否 |
| Migration audit（PostgreSQL） | 由迁移生成 | `release_decision_activities` | 否 |
| Metric 定义（MongoDB） | `ExperimentMetrics` | `ReleaseDecisionMetrics` | 否 |
| Experiment（MongoDB） | `Experiments` | `ReleaseDecisionExperiments` | 否 |
| Iteration（MongoDB） | `Experiments.iterations[]` | `ReleaseDecisionExperimentRuns` | 否 |
| Migration audit（MongoDB） | 由迁移生成 | `ReleaseDecisionActivities` | 否 |
| Exposure / metric events | ClickHouse `events` | 两个 `release_decision_*_events` 表 | 是；由 Migration 1 处理 |

官方 5.4.6 PostgreSQL + Kafka + ClickHouse 部署使用 PostgreSQL 保存控制面数据，因此默认执行：

- [PostgreSQL Metrics 与 Experimentation 迁移计划](../postgresql/prompts/02-metrics-and-experimentation-migration.prompt.md)

如果客户的 API Server 实际配置为 MongoDB、ClickHouse 仅作为 OLAP，则执行：

- [MongoDB Metrics 与 Experimentation 迁移计划](../mongodb/02-metrics-and-experimentation-migration.md)

上述计划负责完整字段映射；本文件不复制另一份不同版本的映射规则。

## 跨数据库关联

完成两个 migration 后，以下 key 必须对得上：

| 控制数据库中的 v6 数据 | ClickHouse v6 事件字段 | 用途 |
|---|---|---|
| metric `featbit_env_id` | event `env_id` | 环境隔离 |
| metric `key` / experiment primary metric event | metric event `event_name` | 找到指标事件 |
| experiment `flag_key` | exposure `flag_key` | 找到实验曝光 |
| experiment variants 的 `key` | exposure `variation_id` | 分组到 control/treatment |
| run observation window | `exposed_at` / `occurred_at` | 选择同一统计时间范围 |
| experiment/run 的 env | 两类 event 的 `env_id` | 防止跨环境串数 |

5.4.6 iteration 的历史聚合结果仍按 PostgreSQL/MongoDB Migration 2 保存为 legacy result；不能使用迁入 ClickHouse 的 events 自动重算并覆盖它。

## 执行计划

1. 从 API Server 配置确认真实 `DbProvider`，不要根据 ClickHouse 的存在猜测主数据库。
2. 先对主数据库、ClickHouse 和 Kafka offsets 做同一迁移窗口的快照。
3. 按对应数据库的 Migration 2 迁移 metrics → experiments → runs → activities；同时按 Migration 1 迁移 ClickHouse events。两部分可以独立执行，但必须使用同一组 env、flag、variation 和 event-name 规则验收。
4. 配置 v6 API 使用原主数据库保存控制面数据，并设置 `OLAPProvider=ClickHouse`、正确的 `ClickHouse__HttpEndpoint` 和 database，使统计查询读取 ClickHouse 新事件表。
5. 输出一份联合 report：控制数据库迁移数量、ClickHouse 事件迁移数量，以及所有无法关联的 env、flag key、variation ID 和 metric event name。

## 测试计划

至少准备一个包含 Custom Conversion、Custom Numeric、PageView 或 Click metric 的旧 experiment，并包含一个已完成 iteration 和对应的 ClickHouse events。

核心断言：

1. PostgreSQL/MongoDB 对应 Migration 2 的字段、数量、legacy result 和幂等测试全部通过。
2. Kafka 和 ClickHouse 中没有新增 metric definition、experiment、run 或 activity 表/消息。
3. v6 API 能列出迁移后的 metric 和 experiment；UI 能打开旧 run，并明确显示为 imported legacy result。
4. 对每个 experiment，flag key、variation ID、metric event name 和 env ID 都能在 ClickHouse 新事件表中找到对应数据；无法关联的项进入 report。
5. v6 对同一 observation window 查询 ClickHouse 时能得到预期 exposure/metric 样本，但不会重新计算或覆盖旧 iteration result。
6. 切换后新建一个测试 run，发送新的 Kafka insight messages，确认新 run 的统计读取 ClickHouse，而 metric/experiment 配置仍写入主数据库。
7. 两部分 migration 各运行两次后均不产生重复记录。

## 完成标准

主数据库 Migration 2 完成、ClickHouse Migration 1 完成、跨数据库 key 全部对账，并且 API/UI 的 legacy read 与新 run smoke test 都通过后，Kafka + ClickHouse 部署的 Metrics 与 Experimentation 迁移才算完成。
