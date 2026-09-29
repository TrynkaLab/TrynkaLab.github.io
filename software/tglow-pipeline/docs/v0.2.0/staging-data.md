# Staging data

`run_pipeline` reads its images from `rn_image_dir` (default
`../results/images`), in which every field is one OME-TIFF:

```text
<rn_image_dir>/<plate>/<row>/<col>/<field>.ome.tiff
```

The row is a letter and the column a number without padding, for example
`images/P1/A/1/1.ome.tiff`. Each file holds all channels and planes of the
field as a **CZYX** array (channels, Z planes, Y, X).

There are two ways to get your images into this layout:

- **Option A:** use the `stage` workflow to convert a Revity/PerkinElmer
  (Opera Phenix or Operetta) export.
- **Option B:** convert the images yourself.

## Option A: staging a Phenix or Operetta export

The `stage` workflow reads the export's index file and writes one OME-TIFF
per field, with the channel names and pixel sizes in the OME metadata.

### Inputs

Staging uses only the `plate` and `index_xml` columns of the
[main manifest](manifests-and-configuration.md#main-manifest). `index_xml` is
the path to the `Index.xml` or `Index.idx.xml` of the export; the raw images
are read from the same folder. You can already fill in the other columns;
they are used by `run_pipeline`.

Wells in the blacklist (`rn_blacklist`) are skipped. `rn_wells` is not
used by staging.

### Running

```bash
nextflow run </path/to/main.nf> \
  -profile lsf \
  -w ../workdir \
  -resume \
  --workflow stage \
  --rn_manifest inputs/manifest.tsv \
  --rn_image_dir ../results/images
```

Or with the runner script: `tglow-pipeline stage -c my_run.config`.

Staging runs three steps: `prepare_manifest` parses the index file of each
plate, `parse_fieldmatrix` records the field layout, and `fetch_raw`
converts the images of each well (resource label `st_label`).

### Output

For each plate in `rn_image_dir`:

| File | Contents |
|---|---|
| `<row>/<col>/<field>.ome.tiff` | The images, as CZYX OME-TIFFs. |
| `<row>/<col>/CHECKSUMS.txt` | MD5 checksums of the images of the well. |
| `manifest.tsv` | Index of the wells of the plate, used by `run_pipeline`. |
| `Index.xml` / `Index.idx.xml` | A copy of the original index file. |
| `Index.json` | The index file converted to JSON, for easier parsing. |
| `acquisition_info.txt` | A readable summary of the acquisition: channels, objective, pixel sizes, plate and timings. |
| `field_matrices/` | How the fields are laid out spatially in a well. |

Plates are named after the `plate` column of the manifest, not the name in
the index file. The original name is kept in `Index.json`.

### Tips

- Stage into a separate folder from the raw export.
- The OME-TIFF layout is usually 1.5 to 2 times smaller than the raw
  export, and has far fewer files, which works on most filesystems.
- Test on a single plate first (a manifest with one row), to check the
  output and estimate how long staging will take and how much space it needs.
- Staging is IO-heavy. The `lsf` profile limits the number of concurrent
  jobs to 40. Set `executor.queueSize` in your config to change this.

## Option B: staging images yourself

If your images don't come from a Phenix or Operetta, convert them yourself
into the layout above and point `rn_image_dir` to it. Then start directly
with `run_pipeline`.

Requirements:

- One OME-TIFF per field, at `<plate>/<row>/<col>/<field>.ome.tiff`.
- The image is a **CZYX** array, as 16-bit unsigned integers. 2D images have a Z size of 1.
- Every field of a plate has the same channels in the same order.
- Include the channel names and physical pixel sizes in the OME metadata when possible.

You don't need to create the `manifest.tsv` of each plate: if it is missing,
the pipeline indexes the folder structure itself.

The pipeline uses [bioio](https://github.com/bioio-devs/bioio) to read and
write images. You can use it to write compatible files:

```python
import numpy as np
from bioio_ome_tiff.writers import OmeTiffWriter
from bioio_base.types import PhysicalPixelSizes

# Image data for one field: (C, Z, Y, X)
data = np.zeros((4, 7, 1024, 1024), dtype="uint16")

OmeTiffWriter.save(
    data,
    "images/my_plate/A/1/1.ome.tiff",
    dim_order="CZYX",
    channel_names=["DAPI", "FITC", "TRITC", "Cy5"],
    # Pixel sizes in microns, in Z, Y, X order
    physical_pixel_sizes=PhysicalPixelSizes(0.5, 0.149, 0.149),
)
```

Alternatively, the `AICSImageWriter` class in
[tglow-core](https://trynkalab.github.io/software/tglow-core/) writes stacks
straight into the plate/row/col/field layout.
