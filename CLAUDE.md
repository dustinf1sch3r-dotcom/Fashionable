# Fashionable

A phone app: photograph your clothes, get a digital closet, generate outfits from it, and preview
them on a body silhouette. Expo (React Native) + TypeScript. The current target is the **web build
opened on a phone**; the same code later ships to the App Store and Google Play.

Read before coding: `docs/ROADMAP.md` (your ticket) and the spec it points to —
`docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/OUTFIT_ENGINE.md`, `docs/TRY_ON.md`.

## Hard rules

1. **Program-based only.** No LLM or cloud-AI calls anywhere (outfit logic, tagging, cutouts,
   try-on). Everything runs as ordinary code on the device. The owner decided this; do not
   "improve" it.
2. **Licences.** The app will be sold closed-source. Before adding any dependency or model file,
   check its licence. No GPL/AGPL/LGPL code, no "non-commercial" or "research only" model weights.
   `npm run licenses` must pass; it fails on anything not cleared. Record every new dependency,
   model, font, icon set, image or data source in `docs/LICENSES.md` with its licence and source.
3. **`src/core` is pure.** No `react`, `react-native`, `expo*` imports (ESLint enforces this). Also
   no `Date.now()`, `new Date()` without an argument, `Math.random()`, network or storage: time,
   randomness and data are passed in as parameters so results are reproducible.
4. **Layering.** `app → features → (ui, state) → services → core`. Imports only point downwards;
   `ui` may import `core` types but never `state` or `services`. Details in ARCHITECTURE.md.
5. **Platform code lives only in `src/services`**, behind an interface, using `.web.ts` /
   `.native.ts` files. Features never branch on `Platform.OS` for behaviour.
6. **No `ios/` or `android/` folders** in git, and nothing that only works in a custom native build
   unless the ticket says so. Every feature must work in the web build.
7. **Data contract.** `src/core/model/types.ts` is canonical. Client-generated UUIDs, soft deletes,
   `updatedAt` on every write, images referenced by ID. Changing a stored field needs a migration.
8. **Never weaken a check to get green.** Do not skip, delete or loosen tests, lint rules or type
   checks. If one is wrong, say why in the commit and fix it properly.

## Commands

```bash
npm run check          # typecheck + lint + unit tests — run before every commit
npm run format         # Prettier write (format:check to verify)
npm run build:web      # static web export to dist/
npm run e2e            # Playwright against dist/ at a 390×844 phone viewport (build first)
npm run web            # dev server
npx jest path/to/file  # one test file
```

- `npm run e2e` serves the **existing** `dist/`. Always `npm run build:web` first or you are
  testing stale code.
- In Claude cloud sessions Chromium is pre-installed and `playwright.config.ts` finds it. Never run
  `playwright install` there.
- `npx expo install <pkg>` needs hosts the cloud sandbox may block. If it fails, look up the
  matching version in `node_modules/expo/bundledNativeModules.json` and `npm install pkg@version`.

## Layout

```
app/              Expo Router routes (thin: compose features)
src/core/         pure domain: model, color, engine, gaps, tryon, testing fixtures
src/services/     platform adapters behind interfaces; fakes in services/testing
src/state/        Zustand stores
src/ui/           shared components and theme tokens
src/features/     one folder per feature: closet, outfits, mix, calendar, profile
e2e/              Playwright specs
docs/             specs and roadmap
```

Path alias: `@/…` → `src/…`.

## Conventions

- TypeScript strict. No `any`, no non-null `!` without a comment saying why it is safe.
- Named exports; one component per file; tests beside the code as `*.test.ts(x)`.
- Styling: `StyleSheet.create` with tokens from `src/ui/theme.ts`. No hard-coded colours or
  spacing in features. Touch targets at least 44 pt.
- Every interactive element and screen root gets a `testID` (kebab-case, e.g. `closet-add-button`).
- User-facing text lives in the UI layer. Core returns codes and data, never sentences.
- Engine constants live in `src/core/engine/weights.ts`, never inline.
- Approved libraries: `zustand`, `@react-native-async-storage/async-storage`, `expo-image-picker`,
  `expo-image-manipulator`, `expo-image`, `expo-file-system`, `expo-location`,
  `react-native-svg`, `@testing-library/react-native`. Anything else: justify it in the commit
  message, including its licence, and prefer writing 30 lines over adding a package.
- Keep accessibility in mind: labels on icon buttons, sufficient contrast, no colour-only signals.

## Working a ticket

1. Pick one ticket from `docs/ROADMAP.md`; check its dependencies are ☑. Mark it ◐.
2. Read the spec sections it cites. If the spec is ambiguous or wrong, stop and raise it rather
   than guessing; if you must decide, record the decision in the relevant doc.
3. Stay inside the ticket's folders. Do not refactor neighbouring code or start the next ticket.
4. Write tests with the code. For `src/core`, every row of a rule table in the spec gets a test.

### Definition of done

- [ ] `npm run check` passes.
- [ ] `npm run format:check` and `npm run licenses` pass.
- [ ] For anything visible: `npm run build:web && npm run e2e` passes, with an e2e spec covering
      the new happy path, and you looked at a screenshot at 390×844 to confirm it reads well.
- [ ] No new lint disables, skipped tests or `any`.
- [ ] Docs updated if a contract, rule table or decision changed; ticket marked ☑ in the roadmap.
- [ ] Your report says what you verified and what you could not.

## Known constraints

- Expo SDK 58, React Native 0.88, React 19, TypeScript 6 (`tsconfig.json` lists `types`
  explicitly; add to it if a new `@types/*` package is not picked up).
- Background removal: only the models and runtimes named in ARCHITECTURE.md ("Background removal
  — decision"). `@imgly/background-removal`, BRIA RMBG models and `onnx-community/ISNet-ONNX` are
  not licensed for a sold app: never use them.
- Open-Meteo's free weather API is non-commercial and needs attribution; fine for the proof of
  concept, must move to the paid plan or another provider before sale.
- Browser storage can be evicted. Never treat it as the only copy once export/backup exists.
