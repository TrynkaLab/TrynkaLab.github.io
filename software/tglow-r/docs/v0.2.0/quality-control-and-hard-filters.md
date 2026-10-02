# Setting up filters

Filters can be easily configured based on a filter table, making it easy to template sets of operations. Filters are NOT applied sequentially, but run independently. If you do want to run filters in sequentially, you will have to run successive iterations, but this is easy enough to do. An easy way to maintain filters and edit them is to store them in a google sheet and load them into R. Then using the function `tglow_filters_from_table` to create the filter objects. The filter table should have the columns described under [Filter tables](#filter-tables), and one sheet for feature level filters, and one for object level filters. The filtering is customizable using grep patterns, so you can specify which filter is applied to which features.

There are two flavors of filters:
- `filter_vec_x`: Accepts a vector and returns a logical vector of the same length (i.e. 'which objects for this feature are > 0')
- `filter_agg_x`: Accepts a vector and aggregates on a statistic and returns a single logical (i.e 'is the variance of this feature > 0')

Then there are the filter modifiers
- `filter_vec_x_sum`: Applies the filter to multiple columns, returning a logical of nrow(input), where T only if all columns for that row are T, otherwise F
- `filter_agg_x_multicol`: Applies a filter to data with multiple columns and returns a logical vector of ncol(input). To apply these at the object level (i.e. 'filter objects with >x% of NA features'), set `transpose=T` in the filter definition.

Filters return TRUE for what should be kept. Feature filters (`calculate_feature_filters()`) are called on one feature at a time, so use the base `filter_agg_x` filters there. Object filters (`calculate_object_filters()`) always receive a matrix of the selected features, so use `filter_vec_x_sum` or `filter_agg_x_multicol` with `transpose=T`.

## Filtering example

Filter objects where `_mito` features have more then 50% NA's and overall features objects have no more then 10% NA's. Another example can be found in `/vingettes/example.r`

```r
data("tglow_example")

filters <- list()
# Filter cells which have >50% NA in mitochondria features
filters[["mito.na"]]    <- new("TglowFilter",
                               name="mito.na",
                               column_pattern="_mito",
                               func="filter_agg_na_multicol",
                               threshold=0.5,
                               transpose=T)

# Filter cells which have >10% in any features
filters[["general.na"]] <- new("TglowFilter",
                               name="general.na",
                               column_pattern="all",
                               func="filter_agg_na_multicol",
                               threshold=0.1,
                               transpose=T)

res <- calculate_object_filters(tglow, filters, "raw")
```

The result is a logical matrix of objects x filters, where TRUE means the object passes. To keep only objects that pass all filters:

```r
tglow <- tglow[rowSums(res) == ncol(res), ]
```

#### Defining custom filters

You can also define custom filters at runtime by loading a new function into the global environment. Just make sure it has the following signature `function(vec, thresh, grouping=NULL)`. A feature filter receives one feature as a vector and should return a single logical.

```r
# Keep features with a mean above thresh
my_filter <- function(vec, thresh, grouping=NULL) {
  return(mean(vec, na.rm=TRUE) > thresh)
}

feature.filters <- list()
feature.filters[["my.filter"]] <- new("TglowFilter",
                                       name="my.filter",
                                       column_pattern="all",
                                       func="my_filter",
                                       threshold=0,
                                       transpose=F)

res <- calculate_feature_filters(tglow, feature.filters, assay="raw", slot="data")
```

An object filter receives a matrix of objects x selected features, plus `grouping`, and should return a logical per object. Use `filter_sum()` to apply a vector filter to each column and keep only objects that pass in all columns.

```r
my_vec_filter <- function(vec, thresh, grouping=NULL) {
  return(vec > thresh)
}

my_obj_filter <- function(vec, thresh, grouping=NULL) {
  filter_sum(vec, thresh, grouping, func=my_vec_filter)
}

object.filters <- list()
object.filters[["cell.area"]] <- new("TglowFilter",
                                      name="cell.area",
                                      column_pattern="cell_AreaShape_Area$",
                                      func="my_obj_filter",
                                      threshold=1000,
                                      transpose=F)

res <- calculate_object_filters(tglow, object.filters, "raw")
```

#### Filter tables

`tglow_filters_from_table()` picks the table columns by position. By default name is column 1, column_pattern column 2, func column 3 and threshold column 4. Set `name.col`, `col.col`, `func.col` and `thresh.col` if your layout differs. `trans.col` and `active.col` are optional. If they are not set, transpose defaults to FALSE and active to TRUE. Any other columns, such as notes, are ignored.

| Column          | Description                                                                                                                                                                    |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| name            | Filter name                                                                                                                                                                     |
| column_pattern  | What features to apply the filters to for feature filters, or what features to use to calculate the filters for object filters. The pattern 'all' is a special case that applies to all features |
| func            | The filter function, see below                                                                                                                                                  |
| threshold       | Threshold value passed to filter                                                                                                                                                |
| transpose       | Optional. If transpose is true, data are first transposed, so the columns become the objects, not the features                                                                   |
| active          | Optional. Should the filter be applied at runtime                                                                                                                               |

```r
filter.table <- data.frame(
    name      = c("NA filter", "Low variance"),
    pattern   = c("all", "all"),
    func      = c("filter_agg_na", "filter_agg_coef_var"),
    threshold = c(0.05, 0.01),
    transpose = c(FALSE, FALSE),
    active    = c(TRUE, TRUE)
)

filters <- tglow_filters_from_table(filter.table, trans.col=5, active.col=6)
res     <- calculate_feature_filters(tglow, filters, assay="raw", slot="data")

# Remove features that fail any filter (from all assays unless assays= is set)
tglow   <- apply_feature_filters(tglow, res)
```

A filter definition has no grouping. Filters that respect grouping use the `grouping=` argument of `calculate_object_filters()`, a vector with one value per object (e.g. `getDataByObject(tglow, "donor")`).

#### Available filters

Feature: works in `calculate_feature_filters()`. Object: works in `calculate_object_filters()`. The base `filter_agg_x` filters also run as object filters, but return a single value that is applied to all objects.

| filter types | description | feature | object | respects grouping |
|--------------|-------------|---------|--------|-------------------|
| filter_agg_coef_var | Absolute coefficient of variation > thresh | TRUE | | FALSE |
| filter_agg_coef_var_multicol | Coefficient of variation - multiple columns | | `transpose=T` | FALSE |
| filter_agg_inf | Number of infinite values <= thresh | TRUE | | FALSE |
| filter_agg_inf_multicol | Infinite values - multiple columns | | `transpose=T` | FALSE |
| filter_agg_inf_median | Median is not infinite | TRUE | | FALSE |
| filter_agg_inf_median_multicol | Median is not infinite - multiple columns | | `transpose=T` | FALSE |
| filter_vec_max | Value <= thresh | | single feature | FALSE |
| filter_vec_max_sum | Value <= thresh, all columns must pass | | TRUE | FALSE |
| filter_vec_min | Value >= thresh | | single feature | FALSE |
| filter_vec_min_sum | Value >= thresh, all columns must pass | | TRUE | FALSE |
| filter_vec_mod_z | Absolute modified z-score < thresh | | single feature | TRUE |
| filter_vec_mod_z_sum | Absolute modified z-score < thresh, all columns must pass | | TRUE | TRUE |
| filter_vec_mod_z_perc | Absolute modified z-score < thresh, at least a fraction `thresh2` of columns must pass. Needs `thresh2`, so it can only be called directly, not from a filter table | | | TRUE |
| filter_agg_na | Fraction of NA's <= thresh | TRUE | | FALSE |
| filter_agg_na_multicol | NA filter - multiple columns | | `transpose=T` | FALSE |
| filter_agg_unique_val | Number of unique values > thresh | TRUE | | FALSE |
| filter_agg_unique_val_multicol | Number of unique values - multiple columns | | `transpose=T` | FALSE |
| filter_agg_zero_var | Variance > thresh (default 0) | TRUE | | FALSE |
| filter_agg_zero_var_multicol | Variance - multiple columns | | `transpose=T` | FALSE |
| filter_agg_skewness | Absolute skewness > thresh | TRUE | | FALSE |
| filter_agg_skewness_multicol | Absolute skewness > thresh - multiple columns | | `transpose=T` | FALSE |
| filter_agg_kurtosis | Absolute kurtosis > thresh | TRUE | | FALSE |
| filter_agg_kurtosis_multicol | Absolute kurtosis > thresh - multiple columns | | `transpose=T` | FALSE |
| filter_agg_blacklist | Always FALSE, removes all matched features | TRUE | | FALSE |

`filter_agg_zero_var` should also be covered by `filter_agg_coef_var`.

`filter_vec_mod_z_perc` is called on a matrix of objects x features:

```r
features <- grep("cell_AreaShape", colnames(tglow$raw@data))
keep     <- filter_vec_mod_z_perc(tglow$raw@data[, features], thresh=3, thresh2=0.9,
                                  grouping=getDataByObject(tglow, "donor"))
tglow    <- tglow[keep, ]
```

::: tip
The filter tables in `/vingettes/example.r` were written for `tglow_example`. When reading data with `read_cellprofiler_parquet()`, the `cell_Neighbors_*` and `cell_Children_nucl_Count` columns are placed on `@meta` instead of the assay, so assay-based filters on them select no features and are skipped. Filter these with manual filters on `@meta` instead.
:::

## Using manual filters

It is also fully possible to manually filter things using slicing. For example to filter NA's for the cell x position on the `@meta` slot you can simply:

```r
# read_cellprofiler_parquet()
tglow <- tglow[!is.na(tglow@meta$cell_Location_Center_X),]

# read_pipeline_parquet()
tglow <- tglow[!is.na(tglow@meta$centroid_x),]
```

This will create a new dataset with the objects filtered out.

The same can work for features, but these are filtered on the assay level, as each assay can have different number of features

```r
na.features           <- colSums(is.na(tglow@assays$raw@data)) > 0
tglow@assays[["raw"]] <- tglow@assays[["raw"]][,!na.features]
```
