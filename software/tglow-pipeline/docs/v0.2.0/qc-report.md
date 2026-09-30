# QC report

At the end of `run_pipeline`, the pipeline builds an HTML report that
summarises the quality of the run, together with a per-well QC table. Use it
to check flatfields, registration, deconvolution, intensities, scaling and
debris before starting downstream analysis.

## Enabling the report

The report is on by default (`qc_run = true`). It needs
`rn_cache_images = true` (also the default), because it reads the intensity
measurements made on the finalized images. The pipeline stops at startup if
`qc_run` is enabled without cached images.

The report is the last step of the run and waits for all other steps to
finish. With [`rn_stop_after_scaling_factors`](scaling.md#stopping-after-scaling-factors),
CellProfiler, rescaling and cell crops are skipped, but the full report is
still produced from the unscaled images. This makes it a cheap way to check
a batch before committing to the full run.

## Output

All files are written to `rr__qc/` in `rn_publish_dir`:

| File | Contents |
|---|---|
| `qc_report.html` | The report. |
| `well_qc.tsv` | One row per well with the checks and verdict, see [Per-well QC table](#per-well-qc-table). |
| `samples/decon/decon_samples.tsv` | Fields selected for the deconvolution comparison (`plate`, `row`, `col`, `well`, `field`, `n_cells`). |
| `samples/decon/before_after/*.png` | Before/after deconvolution images. |
| `samples/debris/debris_samples.tsv` | Fields selected as debris examples, with their `debris_percentage` and `threshold_mean_ratio`. |
| `samples/debris/debris_samples/*.png` | Debris overlay images. |

The report is a single self-contained file: the plotting library and all
images are embedded, so it opens offline and can be shared as-is. Images
are downscaled (longest side at most 1200 pixels) to keep the file size
manageable. The sample PNGs in `samples/` are kept at full resolution for
closer inspection.

The report header shows when it was generated, and the footer shows the
pipeline version.

## Tabs

The report has up to eight tabs. General QC is always shown, and Well QC
whenever the per-well QC table was built (normally always); the others
appear only when the step they describe ran. Each tab has a collapsible
explanation, and a sidebar listing the parameters that were used.

| Tab | Shown when |
|---|---|
| 1. General QC | Always. |
| Well QC | The per-well QC table was built (normally always). Shown directly after General QC. |
| 2. Registration | The measurements contain registration correlation columns, i.e. a registration manifest was used. |
| 3. Flatfields | `ff_run = true`. |
| 4. Deconvolution | `dc_run = true`. |
| 5. Intensities | The per-cell intensity statistics are available (normally always). |
| 6. Scaling factors | `sc_autoscale = true`. Manual scaling does not produce this tab. |
| 7. Debris | The per-image debris metrics are available (normally always). |

### Tab 1: General QC

The overall size of the run: total cells, mean cells per well, and a table
with the number of images, plates, wells, fields per well, blacklisted wells,
images without any cells, and the number of cycles. It also lists the number
of failed and warned wells from the [per-well QC table](#per-well-qc-table);
the Well QC tab shows which wells they are.

Below it is a heatmap of cells per well for each plate. Empty or
blacklisted wells stand out as gaps. The plate layout is inferred from the
data, or set with `qc_plate_format` (`24`, `96`, `384` or `1536`).

### Well QC

The [per-well QC table](#per-well-qc-table) as a sortable table, with the
number of failed, warned, passed and blacklisted wells above it. Failed and
warned wells are listed first, and a filter shows only the wells with a given
verdict. The table in the report is for browsing; filter on `well_qc.tsv` in
downstream analysis.

### Tab 2: Registration

How well the cycles align. For every cell, the pipeline calculates the
correlation between the registration channels of the reference and query cycles
(`reference_channel` and `query_channels` in the registration manifest).
A cell counts as registered when every correlation column is at least
`sc_registration_thresh` (default 0.4). The same filter selects the cells used
for scaling.

The tab shows:

- The number and percentage of registered cells.
- A density plot of each correlation column, with the threshold marked.
- The worst and best aligning fields, as click-through galleries of the
  registration images. Fields are ranked by their percentage of registered
  cells. `qc_n_sample_registration` (default 10) fields are shown per gallery,
  and only fields with at least `qc_min_cells_registration` (default 10)
  cells qualify, so sparse fields don't crowd out real misalignment.

The gallery images are the registration plots, so they need `rg_plot = true` (the default).

Some misaligned cells are expected, for example cells that moved or
detached between cycles. They are filtered out downstream. A low overall
percentage, or whole fields that fail to align, point to a registration
problem. See [Understanding output](understanding-output.md#registration)
for examples.

### Tab 3: Flatfields

For each channel, the fitted flatfield and an evaluation plot. With global
flatfields, identical models are shown once. With multiple cycles, channels
are labelled by cycle and channel. See
[Understanding output](understanding-output.md#flatfield-estimation) for how
to read the plots. The darkfield is not fitted and is always uniform.

### Tab 4: Deconvolution

Before and after deconvolution images for each channel, from the
`qc_n_sample_decon` (default 10) most cell-dense fields, one field per well
and spread across plates. The effect of deconvolution is easiest to judge in
dense fields, and is often too subtle to see in a full-field thumbnail, so the
images are centre-cropped to `qc_decon_crop_pct` (default 25) percent of the
width and height. Set it to `100` to show the full field.

### Tab 5: Intensities

Unscaled per-cell intensities for registered cells. Pick a channel and a
statistic (min, 25th percentile, median, 75th percentile, mean or max; median
by default). The tab shows a heatmap per plate of the well mean, on a colour
scale shared by all plates, and a histogram of the per-cell values. Use it to
spot plate effects, edge effects and wells with unusual staining.

### Tab 6: Scaling factors

Only shown with automatic scaling. It contains:

- A warnings panel listing any warnings raised while estimating the scaling
  factors, including those from consensus scaling. Warnings are also written
  to `scaling_warnings.tsv`.
- A bar plot of the scale factor for every channel and plate.
- The fitted sigmoid for every channel, one curve per plate.

When consensus scaling across batches is used, the consensus values are
shown. See [Scaling](scaling.md) for what these values mean.

### Tab 7: Debris

Debris is bright material outside the cells, such as dye aggregates or
dead-cell fragments. It can inflate a channel's measured background and
signal. For every image and channel, the pipeline takes the pixels outside the
cell masks and calculates:

- A threshold on those pixels (Otsu on log-transformed values by default).
- `threshold_mean_ratio`: the threshold divided by the mean of those pixels.
  In an image with only background, the threshold lands close to the mean and
  the ratio is low. A high ratio means bright objects are present.
- `debris_percentage`: the percentage of those pixels above the threshold.

Images are then classified per channel:

| Class | Rule | Meaning |
|---|---|---|
| no debris | ratio below `sc_debris_min_ratio` | The threshold does not separate anything from the background. |
| debris | ratio at least `sc_debris_min_ratio`, and percentage below `sc_debris_max_pct` | Some debris, within an acceptable amount. |
| unusually high debris | ratio at least `sc_debris_min_ratio`, and percentage at least `sc_debris_max_pct` | A large part of the background is covered by debris. |

The tab shows a summary table per channel, a scatter plot of ratio against
debris percentage with both thresholds marked, and galleries of example
images for each class with the debris outlined in red. The galleries show
`qc_n_sample_debris` (default 10) images per channel and class: the
highest-ratio images for "no debris" and the highest-percentage images for the
other two classes.

The same thresholds decide which images get a debris-removed feature during
scaling, see [Scaling](scaling.md#debris-aware-fitting).

## Per-well QC table

`well_qc.tsv` has one row per well, with the value behind each check, the
checks that tripped at each level and an overall verdict:

| Column | Meaning |
|---|---|
| `plate`, `row`, `col`, `well` | Well identifiers. Wells are listed under the reference plate of their registration group. |
| `n_cells` | Number of segmented cells. Imaged wells without cells have `0`; wells that were never measured are empty. |
| `qc_verdict` | `pass`, `warn`, `fail` or `blacklisted`. |
| `qc_flags_fail` | The failing checks that tripped, separated by `;`, for example `missing_cycle:P2` or `n_cells<50;pct_registered<25`. Empty when no fail check tripped. |
| `qc_flags_warn` | The warning checks that tripped, separated by `;`, for example `pct_low_ch2>25`. Empty when no warn check tripped. |
| `missing_cycles` | The plates of the well's registration group it was not imaged in, separated by `,`. Empty when the well is present in every cycle. |
| `pct_registered` | Percentage of cells that pass `sc_registration_thresh` on every registration column. Empty for single-cycle runs. |
| `pct_low_ch<N>` | Per checked channel: percentage of cells with low signal (see below). |

The checks:

| Check | Consequence | Parameters |
|---|---|---|
| Missing cycle | fail when the well was not imaged in every plate of its registration group. Flagged as `missing_cycle:<plates>`. | `rn_manifest_registration` |
| Not measured | fail when the well was set up to be processed in every cycle but has no measurements, for example because a task failed and its error was ignored. Flagged as `not_measured`. | |
| Too few cells | fail when `n_cells` is below `qc_min_cells_per_well` (default 50) | `qc_min_cells_per_well` |
| Poor registration | fail when `pct_registered` is below `qc_min_pct_registered` (default 25). Skipped when the run has no registration. | `qc_min_pct_registered`, `sc_registration_thresh` |
| Low signal | warn when more than `qc_max_pct_low_signal` (default 25) percent of cells have low signal in any checked channel | `qc_signal_stat`, `qc_min_signal_ratio`, `qc_max_pct_low_signal`, `qc_intensity_skip_channels` |

A cell has low signal in a channel when its `qc_signal_stat` (default
`median`) is below `qc_min_signal_ratio` (default 1.5) times the background of
its own field. The comparison is per field because background varies from
field to field. The low-signal check only warns, never fails, because a dim
channel is often real, for example a marker that is absent in that well.

All channels with a background measurement are checked. Exclude channels
where "above background" is not meaningful, such as brightfield, with
`qc_intensity_skip_channels`, a comma-separated list of final (merged)
channel numbers, for example `--qc_intensity_skip_channels 3,7`.

A well that is missing from one of its cycles can't be registered, so the
pipeline skips it at the start of the run, on every plate of its group, and
logs a warning. The missing-cycle check makes these wells visible in the table
rather than letting them disappear.

The verdict is the worst outcome of all checks, in the order
`blacklisted` > `fail` > `warn` > `pass`. Wells from the blacklist are added
with the verdict `blacklisted`, no measurements and no flags, because they were
excluded before anything was measured.

The table is meant as a starting point for filtering wells in downstream
analysis. The pipeline itself does not drop wells based on it.

## Parameters

| Parameter | Default | Purpose |
|---|---|---|
| `qc_run` | `true` | Build the QC report. |
| `qc_label` | `normal` | Resource label for the QC processes. |
| `qc_plate_format` | `auto` | Plate layout for heatmaps: `auto`, `24`, `96`, `384` or `1536`. |
| `qc_n_sample_registration` | `10` | Fields per registration gallery (worst and best, so twice this number in total). |
| `qc_min_cells_registration` | `10` | Minimum cells for a field to be a registration example. |
| `qc_n_sample_decon` | `10` | Number of fields for the deconvolution comparison. |
| `qc_decon_crop_pct` | `25` | Centre crop of the deconvolution images, in percent of width and height. |
| `qc_n_sample_debris` | `10` | Debris example images per channel and class. |
| `qc_min_cells_per_well` | `50` | Fail wells with fewer cells. |
| `qc_min_pct_registered` | `25` | Fail wells with a lower percentage of registered cells. |
| `qc_min_signal_ratio` | `1.5` | Low-signal cutoff, as a multiple of the field background. |
| `qc_max_pct_low_signal` | `25` | Warn when a higher percentage of cells has low signal. |
| `qc_signal_stat` | `median` | Per-cell statistic used for the low-signal check. |
| `qc_intensity_skip_channels` | | Final channels excluded from the low-signal check. |

The report also uses `sc_registration_thresh`, `sc_registration_pattern`,
`sc_debris_max_pct` and `sc_debris_min_ratio`, which are described under
[Scaling](scaling.md#parameters).
