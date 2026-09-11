# Setting up filters

Filters can be easily configured based on a filter table, making it easy to template sets of operations. Filters are NOT applied sequentially, but run independently. If you do want to run filters in sequentially, you will have to run successive iterations, but this is easy enough to do. An easy way to maintain filters and edit them is to store them in a google sheet and load them into R. Then using the function `tglow_filters_from_table` to create the filter objects. The filter table should have the following columns, and one sheet for feature level filters, and one for object level filters. Exact layouts are customizable, see the help of `tglow_filters_from_table`. The filtering is customizable using grep patterns, so you can specify which filter is applied to which features.

There are two flavors of filters:
- `filter_vec_x`: Accepts a vector and returns a logical vector of the same length (i.e. 'which objects for this feature are > 0')
- `filter_agg_x`: Accepts a vector and aggregates on a statistic and returns a single logical (i.e 'is the variance of this feature > 0')

Then there are the filter modifiers
- `filter_vec_x_sum`: Applies the filter to multiple columns, returning a logical of nrow(input), where T only if all columns for that row are T, otherwise F
- `filter_agg_x_multicol`: Applies a filter to data with multiple columns and returns a logical vector of ncol(input). If you want to apply these at the object level (i.e. 'filter objects with >x% of NA features'), make sure to set `transpose=T` in the filter definition, if you want to filter features (i.e. 'filter features with >x% of NA objects') leave `transpose=F`.

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

#### Defining custom filters

You can also define custom filters at runtime by loading a new function into the global environment. Just make sure it has the following signature `function(vec, thresh, grouping)`

```r
# Create a new filter function
my_filter <- function(vec, thresh, grouping=NULL) {
  return(vec == thresh)
}

# Add it as a filter object
filters[["my.filter"]] <- new("TglowFilter",
                               name="my.filter",
                               column_pattern="all",
                               func="my_filter",
                               threshold=10,
                               transpose=F)
```

#### Available filters

| Keyword         | Description                                                                                                                                                                    |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| name            | Filter name                                                                                                                                                                     |
| column_pattern  | What features to apply the filters to for feature filters, or what features to use to calculate the filters for object filters. The pattern 'all' is a special case that applies to all features |
| metadata_group  | Optional - Calculate filters within in a group of objects (not all filters respect this)                                                                                        |
| type            | The filter function above                                                                                                                                                       |
| value           | Threshold value passed to filter                                                                                                                                                |
| transpose       | If transpose is true, data are first transposed, so the columns become the objects, not the features                                                                            |
| note            | Place to store extra info                                                                                                                                                       |
| active          | Should the filter be applied at runtime                                                                                                                                         |

| filter types | description | respects grouping | note |
|--------------|-------------|-------------------|------|
| filter_agg_coef_var | Coefficient of variation | FALSE | |
| filter_agg_coef_var_multicol | Coefficient of variation - multiple columns | FALSE | |
| filter_agg_inf | Infinite values | FALSE | |
| filter_agg_inf_median | Infinite median value | FALSE | |
| filter_agg_inf_median_sum | Infinite median value sum. All columns must pass | FALSE | |
| filter_agg_inf_multicol | Infinite values  - multiple columns | FALSE | |
| filter_vec_max | Maximum value | FALSE | |
| filter_vec_max_sum | Maximum value sum. All columns must pass | FALSE | |
| filter_vec_min | Minimum value | FALSE | |
| filter_vec_min_sum | Minimum value sum. All columns must pass | FALSE | |
| filter_vec_mod_z | Absolute modified z-score < thresh | TRUE | |
| filter_vec_mod_z_sum | Absolute modified z-score < thresh sum. All columns must pass | TRUE | |
| filter_vec_mod_z_perc | Absolute modified z-score < thresh sum. Percentage of columns must pass | TRUE | |
| filter_agg_na | NA filter | FALSE | |
| filter_agg_na_multicol | NA filter - multiple columns | FALSE | |
| filter_agg_unique_val | Minimal number of unique values | FALSE | |
| filter_agg_unique_val_multicol | Minimal number of unique values sum. - multiple columns | FALSE | |
| filter_agg_zero_var | Exactly 0 variance | FALSE | Should also be covered by filter_coef_var |
| filter_agg_zero_var_multicol | Exactly 0 variance sum.- multiple columns | FALSE | Should also be covered by filter_coef_var |
| filter_agg_skewness | Absolute skewness > thresh | FALSE | |
| filter_agg_skewness_multicol | Absolute skewness > thresh - multiple columns | FALSE | |
| filter_agg_kurtosis | Absolute kurtosis > thresh | FALSE | |
| filter_agg_kurtosis_multicol | Absolute kurtosis > thresh - multiple columns | FALSE | |
| filter_agg_blacklist | Always FALSE | FALSE | |

## Using manual filters

It is also fully possible to manually filter things using slicing. For example to filter NA's for the feature `cell_centroid_x` on the `@meta` slot you can simply:

```r
tglow <- tglow[!is.na(tglow@meta$cell_centroid_x),]
```

This will create a new dataset with the objects filtered out.

The same can work for features, but these are filtered on the assay level, as each assay can have different number of features

```r
na.features           <- colSums(is.na(tglow@assays$raw@data)) > 0
tglow@assays[["raw"]] <- tglow@assays[["raw"]][,!na.features]
```
