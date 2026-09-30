# Changelog

## 0.2.0 (unreleased)

### Major changes

#### General changes
- Reworked the scaling workflow, which should now be broadly automated rather than relying on two pipeline runs
- Added cross-batch scaling consensus (`sc_reference_scaling_index`). Given one or more previous batches' `scaling_index.tsv`, a new `consensus_scaling_factors` step pools them with the current batch's own index and recomputes the scaling factors over the combined plate set, so the output dynamic range is comparable between batches. The recompute reproduces exactly what a single run over all the pooled plates would have produced, rather than averaging the per-batch factors (which is not meaningful - each batch's `base_scale` carries its own plate-offset anchor). Outputs go to `rr__scaling/consensus` and supersede those in `rr__scaling`, and a `consensus_diagnostics.tsv` reports the per-plate values behind the pooled scale.
- Added `rn_stop_after_scaling_factors`, which ends the run once the scaling factors exist - skipping rescale, cellcrops and cellprofiler while still producing the full QC report from the unscaled images. Together with `sc_reference_scaling_index` this enables a two-step workflow: characterise each batch cheaply, then re-run against the other batches' indices.
- The QC report step now also writes a per-well QC table (`rr__qc/well_qc.tsv`): one row per well with `plate`/`row`/`col`/`well`, the value behind each check, a `missing_cycles` column, `qc_flags_fail`/`qc_flags_warn` columns naming whatever tripped at each level, and a single `qc_verdict`. Three measurement checks contribute - segmented cell count (fail below `qc_min_cells_per_well`), percentage of cells clearing the registration threshold (fail below `qc_min_pct_registered`), and percentage of cells whose signal sits near their own field's background (warn above `qc_max_pct_low_signal`, per channel, with `qc_intensity_skip_channels` to exclude channels like brightfield). Two further checks fail wells that never reached the measurements: `missing_cycle:<plates>` for a well absent from one of its registration group's cycle plates (previously dropped silently by the channel joins), and `not_measured` for a well imaged in every cycle but with no measurements (e.g. a task failing under an ignore errorStrategy). The verdict takes the worst consequence across the checks (blacklisted &gt; fail &gt; warn &gt; pass); blacklisted wells are listed from the blacklist file, since they were excluded before anything was measured. The table is also shown in the QC report as a Well QC tab (sortable, filterable by verdict), and the General QC tab reports the number of failed and warned wells.
- The scaling steps now write a `scaling_warnings.tsv` alongside their other outputs, and the QC report surfaces it as a warnings panel in Tab 6 - previously these warnings only reached the task's `.command.err`.
- Plate offsets are now estimated with a two-stage mean by default (`sc_offset_mode="well"`): control cells are averaged within each well first, then across wells, instead of pooling every control cell on the plate. The well is the experimental unit, so the previous flat mean implicitly weighted each well by its cell count and let a single dense well dominate a plate's offset. `sc_offset_min_cells_per_well` (default 10) drops sparse wells, which would otherwise carry full weight under the new scheme. Set `sc_offset_mode="cell"` to reproduce the old numbers. `scaling_index.tsv` gains `plate_nwells` and records the mode used, and the consensus step refuses to pool indices whose modes disagree.
- Updated syntax to support the latest Nextflow (26.04), which enforces strict syntax by default; required a lot of refactoring
- Added a validation routine for input files
- Moved processes downstream of finalize from storeDir to publishDir. Folders that are populated this way (i.e. their contents are symlinked back to the cached files in the workdir, rather than being independent copies) are prefixed with `rr__`. This means these will now be re-run if their input changes. Old caching style is maintained for cellpose, decon, images, flatfields and registration, so these will still need to manually be removed to force a rerun. 
- Removed the subcell workflow, it was out of date
- Cellprofiler features now published as parquet files aggregated per plate (when cpr_no_zip=false (default))

#### Breaking changes
- Channel numbering is now 0-indexed everywhere, replacing a previous mix of conventions (1-indexed manifests/`channel_map`/`ch<N>__` output columns vs. 0-indexed internal state). Affected: the main manifest's `ff_channels`/`cp_nucl_channel`/`cp_cell_channel`/`dc_psfs`/`mask_channels` columns, the registration manifest's `reference_channel`/`query_channels`, `sc_channel_map`'s `channel` column, the `ff_channels` override param, and every `ch<N>__stat` output column (object_features/image_features parquet, QC report labels/columns). Existing manifests/channel_maps must be updated (subtract 1 from every channel value) before re-running against this version.
- `sc_channel_map`'s `plate` column is now `cycle`, holding an imaging cycle number (`1` = the reference cycle, `2` = the first merged query cycle, ...) instead of a manifest plate name. One channel map now covers every reference-plate group in a run, since each group has its own cycle 1/2/...; previously you had to write the rows for one arbitrary group and rely on the others matching. `update_channel_map` now checks the groups genuinely share a channel layout rather than assuming it. Existing channel maps must rename the column and replace each plate name with its cycle number.

#### Installation & dependencies
- Eased install process, added enviroment.yml, now support a single enviroment
- Updated to Python 3.11
- Updated cellprofiler to 5.0, nightly build (pinned to 5.0.0.dev690 for stability)
- Migrated from AICSimageio to bioio
- Updated to Nextflow 26.04

#### Input & parameter changes
- Added `ff_seed` to seed the random image sampling in flatfield estimation, so flatfields are reproducible between runs. Defaults to 42, set to null for the previous unseeded behaviour
- Dropped `-entry` (no longer supported by NF &gt; 26.04), added `--workflow` to control which workflow gets executed
- Changed how PSFs are specified in the manifest, now in `<channel>=<path>` format; dropped `dc_channels` as it is no longer needed
- Dropped `channels` column in manifest, it wasn't used
- Several configurations have been renamed, please see the parameters header below.
- `sc_channel_map`'s four `*_feature` columns now name just the measured statistic (`max`, `background_mean`, ...) instead of the full output column name. `update_channel_map` prefixes each with that row's resolved channel, so cycle 2 channel 1's `max` becomes `ch4__max` - the final index isn't knowable when writing the map. Writing a value out in full (`ch0__background_mean`) still works and opts out, which is how a row points at another channel's feature deliberately.
- `update_channel_map` no longer requires a registration manifest to resolve `--ref-nucl-channel`/`--qry-nucl-channel`. Without one it resolves every plate that names a `cp_nucl_channel` (skipping `none`, and plates absent from `channel_indices.tsv`), requires them to agree, and falls back to channel 0 with a warning if no plate names one. Previously a run with no registration manifest failed unless the manifest had exactly one plate whose `cp_nucl_channel` was set.
- Added an optional `sigmoid_from_channel` column to `sc_channel_map`, naming another row (by its `name`) whose fitted sigmoid that channel should reuse instead of fitting its own. Intended for the `:in`/`:ex` mask inclusive/exclusive channels, where masking zeroes the background so `sigmoid_lower_feature` has nothing meaningful to measure. Only the sigmoid is copied - the channel is still scaled to its own measured dynamic range.

### Bugfixes
- Fixed index_images & index_cellcrops re-triggering unnecessarily due to `.last()`; now uses a fingerprint-based approach that checks modification times without needing to stage every input file

### Minor changes
- Plates are now automatically renamed during staging to the plate name provided in the manifest, instead of the name from the PE index file
- basicpy is now an optional dependency, only needed for `ff_mode=BASICPY`
- Fixed `-stub-run` to fire properly after recent updates
- Added a script to perform a stub run, useful for testing that the wiring is working properly
- Updated the cellcrops process to produce a single parquet file per well instead of one CSV per field
- Cellcrop indexing now aggregates into a single parquet file instead of a CSV
- Added new configuration for the Sanger CUB cluster
- Updated the GPU queue for the Sanger farm22 cluster
- Renamed the manifest parameter `bp_channels` to `ff_channels`
- General code cleanup, removed deperacted scripts and comments
- By default, per well cellprofiler is not added to publishDir
- Unscaled images can optionally be skipped in publishDir
- Added creation of field matrix to stage workflow detailling how fields are organized spatially
- `measure_intensity` now also computes `ch<N>__q25`/`ch<N>__q75` at the cell level (25th/75th percentile intensity); the QC report's intensity tab (Tab 5) gained q25/q75 as feature options and now defaults to median instead of min
- Added a `manifest.version` to `nextflow.config` (currently `0.2.0`) - read at runtime via `workflow.manifest.version` and shown in the QC report footer. Bump this by hand on meaningful releases; there's no automated tagging yet

### Parameters
- Added `--workflow`
- Added `--cpr_publish_features_per_well` (default `false`) to make staging of well level CellProfiler feature outputs (`rr__features/cellprofiler`) optional
- Added `--sc_publish_unscaled` (default `true`) to make staging of the unscaled processed images (`rr__processed_images/unscaled`) optional
- Added `--cpr_run_concat` (default `true`), `--cpr_merge_strategy`, `--cpr_parent_col` and `--cpr_child_pattern` to control the new per-plate CellProfiler aggregation step (`rr__features/cellprofiler`)
- Added `--sc_skip_debris_removal` (default `false`) to force sigmoid fitting to always use the bare (non-debris-removed) image feature; `calculate_scaling_factors` now automatically prefers an image's debris-removed (`_dbrm`) feature variant for sigmoid fitting whenever that image's own debris QC passes `sc_debris_min_ratio`/`sc_debris_max_pct`
- Added  `sc_debris_max_pct`/`sc_debris_min_ratio` (Scaling section)
- Added `--qc_n_sample_debris` (default `10`) - number of highest-debris example images shown per channel in Tab 7
- Added `--qc_label` (default `normal`) - resource label for the QC report's own processes, replacing a hardcoded `tiny` label that was undersized once real images/masks are loaded (debris sample selection/rendering, report assembly)
- Added `--qc_decon_crop_pct` (default `25`) - center-crops Tab 4's before/after decon images to this % of the original width/height, since decon's effect is often too subtle to see in a full, shrunk-to-thumbnail field

- Removed subcell parameters
- `sc_` prefix now used for scaling parameters
- `bp_` prefix (basicpy) renamed to `ff_` (flatfield)
- `tg_` prefix (tglow) renamed to `rn_` (run); applies to `tg_conda_env` and `tg_container`
- Removed `cp_cell_power`, `cp_nucl_power`, `rn_dummy_mode`, `rn_threshold` and `cp_dont_post_process` options
- Removed `executor.poolSize` from the LSF definition
- Removed `dc_channels` from the manifest

### Documentation
- Fixed small documentation issues that didn't match actual behaviour
- Documentation hosted on trynkalab.github.io instead of wiki

## 0.0.1-beta and earlier

No changelog was kept for these versions.
