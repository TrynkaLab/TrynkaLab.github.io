# Introduction to tglow object structure

The tglow package is modelled after Seurat, so users familiar with Seurat should find a broadly similar workflow. There is however a couple of differences. In TglowDatasets image level data (plate, well, number of cells etc) and object level data are kept separate (cell size, cell stain intensities etc.). This avoids having to store redundant data which is problematic for millions of cells. A full description of the TglowDataset can be found below, but in brief:

## TglowDataset

- `@assays`: list of TglowAssay's, stores feature level information, rows are objects, columns are features
- `@meta`: data.frame storing cell level metadata (id's, clusterings etc.)
- `@image.meta`: data.frame storing image level metadata (conditions, drugs, donors, well ids etc.)
- `@image.data`: TglowAssay for storing raw image features
- `@object.ids`: Character vector with the id's of the objects
- `@image.ids`: Character vector with the images each object comes from
- `@reduction`: List to store reductions (PCA, UMAP etc)

Similar to Seurat, data is stored in 'assays' of class TglowAssay. This allows to have different sets of features for the same set of cells, keeping metadata always in sync between them.

## TglowAssay

- `@data`: stores "unaltered" features
- `@scale.data`: stores features with mean 0, variance 1
- `@features`: stores data.frame with feature level metadata (stain type, name, transformations)

The data and scale data are stored as TglowMatrix objects. This is a simple wrapper around `base::matrix()` to allow the use of `$` to access features. This can be very helpful for exploratory data analysis in Rstudio as you can auto-complete feature names on the fly, without having to remember their exact names.

TglowAssays are always numeric matrices, they cannot store factors, characters etc. This type of data should go on the `@meta` slot, which is a dataframe which can store metadata.

## Metadata in TglowDataset

Metadata can be stored in two places:
- `@meta`: cell level metadata
- `@image.meta`: image level metadata

Data that is linked to an image, like timepoint, well, plate, drug treatment should be stored in `@image.meta`, as this avoids having to replicate these data for every cell that exists in the image.

Images and cells are linked together by the `@image.ids` slot, which stores the rowname of the image for each object. The ids for each cell are found in `@object.ids`.

### TglowFeatureMap

> NOTE: The `@feature.map` slot is optional, as most functions don't need it. In cases it is needed and its not there a error is thrown.

High content imaging data is often associated with grouping positional information. There is no strict object to store information for plate/row/col/field/x/y/z position to keep the package flexible between different feature analysis approaches (Cellprofiler, skimage, DINO, SubCell). Instead the `@feature.map` slot stores where to find this information. For example, for CellProfiler features, a feature.map might look like this:

```r
# Set feature map
tglow@feature.map       <- TglowFeatureMap()
tglow@feature.map@x     <- TglowFeatureLocation("cell_AreaShape_Center_X", assay="raw", slot="data")
tglow@feature.map@y     <- TglowFeatureLocation("cell_AreaShape_Center_Y", assay="raw", slot="data")
tglow@feature.map@well  <- TglowFeatureLocation("Metadata_well")
tglow@feature.map@plate <- TglowFeatureLocation("Metadata_plate")
tglow@feature.map@field <- TglowFeatureLocation("Metadata_field")
```

This tells the object that the cells X and Y position can be found in the 'raw' assay's 'data' slot in the feature 'cell_AreaShape_Center_X'. The well/plate/field information is image level metadata, so is not stored in any assay, in which case assay and slot can be left blank, it will figure out automatically where to fetch the metadata from.

# Creating a TglowDataset

> NOTE: The package comes with a bundled tglow object for testing which can be loaded with `data(tglow_example)` if you just want to play around

For this example, we will assume the following information is available. By default, checks on validity are done on all these objects, so at minimum a warning is raised if one of these does not meet assumptions.

- `objects`: A numeric matrix (not data.frame) with object level data, rows are objects, columns are imaging features. Rownames have unique object ids, colnames have unique feature ids
- `images`: A numeric matrix (not data.frame) with image level data, rows are images, columns are imaging features. Rownames have unique image ids, colnames have unique feature ids. If this is not available, you can provide a dummy matrix with zeroes.
- `image.ids`: A character vector of length `nrow(objects)` describing how rows in `images` connect to rows in `objects`. The values in this vector must match the rownames of the images.
- `object.meta` (optional): This is a optional data frame with any non-numeric/numeric metadata for each object. Must be in the same order as `objects` and assumes rownames are set to the same as `objects`, and columns are unique metadata items or imaging features, colnames must be set
- `image.meta` (optional): as `object.meta` but then paired to the `images` matrix

The minimal example to create a TglowDataset would then look as follows:

```r
# Create a tglow dataset
tglow <- TglowDatasetFromMatrices(objects, images, image.ids)

# Or with image and cell metadata and naming the assay
tglow <- TglowDatasetFromMatrices(objects, images, image.ids, object.meta, image.meta, assay.out="my_assay")
```

There is also a constructor in case you have just object level data. As TglowDatasets need an image to work, this creates a single dummy image to which all objects are tied.

```r
# Create a dataset from a matrix
tglow <- TglowDatasetFromObjectMatrix(objects)

# Or alternatively with metadata
tglow <- TglowDatasetFromObjectMatrix(objects, object.meta)
```

There are other constructors available, but as these are tied into the tglow-pipeline results format, we will not describe them here.

## Checking validity of a TglowDataset

There are a couple of assumptions made downstream to enable functionality, that might not be met if the TglowDataset is improperly constructed. Given construction is can be based on matching patterns, this can give issues sometimes if the default patterns are not appropriate for your data.

There is a utility method `isValid()` that you can use to check the key assumptions are met. The method is implemented for TglowDataset, TglowAssay, TglowMatrix and TglowReduction. When something is invalid, a warning is raised with more detailed info on what is wrong. After fixing the issue, make sure to run `isValid()` again, as it returns FALSE after encountering its first problem in the hierarchy.

> NOTE: Invalidity of an assay might not mean that anything is terribly broken depending on what it is. It might just mean that some operations like slicing a dataset do not work as expected if rownames of a reduction are not set for example. In principle, anything generated through the proper functions should yield a valid Tglow class object. If you find this is not the case, please raise an issue.

# TglowDataset structure in detail

Data is organized into a TglowDataset object, which stores image level metadata separate from the features. Features are stored in a slot called assays, which have the class TglowAssay. These are structurally similar to Seurat Assays. TglowAssay objects store the numeric cell-feature level data. Any other cell level metadata not relevant for describing biology, such as object IDs or absolute locations of a cell bounding box, should be stored on the `@meta` slot.

A single TglowDataset will always have the same objects across its assays, but assays can differ in features, making it easy to subset qc and manipulate featuresets on the same object. To subset on the image or object level, TglowDatasets can be sliced and subsetted in various ways. More details on that below.

The object structure is as follows:

*TglowDataset*
- `@assays`: list of TglowAssay's
  - TglowAssay: stores feature level information, rows are objects, columns are features
    - `@data`: Matrix with object level features
    - `@scale.data`: Scaled version of `@data` (usually mean 0 variance 1, but other options are available)
    - `@features`: data frame storing feature metadata
- `@meta`: data.frame storing cell level metadata (id's, clusterings etc.)
- `@image.meta`: data.frame storing image level metadata (conditions, drugs, donors, well ids etc.)
- `@image.data`: TglowAssay for storing raw image features
- `@image.data.trans`: TglowAssay for storing BoxCox transformed image features
- `@image.data.norm`: TglowAssay for storing normalized image features
- `@object.ids`: Character vector with the id's of the objects
- `@image.ids`: Character vector with the images each object comes from
- `@reduction`: List to store reductions
  - TglowReduction: Stores PCA/UMAP in a semi standardized format
    - `@x`: Matrix with reduction coordinates, rows are objects, columns are dimensions
    - `@sdev`: SD of the components
    - `@sdev_total`: Total standard deviations
    - `@object`: Flexible slot for storing PCA/UMAP output objects should that be needed
- `@graph`: Slot for storing the kNN graph, currently not formalized
- `@active.assay`: Name of an active assay, (currently not in use)
- `@feature.map`: Stores information of where to find the plate, well, field, x position, y position, z position
