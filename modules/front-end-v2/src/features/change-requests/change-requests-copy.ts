import type { Lang } from "@/features/layout/layout-types"
import type { ChangeRequestStatus } from "./change-requests-types"

const en = {
  title: "Change requests",
  subtitle: "Review feature flag targeting changes across this environment.",
  filterByComment: "Filter by comment",
  author: "Author",
  reviewer: "Reviewer",
  allAuthors: "All authors",
  allReviewers: "All reviewers",
  searchAuthors: "Search authors",
  searchReviewers: "Search reviewers",
  noMembers: "No team members found.",
  membersLoadFailed: "Could not load team members.",
  status: "Status",
  allStatuses: "All statuses",
  clearFilters: "Clear filters",
  request: "Request",
  reviewers: "Reviewers",
  updated: "Updated",
  actions: "Actions",
  approve: "Approve",
  approving: "Approving...",
  decline: "Decline",
  declining: "Declining...",
  apply: "Apply changes",
  applying: "Applying changes...",
  viewInTargeting: "View in targeting",
  targetingChanges: "Targeting changes",
  changeCount: (count: number) =>
    `${count} ${count === 1 ? "change" : "changes"}`,
  noChanges: "No semantic targeting changes are available.",
  fallbackRequest: "Targeting change request",
  unavailableFlag: "Unavailable feature flag",
  unknownUser: "Unknown user",
  reviewerFallback: (id: string) => `Reviewer ${id}`,
  you: "You",
  flagOn: "On",
  flagOff: "Off",
  summary: (total: number, reviewCount: number) =>
    `${total} ${total === 1 ? "request" : "requests"} · ${reviewCount} need your review`,
  expand: "Expand change request",
  collapse: "Collapse change request",
  loadFailed: "We couldn't load change requests.",
  loadFailedHelp: "Retry to refresh this environment's review queue.",
  retry: "Retry",
  loadMore: "Load more",
  loadingMore: "Loading...",
  emptyTitle: "No change requests yet",
  emptyDescription:
    "Change requests submitted from feature flag Targeting will appear here.",
  filteredEmptyTitle: "No change requests match these filters",
  filteredEmptyDescription: "Clear the filters or try a different search.",
  actionSucceeded: (action: "approve" | "decline" | "apply") =>
    action === "apply"
      ? "Changes applied."
      : action === "approve"
        ? "Change request approved."
        : "Change request declined.",
  actionFailed: "The change request action could not be saved. Try again.",
  actionUnavailable:
    "This action is no longer available for this change request.",
  selectEnvironment: "Select an environment to view its change requests.",
  statuses: {
    PendingReview: "Pending review",
    Approved: "Approved",
    Declined: "Declined",
    Applied: "Applied",
  } satisfies Record<ChangeRequestStatus, string>,
  reviewerStatuses: {
    pending: "Pending",
    approved: "Approved",
    declined: "Declined",
  },
}

type WidenCopy<T> = T extends (...args: infer Args) => unknown
  ? (...args: Args) => string
  : T extends string
    ? string
    : T extends Record<string, unknown>
      ? { [Key in keyof T]: WidenCopy<T[Key]> }
      : T

export type ChangeRequestsCopy = WidenCopy<typeof en>

const zh: ChangeRequestsCopy = {
  ...en,
  title: "变更请求",
  subtitle: "集中审核当前环境中的功能开关 Targeting 变更。",
  filterByComment: "按评论筛选",
  author: "提交人",
  reviewer: "审核人",
  allAuthors: "全部提交人",
  allReviewers: "全部审核人",
  searchAuthors: "搜索提交人",
  searchReviewers: "搜索审核人",
  noMembers: "未找到团队成员。",
  membersLoadFailed: "无法加载团队成员。",
  status: "状态",
  allStatuses: "全部状态",
  clearFilters: "清除筛选",
  request: "请求",
  reviewers: "审核人",
  updated: "更新时间",
  actions: "操作",
  approve: "批准",
  approving: "正在批准...",
  decline: "拒绝",
  declining: "正在拒绝...",
  apply: "应用变更",
  applying: "正在应用变更...",
  viewInTargeting: "在 Targeting 中查看",
  targetingChanges: "Targeting 变更",
  changeCount: (count) => `${count} 项变更`,
  noChanges: "暂无可显示的 Targeting 语义变更。",
  fallbackRequest: "Targeting 变更请求",
  unavailableFlag: "功能开关不可用",
  unknownUser: "未知用户",
  reviewerFallback: (id) => `审核人 ${id}`,
  you: "你",
  flagOn: "开启",
  flagOff: "关闭",
  summary: (total, reviewCount) =>
    `${total} 个请求 · ${reviewCount} 个需要你审核`,
  expand: "展开变更请求",
  collapse: "收起变更请求",
  loadFailed: "无法加载变更请求。",
  loadFailedHelp: "请重试以刷新当前环境的审核队列。",
  retry: "重试",
  loadMore: "加载更多",
  loadingMore: "加载中...",
  emptyTitle: "暂无变更请求",
  emptyDescription: "从功能开关 Targeting 提交的变更请求将显示在这里。",
  filteredEmptyTitle: "没有符合当前筛选条件的变更请求",
  filteredEmptyDescription: "请清除筛选条件或尝试其它搜索内容。",
  actionSucceeded: (action) =>
    action === "apply"
      ? "变更已应用。"
      : action === "approve"
        ? "变更请求已批准。"
        : "变更请求已拒绝。",
  actionFailed: "无法保存此操作，请重试。",
  actionUnavailable: "此变更请求当前无法执行该操作。",
  selectEnvironment: "请选择环境以查看变更请求。",
  statuses: {
    PendingReview: "待审核",
    Approved: "已批准",
    Declined: "已拒绝",
    Applied: "已应用",
  },
  reviewerStatuses: {
    pending: "待处理",
    approved: "已批准",
    declined: "已拒绝",
  },
}

export function changeRequestsCopy(lang: Lang): ChangeRequestsCopy {
  return lang === "zh" ? zh : en
}
