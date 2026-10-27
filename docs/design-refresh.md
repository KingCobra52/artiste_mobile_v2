# Artiste design refresh

Artiste is a music discovery and paper-trading web product. Its visual thesis is a record-label listening room paired with a clear market ledger: artist context leads, then audience signals, then a deliberate paper-trade review. The record-sleeve motif represents the artist's symbol, not album artwork or an invented image.

## Review and direction

The previous experience had working navigation and explicit paper-trading copy, but repeated dark gradient panels obscured the hierarchy. The phone header wrapped secondary actions into multiple rows, all screen types used the same card treatment, and dense quote timestamps competed with the primary information. The redesign retains the existing routes, server actions and data contracts.

The Apple Design skill supplies web-app principles, not native iOS conventions. Relevant guidance read:

- `accessibility.md › Vision`: “Convey information with more than color alone.” Quote and fallback states have visible text; chart values remain accessible to keyboard and assistive technology.
- `accessibility.md › Mobility`: “Offer sufficiently sized controls.” Main actions and chart inspection controls have at least 44px targets.
- `layout.md › Visual hierarchy`: “Use progressive disclosure to make layouts cleaner and easier to interact with.” Chart methodology and purchase history can expand; held-asset timestamps and valuation bases stay visible.
- `branding.md › Best practices`: “Express your brand with familiar components.” Standard links, inputs, buttons and disclosure elements retain familiar behavior.
- `onboarding.md › Best practices`: “Keep onboarding content focused on the experience you provide.” Three short screens retain skip, progress, back/next, replay and persistence.
- `charting-data.md › Best practices`: “Make every chart in your app accessible.” The existing keyboard and touch inspection gains explicit previous/next buttons and a readable selected-value summary.
- `feedback.md › Best practices`: “Show people when a command can’t be carried out and help them understand why.” Trade reviews distinguish a disabled execution state, funding problems, changed quotes and interrupted confirmation.

These foundations were checked alongside typography, color, designing for iOS, entering data, cross-platform translation and the code-audit guide. There are no Apple Pay surfaces. Native menu-bar, sheet and tab conventions are not imposed on the web experience.

## Tokens and layout

Contrast below is computed with WCAG relative luminance against the canvas; visible content on raised surfaces is checked separately in browser validation.

| Role | Light | Dark | Contrast light / dark |
| --- | --- | --- | --- |
| Canvas | `#F3F6F5` | `#12292D` | — |
| Content | `#182E32` | `#EDF5F1` | 13.09 / 13.71 |
| Secondary text | `#52666A` | `#A5B9B9` | 5.57 / 7.42 |
| Primary action / chart | `#3F566F` | `#BACCDD` | 6.97 / 9.25 |
| Positive signal | `#21674F` | `#91CBB0` | 6.19 / 8.24 |
| Caution signal | `#795018` | `#E5BD77` | 6.49 / 8.60 |

Raised surfaces are white in light appearance and `#193337` in dark appearance. Error text has a separate semantic danger color. Actions use an inverse label. The system appearance setting chooses the palette; there is no app-specific theme control. Increased contrast strengthens borders. Content backgrounds are opaque; reduced transparency needs no replacement effect.

Display typography uses a bold, compact Avenir/Helvetica/Arial stack, body copy uses the platform system UI font, and numerical details use system monospace. No font download is required. The rem scale runs from 13px utility text to 16–17px body/input text, 24px section titles and fluid 40–76px display text. Layouts grow with text and the viewport. Decorative sleeve markings are hidden from assistive technology.

The Market is a collection of artist sleeves, not a metrics dashboard. Desktop places three artists across when room permits; phone layouts use one column. Artist research uses a reading column and adjacent order panel on wide screens; on phones it remains identity/context → quote → music → chart → trade → methodology.

```text
Compact                         Regular
[brand              help/user] [brand   Market / Portfolio    help/user]
[Market title                 ] [Market title       short introduction]
[short introduction           ] [search                       count   ]
[search                       ] [artist sleeve][artist sleeve][artist ]
[artist sleeve + context      ]
[quote / audience / freshness ] Artist: [research + chart] [trade review]
[Market          Portfolio    ]
```

The signature belongs to music: groove lines and a small center label carry artist symbols. It does not introduce fake portraits, album covers or chart data. The restrained action color and tabular values belong to the market side of the product. A generic hero balance and repeated decorative badge panels were deliberately removed.

Motion is limited to a brief onboarding example transition and control feedback. Reduced motion removes those transitions. Main navigation moves into the header at wider widths; compact navigation respects the bottom safe area. Sign out lives on Account, removing a low-frequency action from the phone header.

## Boundaries and validation

This is a presentation update. Authentication APIs, access-token verification, FastAPI application-data routing, pricing, execution gating, fee calculations, request IDs and portfolio valuation rules remain authoritative and unchanged. The redesigned trade panel preserves an uncertain request ID and provides inline recovery feedback. The view does not infer whether execution is enabled before the trusted preview responds.

Live data availability is distinct from the design. An empty discovery catalog stays empty, missing publications are labeled, and missing/current-cost fallback holdings remain explainable. Populated browser validation uses an isolated local database with dedicated accounts, clearly synthetic observations and execution disabled; fixtures never enter the connected application database.

Hosted migrations, API environment variables, production SMTP and real email-delivery verification, dependable ingestion and a separate decision to activate paper execution remain launch dependencies. This redesign does not establish their completion.

## Dependency audit follow-up

The install-time dependency audit reports four pre-existing affected dependency groups: Next.js (critical), sharp, zod and brace-expansion (high). Next.js remains at the existing 16.3.5 release in this presentation change. A separate tested security update is required before launch. The upstream [Next.js image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw) identifies 16.4.1 as a patched release; additional advisory applicability depends on deployment and feature use. The new SVG icons and sleeve patterns are inline UI elements, not an ImageResponse or image-optimization endpoint. This note does not establish that other existing features are unaffected.

## Checks recorded

- 39 configured Chromium/WebKit journeys passed against a production build and an isolated local Supabase database. Coverage includes phone/tablet/desktop widths, light/dark WCAG checks, 200% text enlargement, keyboard chart/search interaction, interrupted authentication submissions, order-review focus and revising an estimate.
- Axe reported no violations under the selected WCAG A/AA rules in the covered rendered states. This is automated coverage, not a claim of full assistive-technology certification.
- Five missing-configuration browser checks passed.
- 25 unit tests, frontend typecheck, ESLint and the default Next.js Turbopack production build passed. The configured journey suite also exercised a production webpack build.
- The validation database's execution flag stayed false and its execution ledger stayed empty throughout testing. The UI refresh does not enable paper trading.

Visual review covered the existing connected app and populated isolated fixtures. The connected discovery catalog was empty during inspection; eligible published quotes remain a data-readiness requirement. Generated credentials and fixture data stay outside the repository. Existing unrelated changes to the root AGENTS.md, package lock and Supabase configuration are excluded from the design commit.
