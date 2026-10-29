# Contributing

Thanks for helping build FreeWealthCare in public.

## Ground rules

1. **No network calls.** Any feature that sends data off the device needs an
   explicit, documented design discussion first. The CSP will block it anyway.
2. **Money is integer cents.** Never store or compute a balance as a float.
3. **Budget rules live in `src/core/`** as pure functions with tests. UI code
   calls them; it does not reimplement them.
4. **Treat every file a user opens as hostile.** Validate, bound, and fail with
   a clear message.
5. **Keep it simple.** If a feature needs a settings page to explain it, it
   probably needs a simpler design.

## Before opening a PR

```bash
npm run check
```

That runs lint, typecheck, tests and the production build, the same as CI.
