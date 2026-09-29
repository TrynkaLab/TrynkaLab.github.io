# Analysing features in R

::: warning Needs updating for v0.2.0
This page has not been fully updated for v0.2.0 yet. In particular, the
CellProfiler features are now aggregated into per-plate parquet files, and
the per-well zip archives are no longer published by default. The tglow-r
documentation may still describe reading the zip archives.
:::

The R package `tglow-r` provides downstream analysis of the pipeline's
output: reading the CellProfiler features into a single object, quality
control, transformation and scaling, dimensionality reduction, clustering,
and modelling. Its vignettes are written for the output structure of this
pipeline.

- Documentation: [tglow-r](https://trynkalab.github.io/software/tglow-r/)
- Repository: [TrynkaLab/tglow-r](https://github.com/TrynkaLab/tglow-r)

Useful pipeline outputs to combine with `tglow-r`:

- `rr__features/cellprofiler/<plate>_cells.parquet` and `<plate>_image.parquet`: the CellProfiler features, aggregated per plate.
- `rr__features/cellprofiler/features/`: the per-well CellProfiler zip archives. Since v0.2.0 these are only published with `cpr_publish_features_per_well = true`.
- `rr__qc/well_qc.tsv`: the per-well QC verdicts, for filtering wells. See [QC report](qc-report.md#per-well-qc-table).
- `rr__cellcrops/`: the cell crops index, for linking cells to their images.

See [Understanding output](understanding-output.md) for details on each folder.
