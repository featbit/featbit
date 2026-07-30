# FeatBit 运维稳定性 OTEL 优先级

> 范围：`modules/back-end`、`modules/evaluation-server`；不包含计费和 Guarded Rollout 产品指标。
> 基线：FeatBit `3cd4cb17`，2026-07-30。指标名称为建议语义，不是最终命名规范。

## 1. 结论

先做 Metric，再补少量 Trace：

1. 第一迭代完成 M1–M6，用于告警。
2. 第一条自定义 Trace 做 T1 Flag Change 端到端传播。
3. 高吞吐链路只保留错误、慢操作或采样 Trace。
4. 已有 HTTP、Runtime 和依赖自动遥测不重复建设。

| 阶段 | 内容 |
|---|---|
| 前置 | 修正 OTEL service name/endpoint，确认 `otelcol_*` receiver refused、export failure、queue saturation 已告警 |
| P0 | M1–M6 |
| P1 | T1、M7–M8、T2–T3 |
| P2 | M9–M10、T4–T5 |

性能分级：**很低**为状态 Gauge/低频 Counter；**低**为每连接、变更或批次记录；**中**为每消息或 Histogram；**高**为逐 evaluation、逐 fanout 连接或高基数遥测。

## 2. Metric：从高到低

| 编号 | 建议 Metric | 做什么 / 为什么 | 性能与默认策略 |
|---|---|---|---|
| **M1 P0** | `streaming.upgrade.requests` Counter；`sockets.active`、`subscriptions.active` Gauge；`connection.closed` Counter；`connection.duration` Histogram | 计算每秒新增 WS、物理连接数、逻辑环境订阅数和异常关闭。FeatBit Agent 的一条 `relay-proxy` 物理 WS 可承载多个环境订阅，因此 socket 与 subscription 必须分开。 | 总量很低，常开。`subscriptions.active{env.id}` 仅按需开放；每次采集扫描全部连接不可取。 |
| **M2 P0** | `messaging.operations`、`messages.dropped/redelivered` Counter；`queue.depth`、`oldest_message.age`、`consumer.running/last_success.age` Gauge；`operation.duration` Histogram | 发现 MQ 发布失败、消费者停止、积压和静默丢数。只看 queue depth 无法发现少量消息长期卡住。 | Counter 低至中；队列查询中。属性仅 `provider/destination/operation/outcome`。 |
| **M3 P0** | `flag_change.operations` Counter；`propagation.duration` Histogram；`fanout.connections{outcome}` Counter；`config.last_success.age/revision.lag` Gauge | 判断 Flag 是否完成 commit、publish、consume、fanout，并识别“WS 在线但配置传播已停滞”。服务端边界止于 socket send。 | 低，常开。一次变更聚合记录 target/success/failure；不使用 `flag.key` 或 `env.id` label。 |
| **M4 P0** | `store.available/selected/last_success.age` Gauge；`health_check.operations/failover.transitions` Counter；`health_check.duration` Histogram | 区分正常、备用 store、无可用 store，并发现故障切换抖动。健康端点只有当前状态，没有趋势。 | 很低，常开；不进入 evaluation 热路径。 |
| **M5 P0** | `buffer.items/capacity/bytes` Gauge；`items.dropped` Counter；`flush.operations`、`loop.failures` Counter；`flush.duration/batch.size` Histogram；`worker.running/last_success.age` Gauge | 发现 usage、insight、PostgreSQL notification 和 MQ worker 的队列饱和、丢弃、flush 失败或静默停摆。 | 很低至低，常开。若 queue depth 需要数据库扫描，则降低采集频率。 |
| **M6 P0** | `ratelimit.decisions{allowed,rejected,fail_open}` Counter；`streaming.validation.operations` Counter | 发现 Redis 限流异常后的 fail-open，以及 WS 校验失败是无效凭据还是依赖不可用。 | 低，常开。禁止记录 token、secret、query、IP 或错误正文。 |
| **M7 P1** | `streaming.messages`、`messages.invalid`、`send.failures` Counter；`message.size`、`sync.duration/payload.size/items` Histogram；`sync.operations` Counter | 定位 malformed/oversized 消息、大 payload、full sync 过慢和 socket send 失败。 | Counter 常开；Histogram 为中，优先覆盖 full sync、错误和慢操作，不统计 ping/pong 时延分布。 |
| **M8 P1** | `insight.events{accepted,invalid,publish_failed}` Counter；`request.batch.size/payload.size` Histogram | 区分未收到事件、校验拒绝、MQ 发布失败和后续处理失败；HTTP 200 不代表事件已进入管道。 | 中。按请求或批次记录，不逐事件创建高基数属性；不作为计费真值。 |
| **M9 P2** | `evaluations` Counter；`evaluation.batch.size/duration` Histogram | 统计 ELS evaluation 容量，并区分规则计算与 HTTP、认证、依赖延迟。 | Counter 中；duration 中至高。Histogram 为诊断项，可限时开启；不带 flag/env/variant/context label。 |
| **M10 P2** | `flag_schedule.executions/lag/duration`；`webhook.deliveries/retries/duration`；`startup.cache_population/duration` | 发现计划任务延迟、Webhook 重试失败和启动缓存填充卡住。 | 很低至低。URL、webhook id、schedule id、workspace id 不作 label。 |

共同约束：

- active Gauge 按服务实例上报，全局值在查询侧求和。
- 默认属性仅使用 `outcome`、`operation`、`connection.type`、`provider` 等有限枚举。
- `env.id` 仅为少数明确场景提供受控 View；禁止 token、secret、用户、连接和 flag 标识进入 Metric。
- 遥测出口拥塞时不得阻塞 Streaming 或 evaluation。

## 3. Trace：从高到低

| 编号 | Trace | 用途 | 性能策略 |
|---|---|---|---|
| **T1 P1** | `flag_change.persist → publish → consume → fanout` | 定位一次变更卡在数据库、MQ、consumer 还是 WS 推送。每次变更只建一个聚合 `fanout` Span，记录 target/success/failure 和总耗时。 | 低。采样正常链路，保留错误和超时；禁止逐连接 fanout Span。 |
| **T2 P1** | `streaming.handshake → validate → accept/reject` | 定位普通连接或 FeatBit Agent `relay-proxy` 连接失败在 token、store、限流还是 WebSocket accept。 | 低至中。正常低比例采样；保留拒绝、异常和慢握手；握手后立即结束。 |
| **T3 P1** | `streaming.sync` | 定位 full/patch 同步的 store、序列化、payload 和 socket send 瓶颈。 | 中。仅保留错误、超时、慢同步和少量正常样本。 |
| **T4 P2** | `insight/usage ingest → publish → consume → flush` | 定位“入口成功但未落库”的异步阶段。 | 逐事件全量为高；仅做批次 Trace，并采样或保留 error/slow。 |
| **T5 P2** | FeatBit Agent Relay Proxy sync、Schedule、Webhook | Agent sync 覆盖 scope/data 加载、bootstrap payload、Agent HTTP response 和 DataVersion 更新；另补充 Schedule、Webhook 的低频阶段。 | 低，默认关闭。服务端可追踪到 Agent HTTP response；Agent 内部 Trace 需要 Agent 传播 context 并导出到同一后端。 |

若第三方平台需要 Change Tracking，可增加低频 `featbit.flag.change` 结构化 Event；T1 表示传播过程，Event 表示变更发生时刻。

### 3.1 Trace 开关

建议新增独立于全局 OTEL 的 FeatBit 参数：

```text
FEATBIT_OTEL_CUSTOM_TRACES=flag_change
FEATBIT_OTEL_CUSTOM_TRACE_SAMPLE_RATIO=0.05
```

- `flag_change`：低频，建议默认开启或低比例采样。
- `streaming_handshake`、`streaming_sync`、`insight_pipeline`、`agent_relay_sync`、`schedule`、`webhook`：默认关闭，排障时限时加入参数。
- 开关判断应发生在创建 Span、计时和构造属性之前；关闭时只保留一次轻量判断。
- 环境变量方案需要滚动重启；若必须在线启用，可改为动态配置，但不能在请求中远程读取配置。
- Collector 过滤只能减少导出和存储，不能消除应用内创建 Span 的成本。

P0 Metric 应常开：先由 Metric 告警，再临时启用对应 Trace。全局 `OTEL_TRACES_SAMPLER` 会同时影响自动 HTTP Trace，不适合作为业务 Trace 的分类开关。

## 4. 代码审计发现的关键风险

| 风险 | 后果 | 对应信号 |
|---|---|---|
| Kafka handler 失败后仍可能 store offset | 失败消息不再消费 | M2、M3、T1 |
| Redis 先 `LPop` 再处理 | handler 失败后消息丢失 | M2、T1 |
| PostgreSQL notification Channel 使用 `DropOldest`，未检查 `TryWrite` | 服务不崩溃但旧通知被覆盖 | M2、M5 |
| 部分 producer 捕获异常后只写日志 | 上游误认为发布成功 | M2、T1 |
| Worker 停止后不再产生 error | 仅看失败次数无法发现停摆 | M2、M5 |
| FeatBit Agent 一条 `relay-proxy` socket 对应多个环境 | 物理连接数低估订阅和故障影响面 | M1 |
| Fanout 顺序发送 | 慢连接拉长整次传播 | M3、M7、T1 |

遥测只能暴露这些风险；ack、重试和持久化语义仍需单独修复。

## 5. 暂时不要做

| 项目 | 原因 |
|---|---|
| 每次 ELS evaluation 建 Span | 数量大；HTTP Trace 与 M9 足够用于日常告警，逐 flag Span 还有高基数风险。 |
| 每条 WS message 建 Span | 数据量大、价值低；用 M7 和 error/slow 的 T3。 |
| 每个 fanout 连接建 Span | 一次变更产生 O(连接数) Span；只保留一个聚合 fanout Span。 |
| 一个 Span 覆盖整个 WS 生命周期 | Span 可能持续数天；用短握手 Trace、active Gauge 和 close Counter。 |
| SaaS 默认给所有 Metric 增加 `env.id` | 时间序列基数、存储和查询成本高；只做受控 View。 |
| Metric 使用 flag/user/context/connection/token/URL | 高基数或敏感数据风险。具体对象仅放入受控 Trace/Log，token/secret 永不记录。 |
| Insight、Usage、evaluation 100% 全量 Trace | CPU、分配、网络和存储成本高；Trace 也不是精确计数工具。 |
| 用平台 OTEL 数据直接驱动 Guarded Rollout | OTEL 用于可观测和关联，不能替代可靠的 exposure/outcome 数据与回滚状态机。 |

## 6. 第一迭代

必须完成：

1. M1 Streaming；
2. M2 MQ；
3. M3 Flag Change 传播；
4. M4 Store；
5. M5 Buffer/Worker；
6. M6 rate-limit fail-open；
7. 对上述指标及 `otelcol_*` 建立告警。

有余量再增加 T1。其余项由真实告警和故障模式驱动。

## 7. 审计依据

- [StreamingMiddleware](modules/evaluation-server/src/Streaming/StreamingMiddleware.cs)
- [ConnectionManager](modules/evaluation-server/src/Streaming/Connections/ConnectionManager.cs)
- [FeatureFlagChangeMessageConsumer](modules/evaluation-server/src/Streaming/Consumers/FeatureFlagChangeMessageConsumer.cs)
- [DataSyncService](modules/evaluation-server/src/Streaming/Services/DataSyncService.cs)
- [StoreAvailableSentinel](modules/evaluation-server/src/Infrastructure/Store/StoreAvailableSentinel.cs)
- [evaluation-server Kafka consumer](modules/evaluation-server/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs)
- [evaluation-server PostgreSQL consumer](modules/evaluation-server/src/Infrastructure/MQ/Postgres/PostgresMessageConsumer.cs)
- [back-end Kafka consumer](modules/back-end/src/Infrastructure/MQ/Kafka/KafkaMessageConsumer.cs)
- [back-end Redis consumer](modules/back-end/src/Infrastructure/MQ/Redis/RedisMessageConsumer.cs)
- [UsageTracker](modules/back-end/src/Application/Usages/UsageTracker.cs)
- [UsageFlushWorker](modules/back-end/src/Infrastructure/AppService/UsageFlushWorker.cs)
- [InsightsWriter](modules/back-end/src/Infrastructure/AppService/InsightsWriter.cs)
- [OnFeatureFlagChanged](modules/back-end/src/Application/FeatureFlags/OnFeatureFlagChanged.cs)
- [SyncToAgent](modules/back-end/src/Application/RelayProxies/SyncToAgent.cs)
- [AgentService](modules/back-end/src/Infrastructure/Services/AgentService.cs)
