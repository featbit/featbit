# Workspace Usage Page Design

This document defines the React design target for the Workspace `Usage` tab. Angular remains the functional reference, but React should use the authenticated React layout, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query, TanStack Table, and Recharts. Do not implement this page by copying Angular/ng-zorro structure or styling one-to-one.

## Design Assets

- Light theme concept: [workspace-usage-light.png](workspace-usage-light.png)
- Dark theme concept: [workspace-usage-dark.png](workspace-usage-dark.png)

These are full-page mockups so the Usage tab can be evaluated in place. They do not redefine the authenticated layout, sidebar, top context bar, Workspace page header, subscription/license badge, account menu, or Workspace tabs.

## Scope And Boundaries

This design covers only the Workspace `Usage` tab content inside the authenticated layout and Workspace tab frame.

- Do not change the authenticated shell, sidebar, top context bar, account menu, or top-right subscription/license badge as part of Usage page work.
- Keep the Workspace page header and tab behavior aligned with [workspace-page-design.md](workspace-page-design.md).
- The design images include the full page only to judge the Usage tab in context. Treat any shell, sidebar, header, account, badge, or tab differences from existing layout assets as image noise, not implementation requirements.
- The page is an operational analytics view. Keep it dense, scannable, and neutral rather than decorative.

## Angular Functional Reference

Angular currently provides these behaviors:

- Period selector supports `This month`, `Last 7 days`, and `Last 30 days`.
- In SaaS mode, Angular loads the current billing cycle and prepends `Current billing cycle` and `Previous billing cycle` when the cycle is monthly or shorter.
- The selected date range is shown beside the period selector.
- The API call uses `startDate`, `endDate`, `prevStartDate`, and `prevEndDate`.
- Summary metrics show Unique Users, Flag Evaluations, and Custom Metrics, each with percent change against the previous period.
- Daily trend shows one metric at a time.
- Per-environment usage is sortable by metric columns and shows the environment path, environment name, usage value, share percentage, and a small progress bar.

Preserve these information and data behaviors in React.

## React Page Structure

The Usage tab should sit under the Workspace horizontal tabs:

```text
General | License | Usage | Billing | Global Users
```

Main content order:

1. Page heading and period controls
2. Summary metric cards
3. Daily trend chart
4. Per-environment table

Controls row:

- Do not repeat an inner `Usage` title or descriptive subtitle inside the tab body. The surrounding Workspace page header already provides the page context.
- Right side: period selector and selected date range.
- Period selector options follow Angular behavior. Use shadcn `Select`.
- Date range text is muted and right-aligned on desktop.
- Keep the left side of this row empty on desktop so the metric cards can sit closer to the Workspace tabs.

## Summary Metrics

Show three equal-width metric cards on desktop:

- `Unique Users`
- `Flag Evaluations`
- `Custom Metrics`

Each card includes:

- A lucide icon in a subtle tinted square.
- Metric label.
- Formatted value.
- Percent change and comparison label.

Color rules:

- Positive change uses semantic success green.
- Negative change uses semantic destructive red.
- Zero or unavailable change uses muted neutral text.
- Keep metric icon backgrounds subtle. Avoid making the cards large colored tiles.

## Daily Trend

Use Recharts for the chart.

Chart panel:

- Title: `Daily Trend`
- Segmented metric control with `New Users`, `Flag Evaluations`, and `Custom Metrics`.
- Show one line/area chart at a time.
- Use a stable chart height around `280px`.
- Keep axes, grid, and tooltip restrained and readable.
- The selected metric drives chart color:
  - New Users: green
  - Flag Evaluations: blue
  - Custom Metrics: amber

States:

- Loading: skeleton for the segmented control and chart plot area.
- Empty: quiet centered empty state inside the chart area.
- Error: inline alert with retry action.

## Per-Environment Table

Use TanStack Table.

Columns:

- `Environment`
- `Unique Users`
- `Flag Evaluations`
- `Custom Metrics`

Environment cell:

- Primary text: environment name.
- Secondary text: `Organization / Project`.

Metric cells:

- Formatted value.
- Share percentage, calculated against the selected period total for that metric.
- Small horizontal progress bar.
- Use the same metric colors as summary/chart, but keep progress tracks neutral.

Sorting:

- Metric columns support ascending and descending sort.
- Default sort should favor the highest primary usage signal. Prefer Flag Evaluations descending unless product requirements choose another default.

Responsive behavior:

- Desktop: full table with all columns.
- Tablet: keep all columns, allow horizontal overflow if needed.
- Mobile: allow horizontal table scrolling rather than stacking metric cells into tall cards.

## Data And Formatting Notes

Use the existing workspace usage API shape:

```text
GET /api/v1/workspaces/usages
params: startDate, endDate, prevStartDate, prevEndDate
```

Data model:

- `summary.uniqueUsers`
- `summary.totalFlagEvaluations`
- `summary.totalCustomMetrics`
- previous-period summary values for comparison
- `dailyTrend[].newUsers`
- `dailyTrend[].flagEvaluations`
- `dailyTrend[].customMetrics`
- `environmentUsages[]`

Format rules:

- Table values use locale-aware integer formatting.
- Chart axis values may use compact formatting such as `1.2K` or `7.8M`.
- Percent change is rounded to whole numbers.
- Usage share percentage can keep one decimal place when needed.
- If previous value is zero, show neutral `0%` or `No previous data` instead of implying infinite growth.

## Visual Direction

- Follow the density and layout language from [react-layout-design.md](react-layout-design.md).
- Use neutral shadcn-style surfaces, subtle borders, and 6-8px radius.
- Do not use Angular/ng-zorro card styling, G2 visuals, or old palette decisions as the React target.
- Avoid hero-style spacing, decorative illustrations, large colored bands, and oversized typography.
- Keep text compact but legible. Labels, values, and table content must not overflow at common desktop widths.

## Dark Theme Guidance

The dark design target is [workspace-usage-dark.png](workspace-usage-dark.png). It preserves the same structure and information hierarchy as the light design:

- Use neutral dark page and panel surfaces.
- Keep chart gridlines low-contrast.
- Keep positive, negative, blue, and amber accents subdued enough for dark mode.
- Preserve table density and progress bar semantics.

## Acceptance Criteria For Later Implementation

- Usage route renders under Workspace tabs and does not alter the authenticated layout.
- Period options match Angular behavior, including SaaS billing-cycle options when eligible.
- Selected period produces the same date filter semantics as Angular.
- Summary cards show correct values and previous-period comparison labels.
- Metric switching updates the Recharts line/area chart without remount artifacts.
- The per-environment table supports metric sorting and shows value, share, and progress indicator in each metric cell.
- Loading, empty, and error states are present for all data regions.
- The page works in `/en` and `/zh` routes and uses i18n keys for visible text.
