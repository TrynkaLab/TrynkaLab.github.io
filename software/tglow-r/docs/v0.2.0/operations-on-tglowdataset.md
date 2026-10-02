# Operations on TglowDataset

The following page shows examples of common operations that can be performed on TglowDatasets and its derived objects.

### Show

Show will show some useful info on the object

```r
data(tglow_example)

tglow

TglowData with:  5000  objects (cells),  360  images and  1  assays
- Assays:
	$raw:	TglowAssay with: 5000 objects and 989 features. Size: 0.04 Gb
- Active assay: raw
- Reductions:
- Object size: 0.05 Gb
```

You can also show tglow assays

```r
tglow@assays$raw

TglowAssay with: 5000 objects and 989 features. Size: 0.04 Gb
```

### Slicing

TglowDatasets and assays can be sliced by row

```r
# Select the 50th cell
tglow[50,]

TglowData with:  1  objects (cells),  1  images and  1  assays
- Assays:
	$raw:	TglowAssay with: 1 objects and 989 features. Size: 0 Gb
- Active assay: raw
- Reductions:
- Object size: 0 Gb
```

They can also be sliced by column, but this is not recommended unless using column names, as assays can have different number of columns. A warning is raised when you try to slice columns with a non-character.

```r
tglow[50,34]

TglowData with:  1  objects (cells),  1  images and  1  assays
- Assays:
	$raw:	TglowAssay with: 1 objects and 1 features. Size: 0 Gb
- Active assay: raw
- Reductions:
- Object size: 0 Gb

Warning message:
In .local(x, i, j, ..., drop) :
  Assuming all assays have the same column order
```

Individual TglowAssays can also be sliced, in this case it is safe to use integers to select features.

```r
# Select the 50th cell and the first feature
tglow$raw[50,1]
```

### Accessing assays

You can access TglowAssays from the `@assays` slot by using `$` or by `[[]]`

```r
tglow@assays[["raw"]]
tglow$raw
tglow[["raw"]]
```

### Accessing feature data

You can access the data using slicing `[]` or by using `$` on a TglowAssay or a TglowMatrix. Slicing a TglowAssay returns a new assay. `$` on a TglowAssay returns a list with items `data` and `scale.data`, `$` on a TglowMatrix returns a numeric vector.

```r
# Returns a slice as a TglowAssay
tglow$raw[50,1]

# Returns a slice as a TglowMatrix
tglow$raw@data[50:60,1:3]

# Selecting a single row or column returns a plain numeric
tglow$raw@data[50,1]

# Returns a list with data and scale data items
tglow$raw$cell_AreaShape_Area
tglow$raw$cell_AreaShape_Area$data
tglow$raw$cell_AreaShape_Area$scale.data

# Returns a numeric with the value
tglow$raw@data$cell_AreaShape_Area
tglow$raw@scale.data$cell_AreaShape_Area
```

### Setting and manipulating assays

You can set TglowAssays using the `@assays` slot. The assays slot is just a list, so you can put anything in it but if you want it to work properly `new.assay` must be a TglowAssay. Note at the moment you can only add assays using `tglow@assays[["new.assay"]] <- new.assay` and not the other operators.

```r
# Create a new assay from raw, with just the first 10 features
new.assay <- new("TglowAssay",
      data=tglow$raw@data[,1:10],
      scale.data=NULL,
      features=tglow$raw@features[1:10,]
)
tglow@assays[["new.assay"]] <- new.assay
```

You can manipulate specific slots in existing assays as well. For example, replacing the data slot with the scale.data slot. The scale.data slot is NULL until the assay is scaled, so run `scale_assay()` first.

```r
tglow@assays[["new.assay"]]       <- scale_assay(tglow@assays[["new.assay"]])
tglow@assays[["new.assay"]]@data  <- tglow$new.assay@scale.data
```

### Adding features to an existing assay

The function `add_features_to_assay()` can be used to add new features to an existing assay. The features are added to the slot given by `slot`, and by default matching columns of NA's are added to the other slot (if it is set). With `preserve.other=TRUE` the other slot is left untouched, so it no longer has the same columns as `slot`.

```r
# Generate some matrix of features
new.features           <- matrix(1, nrow=nrow(tglow), ncol=4)
colnames(new.features) <- c("A", "B", "C","D")

# Add the features to the raw assay
tglow@assays[["raw"]]  <- add_features_to_assay(tglow@assays$raw, slot="data", features=new.features)
```

### Accessing data

To get a mix of meta data of feature information per cell object there is a convenience function `getDataByObject()` which grabs data from any assay, slot or metadata item as long as its colnames are uniquely findable. The function returns a object x feature data frame. The function `getDataByObject()` only works with one assay at the time, if you grab features from two different assays, you will need to run `getDataByObject` twice and call cbind on the result.

```r
# Get drug, dose (image.meta columns in tglow_example) and cell size per object
data <- getDataByObject(tglow, c("drug", "dose", "cell_AreaShape_Area"), assay="raw", slot="data")

# Metadata can also be directly accessed
dim(tglow@meta)
dim(tglow@image.meta)

# Image data can also be accessed using
?getImageData()
?getImageDataByObject()
```

### Getting and setting object IDs

Object ID's can be viewed in two ways

```r
# Accessing the slot directly
tglow@object.ids

# Or using objectIds
objectIds(tglow)
```

The method `objectIds` is implemented for `TglowDataset`, `TglowAssay` and `TglowReduction`.
To set object ID's you can use the `<-` operator.

```r
# Set object ID's for all assays, reductions and metadata
objectIds(tglow) <- paste0("O", 1:nrow(tglow))
```

> NOTE: You can also do it manually through the slots, but this is not recommended, as it can lead to issues when not all slots are set properly, as it assumed all slots have the rownames set to enable easy slicing by object ID. Similarly, you could call `objectIds(tglow@assays[[1]]) <- 1:nrow(tglow)` but this will likely break downstream functionality.

### Aggregating datasets

TglowDatasets can be aggregated using `aggregate_by_imagecol()` which will take a dataset, apply the supplied aggregation function, and return a new TglowDataset with the aggregated data. Supported aggregations are mean, median and sum. Metadata in `@meta` and `@image.meta` is aggregated as well:

- Numeric columns are aggregated with `method`.
- Character and logical columns are kept if there is one unique value per group, otherwise the result is NA. With `drop.multival.string=FALSE`, multiple character values are pasted together with `sep` (default `"; "`).
- Factors with several values are always pasted together with `sep`.
- Columns that have only NA's are dropped unless `drop.na.col=FALSE`.

The result has no feature map and no reductions, and `@image.data.trans` and `@image.data.norm` are not carried over.

```r
# Calculate the median per donor, and drug
tglow@image.meta$agg_col <- paste0(tglow@image.meta$donor, "_", tglow@image.meta$drug)
tglow.agg                <- aggregate_by_imagecol(tglow, "agg_col", method="median")
```

The output object is a valid TglowDataset, so all functions should work as usual

```r
isValid(tglow.agg)

tglow.agg <- scale_dataset(tglow.agg, assay="raw")
tglow.agg <- calculate_pca(tglow.agg, assay="raw")

tglow_dimplot(tglow.agg, reduction="PCA.raw", ident="drug")
```

### Matching two TglowDatasets

#### Matching on nearest neighbour position

There are often cases when features have been extracted for the same set of images and cells, but perhaps using slightly different masks, or different softwares. This can make it harder to match due to rounding errors or implementation differences yielding slightly different xyz positions for cells. Tglow-r contains a function that matches two TglowDatasets based on the nearest neighbors in xy space, within the same plate, well and field. It uses the `@feature.map` of both objects to find these columns. Both `read_cellprofiler_parquet()` and `read_pipeline_parquet()` set the feature map automatically, but aggregated or manually constructed objects will not have one.

- `tol`: the maximum xy distance for a nearest neighbour to count as a match (default 2). Objects in `a` without a match get NA's in the data taken from `b`.
- `mode="add"` (default): all assays from `b` are added to `a` as new assays. If an assay name already exists in `a`, it is prefixed with `assay.prefix` (default `"b_"`).
- `mode="merge"`: assays with the same name are merged, adding only the features from `b` that are not yet in `a`.

Columns in `b@meta` that are not in `a@meta` are added to `a@meta`. Image level data is not merged.

```r
# Lets create a permuted subset of the dataset
tglow.b <- tglow[sample(nrow(tglow), 2000),]

# Lets match them
tglow.matched <- match_objects_xy_nn(tglow, tglow.b)
[INFO]  40 % of objects in object a matched to b at tolerance of  2  distance

# We now have an extra assay coming from tglow.b that is matched to our main tglow dataset
tglow.matched

TglowData with:  5000  objects (cells),  360  images and  2  assays
- Assays:
	$raw:	TglowAssay with: 5000 objects and 989 features. Size: 0.04 Gb
	$b_raw:	TglowAssay with: 5000 objects and 989 features. Size: 0.04 Gb
- Active assay: raw
- Reductions:
- Object size: 0.09 Gb
```

This is the recommended way to match pipeline intensity output (`read_pipeline_parquet()`) to CellProfiler output (`read_cellprofiler_parquet()`). Their object IDs differ, as the pipeline uses the Cellpose label (`P1_B08_I1_L1`) and CellProfiler the ObjectNumber (`P1_B08_I1_O1`).

```r
cp    <- read_cellprofiler_parquet(system.file("extdata/cellprofiler", package="tglowr"))
pipe  <- read_pipeline_parquet(system.file("extdata/pipeline", package="tglowr"))

# Add the pipeline features to the CellProfiler dataset
tglow.matched <- match_objects_xy_nn(cp, pipe, tol=5)
```

#### Matching manually on ID

You can align two datasets on a matching ID. Object IDs look like `P1_B08_I1_O1`, where the short plate ID `P1` is assigned per run, so IDs are not guaranteed to match between datasets from different runs. Given you use the same cellpose masks and have configured CellProfiler to NOT relabel cells, you can use the plate, well, field and `cell_ObjectNumber` to match CellProfiler datasets.

```r
# Fetch the data you need to match in set 1
rn                   <- getDataByObject(tglow.new, c("plate_well_field", "cell_ObjectNumber"))

# Assign the new ID's to set 1
objectIds(tglow.new) <- paste0(rn$plate_well_field, ":", rn$cell_ObjectNumber)

# Fetch the data you need to match in set 2
rn                   <- getDataByObject(tglow, c("plate_well_field", "cell_ObjectNumber"))

# Assign the new ID's to set 2
objectIds(tglow)     <- paste0(rn$plate_well_field, ":", rn$cell_ObjectNumber)

# Overlap the ID's
ol        <- intersect(objectIds(tglow), objectIds(tglow.new))

tglow.new <- tglow.new[ol,]
tglow     <- tglow[ol,]
```
