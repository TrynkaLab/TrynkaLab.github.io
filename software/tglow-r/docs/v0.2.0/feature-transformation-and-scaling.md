# Transforming features using BoxCox transform

High content imaging features are often non-normally distributed. A variance-stabilizing transformation prior to scaling and dimensionality reduction can improve results. The `apply_boxcox()` function applies a BoxCox (or modulus) transform to all features in an assay, estimating the optimal lambda independently per feature.

```r
# Apply BoxCox transform to the raw assay
# Output is stored in a new assay named "<assay>-trans" by default
tglow <- apply_boxcox(tglow, assay="raw")
tglow$`raw-trans`

# Or set the output assay name
tglow <- apply_boxcox(tglow, assay="raw", assay.out="raw-bc")
```

The `scale.data` slot of the output assay already contains z-scores of the transformed data, so you do not need to scale it again unless you want grouped or reference scaling (see below).

The `mode` argument controls whether a standard BoxCox `mode="boxcox"` or a modulus transform `mode="modulus"` is used. As standard boxcox needs positive values, features are transformed to be positive prior to running boxcox. The modulus transform handles negative features directly.

The estimated lambda per feature is stored in the `features` data frame of the output assay. A lambda of 0 corresponds to a log transform; a lambda of 1 means no transformation was applied. Lambdas within `fudge` (default 0.2) of 0 or 1 are set to exactly 0 or 1.

Other useful options:

- `trim` (default TRUE): drop features with zero variance after the transform, with a warning listing how many were removed.
- `filter.iqr` (default FALSE): ignore values outside 2x the IQR when estimating lambda, to reduce the impact of outliers. All values are still transformed.

Note that this does not guarantee normality, these transforms just find the power that makes the data more normal.

```r
# Use modulus transform instead of BoxCox (handles negative values)
tglow <- apply_boxcox(tglow, assay="raw", mode="modulus")

# Apply to image.data, result is stored in the image.data.trans slot
# assay.out is ignored for image.data
tglow <- apply_boxcox(tglow, assay="image.data")
```

For large datasets, lambda estimation can be sped up by downsampling, it should not meaningfully affect the final lambda. `downsample` must be smaller than or equal to the number of cells, otherwise it errors.

```r
tglow <- apply_boxcox(tglow, assay="raw", downsample=10000L)
```

# Scaling features and control samples

Features are scaled by populating the `scale.data` slot of a `TglowAssay`. The function `scale_assay()` operates on a single `TglowAssay`; `scale_dataset()` is a convenience wrapper that operates on a `TglowDataset`.

By default, scaling produces z-scores (mean 0, variance 1). A modified z-score (median ± MAD) can be obtained by setting `scale.method="median"`.

```r
# Scale the raw assay (z-score by default)
tglow <- scale_dataset(tglow, assay="raw")

# Scale all assays in a dataset
tglow <- scale_dataset(tglow)

# Scale within groups (e.g. per plate)
# "Metadata_plate" with read_cellprofiler_parquet(), "plate" with read_pipeline_parquet()
tglow <- scale_dataset(tglow, assay="raw", grouping="Metadata_plate")

# Scale relative to a reference group (e.g. control wells) within plates
# Replace with your own control wells ("well" with read_pipeline_parquet())
control.wells <- c("B02", "B03")
is_control    <- getDataByObject(tglow, "Metadata_well") %in% control.wells

tglow <- scale_dataset(tglow, assay="raw",
                       grouping="Metadata_plate",
                       reference.group=is_control)

# Use modified z-score instead of z-score
tglow <- scale_dataset(tglow, assay="raw", scale.method="median")
```

The `grouping` argument accepts either a column name available on the dataset (in meta or image.meta) or a vector of the same length as `nrow(dataset)`. When combined with `reference.group` (a logical vector with one value per object and no NA's), scaling parameters are estimated only from the reference objects and then applied to all objects within each group. This is useful for scaling imaging features relative to a control sample on each plate. Each group needs reference objects, otherwise its scaled values are NA.

::: tip
`na.rm` defaults to TRUE: NA's are ignored when calculating the scaling factors and stay NA in `scale.data`. With `na.rm=FALSE`, a feature with any NA becomes NA for all objects.
:::

After scaling, the `scale.data` slot on the assay is populated and ready for use in downstream dimensionality reduction steps.
