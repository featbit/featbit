# 06 - i18n Migration

## Goal

Maintain English and Chinese copy in `react-i18next` resources while preserving language-prefixed routing.

## Routing

- Keep `/en/*` and `/zh/*` as first-class URL prefixes.
- Redirect `/` based on browser language.
- Language switcher should preserve the current route and query parameters when possible.
- Unsupported language prefixes should fall back to English or a safe default route.

## Resource Organization

Maintain English and Chinese translations in the TypeScript resource modules under `src/lib/i18n/resources/`, registered by `src/lib/i18n/i18n.ts`.

## Extraction Rules

- Update both English and Chinese resources for new or changed UI copy.
- Keep keys stable and semantic, not based on full sentences.
- Avoid embedding route names, permissions, or API enum labels directly in components.
- Centralize common labels such as Save, Cancel, Delete, Search, Filter, Status, Type, Tags, Created, Updated, and Confirm.

## Formatting

- Use `react-i18next` interpolation for dynamic values.
- Use date/number formatting helpers for locale-sensitive values.
- Avoid manual string concatenation in translated UI.

## Acceptance Criteria

- Login, layout, navigation, and migrated domain pages render in English and Chinese.
- Language switching works without losing the current workspace/project/environment context.
- Missing translation keys are visible in development and covered by a validation script or test.
