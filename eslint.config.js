/**
 * FrontX ESLint Configuration (Standalone)
 * Base rules for FrontX projects - screenset architecture and flux pattern
 *
 * This is a SELF-CONTAINED configuration that includes all rules inline.
 * It does NOT depend on @cyberfabric/eslint-config (which is monorepo-only internal tooling).
 *
 * Rules included:
 * - L0 Base: Universal rules (no-any, unused-imports, prefer-const, etc.)
 * - L4 Screenset: Flux architecture, screenset isolation, domain-based rules
 *
 * This is the single source of truth for standalone project ESLint rules.
 * - CLI copies this to new projects via copy-templates.ts
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { createRequire } from 'module';

// Local plugin uses CommonJS, need to require it
// eslint-plugin-local is in project/ (sibling to configs/)
const localPlugin = createRequire(import.meta.url)('./eslint-plugin-local');

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.config.*',
      '**/*.cjs',
      'scripts/**',
      'eslint-plugin-local/**', // ESLint plugin is CommonJS, has its own linting
    ],
  },

  // Base JS config
  js.configs.recommended,

  // TypeScript config
  ...tseslint.configs.recommended,

  // ==== L0 BASE: Universal rules for all TS/TSX files ====
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // Unused detection
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Type safety - strict typing required
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': true,
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],
      // Ban loose types - use concrete types instead (typescript-eslint v8+ rules)
      '@typescript-eslint/no-empty-object-type': 'error', // Disallows {}
      '@typescript-eslint/no-unsafe-function-type': 'error', // Disallows Function
      '@typescript-eslint/no-wrapper-object-types': 'error', // Disallows Object, String, Number, etc.
      // Code quality
      'prefer-const': 'error',
      // No raw console.* in app code — use notify.* instead. The two
      // sanctioned exceptions (lib/notify.ts internal devLog, and
      // lib/performanceTracker.ts dev-gated metrics) override below.
      'no-console': 'warn',
      'no-var': 'error',
      'no-empty-pattern': 'error',

      // Layer Architecture Enforcement
      // App-layer projects must only import from @cyberfabric/react (Layer 3), not from L1/L2 packages
      // Use @typescript-eslint rule to catch TypeScript-specific imports (import type, side-effect imports)
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@cyberfabric/framework', '@cyberfabric/framework/*'],
              message:
                'LAYER VIOLATION: App-layer code must import from @cyberfabric/react, not directly from @cyberfabric/framework (Layer 2).',
            },
            {
              group: ['@cyberfabric/state', '@cyberfabric/state/*'],
              message:
                'LAYER VIOLATION: App-layer code must import from @cyberfabric/react, not directly from @cyberfabric/state (Layer 1).',
            },
            {
              group: ['@cyberfabric/api', '@cyberfabric/api/*'],
              message:
                'LAYER VIOLATION: App-layer code must import from @cyberfabric/react, not directly from @cyberfabric/api (Layer 1).',
            },
            {
              group: ['@cyberfabric/i18n', '@cyberfabric/i18n/*'],
              message:
                'LAYER VIOLATION: App-layer code must import from @cyberfabric/react, not directly from @cyberfabric/i18n (Layer 1).',
            },
            {
              group: ['@cyberfabric/screensets', '@cyberfabric/screensets/*'],
              message:
                'LAYER VIOLATION: App-layer code must import from @cyberfabric/react, not directly from @cyberfabric/screensets (Layer 1).',
            },
            // TanStack Query - use HAI3 wrappers instead
            {
              group: ['@tanstack/react-query'],
              message:
                'QUERY VIOLATION: Do not import from @tanstack/react-query directly. ' +
                'Use useApiQuery, useApiMutation, useApiStream, or useQueryCache from @cyberfabric/react. ' +
                'HAI3Provider already includes QueryClientProvider.',
            },
            // Redux term bans - use FrontX state terms instead
            {
              group: ['react-redux'],
              importNames: ['useDispatch'],
              message:
                'REDUX VIOLATION: Do not use useDispatch from react-redux. Use useAppDispatch from @cyberfabric/react instead.',
            },
            {
              group: ['react-redux'],
              importNames: ['useSelector'],
              message:
                'REDUX VIOLATION: Do not use useSelector from react-redux. Use useAppSelector from @cyberfabric/react instead.',
            },
          ],
        },
      ],
    },
  },

  // Terminology: Ban 'reducer' in user-defined identifiers (allow .reducer property access)
  {
    files: ['src/app/**/*', 'src/screensets/**/*'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "VariableDeclarator > Identifier[name=/[Rr]educer/]",
          message:
            'TERMINOLOGY: Use "slice" instead of "reducer" in HAI3 applications. Example: const userSlice = createSlice(...)',
        },
        {
          selector: "FunctionDeclaration > Identifier[name=/[Rr]educer/]",
          message:
            'TERMINOLOGY: Use "slice" instead of "reducer" in HAI3 applications. Example: function createUserSlice()',
        },
      ],
    },
  },

  // ==== L4 SCREENSET: React hooks + Flux architecture + Domain rules ====
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      local: localPlugin,
    },
    linterOptions: {
      noInlineConfig: true,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/exhaustive-deps': 'error',

      // Screenset Architecture: Domain-based conventions (disabled globally, enabled for screensets)
      'local/no-barrel-exports-events-effects': 'off',
      'local/no-coordinator-effects': 'off',
      'local/no-missing-domain-id': 'off',
      'local/domain-event-format': 'off',
      'local/no-inline-styles': 'error',
      'local/uikit-no-business-logic': 'off',
      'local/screen-inline-components': 'off',
      'local/no-direct-tanstack-hooks': 'off',
      'local/no-manual-query-keys': 'off',
      'local/no-gts-id-manipulation': 'error',
      // String-literal unions become drift bait; require enums everywhere.
      // Carve-outs (e.g. shadcn primitive variant props) re-enable 'off'
      // file-by-file in their own block.
      'local/prefer-enum-over-union': 'error',

      // Type safety: Discourage loose types
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message:
            'TYPE VIOLATION: Avoid using `unknown` type. Define a concrete interface or type instead.',
        },
        {
          selector: 'TSObjectKeyword',
          message:
            'TYPE VIOLATION: Avoid using `object` type. Use a concrete interface or Record<string, T> instead.',
        },
        // Flux Architecture: No direct store.dispatch
        {
          selector:
            "CallExpression[callee.name='dispatch'] > MemberExpression[object.name='store']",
          message:
            'FLUX VIOLATION: Components must not call store.dispatch directly. Use actions instead. See EVENTS.md.',
        },
        // Lodash enforcement
        {
          selector: "CallExpression[callee.property.name='trim']",
          message:
            "LODASH VIOLATION: Use lodash trim() instead of native .trim(). Import { trim } from 'lodash'.",
        },
        {
          selector: "CallExpression[callee.property.name='charAt']",
          message:
            'LODASH VIOLATION: Use lodash string methods instead of native .charAt().',
        },
        {
          selector: "CallExpression[callee.property.name='substring']",
          message:
            'LODASH VIOLATION: Use lodash truncate() or other string methods instead of native .substring().',
        },
        {
          selector: "CallExpression[callee.property.name='toUpperCase']",
          message:
            'LODASH VIOLATION: Use lodash upperCase() or upperFirst() instead of native .toUpperCase().',
        },
        {
          selector: "CallExpression[callee.property.name='toLowerCase']",
          message:
            'LODASH VIOLATION: Use lodash lowerCase() or lowerFirst() instead of native .toLowerCase().',
        },
        // Date formatting: must go through @/app/lib/formatDate.
        // The Number exception is whitelisted via callee object name, but
        // the call site `someValue.toLocaleString()` on a number variable is
        // covered by the file-level override on formatDate.ts itself.
        {
          selector:
            "CallExpression[callee.property.name='toLocaleDateString']",
          message:
            'DATE VIOLATION: Use formatDate from @/app/lib/formatDate instead of toLocaleDateString().',
        },
        {
          selector:
            "CallExpression[callee.property.name='toLocaleTimeString']",
          message:
            'DATE VIOLATION: Use formatTime from @/app/lib/formatDate instead of toLocaleTimeString().',
        },
      ],
    },
  },

  // Date helper carve-outs.
  // - lib/formatDate.ts is the implementation, naturally calls toLocale*.
  // - BlameView uses custom Intl.DateTimeFormatOptions and is allowed.
  // For these files we drop only the date selectors by re-declaring the
  // L4 SCREENSET no-restricted-syntax array minus those entries — keeps all
  // other bans (lodash, dispatch, etc.) intact.
  {
    files: [
      'src/app/lib/formatDate.ts',
      'src/app/components/file/BlameView.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSUnknownKeyword',
          message:
            'TYPE VIOLATION: Avoid using `unknown` type. Define a concrete interface or type instead.',
        },
        {
          selector: 'TSObjectKeyword',
          message:
            'TYPE VIOLATION: Avoid using `object` type. Use a concrete interface or Record<string, T> instead.',
        },
        {
          selector:
            "CallExpression[callee.name='dispatch'] > MemberExpression[object.name='store']",
          message:
            'FLUX VIOLATION: Components must not call store.dispatch directly. Use actions instead.',
        },
        {
          selector: "CallExpression[callee.property.name='trim']",
          message: 'LODASH VIOLATION: Use lodash trim() instead of native .trim().',
        },
        {
          selector: "CallExpression[callee.property.name='charAt']",
          message: 'LODASH VIOLATION: Use lodash methods instead of native .charAt().',
        },
        {
          selector: "CallExpression[callee.property.name='substring']",
          message: 'LODASH VIOLATION: Use lodash truncate() instead of native .substring().',
        },
        {
          selector: "CallExpression[callee.property.name='toUpperCase']",
          message: 'LODASH VIOLATION: Use lodash upperCase() instead of native .toUpperCase().',
        },
        {
          selector: "CallExpression[callee.property.name='toLowerCase']",
          message: 'LODASH VIOLATION: Use lodash lowerCase() instead of native .toLowerCase().',
        },
      ],
    },
  },

  // Screensets: Domain-based architecture rules
  {
    files: ['src/screensets/**/*'],
    rules: {
      'local/no-barrel-exports-events-effects': 'error',
      'local/no-coordinator-effects': 'error',
      'local/no-missing-domain-id': 'error',
      'local/domain-event-format': 'error',
    },
  },

  // GTS format parsing is the authorized responsibility of the GTS module
  {
    files: ['**/mfe/gts/**/*.{ts,tsx}'],
    rules: {
      'local/no-gts-id-manipulation': 'off',
    },
  },

  // Tests construct fixture IDs — format manipulation is acceptable in test code
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'local/no-gts-id-manipulation': 'off',
    },
  },

  // App: Domain-based architecture rules for actions/effects
  {
    files: ['src/app/actions/**/*', 'src/app/effects/**/*'],
    rules: {
      'local/no-barrel-exports-events-effects': 'error',
    },
  },

  // App: Prevent coordinator effect anti-pattern in effects
  {
    files: ['src/app/effects/**/*'],
    rules: {
      'local/no-coordinator-effects': 'error',
    },
  },

  // App: Domain event format for events
  {
    files: ['src/app/events/**/*'],
    rules: {
      'local/domain-event-format': 'error',
    },
  },

  // UI components: Presentational components only (no @cyberfabric/react business logic)
  {
    files: ['src/components/ui/**/*.{ts,tsx}', 'src/mfe_packages/*/src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'local/uikit-no-business-logic': 'error',
    },
  },

  // Screens: Detect inline component definitions
  {
    files: ['src/screensets/**/screens/**/*Screen.tsx'],
    rules: {
      'local/screen-inline-components': 'error',
    },
  },

  // Data Layer: Enforce HAI3 query wrappers (no direct TanStack hooks or manual cache keys)
  {
    files: [
      'src/screensets/**/*.{ts,tsx}',
      'src/app/**/*.{ts,tsx}',
      'src/mfe_packages/*/src/**/*.{ts,tsx}',
    ],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'local/no-direct-tanstack-hooks': 'error',
      'local/no-manual-query-keys': 'error',
    },
  },

  // Flux Architecture: Effects cannot import actions
  {
    files: ['**/*Effects.ts', '**/*Effects.tsx', '**/effects/**/*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/actions/**',
                '../actions/**',
                './actions/**',
                '**/core/actions/**',
              ],
              message:
                'FLUX VIOLATION: Effects cannot import actions (circular flow risk). Effects only listen to events and update slices. See EVENTS.md.',
            },
          ],
        },
      ],
    },
  },

  // Flux Architecture: Actions cannot import slices
  {
    files: ['**/*Actions.ts', '**/*Actions.tsx', '**/actions/**/*'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/*Slice', '../*Slice', './*Slice', '**/*Slice.ts'],
              message:
                'FLUX VIOLATION: Actions cannot import slice files. Actions should emit events via eventBus, effects update slices. See EVENTS.md.',
            },
            {
              group: ['**/slices/**', '../slices/**', './slices/**'],
              message:
                'FLUX VIOLATION: Actions cannot import from /slices/ folders. Emit events instead. See EVENTS.md.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "FunctionDeclaration[returnType.typeAnnotation.typeName.name='Promise']",
          message:
            'FLUX VIOLATION: Actions must return void, not Promise<void>. Use fire-and-forget pattern.',
        },
        {
          selector:
            "ArrowFunctionExpression[returnType.typeAnnotation.typeName.name='Promise']",
          message:
            'FLUX VIOLATION: Actions must return void, not Promise<void>. Use fire-and-forget pattern.',
        },
        {
          selector: 'FunctionDeclaration[async=true]',
          message:
            'FLUX VIOLATION: Actions must NOT use async keyword. Use fire-and-forget pattern.',
        },
        {
          selector: 'ArrowFunctionExpression[async=true]',
          message:
            'FLUX VIOLATION: Actions must NOT use async keyword. Use fire-and-forget pattern.',
        },
        {
          selector: "FunctionDeclaration:has(Identifier[name='getState'])",
          message:
            'FLUX VIOLATION: Actions are PURE FUNCTIONS. They must NOT access store via getState().',
        },
        {
          selector: "ArrowFunctionExpression:has(Identifier[name='getState'])",
          message:
            'FLUX VIOLATION: Actions are PURE FUNCTIONS. They must NOT access store via getState().',
        },
      ],
    },
  },

  // Components: No direct slice dispatch
  {
    files: ['src/screensets/**/*.tsx', 'src/components/**/*.tsx', 'src/app/**/*.tsx'],
    ignores: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/*Slice.tsx',
      '**/actions/**',
      '**/effects/**',
      '**/store/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/store/*Store',
                '../store/*Store',
                './store/*Store',
                '../../store/*Store',
              ],
              message:
                'FLUX VIOLATION: Components cannot import custom stores. Use Redux slices with useSelector and dispatch actions.',
            },
            {
              group: [
                '**/hooks/use*Store',
                '../hooks/use*Store',
                './hooks/use*Store',
                '../../hooks/use*Store',
              ],
              message:
                'FLUX VIOLATION: Components cannot use custom store hooks. Use Redux useSelector hook.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name='dispatch'] CallExpression[callee.name=/^set[A-Z]/]",
          message:
            'FLUX VIOLATION: Components cannot call slice reducers (setXxx functions). Use actions from /actions/ instead.',
        },
        {
          selector:
            "CallExpression[callee.name='dispatch'] CallExpression[callee.object.name][callee.property.name]",
          message:
            'FLUX VIOLATION: Do not dispatch slice actions directly. Use event-emitting actions instead. See EVENTS.md.',
        },
        {
          selector:
            "CallExpression[callee.object.name=/Store$/][callee.property.name!='getState']",
          message:
            'FLUX VIOLATION: Components cannot call custom store methods directly. Use Redux actions and useSelector.',
        },
      ],
    },
  },

  // Flux Architecture: Effects cannot emit events
  // NOTE: Disabled for CyberWiki — effects emit result/error events (wiki/spaces/loaded, etc.)
  // which is the designed pattern for notifying UI of async operation results.
  // {
  //   files: ['**/*Effects.ts', '**/effects/**/*.ts'],
  //   ignores: ['**/*.test.*', '**/*.spec.*'],
  //   rules: {
  //     'no-restricted-syntax': [
  //       'error',
  //       {
  //         selector:
  //           "CallExpression[callee.object.name='eventBus'][callee.property.name='emit']",
  //         message:
  //           'FLUX VIOLATION: Effects cannot emit events (creates circular flow). Effects should only listen to events and update slices.',
  //       },
  //     ],
  //   },
  // },

  // Data Layer: forbid t() in types AND keep the unknown ban from L4 SCREENSET.
  // Flat config replaces no-restricted-syntax arrays per file, so we restate
  // what we want to keep here.
  {
    files: ['**/types/**/*', '**/api/**/*', '**/mocks.ts', '**/*.types.ts'],
    ignores: ['**/*.test.*', '**/*.spec.*', '**/*.tsx', '**/*.jsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='t']",
          message:
            'I18N VIOLATION: Translation function t() should NOT be used in types, interfaces, or data structures.',
        },
        {
          selector: 'TSUnknownKeyword',
          message:
            'TYPE VIOLATION: api/ types must be concrete. For an open-ended JSON value use ExtraJsonValue from @/app/api.',
        },
        {
          selector: 'TSObjectKeyword',
          message:
            'TYPE VIOLATION: api/ types must be concrete. Use a Record<string, ExtraJsonValue> or a named interface.',
        },
      ],
    },
  },

  // Mock Data: Strict lodash enforcement
  {
    files: ['**/mocks.ts', '**/mock*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='trim']",
          message:
            'MOCK DATA VIOLATION: Use lodash trim() instead of native .trim() in mock data factories.',
        },
        {
          selector: "CallExpression[callee.property.name='charAt']",
          message:
            'MOCK DATA VIOLATION: Use lodash string methods instead of native .charAt() in mock data.',
        },
        {
          selector: "CallExpression[callee.property.name='substring']",
          message:
            'MOCK DATA VIOLATION: Use lodash truncate() or other methods instead of native .substring() in mock data.',
        },
        {
          selector: "CallExpression[callee.property.name='toUpperCase']",
          message:
            'MOCK DATA VIOLATION: Use lodash upperCase() or upperFirst() instead of native .toUpperCase() in mock data.',
        },
        {
          selector: "CallExpression[callee.property.name='toLowerCase']",
          message:
            'MOCK DATA VIOLATION: Use lodash lowerCase() or lowerFirst() instead of native .toLowerCase() in mock data.',
        },
        {
          selector: "CallExpression[callee.property.name='slice']",
          message:
            'MOCK DATA VIOLATION: Use lodash slice() instead of native .slice() in mock data.',
        },
      ],
    },
  },

  // ==== App Events: Allow inline config for module augmentation ====

  // main variants: @/app/themes is copied from monorepo at template build (manifest root.directories),
  // not present in template-sources-only checkouts — allow @ts-expect-error on theme imports.
  {
    files: [
      'src/app/main.tsx',
      'src/app/main.custom-uikit.tsx',
      'src/app/main.no-uikit.tsx',
      'src/app/initApp.ts',
      // Monorepo: ESLint cwd may be repo root, so paths include packages/cli/template-sources/project/
      'packages/cli/template-sources/project/src/app/main.tsx',
      'packages/cli/template-sources/project/src/app/main.custom-uikit.tsx',
      'packages/cli/template-sources/project/src/app/main.no-uikit.tsx',
    ],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Type conventions: Prefer enum over string-literal unions in type definition files
  {
    files: [
      'src/app/api/**/*.ts',
      'src/app/**/types.ts',
      'src/app/**/*.types.ts',
      'src/mfe_packages/*/src/**/*.types.ts',
    ],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'local/prefer-enum-over-union': 'error',
    },
  },

  // Tree components: dynamic padding-left requires inline style (Tailwind cannot interpolate runtime values)
  {
    files: ['src/app/pages/SpaceViewPage.tsx'],
    rules: {
      'local/no-inline-styles': 'off',
    },
  },
  // Primitives may use inline styles for third-party component APIs (e.g. SyntaxHighlighter customStyle)
  {
    files: ['src/app/components/primitives/**/*.tsx'],
    rules: {
      'local/no-inline-styles': 'off',
    },
  },

  // Components/pages: composite no-restricted-syntax block.
  // Flat config replaces (not merges) array-valued rules per file, so this
  // block must restate every selector that applies to components/pages —
  // otherwise an override block wipes the others. Keep this list in sync
  // with the L4 SCREENSET block when adding rules.
  {
    files: ['src/app/components/**/*.{ts,tsx}', 'src/app/pages/**/*.{ts,tsx}'],
    ignores: [
      'src/app/components/primitives/**',
      // BlameView uses custom Intl.DateTimeFormatOptions on toLocaleDateString,
      // which formatDate doesn't expose. Allowed by exception.
      'src/app/components/file/BlameView.tsx',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        // Flux: API access is for effects only.
        {
          selector:
            "CallExpression[callee.object.name='apiRegistry'][callee.property.name='getService']",
          message:
            'FLUX VIOLATION: apiRegistry.getService() is allowed only in src/app/effects/. Pages/components must dispatch an action (src/app/actions/) which emits an event handled by an effect.',
        },
        {
          selector:
            "CallExpression[callee.object.name='eventBus'][callee.property.name='emit']",
          message:
            'FLUX VIOLATION: eventBus.emit() is forbidden in components/pages. Import an action from src/app/actions/ and call it instead.',
        },
        // Type bans (mirrors L4 SCREENSET).
        {
          selector: 'TSUnknownKeyword',
          message:
            'TYPE VIOLATION: Avoid using `unknown` type. Define a concrete interface or type instead.',
        },
        {
          selector: 'TSObjectKeyword',
          message:
            'TYPE VIOLATION: Avoid using `object` type. Use a concrete interface or Record<string, T> instead.',
        },
        // Lodash bans intentionally NOT mirrored here yet — pre-existing
        // call sites would explode the lint output. Tracked by Task 9.
        // Date formatting.
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString']",
          message:
            'DATE VIOLATION: Use formatDate from @/app/lib/formatDate instead of toLocaleDateString().',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleTimeString']",
          message:
            'DATE VIOLATION: Use formatTime from @/app/lib/formatDate instead of toLocaleTimeString().',
        },
        // Slice dispatch (mirrors components block).
        {
          selector:
            "CallExpression[callee.name='dispatch'] CallExpression[callee.name=/^set[A-Z]/]",
          message:
            'FLUX VIOLATION: Components cannot call slice reducers (setXxx functions). Use actions from /actions/ instead.',
        },
        // Modal primitive monopoly (mirrors Modal block).
        {
          selector:
            "JSXAttribute[name.name='className'][value.type='Literal'][value.value=/fixed[^\"']*inset-0[^\"']*bg-(black|background)\\//]",
          message:
            'MODAL VIOLATION: Hand-rolled overlay banned. Use <Modal> from @/app/components/primitives/Modal.',
        },
        {
          selector:
            "TemplateElement[value.raw=/fixed[^`]*inset-0[^`]*bg-(black|background)\\//]",
          message:
            'MODAL VIOLATION: Hand-rolled overlay banned. Use <Modal> from @/app/components/primitives/Modal.',
        },
      ],
    },
  },

  // Page size: pages must orchestrate, not implement. Anything heavy goes
  // to a colocated component under src/app/components/.
  {
    files: ['src/app/pages/**/*.tsx'],
    ignores: ['**/*.test.*', '**/*.spec.*'],
    rules: {
      'max-lines': [
        'error',
        { max: 700, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  // Notify boundary: console is allowed only in the two dev-gated helpers
  // that wrap it. Everything else has to use lib/notify.ts.
  {
    files: ['src/app/lib/notify.ts', 'src/app/lib/performanceTracker.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // i18n: ban hardcoded user-facing strings in already-migrated files. New
  // files joining this list must route every JSX text node and every
  // placeholder/aria-label/title/alt attribute through `t('key')`.
  // Strings are stored in src/app/locales/en.json; the loader is in main.tsx.
  //
  // The rule operates by selector and is intentionally narrow:
  //   - JSXText with two or more letters in a row (skips punctuation, dots).
  //   - String-literal value of common copy-bearing attributes.
  // Files NOT in this glob are exempt while their migration is pending.
  {
    files: [
      // Pages
      'src/app/pages/LoginPage.tsx',
      'src/app/pages/ProfilePage.tsx',
      'src/app/pages/TokensPage.tsx',
      'src/app/pages/SpacesPage.tsx',
      'src/app/pages/PRsPage.tsx',
      'src/app/pages/CommentsPage.tsx',
      'src/app/pages/LogsPage.tsx',
      'src/app/pages/DashboardPage.tsx',
      'src/app/pages/SpaceConfigurationPage.tsx',
      'src/app/pages/SpaceViewPage.tsx',
      'src/app/pages/ChangesPage.tsx',
      // Modals
      'src/app/components/space/CreateSpaceModal.tsx',
      'src/app/components/space/EditSpaceModal.tsx',
      'src/app/components/file/CreateFileModal.tsx',
      // Enrichments
      'src/app/components/enrichments/Comment.tsx',
      'src/app/components/enrichments/CommentsTab.tsx',
      'src/app/components/enrichments/ChangesTab.tsx',
      'src/app/components/enrichments/EnrichmentPanel.tsx',
      'src/app/components/enrichments/ConflictResolutionWidget.tsx',
      'src/app/components/enrichments/ConflictDetailsDialog.tsx',
      'src/app/components/enrichments/GitOpsLogPanel.tsx',
      'src/app/components/enrichments/DiffViewer.tsx',
      // Changes
      'src/app/components/changes/RecentCommitsPanel.tsx',
      'src/app/components/changes/CommitPrBanner.tsx',
      'src/app/components/changes/PRBanner.tsx',
      'src/app/components/changes/DraftDiffView.tsx',
      // File viewer ecosystem
      'src/app/components/file/FileViewer.tsx',
      'src/app/components/file/FileViewerHeader.tsx',
      'src/app/components/file/FileTree.tsx',
      'src/app/components/file/FileRenderer.tsx',
      'src/app/components/file/PlainTextContentRenderer.tsx',
      'src/app/components/file/MdRenderer.tsx',
      'src/app/components/file/ViewModeSwitcher.tsx',
      // BlameView uses custom Intl.DateTimeFormatOptions on toLocaleDateString,
      // which formatDate doesn't expose. i18n strings are migrated, but this
      // file is excluded so the date selector below doesn't double-flag it.
      // 'src/app/components/file/BlameView.tsx',
      'src/app/components/file/FileStatus.tsx',
      // File mapping
      'src/app/components/file-mapping/FileMappingConfiguration.tsx',
      'src/app/components/file-mapping/FileMappingConfigPanel.tsx',
      'src/app/components/file-mapping/FileMappingPreview.tsx',
      // Loading
      'src/app/components/loading/SmartLoadingIndicator.tsx',
      'src/app/components/loading/ViewLoadingFallback.tsx',
      // Layout
      'src/app/layout/Header.tsx',
      'src/app/layout/Menu.tsx',
      // Misc
      'src/app/components/ApiTokensSection.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        // i18n bans first.
        {
          selector: "JSXText[value=/[A-Za-z]{2,}/]",
          message:
            "I18N VIOLATION: Hardcoded JSX text is banned. Move the string to src/app/locales/en.json and render with t('key').",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(placeholder|title|alt|label|aria-label|aria-description)$/][value.type='Literal'][value.value=/[A-Za-z]{2,}/]",
          message:
            "I18N VIOLATION: Hardcoded copy attribute is banned. Use t('key') from @cyberfabric/react.",
        },
        // Mirror of the rules from the composite components/pages block so
        // flat-config doesn't silently drop them when this block matches.
        {
          selector:
            "CallExpression[callee.object.name='apiRegistry'][callee.property.name='getService']",
          message:
            'FLUX VIOLATION: apiRegistry.getService() is allowed only in src/app/effects/.',
        },
        {
          selector:
            "CallExpression[callee.object.name='eventBus'][callee.property.name='emit']",
          message:
            'FLUX VIOLATION: eventBus.emit() is forbidden in components/pages. Use an action from src/app/actions/.',
        },
        {
          selector: 'TSUnknownKeyword',
          message:
            'TYPE VIOLATION: Avoid using `unknown` type. Define a concrete interface or type instead.',
        },
        {
          selector: 'TSObjectKeyword',
          message:
            'TYPE VIOLATION: Avoid using `object` type. Use a concrete interface or Record<string, T> instead.',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString']",
          message:
            'DATE VIOLATION: Use formatDate from @/app/lib/formatDate instead of toLocaleDateString().',
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleTimeString']",
          message:
            'DATE VIOLATION: Use formatTime from @/app/lib/formatDate instead of toLocaleTimeString().',
        },
        {
          selector:
            "CallExpression[callee.name='dispatch'] CallExpression[callee.name=/^set[A-Z]/]",
          message:
            'FLUX VIOLATION: Components cannot call slice reducers (setXxx functions). Use actions from /actions/ instead.',
        },
        {
          selector:
            "JSXAttribute[name.name='className'][value.type='Literal'][value.value=/fixed[^\"']*inset-0[^\"']*bg-(black|background)\\//]",
          message:
            'MODAL VIOLATION: Hand-rolled overlay banned. Use <Modal> from @/app/components/primitives/Modal.',
        },
        {
          selector:
            "TemplateElement[value.raw=/fixed[^`]*inset-0[^`]*bg-(black|background)\\//]",
          message:
            'MODAL VIOLATION: Hand-rolled overlay banned. Use <Modal> from @/app/components/primitives/Modal.',
        },
      ],
    },
  },

  // Effects: error fallbacks must be translated. Effects run outside React
  // (no useTranslation hook) so they MUST go through the singleton via
  // `t()` from @/app/lib/i18n. We ban any sentence-style English string
  // literal — anything matching "Capitalized lowercase…" — to catch the
  // common `'Failed to load X'`, `'Validation failed'`, `'Commit failed'`
  // shapes. Keys live under `errors.*` in src/app/locales/en.json.
  {
    files: ['src/app/effects/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "Literal[value=/^[A-Z][a-zA-Z]+\\s+[a-z]/]",
          message:
            "I18N VIOLATION: Hardcoded English fallback strings are banned in effects. Add a key under `errors.*` in src/app/locales/en.json and use `t('errors.X')` from @/app/lib/i18n.",
        },
        {
          selector: "TemplateElement[value.raw=/^[A-Z][a-zA-Z]+\\s+[a-z]/]",
          message:
            "I18N VIOLATION: Hardcoded English fallback strings are banned in effects. Add a key under `errors.*` in src/app/locales/en.json and use `t('errors.X')` from @/app/lib/i18n.",
        },
      ],
    },
  },

  // Modal primitive monopoly: createPortal imports outside primitives are
  // banned (forces use of <Modal>). The hand-rolled-overlay className regex
  // lives in the components/pages composite block above so it doesn't get
  // overridden by other no-restricted-syntax blocks.
  {
    files: ['src/app/**/*.{ts,tsx}'],
    ignores: [
      'src/app/components/primitives/**',
      'src/app/layout/Popup.tsx',
      'src/app/layout/Overlay.tsx',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-dom',
              importNames: ['createPortal'],
              message:
                'MODAL VIOLATION: Use <Modal> from @/app/components/primitives/Modal instead of calling createPortal directly.',
            },
          ],
        },
      ],
    },
  },
];
