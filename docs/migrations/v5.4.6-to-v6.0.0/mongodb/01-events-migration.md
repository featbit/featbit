# Migration 1：MongoDB Events 数据迁移计划（5.4.6 → 6.0.0）

## 目标与边界

把 MongoDB 5.4.6 `Events` 中的历史事件迁入 v6.0.0 的 release-decision event collections，使 Feature Flag Insights 和新的实验统计能够读取历史数据。

- 源数据库在迁移期间没有新增事件，不需要双写、watermark 或 change stream。
- 本计划只处理 MongoDB。
- 本计划只迁移 event evidence，不处理 metric 定义、experiment 或 iteration。

## 涉及的 collections

| 角色 | Collection | 用途 |
|---|---|---|
| 源 | `Events` | 5.4.6 的 `FlagValue` 与 metric events |
| 目标 | `ReleaseDecisionExposureEvents` | Feature Flag evaluation/exposure events |
| 目标 | `ReleaseDecisionMetricEvents` | `CustomEvent`、`PageView`、`Click` 等 metric events |
| 只读 lookup | `FeatureFlags`、`Environments` | 校验环境、flag key 和 variation；不修改 |

正常的 5.4.6 Evaluation Server 写入如下 BSON document：

```text
{
  _id: <UUID string>,
  distinct_id: <string>,
  env_id: <UUID string>,
  event: <string>,
  properties: <BSON document>,
  timestamp: <BSON Date>
}
```

旧 DAS 的内部 `/events` 路径还可能留下 `_id: ObjectId` 和 `id: <UUID string>`。迁移预检查必须识别实际 BSON 类型，不能假设所有 `_id` 都是 MongoDB UUID binary。

v6 目标 collection 使用 camelCase 字段和 Standard UUID binary（subtype 4）。其中 `properties` 不是 BSON 子文档，而是保存完整 JSON 的 string；迁移应使用与当前 `ReleaseDecisionInsightWriter` 相同的 BSON-to-JSON 序列化行为。源 event 必须按原始 `BsonDocument` 读取，避免反序列化时丢掉未知字段或 BSON 类型。

## 旧字段与 property 使用清单

### 顶层字段

| 5.4.6 字段 | 旧逻辑中的用途 | 迁移处理 |
|---|---|---|
| `_id` | 正常 ingestion 的事件唯一 ID | 优先作为目标 `_id` 来源 |
| `id` | 旧 DAS 内部写入路径的 UUID | `_id` 不是 UUID 时作为 fallback |
| `distinct_id` | metric event name；也包含 `env_id-featureFlagKey` | 用于 event name，或缺少 flag key 时精确推导 |
| `env_id` | 旧查询的环境过滤条件 | 转为目标 `envId` UUID binary |
| `event` | 区分 `FlagValue`、`CustomEvent`、`PageView`、`Click` | 决定目标 collection，并写入 metric `eventType` |
| `properties` | 用户、variation、metric 数值及上下文 | 完整保存，不能只挑选已知字段 |
| `timestamp` | 旧统计的事件时间 | 写入 `exposedAt` 或 `occurredAt` |

### `FlagValue.properties`

| Property | 5.4.6 中的意义/使用 | 目标处理 |
|---|---|---|
| `route` | ingestion route | 保留在完整 `properties` |
| `flagId` | flag UUID 上下文 | 保留；目标 event 没有同名列 |
| `envId` | properties 内的冗余环境 ID | 保留；与顶层 `env_id` 不一致时报告 |
| `accountId` | workspace/account 上下文 | 保留 |
| `projectId` | project 上下文 | 保留 |
| `featureFlagKey` | flag insights 的 flag key | 写入 `flagKey` |
| `sendToExperiment` | 旧实验 exposure 查询的过滤条件 | 完整保留；不用于排除 Insights 事件 |
| `userKeyId` | flag/end-user/experiment 统计的 user key | 写入 `userKey` |
| `userName` | 旧 end-user insight 显示 | 保留；目标没有 user-name 列 |
| `variationId` | exposure 和 variation 统计 | 写入 `variationId` |
| `tag_0` | user key 的兼容副本 | 具名字段缺失时 fallback |
| `tag_1` | variation ID 的兼容副本 | 具名字段缺失时 fallback |
| `tag_2` | `sendToExperiment` 的字符串副本 | 保留并用于一致性检查 |
| `tag_3` | user name 的兼容副本 | 保留 |

### Metric event `properties`

| Property | 5.4.6 中的意义/使用 | 目标处理 |
|---|---|---|
| `route` | ingestion route | 保留 |
| `type` | metric event type 的副本 | 保留；与顶层 `event` 不一致时报告 |
| `eventName` | metric event name | 与 `distinct_id` 交叉检查并作为 fallback |
| `numericValue` | 旧 numeric experiment 的数值 | 写入 `numericValue` |
| `user.keyId` | 旧 MongoDB experiment 查询实际读取的 user key | 写入 `userKey` |
| `user.name` | user name | 保留 |
| `applicationType` | SDK/application 上下文 | 保留 |
| `projectId`、`envId`、`accountId` | 事件上下文 | 保留；`envId` 与顶层值交叉检查 |
| `tag_0` | user key 的兼容副本 | 具名 user 字段缺失时 fallback |
| `tag_1` | numeric value 的字符串副本 | `numericValue` 缺失时 fallback |
| `tag_2` | user name 的兼容副本 | 保留 |

迁移前还要用 `$objectToArray` 对真实 `properties` key 做一次 profile。上表之外的客户自定义或历史字段也必须完整进入目标 `properties` JSON string，并在测试中验证；迁移实现不能使用 property whitelist。

与 PostgreSQL 不同，5.4.6 MongoDB DAS 查询实际读取具名 property，而不是 `tag_*`。因此具名字段与 tag 冲突时记录 mismatch，并以具名字段为准；tag 只作为缺失字段的兼容 fallback。

## 数据映射

### 1. `FlagValue` → `ReleaseDecisionExposureEvents`

所有字段完整且可识别的 `FlagValue` 都迁移，包括 `sendToExperiment=false`，因为它们仍属于 Feature Flag Insights。

| 源数据 | 目标字段 | 规则 |
|---|---|---|
| `_id` / `id` | `_id` | UUID string 或 UUID binary 转为 Standard UUID binary；否则用源 collection + 原 `_id` 生成稳定 UUID，并报告 |
| `env_id` | `envId` | 校验 UUID 后转为 Standard UUID binary |
| `properties.featureFlagKey` | `flagKey` | 缺失时仅可从 `distinct_id` 移除精确前缀 `env_id + '-'`；冲突时报告 |
| `properties.userKeyId` / `tag_0` | `userKey` | 具名字段优先 |
| `properties.variationId` / `tag_1` | `variationId` | 具名字段优先 |
| 无可靠历史字段 | `variationValue` | 写 `null`；5.4.6 未记录该值，不从当前 flag 配置反推历史值 |
| `timestamp` | `exposedAt` | 保持同一个 UTC instant |
| 完整 `properties` BSON document | `properties` | 使用当前 writer 相同方式序列化为完整 JSON string，包括所有 tag 和未知字段 |
| 迁移执行时间 | `createdAt` | UTC |

### 2. 其他事件 → `ReleaseDecisionMetricEvents`

| 源数据 | 目标字段 | 规则 |
|---|---|---|
| `_id` / `id` | `_id` | 与 exposure event 相同的确定性 UUID 规则 |
| `env_id` | `envId` | 校验 UUID 后转为 Standard UUID binary |
| `properties.user.keyId` / `properties.userKeyId` / `tag_0` | `userKey` | 旧 MongoDB 查询使用 nested user；其余依次 fallback |
| `distinct_id` / `properties.eventName` | `eventName` | `distinct_id` 优先，因为旧 MongoDB DAS 以它查询；冲突时报告 |
| `event` | `eventType` | 原值，例如 `CustomEvent`、`PageView`、`Click` |
| `properties.numericValue` / `tag_1` | `numericValue` | 具名 BSON number 优先；tag 字符串 fallback；缺失时按当前 ingestion 写 `0` 并报告非法 numeric case |
| `timestamp` | `occurredAt` | 保持同一个 UTC instant |
| 完整 `properties` BSON document | `properties` | 序列化为完整 JSON string，不丢失 nested user、tag 或客户字段 |
| 迁移执行时间 | `createdAt` | UTC |

## 执行步骤

1. 对 MongoDB 做可恢复快照，确认 v6 应用使用的数据库名和目标 collections。
2. 只读预检查：按 `event` 统计数量，profile 顶层字段和全部 property key/BSON type，统计非法 UUID、时间、必要字段、named-only、tag-only、named/tag mismatch，以及目标 `_id` 冲突。
3. 按批迁移：先写 `ReleaseDecisionExposureEvents`，再写 `ReleaseDecisionMetricEvents`。使用确定性 `_id` 和 insert-if-absent；相同 ID 内容一致视为已迁移，内容冲突则停止并报告，不覆盖已有 v6 数据。
4. 核对并补齐目标查询索引：exposure 至少覆盖 `envId + flagKey + exposedAt`、`envId + userKey + exposedAt`；metric event 至少覆盖 `envId + eventName + occurredAt`、`envId + eventName + userKey + occurredAt`。
5. 输出 migration report：源数量、新增、已存在、rejected、mismatch、非标准 BSON shape，以及对应源 `_id`。

迁移必须可重复执行：第二次执行新增数为 0，且源 `Events` 不发生变化。

## 测试计划

使用临时 MongoDB，写入真实 BSON 类型的 5.4.6 documents 和当前目标 collections。至少覆盖：

- `FlagValue`、`CustomEvent`、`PageView`、`Click`；
- named-only、tag-only、两者一致和两者冲突，并断言 MongoDB 采用 named-first；
- `sendToExperiment=true` 与 `false`；
- `_id` 为 UUID string、UUID binary、ObjectId + `id`，以及需要稳定 fallback ID 的记录；
- nested user、top-level user、tag user；BSON int/long/double、numeric tag、缺失或非法 numeric value；
- 所有上表中的 properties，再加入 nested object、array 和额外客户 property；
- 非法 env UUID、缺少必要字段、空 properties、时间异常；
- 目标已有一致记录、已有冲突记录，以及连续运行两次。

核心断言：

1. 每个源 event 恰好进入 exposure、metric、already-present 或 rejected 一类，且数量完全对账。
2. 目标 UUID、UTC 时间、flag/user/variation/event/numeric 映射正确。
3. 解析目标 `properties` string 后，与源 BSON document 的字段和值语义等价；所有已知、tag、nested 和额外 property 均存在。
4. `sendToExperiment=false` 的有效 `FlagValue` 也进入 exposure collection。
5. 用目标 collections 计算的典型 flag count、end-user projection、binary once 和 numeric sum 与 5.4.6 MongoDB DAS 在同一数据集上的结果一致。
6. 第二次运行新增数为 0，源 `Events` 的数量、BSON 类型和内容不变。

## 回滚与完成标准

写入前记录目标 collections 已有 ID。若需回滚，只按 migration report 删除本次新增的目标 ID，不触碰迁移前已有记录和源 `Events`。所有字段 profile、映射、数量、查询结果、完整 properties 和幂等断言通过后，Migration 1 才算完成。
