# Setup and staging data

## Overview

The pipeline can be configured using Nextflow options. We recommend specifying options on the command line (they override other configuration sources). See the pipeline `nextflow.config` or the `options.md` page for the full list of options.

## Step 1: Pipeline inputs

Main inputs:

- `manifest_plate.tsv`: one line per plate (tab-separated) with the following named columns: `plate`, `index_xml`, `channels`, `bp_channels`, `cp_nucl_channel`, `cp_cell_channel`, `dc_channels`, `dc_psfs`, `mask_channels`, `scaling_factors`.

- `manifest_registration.tsv` (optional): details how cyclic plates link together. Columns: `reference_plate`, `reference_channel`, `query_plates`, `query_channels`.

- `blacklist.tsv` (optional): two-column TSV (no header) with `plate` and `well` to skip.

## Step 2: Staging data

Staging converts inputs to `.ome.tiff` files, one per field, stored as `<plate_name>/<row>/<col>/<field>.ome.tiff`. Each `<plate_name>` folder gets a `manifest.tsv` index used by downstream steps.

Workflow entries:

```bash
nextflow run /path/to/repo/tglow.nf \
  -profile lsf \
  -w ./workdir \
  -resume \
  -entry stage \
  --rn_manifest manifest_plate.tsv \
  --rn_publish_dir ./output/results
```

Outputs include `.ome.tiff` files organized per plate, `<plate_name>/manifest.tsv`, optional `<plate_name>/acquisition_info.txt` and `<plate_name>/index.xml` or `index.json`.

## Option B: Manual staging

You can provide already-staged `.ome.tiff` files and a per-plate `manifest.tsv` with an index of files in the required layout. The pipeline will run from `run_pipeline` without the `stage` entry.

### Section 1 — Manual staging (required layout & OME axes)

Required layout:

- Files must be organized under: `<publish_root>/<plate_name>/<row>/<col>/<field>.ome.tiff`
- Example: `images/my_plate/A/1/1.ome.tiff`

OME-TIFF requirements:

- Each file is a single-field OME-TIFF containing the image data for that field.
- The pipeline expects the image axes to be ordered as **CZYX** (Channels, Z, Y, X). In other words, the file should expose channels first, then the Z (slices) dimension, then the Y (rows) dimension, then X (columns). Ensure the OME metadata and internal page order reflect this layout.
- Include channel names and physical pixel size (X/Y and Z) in the OME metadata when possible — these are used for scaling and channel mapping.

How to produce a correct OME-TIFF (example using `aicsimageio`):

```python
from aicsimageio import AICSImage, writers
import numpy as np

# raw shape example: (C, Z, Y, X)
data = np.zeros((4, 7, 1024, 1024), dtype='uint16')

# metadata example (channel names, physical pixel sizes)
metadata = {
  'Axes': 'CZYX',
  'Channel': [{'Name': 'DAPI'}, {'Name': 'FITC'}, {'Name': 'TRITC'}, {'Name': 'Cy5'}],
  'PhysicalSizeX': 0.149,  # microns
  'PhysicalSizeY': 0.149,
  'PhysicalSizeZ': 0.5
}

# write OME-TIFF
writers.OmeTiffWriter.save(data, 'my_plate/A/1/1.ome.tiff', dimension_order='CZYX', channel_names=[c['Name'] for c in metadata['Channel']], metadata={'PhysicalSizeX': metadata['PhysicalSizeX'], 'PhysicalSizeY': metadata['PhysicalSizeY'], 'PhysicalSizeZ': metadata['PhysicalSizeZ']})
```

#### Notes:
- Channel indexing in manifests is 1-based (e.g. `1,2,3`), but in python (and the pipeline) its 0-based
- You do not need to create the plate manifests, if missing the pipeline will index this structure itself.

### Section 2 — Staging from a Phenix or Operetta export

If you have a Revity/PerkinElmer Opera Phenix (or Operetta) export, the pipeline includes tooling to parse the export index and assemble per-field OME-TIFFs with metadata populated.

What the Phenix staging does:

- Parses the Phenix index XML to discover wells, fields, channel order, z-stack sizes and physical pixel sizes.
- Groups raw per-file TIFFs into multi-dimensional OME-TIFF files in the target layout: `<plate_name>/<row>/<col>/<field>.ome.tiff`.
- Extracts and stores channel names, pixel sizes and the original index for provenance (e.g. `index.xml` saved into the plate folder).
- Creates a copy of `index.xml` in JSON format for easier parsing.

Typical usage (pipeline `stage` entry — example):

```bash
nextflow run /path/to/repo/tglow.nf -profile local -entry stage --rn_manifest manifest.tsv --rn_publish_dir ../results/
```

#### Tips and notes:

- Stage into a separate folder.
- The OME format used can be quite a bit more efficient in terms of storage (1.5-2x) compared to the raw export, and file numbers are reduced substantially enabling usage on most fileystems.
- Validate one well/field first by running the staging entry for a small subset (use `--rn_wells`) before full staging. Check how many wells you can calculate and how large the dataset will be.
- This can be quite IO heavy, default settings for the executor limit to 40 concurrent jobs, but that could change depending on the cluster profile. You can set `exectutor.queueSize` to control the maximum number of concurrent jobs.


