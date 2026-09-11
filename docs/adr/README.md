# Architecture Decision Records

Short records for decisions that look like mistakes out of context and would
otherwise get "fixed" by a future reader who hasn't seen the reasoning. Each
one exists because `FRONTEND_AUDIT.md` flagged the pattern and investigation
turned up a real reason for it — see that document's section 5 ("выглядит
как антипаттерн, но трогать без разбора нельзя") for the full list this is
drawn from.

Format: Status / Context / Decision / Consequences. Keep new ones short —
this is a pointer to *why*, not a design doc.

| ADR | Decision |
|---|---|
| [0001](0001-client-side-pin-hash.md) | Client hashes the atrace post PIN with MD5 before sending it |
| [0002](0002-emerald-brand-gradient-overrides.md) | `global.css` overrides every `emerald-*` Tailwind utility with `!important` |
| [0003](0003-single-layout-with-regex-routing.md) | One `layouts/default.vue` for marketing + workspace + console, chosen by path regex |
| [0004](0004-handwritten-i18n.md) | Hand-rolled `useI18n()` instead of `@nuxtjs/i18n` |
| [0005](0005-inline-ssr-styles-disabled.md) | `experimental.inlineSSRStyles: false` |
