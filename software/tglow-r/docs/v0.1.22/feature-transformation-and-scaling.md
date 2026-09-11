# Transforming features using BoxCox transform

High content imaging features are often non-normally distributed. A variance-stabilizing transformation prior to scaling and dimensionality reduction can improve results. The `apply_boxcox()` function applies a BoxCox (or modulus) transform to all features in an assay, estimating the optimal lambda independently per feature.

```r
# Apply BoxCox transform to the raw assay
# Output is stored in a new assay named "<assay>-trans" by default
tglow <- apply_boxcox(tglow, assay="raw")
tglow$`raw-trans`
```

The `mode` argument controls whether a standard BoxCox `mode="boxcox"` or a modulus transform `mode="modulus"` is used. As standard boxcox needs positive values, features are transformed to be positive prior to running boxcox. The modulus transform handles negative features directly.

The estimated lambda per feature is stored in the `features` data frame of the output assay. A lambda of 0 corresponds to a log transform; a lambda of 1 means no transformation was applied.

Note that this does not guarantee normality, these transforms just find the power that makes the data more normal.

```r
# Use modulus transform instead of BoxCox (handles negative values)
tglow <- apply_boxcox(tglow, assay="raw", mode="modulus")

# Apply to image.data — result is stored in the image.data.trans slot
tglow <- apply_boxcox(tglow, assay="image.data")
```

For large datasets, lambda estimation can be sped up by downsampling, it should not meaningfully affect the final lambda.

```r
tglow <- apply_boxcox(tglow, assay="raw", downsample=10000L)
```

# Scaling features and control samples

Features are scaled by populating the `scale.data` slot of a `TglowAssay`. The function `scale_assay()` operates on a single `TglowAssay`; `scale_dataset()` is a convenience wrapper that operates on a `TglowDataset`.

By default, scaling produces z-scores (mean 0, variance 1). A modified z-score (median ± MAD) can be obtained by setting `scale.method="median"`.

```r
# Scale all assays in a dataset (z-score by default)
tglow <- scale_dataset(tglow, assay="raw")

# Scale within groups (e.g. per plate)
tglow <- scale_dataset(tglow, assay="raw", grouping="plate_id")

# Scale relative to a reference group (e.g. control wells) within plates
tglow <- scale_dataset(tglow, assay="raw",
                       grouping="plate_id",
                       reference.group=tglow@meta$is_control)

# Use modified z-score instead of z-score
tglow <- scale_dataset(tglow, assay="raw", scale.method="median")
```

The `grouping` argument accepts either a column name available on the dataset (in meta or image.meta) or a vector of the same length as `nrow(dataset)`. When combined with `reference.group` (a logical vector), scaling parameters are estimated only from the reference objects and then applied to all objects within each group. This is useful for scaling imaging features relative to a control sample on each plate.

After scaling, the `scale.data` slot on the assay is populated and ready for use in downstream dimensionality reduction steps.
