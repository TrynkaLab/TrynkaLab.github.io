# Analysing features in R

The R package `tglow-r` provides downstream analysis of the pipeline's
output: reading the CellProfiler features into a single object, quality
control, transformation and scaling, dimensionality reduction, clustering,
and modelling. Its vignettes are written for the output structure of this
pipeline.

- Documentation: [tglow-r](https://trynkalab.github.io/software/tglow-r/)
- Repository: [TrynkaLab/tglow-r](https://github.com/TrynkaLab/tglow-r)

Useful pipeline outputs to combine with `tglow-r`:

- `rr__features/cellprofiler/<plate>_cells.parquet` and `<plate>_image.parquet`: the CellProfiler features, aggregated per plate.
- `rr__features/measurements/<unscaled or scaled>/`: the pipeline's own intensity features, per well.
- `rr__features/cellprofiler/features/`: the per-well CellProfiler zip archives. Since v0.2.0 these are only published with `cpr_publish_features_per_well = true`.
- `rr__qc/well_qc.tsv`: the per-well QC verdicts, for filtering wells. See [QC report](qc-report.md#per-well-qc-table).
- `rr__cellcrops/`: the cell crops index, for linking cells to their images.

See [Understanding output](understanding-output.md) for details on each folder.

## Loading the features

Both feature sets load into a `TglowDataset`:

```r
library(tglowr)

# CellProfiler features: reads every <plate>_cells.parquet / <plate>_image.parquet pair
cp <- read_cellprofiler_parquet("output/rr__features/cellprofiler")

# The pipeline's own intensity features: one folder per plate
px <- read_pipeline_parquet("output/rr__features/measurements/unscaled", assay.out="unscaled")

# Combine the objects on cell position
merged <- match_objects_xy_nn(cp, px)
```

Both take a `plates` argument to read only some plates, for example
`plates = c("plate1", "plate2")`.

::: tip Plate ids of the intensity features
`read_pipeline_parquet()` numbers the plates `P1`, `P2`, ... in the order of
`plates` (alphabetical by default). These match the plate ids in the
CellProfiler output only if `plates` is given in the order of the pipeline
manifest. Object ids also differ between the two: the intensity features use
the Cellpose label, the CellProfiler features use CellProfiler's object
number (see [Turning masks into objects](configuring-cellprofiler.md#turning-masks-into-objects)).

:::

