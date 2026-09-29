# API reference

Public classes and functions in `tglow-core` v0.2.0, grouped by module, with their
arguments and default values. Descriptions are the first paragraph of each
docstring; entries without one are listed with their signature only. Names
starting with an underscore are omitted, as are the `tglow.qc` modules, which
are internal to the `tglow-pipeline` QC report.

Import from the full module path, for example:

```python
from tglow.io.tglow_io import AICSImageReader
from tglow.utils.tglow_utils import rescale_stack
```

## `tglow.io.compound_image_provider`

### `memory_usage`

```python
memory_usage()
```

### class `CompoundImageProvider`

| Method | Description |
|---|---|
| `__init__(path, nimg, channel, blacklist=None, plates=None, fields=None, planes=None, pseudoreplicates=0, merge_n=1, max_project=False, all_planes=False)` |  |
| `fetch_training_images()` |  |
| `fetch_compound_image_mean_max(max_project=False)` |  |
| `fetch_compound(sample_n)` |  |
| `fetch_image(q)` |  |

## `tglow.io.image_query`

Small utility for representing a plate/well/field/channel/plane query.

### class `ImageQuery`

Container for plate/row/col/field/channel/plane identifiers.

| Method | Description |
|---|---|
| `__init__(plate, row, col, field, channel=None, plane=None)` |  |
| `@classmethod from_plate_well(plate, well)` | Create an `ImageQuery` from a plate id and a well string (e.g. 'A01'). |
| `get_well_id()` | Return a string well id, e.g. 'A01'. |
| `get_row_letter()` | Return the alphabetical row label for `row` (e.g. 'A'). |
| `well_id_to_index(well_id) -> tuple` | Convert a well id string (e.g. 'A01') to a (row, col) tuple. |
| `to_relpath()` |  |
| `to_string()` | Return a compact string representation of the query. |

## `tglow.io.perkin_elmer_parser`

### class `PerkinElmerParser` (object)

Parse PerkinElmer Index XML into a easy to access dictionary

| Method | Description |
|---|---|
| `__init__(index_path, new_name=None)` |  |
| `estimate_pixel_sizes()` | Extracts the pixel sizes from a PE index xml in (z, y, x) and returns in in microns Returns none if could not be estimated |
| `parse_channels_from_images()` |  |
| `parse_channels()` | Get PE channels |
| `parse_planes()` | Get PE planes as a sorted list |
| `parse_images()` | Get all PE images |
| `parse_plate(new_name=None)` | Get all PE Plate |
| `parse_wells()` | Get all PE Wells |
| `parse_flatfields(use_background=False, channel=None)` |  |
| `reconstruct_flatfield_image(channel_data)` |  |
| `save(output_path)` |  |
| `write_manifest(output_path)` |  |

## `tglow.io.processed_image_provider`

Higher-level processed image provider.

### class `ProcessedImageProvider`

Builds processed image stacks for a plate.

| Method | Description |
|---|---|
| `__init__(path, plate, blacklist=None, plate_merge=None, registration_dir=None, flatfields=None, scaling_factors=None, mask_channels=None, mask_dir=None, mask_pattern=None, uint32=False, verbose=True, scaling_slope=0.001, scaling_bias=None)` |  |
| `build_channel_index()` | Construct a pandas DataFrame describing output channels. |
| `fetch_image(iq)` | Fetch and return a processed image stack for the provided `ImageQuery`. |
| `fetch_registration(iq) -> dict` | Load registration matrices for a well from the registration directory. |
| `get_wells()` | Return the set of wells indexed for the main plate. |
| `write_channel_index(output)` | Write `channel_index` to `output/<plate>/channel_indices.tsv`. |

## `tglow.io.tglow_io`

I/O helpers for tglow: readers, writers and index helpers.

### class `NamedImageQuery` (ImageQuery)

Image query with an index that convers string names to indices

| Method | Description |
|---|---|
| `__init__(index, plate, row, col, field, channel=None, plane=None)` |  |

### class `IndexedImageReader`

Read raw image data from a dictionary of /plate/row/col/field/channel/plane/path_to_file.tiff

| Method | Description |
|---|---|
| `__init__(index, path, dtype=np.uint16, resolution=None) -> None` | Prefix path to the subpaths in index |
| `get_image(query) -> np.ndarray` | Get a single image |
| `read_stack(query) -> np.ndarray` | Read an image stack into a CZYX array |
| `get_filenames(query) -> list` | Get the filenames associated with an image query in the order they are read |
| `get_channel_order() -> list` |  |
| `get_plane_order() -> list` |  |

### class `PerkinElmerRawReader` (IndexedImageReader)

Read raw image data from a PerkinElmer export or from a re-formatted output as long as it has an index file

| Method | Description |
|---|---|
| `__init__(index_xml, path, new_name=None, dtype=np.uint16) -> None` |  |

### class `AICSImageReader`

Reads image data from ome tiffs in a folder structure /plate/row/col/field.ome.tiff where field.ome.tiff is a CZYX array

| Method | Description |
|---|---|
| `__init__(path, plates_filter=None, fields_filter=None, blacklist=None, dtype=np.uint16, resolution=None, pattern=None) -> None` |  |
| `get_wells(plate)` |  |
| `get_img(query)` |  |
| `get_fields(query)` |  |
| `read_image(query) -> np.ndarray` | Get a single image |
| `read_stack(query) -> np.ndarray` | Read an image stack into a CZYX array |

### class `BlacklistReader`

| Method | Description |
|---|---|
| `__init__(path, sep='\t')` |  |
| `read_blacklist(separator=':')` | Read a simple blacklist file and return entries joined with `separator`. |
| `read_blacklist_as_prc(separator='/')` | Read the blacklist and return entries in 'plate/row/col' form. |

### class `ControlRecord`

| Method | Description |
|---|---|
| `__init__(plate, well, channels, name)` |  |
| `get_row_col()` | Return (row, col) for the control well. |
| `get_rowchar()` | Return the row letter for the control (e.g. 'A'). |
| `get_query(field)` | Return an `ImageQuery` for this control at the given `field`. |

### class `ControllistReader`

| Method | Description |
|---|---|
| `__init__(path, plates_filter=None, blacklist=None, sep='\t')` |  |
| `read_controlist()` | Read a control list TSV and return `ControlRecord` objects. |

### class `AICSImageWriter`

Writes image data from ome tiffs in a folder structure /plate/row/col/field.ome.tiff where field.ome.tiff is a CZYX array

| Method | Description |
|---|---|
| `__init__(path, channel_names=None, physical_pixel_sizes=None, skip_imagestats=False) -> None` |  |
| `write_stack(stack, query, channel_names=None, physical_pixel_sizes=None, image_names=None, stats_only=False)` | Write a CZYX array into the folder structure |
| `write_image_stats(query)` |  |

## `tglow.utils.tglow_plot`

### `composite_images`

```python
composite_images(imgs, equalize=False, aggregator=np.mean)
```

### `plot_registration_imgs`

```python
plot_registration_imgs(before, after, filename)
```

### `plot_grey_as_magma`

```python
plot_grey_as_magma(image, filename)
```

### `plot_blobs`

```python
plot_blobs(image, filename, blobs)
```

### `plot_histogram`

```python
plot_histogram(data, filename, bins=30, title='Histogram', xlabel='Value', ylabel='Frequency')
```

Create and save a histogram to a file.

### `plot_histogram_df`

```python
plot_histogram_df(data, filename, bins=30, title_prefix='Histogram', xlabel='Value', ylabel='Frequency', ncols=3)
```

Create and save histograms for each column in a pandas DataFrame with mean and median lines.

## `tglow.utils.tglow_utils`

Utility helpers for tglow.

### class `NpEncoder` (json.JSONEncoder)

JSON encoder that understands numpy types.

| Method | Description |
|---|---|
| `default(obj)` |  |

### `get_channel_channel_info`

```python
get_channel_channel_info(index_xml) -> dict
```

Extract channel metadata from a PerkinElmer `Index.xml` file.

### `build_well_index`

```python
build_well_index(upper=True, invert=False, rows_as_string=False) -> dict
```

### `default_to_regular`

```python
default_to_regular(d)
```

Convert nested defaultdicts into regular dicts recursively.

### `float_to_16bit_unint_scaled`

```python
float_to_16bit_unint_scaled(matrix, max_value) -> np.array
```

Scale and convert a float matrix into uint16 using a provided max.

### `float_to_16bit_unint`

```python
float_to_16bit_unint(matrix) -> np.array
```

### `float_to_16bit_unint_inplace`

```python
float_to_16bit_unint_inplace(matrix)
```

In-place conversion of floats to uint16 with rounding and clipping.

### `float_to_32bit_unint`

```python
float_to_32bit_unint(matrix) -> np.array
```

### `dict_to_str`

```python
dict_to_str(dict)
```

Return a compact string describing a dict's keys and value types.

### `write_bin`

```python
write_bin(matrix, file)
```

Write a numeric matrix to a simple binary format.

### `apply_registration`

```python
apply_registration(stack, alignment_matrix)
```

Apply a 2D affine transformation to a 2D/3D/4D image stack.

### `apply_registration_cv`

```python
apply_registration_cv(stack, alignment_matrix)
```

### `sigmoid`

```python
sigmoid(x, slope, bias)
```

### `sigmoid_params`

```python
sigmoid_params(x1, x2, tol=1e-06)
```

Compute the bias and slope for a logistic sigmoid given two x points and a tolerance.

### `rescale_stack`

```python
rescale_stack(stack, factors, slopes=None, biases=None, verbose=True)
```

Apply per-channel scale factors (optionally sigmoid-weighted) to a CZYX stack, returned as a new float32 array.

### `rescale_stack_inplace`

```python
rescale_stack_inplace(stack, factors, slopes=None, biases=None, verbose=True)
```

Apply per-channel scale factors (optionally sigmoid-weighted) to a CZYX stack in place, returned as float32.

### `load_flatfield_profile`

```python
load_flatfield_profile(model_dir)
```

Read the flatfield/darkfield/baseline arrays from a `BaSiC.save_model` directory.

### `save_flatfield_profile`

```python
save_flatfield_profile(model_dir, flatfield, darkfield, baseline=None, overwrite=False)
```

Write flatfield/darkfield/baseline arrays in the same on-disk format as `BaSiC.save_model`.
