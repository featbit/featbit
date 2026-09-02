export const enReleaseHealthLive = {
  badge: "Live integration",
  notice:
    "Connections and Metrics use the real API and Prometheus. Trends are queried on demand, not a persisted stream. Monitor and Session pages remain design previews.",
  connectionScope:
    "Prometheus v1 connections belong to this environment. Authorized users enter credentials here; the API never returns them.",
  metricScope:
    "Definitions belong to the project; bindings and readings are isolated to the selected environment.",
  refresh: "Refresh",
  edit: "Edit",
  loading: "Loading…",
  create: "Create metric",
  key: "Metric key",
  semantics: "Result semantics",
  encrypted: "Credential configured · encrypted at rest",
  testPassed: "The provider accepted a real read-only query.",
  saved: "Connection tested and saved in FeatBit.",
  connectionFailed:
    "Connection failed. Check endpoint, authentication, permissions, encryption keys and outbound policy. Refresh after concurrent edits. No raw provider response or credential is exposed.",
  loadFailed:
    "Cannot load live data. Check API availability, database migration and permissions. Sample data is not substituted.",
  metricFailed:
    "Check required fields and key format. The key must be unique; creation requires project settings permission.",
  noMetrics:
    "No persisted metrics. Create a project definition, then configure this environment's source binding.",
  manageBinding: "Manage source binding",
  bindingHelp:
    "Return one finite numeric series in the canonical unit. Confirm unit conversion in PromQL. Save revalidates on the server. This slice queries on demand, without background synchronization.",
  bindingLoadFailed:
    "Source configuration requires environment settings permission. Check permissions and API status; the trend remains read-only.",
  trendHelp:
    "Real query_range: last 15 minutes, refreshed every 10 seconds while open. Values are not a health verdict or proof of causation.",
  queryFailed:
    "Query unavailable or rejected. Check connection revision, permissions, PromQL, single-series cardinality, finite values and unit bounds. Revalidate after connection changes.",
  trendAria: "Actual Prometheus metric trend",
  points: "points",
  value: "Value",
  noPoints: "No samples. Missing data is not plotted as zero.",
  dataStatus: {
    not_connected: "Not connected",
    no_data: "No data",
    stale: "Stale",
    ready: "Data available",
  },
}
export const zhReleaseHealthLive: typeof enReleaseHealthLive = {
  badge: "真实链路",
  notice:
    "Connections 和 Metrics 已接入真实 API 与 Prometheus。趋势按需查询，尚非持久化 Stream；Monitor 和 Session 仍为设计预览。",
  connectionScope:
    "Prometheus v1 连接属于当前环境。具备权限的用户在此录入凭据；API 永不回显。",
  metricScope: "定义属于项目；Binding 与实时读数严格隔离到当前选中的环境。",
  refresh: "刷新",
  edit: "编辑",
  loading: "加载中…",
  create: "创建指标",
  key: "指标 Key",
  semantics: "结果语义",
  encrypted: "凭据已配置 · 加密存储",
  testPassed: "Provider 已接受真实只读查询。",
  saved: "连接已通过测试并保存到 FeatBit。",
  connectionFailed:
    "连接失败。请检查地址、认证、权限、加密密钥与出站策略；并发修改后请刷新。这里不会显示 Provider 原始响应或凭据。",
  loadFailed:
    "真实数据加载失败。请检查 API、数据库迁移和权限；不会使用模拟数据替代。",
  metricFailed:
    "请检查必填字段与 Key 格式。Key 在项目内必须唯一；创建需要项目配置权限。",
  noMetrics:
    "当前项目还没有持久化指标。先创建定义，再配置当前环境的 Source Binding。",
  manageBinding: "管理 Source Binding",
  bindingHelp:
    "返回符合标准单位的单一有限数值序列。请确认 PromQL 已完成单位换算；保存时服务端重新校验。本链路按需查询，暂不配置后台同步。",
  bindingLoadFailed:
    "查看数据源配置需要环境配置权限。请检查权限与 API；趋势本身仍为只读。",
  trendHelp:
    "真实 query_range：最近 15 分钟，页面打开时每 10 秒刷新。数值不代表健康判定，也不证明因果关系。",
  queryFailed:
    "查询不可用或被拒绝。请检查连接修订、权限、PromQL、单序列、有限数值与单位范围；修改连接后需要重新验证。",
  trendAria: "真实 Prometheus 指标趋势",
  points: "个点",
  value: "数值",
  noPoints: "没有指标样本；缺失数据不会绘制为零。",
  dataStatus: {
    not_connected: "未连接",
    no_data: "无数据",
    stale: "数据过期",
    ready: "数据可用",
  },
}
