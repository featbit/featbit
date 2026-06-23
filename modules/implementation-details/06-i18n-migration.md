# 06 - i18n Migration

## Goal

Migrate English and Chinese copy from Angular templates and `messages.zh.xlf` into `react-i18next` JSON namespaces while preserving language-prefixed routing.

## Routing

- Keep `/en/*` and `/zh/*` as first-class URL prefixes.
- Redirect `/` based on browser language.
- Language switcher should preserve the current route and query parameters when possible.
- Unsupported language prefixes should fall back to English or a safe default route.

## Resource Organization

Use namespace-based JSON files:

```text
src/lib/i18n/locales/
  en/
    common.json
    auth.json
    navigation.json
    feature-flags.json
    users.json
    segments.json
    experiments.json
    audit-logs.json
    admin.json
  zh/
    common.json
    auth.json
    navigation.json
    feature-flags.json
    users.json
    segments.json
    experiments.json
    audit-logs.json
    admin.json
```

## Extraction Rules

- Extract source English copy from Angular templates and TypeScript where available.
- Extract Chinese copy from `messages.zh.xlf`.
- Keep keys stable and semantic, not based on full sentences.
- Avoid embedding route names, permissions, or API enum labels directly in components.
- Centralize common labels such as Save, Cancel, Delete, Search, Filter, Status, Type, Tags, Created, Updated, and Confirm.

## Formatting

- Use `react-i18next` interpolation for dynamic values.
- Use date/number formatting helpers for locale-sensitive values.
- Avoid manual string concatenation in translated UI.

## Acceptance Criteria

- Login, shell, navigation, and migrated domain pages render in English and Chinese.
- Language switching works without losing the current workspace/project/environment context.
- Missing translation keys are visible in development and covered by a validation script or test.
