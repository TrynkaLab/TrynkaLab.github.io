# Manifests & Pipeline Configuration

## Overview
The pipeline uses several sources of configuration

- **Main manifest:** contains per-plate metadata used by the image-processing steps (channels, which channels to use for background prediction, which channels to deconvolve, which PSF files to use, etc.). See example manifest: TBD
- **Registration manifest:** describes reference/query plate pairs for registering images across cycles. See example: TBD
- **Blacklist:** list of plate/well combinations to exclude from a run. See example: TBD
- **nextflow.confi** Contains system wide parameter and defualts, and lives in the repo folder
- **<my_run>.config** Lives in your instance folder and provides settings for your specific run


## Main manifest — columns & purpose

Below are the columns present in the example main manifest and what each field controls in the pipeline.

- **plate:** Plate identifier used throughout the pipeline (string).
- **index_xml:** path to an index/XML file for the plate (or `NA` if not used).
- **channels:** comma-separated list of channel indices available for this plate (e.g. `1,2,3,4`).
- **bp_channels:** channel indices used for background/flatfield estimation (background prediction).
- **cp_nucl_channel:** channel index used as the nucleus channel for Cellpose segmentation (or `none`).
- **cp_cell_channel:** channel index used as the whole-cell channel for Cellpose (or `none`).
- **dc_channels:** channel indices to feed into deconvolution (if `dc_run=true`).
- **dc_psfs:** comma-separated list of PSF file paths corresponding to `dc_channels` (order should match channels list).
- **mask_channels:** channel indices used to demultiplex nucelear vs cytoplasmic signals (if applicable).

Example (single-row, simplified):

| plate | channels | bp_channels | cp_nucl_channel | cp_cell_channel | dc_channels | dc_psfs | mask_channels |
|-------|----------|-------------|-----------------|-----------------|-------------|---------|---------------|
| 250307_185211-V | 1,2,3,4 | 1,2,3,4 | 3 | 4 | 1,2,3,4 | inputs/psfs/psf_488.tiff,inputs/psfs/psf_640.tiff,inputs/psfs/psf_375.tiff,inputs/psfs/psf_561.tiff | 1 |

Notes and tips:
- Channel indexes here are 1-indexed (as is the Phenix metadata), but the pipeline actually runs 0-indexed. I may harmonize these in future to avoid confusion.
- `none` should be used to indicate you want to skip something or its not available. 
- All plates should be defined (cycle one (reference) and subsequent cycles). You can set cp_ columns to `none` for these.
- The `dc_psfs` field must match the `dc_channels` order-by-order. If a plate has no PSFs for a channel, use `none` for that plate or omit deconvolution for that plate.
- Use `none` in cellpose fields if Cellpose should be skipped for that plate, but cellmasks are needed to progress the pipeline beyond deconvolution.

## Registration manifest — columns & purpose

- **reference_plate:** plate id used as the registration reference.
- **reference_channel:** channel index on the reference plate used to compute transforms.
- **query_plates:** plate id(s) to be registered to the reference.
- **query_channels:** channel index(s) on the query plate(s) used for registration.

Example rows in the registration file map a reference plate/channel to a query plate/channel used when aligning cycles.

## Blacklist file — format & purpose

- Format: TSV with two columns `plate<TAB>well`. Each row excludes the given well from processing for that plate.
- Use this to exclude wells with acquisition failures or severe artefacts.


## How to point the pipeline to these file

- Option A — set `params` in your instance config (recommended for repeatable runs):

```nextflow
params {
  rn_manifest = 'inputs/manifest.tsv'
  rn_manifest_registration = 'inputs/manifest_registration.tsv'
  rn_blacklist = null   // or 'inputs/blacklist.tsv'
}
```

- Option B — pass on the command line when launching Nextflow (overrides config):

```bash
nextflow run </path/to/main.nf> -profile local --rn_manifest inputs/manifest.tsv --rn_manifest_registration inputs/manifest_registration.tsv --rn_blacklist inputs/blacklist.tsv
```

## Practical notes

- The pipeline expects wells listed in the registration manifest to be present in all cycles referenced; missing wells will be ignored for registration.
- If you prefer per-plate control, you can remove wells directly from the per-plate manifest in the `rn_image_dir` instead of using a global blacklist.

**References**

- See the run/config guide for full parameter names and examples: [Configuring the pipeline](running.md)

