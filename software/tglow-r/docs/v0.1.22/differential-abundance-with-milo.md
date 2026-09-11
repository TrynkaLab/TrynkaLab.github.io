# Introduction

To test for differential abundance, [Milo](https://github.com/MarioniLab/miloR/tree/master) can be used. While developed for scRNAseq we can also use the PCA's from CellProfiler features or DINO embeddings to construct the kNN. Below is a simple workflow on how to do this from a TglowDataset. In future we might add a wrapper. For details on Milo, please refer to their documentation on the git or to the original paper: doi: 10.1038/s41587-021-01033-z

# Running Milo on a TglowDataset

First, we need to load the required libraries:

```r
library(tglowr)
library(SingleCellExperiment)
library(miloR)
```

If you don't have a PCA reduction, the first step is to calculate principal components, this can be done manually or through the tglow package. If you already have a PCA and UMAP reduction on the dataset, you can skip this step.

```r
assay <- "raw"

# Number of PCs to use in Milo
pc.n <- 30

# Center and scale the data
tglow <- scale_dataset(tglow, assay)

# Calculate PCA
tglow <- calculate_pca(tglow, assay, pc.n=pc.n)

# Calculate UMAP
tglow <- calculate_umap(tglow, paste0("PCA.", assay))
```

The next step is to create the metadata Milo needs, in this case we treat wells as replicates (samples) and we want to test for abundance of the timepoint variable.

```r
# Define the metadata to model
milo.meta           <- getDataByObject(tglow, c("timepoint", "well"))
milo.meta$sample    <- paste0(milo.meta$timepoint, "__", milo.meta$well)
```

Next we can build the kNN, to do this, we can simply pass the matrix of PCA results from a TglowDataset

```r
# Number of neighbours
k <- 30

milo.obj <- buildGraph(tglow@reduction[[paste0("PCA.", assay)]]@x, k=k, d=pc.n, transposed=T)
milo.obj <- makeNhoods(milo.obj, k=k, d=pc.n, refined=TRUE, prop=0.2)

# Check how many cells make up a neighbourhood
# "As a rule of thumb we want to have an average neighbourhood size over 5 x N_samples"
# A sample here refers to the 'sample' column as defined above, see Milo documentation for details on what this means
5 * length(unique(milo.meta$sample))

plotNhoodSizeHist(milo.obj)
```

Once you are happy with the neighbourhood sizes, the rest of the milo workflow is the same as described in the docs

```r
# Calculate the distance between neighbourhoods
milo.obj <- calcNhoodDistance(milo.obj, d=pc.n)
milo.obj <- countCells(milo.obj, samples="sample", meta.data=milo.meta)

# Define the design matrix
milo.design <- as.data.frame(xtabs(~ timepoint + sample, data=milo.meta))

# Remove non-existent levels in the design matrix
milo.design <- milo.design[milo.design$Freq > 0, ]
rownames(milo.design) <- milo.design$sample

milo.design <- milo.design[colnames(nhoodCounts(milo.obj)),]
milo.obj <- buildNhoodGraph(milo.obj)
```

Next, we can annotate the Milo object with extra metadata and the UMAP

```r
# Add the cluster labels or other metadata (optional)
milo.obj@colData <- DataFrame(getDataByObject(tglow, "clusters_res_0.1", drop=F))

# Add the UMAP to the pilot
reducedDim(milo.obj, "UMAP") <- tglow@reduction[[paste0("UMAP.PCA.", assay)]]@x
```

Finally, we can perform the test. See Milo documentation for more details on possible designs

```r
milo.res <- testNhoods(milo.obj, design=~-1+timepoint, design.df=milo.design, model.contrasts = c("timepoint7d - timepoint0h"))

# Annotate the results with cluster labels (optional)
milo.res <- annotateNhoods(milo.obj, da.res=milo.res, "clusters_res_0.1")

# Plot the results on the neighbourhoods in the UMAP space
plotNhoodGraphDA(milo.obj, milo.res, alpha=0.05)
```
