# Agent Instructions

## React Migration Context

- The existing Angular project in `front-end` is the read-only reference implementation.
- The new React implementation belongs in `front-end-v2`.
- Follow `plan.md` and `implementation-details/*.md` for the migration plan and detailed implementation guidance.
- Do not rename `plan.md` to `AGENTS.md`; keep this file as durable agent instructions and keep the migration plan separate.

## Technology Decisions

- Use Vite SPA + React Router in front-end SPA mode only.
- Use TypeScript, shadcn/ui, Base UI primitives, Tailwind CSS, and `lucide-react`.
- Use TanStack Query for server state and TanStack Table for tables.
- Use React Hook Form + Zod for forms.
- Use `react-i18next` for i18n.
- Use Recharts for charts; do not use G2.
- Use Shiki or a lightweight custom `CodeBlock` for code display; do not use Prism.

## UI And Asset Rules

- Do not modify `front-end-v2/src/index.css`.
- Do not copy Angular/ng-zorro styling one-to-one.
- Prefer shadcn/ui and Tailwind default tokens for buttons, text colors, spacing, radius, focus rings, and common controls.
- When migrating any module into `front-end-v2`, prefer the native shadcn/Base UI components in `front-end-v2/src/components/ui/*`.
- Do not modify the original `components/ui/*` shadcn component files for migration-specific needs; compose or wrap them from feature/layout files.
- If a needed shadcn component is missing from `front-end-v2/src/components/ui/*`, it may be added using the shadcn CLI or official shadcn source for the current `front-end-v2` setup. After a shadcn component file is generated or downloaded into `components/ui/*`, do not hand-edit that generated component file.
- Prefer shadcn default component styles and tokens. Add only small amounts of Tailwind in feature or layout files when necessary.
- Every shadcn/Base UI `Select` must include `SelectGroup` inside `SelectContent`, and every `SelectItem` must be nested in a `SelectGroup`. Never render `SelectItem` directly under `SelectContent`, even when the select has only one logical group. Follow the `OrganizationSelect` composition in `front-end-v2/src/features/organization/general/components/organization-form-fields.tsx`; this preserves the expected option spacing, grouping semantics, and popup alignment with the trigger.
- Split migrated code by responsibility so individual files do not become unusually large.
- Copy only necessary assets such as FeatBit logo, brand SVGs, sample JSON, `env.template.js`, required Monaco assets, and irreplaceable business-specific icons.
- Do not copy the old Angular login background.
- Redesign the login page for the React implementation.

## Integration Testing

- Use Playwright as the default browser E2E runner.
- Use Testcontainers only for real-stack integration tests, not as a replacement for unit/component tests.
- The default Testcontainers integration stack is Postgres + `featbit/featbit-api-server`.
- Do not include `featbit/featbit-evaluation-server` in the default integration test stack.
- Do not depend on `latest` images by default; use pinned tags or environment-overridable image names.

## File Deletion Safety

禁止批量删除文件或目录。

Do not use:

- `del /s`
- `rd /s`
- `rmdir /s`
- `Remove-Item -Recurse`
- `rm -rf`

When deleting files is necessary, delete only one explicit file path at a time.

Correct example:

```powershell
Remove-Item "C:\path\to\file.txt"
```

If bulk deletion is needed, stop and ask the user to delete the files manually.
