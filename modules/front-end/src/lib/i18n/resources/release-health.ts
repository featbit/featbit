export const enReleaseHealth = {
  title: "Release Health",
  subtitle:
    "Observe release signals, evaluate configured rules, and coordinate safe follow-up without treating temporal correlation as proof of causation.",
  designPreview: "Design preview",
  scopeSummary:
    "Metric definitions belong to {{project}}. Readings, monitors, and sessions below belong to {{environment}}.",
  sampleDataNotice:
    "Release Health uses typed sample data in this design branch. No backend records, permissions, or database schema are changed.",
  tabs: {
    aria: "Release Health",
    overview: "Overview",
    metrics: "Metrics",
    sessions: "Sessions",
  },
  common: {
    cancel: "Cancel",
  },
  status: {
    data: {
      collecting: "Collecting",
      ready: "Ready",
      "no-data": "No data",
      stale: "Stale",
      error: "Error",
    },
    health: {
      healthy: "Healthy",
      warning: "Warning",
      critical: "Critical",
      "not-evaluated": "Not evaluated",
    },
    gate: {
      waiting: "Waiting",
      passing: "Passing",
      breached: "Breached",
      "approval-required": "Approval required",
    },
  },
  purpose: {
    observe: "Observe",
    guard: "Guard",
  },
  scope: {
    "flag-contextual": "Flag-contextual",
    environment: "Environment-wide",
  },
  category: {
    impact: "Impact",
    quality: "Quality",
    reliability: "Reliability",
  },
  signal: {
    counter: "Counter",
    gauge: "Gauge",
    rate: "Rate / ratio",
    distribution: "Distribution",
  },
  relativeTime: {
    minutes: "{{count}} min ago",
  },
  samples: {
    ruleForMinutes: "{{condition}} for {{count}} min",
    monitors: {
      checkoutSafety: "Checkout safety monitor",
      paymentReliability: "Payment reliability",
      recommendationsObservation: "Recommendations observation",
      checkoutConversionGuard: "Checkout conversion guard",
      checkoutResourceWatch: "Checkout resource watch",
      searchResourceWatch: "Search resource watch",
      mobileStabilityGuard: "Mobile stability guard",
    },
    metrics: {
      checkout_error_rate: {
        name: "Checkout error rate",
        description:
          "Failed checkout requests divided by all checkout requests.",
        changeLabel: "+1.1 pp in 30 min",
        updatedAt: "35 sec ago",
      },
      api_p95_latency: {
        name: "API P95 latency",
        description: "95th percentile latency across the checkout API service.",
        changeLabel: "+18% in 30 min",
        updatedAt: "42 sec ago",
      },
      checkout_completion_rate: {
        name: "Checkout completion",
        description: "Sessions that complete checkout after entering the flow.",
        changeLabel: "-0.8 pp in 30 min",
        updatedAt: "1 min ago",
      },
      service_memory_saturation: {
        name: "Service memory saturation",
        description:
          "Memory working-set saturation for services in this environment.",
        changeLabel: "last complete window",
        updatedAt: "12 min ago",
      },
      crash_free_sessions: {
        name: "Crash-free sessions",
        description:
          "Percentage of application sessions without a crash signal.",
        changeLabel: "warm-up in progress",
        updatedAt: "receiving events",
      },
    },
    sessions: {
      "session-checkout-042": {
        monitorName: "Checkout safety monitor",
        flagName: "Checkout redesign",
        triggerLabel: "UI flag change",
        changeSummary: "Rollout changed from 10% to 25%",
      },
      "session-checkout-041": {
        monitorName: "Checkout safety monitor",
        flagName: "Checkout redesign",
        triggerLabel: "Quick observation",
        changeSummary: "Observed current revision without changing the flag",
      },
      "session-pricing-019": {
        monitorName: "Pricing page watch",
        flagName: "Pricing layout v2",
        triggerLabel: "Scheduled change",
        changeSummary: "Scheduled rollout changed from 0% to 10%",
      },
      "session-search-008": {
        monitorName: "Search reliability",
        flagName: "Search ranking v3",
        triggerLabel: "API flag change",
        changeSummary: "Targeting rule updated through API",
      },
    },
    assessments: {
      "metric-error-rate": {
        reason: "Threshold exceeded for 7 consecutive minutes.",
        evidenceWindow: "10:28–10:38",
      },
      "metric-api-latency": {
        reason: "Environment-wide latency remained above the configured rule.",
        evidenceWindow: "10:24–10:38",
      },
      "metric-completion": {
        reason:
          "A small decrease was observed; this metric does not control the gate.",
        evidenceWindow: "10:12–10:38",
      },
      "metric-memory": {
        reason: "Latest complete sample is older than the allowed data delay.",
        evidenceWindow: "last complete window",
      },
    },
    events: {
      "event-1": {
        title: "Observation started",
        description:
          "Snapshot created for revision rev_a84f03 after the UI change.",
      },
      "event-2": {
        title: "Warm-up completed",
        description:
          "All ready metrics entered the first 10-minute lookback window.",
      },
      "event-3": {
        title: "Guard entered Critical",
        description: "Checkout error rate exceeded its rule for five minutes.",
      },
      "event-4": {
        title: "Alert and Rich Webhook delivered",
        description:
          "Release owners were notified with a link to this evidence.",
      },
      "event-5": {
        title: "Approval required",
        description:
          "Further release action is waiting for an authorized reviewer.",
      },
    },
    noDataPolicy: {
      wait: "Wait",
      waitAndNotify: "Wait for required data; notify on Stale or Error",
      notifyAndBlock: "Notify and block",
    },
  },
  overview: {
    summary: {
      activeSessions: "Active sessions",
      needsAttention: "Needs attention",
      readyStreams: "Metric streams ready",
      alertsToday: "Alerts today",
    },
    summaryHelp: {
      activeSessions: "2 collecting now",
      needsAttention: "approval required",
      readyStreams: "selected environment",
      alertsToday: "all deliveries succeeded",
    },
    activeTitle: "Active observation sessions",
    activeDescription:
      "What Release Health is observing in the selected environment right now.",
    viewAll: "View all",
    modelTitle: "How this view is scoped",
    modelDescription:
      "Definitions can be shared while runtime evidence stays isolated by environment.",
    model: {
      metricTitle: "Release Metric · Project",
      metricText:
        "A reusable, versioned definition of what to read. It can be used by multiple flags.",
      monitorTitle: "Health Monitor · Flag + Environment",
      monitorText:
        "Binds metrics to one flag context and configures windows, rules, gates, and actions.",
      sessionTitle: "Health Session · Observation",
      sessionText:
        "Pins the configuration snapshot and records evidence around one revision or time window.",
    },
    signalsTitle: "Environment metric streams",
    signalsDescription:
      "Independent readings for this environment. Health verdicts appear only in monitor and session context.",
    exploreMetrics: "Explore metrics",
  },
  metrics: {
    catalogNotice:
      "This is the project metric catalog. The Data status, latest value, and freshness columns are always evaluated for the currently selected environment.",
    search: "Search metrics by name, key, or source",
    allCategories: "All categories",
    add: "Add metric",
    metric: "Metric",
    name: "Name",
    key: "Key",
    descriptionLabel: "Description",
    category: "Category",
    scopeColumn: "Observation scope",
    signal: "Signal",
    dataStatus: "Data status",
    latest: "Latest value",
    usedBy: "Used by",
    freshness: "Freshness",
    source: "Source",
    sourceEvent: "Event / instrument",
    aggregation: "Aggregation",
    unit: "Unit",
    observationScope: "Observation scope",
    monitorCount: "{{count}} monitors",
    empty: "No metrics match the current filters.",
    sources: {
      "featbit-events": "FeatBit events",
      opentelemetry: "OpenTelemetry",
    },
    create: {
      title: "Add release metric",
      namePlaceholder: "Checkout error rate",
      description:
        "Define a reusable project metric and connect it to an environment data stream.",
      scopeNotice:
        "The definition is shared in {{project}}. Runtime samples and freshness remain isolated in {{environment}} and every other environment.",
      definition: "Metric definition",
      definitionHelp:
        "Name the signal and describe how it should be interpreted. Rules are configured later in a monitor.",
      keyError:
        "Use lowercase letters, numbers, and underscores, starting with a letter.",
      sourceBinding: "Environment source binding",
      sourceHelp:
        "Select how this environment reads the metric. Credentials and samples are not shared across environments.",
      scopeHelp:
        "Flag-contextual signals can apply a flag/exposure filter for faster observation. Environment-wide signals remain shareable and must not be presented as causal evidence.",
      previewSaved: "Metric design saved in this preview.",
      save: "Save metric",
    },
    detail: {
      notFound: "The requested release metric was not found.",
      back: "Back to metrics",
      actions: "Metric actions",
      noVerdictNotice:
        "This page shows value, trend, freshness, and Data status only. Healthy, Warning, and Critical belong to each monitor or session because different flags can use different rules.",
      currentValue: "Current value",
      inEnvironment: "In {{environment}}",
      coverage: "Window coverage",
      selectedWindow: "of expected samples",
      latestSample: "latest accepted sample",
      trend: "Environment trend",
      trendDescription:
        "Independent metric readings from {{environment}}. Session markers provide temporal context only.",
      lastHour: "Last hour",
      lastSixHours: "Last 6 hours",
      lastDay: "Last 24 hours",
      usedByTitle: "Monitor bindings",
      usedByDescription:
        "The same metric can be Observe or Guard with different thresholds for different flags.",
      monitor: "Monitor / Flag",
      use: "Use",
      rule: "Rule in this monitor",
      latestAssessment: "Latest assessment",
      sourceTitle: "Definition and source",
      sourceDescription:
        "Project-level semantics plus the current environment binding.",
      environment: "Environment",
      sessionMarkers: "Related session windows",
      sessionMarkersDescription:
        "Open a session to see the pinned rule, gate, and evidence used for that observation.",
    },
  },
  sessions: {
    search: "Search sessions, flags, or monitors",
    filters: {
      all: "All sessions",
      active: "Active",
      completed: "Completed",
      attention: "Needs attention",
    },
    session: "Session",
    flag: "Feature flag",
    trigger: "Started by",
    change: "Observed change / context",
    data: "Data",
    gate: "Gate",
    action: "Action state",
    started: "Started",
    approvalRequired: "Reviewer needed",
    alertSent: "Alert sent",
    empty: "No sessions match the current filters.",
    status: {
      active: "Active",
      completed: "Completed",
      stopped: "Stopped",
    },
    detail: {
      notFound: "The requested Health Session was not found.",
      back: "Back to sessions",
      title: "Observation session {{id}}",
      acknowledge: "Acknowledge",
      acknowledged: "Acknowledged in this design preview.",
      stop: "Stop session",
      stopPreview: "Session stop previewed; no backend state changed.",
      correlationTitle: "An anomaly was observed in this session window",
      correlationNotice:
        "Release Health reports temporal association and the evidence it observed. It does not claim that this feature flag caused the anomaly or identify root cause.",
      gateReason:
        "At least one blocking Guard needs a reviewer before further release action.",
      dataSummary: "{{ready}} of {{total}} metric streams are Ready",
      changeContext: "Change context",
      observationWindow: "Observation window",
      every: "evaluated every {{interval}}",
      evidence: "Metric evidence",
      evidenceDescription:
        "Data status and health status are shown separately for every binding.",
      noAssessments: "This session has not produced an assessment yet.",
      selectMetric: "Select a metric",
      selectMetricHelp: "Choose evidence from the list to inspect its window.",
      environmentSignalNotice:
        "This signal describes the whole environment and may be shared by multiple active sessions. It can notify, pause a supported workflow, or require approval, but it cannot justify automatic rollback on temporal correlation alone.",
      noEvidence: "No metric evidence is available yet.",
      timeline: "Session timeline",
      timelineDescription:
        "Evaluations, alerts, webhook deliveries, actions, and audit evidence in time order.",
      noTimeline: "No timeline events have been recorded yet.",
      snapshot: "Pinned configuration snapshot",
      snapshotDescription:
        "Edits to the monitor or metric do not silently change this running session.",
      created: "Snapshot created",
      warmup: "Warm-up",
      lookback: "Lookback",
      evaluation: "Evaluation interval",
      sustain: "Sustain duration",
      noData: "No-data policy",
      metricVersions: "Metric versions",
      actions: "Configured actions",
      openFlag: "Open flag health",
      audit: "Audit evidence",
    },
  },
  monitor: {
    titles: {
      monitor: "Configure health monitor",
      quick: "Start quick observation",
      change: "Monitor this change",
    },
    descriptions: {
      monitor:
        "Configure long-lived observation for this feature flag and environment.",
      quick:
        "Start a time-boxed session from the current revision without changing the flag.",
      change:
        "Associate observation intent with a change. The session starts only after the change is actually applied.",
    },
    savedPreview: "Monitor configuration saved in this design preview.",
    startedPreview: "Observation session started in this design preview.",
    changeAssociation: "Observation for this change",
    changeAssociationHelp:
      "Reuse the flag's current monitor or create a one-session configuration.",
    useExisting: "Use existing monitor",
    useExistingHelp:
      "Pin the current Checkout safety monitor when the change takes effect.",
    quickConfig: "Quick configuration",
    quickConfigHelp:
      "Choose metrics and rules that apply to this change-bound session only.",
    existingSummary: "{{guardCount}} Guards · {{observeCount}} Observe binding",
    snapshotAtApply: "Snapshot at apply time",
    whenTitle: "When to observe",
    whenDescription:
      "A continuous monitor can also create a new session after supported flag changes.",
    continuous: "Continuous observation",
    continuousHelp:
      "Keep observing the current revision until the monitor is paused or archived.",
    flagChanges: "Start after flag changes",
    flagChangesHelp:
      "Create a separate snapshot when a supported change is actually applied.",
    metricsTitle: "Metric bindings",
    metricsDescription:
      "Select project metrics, then decide whether each one only observes or participates in the gate.",
    trendOnly: "Trend only",
    advancedTitle: "Evaluation and actions",
    advancedSummary:
      "{{warmup}} warm-up · {{lookback}} lookback · {{guards}} Guards · {{actions}} actions",
    showAdvanced: "Advanced settings",
    hideAdvanced: "Hide advanced",
    windowTitle: "Evaluation window",
    windowDescription:
      "These values are visible release semantics and will be pinned into every new session.",
    warmup: "Warm-up",
    lookback: "Lookback",
    evaluation: "Evaluate every",
    sustain: "Sustain",
    gateTitle: "Gate",
    gateDescription:
      "Only Ready Guard metrics are evaluated. Data unavailability follows the explicit no-data policy.",
    combination: "Guard combination",
    allRequired: "All blocking Guards must pass",
    noDataPolicy: "No-data policy",
    noDataOptions: {
      wait: "Wait",
      notify: "Notify and keep waiting",
      block: "Block and require review",
    },
    actionsTitle: "Actions",
    actionsDescription:
      "Available actions depend on the session context; the UI never reports an action that the current workflow cannot perform.",
    alertOwners: "Alert owners",
    alertOwnersHelp: "Create an in-product Alert with an evidence link.",
    richWebhook: "Rich Webhook",
    richWebhookHelp:
      "Publish a release_health.* event through an existing Webhook.",
    pause: "Pause supported workflow",
    pauseHelp:
      "Available only when the current automation has a pausable context.",
    requireApproval: "Require approval",
    requireApprovalHelp:
      "Ask an authorized reviewer before a supported workflow continues.",
    autoRollback: "Automatic rollback",
    notInMvp: "Not in MVP",
    autoRollbackHelp:
      "Environment-wide and service-level signals cannot automatically roll back a flag from temporal correlation alone. MVP records evidence and supports notification or human intervention.",
    snapshotNotice:
      "Starting a session pins Metric versions, source binding, filters, window, rules, gate, and actions. Later edits affect only new sessions.",
    submit: {
      monitor: "Save monitor",
      quick: "Start observation",
      change: "Use for this change",
    },
  },
  flag: {
    correlationNotice:
      "These conclusions describe signals observed in the same time window as this flag's sessions. They are not causal attribution.",
    title: "Release Health",
    monitorName: "{{flag}} · Health Monitor",
    description:
      "Configure monitors and review observation sessions for {{environment}}.",
    monitorThisChange: "Monitor this change",
    quickObservation: "Quick observation",
    monitorDescription:
      "Continuous observation plus a pinned session after supported changes.",
    monitoring: "Monitoring",
    paused: "Paused",
    toggleMonitor: "Toggle health monitor",
    configure: "Configure",
    monitorResumed:
      "Monitor resumed in this preview. Metric collection remains environment-owned.",
    monitorPaused:
      "Monitor paused in this preview. SDK metric capture is not stopped.",
    currentGate: "Current gate",
    activeSessions: "Active sessions",
    bindings: "Metric bindings",
    bindingSummary: "{{guards}} Guard · {{observes}} Observe",
    triggers: "Session triggers",
    triggerSummary: "Manual · Change · Schedule · API",
    pauseNotice:
      "Pausing this monitor stops new evaluations and automatic sessions; it does not delete the metric or stop SDK event capture.",
    metricsTitle: "Monitor metric bindings",
    metricsDescription:
      "Health verdicts below belong to this monitor's rule, not to the shared metric definition.",
    use: "Use",
    rule: "Rule",
    assessment: "Latest assessment",
    activeSessionTitle: "Active observation",
    activeSessionDescription:
      "A configuration snapshot tied to the most recently observed change.",
    openSession: "Open evidence",
    sampleChange: "Rollout changed from 10% to 25%",
    observedAnomaly: "Anomaly observed in this window",
    observedAnomalyHelp:
      "Two Guard rules crossed their thresholds. Approval is required; this does not identify the flag as root cause.",
    alertDelivery: "Alert and Rich Webhook delivered successfully",
    historyTitle: "Recent sessions",
    historyDescription:
      "Every session preserves its own revisions, configuration, evidence, and action results.",
  },
  change: {
    title: "Monitor this change",
    savedHelp:
      "Choose how signals should be observed after this change is saved.",
    appliedHelp:
      "The observation session starts when this scheduled or approved change is actually applied.",
    options: {
      none: "Not monitored",
      existing: "Existing monitor",
      quick: "Quick configuration",
    },
    optionHelp: {
      none: "Apply the change without a Health Session.",
      existing: "Snapshot the flag's current monitor.",
      quick: "Create a one-session metric and gate setup.",
    },
    existingSummary: "Checkout safety monitor · 3 Guards · 1 Observe",
    quickSummary: "Configure metrics, window, rule, gate, and actions",
    configure: "Open Release Health",
    prototypeNotice:
      "Design preview only: this selection is not sent to the backend on this branch.",
  },
}

export const zhReleaseHealth: typeof enReleaseHealth = {
  title: "发布健康",
  subtitle:
    "观测发布信号、评价已配置规则并协调安全处置；时间相关性不等于因果关系。",
  designPreview: "设计预览",
  scopeSummary:
    "Metric 定义属于 {{project}}；下方读数、Monitor 与 Session 属于 {{environment}}。",
  sampleDataNotice:
    "此设计分支中的 Release Health 使用强类型示例数据，不会修改后端记录、权限或数据库结构。",
  tabs: {
    aria: "发布健康",
    overview: "概览",
    metrics: "指标",
    sessions: "观测会话",
  },
  common: {
    cancel: "取消",
  },
  status: {
    data: {
      collecting: "采集中",
      ready: "已就绪",
      "no-data": "无数据",
      stale: "数据过期",
      error: "数据错误",
    },
    health: {
      healthy: "健康",
      warning: "警告",
      critical: "危险",
      "not-evaluated": "未评价",
    },
    gate: {
      waiting: "等待中",
      passing: "已通过",
      breached: "已突破",
      "approval-required": "需要审批",
    },
  },
  purpose: {
    observe: "观测",
    guard: "护栏",
  },
  scope: {
    "flag-contextual": "Flag 上下文",
    environment: "环境级",
  },
  category: {
    impact: "业务影响",
    quality: "质量",
    reliability: "可靠性",
  },
  signal: {
    counter: "计数",
    gauge: "瞬时值",
    rate: "比率",
    distribution: "分布",
  },
  relativeTime: {
    minutes: "{{count}} 分钟前",
  },
  samples: {
    ruleForMinutes: "{{condition}} · 持续 {{count}} 分钟",
    monitors: {
      checkoutSafety: "结账安全监控",
      paymentReliability: "支付可靠性监控",
      recommendationsObservation: "推荐功能观测",
      checkoutConversionGuard: "结账转化护栏",
      checkoutResourceWatch: "结账资源观测",
      searchResourceWatch: "搜索资源观测",
      mobileStabilityGuard: "移动端稳定性护栏",
    },
    metrics: {
      checkout_error_rate: {
        name: "结账错误率",
        description: "结账失败请求占全部结账请求的比例。",
        changeLabel: "30 分钟内上升 1.1 个百分点",
        updatedAt: "35 秒前",
      },
      api_p95_latency: {
        name: "API P95 延迟",
        description: "当前环境中结账 API 服务的第 95 百分位延迟。",
        changeLabel: "30 分钟内上升 18%",
        updatedAt: "42 秒前",
      },
      checkout_completion_rate: {
        name: "结账完成率",
        description: "进入结账流程后成功完成结账的 Session 比例。",
        changeLabel: "30 分钟内下降 0.8 个百分点",
        updatedAt: "1 分钟前",
      },
      service_memory_saturation: {
        name: "服务内存饱和度",
        description: "当前环境中服务工作集的内存饱和度。",
        changeLabel: "最近一个完整窗口",
        updatedAt: "12 分钟前",
      },
      crash_free_sessions: {
        name: "无崩溃 Session",
        description: "未出现崩溃信号的应用 Session 比例。",
        changeLabel: "Warm-up 进行中",
        updatedAt: "正在接收事件",
      },
    },
    sessions: {
      "session-checkout-042": {
        monitorName: "结账安全监控",
        flagName: "结账页改版",
        triggerLabel: "UI Flag 变更",
        changeSummary: "Rollout 从 10% 调整到 25%",
      },
      "session-checkout-041": {
        monitorName: "结账安全监控",
        flagName: "结账页改版",
        triggerLabel: "快速观测",
        changeSummary: "未修改 Flag，观测当前 revision",
      },
      "session-pricing-019": {
        monitorName: "定价页观测",
        flagName: "定价布局 v2",
        triggerLabel: "Schedule 变更",
        changeSummary: "计划 Rollout 从 0% 调整到 10%",
      },
      "session-search-008": {
        monitorName: "搜索可靠性",
        flagName: "搜索排序 v3",
        triggerLabel: "API Flag 变更",
        changeSummary: "通过 API 更新 Targeting Rule",
      },
    },
    assessments: {
      "metric-error-rate": {
        reason: "阈值已连续 7 分钟被突破。",
        evidenceWindow: "10:28–10:38",
      },
      "metric-api-latency": {
        reason: "环境级延迟持续高于当前 Monitor 配置的 Rule。",
        evidenceWindow: "10:24–10:38",
      },
      "metric-completion": {
        reason: "观测到小幅下降；此 Metric 不参与 Gate。",
        evidenceWindow: "10:12–10:38",
      },
      "metric-memory": {
        reason: "最近完整样本已超过允许的数据延迟。",
        evidenceWindow: "最近完整窗口",
      },
    },
    events: {
      "event-1": {
        title: "观测已启动",
        description: "UI 变更后，为 revision rev_a84f03 创建了配置快照。",
      },
      "event-2": {
        title: "Warm-up 已完成",
        description: "所有已就绪 Metric 进入首个 10 分钟 Lookback 窗口。",
      },
      "event-3": {
        title: "Guard 进入危险状态",
        description: "结账错误率连续 5 分钟超过当前 Rule。",
      },
      "event-4": {
        title: "Alert 与 Rich Webhook 已送达",
        description: "发布负责人已收到包含证据链接的通知。",
      },
      "event-5": {
        title: "需要审批",
        description: "后续发布动作正在等待有权限的人员审核。",
      },
    },
    noDataPolicy: {
      wait: "等待",
      waitAndNotify: "等待必要数据；Stale 或 Error 时发送通知",
      notifyAndBlock: "通知并阻断",
    },
  },
  overview: {
    summary: {
      activeSessions: "活跃 Session",
      needsAttention: "需要关注",
      readyStreams: "已就绪指标流",
      alertsToday: "今日告警",
    },
    summaryHelp: {
      activeSessions: "2 个正在采集",
      needsAttention: "等待审批",
      readyStreams: "当前环境",
      alertsToday: "均已成功送达",
    },
    activeTitle: "活跃观测 Session",
    activeDescription: "当前选中环境中正在进行的 Release Health 观测。",
    viewAll: "查看全部",
    modelTitle: "此页面的作用域",
    modelDescription: "定义可共享，但运行期证据始终按环境隔离。",
    model: {
      metricTitle: "Release Metric · Project",
      metricText: "定义观测内容的可复用版本对象，可被多个 Flag 共同使用。",
      monitorTitle: "Health Monitor · Flag + Environment",
      monitorText:
        "把 Metric 绑定到一个 Flag 上下文，并配置窗口、规则、Gate 与动作。",
      sessionTitle: "Health Session · 实际观测",
      sessionText: "固定配置快照，并记录某个 revision 或时间窗口中的证据。",
    },
    signalsTitle: "环境指标流",
    signalsDescription:
      "当前环境的独立读数。健康结论只在 Monitor 与 Session 上下文中出现。",
    exploreMetrics: "查看指标",
  },
  metrics: {
    catalogNotice:
      "这是项目级 Metric 目录。Data Status、最新值和 Freshness 始终来自当前选中的 Environment。",
    search: "按名称、Key 或数据源搜索",
    allCategories: "全部分类",
    add: "添加 Metric",
    metric: "Metric",
    name: "名称",
    key: "Key",
    descriptionLabel: "说明",
    category: "分类",
    scopeColumn: "观测作用域",
    signal: "信号形态",
    dataStatus: "数据状态",
    latest: "最新值",
    usedBy: "使用情况",
    freshness: "新鲜度",
    source: "数据源",
    sourceEvent: "事件 / Instrument",
    aggregation: "聚合方式",
    unit: "单位",
    observationScope: "观测作用域",
    monitorCount: "{{count}} 个 Monitor",
    empty: "没有 Metric 匹配当前筛选条件。",
    sources: {
      "featbit-events": "FeatBit 事件",
      opentelemetry: "OpenTelemetry",
    },
    create: {
      title: "添加 Release Metric",
      namePlaceholder: "结账错误率",
      description: "定义可复用的项目级 Metric，并连接当前环境的数据流。",
      scopeNotice:
        "定义在 {{project}} 内共享；运行时采样和 Freshness 在 {{environment}} 及其他环境之间完全隔离。",
      definition: "Metric 定义",
      definitionHelp:
        "命名信号并说明解释方式。Rule 在后续 Health Monitor 中配置。",
      keyError: "使用小写字母、数字和下划线，并以字母开头。",
      sourceBinding: "环境数据源绑定",
      sourceHelp: "选择当前环境如何读取 Metric。凭据和样本不会在环境之间共享。",
      scopeHelp:
        "Flag 上下文信号可使用 Flag/曝光过滤进行快速观测；环境级信号保持共享，且不能作为因果证据展示。",
      previewSaved: "已在设计预览中保存 Metric。",
      save: "保存 Metric",
    },
    detail: {
      notFound: "未找到请求的 Release Metric。",
      back: "返回指标",
      actions: "Metric 操作",
      noVerdictNotice:
        "本页只展示值、趋势、Freshness 与 Data Status。不同 Flag 可使用不同 Rule，因此 Healthy、Warning、Critical 只属于具体 Monitor 或 Session。",
      currentValue: "当前值",
      inEnvironment: "位于 {{environment}}",
      coverage: "窗口覆盖率",
      selectedWindow: "占预期样本",
      latestSample: "最近接收样本",
      trend: "环境趋势",
      trendDescription:
        "{{environment}} 的独立指标读数；Session 标记只提供时间上下文。",
      lastHour: "最近 1 小时",
      lastSixHours: "最近 6 小时",
      lastDay: "最近 24 小时",
      usedByTitle: "Monitor 绑定",
      usedByDescription:
        "同一个 Metric 可在不同 Flag 中用作 Observe 或 Guard，并采用不同阈值。",
      monitor: "Monitor / Flag",
      use: "用途",
      rule: "当前 Monitor 的 Rule",
      latestAssessment: "最新评价",
      sourceTitle: "定义与数据源",
      sourceDescription: "项目级语义与当前环境的数据源绑定。",
      environment: "环境",
      sessionMarkers: "相关 Session 窗口",
      sessionMarkersDescription:
        "打开 Session 查看当次观测固定的 Rule、Gate 与证据。",
    },
  },
  sessions: {
    search: "搜索 Session、Flag 或 Monitor",
    filters: {
      all: "全部 Session",
      active: "进行中",
      completed: "已完成",
      attention: "需要关注",
    },
    session: "Session",
    flag: "功能开关",
    trigger: "启动来源",
    change: "观测变更 / 上下文",
    data: "数据",
    gate: "Gate",
    action: "动作状态",
    started: "启动时间",
    approvalRequired: "需要审批人",
    alertSent: "已发送告警",
    empty: "没有 Session 匹配当前筛选条件。",
    status: {
      active: "进行中",
      completed: "已完成",
      stopped: "已停止",
    },
    detail: {
      notFound: "未找到请求的 Health Session。",
      back: "返回 Session",
      title: "观测 Session {{id}}",
      acknowledge: "确认收到",
      acknowledged: "已在设计预览中确认。",
      stop: "停止 Session",
      stopPreview: "已预览停止 Session；未修改后端状态。",
      correlationTitle: "本次观测窗口内出现异常",
      correlationNotice:
        "Release Health 报告时间关联及其观测证据，不会声称该功能开关导致异常，也不负责判断根因。",
      gateReason: "至少一个阻断型 Guard 需要审批，后续发布动作才能继续。",
      dataSummary: "{{ready}} / {{total}} 个指标流已就绪",
      changeContext: "变更上下文",
      observationWindow: "观测窗口",
      every: "每 {{interval}} 评价一次",
      evidence: "Metric 证据",
      evidenceDescription: "每个绑定分别展示 Data Status 与 Health Status。",
      noAssessments: "此 Session 尚未产生评价。",
      selectMetric: "选择 Metric",
      selectMetricHelp: "从左侧选择证据以查看观测窗口。",
      environmentSignalNotice:
        "这是整个环境共享的信号，可能同时出现在多个活跃 Session 中。它可以触发通知、暂停受支持的流程或要求审批，但不能仅凭时间相关性自动回滚。",
      noEvidence: "暂时没有 Metric 证据。",
      timeline: "Session 时间线",
      timelineDescription:
        "按时间记录评价、告警、Webhook 送达、动作与审计证据。",
      noTimeline: "尚未记录时间线事件。",
      snapshot: "固定配置快照",
      snapshotDescription:
        "对 Monitor 或 Metric 的后续编辑不会静默改变正在运行的 Session。",
      created: "快照创建时间",
      warmup: "Warm-up",
      lookback: "Lookback",
      evaluation: "评价间隔",
      sustain: "持续时间",
      noData: "无数据策略",
      metricVersions: "Metric 版本",
      actions: "已配置动作",
      openFlag: "打开 Flag 健康页",
      audit: "审计证据",
    },
  },
  monitor: {
    titles: {
      monitor: "配置 Health Monitor",
      quick: "启动快速观测",
      change: "观测此次变更",
    },
    descriptions: {
      monitor: "为当前功能开关和环境配置长期有效的观测。",
      quick: "不修改 Flag，从当前 revision 启动一个限定时间的 Session。",
      change: "把观测意图关联到变更；只有变更实际应用后才会启动 Session。",
    },
    savedPreview: "已在设计预览中保存 Monitor 配置。",
    startedPreview: "已在设计预览中启动观测 Session。",
    changeAssociation: "本次变更的观测",
    changeAssociationHelp:
      "复用当前 Monitor，或创建仅用于本次 Session 的配置。",
    useExisting: "使用现有 Monitor",
    useExistingHelp: "变更生效时固定 Checkout safety monitor 的当前配置。",
    quickConfig: "快速配置",
    quickConfigHelp: "选择只用于本次变更 Session 的 Metric 和 Rule。",
    existingSummary: "{{guardCount}} 个 Guard · {{observeCount}} 个 Observe",
    snapshotAtApply: "生效时创建快照",
    whenTitle: "何时观测",
    whenDescription:
      "Continuous Monitor 也可以在受支持的 Flag 变更后创建新 Session。",
    continuous: "持续观测",
    continuousHelp: "持续观察当前 revision，直到 Monitor 被暂停或归档。",
    flagChanges: "Flag 变更后启动",
    flagChangesHelp: "受支持的变更实际应用后创建独立快照。",
    metricsTitle: "Metric 绑定",
    metricsDescription:
      "选择项目级 Metric，并决定其仅用于 Observe 还是参与 Gate。",
    trendOnly: "仅观察趋势",
    advancedTitle: "评价与动作",
    advancedSummary:
      "Warm-up {{warmup}} · Lookback {{lookback}} · {{guards}} 个 Guard · {{actions}} 个动作",
    showAdvanced: "高级设置",
    hideAdvanced: "收起高级设置",
    windowTitle: "评价窗口",
    windowDescription: "这些值是可见的发布语义，并会固定到每个新 Session 中。",
    warmup: "Warm-up",
    lookback: "Lookback",
    evaluation: "评价间隔",
    sustain: "异常持续",
    gateTitle: "Gate",
    gateDescription:
      "只有 Ready 的 Guard 才执行 Rule；数据不可用按显式策略处理。",
    combination: "Guard 组合",
    allRequired: "所有阻断型 Guard 都必须通过",
    noDataPolicy: "无数据策略",
    noDataOptions: {
      wait: "等待",
      notify: "通知并继续等待",
      block: "阻断并要求人工检查",
    },
    actionsTitle: "动作",
    actionsDescription:
      "可用动作取决于 Session 上下文；UI 不会声称执行当前流程不支持的动作。",
    alertOwners: "通知负责人",
    alertOwnersHelp: "创建带证据链接的站内 Alert。",
    richWebhook: "Rich Webhook",
    richWebhookHelp: "通过已有 Webhook 发布 release_health.* 事件。",
    pause: "暂停受支持流程",
    pauseHelp: "只有当前自动化存在可暂停上下文时才可用。",
    requireApproval: "要求审批",
    requireApprovalHelp: "受支持流程继续前要求有权限的人员审核。",
    autoRollback: "自动回滚",
    notInMvp: "MVP 不提供",
    autoRollbackHelp:
      "环境级和服务级信号不能仅凭时间相关性自动回滚 Flag。MVP 记录证据，并支持通知或人工干预。",
    snapshotNotice:
      "启动 Session 时会固定 Metric 版本、数据源绑定、过滤、窗口、Rule、Gate 和动作；后续编辑只影响新 Session。",
    submit: {
      monitor: "保存 Monitor",
      quick: "启动观测",
      change: "用于此次变更",
    },
  },
  flag: {
    correlationNotice:
      "这些结论描述与当前 Flag Session 同一时间窗口内观测到的信号，不代表因果归属。",
    title: "发布健康",
    monitorName: "{{flag}} · 健康监控",
    description: "配置 Monitor，并查看 {{environment}} 中的观测 Session。",
    monitorThisChange: "观测此次变更",
    quickObservation: "快速观测",
    monitorDescription: "持续观测，并在受支持的变更后创建固定快照。",
    monitoring: "观测中",
    paused: "已暂停",
    toggleMonitor: "切换 Health Monitor",
    configure: "配置",
    monitorResumed: "已在预览中恢复 Monitor；环境指标采集保持独立。",
    monitorPaused: "已在预览中暂停 Monitor；不会停止 SDK 捕捉 Metric。",
    currentGate: "当前 Gate",
    activeSessions: "活跃 Session",
    bindings: "Metric 绑定",
    bindingSummary: "{{guards}} 个 Guard · {{observes}} 个 Observe",
    triggers: "Session 触发方式",
    triggerSummary: "手工 · 变更 · Schedule · API",
    pauseNotice:
      "暂停 Monitor 会停止新评价和自动 Session，但不会删除 Metric，也不会停止 SDK 事件采集。",
    metricsTitle: "Monitor 的 Metric 绑定",
    metricsDescription:
      "下方健康结论属于此 Monitor 的 Rule，而不属于共享 Metric 定义。",
    use: "用途",
    rule: "Rule",
    assessment: "最新评价",
    activeSessionTitle: "活跃观测",
    activeSessionDescription: "与最近一次观测变更关联的配置快照。",
    openSession: "打开证据",
    sampleChange: "Rollout 从 10% 调整到 25%",
    observedAnomaly: "本次窗口内观测到异常",
    observedAnomalyHelp:
      "两个 Guard Rule 越过阈值，需要审批；这并不把 Flag 判定为根因。",
    alertDelivery: "Alert 与 Rich Webhook 均已成功送达",
    historyTitle: "最近 Session",
    historyDescription:
      "每个 Session 都保留自己的 revision、配置、证据和动作结果。",
  },
  change: {
    title: "观测此次变更",
    savedHelp: "选择保存此次变更后如何观察相关信号。",
    appliedHelp: "Schedule 或审批变更只有实际应用时才启动观测 Session。",
    options: {
      none: "不观测",
      existing: "现有 Monitor",
      quick: "快速配置",
    },
    optionHelp: {
      none: "应用变更，但不创建 Health Session。",
      existing: "固定当前 Flag Monitor 的配置。",
      quick: "创建只用于一次 Session 的 Metric 与 Gate 配置。",
    },
    existingSummary: "Checkout safety monitor · 3 个 Guard · 1 个 Observe",
    quickSummary: "配置 Metric、窗口、Rule、Gate 与动作",
    configure: "打开 Release Health",
    prototypeNotice: "仅用于设计预览：此分支不会把该选择提交到后端。",
  },
}
