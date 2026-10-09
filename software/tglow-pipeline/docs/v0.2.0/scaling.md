# Scaling

Scaling puts each channel's intensities on a common scale before features are
extracted. It serves two purposes:

1. **Use the 16-bit range well.** Processed images are stored as 16-bit
   integers (0 to 65535). A channel can end up using only a small part of the range 
   if the stain intensity is low (&lt;3000 for instance).
   Scaling stretches or compresses each channel so its signal fills the range most optimally for the data.
2. **Remove plate effects.** Staining and imaging vary between plates. Using
   control wells that should look the same on every plate, scaling estimates a
   per-plate offset and corrects for it, so intensities can be compared across
   plates and batches.

A soft threshold (a sigmoid) leaves background pixels unscaled and applies
the full factor only to foreground pixels, so background noise isn't
amplified.

Scaling is applied to the finalized images before CellProfiler and cell
crops, so all downstream features use the scaled images.

## Choosing a mode

| Mode | What it corrects | Parameters | Channel map |
|---|---|---|---|
| No scaling (default) | Nothing. Images keep their intensities after finalize. | `sc_autoscale = false`, `sc_manualscale = null` | not used for scaling |
| Dynamic range only | Fills the 16-bit range per channel; no correction between plates. | `sc_autoscale = true` | optional. Without one, every channel uses `sc_autoscale_q1` (default `max`). |
| Plate offsets only | Equalises the control wells between plates, without changing the overall range. | `sc_autoscale = true`, `sc_channel_map = </path/to/channel_map.tsv>`, `sc_control_list = </path/to/control_list.tsv>` | leave `dynamic_range_feature` blank, set `plate_offset_feature` |
| Full (dynamic range and plate offsets) | Both. Recommended. | `sc_autoscale = true`, `sc_channel_map = </path/to/channel_map.tsv>`, `sc_control_list = </path/to/control_list.tsv>` | set both `dynamic_range_feature` and `plate_offset_feature` |
| Manual | Whatever factors you supply. | `sc_manualscale = </path/to/scaling_factors.txt>`, optionally `sc_scale_slope = </path/to/slope.txt>` and `sc_scale_bias = </path/to/bias.txt>` | not used for scaling |

Notes:

- **Sigmoid.** In the automatic modes, the sigmoid soft threshold is fitted on
  the control wells, so it needs a control list and the `sigmoid_*_feature`
  columns in the channel map. Without a control list (dynamic range only),
  factors are applied uniformly to all pixels. You can switch the sigmoid off
  with `sc_skip_sigmoid = true`, or per channel, in any mode.
- **Per channel.** The mode can differ per channel: leave a feature blank, or
  use the `skip_scaling`, `skip_plate_offsets` and `skip_sigmoid` columns of the
  channel map (see [Per-channel opt-outs](#per-channel-opt-outs)). Channels
  without a row in the channel map are not scaled.
- **Plate offsets only.** With a blank `dynamic_range_feature`, a channel's
  dynamic range counts as 1. Its factor is then the plate offset itself: the
  dimmest plate is left unchanged and brighter plates are divided down to
  match it.
- `sc_autoscale` takes precedence over `sc_manualscale` if both are set (with
  a warning). `sc_control_list` without `sc_autoscale = true` is an error.
- Automatic scaling needs `rn_cache_images = true`.

## How automatic scaling works

After finalize, the pipeline measures every cell and every image in the
unscaled images. From these measurements it calculates a scaling factor
(and a sigmoid) for each plate and channel, and then rescales the images:

1. **update_channel_map** translates your [channel map](manifests-and-configuration.md#channel-map)
   into final channel numbers and feature column names.
2. **measure_intensity** measures per-cell and per-image intensity
   statistics, the registration correlation of each cell, and the debris
   metrics of each image.
3. **calculate_scaling_factors** combines the measurements of all plates
   and calculates the dynamic range, plate offsets and sigmoids described
   below.
4. **consensus_scaling_factors** (optional) recalculates the factors
   together with earlier batches, see [Scaling across batches](#scaling-across-batches).
5. **rescale** applies the factors to the images of every well.

Step 3 needs the measurements of every well, so rescaling, CellProfiler and
cell crops start only after all wells have been finalized and measured.

### Which cells are used

For multi-cycle runs, cells that did not register well would mix signal from
different cells. Before calculating dynamic ranges and plate offsets, the
pipeline drops cells whose registration correlation is below
`sc_registration_thresh` (default 0.4) on any registration column (the
columns whose name contains `sc_registration_pattern`, by default
`registration_corr`). Cells without a correlation value are dropped as well.
The same filter is used in the [QC report](qc-report.md#tab-3-registration).

### Dynamic range

For each plate and channel, the pipeline takes the `sc_autoscale_q2` quantile
(default 0.95) of the channel's `dynamic_range_feature` (for example the
per-cell `max`) over all cells, and divides it by `sc_uint_max` (default 65535).
This ratio, `max_scale_plate`, is how many times too bright (above 1) or too
dim (below 1) the channel is for the 16-bit range.

Using a quantile rather than the maximum keeps a few very bright cells from
compressing everything else. Cells above the quantile may clip.

### Plate offsets

With a [control list](manifests-and-configuration.md#control-list), the
pipeline compares the control wells between plates. For each plate it
calculates the mean of the channel's `plate_offset_feature` (for example the
per-cell `mean`) over the control cells selected by `control_population`.
The plate offset is that mean divided by the lowest mean of all plates, so the
dimmest plate has an offset of 1 and brighter plates have offsets above 1.

How the plate mean is calculated depends on `sc_offset_mode`:

- **`well`** (default): the mean of each control well is calculated
  first, then the mean of those well means. The well is the experimental
  unit, so each well counts equally no matter how many cells it has. Wells with
  fewer than `sc_offset_min_cells_per_well` (default 10) cells are dropped
  (with a warning), because they would otherwise count as much as dense
  wells.
- **`cell`**: all control cells of a plate are pooled into one mean. Dense
  wells dominate. This was the behaviour before v0.2.0; use it to reproduce
  old scaling factors.

Without a control list, or for channels without a `plate_offset_feature`,
all plate offsets are 1 and only the dynamic range is scaled.

### The scaling factor

The factor combines the dynamic range and the plate offsets. For each channel:

```text
max_scale_plate_norm = max_scale_plate / plate_offset      (per plate)
base_scale           = max(max_scale_plate_norm)           (over all plates)
scale_factor         = base_scale × plate_offset           (per plate)
```

`max_scale_plate_norm` is the dynamic range a plate would have if its plate
offset were removed, i.e. expressed at the brightness of the dimmest plate.
`base_scale` is the largest of these over all plates: the scale needed so that
the plate that is brightest after offset correction still fits in the 16-bit
range. Every plate is then divided by the same `base_scale`, times its own
offset.

Dividing a plate's pixels by its factor therefore does two things: it
removes the plate offset (all plates' controls end up at the same level), and
it applies one common scale, so that the most demanding plate reaches
`sc_uint_max` at its `sc_autoscale_q2` quantile and no plate clips there.

For example, with `sc_uint_max = 65535` and two plates:

| | Plate A | Plate B |
|---|---|---|
| 95th percentile of `max` | 32768 | 98304 |
| `max_scale_plate` | 0.5 | 1.5 |
| `plate_offset` | 1.0 | 1.2 |
| `max_scale_plate_norm` | 0.5 | 1.25 |
| `base_scale` | 1.25 | 1.25 |
| `scale_factor` | 1.25 | 1.5 |
| 95th percentile after scaling | 26214 | 65535 |

Plate B sets `base_scale`. Its controls were 1.2 times brighter than plate
A's, and after dividing by 1.5 and 1.25 respectively they are at the same
level (1.2 / 1.5 = 1 / 1.25). Plate A doesn't fill the range, because its
cells are genuinely dimmer once the plate offset is accounted for.

`base_scale` and every intermediate value are in `scaling_index.tsv` (see
[Output](#output)). When scaling across batches, `base_scale` is recalculated
over the plates of all batches, see [Scaling across batches](#scaling-across-batches).

### Sigmoid soft threshold

Dividing every pixel by the same factor would also scale the background.
Instead, the factor is weighted by a sigmoid of the pixel's own intensity:
pixels well below the sigmoid are left unchanged, pixels well above it get the
full factor, and there is a smooth transition in between.

The sigmoid is fitted per plate and channel on the images of the control
wells, in raw intensity units:

- The lower point is the `sigmoid_lower_quantile` quantile of
  `sigmoid_lower_feature` over the control images. For example, `0.95` of
  `background_q75`, the upper quartile of the pixels outside cells, gives
  "the top of the background" in nearly every control image.
- The upper point is the `sigmoid_upper_quantile` quantile of
  `sigmoid_upper_feature`. For example, `0.5` (the median) of `otsu_log`, an
  Otsu threshold on log-transformed pixels, gives "where signal starts". On
  skewed fluorescence intensities, `otsu_log` is more robust than plain
  `otsu`.

A higher lower quantile protects more of the background from scaling; a
lower upper quantile applies the full factor from a lower intensity. Before
v0.2.0 the quantiles were fixed at `0.95` and `0.5`.

The sigmoid is set so its weight is almost 0 (0.001) at the lower point and
almost 1 (0.999) at the upper point. The resulting slope and bias are
written to `sigmoid_slope.txt` and `sigmoid_bias.txt`.

In the rescaled image, each pixel becomes:

```text
w     = 1 / (1 + exp(-slope × (pixel - bias)))
pixel = pixel / (w × (scale_factor - 1) + 1)
```

The result is rounded and clipped to 0 to 65535.

If the upper point is not above the lower point, the background sits at or
above the signal and the sigmoid would be inverted. Such a fit is rejected
with a `sigmoid_inverted` warning. A plate whose sigmoid was rejected, or
that has no fit at all (for example because it has no control wells, a
`sigmoid_filled_from_mean` warning), gets the average slope and bias of the
channel's other plates. If no plate of a channel has a usable fit, the
channel is scaled without a sigmoid. Set `sc_skip_sigmoid = true` to apply
the factors uniformly to all pixels.

#### Borrowing a sigmoid

The inclusive/exclusive channels created by `mask_channels` have a
background of zero, because masking removes everything outside the mask, so
there is nothing to fit a sigmoid on. For such channels, leave the sigmoid
features blank and set `sigmoid_from_channel` to the `name` of the channel
they came from. The channel then reuses that channel's sigmoid, per plate,
but is still scaled by its own dynamic range. A channel can't borrow from a
channel that itself borrows.

### Debris-aware fitting

Debris (bright material outside cells) raises background statistics such as
`background_q75`, which would move the sigmoid up. The intensity measurement
therefore also calculates each background statistic with debris pixels
removed, as a separate feature with a `_dbrm` suffix.

When fitting the sigmoid, the pipeline uses the `_dbrm` version of a feature
for an image when that image's debris detection is reliable:
`threshold_mean_ratio` is at least `sc_debris_min_ratio` (default 2) and
`debris_percentage` is at most `sc_debris_max_pct` (default 10). Otherwise
the plain feature is used. Set `sc_skip_debris_removal = true` to always
use the plain features. How debris is detected is set by `sc_debris_method`
(default `Otsu_log`) and `sc_cellmask_expansion` (default 0). The debris metrics are explained in the
[QC report](qc-report.md#tab-8-debris).

### Per-channel opt-outs

In the channel map:

- A blank `dynamic_range_feature`, `plate_offset_feature` or
  `sigmoid_lower_feature` skips that part of scaling for the channel.
- `skip_scaling`, `skip_plate_offsets` and `skip_sigmoid` columns (`true`/`false`)
  switch off the whole factor, the plate offsets or the sigmoid.
- Channels without a row are not scaled.

Without a channel map, the pipeline builds one that uses `ch<N>__<sc_autoscale_q1>`
(default `max`) as the dynamic range feature for every channel, with no plate
offsets and no sigmoid.

## Output

Automatic scaling writes to `rr__scaling/` in `rn_publish_dir`:

| File | Contents |
|---|---|
| `scaling_factors.txt` | The factors, one line of `<plate>_ch<channel>=<factor>` entries. |
| `sigmoid_slope.txt`, `sigmoid_bias.txt` | The fitted sigmoids, in the same format. |
| `scaling_index.tsv` | One row per plate and channel with every intermediate value, see below. |
| `sigmoid_inputs.tsv` | For every channel that fits a sigmoid, the `sigmoid_lower_feature` and `sigmoid_upper_feature` values of each control image (`plate`, `channel`, `well`, `field`, `lower`, `upper`), which the sigmoid's lower and upper points are quantiles of. |
| `scaling_warnings.tsv` | Warnings raised while calculating the factors (`source`, `category`, `channel`, `message`). Also shown in the QC report. |
| `config/` | Your original channel map, the resolved `updated_channel_map.tsv`, and the mask settings used for intensity measurement. |
| `consensus/` | With `sc_reference_scaling_index`: the consensus versions of the files above plus `consensus_diagnostics.tsv`. These replace the files in `rr__scaling/`. |

The main columns of `scaling_index.tsv`:

| Column | Meaning |
|---|---|
| `scaling_key`, `ref_plate`, `channel`, `name` | Which plate and channel the row is for. |
| the channel map columns | The features used. |
| `max_scale_plate` | The plate's dynamic range, relative to `sc_uint_max`. |
| `plate_feature_mean`, `plate_ncells`, `plate_nwells` | The control mean behind the plate offset, and the number of cells and wells it's based on. |
| `plate_offset`, `offset_mode` | The plate offset and how it was calculated. |
| `base_scale`, `scale_factor` | The channel's common scale and the plate's final factor. |
| `sigmoid_x1`, `sigmoid_x2`, `sigmoid_slope`, `sigmoid_bias` | The sigmoid's lower and upper point and its parameters. |

The measurements used for scaling are in `rr__features/measurements/unscaled/`
and the rescaled images in `rr__processed_images/scaled/`. See
[Understanding output](understanding-output.md).

## Checking the result

The [QC report](qc-report.md#tab-7-scaling-factors) shows the factors, sigmoids and
warnings. Things to look for:

- **Warnings**, for example control wells dropped for having too few
  cells, or plates with an inverted or missing sigmoid.
- **Factors that differ a lot between plates** of the same channel. These come
  from large plate offsets. Check that the control wells of those plates
  really are comparable.
- **Sigmoids** that start too high (background above the transition, so the
  background is scaled) or too low. The sigmoid plots show the background and
  signal distributions of the control images behind each curve; also compare
  with the intensity distributions in Tab 6.

## Scaling across batches

Batches that are processed in separate runs get their own scaling factors, so
their intensities aren't directly comparable. Consensus scaling fixes this.
Give the pipeline the `scaling_index.tsv` of one or more earlier batches with
`sc_reference_scaling_index` (a comma-separated list of paths):

```nextflow
params {
  sc_autoscale               = true
  sc_reference_scaling_index = '/projects/batch1/results/rr__scaling/scaling_index.tsv,/projects/batch2/results/rr__scaling/scaling_index.tsv'
}
```

The pipeline pools the plates of the reference batches with this batch's own
plates and recalculates the factors as if all plates had been processed in a
single run. It then writes the factors for this batch's plates to
`rr__scaling/consensus/`, and these are used for rescaling. It does not
average the per-batch factors, because each batch's `base_scale` is anchored
to its own dimmest plate, which makes averages meaningless.
`consensus_diagnostics.tsv` lists the per-plate values behind the pooled
scale, including which plate sets it.

The batches must use the same features and settings. The pipeline stops if
the indices disagree on `dynamic_range_feature`, `plate_offset_feature`,
`skip_plate_offsets` or `offset_mode`, and warns if channel names differ or
channels are missing from some batches. The sigmoids are not recalculated;
each batch keeps its own.

### Stopping after scaling factors

Set `rn_stop_after_scaling_factors = true` to end the run as soon as the
scaling factors exist. Rescaling, cell crops and CellProfiler are skipped,
but the full QC report is still made from the unscaled images. This requires
`sc_autoscale = true`.

Together with consensus scaling, this allows a two-step workflow for projects
with several batches:

1. Run every batch with `rn_stop_after_scaling_factors = true`. This is
   relatively cheap, and gives you each batch's `scaling_index.tsv` and QC
   report.
2. Re-run each batch without the stop, with `sc_reference_scaling_index`
   pointing at the indices of all other batches. The expensive earlier steps
   are cached (see [Re-running and caching](running.md#re-running-and-caching)),
   so only scaling and the downstream steps run again.

Batches added later can be scaled against the same indices.

## Manual scaling

Provide the factors in a text file with one line of space-separated entries:

```text
P1_ch0=1.8 P1_ch1=0.9 P1_ch4=2.1
```

- `<plate>` is the reference plate.
- `<channel>` is the final channel number, after merging cycles (0-indexed).
- Each channel's pixels are divided by the factor.
- Channels that aren't listed are not scaled. Every plate being scaled needs at least one entry.

To use a sigmoid, provide `sc_scale_slope` and `sc_scale_bias` files in the
same format; you must provide both. With automatic scaling, these files replace
the fitted sigmoids.

With manual scaling, you can set `sc_scale_in_finalize = true` to apply the
factors while finalizing rather than in a separate rescale step. This saves
writing the images twice. It can't be combined with automatic scaling.

To keep storage down, set `sc_publish_unscaled = false` so the unscaled
images are not copied to `rr__processed_images/unscaled/`.

## Parameters

| Parameter | Default | Purpose |
|---|---|---|
| `sc_autoscale` | `false` | Estimate scaling factors from this run. |
| `sc_channel_map` | | Per-channel scaling settings, see [channel map](manifests-and-configuration.md#channel-map). |
| `sc_control_list` | | Control wells for plate offsets. Requires `sc_autoscale` and `sc_channel_map`. |
| `sc_autoscale_q1` | `max` | Dynamic-range statistic when no channel map is given. |
| `sc_autoscale_q2` | `0.95` | Quantile of the dynamic-range feature over cells. |
| `sc_uint_max` | `65535` | Target maximum of the output range. |
| `sc_offset_mode` | `well` | `well` or `cell`: how the control mean of a plate is calculated. |
| `sc_offset_min_cells_per_well` | `10` | Drop control wells with fewer cells (`well` mode only). |
| `sc_registration_thresh` | `0.4` | Minimum registration correlation for a cell to be used. |
| `sc_registration_pattern` | `registration_corr` | Identifies the registration correlation columns. |
| `sc_skip_sigmoid` | `false` | Apply factors uniformly, without a sigmoid. |
| `sc_skip_debris_removal` | `false` | Never use the debris-removed (`_dbrm`) features. |
| `sc_debris_min_ratio` | `2` | Minimum `threshold_mean_ratio` to use the `_dbrm` features. |
| `sc_debris_max_pct` | `10.0` | Maximum `debris_percentage` to use the `_dbrm` features. |
| `sc_debris_method` | `Otsu_log` | Threshold used to call debris: `MCE`, `Otsu`, `Otsu_log` or a percentile such as `Q99`. |
| `sc_cellmask_expansion` | `0` | Pixels to expand the cell mask by before calling debris. |
| `sc_reference_scaling_index` | | Earlier batches' `scaling_index.tsv` files for consensus scaling. |
| `rn_stop_after_scaling_factors` | `false` | Stop after the scaling factors are calculated. |
| `sc_manualscale` | | Manual scaling factors file. |
| `sc_scale_slope`, `sc_scale_bias` | | Manual sigmoid files. |
| `sc_scale_in_finalize` | `false` | Apply manual scaling during finalize. |
| `sc_publish_unscaled` | `true` | Publish the unscaled processed images. |
| `sc_label` | `normal` | Resource label for the scaling processes. |
