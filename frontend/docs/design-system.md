# Artiste visual system

Midnight backgrounds and quiet charcoal surfaces support a music market with clear financial information. Chartreuse identifies primary actions and selected navigation. Green and rose communicate signed changes; status text always accompanies availability colors.

Tokens live in app/globals.css: background #090d12, surface #12191f, foreground #eef2ed, accent #c4ef73. Metadata uses #93a1af or lighter. Typography uses the local Inter/Avenir Next/Segoe UI stack, with tabular numerals for financial displays. Use 20–24px panel corners, 20–28px panel padding, and 44px minimum interactive heights.

Reusable patterns: market-rows/market-row for discovery lists, artist-monogram for identity, page-intro for screen headings, money-display for principal values, and portfolio-hero for account summary. Keep explanations after the primary task. Artist detail uses one column on mobile and quote/trade columns on wide screens.

Review findings addressed:
1. Market: repetitive heavy cards and bright avatars competed with prices. Compact divided rows and subdued initials improve scanning.
2. Artist: explanation delayed access to trading. Quote and trade are now adjacent in reading order and side by side on desktop.
3. Portfolio: duplicate main headings and passive empty state. One main value heading and a direct Market action clarify the next step.

Limits: no artist photography is available; initials remain the identity fallback. Populated holdings and long trade histories need further visual review. Screenshot review alone does not establish accessibility compliance. Authentication, API and trade logic were not changed by this visual pass.

## Cluely-inspired refinement

The current cluely.com homepage was inspected on October 23, 2026. Its blue-to-cream atmospheric background, serif display typography, luminous button edges, and dark translucent product panels informed this refinement. Artiste adapts those qualities to a dark music and paper-trading application without copying the landing-page composition or imagery.

Current tokens supersede the earlier palette: background #080c17, surface #141c2c, foreground #f5f3ee, muted #a5b1c8, accent #b9d9ff. Serif screen and artist titles use locally available Iowan/Palatino/Georgia; monetary values and controls retain the sans-serif stack. Shared action-primary, app-header, app-navigation, nav-active, artist-hero, portfolio-hero, and trade-panel classes unify the screens. Green/red remain reserved for financial changes; charts retain their existing signal colors. Focus outlines, reduced-motion support, mobile wrapping, and a 1024px two-column artist breakpoint are retained.
