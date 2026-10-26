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

`performance-index-shadow-v1` is published beside live prices for comparison.
It is not used for market quotes, previews, holdings, or trade execution.

- Last.fm playcount/listener changes use only track identities present in both
  observations.
- YouTube views and engagement changes use only video IDs present in both
  observations. New uploads therefore cannot create a false growth jump simply
  by entering the observed cohort.
- Relative growth uses log ratios over elapsed days and a ±5% daily cap. Each
  source index starts at $10; available source returns are blended with fixed
  initial weights of 55% Last.fm and 45% YouTube, renormalized when a source has
  no matched observations.
- Each shadow quote records source dates, matched entity counts, confidence,
  model version, and a hash of the input observations. Identical inputs are
  stored once; changed inputs create a new immutable record.

These weights and the confidence calculation are provisional. The shadow model
currently measures within-artist growth; it does not yet normalize against a
peer cohort or adapt weights from historical source reliability. Its purpose is
to produce a traceable candidate series and expose data coverage before those
choices are calibrated. Neither external feeds nor user trading volume alone
establish a fair or guaranteed price.

## Next validation steps

Compare shadow and live anchors over historical observation dates, inspect
source gaps and revisions, and stress-test matched-cohort coverage. Calibrate
source weights and the dollar-scale virtual liquidity only after this replay.
Retain the current live model and shadow execution gate until the comparison and
abuse review are complete. Do not add a fixed float or represent the virtual
pool as backed by real assets.
