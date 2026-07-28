# FeatBit OTEL、Guarded Rollout 与 SaaS 计量建议

> 静态审计基线：FeatBit `b47a80b4`、Rust Server SDK `e0462ff`，2026-07-27；范围为 `modules/back-end`、`modules/evaluation-server`、`infra/otel` 及 `featbit-rust-sdk`。

## 1. 当前可以暴露什么

两个服务都在镜像中安装了 .NET Auto-Instrumentation `1.7.0`，由 `ENABLE_OPENTELEMETRY=true` 启用，并经 OTLP 导出 trace、metric、log；Collector 再分别输出到 Jaeger、Prometheus、Seq 和文件。代码中尚无自定义 `ActivitySource` 或 `Meter`。

| 信号 | 当前能力 | 主要缺口 |
|---|---|---|
| Trace | ASP.NET Core 入站 HTTP、HttpClient 出站，以及自动插桩版本支持的 EF Core/Npgsql、StackExchange.Redis、Kafka 等依赖调用。 | 无 feature-flag evaluation、WS 握手/消息/data-sync、insight、后台任务等业务 span；WS HTTP span 会覆盖整个长连接生命周期。Auto-Instrumentation `1.7.0` 仅声明支持 MongoDB Driver `<3.0`，当前项目为 `3.8.1`，不能假设存在 MongoDB span。 |
| Metric | ASP.NET Core/HTTP Client 请求时延及 .NET 8+ 部分内置 HTTP/Kestrel 指标；进程与 Runtime 的 CPU、内存、GC、JIT、ThreadPool、异常等。 | `1.7.0` 没有提供 FeatBit、WS、DB、缓存、MQ、队列或后台任务指标；Kestrel 连接数也无法可靠区分 WS，更无法按 `env.id` 统计。 |
| Log | Serilog 结构化日志通过 OTLP 输出，并包含 `TraceId`/`SpanId`；已有 API 请求、WS 校验、消息消费、store、后台任务和异常日志。 | WS 连接增删日志为 `Trace`，默认 `Information` 级别下不会输出，也不应由日志反推连接数。当前部分日志会记录完整 query、token 或消息内容，存在密钥/PII 泄露风险。 |

依据：[back-end 启动脚本](modules/back-end/start.sh)、[evaluation-server 启动脚本](modules/evaluation-server/start.sh)、[OTEL Collector 三条 pipeline](infra/otel/otel-collector-config.yml#L94)、[v1.7.0 自动插桩覆盖表](https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/blob/v1.7.0/docs/config.md)、[WS 连接管理](modules/evaluation-server/src/Streaming/Connections/ConnectionManager.cs#L8)、[WS 结构化日志](modules/evaluation-server/src/Streaming/Connections/ConnectionManager.Log.cs#L9)。

当前配置还应先处理三项风险：

- `back-end` 镜像默认 `OTEL_SERVICE_NAME=featbit-els`，两个镜像的默认 endpoint 都误写为 `locahost`；Compose 虽有覆盖，但其他部署方式会出错。
- Auto-Instrumentation 的 `ILogger` exporter 与 `Serilog.Sinks.OpenTelemetry` 同时启用，存在日志重复导出风险；Serilog 又硬编码了 service name，应统一为一条日志链路并统一资源属性。
- 服务已使用 .NET 10 和较新的依赖，但自动插桩仍固定为 `1.7.0`；应升级后做一轮三类信号 smoke test，并核对 Collector 的 `http.target` 过滤规则是否仍匹配实际属性。

## 2. 建议新增的 Metric

### P0：直接支撑容量、稳定性和用量

| Metric（建议类型） | 含义与低基数属性 |
|---|---|
| `featbit.streaming.upgrade.requests`（Counter） | WS upgrade 尝试；`outcome=accepted/invalid/unavailable/rate_limited`、`sdk.type`。每秒新增连接用 `rate(...[1m])` 计算，不记录“每秒速率 Gauge”。 |
| `featbit.streaming.sockets.active`（ObservableGauge） | 当前**物理 WS** 数，按实例上报；属性仅 `sdk.type=client/server/relay_proxy`，全局值按实例求和。 |
| `featbit.streaming.subscriptions.active`（ObservableGauge） | 当前按 `env.id` 的**逻辑订阅**数，属性为 `env.id`、`sdk.type`。普通 SDK 通常一条 socket 对应一个订阅；Relay Proxy 一条物理 socket 可映射多个 env，因此必须与上一指标分开。 |
| `featbit.streaming.socket.duration`（Histogram）与 `.closed`（Counter） | 连接寿命和关闭结果；`sdk.type`、`outcome=normal/client_abort/server_error/shutdown`、有限集合的 `close.code`。 |
| `featbit.streaming.messages`（Counter）与 `.message.size`（Histogram） | WS 消息数和字节数；`direction`、`message.type`、`outcome`、`sdk.type`。 |
| `featbit.streaming.sync.duration`（Histogram）与 `.sync.payload.size`（Histogram） | full/patch data-sync 的时延与响应体大小；`sync.type`、`sdk.type`、`outcome`。 |
| `featbit.evaluations`（Counter） | ELS API 实际执行的 flag evaluation 数；`env.id`、`operation`、`outcome`。不要以请求数代替 evaluation 数，也不统计 Server SDK 内的本地 evaluation。 |
| `featbit.insight.events`（Counter） | insight 接收、校验和发布结果；`env.id`、`event.type`、`outcome=accepted/invalid/publish_failed`。 |
| `featbit.ratelimit.decisions`（Counter） | `policy`、`outcome=allowed/rejected/fail_open`、`backend=local/redis`；重点告警 Redis 异常后的 fail-open。 |

Prometheus 示例（以 exporter 的实际转换名为准）：每秒成功新建 WS 用 `sum(rate(featbit_streaming_upgrade_requests_total{outcome="accepted"}[1m]))`；总物理连接用 `sum(featbit_streaming_sockets_active)`；按环境订阅数用 `sum by (env_id) (featbit_streaming_subscriptions_active)`。

### P1：定位丢数、传播延迟与后台故障

| Metric 组 | 关注点 |
|---|---|
| `featbit.messaging.messages` / `.duration` / `.lag` | 按有限的 `provider`、`topic`、`operation`、`outcome` 观察 flag/segment 变更从 back-end 到 evaluation-server 的传播、失败与积压。 |
| `featbit.flag_change.propagation.duration` / `.fanout` / `.failures` | 从变更提交到 ELS 消费、再到 WS 发送完成的延迟、扇出量和失败数；客户端端到端生效时间需要 SDK 回报已应用的 revision。 |
| `featbit.evaluation.duration`（Histogram） | Nice-to-have 诊断项，不是必加指标。ELS 与 SDK 分开统计；Server SDK 默认关闭，仅在基准测试、故障排查或受控 rollout 期间限时采样启用。 |
| `featbit.buffer.items` / `.dropped` / `.flush.duration` | usage、insight 缓冲区深度、丢弃量、批大小与落库失败；当前 usage channel 为 `DropOldest`，这是 SaaS 计费/统计准确性的高风险点。 |
| `featbit.store.operation.duration` / `.errors` | 按 `provider`、`operation`、`outcome` 观察 DB/Redis store；另记录 cache hit/miss 和当前可用 store。 |
| `featbit.webhook.deliveries` / `.duration` / `.retries` | webhook 成功率、重试和耗时，属性只保留结果/状态码组，不使用 URL 或 webhook id。 |
| `featbit.flag_schedule.lag` / `.executions` | 定时变更的执行延迟、成功/失败；同时覆盖 usage/insight flush 等后台 worker 的 last-success age。 |
| `featbit.rollout.decisions` / `.stage.duration` / `.exposures` | Guarded Rollout 的推进、暂停、回滚、阶段耗时和实际分流比例；metric 只带 `decision/reason/stage` 等低基数属性，rollout/flag id 放 trace 或受控日志。 |

Collector 自身已有 `otelcol_*` 指标，应同时告警 receiver refused、export failed、queue saturation；否则应用“已记录”不等于监控后端“已收到”。

## 3. 实施约束

- 使用 `FeatBit.Backend`、`FeatBit.EvaluationServer` 两个稳定的 Meter/ActivitySource 名称，并配置 `OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES` 与 `OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES`，否则自定义遥测不会被当前自动插桩采集。
- 统一设置 `service.name`、`service.version`、部署环境和唯一 `service.instance.id`；连接 Gauge 按实例上报，SaaS 全局值在查询侧求和。
- 对 WS 建立短 span：`streaming.handshake`、`streaming.validate`、`streaming.message`、`streaming.sync`。每次 Flag Change 只创建一个聚合 `flag_change.fanout` span，记录 `target_count/success_count/failure_count` 和总耗时；不要把一条连接的全部消息堆在一个可能持续数天的 trace 中。
- `env.id` 只用于明确需要租户切片的少数 metric，并设置 cardinality limit/保留策略；禁止把 token、secret、user id、IP、connection id、flag key、URL 放入 metric label。
- 日志只保留异常关闭、拒绝、fail-open 和意外错误，并先脱敏 query/token/message；计数与告警使用 metric，排障细节使用 trace/log。

### 3.1 性能风险与默认采集策略

连接状态和低基数聚合指标可以常开；evaluation 热路径上的计时与事件必须分层启用。Exporter 必须异步、批量且有界，拥塞时丢遥测并暴露 dropped counter，不能阻塞 streaming 或 evaluation。

| 类型 | 性能风险 | 建议默认策略 |
|---|---:|---|
| 总 WS 连接数、SDK 状态、队列深度 Gauge | 很低 | 原子计数，始终开启 |
| 连接、重连、同步、flush Counter | 低 | 始终开启 |
| 每次 evaluation Counter | 中 | 仅低基数属性；由 OTEL SDK 聚合，自实现统计时使用分片或线程本地计数 |
| evaluation duration Histogram | 中至高 | Nice-to-have；Server SDK 默认关闭，排障/基准测试时限时采样启用 |
| `feature_flag.evaluation` Event | 最高 | Server SDK 默认不注册 OTEL observer；仅按客户需求为 active-rollout flag、错误或确定性采样显式启用 |
| 按 `env.id` 的连接 Gauge | CPU 不高，但基数/存储成本高 | Self-host 默认可开；SaaS 应按需、限额或降低采集频率 |



## 4. Flag 变更与 Guarded Rollout

### 4.1 结论：采用可靠事件与 OTEL 双通道

当前链路是 [`OnFeatureFlagChanged → audit/cache/revision → MQ`](modules/back-end/src/Application/FeatureFlags/OnFeatureFlagChanged.cs#L65) [`→ ELS → WS`](modules/evaluation-server/src/Streaming/Consumers/FeatureFlagChangeMessageConsumer.cs#L16)。它会发布完整 flag，但没有稳定的 `change_id`、revision、发生时间和 trace context；各步骤也不是同一事务，部分 MQ 实现会吞掉发布异常或异步 delivery error。因此 **OTEL 可以做变更关联和健康判定，但不能做变更命令总线或自动回滚的唯一依据**。

建议在 flag 更新事务内同时写入 revision 和 transactional outbox，之后至少一次投递、按 `change_id` 幂等消费；现有 PostgreSQL queue 可复用，但必须与 flag 更新共用事务，MongoDB 则需要支持事务的拓扑或可恢复扫描方案：

```text
Flag transaction + revision + outbox
  ├─ dispatcher → MQ → ELS → WS
  ├─ OTEL mirror → Collector → Datadog/其他平台
  └─ vendor adapter → Datadog Change Event
Monitor/analysis → Rollout Controller → FeatBit API（带 revision 条件更新）
```

统一变更 envelope 只保留 `change_id/revision/occurred_at`、workspace/project/env/flag 标识、`operation/source/actor_type`、前后状态摘要和 `traceparent`；完整 targeting、用户列表、token 不进入 OTEL。对应增加：

- span：`flag_change.persist/publish/consume/fanout`；log event：`featbit.flag.change`；counter：`featbit.flag.changes{operation,source,outcome}`。
- SDK 的 FeatBit analytics 已可异步上报 evaluation exposure，`track/track_value` 可上报应用 outcome；OTEL evaluation event 仅用于客户明确需要的第三方 Trace 关联，不应默认重复上报。启用时优先采用 `feature_flag.key`、`feature_flag.provider.name=featbit`、`feature_flag.result.variant`、`feature_flag.version`；context id 不进入 metric label。
- ELS 只能看到配置下发，无法知道客户应用的错误率、延迟或转化。要做真正的 treatment/control 对比，必须由 FeatBit SDK 把“本次请求用了哪个 variant/version”关联到客户应用的 outcome span/event，或将 exposure/outcome 可靠地回传 FeatBit。

### 4.2 Datadog / 类 LaunchDarkly 的落地方式

- Datadog Agent 可直接接收 OTLP trace、metric、log；但原生 Feature Flag Change Tracking 需要 Events API v2 的 `category=change`、`changed_resource.type=feature_flag`、affected service 及前后值。因此从 outbox 做一个 Datadog adapter，比把普通 OTEL log 当作 change event 更可靠。
- Datadog Monitor 可通过带认证的 webhook 通知 Rollout Controller。Webhook 只是信号：Controller 必须校验签名/授权、幂等、当前 revision 与 rollout 状态，再调用 FeatBit API；不得让一个告警直接无条件改 flag。
- LaunchDarkly 已证明“OTEL trace + feature flag evaluation + outcome → metric → sequential regression detection → rollback”可行，但其 trace metric 当前仍标注 EAP。FeatBit 可以复用架构思想，不应依赖其私有字段或把普通 Datadog Monitor 宣称为同等统计能力。

建议先在 **self-hosted** 场景做两阶段实现：

1. **P0 health-gated rollout**：固定阶段（如 `5→25→50→100`），预先定义最小观察窗口/样本量、1 个主指标和 2–3 个 guardrail（错误率、p95/p99、饱和度）。无数据、监控不可用或实际分流偏离即暂停；越阈值回滚。
2. **P1 treatment/control rollout**：以稳定 context 为随机化单元，校验 sample-ratio mismatch，按 variant 比较并做 sequential testing；达到显著负向阈值才自动回滚。用于决策的 exposure/outcome 不得被有偏采样。

两阶段都必须支持 protected audience、冷却期、最大步长、人工暂停/继续、审计记录，以及基于起始 revision 的条件回滚，避免覆盖期间的人工修改。SaaS 后续可选择“客户自管 Collector + 只读 Datadog 凭据/签名回调”；直接托管每个租户的监控凭据、基数和数据驻留成本更高。

## 5. SaaS 计费：独立账本，OTEL 只监控账本

现有 [`/track`](modules/evaluation-server/src/Api/Public/InsightController.cs#L44) 会把 `variations.Length`、`metrics.Length` 和去重用户汇总为 usage；back-end 经 [`DropOldest` Channel](modules/back-end/src/Application/Usages/UsageTracker.cs#L8) 写入月度 MAU 和每日 evaluation/custom-metric 计数。月度用户有数据库唯一约束，但事件计数只是累加：MQ 重投可能重复，Redis 丢消息、Kafka delivery error、flush 失败后不重放均可能少算或多算。并且这里统计的是 **服务端实际接收的 SDK variation exposure**，不能默认等于所有本地 SDK evaluation；这个差异属于产品分析和服务端计量边界，不应推动 SDK 增加计费专用遥测。

因此账单真值不能使用 OTEL Counter/Log。新增 append-only `usage_event` ledger，最少包含：

`event_id/idempotency_key`、workspace/project/env、`meter/quantity/unit`、`occurred_at/received_at`、source、schema version、可选 `correction_of`。其中计费 `event_id` 由 FeatBit 服务端在接收或控制面操作时产生/校验，不要求 Server SDK 生成。

采用 transactional outbox、at-least-once + 唯一键去重、重试/DLQ；原始账本生成小时/日汇总和不可变月度 invoice snapshot，并定义迟到数据与冲正策略。MAU 的 user key 应做租户级 HMAC 后再去重，不进入 OTEL/log。

优先考虑的商业 meter：

| 类别 | 建议记录 |
|---|---|
| 主计量 | MAU、服务端 accepted custom insight events；不按 SDK 本地 evaluation 或 SDK OTEL 指标计费。 |
| 容量/成本 | WS connection-seconds/峰值、data-sync 与 insight ingress/egress bytes、保留/导出量。 |
| 控制面/增值 | seats、projects/envs、relay proxies，以及 guarded-rollout/automation 执行次数；这类可由数据库快照或审计事件产生。 |

OTEL 只镜像账本健康：`usage.accepted/duplicate/rejected/dropped`、`ledger.lag`、`unbilled.age`、`reconciliation.delta`、invoice job success/duration。这组 billing-health metric 不带 workspace/env 等租户标签；按租户明细留在受权限和保留策略保护的 ledger/warehouse 中。

## 6. Rust Server SDK 补充

范围边界：Server SDK 只负责 flag evaluation/exposure 关联及自身同步、队列等运行健康；不新增任何计费专用属性、计数器、事件 ID 或上报协议，也不承担账本、价格、账单或 reconciliation 逻辑。SaaS 计费只由服务端接收事实和独立 ledger 处理。

### 6.1 现有能力与缺口

Rust SDK 已有良好边界：核心的 [`EvaluationObserver`](../featbit-rust-sdk/src/observation.rs#L7) 不依赖 OTEL；独立 [OTEL adapter](../featbit-rust-sdk/integrations/opentelemetry/src/lib.rs#L1) 可发出标准 `feature_flag.evaluation` log event。FeatBit analytics 是另一条有界、异步链路：自动 event 或 `track_eval_event` 上报 exposure，`track/track_value` 上报应用 outcome。因此 OTEL adapter 只服务客户第三方可观测关联，不是 FeatBit 平台数据上报的必需组件。

| 当前缺口 | 影响 |
|---|---|
| Evaluation event 没有 `feature_flag.set.id`、`feature_flag.version`、rollout/change id，也不知道本次评估是否使用 Stale snapshot。 | 无法稳定区分环境、规则版本和 rollout 阶段，变更、exposure 与回滚难以闭环。 |
| Observer 同步运行；当前注册 adapter 后，会在 `event_enabled` 判断前复制 flag key、context、variant id 和完整 variation value，即使 `include_value=false`。Tokio + `tracing-opentelemetry` 的真实 trace 关联也未验证。 | 关闭 exporter 或过滤 event 仍不是零成本，可能破坏 `<1 ms` 热路径目标；关联行为也不能保证。 |
| WS 同步只有 `NotReady/Ready/Stale/Closed` 和本地 store version；event processor 只有日志。 | 看不到最后成功同步时间、重连、版本冲突、队列深度、丢弃量、批次发送和重试。 |
| 有界 analytics queue 满、重试耗尽或 flush 失败时会丢 event；客户端 event 没有幂等 id。 | 普通分析可接受，但会偏置 SRM/Guarded Rollout，不能直接作为无偏、精确的决策数据。 |

### 6.2 建议新增的 SDK OTEL

保持 core crate 无 OTEL 依赖，新增 transport-neutral `SdkDiagnosticsObserver` 与只读 `diagnostics_snapshot()`，由 adapter 映射为：

| Metric 组 | 建议 |
|---|---|
| `featbit.sdk.client.status` / `.snapshot.age` | 当前状态、最后成功同步距今时间；评估 counter 增加 `snapshot.state=ready/stale`。 |
| `featbit.sdk.sync.connect.attempts` / `.reconnects` / `.messages` / `.apply.duration` | `outcome/reason/sync.type`，并记录 payload size、version conflict、oversize/malformed；另提供当前连接 0/1。 |
| `featbit.sdk.evaluations` / `.evaluation.duration` | 可选诊断，默认关闭；Counter 仅低基数聚合，Histogram 仅在排障或基准测试期间限时采样，flag key 不做 metric label。 |
| `featbit.sdk.events.enqueued` / `.dropped` / `.queue.size` / `.queue.bytes` | drop reason、队列水位、batch size、delivery duration、retry、status-code class、last-success age 和 delivery-stopped。 |

Evaluation OTEL adapter 必须保持显式 opt-in；未配置时不注册 observer。启用后再补 `feature_flag.set.id`、`feature_flag.version`，活动 rollout 可增加 `featbit.rollout.id/stage`。Adapter 优先发出关联 active context 的语义 Log Event；仅为兼容仍要求 Span Event 的平台提供可选模式。

默认不要导出 raw context/value。高流量时仅观测 active-rollout flag、错误，或按 context 做确定性采样。实现上应改为借用 observation，并在复制/计时前完成 enabled 与 sampling 判断；只在 adapter 内调用 `event_enabled` 已经太晚。发布前至少比较“无 observer、注册但 disabled、低比例采样、全量 event”四种基准，未启用 OTEL 时不得给 evaluation 增加分配。

### 6.3 形成 Feature Monitoring / Guarded Rollout 闭环

```text
back-end change/revision ──→ Datadog Change Event
             │
             └─→ ELS ─→ Rust SDK(version/rollout) ─→ evaluation event on app trace
                                                        │
                                             HTTP error/latency + outcome
                                                        │
                                       Monitor/analysis → Rollout Controller
```

还需要四项配套功能：

1. data-sync 下发 `change_id/revision/rollout_id/stage`；SDK 应用后可采样 ACK，才能测量“提交 → ELS → 客户进程生效”的端到端延迟。
2. detail evaluation 返回可传递的 `ExposureContext`（rollout、version、variant、exposure id）。即时错误/延迟依赖同 trace；延迟转化通过同一 exposure/context 关联，不能只靠观察窗口内“同 user 曾评估过”。
3. 只有当 FeatBit 原生 Guarded Rollout 直接依赖 SDK exposure/outcome 时，才增加可选 WAL、客户端 `event_id/batch_sequence`、服务端幂等去重和 ACK；未启用可靠模式时，drop 或数据完整性检查超阈值必须让 Controller 暂停，而不是继续扩量。
4. 保留当前 `serve-last-known` 默认策略，同时提供可选 `max_stale_age`/关键 flag fail-safe；超过阈值返回调用方 fallback 或协议明确的 control variation，并发出明确 observation。自动回滚仍由 back-end Controller 通过 revision 条件更新执行，SDK 不直接控制 rollout。

P0 只做 evaluation 热路径之外的 SDK sync/event-delivery health metric 和丢数可见；evaluation event、duration Histogram 与 active-context 关联均为 opt-in。P1 再做 rollout metadata/ACK、ExposureContext、统计检验和可选持久事件队列。


## 7. 推荐顺序

1. 先修 service name/endpoint、日志重复与泄密，并完成 WS、MQ、buffer P0 指标。
2. Rust SDK 先补 sync/event-delivery 指标和 dropped counter；evaluation version/set、active-context 关联与 duration Histogram 放入经基准验证的可选 adapter。
3. back-end 建 flag-change outbox；仅当 FeatBit 原生 Guarded Rollout 需要无偏 exposure 时，再为对应 SDK analytics envelope 增加 event id 与幂等去重。
4. 做 Datadog Change Event adapter 与 self-hosted threshold-based Controller。
5. 再扩展 rollout ACK/ExposureContext、统计检验和可选持久队列；SaaS ledger 与 billing reconciliation 作为纯服务端项目独立实施。

外部能力依据：[OTEL feature-flag event 约定](https://opentelemetry.io/docs/specs/semconv/feature-flags/feature-flags-events/)、[Datadog OTLP ingestion](https://docs.datadoghq.com/opentelemetry/setup/otlp_ingest_in_the_agent/)、[Datadog custom flag changes](https://docs.datadoghq.com/change_tracking/feature_flags/)、[Datadog monitor webhooks](https://docs.datadoghq.com/integrations/webhooks/)、[LaunchDarkly OTEL server-side](https://launchdarkly.com/docs/sdk/features/opentelemetry-server-side)、[LaunchDarkly trace metrics](https://launchdarkly.com/docs/home/metrics/create-trace-metrics)、[LaunchDarkly guarded rollouts](https://launchdarkly.com/docs/home/releases/managing-guarded-rollouts)。
