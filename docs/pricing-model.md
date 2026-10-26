# Artist price model

## What a share means

Artiste shares are virtual paper-trading positions. They do not represent
ownership, royalties, artist income, or a claim on real assets. Their game value
comes from changes to the platform's artist performance index and from the
bounded price impact of completed paper trades.

## Live model

The live quote uses `audience-inventory-v2`. A $10 baseline is adjusted by
measured Last.fm matched top-track playcount and YouTube channel subscriber
growth. Available sources are normalized to a common baseline and averaged.
The inventory curve is bounded to 20% around the external anchor, and orders
integrate across the curve. The 10-basis-point fee is shown in the trade preview.
This is an experimental paper-market model, not a prediction or a guaranteed
return. Execution remains controlled by `pricing_controls.enabled` and must not
be enabled as part of model development.

## Performance index shadow model

`performance-index-shadow-v2` is published beside live prices for comparison.
It is not used for market quotes, previews, holdings, or trade execution. The
older v1 rows remain identifiable by their model version and are not comparable
to v2 without a separate replay.

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
- Each shadow quote records source dates, matched entity counts, confidence,
  per-source effective return, excluded intervals, model version, and a
  calculation fingerprint covering both observations and result state. Fresh,
  stale, and unavailable results are recorded; identical calculations are
  stored once, including the transition to a stale result when time alone
  changes freshness.

The weights and confidence calculation are provisional. The model measures
within-artist growth; it does not yet normalize against a peer cohort or adapt
weights from historical source reliability. Listener and engagement metrics
are retained for diagnostics but do not currently move the index. Its purpose is
to produce a traceable, conservative candidate series and expose data coverage
before those choices are calibrated. Neither external feeds nor user trading
volume alone establish a fair or guaranteed price.

## Next validation steps

Compare shadow and live anchors over historical observation dates, inspect
source gaps and revisions, and stress-test matched-cohort coverage. Calibrate
source weights and the dollar-scale virtual liquidity only after this replay.
Retain the current live model and shadow execution gate until the comparison and
abuse review are complete. Do not add a fixed float or represent the virtual
pool as backed by real assets.
