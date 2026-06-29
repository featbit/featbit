# Workspace Billing Tab Design

This document defines the React design target for the Workspace `Billing` tab content only. Angular remains the functional reference, but React should use the existing authenticated React layout, Workspace page frame, shadcn/ui primitives, Tailwind tokens, lucide-react icons, TanStack Query/Table, React Hook Form + Zod, and `react-i18next`.

Do not change the authenticated layout, sidebar, top context bar, account menu, subscription/license badge, Workspace page header, or Workspace tabs when implementing this design. The design target starts inside the active `Billing` tab panel.

## Design Assets

- Light theme concept: [workspace-billing-light.png](workspace-billing-light.png)
- Manage subscription drawer concept: [workspace-billing-manage-subscription.png](workspace-billing-manage-subscription.png)
- Upgrade plan drawer concept: [workspace-billing-upgrade-plan.png](workspace-billing-upgrade-plan.png)
- Billing information edit concept: [workspace-billing-information-edit.png](workspace-billing-information-edit.png)

## Angular Functional Reference

Angular billing currently provides:

- SaaS-only billing tab under Workspace.
- Current subscription summary from `GET /api/v1/billing/subscription`.
- MAU usage alert when current usage is at least 90% of purchased MAU.
- MAU usage meter, remaining MAU, and healthy/warning/critical headroom label.
- Pending downgrade notice when `subscription.pendingDowngrade` exists.
- Billing period, next charge, and subscriber-since fields for paid plans.
- Fee breakdown with base plan, extended MAU, Fine-grained Access Control add-on, and total charge.
- `Manage Subscription` action that opens a pricing/change-plan drawer.
- `open=pricing` query parameter that opens the pricing drawer.
- Billing information display/edit form from `GET/PUT /api/v1/billing/billing-information`.
- Invoice history table from `GET /api/v1/billing/invoices`.
- Support mail action to `support@featbit.co`.
- Checkout return flow driven by `payment_status`, including canceled, verifying, success, and delayed-verification states.

Preserve these behaviors, but do not copy Angular/ng-zorro layout or styling one-to-one.

## Scope

The Billing tab should feel like a compact operational billing console, not a marketing pricing page. It should sit directly below the Workspace tabs with the same width, density, and card language as the General, License, Usage, and Global Users designs.

Only render this tab in SaaS hosting mode. In non-SaaS mode the Billing tab should not appear.

Do not duplicate the top-right layout subscription/license badge. The Billing tab may summarize the current subscription, but the top badge remains layout-owned.

## Page Structure

Content order:

1. Optional checkout or usage alert.
2. Subscription overview panel.
3. Two-column lower grid with Billing information and Invoice history.
4. Pricing/change-plan drawer when opened.
5. Update subscription confirmation modal when needed.

Use a vertical stack with `gap-6`. On wide desktop, keep the lower grid as two equal columns. On tablet and mobile, stack Billing information above Invoice history.

Do not add a second page heading such as `Billing` inside the tab. The active Workspace tab already provides the local title.

## Alerts

Checkout query-state alert:

- If `payment_status=succeeded`, show a compact verification alert/panel at the top of the tab while polling the billing license state.
- If verification succeeds, show a success alert: `Payment confirmed. Your subscription is active.`
- If verification times out, show a warning alert with `Check again`, `Return to billing`, and `Contact support`.
- If checkout was canceled or any non-success status is present, show an informational alert: `Payment cancelled. Your subscription has not changed.`
- Keep these alerts inside the Billing tab content. Do not navigate to a separate checkout-return page shell in React.

Usage alert:

- Show only when MAU usage is at least 90%.
- Use warning style for 90-99% and destructive style when usage exceeds purchased MAU.
- Title variants: `Approaching usage limit` and `MAU limit exceeded`.
- Include a compact percent badge such as `92% used`.
- Actions: primary `Upgrade plan`, secondary/link `Contact support`.

When both checkout and usage alerts apply, show checkout first because it explains route state.

## Subscription Overview

Use a single full-width neutral bordered panel. Keep it visually related to existing Workspace cards: white surface, light gray border, 6-8px radius, compact typography, sparse semantic accents.

Top row:

- Left: current plan name, billing cycle badge, short plan description.
- Price line: `$149 / month` or `$4,490 / year`.
- Right: primary button `Manage subscription`.

Paid plan period strip:

- Three compact columns with top labels:
  - `Billing period`
  - `Next charge`
  - `Subscriber since`
- Hide this strip for the Free plan or show `N/A` only where data is meaningful. Prefer hiding it for Free to reduce noise.

Pending downgrade:

- Place a quiet blue info alert below the top row and above the period strip.
- Copy pattern: `Scheduled downgrade: Your plan will move to Pro on Jul 1, 2026. Current access remains active until then.`
- Include selected MAU, add-ons, and billing cycle only when available, but keep the sentence short enough to wrap cleanly.

Summary body:

- Left tile: Current usage.
  - Label: `Current usage`
  - Subtext: selected billing period.
  - Metric row: `Monthly Active Users` and `18,420 / 40,000`.
  - Progress bar with blue for healthy, amber for warning, red for exceeded.
  - Footer: remaining MAU and headroom label.
- Right tile: Fee breakdown.
  - Rows: plan base price, extended MAU if present, Fine-grained Access Control if enabled.
  - Bottom total row: `Total charge`.

Avoid decorative gradients in the React design. Use subtle neutral panels and semantic color only for status, action, and progress states.

## Billing Information

Use one lower-grid panel titled `Billing information` with a muted subtitle: `Used for workspace invoices and billing emails.`

Display mode:

- Right-side ghost/button action: icon + `Edit`.
- Fields:
  - Company name
  - Contact email
  - Address
  - Address line 2
  - Tax ID
  - Country / Region
- Empty values render as muted `Not provided`, not blank cells.
- Use a compact two-column definition layout where possible; long address rows span the panel width.

Edit mode:

- Use React Hook Form + Zod.
- Required fields: company name, contact email, address, country/region.
- Validate email locally.
- Fields match Angular names and placeholders.
- Footer actions: secondary `Cancel`, primary `Save changes`.
- Saving state disables actions and shows progress on the primary button.
- On save success, return to display mode and show toast `Billing information updated successfully.`
- On save failure, keep the user in edit mode unless the backend returns unrecoverable data; show toast `Failed to update billing information. Please try again later.`

## Invoice History

Use one lower-grid panel titled `Invoice history` with a muted subtitle: `Recent invoices for this workspace.`

Table columns:

- `Billing date`
- `Plan`
- `Status`
- `Amount`

Behavior:

- Use TanStack Table.
- Client-side pagination is acceptable if the API returns the current list like Angular; use page size 5 to match Angular behavior.
- Status badges:
  - `paid`: green or neutral-success `Paid`.
  - `pending`: amber `Pending`.
  - `overdue`: destructive `Overdue`.
  - Unknown statuses: neutral badge with the raw status.
- Amount uses `amountPaid / 100` and currency formatting from the invoice currency when available.
- Empty state preserves the panel and table area, with file-text icon and `No invoices yet`.
- Include a low-emphasis support note below the title or table footer: `Need a PDF or have a question about a charge? Contact support.`

Do not invent invoice download actions unless the API supports them. Angular currently directs users to support for download/questions.

## Pricing Drawer

The `Manage subscription` and usage-alert `Upgrade plan` actions open a drawer, not a new page. Opening `/workspace/billing?open=pricing` should also open this drawer and then clean up the query parameter.

Use the same underlying drawer component for both entry points, but tune the drawer copy and initial emphasis to the user's intent:

- `Manage subscription` opens the general subscription-management state shown in [workspace-billing-manage-subscription.png](workspace-billing-manage-subscription.png).
- `Upgrade plan` opens the usage-driven upgrade state shown in [workspace-billing-upgrade-plan.png](workspace-billing-upgrade-plan.png).

Drawer structure:

- Title: `Pricing plans`.
- Subtitle: `Choose the plan and capacity for this workspace.`
- Width: large desktop drawer, roughly 900-960px.
- Plans:
  - Free, Pro, and Growth in a compact three-column grid.
  - Enterprise as a full-width plan row below the grid.
- Current plan gets a small `Current plan` badge.
- Use sliders for configurable MAU plans.
- Use a checkbox/toggle for Fine-grained Access Control where available.
- Enterprise keeps a monthly/yearly segmented control and yearly savings text.
- Plan action labels:
  - `Upgrade to ...`
  - `Downgrade to ...`
  - `Update plan`
  - Disabled `Current plan`
- `Need more than 300K MAU? Contact us` appears when Enterprise slider reaches max.

Keep the drawer visually aligned with shadcn tokens. It should be dense and scannable; avoid large marketing cards, oversized type, and decorative color blocks.

Manage subscription drawer:

- Keep the Billing page visible underneath with a light overlay; do not navigate away from Workspace.
- Drawer title: `Manage subscription`.
- Subtitle: `Review plans, MAU capacity, add-ons, and billing cycle for this workspace.`
- Show a compact current-subscription summary at the top: current plan, current MAU, billing cycle, next charge, and current total.
- Show Free, Pro, and Growth as compact plan cards in a three-column row. Growth is the current plan and should show `Current plan`.
- Show Enterprise as a full-width comparison row below the compact plans.
- For the current plan, show controls to update MAU and add-ons; the primary action is `Update plan` only when the selected capacity/add-ons differ from the current subscription.
- For lower-tier plans, use a secondary `Downgrade to ...` action.
- For higher-tier plans, use primary `Upgrade to ...`.
- Keep plan cards equal height in each row and keep action buttons pinned to the card footer.

Upgrade plan drawer:

- Drawer title: `Upgrade plan`.
- Subtitle: `Increase capacity before this billing cycle reaches its MAU limit.`
- Include a warning context strip at the top with the current usage percentage, for example `36,800 of 40,000 MAU used`.
- Pre-focus the current paid plan's MAU capacity controls or the next higher plan rather than the Free plan.
- Show the current plan capacity control as the first actionable recommendation: selected MAU, included MAU, extra MAU cost, and projected recurring total.
- Show Enterprise as the secondary recommended path when the user needs a larger feature bundle or annual billing.
- Keep `Contact support` available as a quiet secondary action in the drawer header or footer.
- If the selected update is a paid-to-paid change, continue to the Update Subscription modal after the user clicks `Update plan` or `Upgrade to ...`.

## Update Subscription Modal

For paid-to-paid changes, show a confirmation modal before calling upgrade/downgrade endpoints.

Modal content:

- Title: `Upgrade subscription` or `Downgrade subscription`.
- Transition headline: current plan to new plan, or `Your plan configuration is changing`.
- Notes:
  - Upgrade: unlocks immediately, prorated charge, future invoices follow new cadence.
  - Downgrade: current access remains until renewal, new price starts next invoice, selected MAU/add-ons are captured.
- Order summary:
  - New recurring total or next cycle total.
  - Base price.
  - MAU included/extended amount.
  - Fine-grained Access Control add-on when selected.
  - Current recurring total.
  - Effective date for downgrade.
- Upgrade proration preview:
  - Loading state: `Calculating your prorated charge...`
  - Error state: `Unable to load proration preview. You will see the exact charge at checkout.`
  - Loaded state: display credit/charge lines and `Total due today`.
- Footer:
  - Secondary `Maybe later`.
  - Primary `Confirm upgrade` for upgrades.
  - Secondary/destructive-neutral `Schedule downgrade` for downgrades.

After a successful update, persist the same notification intent as Angular and refresh billing data. Do not rely on a full page reload in the design target.

## API Data Shape

Use the existing billing API shape:

```text
GET  /api/v1/billing/subscription
GET  /api/v1/billing/current-cycle
POST /api/v1/billing/subscription
POST /api/v1/billing/subscription/proration-preview
POST /api/v1/billing/subscription/upgrade
POST /api/v1/billing/subscription/downgrade
GET  /api/v1/billing/license
GET  /api/v1/billing/billing-information
PUT  /api/v1/billing/billing-information
GET  /api/v1/billing/invoices
```

Subscription fields used by the UI:

- `plan`, mapped to local pricing plan metadata.
- `billingCycle`.
- `baseMau`, `mau`, and `usage.mau`.
- `addOnFeatures`.
- `unitAmount`.
- `currentPeriodStart`, `currentPeriodEnd`, `createdAt`.
- `pendingDowngrade`.
- `isLocal`.

## Loading, Error, And Empty States

Loading:

- Subscription panel: skeleton for plan title, price, period strip, usage tile, and fee tile.
- Billing information: skeleton rows matching display fields.
- Invoices: skeleton table rows.

Error:

- Subscription fetch failure: show an inline destructive alert in the tab body and allow retry.
- Billing information fetch failure: panel-level error with retry.
- Invoice fetch failure: panel-level error with retry.
- Pricing drawer mutation failures use toasts and keep the drawer/modal open.

Empty:

- No billing information: display fields as `Not provided`, keeping Edit available.
- No invoices: preserve the invoice panel and show the empty state.

## Responsive Rules

- Desktop: overview panel full width; Billing information and Invoice history in two columns.
- Tablet/mobile: lower panels stack; overview top row stacks with action below plan identity.
- Tabs remain horizontally scrollable as defined by the Workspace page design.
- Progress bars, table cells, and buttons must keep stable dimensions and avoid text overflow.
- Invoice table may horizontally scroll on narrow screens instead of collapsing columns.

## Visual Acceptance

- Billing tab renders inside the existing Workspace page frame without altering layout chrome.
- Content starts directly under the Workspace tabs and does not introduce another page title.
- Primary action hierarchy is clear: `Manage subscription` and `Upgrade plan` are primary; edit/support/invoice follow-ups are secondary.
- Usage and payment states use semantic alerts rather than decorative banners.
- Lower panels feel like siblings of the Usage and Global Users tab panels.
- The design does not introduce a new color system; use FeatBit blue for primary actions, amber for warning usage/pending invoice states, red for exceeded/overdue/failure, green only for paid/success.
