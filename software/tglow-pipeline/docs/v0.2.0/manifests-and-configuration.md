# Manifests and configuration

## Overview

A pipeline run is configured by a small set of files:

| File | Parameter | Required | Purpose |
|---|---|---|---|
| Main manifest | `rn_manifest` | Yes | One row per plate: which channels to use for flatfields, segmentation, deconvolution and masking. |
| Registration manifest | `rn_manifest_registration` | For multi-cycle runs | Which plates are later cycles of which reference plate, and which channels to align on. |
| Blacklist | `rn_blacklist` | No | Wells to exclude from the run. |
| Channel map | `sc_channel_map` | No | Per-channel scaling settings, and whether intensities are measured in the cell or nucleus mask. |
| Control list | `sc_control_list` | No | Control wells used to estimate plate offsets during scaling. |
| Run config | `-c my_run.config` | Recommended | The `params {}` for this run. |
| `nextflow.config` | (in the pipeline repository) | | Pipeline-wide defaults, profiles and process labels. |

All manifests are tab-separated files with a header row, except the blacklist,
which has no header.

> **Channel numbers are 0-indexed everywhere**: in every manifest, the channel
> map, parameters such as `ff_channels`, and the `ch<N>__` feature columns in
> the output. The first channel of a plate is channel `0`.

At startup the pipeline validates these files: it checks that the required
columns exist, that channel numbers and plate names are consistent between
files, and that paths exist. Errors stop the run before any jobs are submitted.
You can skip the checks with `--rn_skip_checks true`, but this is only meant for testing.

In the main and registration manifests, write `none` for a value that is not
set. Blank cells, `na` and `null` are rejected there. The channel map also
accepts blank cells, `na`, `n/a` and `null`.

Wells are always written with two-digit columns, for example `A01`.

The examples below are a two-cycle run and are also available in the pipeline
repository under [`docs/examples`](https://github.com/TrynkaLab/tglow-pipeline/tree/gamma/docs/examples):

- Cycle 1 (`P1`, the reference plate) has three channels: `DAPI` (0), `GFP` (1) and `RFP` (2).
- Cycle 2 (`P2`) has three channels: `DAPI2` (0), `GFP2` (1) and `RFP2` (2).
- `P1`'s `DAPI` channel is masked, so it is split into a nuclear (inclusive) and cytoplasmic (exclusive) signal.

## Main manifest

One row per plate, including every cycle of a multi-cycle experiment. The
file must have exactly these columns (in any order):

| Column | Format | Purpose |
|---|---|---|
| `plate` | text | Plate name used throughout the pipeline. During staging, plates are renamed to this name. |
| `index_xml` | path | Path to the Revity/PerkinElmer `Index.xml` (or `Index.idx.xml`) of the plate. Used by staging and by `ff_mode = "PE"`. |
| `ff_channels` | comma-separated channels, or `none` | Channels to estimate flatfields for. `none` skips flatfield estimation for the plate. |
| `cp_nucl_channel` | channel or `none` | Nucleus channel for Cellpose. `none` runs Cellpose without a nucleus channel. |
| `cp_cell_channel` | channel or `none` | Whole-cell channel for Cellpose. `none` skips segmentation for the plate, which excludes it from all mask-dependent steps (finalize, measurement, scaling, CellProfiler, cellcrops, QC). For registration query plates this is expected, since they are processed through their reference plate. |
| `dc_psfs` | `<channel>=<path>` pairs, comma-separated, or `none` | Point spread function per channel to deconvolve, for example `0=psfs/psf_375.tif,3=psfs/psf_640.tif`. Only listed channels are deconvolved. |
| `mask_channels` | comma-separated channels, or `none` | Channels to split into a nuclear (inclusive) and non-nuclear (exclusive) signal using the masks. Requires `rn_hybrid = true`, see [Understanding output](understanding-output.md#processed-images). |

Example (`manifest.tsv`):

```text
plate	index_xml	ff_channels	cp_nucl_channel	cp_cell_channel	dc_psfs	mask_channels
P1	/path/to/P1_Index.xml	0	0	1	0=/path/to/psf_dapi.tif	0
P2	/path/to/P2_Index.xml	0	0	1	0=/path/to/psf_dapi.tif	none
```

Notes:

- When a registration manifest is given, only the reference plates are
  segmented. The Cellpose columns of later cycles are ignored, but setting
  `cp_nucl_channel` on every plate is still useful: it tells the pipeline
  which channel to use for the per-cell registration correlation.
- Segmentation masks are required for everything after deconvolution.
  `cp_run = false` is only allowed when `rn_cache_images` and `cpr_run`
  are both switched off as well.

## Registration manifest

Links later imaging cycles to their reference plate. The pipeline estimates a
translation per field, merges the cycles into one image and appends the
channels of each later cycle after those of the reference plate.

| Column | Format | Purpose |
|---|---|---|
| `reference_plate` | plate name | The reference (cycle 1) plate. |
| `reference_channel` | channel | Channel on the reference plate used for alignment, usually the nucleus stain. |
| `query_plates` | comma-separated plate names | Later cycles, in cycle order (cycle 2, 3, ...). |
| `query_channels` | comma-separated channels | Alignment channel for each query plate, in the same order. |

The header must be exactly these four column names.

Example (`manifest_registration.tsv`), aligning `P2` onto `P1` on each plate's DAPI channel:

```text
reference_plate	reference_channel	query_plates	query_channels
P1	0	P2	0
```

Wells need to be present in every cycle of a group to be registered.

### Final channel numbers

After merging, channels are renumbered. Cycles are added in registration
order, and the inclusive/exclusive mask channels are appended last. For the
example above this gives eight final channels:

| Final channel | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|
| Source | P1 DAPI | P1 GFP | P1 RFP | P2 DAPI2 | P2 GFP2 | P2 RFP2 | P1 DAPI mask-in | P1 DAPI mask-ex |

The final numbering is written to `channel_indices.tsv` for every plate (see
[Understanding output](understanding-output.md)). It is the numbering used in
the `ch<N>__` output columns, the QC report and `qc_intensity_skip_channels`.
The manifests, and the `channel` column of the channel map, use the original
per-plate numbers.

## Blacklist

A headerless, two-column TSV (`plate`, `well`). Listed wells are excluded from
all processing, including the images sampled for flatfield estimation. Use it
for wells with acquisition failures, severe artefacts or single-stain
controls you don't want to analyse.

```text
P1	A09
P2	A09
P2	D12
```

The pipeline does not delete existing results for wells you blacklist later;
remove those yourself. Blacklisted wells are listed as `blacklisted` in the
[QC report's](qc-report.md) `well_qc.tsv`.

To run only a subset of wells instead, use `--rn_wells A06,B19,C22`, which
selects those wells on every plate.

## Channel map

The channel map configures [scaling](scaling.md) per channel, and tells the
intensity measurement step whether to measure each channel in the cell or
the nucleus mask. It is optional: without it, every channel is measured in
the cell mask, and automatic scaling uses dynamic-range scaling only.

| Column | Required | Purpose |
|---|---|---|
| `cycle` | yes | Imaging cycle of the channel: `1` is the reference cycle, `2` the first query cycle, and so on. |
| `channel` | yes | Original (per-plate) channel number. Add `:in` or `:ex` to refer to the inclusive (nuclear) or exclusive (non-nuclear) channel created by masking that channel. |
| `name` | yes | A name for the channel, used in outputs and by `sigmoid_from_channel`. |
| `dynamic_range_feature` | | Statistic used to set the channel's dynamic range, for example `max`. |
| `plate_offset_feature` | | Statistic compared between plates' control wells to estimate plate offsets, for example `mean`. |
| `sigmoid_lower_feature` | | Statistic marking the top of the background, for example `background_q75`. |
| `sigmoid_upper_feature` | | Statistic marking where signal starts, for example `otsu_log`. |
| `control_population` | | Regular expression matched against the whole `control_type` in the control list, for example `negctrl` or `negctrl\|posctrl`. Blank uses all control wells. |
| `measure_in` | | `cell` (default) or `nucleus`: which mask the channel's intensities are measured in. |
| `sigmoid_from_channel` | | `name` of another row whose fitted sigmoid this channel reuses. |
| `skip_scaling`, `skip_sigmoid`, `skip_plate_offsets` | | Optional `true`/`false` switches to opt a channel out of a part of scaling. |

The four `*_feature` columns name only the statistic. The pipeline adds the
channel's final number, so `max` on cycle 2, channel 1 becomes `ch4__max`.
To point at another channel's feature on purpose, write the full column name
(`ch0__background_mean`). Leaving a feature blank opts the channel out of that
step.

Example (`channel_map.tsv`):

```text
cycle	channel	name	dynamic_range_feature	plate_offset_feature	sigmoid_lower_feature	sigmoid_upper_feature	control_population	measure_in	sigmoid_from_channel
1	1	GFP	max	mean	background_q75	otsu_log	negctrl	cell
1	0	DAPI	max	mean	background_q75	otsu_log	negctrl	cell
1	0:in	DAPI_nuclear	max	mean			negctrl	nucleus	DAPI
1	0:ex	DAPI_cytoplasmic	max	mean			negctrl	cell	DAPI
2	1	GFP_cycle2	max	mean	background_q75	otsu_log	negctrl	cell
```

Cycles must be numbered consecutively from 1, and each `name` must be
unique. Because rows are keyed by cycle rather than plate, one channel map covers
every reference plate group in a run. For example, a run with groups
`P1-c1`+`P1-c2` and `P2-c1`+`P2-c2` needs only the rows above. The pipeline
checks that all groups share the same channel layout and stops if they don't.

Channels without a row (`RFP`, `GFP2` and `RFP2` above) are measured in the
cell mask and are not scaled. The mask channels (`0:in`, `0:ex`) borrow the
`DAPI` sigmoid, because masking sets their background to zero and
there is nothing to fit a sigmoid on. This is why `DAPI` needs its own row.

For the example setup, the pipeline resolves the map to:

```text
channel  name              dynamic_range_feature  sigmoid_from_channel  (from cycle, channel)
1        GFP               ch1__max                                     (1, 1)
0        DAPI              ch0__max                                     (1, 0)
6        DAPI_nuclear      ch6__max               DAPI                  (1, 0:in)
7        DAPI_cytoplasmic  ch7__max               DAPI                  (1, 0:ex)
4        GFP_cycle2        ch4__max                                     (2, 1)
```

The resolved map is saved to `rr__scaling/config/`. See [Scaling](scaling.md)
for what each feature does.

## Control list

Lists the control wells used for [plate-offset correction](scaling.md#plate-offsets)
and sigmoid fitting. A TSV with a header:

```text
plate	well	control_type
P1	A10	negctrl
P1	B10	negctrl
P1	D11	posctrl
P2	A10	negctrl
P2	B10	negctrl
P2	D11	posctrl
```

The `control_population` column of the channel map selects which
`control_type`s count for each channel. If both files are given, every
`control_population` is checked at startup against the `control_type` values
in the list, so a typo stops the run immediately. A control list is only
used by automatic scaling: it requires `sc_autoscale = true` and a channel map.

The header must be exactly `plate`, `well`, `control_type`, and wells must be
written with two-digit columns (`A01`, not `A1`).

## Run configuration

We recommend putting all settings for a run in a config file in your project
folder and passing it with `-c`:

```nextflow
params {
  rn_manifest              = 'inputs/manifest.tsv'
  rn_manifest_registration = 'inputs/manifest_registration.tsv'
  rn_blacklist             = null   // or 'inputs/blacklist.tsv'
  sc_channel_map           = 'inputs/channel_map.tsv'
  sc_control_list          = 'inputs/control_list.tsv'
}
```

Parameters on the command line override the config file:

```bash
nextflow run </path/to/main.nf> -profile local --workflow run_pipeline \
  -c my_run.config --rn_blacklist inputs/blacklist.tsv
```

Unknown parameter names are an error, so typos and parameter names from
older versions are caught at startup. See [Running the pipeline](running.md)
for a complete example config and [Parameters](parameters.md) for all options.

## Migrating from v0.0.1-beta

v0.2.0 contains breaking changes. Update existing projects as follows before
re-running them:

1. **Renumber channels from 0.** Subtract 1 from every channel number in the
   main manifest (`ff_channels`, `cp_nucl_channel`, `cp_cell_channel`,
   `mask_channels`, the channels in `dc_psfs`), the registration manifest
   (`reference_channel`, `query_channels`) and the channel map, and in the
   `ff_channels` parameter. Downstream code that reads `ch<N>__` columns also
   needs updating.
2. **Update the main manifest columns.** Rename `bp_channels` to
   `ff_channels`. Remove `channels` and `dc_channels`. Rewrite `dc_psfs` as
   `<channel>=<path>` pairs.
3. **Update the channel map.** Rename the `plate` column to `cycle` and
   replace each plate name with its cycle number. Shorten the `*_feature`
   values to the statistic only (for example `ch2__max` becomes `max`),
   unless you mean to point at another channel's feature.
4. **Rename parameters.** `bp_*` is now `ff_*`, `tg_conda_env`/`tg_container`
   are `rn_conda_env`/`rn_container`, and scaling parameters now use `sc_`
   (for example `rn_manualscale` is `sc_manualscale`). `cp_cell_power`,
   `cp_nucl_power`, `rn_dummy_mode`, `rn_threshold`, `cp_dont_postprocess`
   and all subcell parameters were removed. The pipeline will report any
   leftover names at startup.
5. **Select the workflow with `--workflow`** instead of `-entry`, and use
   Nextflow 26.04 or newer.
6. **Expect new output folders.** Everything downstream of finalize is now
   written to `rr__` folders. See [Understanding output](understanding-output.md).

The full list of changes is in the [changelog](changelog.md).
