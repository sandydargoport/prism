# Lessons Learned — Debugging Reference

Reference this file whenever hitting a bug that takes more than 2-3 iterations to resolve.

---

## Lesson 1: Verify the deployed code before testing

**Problem:** Docker caches build layers. If a build fails silently (e.g., syntax error), Docker serves the last successful image. You can iterate for hours testing the same stale code.

**Rule:** After every Docker rebuild, verify the new code is actually deployed:
```bash
# Pick a unique string from your change and confirm it's in the container
docker exec prism-app sh -c "grep -r 'UNIQUE_STRING' /app/.next/ 2>/dev/null | head -1"
```

If nothing is found, the build cached a stale layer. Use:
```bash
docker-compose build --no-cache app
```

---

## Lesson 2: Always use `--no-cache` when debugging build/deploy issues

**Problem:** `docker-compose up -d --build` reuses cached layers. Code changes in `COPY . .` may not trigger a rebuild if earlier layers are cached.

**Rule:** During active debugging, always use:
```bash
docker-compose build --no-cache app && docker-compose up -d
```

---

## Lesson 3: Check the data before changing the code

**Problem:** We spent 2 days rewriting components (SSR fixes, dynamic imports, error boundaries) when the bug was bad data in the database — seed data used `{type, position: {x,y,w,h}}` but code expected `{i, x, y, w, h}`.

**Rule:** When a component renders then goes blank or crashes:
1. Check the database: `docker exec prism-db psql -U prism -d prism -c "SELECT * FROM <table>;"`
2. Check API responses: `curl http://localhost:3000/api/<endpoint> | jq .`
3. Add a visible debug element showing the data shape/count before changing any component code

---

## Lesson 4: Add observable state to the DOM immediately

**Problem:** Without browser console access, we had no visibility into what was happening client-side. Adding a magenta debug bar showing state values (`widgets=5`) instantly revealed the problem.

**Rule:** On the first failed test, add a fixed-position debug element:
```tsx
<div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 99999, background: 'magenta', color: 'white', padding: '8px 16px', fontSize: 14 }}>
  key={String(value)} otherKey={String(otherValue)}
</div>
```

This survives even when the rest of the UI crashes or goes blank.

---

## Lesson 5: Ask for browser console output or screenshots early

**Problem:** We were debugging blind — couldn't see client-side errors. A single console screenshot showing `Cannot read property 'x' of undefined` would have pointed to the data mismatch immediately.

**Rule:** On the first unexplained blank page or crash, ask:
- "Can you open browser dev tools (F12), go to the Console tab, and tell me what errors appear?"
- "Can you take a screenshot of the error?"

Don't proceed with code changes until you have error details.

---

## Lesson 6: Don't assume the error category from the first symptom

**Problem:** The initial React error #418 (hydration mismatch) sent us down an SSR rabbit hole. The real cause was runtime data corruption — completely unrelated to SSR.

**Rule:** Treat the first error message as a clue, not a diagnosis. Verify the hypothesis with a minimal test before investing in a fix. Ask: "What else could cause this symptom?"

---

## Lesson 7: Binary search, not shotgun debugging

**Problem:** We changed multiple things at once (dynamic imports + isMounted guards + transpilePackages + clock removal), making it impossible to know what worked.

**Rule:** Change one thing at a time. If you need to test whether component X is the problem:
1. Replace X with a static placeholder
2. Test
3. If fixed, the problem is in X — drill deeper into X
4. If still broken, restore X and try Y

---

## Lesson 8: Verify build succeeds locally before Docker

**Problem:** Syntax errors from bad edits (mismatched JSX braces from `{false && ...}`) caused silent build failures in Docker.

**Rule:** Always run `npx next build` locally and check for errors before triggering a Docker build:
```bash
npx next build 2>&1 | grep -E "Error|Failed"
```

---

## Quick Debugging Checklist

When something breaks after a deploy:

- [ ] Run `npx next build` locally — does it compile?
- [ ] Rebuild Docker with `--no-cache`
- [ ] Verify deployed code: `docker exec prism-app sh -c "grep -r 'something unique' /app/.next/"`
- [ ] Check server logs: `docker logs prism-app --tail 30`
- [ ] Check database state: `docker exec prism-db psql -U prism -d prism -c "SELECT ..."`
- [ ] Check API response: `curl localhost:3000/api/... | jq .`
- [ ] Add DOM debug element showing component state
- [ ] Ask user for browser console output (F12 → Console)
- [ ] Change ONE thing at a time and test
