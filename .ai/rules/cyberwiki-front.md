---
trigger: always_on
---

# CyberWiki Frontend Rules

Based on [FrontX AI Guidelines](https://github.com/cyberfabric/frontx/tree/develop/.ai).

## AI WORKFLOW (REQUIRED)

- Route: identify target area (pages, api, events, styling, etc.).
- Read: MUST read target files before changing code.
- Summarize: list 3-7 rules from target area (internal, not written).
- Verify: pass Pre-diff Checklist before proposing code.
- STOP: if unsure which rules apply, ask instead of guessing.

## DESIGN PRINCIPLES (REQUIRED)

Every change is judged against SOLID + DRY. Use these as concrete review questions, not slogans:

### SOLID

- **S — Single Responsibility.** A component, hook, effect, or module owns *one* concern. If a file has both data-fetching effects AND UI render branches, OR a class with mutation methods AND validation methods, split it. Pages orchestrate; components render; effects do I/O; lib/* helpers are pure.
- **O — Open / Closed.** Add new variants (a new modal size, a new status code, a new event domain) by extending an enum / a config map / a registry — not by adding `if`-branches to existing code. Example: a new git-provider HTTP status goes into `HttpStatus`, not into a new ad-hoc literal union.
- **L — Liskov.** Components/hooks that share a prop interface must be drop-in interchangeable. If `<FooViewer>` accepts `{ value: T }`, every implementation must honour the same contract — no silently-stricter requirements.
- **I — Interface Segregation.** Prop types stay narrow — don't pile every flag a feature might ever want into one mega-`Props`. Compose small interfaces (`ModalProps + FormProps`) instead of one fat one. Public API services follow the same rule: separate `query` / `mutation` per intent.
- **D — Dependency Inversion.** Components depend on action functions and event types, not on API services or store internals. Effects own the wiring. Lib helpers (`notify`, `formatDate`, `httpStatus`) are imported by *callers*, not coupled into framework primitives.

### DRY

- One source of truth per fact:
  - HTTP status codes → `lib/httpStatus.ts` (`HttpStatus` enum), never inline.
  - Date rendering → `lib/formatDate.ts`.
  - Toasts → `lib/notify.ts`.
  - Modal frame → `components/primitives/Modal.tsx`.
  - Translation keys → `locales/en.json`.
  - Validators / regex → `<domain>FormHelpers.ts`.
- A second consumer of an inline literal/regex/helper is the trigger to lift it. Three is too late.
- Duplicate JSX (two near-identical 20-line blocks differing by a label) is a refactor signal, not a stylistic preference. Extract a small subcomponent.
- Don't paste constants — import enums. `if (status === 401)` is a smell; `if (status === HttpStatus.Unauthorized)` is the rule.

## FILE PLACEMENT (CRITICAL)

### Application pages and features → `src/app/`

All pages, components, actions, effects, events, API services, and layouts MUST be created under `src/app/`.

```json
src/app/
├── pages/           # Application pages (LoginPage, ProfilePage, etc.)
├── api/             # API services (AccountsApiService, etc.)
├── actions/         # Flux actions (emit events)
├── effects/         # Flux effects (listen to events, dispatch to slices)
├── events/          # Event type declarations (EventPayloadMap augmentation)
├── components/      # Shared UI components, grouped by domain (see below)
├── layout/          # App shell (Header, Sidebar, Layout)
├── themes/          # Theme definitions
├── icons/           # Icon components
└── lib/             # Utility functions
```

### i18n (REQUIRED — string-literals are banned in migrated files)

- Translation strings live in `src/app/locales/<lang>.json` (English `en.json` is the source of truth).
- Components use `const { t } = useTranslation()` from `@cyberfabric/react` and refer to keys like `t('domain.feature.label')`. Plurals follow i18next convention via `key` + `key_plural` and `count`.
- The loader is registered in `src/app/main.tsx` (`app.i18nRegistry.registerLoader('app', …)`); add a locale by extending the `switch` and dropping a new JSON file next to `en.json`.
- **String-literal text is banned by lint** in the migrated file list (eslint.config.js → "i18n" block):
  - JSX text containing two or more letters in a row.
  - String-literal value of `placeholder`, `title`, `alt`, `label`, `aria-label`, `aria-description` attributes.
  Add a new file to that list when you migrate it; don't enable the rule selectively per-line.
- For numbers in templates use the i18n params object: `t('changes.totalLabel', { count })` (key has `_plural` sibling for plurals).
- Avoid embedding raw single-character glyphs (✓, ⚠, →, ✕) in t() values when an icon component is available — keep symbols out of translations.
- `t()` is allowed in components/pages and effects. It is **not** allowed in `api/`, `types.ts`, `*.types.ts` (lint).
- Migrated and lint-locked: every page (`src/app/pages/*.tsx`), all modals, all enrichments, all file/file-mapping/loading components, layout `Header` + `Menu`, `ApiTokensSection`. The full list of allowlist files is the single block in `eslint.config.js`. New components must be added to the list when migrated, otherwise the rule does not run on them.
- Brand names and API enums that happen to look like prose (e.g. `"Milkdown"`, `"GitHub"`) still go through `t()` so the entire user-facing surface is one source of truth.
- **Effects use `t()` from `@/app/lib/i18n` (NOT `useTranslation`).** `useTranslation` is a React hook and is unusable outside components. Effects, services, and other plain modules call the singleton via `import { t } from '@/app/lib/i18n'`. The helper forwards to `i18nRegistry.t()` from `@cyberfabric/react`; both surfaces share the same registry. All error-message fallbacks emitted by effects (`extractErrorMessage(err, FALLBACK)`, `error.message ?? FALLBACK`, `notify.error(FALLBACK)`) MUST be `t('errors.X')` — keys live under the `errors.*` namespace in `en.json`.
- **Hardcoded sentence-style English strings are banned in `src/app/effects/**`** by a dedicated lint block: any `Literal` or `TemplateElement` matching `/^[A-Z][a-zA-Z]+\s+[a-z]/` (e.g. `'Failed to …'`, `'Validation failed'`, `'Login failed'`, `'Commit failed'`) errors out. Add a key under `errors.*` and call `t('errors.X')` instead.

### Date formatting (REQUIRED)

Every date rendered in the UI goes through `@/app/lib/formatDate`:

- `formatDate(value)` → date only.
- `formatDateTime(value)` → date + time.
- `formatTime(value)` → time only.
- Inputs accepted: ISO string, numeric epoch (s or ms), `Date`, `null`, `undefined`. Invalid/missing values render as `—` (or a custom fallback you pass).
- Inline `new Date(x).toLocale*String()` is banned by lint. The single carve-out is `BlameView.tsx`, which uses custom `Intl.DateTimeFormatOptions`.
- Number formatting (`number.toLocaleString()`) is NOT a date and is allowed.

### Upstream HTML auth errors

When fetching content from a remote git provider (Bitbucket Server / GitHub) the backend can bubble a 200 response whose body is the provider's HTML login / 401 / 403 page instead of file content. The `wiki/file/open` effect sniffs the first 2 KB of `content`; if it begins with `<!doctype html` or `<html` and matches a status keyword (401 / unauthorized / 403 / forbidden / 404), it emits `wiki/file/error` with a clean message instead of `wiki/file/loaded`. New effects that stream file/diff content from an external git host MUST replicate this heuristic — never let raw upstream HTML reach `FileViewer` or any renderer.

### Notifications (REQUIRED)

User-facing toasts and developer logs both go through `@/app/lib/notify`:

- `notify.success / info / warn / error` for user-visible toasts.
- Pass `{ dev: true }` to additionally log to the browser console **in dev builds only**. Internal level switch uses the `DevLogLevel` enum (no string-literal unions).
- For an error caught in a `try/catch`, narrow with `error instanceof Error ? error : null` and pass to `describeError(...)` — never pass `unknown` directly.
- `console.*` is banned project-wide and only `lib/notify.ts` + `lib/performanceTracker.ts` (perf-toggle-gated metrics) may call it. Linted by `no-console: warn` with explicit overrides.

### Performance logging (REQUIRED)

- Verbose `[Performance]` traces from `lib/performanceTracker` are gated by the **`perfLogEnabled`** user setting (Profile → Performance log toggle), NOT by `import.meta.env.DEV`.
- The setting is independent from `debugMode` so users hunting a slow request don't have to also enable every dev-only UI affordance.
- **Both the metric ring-buffer AND console traces are gated by the toggle.** When OFF, `pushMetric` is a no-op, `trackPerformance` returns the wrapped promise without timing, and the Logs page sees only what was captured while the toggle was ON. The flag is applied synchronously on `user/settings/update` via `setPerfLogEnabled`, so toggling it stops/starts collection on the next API call. Don't wire any new instrumentation that bypasses the toggle.
- New module-local toggles that mirror a user setting follow the same pattern: `setXxx(value)` setter exported from the lib file, hooked from `effects/userSettingsEffects.ts` on `loaded` / `updated`.

### Modal / dialog component (REQUIRED)

For any modal, confirmation, drawer-like dialog, file-import dialog, etc.:

- Use `Modal` from `@/app/components/primitives/Modal` with the `ModalSize` enum for sizing.
- Compose with `<Modal.Header>`, `<Modal.Body>`, `<Modal.Footer>` when the built-in `title` prop is not enough.
- For two-button confirmations use `ConfirmDialog` (already wraps `Modal`).
- Do NOT write your own overlay `<div className="fixed inset-0 ... bg-black/...">` and do NOT call `createPortal` from a feature/page file. Both are linted.
- Exceptions: state-driven `layout/Popup` and `layout/Overlay` (Redux slices for the global popup/overlay stack).

### Components → `src/app/components/` (domain-grouped)

Components are organized by **domain**, not by abstraction layer. Generic primitives live in `primitives/`; everything else groups by what it does (space, file, changes, etc.).

```text
src/app/components/
├── primitives/      # shadcn/Radix-style primitives — Avatar, ConfirmDialog, ContextMenu, DropdownMenu, Sidebar, Skeleton, Sonner, CodeBlock
├── space/           # Space CRUD + tree — CreateSpaceModal, EditSpaceModal, SpaceTree
├── file/            # File viewer ecosystem — FileViewer, FileTree, FileRenderer, MdRenderer, PlainTextContentRenderer, FileViewerHeader, ViewModeSwitcher, CreateFileModal
├── file-mapping/    # File-mapping config — FileMappingConfiguration, FileMappingConfigPanel, FileMappingPreview
├── changes/         # Drafts + PR — DraftDiffView, PRBanner
├── enrichments/     # Enrichment UI — EnrichmentPanel, Comment, CommentsTab, ChangesTab, ConflictDetailsDialog, ConflictResolutionWidget, DiffViewer
├── loading/         # Loading states — SmartLoadingIndicator, TextLoader, ViewLoadingFallback
├── ApiTokensSection.tsx
└── ThemeProvider.tsx
```

- New components **must** be placed in the matching domain folder; only truly cross-cutting providers (theme, root-level sections) sit at the components root.
- When creating a new domain (≥3 related components), add a new subfolder rather than letting the root grow.
- Enrichment **types**, **API service** (`EnrichmentsApiService`), **events**, **actions**, and **effects** live in `src/app/` (under `api/`, `events/`, `actions/`, `effects/`).
- No MFE packages — `src/mfe_packages/` does not exist.

## UI KIT DISCOVERY (REQUIRED)

- Read `frontx.config.json` at project root to find `uikit` value.
- If `uikit` is `"shadcn"`: use local `components/primitives/` (shadcn components already scaffolded).
- If `uikit` is `"none"`: no UI library; create all components locally.
- Before creating ANY new UI component, verify the configured UI kit does not already provide it.

## ARCHITECTURE RULES

### Event-Driven Flux Pattern

All state flow follows: **Action → Event → Effect → Slice**

- **Actions** (`src/app/actions/`): pure functions that `eventBus.emit(...)` an event
  - Must return `void` — no `Promise<void>`, no async keyword
  - Fire-and-forget; cannot access store state (no `getState`)
  - Use imperative names: `loadSpaces`, `createSpace`
  - May compose other actions
- **Events** (`src/app/events/`): type-safe `EventPayloadMap` augmentation via `declare module '@cyberfabric/react'`
  - Use past-tense names: `wiki/spaces/loaded`, `wiki/space/created`
  - Every key must exist in `EventPayloadMap`; one payload type per key
- **Effects** (`src/app/effects/`): `eventBus.on(...)` handlers that call API services and `dispatch(...)` to Redux slices
  - Update only their own slice; no business logic
  - May NOT call actions (prevents loops)
  - May emit result/error events to notify UI
- **Slices**: Redux state managed by `@cyberfabric/react`

### API Services

- Extend `BaseApiService` from `@cyberfabric/react`
- One domain service per backend domain (no entity-based services)
- Use `RestEndpointProtocol` for declarative endpoints:
  - `query<TData>(path)` — GET requests
  - `mutation<TData, TVariables>(method, path)` — POST/PUT/PATCH/DELETE
- Base URL pattern: `/api/{domain}/v1`
- All requests go through Vite proxy to backend at `http://localhost:8888`
- `withCredentials: true` for session-cookie auth
- **`apiRegistry.getService(...)` may only be called inside `src/app/effects/`.** Pages and components must go through actions → events → effects. Use `apiRegistry.has(...)` checks only inside effects/bootstrap.
- **`eventBus.emit(...)` is forbidden inside `src/app/components/` and `src/app/pages/`.** Components import an action from `src/app/actions/` and call it; the action emits.
- **No mocks in production code** — all data from real backend

### Styling Rules

- Use Tailwind classes and theme tokens — no inline `style={{}}` outside `components/primitives/`
- No hardcoded hex colors — use CSS variables (`hsl(var(--primary))`) or Tailwind classes
- Units: rem-based tokens; `px` allowed only for border width
- Dark mode: CSS variables via `[data-theme]`
- Responsive behavior uses Tailwind prefixes (mobile-first)

### Import Rules

- Same package: relative paths
- Cross-branch in app: `@/` alias (maps to `src/`)
- Cross-package: `@cyberfabric/react`, `@cyberfabric/framework`
- UI components: local `components/primitives/`
- No barrel exports unless aggregating 3+ exports
- Redux slices: import directly (no barrels)
- Barrels MUST NOT re-export `*Props` types alongside their components — Props are private to their module. Exception: a Props type genuinely consumed by 2+ outside callers may be re-exported, with a comment explaining why.

### Type Rules

- `type` for objects and unions; `interface` for React props
- **Literal-value unions are banned everywhere** — string OR numeric. Define an `enum` and use the enum members in code (`local/prefer-enum-over-union: error` globally). All of these are violations:
  - `'create' | 'import'` (string literals)
  - `401 | 403 | 404` (numeric literals — exactly the same anti-pattern)
  - `'a' | 'b' | 'c'` inline as a prop type, state, status field, return type, etc.

  Sample enums in the codebase: `ModalSize`, `SidebarMenuButtonVariant`, `DevLogLevel`, `CreateFileMode`, `CommitPrStatus`, `HttpStatus`. Carve-outs (e.g. shadcn primitives that mirror upstream union props) re-disable the rule per-file with a comment.
- No hardcoded string IDs — use constants or enums
- No `any`, no `unknown` anywhere in `src/app/**`. For open-ended JSON values use `ExtraJsonValue` from `@/app/api/types` (recursive `string | number | boolean | null | array | object`). Banned in `api/`, `types.ts`, `*.types.ts` (lint).
- No `as unknown as` casts
- Resolve type errors at boundaries using proper generics
- Class member order: properties -> constructor -> methods
- Use lodash for non-trivial object and array operations

## STOP CONDITIONS

- Modifying registry root files
- Adding new top-level dependencies without approval
- Bypassing event-driven architecture
- Direct slice dispatch from components

## BLOCKLIST

- No telemetry or tracking code
- No `eslint-disable` comments (enforced by `noInlineConfig: true` + baseline check via `npm run lint:check-disables`)
- No literal-value unions anywhere — `'a' | 'b'` (string) or `401 | 403 | 404` (numeric), whether named, inline in a prop type, or inside a struct's field type. Define an enum (`local/prefer-enum-over-union: error` is global). Existing shared enums to reach for: `HttpStatus`, `ModalSize`, `DevLogLevel`, `FileStatusCode`-style domain enums, etc.
- No `as unknown as` type casts
- No `unknown` in public type definitions
- No manual state sync or prop drilling (use events)
- No direct slice dispatch from components (use actions → events → effects)
- No native helpers where lodash equivalents exist
- No barrel exports that hide real imports
- No direct axios/fetch outside BaseApiService
- No hardcoded hex colors or inline styles outside `components/primitives/`
- **No hand-rolled modal overlays.** The string `fixed inset-0 ... bg-black/` and direct `createPortal` calls are banned outside `components/primitives/`. Use `<Modal>` from `components/primitives/Modal.tsx`. State-driven `layout/Popup` and `layout/Overlay` keep their own implementation but are the only exception.
- **No hardcoded user-facing strings in the i18n allowlist.** JSX text, `placeholder=`, `title=`, `alt=`, `label=`, `aria-label=`, `aria-description=` MUST be `t('key')` calls in any file listed in the eslint.config.js i18n block. See "i18n (REQUIRED)" above.
- **No hardcoded English fallbacks in `src/app/effects/**`.** Sentence-style English literals (e.g. `'Failed to load X'`, `'Validation failed'`) are banned by lint. Use `t('errors.X')` from `@/app/lib/i18n`; the `errors.*` namespace in `en.json` is the single source.
- No `console.*` outside `lib/notify.ts` and `lib/performanceTracker.ts` — toasts go through `notify.error/warn/info/success`.
- No inline `new Date(x).toLocale*String()` outside `lib/formatDate.ts` (and `BlameView.tsx` exception). Use `formatDate / formatDateTime / formatTime`.
- No direct `apiRegistry.getService(...)` from components/pages — only effects. No `eventBus.emit(...)` from components/pages — call an action.

## PRE-DIFF CHECKLIST

- [ ] Import paths follow import rules
- [ ] Pages/features created under `src/app/`
- [ ] Event-driven architecture (actions emit → effects handle → slice update)
- [ ] Actions return void, no async keyword
- [ ] Effects do not call actions
- [ ] API types defined in `src/app/api/wikiTypes.ts`
- [ ] All sizes use rem tokens; inline styles only in `components/primitives/`
- [ ] UI uses configured UI kit (check `frontx.config.json`)
- [ ] No console errors
- [ ] TypeScript compiles without errors
- [ ] `npm run arch:check` passes
- [ ] `npm run lint:check-disables` passes (zero eslint-disable directives)
- [ ] User-facing strings go through `t('key')` and live in `src/app/locales/en.json`. If you migrated a new file, you also added it to the i18n allowlist in `eslint.config.js`.
- [ ] Effects use `t()` from `@/app/lib/i18n` (not `useTranslation`). Every error fallback (`extractErrorMessage(err, FALLBACK)`, `error.message ?? FALLBACK`, `notify.error(FALLBACK)`) reads from `errors.*` in `en.json`.
- [ ] Dates rendered through `formatDate` / `formatDateTime` / `formatTime`; no inline `toLocale*String()`.
- [ ] Toasts and developer logs through `notify.*`; no direct `console.*` outside `lib/notify.ts` and `lib/performanceTracker.ts`.
- [ ] Modals use `<Modal>` from `components/primitives/Modal`; no hand-rolled `fixed inset-0 ... bg-black/...` overlay or `createPortal` from feature/page code.
- [ ] No `apiRegistry.getService(...)` or `eventBus.emit(...)` in components/pages.
- [ ] SOLID: file does one job. SRP-violation? Split. New variant added by extending an enum / config map, not by adding an `if`-branch.
- [ ] DRY: HTTP codes via `HttpStatus`, dates via `formatDate`, toasts via `notify`, modals via `<Modal>`, translation keys via `t()`. No second copy of an inline literal, regex, or helper — lift it on the second consumer.

## CORRECTION POLICY

- Add or update a rule here (short and focused).
- Store memory of the correction.
- If new items require central edits, redesign to self-register.

## FEATURE CREATION POLICY

- Reuse existing patterns where possible.
- If adding a 3rd or later similar item, consider an index file.
- If new items require central edits, redesign to self-register.

## PAGE SIZE BUDGET

- Files in `src/app/pages/**/*.tsx` are capped at **700 non-blank/non-comment lines** (lint).
- A page that grows past this budget is a code smell — split heavy panels/tabs into colocated components in `src/app/components/{domain}/`.

## DOMAIN HELPERS

- Validation, regex constants, and field-error types live in `*FormHelpers.ts` files alongside the domain (e.g. `components/space/spaceFormHelpers.ts`). Modals/forms must not redefine these inline.
- A second consumer of any inline validator is the trigger to lift it.
