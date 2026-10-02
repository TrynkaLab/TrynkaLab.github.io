# Running PCA

PCA is calculated on the `scale.data` slot of an assay using `calculate_pca()`. The result is stored in `dataset@reduction` under the name `PCA.<assay>` by default. Make sure to run `scale_dataset()` first (see [feature transformation and scaling](feature-transformation-and-scaling.md)).

```r
tglow <- scale_dataset(tglow, assay="raw")
tglow <- calculate_pca(tglow, assay="raw")

# Limit the number of components (faster, uses irlba internally)
tglow <- calculate_pca(tglow, assay="raw", pc.n=50)

# Access the PCA result
tglow@reduction[["PCA.raw"]]@x         # PC coordinates, rows are objects
tglow@reduction[["PCA.raw"]]@var       # variance per PC
tglow@reduction[["PCA.raw"]]@var_total # total variance
```

Features with any NA values are automatically excluded. A warning is raised listing how many were removed.

Other arguments:

- `use_irlba`: use `irlba::prcomp_irlba()` instead of `prcomp()`. This is switched on automatically when `pc.n` is set.
- `recenter` / `rescale`: re-center and/or re-scale the slot to mean 0 and variance 1 before the PCA. `calculate_pca()` does not center or scale itself and assumes `scale.data` already has mean 0 and variance 1. This is not true after modified z-score scaling (`scale.method="median"`), so set both to `TRUE` in that case.
- `ret.prcomp=TRUE`: store the full `prcomp` object in `@object`. The loadings are in `$rotation`, with features as rows.

```r
# PCA after modified z-score scaling
tglow <- scale_dataset(tglow, assay="raw", scale.method="median")
tglow <- calculate_pca(tglow, assay="raw", pc.n=50, recenter=TRUE, rescale=TRUE)

# Keep the loadings
tglow <- calculate_pca(tglow, assay="raw", pc.n=50, ret.prcomp=TRUE)
loadings <- tglow@reduction[["PCA.raw"]]@object$rotation
```

# Clustering cells

Clustering is performed on a PCA reduction using `calculate_clustering()`, which builds a k-nearest neighbour graph and applies Louvain or Leiden community detection. Cluster labels are added as new columns in `dataset@meta` under the name `<col.out>res_<resolution>`.

```r
tglow <- calculate_clustering(tglow, reduction="PCA.raw", resolution=0.1)

# Test multiple resolutions at once
tglow <- calculate_clustering(tglow, reduction="PCA.raw",
                               resolution=c(0.05, 0.1, 0.3, 0.5))

# Access cluster labels
head(tglow@meta$clusters_res_0.1)
```

The `k` argument controls the number of nearest neighbours used to build the graph (default 10). Higher `k` tends to produce larger, coarser clusters. `pc.n` sets how many PCs are used (default: all PCs in the reduction).

By default an approximate nearest neighbour (Annoy-based) is used for speed. For exact kNN, set `exact.nn=TRUE`.

The `method` argument can be `"louvain"` (default) or `"leiden"`.

::: warning Leiden needs a different resolution
`igraph::cluster_leiden()` is called with its default objective, the Constant Potts Model (CPM), not modularity. Resolution values that work for Louvain do not carry over and usually give far too many clusters. Re-tune the resolution for Leiden. On `tglow_example`, `resolution=0.2` gives several hundred clusters, while `resolution=0.01` gives 14.
:::

```r
# Use exact kNN and leiden clustering
tglow <- calculate_clustering(tglow, reduction="PCA.raw",
                               k=20, method="leiden", resolution=0.01,
                               exact.nn=TRUE)
```

## Graph cache

The kNN graph is cached in `dataset@graph` and reused when `k`, `reduction` and `exact.nn` match the cached graph. Other arguments are not part of the cache key. In particular, changing `pc.n` reuses the old graph. To force a rebuild, remove the graph first:

```r
tglow@graph <- NULL
tglow <- calculate_clustering(tglow, reduction="PCA.raw", pc.n=10, resolution=0.1)
```

Subsetting a TglowDataset by objects drops the graph (with a warning), so it is rebuilt on the next call.

# Running UMAP

UMAP is calculated from an existing PCA reduction using `calculate_umap()`. The result is stored in `dataset@reduction` under the name `UMAP.PCA.<assay>` by default.

```r
# Using an existing PCA reduction
tglow <- calculate_umap(tglow, reduction="PCA.raw")

# Or provide the assay and let it auto-calculate the PCA if not already done
tglow <- calculate_umap(tglow, assay="raw")

# Access UMAP coordinates
tglow@reduction[["UMAP.PCA.raw"]]@x
```

`pc.n` (default 30) sets how many PCs are used: the UMAP is run on the first `pc.n` columns of the reduction. It must be less than or equal to the number of PCs in the reduction, so if you ran `calculate_pca(..., pc.n=20)`, also pass `pc.n=20` (or lower) here. When the PCA is calculated automatically, `pc.n` PCs are computed.

Additional arguments are passed through to `uwot::umap()`, so hyperparameters such as `n_neighbors`, `min_dist` and `spread` can be tuned via `...`.

```r
tglow <- calculate_umap(tglow, reduction="PCA.raw", pc.n=20,
                        n_neighbors=30, min_dist=0.1)
```

For very large datasets, a random subsample can be used to compute the UMAP embedding. The output still has one row per object, but the rows that were not sampled are `NA`:

```r
tglow <- calculate_umap(tglow, reduction="PCA.raw", downsample=50000L)
```

`downsample` can also be a vector of row indices to use.

## Visualizing reductions

The `tglow_dimplot()` function plots any two-dimensional reduction stored in `dataset@reduction`.

```r
# UMAP coloured by a discrete metadata column
tglow_dimplot(tglow, reduction="UMAP.PCA.raw", ident="drug")

# Colour by a continuous feature value from an assay
tglow_dimplot(tglow, reduction="UMAP.PCA.raw",
              ident="cell_AreaShape_Area",
              assay="raw", slot="scale.data")

# Facet by a metadata variable
tglow_dimplot(tglow, reduction="UMAP.PCA.raw",
              ident="drug", facet="donor")

# Plot specific PC axes
tglow_dimplot(tglow, reduction="PCA.raw",
              ident="clusters_res_0.1",
              axis.x=1, axis.y=2)
```

# Feature clustering and eigenfeatures

Many image features are strongly correlated. Clustering the features and summarising each cluster into one eigenfeature reduces this redundancy, which makes marker testing and interpretation easier.

- `calculate_feature_clustering(dataset, assay, slot, ...)` clusters features on their correlation. `method` can be `"complete"` (default), `"ward.D"`, `"ward.D2"`, `"louvain"` or `"leiden"`. For hierarchical methods, `resolution` is the height at which the tree is cut. With `"complete"`, `resolution=0.2` means all features in a cluster have a correlation of at least 0.8 with each other. `feature.group` clusters groups of features separately. The clusters are added to the assay `@features` slot as `fcl_<method>_res_<resolution>`.
- `calculate_eigenfeatures(dataset, assay, slot, cluster.col)` calculates the first PC of each feature cluster and stores it in a new assay `<assay>_eigenfeatures` (in the `data` slot). Its `@features` slot holds `var`, `var_tot`, `var_exp` (fraction of the cluster variance explained), `n_feature` and `features` (the features in the cluster). Eigenfeatures have an arbitrary sign, and no scaling is applied first, so use the `scale.data` slot as input.
- `find_markers_ttest()` and `find_markers_lmm()` find marker features for the classes in `ident`. `find_markers_lmm()` with `method="lmm"` fits a mixed model and needs `covariates` (by default each covariate is a random intercept), for example the well. `method="lm"` fits a plain linear model.
- `find_eigenmarkers()` runs feature clustering (unless `fcl.col` is given), eigenfeature calculation and marker testing in one go. `method` is `"lmm"` (default), `"lm"` or `"ttest"`; other arguments go to the marker function.
- `plot_eigenmarkers(markers, eigenmarkers)` plots the mean effect size of the features in each cluster per class, using per-feature markers and the output of `find_eigenmarkers()`.

Features with NA values give NA eigenfeatures, so this example first keeps only features without NA's in `scale.data`:

```r
tglow <- scale_dataset(tglow, assay="raw")
keep  <- colnames(tglow$raw)[colSums(is.na(tglow$raw@scale.data)) == 0]
tglow <- tglow[, keep]

# Cluster features and calculate eigenfeatures
tglow <- calculate_feature_clustering(tglow, assay="raw", slot="scale.data",
                                      method="complete", resolution=0.2)
tglow <- calculate_eigenfeatures(tglow, assay="raw", slot="scale.data",
                                 cluster.col="fcl_complete_res_0.2")
head(tglow$raw_eigenfeatures@features[, c("n_feature", "var_exp")])

# Markers for drug vs DMSO on the eigenfeatures, with well as random effect
markers.eigen <- find_markers_lmm(tglow, ident="drug", assay="raw_eigenfeatures",
                                  slot="data", covariates="well")

# Or all steps in one go, then plot
eig     <- find_eigenmarkers(tglow, ident="drug", assay="raw", slot="scale.data",
                             fcl.col="fcl_complete_res_0.2", method="ttest")
markers <- find_markers_ttest(tglow, ident="drug", assay="raw", slot="scale.data")
plot_eigenmarkers(markers, eig)
```
