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

Features with any NA values are automatically excluded. A warning is raised listing how many were removed. The full `prcomp` object (including loadings) can be retained by setting `ret.prcomp=TRUE`.

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

The `k` argument controls the number of nearest neighbours used to build the graph (default 10). Higher `k` tends to produce larger, coarser clusters. The `method` argument can be `"louvain"` (default) or `"leiden"`. The graph is cached on the dataset and reused automatically if `k`, `reduction`, and `exact.nn` are unchanged.

By default an approximate nearest neighbour (Annoy-based) is used for speed. For exact kNN, set `exact.nn=TRUE`.

```r
# Use exact kNN and leiden clustering
tglow <- calculate_clustering(tglow, reduction="PCA.raw",
                               k=20, method="leiden", resolution=0.2,
                               exact.nn=TRUE)
```

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

Additional arguments are passed through to `uwot::umap()`, so hyperparameters such as `n_neighbors`, `min_dist` and `spread` can be tuned via `...`.

For very large datasets, a random subsample can be used to compute the UMAP embedding while preserving the full object count in the output (non-sampled objects are set to NA):

```r
tglow <- calculate_umap(tglow, reduction="PCA.raw", downsample=50000L)
```

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
