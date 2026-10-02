# Configuring CellProfiler

The pipeline runs your own CellProfiler pipeline (`.cppipe`) on every well.
Which features to measure is up to you. This page explains how to set up the
input modules (Images, Metadata and NamesAndTypes) so CellProfiler finds the
images and masks the pipeline gives it, and how to set up the export so the
per-plate aggregation works.

Set the pipeline in your run config:

```nextflow
params {
    cpr_run         = true
    cpr_pipeline_2d = "inputs/cellprofiler_2d.cppipe"   // 2D and hybrid mode
    cpr_pipeline_3d = null                              // 3D mode
}
```

Use `cpr_pipeline_2d` in 2D and hybrid mode (`rn_max_project` or
`rn_hybrid`), and `cpr_pipeline_3d` in 3D mode. The startup checks stop the
run if the pipeline for the chosen mode is missing.

## What CellProfiler receives

CellProfiler runs once per well, in headless mode, with a folder that
contains the images and masks of that well only:

```text
<field>_<plate>_<well>_ch<channel>.tiff      one file per field and channel
<field>_cell_mask_d<size>_ch<channel>_cp_masks.tiff
<field>_nucl_mask_d<size>_ch<channel>_cp_masks.tiff
```

For example, for field 1 of well B02 on plate `P1`:

```text
1_P1_B02_ch0.tiff
1_P1_B02_ch1.tiff
...
1_cell_mask_d00_ch0_cp_masks.tiff
1_nucl_mask_d00_ch0_cp_masks.tiff
```

- `<plate>` is the reference plate, and `<well>` is written with a
  two-digit column (`B02`).
- `<channel>` is the **final, 0-indexed channel number**: all cycles merged,
  with the nuclear/non-nuclear channels from `mask_channels` at the end. Look
  up the numbers in `rr__processed_images/unscaled/<plate>/channel_indices.tsv`
  (see [Final channel numbers](manifests-and-configuration.md#final-channel-numbers)).
- Images are 16-bit, one channel per file: YX in 2D and hybrid mode, ZYX in 3D mode.
- Masks are label images: every cell (or nucleus) has its own number, and 0 is background.

Because every run contains a single well, the field number is enough to
group the files of one image set.

## Images module

Only the image files are needed, so keep the default filter that selects TIFF
files and skips hidden folders:

```text
Filter images?: Custom
Select the rule criteria: and (extension does istif) (directory doesnot containregexp "[\\/]\.")
```

## Metadata module

Set **Extract metadata?** to **Yes** and add two extraction methods, both
**Extract from file/folder names** with **File name** as the source: one
for the masks and one for the channel images.

**1. Masks**, applied to all images (the pattern only matches mask files):

```text
Regular expression to extract from file name:
^(?P<field>\d+)_(?P<mask_type>.*_mask)_d\d+_ch\d+_cp_masks.tif

Extract metadata from: All images
```

This gives each mask a `field` and a `mask_type` of `cell_mask` or `nucl_mask`.

**2. Channel images**, applied to files that are not masks:

```text
Regular expression to extract from file name:
^(?P<field>\d+)_(?P<plate>.*)_(?P<well>\w\d\d)_ch(?P<channel>\d+)

Extract metadata from: Images matching a rule
Select the filtering criteria: and (file doesnot contain "mask")
```

This gives each image a `field`, `plate`, `well` and `channel`.

Both patterns extract `field`, which is what links the channel images and
masks of one field together in NamesAndTypes.

## NamesAndTypes module

Assign a name to **Images matching rules**, with one rule per channel you
want to use and one per mask:

| Rule | Name | Image type |
|---|---|---|
| `(metadata does channel "0")` | for example `dna` | Grayscale image |
| `(metadata does channel "1")` | for example `mito` | Grayscale image |
| ... | one rule per channel | Grayscale image |
| `(metadata does mask_type "cell_mask")` | `cell_img` | Grayscale image |
| `(metadata does mask_type "nucl_mask")` | `nucl_img` | Grayscale image |

Then set:

- **Image set matching method:** Metadata, matching on `field` for every
  name. This makes one image set per field, containing all its channels
  and both masks.
- **Set intensity range from:** Image metadata. CellProfiler then scales the
  16-bit images to 0 to 1 by dividing by 65535, the same for every image, so
  intensities stay comparable between wells and plates.
- **Process as 3D?:** No in 2D and hybrid mode. In 3D mode, set it to Yes and
  set the relative pixel spacing in X, Y and Z to match your images.

You don't need a rule for every channel: channels without a rule are ignored.
Check `channel_indices.tsv` to make sure each rule points at the right stain,
especially for later cycles and mask channels, whose numbers depend on the
number of channels in the earlier cycles.

## Turning masks into objects

The masks are loaded as images, so convert them into objects with
**ConvertImageToObjects**, one module per mask:

```text
Select the input image: cell_img
Name the output object: cell_raw
Convert to boolean image: No
Preserve original labels: Yes
```

and the same for `nucl_img`. **Preserve original labels** keeps Cellpose's
numbering, so each object is the exact mask the pipeline made. Use these
objects as the starting point of your analysis, instead of segmenting again
in CellProfiler. Makse sure to use RelateObjects to parent nuclei to their cell.
See the note below. 

::: warning FilterObjects renumbers objects
The numbering is only kept until objects are filtered. **FilterObjects**
renumbers the objects it keeps to run from 1 up to the number of objects
left, so after filtering, an object's number no longer matches its Cellpose
label. For example, if cell 2 of `cell_raw` is removed, cell 3 becomes cell 2
in `cell`. The original number is kept in the `Parent_cell_raw` column of the
filtered object. Use that column, not `ObjectNumber`, to match cells back to
the masks.
:::

## Objects and export for the aggregation step

After CellProfiler, the pipeline combines the output of all wells into one
table of cells and one table of images per plate
(`rr__features/cellprofiler/<plate>_cells.parquet` and `<plate>_image.parquet`,
see [Features](understanding-output.md#features)). This needs a few
conventions:

1. **Name the final cell object `cell`.** Its export file (`*_cell.txt`) is
   the table every other object is merged onto. For example, filter
   `cell_raw` with FilterObjects (such as removing cells at the image border)
   and name the result `cell`.
2. **Relate every other object you export to `cell`** with RelateObjects
   (parent `cell`). This adds the `Parent_cell` column that links each
   sub-object to its cell. When a cell has several sub-objects of one type
   (for example several mitochondria), their values are combined with
   `cpr_merge_strategy` (default `mean`).
3. **Use object names of letters, optionally followed by digits**, without
   underscores, for example `nucl`, `cyto`, `memb` or `mitoNetwork`. The
   export file name ends in `_<object>.txt`, and the aggregation takes the
   part after the last underscore as the object name
   (`cpr_child_pattern`). Intermediate objects, such as `cell_raw`, can use
   any name as long as you don't export them.
4. **Export with ExportToSpreadsheet** to the default output folder, with a
   **Tab** column delimiter. The pipeline sets the output folder, and zips the
   `.txt` files per well. Export the `Image` table as well: the aggregation
   needs both `*_cell.txt` and `*_Image.txt`, and skips wells where either is
   missing.

Files named `*_Experiment.txt` and object relationship files are ignored.

::: tip Export each child object type to its own file
The aggregation expects every child object type (such as `nucl`, `cyto` or
`mito`) to be exported to its own file, and merges it onto the cells itself.

In principle, CellProfiler's own per-parent means (the **Calculate per-parent
means for all child measurements?** option of RelateObjects) also work if
set up correctly. The means then arrive as ordinary columns of the cell
table (prefixed `cell_` like every other cell column). The pipeline doesn't
know they came from child objects, so they don't get their own object
prefix and `cpr_merge_strategy` doesn't apply to them.
:::

A minimal chain for a cell with a nucleus and cytoplasm looks like this:

```text
ConvertImageToObjects   cell_img -> cell_raw   (preserve labels)
ConvertImageToObjects   nucl_img -> nucl       (preserve labels)
FilterObjects           cell_raw -> cell       (e.g. drop cells at the border)
MaskObjects             cell, masked by nucl (inverted) -> cyto
RelateObjects           parent cell, child nucl
RelateObjects           parent cell, child cyto
Measure...              your measurements on cell, nucl and cyto
ExportToSpreadsheet     Image, cell, nucl, cyto
```

For optimal compatibility with tglow-r use object name 'cell' for the main object, and 'nucl' for nucleus, 'cyto' for cytoplasm, 'memb' for membrane, 'mito' for individually segmented mitochondria and 'mitoNetwork' for the single fused segmantation of mitochondria. This ensures redundant features like their counts (always 1 per cell for some of these) are dropped by default.  

## Building and testing your pipeline

To build the pipeline in the CellProfiler GUI, you need a folder with the
files exactly as the pipeline stages them. The easiest way is a test run on
one well that keeps its work files:

```bash
tglow-pipeline run_pipeline -c my_run.config -- --rn_wells B02 --rn_scratch false
```

Find the CellProfiler task of that well in the trace file (see
[Debugging](running.md#debugging)), and open
`images/<plate>/<row>/<col>/` in its work directory in CellProfiler. Use it
to set up and check the input modules: the metadata columns should show a
`field`, `plate`, `well` and `channel` for every image, and a `field` and
`mask_type` for every mask, and NamesAndTypes should report one complete
image set per field.

Save the pipeline as a `.cppipe` file, and set `cpr_pipeline_2d` (or
`cpr_pipeline_3d`) to it. CellProfiler plugins can be placed in the folder
set by `cpr_plugins`.
