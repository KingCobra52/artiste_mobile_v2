# Artist price model

## What a share means

Artiste shares are virtual paper-trading positions. They do not represent
ownership, royalties, artist income, or a claim on real assets. Their game value
comes from changes to the platform's artist performance index and from the
bounded price impact of completed paper trades.

## Live quote model

Quotes use `performance-index-v2` when the performance index is fresh and its
confidence is at least 0.30. The first update rebases to the artist's current
anchor, preserving the displayed quote and existing positions. Later changes
move the anchor in proportion to the index. Artists without a sufficiently
confident performance result continue on `audience-inventory-v2`. Once an artist
uses the performance index, a source outage does not switch that artist back to
the old model; the last quote ages and eventually becomes stale.

The bounded inventory curve remains unchanged: it adjusts the performance
anchor by up to 20%, and order costs integrate across the curve. The 10-basis-
point fee remains visible in trade previews. All positions are virtual and
carry no claim on artist income or assets. Paper execution remains controlled
separately by `pricing_controls.enabled`.

## Performance index

`performance-index-shadow-v2` continues to be stored as an auditable evaluation
series. Its fresh, sufficiently confident result now feeds the live
`performance-index-v2` anchor; the two version labels distinguish the
diagnostic calculation from its use in published quotes. The older v1 rows
remain identifiable by their model version and are not directly comparable.

- Last.fm playcount growth and YouTube view growth use only identities present
  in consecutive daily observations. Listener and engagement changes remain
  diagnostics because they overlap with plays/views and need separate
  calibration.
- A missed daily observation resets that source's baseline. The model does not
  spread a multi-day count change across an unobserved gap. Per-day growth is
  capped at ±5%; capped intervals receive half confidence.
- Interval influence is damped by matched-entity coverage (up to five entities).
  Source weights stay fixed at 55% Last.fm and 45% YouTube; an unavailable
  source contributes a neutral return and does not increase the other's weight.
  A source is stale after its latest matched update ages past 48 hours. If any
  previously measured source is stale, v2 withholds the combined index. A
  source with no matched interval does not block a usable one-source result.
- A quote transition requires confidence of at least 0.30. Lower-confidence
  results remain in the diagnostic table and do not change the live quote.
- Each shadow quote records source dates, matched entity counts, confidence,
  per-source effective return, excluded intervals, model version, and a
  calculation fingerprint covering both observations and result state. Fresh,
  stale, and unavailable results are recorded; identical calculations are
  stored once, including the transition to a stale result when time alone
  changes freshness.

The weights and confidence calculation are provisional. The model measures
within-artist growth; it does not yet normalize against a peer cohort or adapt
weights from historical source reliability. Listener and engagement metrics
are retained for diagnostics but do not currently move the index. Neither
external feeds nor user trading volume alone establish a fair or guaranteed
price.

## Validation and execution gate

Continue comparing both series over historical observations, inspect source
gaps and revisions, and stress-test matched-cohort coverage. The first quote
transition preserves the existing displayed price; later movements are driven
by the performance index while the virtual inventory curve captures platform
demand. Never represent the virtual pool as backed by real assets. Enabling or
disabling trade execution is an independent operational control and does not
change which quote model is published.
