## Przegląd (reviewer)

Reviewed files: `backend/models.py`, `backend/ai.py`, `backend/routes/review.py`, `backend/main.py`, `frontend/lib/api.ts`, `frontend/components/ReviewResult.tsx`, `frontend/app/review/page.tsx`, `frontend/app/page.tsx`, `frontend/components/Sidebar.tsx`

---

### Critical

None found.

---

### Important

**1. Missing `type` keyword on type import — `frontend/app/review/page.tsx` line 7**

```ts
import { reviewCV, ReviewResult } from "@/lib/api";
```

`isolatedModules: true` is set in `tsconfig.json`. `ReviewResult` is a type-only export and must be imported with `import type { ReviewResult }` or `import { reviewCV, type ReviewResult }`. Without this, the TypeScript compiler will emit a warning/error under `isolatedModules` and the Next.js build may fail.

**2. Security — internal exception details leak to API consumers — `backend/routes/review.py` line 16**

```python
raise HTTPException(status_code=500, detail=f"Review failed: {str(e)}")
```

`str(e)` can expose internal information: Anthropic API keys embedded in error messages from the SDK, internal file paths from JSON parse failures, or model-level error details. Should use a generic message and log the actual exception server-side.

**3. No input length upper bound — `backend/routes/review.py` line 11**

Only a minimum length of 50 characters is checked. There is no maximum. A malicious or accidental request with a very large CV (e.g. several MB of text) will be forwarded directly to the Anthropic API and could cause runaway token costs or OOM conditions in the backend. An upper bound (e.g. 20 000 characters) should be enforced.

**4. `max_tokens=2500` may be insufficient for full `review_cv` response — `backend/ai.py` line 135**

The prompt requires exactly 5 section scores, exactly 3 weak bullets (each with original/reason/rewritten), red flags list, and 3 quick wins. With verbose content (long original bullet quotes plus rewrites), 2500 tokens can be tight and the model may produce truncated JSON, causing `json.loads()` to raise a `JSONDecodeError` that propagates as a 500 with the leak issue described above. `analyse_cv` uses 1000 tokens for a simpler schema; `review_cv` warrants at least 3000-4000.

---

### Minor

**5. `pathname.startsWith(href)` active-state matching is too broad — `frontend/components/Sidebar.tsx` line 43**

```ts
const active = pathname.startsWith(href);
```

The root route `/review` will also match any future path like `/review-extended`. More critically, if the landing page `/` ever appears in the nav, `pathname.startsWith("/")` would mark every link as active. For these 4 concrete routes it is currently harmless, but `pathname === href` is the safer and more conventional pattern used throughout Next.js examples.

**6. `ReviewResult` component uses `key={i}` on arrays with stable identity — `frontend/components/ReviewResult.tsx` lines 69, 98, 112**

`weak_bullets`, `red_flags`, and `quick_wins` are rendered with array index as `key`. For `weak_bullets` the bullet's `original` field is a unique quote from the CV and would be a more stable key. Index keys are not incorrect here (lists are static per-result, no reordering), but they are explicitly discouraged in React docs when a better key is available.

**7. `ReviewResult.tsx` does not import `React` for `React.CSSProperties` — `frontend/components/ReviewResult.tsx` line 14**

```ts
const headingStyle: React.CSSProperties = { ... }
```

`React` is referenced as a namespace but not imported. In `react-jsx` transform mode (configured in `tsconfig.json`) JSX does not need an import, but the namespace reference `React.CSSProperties` still requires `import type React from "react"` or `import type { CSSProperties } from "react"`. This is a TypeScript error that will surface at build time.

**8. `_strip_fences` has redundant logic — `backend/ai.py` lines 106-109**

```python
inner = lines[1:] if lines[-1].strip() == "```" else lines[1:]
```

Both branches of the ternary produce `lines[1:]`; the actual fence stripping of the last line is in the `if inner and inner[-1].strip() == "```":` block on line 108. The ternary on line 106 is dead code and misleading. Not a runtime bug (the function works correctly), but a readability issue.

**9. `tailorCV` export is missing the `TailorResult` return type annotation — `frontend/lib/api.ts` line 111**

The function signature is correct and inferred, but the exported `TailorResult` interface is defined but not referenced in the function return type explicitly. Minor inconsistency since `reviewCV` on line 104 uses `: Promise<ReviewResult>` explicitly.

---

### OK

- Backend model definitions (`SectionScore`, `WeakBullet`, `ReviewRequest`, `ReviewResponse`) are clean and match the frontend types exactly.
- `REVIEW_PROMPT` is well-structured; the JSON schema in the prompt matches the Pydantic response model.
- Router registration in `main.py` is correct (`prefix="/review"`).
- `reviewCV()` in `api.ts` correctly routes through the `request<T>` helper.
- Loading and error states are fully implemented in `review/page.tsx`.
- No `console.log` in production code; only `console.error` in catch.
- Landing page uses `next/link` correctly.
- Colors throughout the new components match the updated design system (`#E8FF00`, `#111111`, `#080808`).
- All icons are from `lucide-react`.
- No `any` types introduced.
- Rules of Hooks are respected; all hooks appear before any conditional returns.
- No hardcoded secrets found.
- Existing `analyse`, `applications`, and `dashboard` routes are untouched.
