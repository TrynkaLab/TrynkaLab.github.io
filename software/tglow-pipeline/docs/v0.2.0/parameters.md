# Parameters

All pipeline parameters for v0.2.0, grouped by section. Set them in the `params {}` block of your run config (`-c my_run.config`) or on the command line as `--<name> <value>`. Command line values override the config file.

Defaults are taken from the pipeline's `nextflow.config`; an empty default means the parameter is unset (`null`). Descriptions come from `nextflow_schema.json`, or from the comments in `nextflow.config` where the schema has none.

> The pipeline rejects unknown parameter names at startup, so renamed parameters from v0.0.1-beta (for example `bp_*` or `tg_*`) cause an error rather than being silently ignored. See the [changelog](changelog.md) for the renames.

## Pipeline

Guide: [Running](running.md)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `workflow` | string |  | Which entry workflow to run: 'stage' (fetch raw data from NFS and recode into the OME file structure) or 'run\_pipeline' (the main processing pipeline). Replaces the old `-entry` CLI flag, which is no longer supported under Nextflow's strict syntax parser. |
| `rn_skip_checks` | boolean | `false` | Skip parameter checks, useful for testing |
| `rn_manifest` | string |  | Path to the main manifest TSV (one row per plate). Required. Columns: `plate`, `index_xml`, `ff_channels`, `cp_nucl_channel`, `cp_cell_channel`, `dc_psfs`, `mask_channels`; see [Manifests and configuration](manifests-and-configuration.md). |
| `rn_blacklist` | string |  | Path to a headerless two-column TSV (`plate`, `well`) listing wells to exclude, for example failed acquisitions or single-stain controls. Leave unset to run all wells. |
| `sc_control_list` | string |  | Path to a TSV with columns `plate`, `well`, `control_type` naming the control wells used to estimate plate offsets and fit sigmoids. Optional; without it plate-offset correction is skipped. Requires `sc_autoscale = true` and `sc_channel_map`. See [Scaling](scaling.md). |
| `sc_channel_map` | string |  | Path to the channel map TSV that configures scaling per channel and which mask (`cell` or `nucleus`) `measure_intensity` uses per channel. Optional; if unset, a dynamic-range-only map is built from `sc_autoscale_q1`. See [Manifests and configuration](manifests-and-configuration.md#channel-map) and [Scaling](scaling.md). |
| `rn_manifest_well` | string |  | Optional comma-separated list of per-plate well manifests (`/path/to/plate1_manifest.tsv,...`) restricting which wells run. Leave unset to build them from the staged folder structure. |
| `rn_manifest_registration` | string |  | Registration manifest This dictates which plates will be merged and registered. If left to null no merging or registration is performed |
| `rn_publish_dir` | string | `../results` | Directory to store and cache the output. Generally name results |
| `rn_image_dir` | string | `../results/images` | Permanent cache for images [optional] Defaults to: ../results/images (relative to launch dir, independent of rn\_publish\_dir) |
| `rn_decon_dir` | string | `../results/decon` | Permanent cache for deconvolutions [optional] Defaults to: ../results/decon (relative to launch dir, independent of rn\_publish\_dir) |
| `rn_max_project` | boolean | `false` | Max project prior to running segmentation and cellprofiler Decon is still done in 3d, but results are saved as max projections. |
| `rn_hybrid` | boolean | `false` | Run in hybrid 2d/3d mode. Masks and decon run and saved in 3d but only cellprofiler is run using max projections. In true ignores rn\_max\_project. Must be true to enable demultiplexing of nuclear and non-nuclear signals. |
| `rn_wells` | string |  | Select only these wells, useful for testing [optional] comma separated string of well ids: A06,B19,C22 |
| `rn_scratch` | boolean | `true` | Use scratch space for most workdir operations, which saves IO load on networked filesystems. But this makes debugging harder as tmp results are not available |
| `rn_cache_images` | boolean | `true` | Cache the final output images (flatfield, decon, demultiplexed, registered, scaled, max\_projected) They are saved as plate/row/col/field.ome.tiff in CZYX with additional cycle channels sequentially added. If storage is a concern, disable this and enable rn\_scratch to not save large intermediates. NOTE: When mode is hybrid or max project, the storage this generates will not be that bad, so it’s enabled by default. NOTE: This must be true when running subcell, but as subcell only works with max projected images, the storage overhead should be ok NOTE: These are not directly compatible with cellprofiler when working in 3d as they are saved in .ome.tiff for pipeline compatibility, which CPR does not handle. Prior to running cellprofiler they are split up into &lt;field&gt;&lt;plate&gt;&lt;well&gt;\_ch&lt;channel&gt;.tiff which is compatible with both 2d and 3d formats. Use this pattern to set up your pipeline. |
| `rn_make_cellcrops` | boolean | `true` | Produce h5 files with cellcrops |
| `rn_max_per_field` | integer | `1000` | When making cellcrops, if there are more then this many cells per field, skip the field |
| `rn_conda_env` | string | *site-specific path* | Tglow conda env path |
| `rn_container` | string |  | Container for the tglow environment |

## Staging

Guide: [Staging data](staging-data.md)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `st_label` | string | `small_img` | Resource label for staging |

## Flatfield

Guide: [Understanding output](understanding-output.md#flatfield-estimation)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `ff_run` | boolean | `true` | Run flatfield estimation or not. Overrides the manifest |
| `ff_global_flatfield` | boolean | `false` | Fit one flatfield per plate-channel, or one global flatfield per channel shared among the plates of a cycle |
| `ff_label` | string | `himem` | Resource label for flatfield estimation |
| `ff_mode` | string | `POLY` | Mode, one of BASICPY, POLY or PE |
| `ff_threshold` | boolean | `false` | Should images be thresholded prior to fitting, so only foreground pixels are used (see ff\_threshold\_mode). Helpful in sparse images but can throw off valuation if strong flatfield not handled well or outliers exist. In BASICPY mode a plain Otsu mask is supplied as fitting\_weights to fit only actual signal avoiding background fitting. In POLY the polynomial is fit on foreground pixels only. |
| `ff_threshold_mode` | string | `otsu_log` | Threshold used with ff\_threshold for POLY fitting and the validation images. 'otsu\_log': Otsu on log intensities after flooring low values (same as sc\_debris\_method Otsu\_log). 'otsu': 2 class Otsu divided by 4, more lenient but lets background through when the signal is dim. |
| `ff_bin_stat` | string | `mean` | [POLY only] Summarise the thresholded images into one value per ff\_bin\_size bin, pooling the foreground pixels of all images, and fit the polynomial on those bins with equal weight. 'mean': smoothest fit. 'median': ignores bright outliers (debris) but noisier. 'trimmed': mean after dropping ff\_bin\_trim from each end per bin. 'none': previous behaviour, fit on 4x4 block means of every image. |
| `ff_bin_size` | integer | `20` | [POLY only] Bin edge in px for ff\_bin\_stat, must evenly divide the image size (20 gives 108x108 bins at 2160 px). |
| `ff_bin_trim` | number | `0.1` | [POLY only] Fraction dropped from each end within a bin when ff\_bin\_stat is 'trimmed'. |
| `ff_bin_min_pixels` | integer | `50` | [POLY only] Bins with fewer foreground pixels, pooled over all images, are left out of the fit. |
| `ff_degree` | integer | `0` | Degree for polynomial (2-4 recommended). If &lt;=0 special polynomial model used same as PE Harmony fits, else numpy.polynomial.polynomial.polyvander2d used to generate design matrix with all combinations of x^i\*y^i. Higher degrees more likely to overfit. |
| `ff_channels` | string |  | Channels to fit basicpy models on, leave null to run all channels specified in manifest (recommended). To not run basicpy for a plate, set channels to "none". Otherwise specify [[&lt;plate&gt;,&lt;channel&gt;,&lt;index\_xml&gt;],...] to override manifest. &lt;channel&gt; is 0-indexed, same as the manifest's own ff\_channels column. |
| `ff_nimg` | integer | `200` | Number of random images to read into memory. Sampled with replacement. If no other option specified, this is number of images flatfield is trained on. |
| `ff_nimg_test` | integer | `100` | Number of images for independent sampling used for testing flatfield. Set 0 to skip flatfield evaluation. |
| `ff_seed` | integer | `42` | Seed for the random image sampling used in flatfield estimation, so flatfields are reproducible between runs. Set null to leave it unseeded. |
| `ff_merge_n` | integer |  | Number of images to max project into a compound — nimg times. If &gt;1 basicpy run on nimg images each compound of merge\_n images. Set null to run vanilla basicpy with no merging. Useful if low density images and flatfields tend to background signal rather than foreground. Recommended ff\_nimg=100 and ff\_merge\_n=50 starting point but mileage varies. WARNING: samples same images into different compounds so some overlapping. |
| `ff_pseudoreplicates` | integer |  | Pseudoreplicate in memory related to merge\_n but instead of disk I/O only nimg images read then pseudoreplicate compound images of size merge\_n made. Sampling with replacement and overlaps possible. Goal similar to merge\_n but avoids major IO load. Recommended to set nimg high to reduce overlap. |
| `ff_pseudoreplicates_test` | integer |  | Same as ff\_pseudoreplicates but for flatfield evaluation |
| `ff_use_ridge` | boolean | `false` | Use ridge regression instead of OLS to fit polynomial. Uses RidgeCV and 10 fold CV to find optimal alpha |
| `ff_all_planes` | boolean | `false` | Instead of randomly picking one plane for a stack, use all planes. Can cause issues with basicpy as it assumes random variation between images. When rn\_max\_project true all planes are read and max projected so not an issue. Not recommended. |
| `ff_autosegment` | boolean | `false` | Apply basicpy autosegment option, opposite of threshold, applies mask erosion. Not recommended, basicpy only. |
| `ff_no_tune` | boolean | `false` | Do not tune basicpy model. Not recommended, basicpy only. |

## Registration

Guide: [Understanding output](understanding-output.md#registration)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `rg_mode` | string | `CROSS` | Mode use skimage phase cross correlation or pystackreg with translation. CROSS or STACKREG. Currently STACKREG is disabled. |
| `rg_label` | string | `small` | Resource label for registration |
| `rg_offset_x` | string |  | Offset in X. Positive shifts down (scipy.ndimage.shift convention) |
| `rg_offset_y` | string |  | Offset in Y. Positive shifts down (scipy.ndimage.shift convention) |
| `rg_eval` | boolean | `true` | Evaluate registration results with pearson correlation between registration channels. Useful if many signals as images mostly noise. TODO: Threshold image first then correlate |
| `rg_plot` | boolean | `true` | Run only if registration manifest provided. Make before/after images of registration results |

## Deconvolution

Guide: [Understanding output](understanding-output.md#deconvolution)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `dc_label` | string | `gpu_normal` | Resource label for deconvolution |
| `dc_run` | boolean | `false` | Run deconvolution or not |
| `dc_niter` | integer | `100` | Number of iterations to run Richardson Lucy deconvolution for |
| `dc_psf_crop_z` | integer |  | Number of planes around PSF center to use for decon. Defaults to all in PSF |
| `dc_psf_subsample_z` | integer |  | Select every x planes starting from PSF center. Useful if PSF image has higher z resolution than actual image. For example PSF 100nm spacing and image 500nm spacing set this to 5. dc\_psf\_crop\_z is applied after this. |
| `dc_mode` | string | `clij2_nc` | Implementation of Richardson Lucy to use. Options: clij2 - clij2-fft richardson\_lucy clij2\_nc - clij2-fft non circulant richardson\_lucy rlf\_cpu - RedLionFish CPU mode rlf\_gpu - RedLionFish GPU mode RedLionFish not recommended when strong edges in data |
| `dc_regularization` | number | `0.0002` | Regularization parameter for Richardson Lucy. Only used for clij2 and clij2\_nc modes. Default recommended. See https://forum.image.sc/t/richardson-lucy-deconvolution-large-images/85325/7 and https://pubmed.ncbi.nlm.nih.gov/24436314/ |
| `dc_clip_max` | integer | `327675` | Pixel value clip after deconvolution in 32-&gt;16 bit conversion. new\_intensity=round((intensity/dc\_clip\_max)65535) Default 565535=327675. Values lower preserved but may lose precision. Value above clip to 65535 in 16bit output. Set 65535 to clip everything outside 16bit range but preserve dynamic range. Set &gt; 65535 to scale values down but keep dynamic range upper end. Keep consistent between runs to interpret intensities correctly. |

## Segmentation

Guide: [Understanding output](understanding-output.md#segmentation)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `cp_run` | boolean | `true` | Run cellpose or not (will stall the pipeline at downstream steps that need masks) |
| `cp_label` | string | `gpu_normal_plus` | Resource label for cellpose |
| `cp_cell_size` | integer | `75` | Estimated cell size for cellpose in pixels. Default is a reasonable estimates for T cells at 0.149um pixel size |
| `cp_nucl_size` | integer | `60` | Estimated nucleus size for cellpose in pixels. Default is a reasonable estimates for T cells at 0.149um pixel size. |
| `cp_min_cell_area` | string |  | Cellpose min cell area in pixels. Minimal area of ROIs. If null defaults to π (1/6th cp\_cell\_size)^2 for 2d or 4/3π (1/6th cp\_cell\_size)^3 for 3d. |
| `cp_min_nucl_area` | string |  | Cellpose min nucleus area in pixels. Minimal area of ROIs. If null defaults to π (1/6th cp\_nucl\_size)^2 for 2d or 4/3π (1/6th cp\_nucl\_size)^3 for 3d. |
| `cp_model` | string | `cyto2` | Cellpose model. util built on cyto2 model and if possible will use nucleus channel. Other models should work in principle. |
| `cp_dont_use_nucl_for_declump` | boolean | `false` | Fit nucleus mask but do not use nuclei to declump objects in mask creation. |
| `cp_downsample` | number |  | Downsample images in YX prior to running cellpose. Scales diameter, anisotropy, min cell area, min nucl area to match. Improves speed at cost of mask resolution. Masks scaled up by nearest neighbour interpolation. Recommended integer values producing whole number in YX, 2 is good. |
| `cp_cell_flow_thresh` | number | `0.4` | Cellpose flow threshold for cells. See cellpose docs. |
| `cp_nucl_flow_thresh` | number | `0.4` | Cellpose flow threshold for nuclei. See cellpose docs. |
| `cp_cell_prob_threshold` | integer | `0` | Cellpose cellprob threshold for cells. Between -6 and 6. Higher is tighter masks, lower looser masks. See cellpose docs for details. |
| `cp_nucl_prob_threshold` | integer | `0` | Cellpose cellprob threshold for nuclei. Between -6 and 6. Higher is tighter masks, lower looser masks. See cellpose docs for details. |

## Scaling

Guide: [Scaling](scaling.md)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `sc_label` | string | `normal` | Resource label for scaling |
| `sc_manualscale` | string |  | Path to scaling\_factors.txt with line formatted: &lt;plate&gt;\_ch&lt;channel&gt;=&lt;scale&gt; &lt;plate&gt;\_ch&lt;channel&gt;=&lt;scale&gt; &lt;plate&gt;\_ch&lt;channel&gt;=&lt;scale&gt; Space separated Channels zero indexed &lt;plate&gt; is the reference plate &lt;channel&gt; after merging cycles &lt;scale&gt; factor by which channel in plate is divided |
| `sc_scale_slope` | string |  | Path to scaling\_&lt;slope/bias&gt;.txt with one line formatted: &lt;plate&gt;\_ch&lt;channel&gt;=&lt;slope/bias&gt; &lt;plate&gt;\_ch&lt;channel&gt;=&lt;slope/bias&gt; &lt;plate&gt;\_ch&lt;channel&gt;=&lt;slope/bias&gt; Sets shape of sigmoid curve used to weigh scaling factors differently in intensity ranges. Background pixels remain unscaled, smooth transition scales foreground pixels. Pipeline supports only pre-calculated slope and bias, cannot auto-estimate. Must supply both slope and bias if used. If null, scaling\_factors applied uniformly. Works with --sc\_manualscale and --sc\_autoscale. |
| `sc_scale_bias` | string |  | See sc\_scale\_slope (must supply with sc\_scale\_slope if supplied) |
| `sc_autoscale` | boolean | `false` | Automatically determine scaling factors based on all images in manifest (excluding blacklist) Overrides sc\_manualscale Runs after dc\_clip\_max applied Waits till deconvolution queue empty No feature extraction jobs submitted until autoscale completes Interacts with sc\_control\_list so dynamic range is optimal after plate offset factors. sc\_control\_list requires sc\_autoscale=true; setting it without sc\_autoscale is an error. |
| `sc_autoscale_q1` | string | `max` | The measure\_intensity feature stat to read per cell/image for dynamic-range scaling (e.g. 'max' reads the ch&lt;N&gt;\_\_max column). Only used to auto-derive a channel\_map when sc\_channel\_map is null - ignored otherwise, since an explicit channel\_map's dynamic\_range\_feature takes over. Valid options are whatever stat suffixes measure\_intensity actually computes, e.g. 'min', 'q25', 'q50', 'mean', 'q75', 'q99', 'q99.9', 'q99.999', 'max'. |
| `sc_autoscale_q2` | number | `0.95` | Controls which quantile is taken across all images for chosen q1 Valid options: 0 - 1 |
| `sc_uint_max` | integer | `65535` | Max value of the raw intensity range - dynamic\_range\_feature quantiles (raw pixel intensities from measure\_intensity) are divided by this so scale\_factor comes out as a 0-1 ratio, matching what rescale\_stack\_inplace's `stack /= factor` expects (it has no rescale-back-up step afterward). Only change this if your images aren't 16-bit (e.g. 4095 for 12-bit-in-16-bit-container cameras that were never bit-shifted up). |
| `sc_registration_thresh` | number | `0.4` | Minimum registration correlation an object's matching columns (see sc\_registration\_pattern) must all meet to be kept; objects below threshold on any matching column (or missing/NaN) are removed before scaling factors are computed. Also used by the QC report (Tab 2 qc'ed cell count/density plot, Tab 5 intensity stats) - shared rather than duplicated since both are the same registration-QC concept. |
| `sc_registration_pattern` | string | `registration_corr` | Substring used to find per-channel-pair registration correlation columns in object\_features for sc\_registration\_thresh filtering. Also used by the QC report, same reasoning as sc\_registration\_thresh. |
| `sc_skip_sigmoid` | boolean | `false` | Skip sigmoid fitting globally and apply the raw scale factor (dynamic range \* plate offset) instead - same effect as setting every row's skip\_sigmoid=true in sc\_channel\_map, without needing to edit the file. Has no effect in dynamic-range-only mode (sigmoid fitting is already skipped there, since it needs control images to fit against). |
| `sc_skip_debris_removal` | boolean | `false` | Overrides the debris-removal feature selection (see sc\_debris\_max\_pct/sc\_debris\_min\_ratio): always use the bare (non-debris-removed) image feature for sigmoid fitting, even on images whose debris QC passes. |
| `sc_offset_mode` | string | `well` | How each plate's control mean is estimated for the plate offset. 'well' (default) averages within each control well first, then across well means - the well is the experimental unit (sc\_control\_list defines controls per well), so cells within a well are pseudoreplicates rather than independent samples of the plate's brightness. Whenever wells genuinely differ (seeding density, edge effects, pipetting, position) this is the lower-variance estimator, and the advantage grows as cell counts become unequal, since a single dense well can otherwise dominate the plate mean and feed that bias straight into plate\_offset. 'cell' pools every control cell on the plate, implicitly weighting by cell count - the original behaviour, kept for reproducing pre-existing scaling factors. The mode is recorded in scaling\_index.tsv and consensus\_scaling\_factors refuses to pool indices whose modes disagree. |
| `sc_offset_min_cells_per_well` | integer | `10` | Control wells with fewer cells than this are dropped from the plate offset mean. Only applies to sc\_offset\_mode='well', where a well with a handful of cells would otherwise carry the same weight as one with thousands. Wells dropped this way are reported in scaling\_warnings.tsv. |
| `sc_reference_scaling_index` | string |  | One or more previous batches' scaling\_index.tsv (comma separated, same convention as rn\_manifest\_well). When set, consensus\_scaling\_factors pools them with this batch's own index and recomputes the scaling factors over the combined plate set, making the output dynamic range comparable across batches. The pooled recompute reproduces exactly what a single run over all the pooled plates would have produced - it is NOT an average of the per-batch factors, which would be meaningless, since each batch's base\_scale carries its own plate-offset anchor (base\_scale = m \* k, where m is that batch's dimmest control mean and k its saturation per unit control brightness). The current batch always participates in the pool, so the factors can only grow to accommodate it and nothing clips; a warning is raised when this batch is the one setting the scale, i.e. it is brighter per unit control than every reference. Outputs land in rr\_\_scaling/consensus (scaling\_index.tsv, scaling\_factors.txt, consensus\_diagnostics.tsv, scaling\_warnings.tsv, plus pass-through sigmoid files) and supersede those in rr\_\_scaling. Requires sc\_autoscale. |
| `rn_stop_after_scaling_factors` | boolean | `false` | Stop the run once the scaling factors exist. Skips rescale, cellcrops and cellprofiler - the storage and compute heavy steps - but still finalizes the unscaled images, measures them, derives the scaling factors and renders the full QC report, including Tab 6 (scaling factors) and the debris/decon sample images, all of which read the unscaled images anyway. Intended for the two-step cross-batch workflow: run each batch with this set to characterise it cheaply, then re-run with sc\_reference\_scaling\_index pointing at the other batches' indices. Requires sc\_autoscale, and cannot be combined with sc\_scale\_in\_finalize (which scales inside finalize, leaving no unscaled images to measure). |
| `sc_debris_max_pct` | number | `10.0` | Max ch&lt;N&gt;\_\_debris\_percentage for an image to count as clean. Used by Tab 7 (debris) in the QC report's no\_debris/debris/unusually\_high\_debris classification (an image above this, whose threshold does separate debris from background, is classed "unusually\_high\_debris" rather than "debris" - see sc\_debris\_min\_ratio), and by calculate\_scaling\_factors (sc\_autoscale) to decide, per image, whether to use that image's debris-removed feature variant for sigmoid fitting - see sc\_skip\_debris\_removal. Experiment-specific - tune per run. |
| `sc_debris_min_ratio` | number | `2` | Min ch&lt;N&gt;\_\_threshold\_mean\_ratio for the threshold to separate debris from background - below this it sits too close to the background mean, which suggests there is no debris to find, so the image is classed "no\_debris" and its debris\_percentage is not used. Used by Tab 7 (debris) in the QC report's no\_debris/debris/unusually\_high\_debris classification (see sc\_debris\_max\_pct) and by calculate\_scaling\_factors (sc\_autoscale) - see sc\_debris\_max\_pct. Experiment-specific - tune per run. |
| `sc_debris_method` | string | `Otsu_log` | Thresholding method measure\_intensity uses to call debris (pixels above the threshold outside the cell mask). One of 'MCE', 'Otsu', 'Otsu\_log' or 'Qxx' (a percentile, e.g. 'Q99'). Also used by the QC report's debris overlays (Tab 7) so they match what was measured. |
| `sc_cellmask_expansion` | integer | `0` | Pixels to expand the cell mask by before calling debris in measure\_intensity, so signal right at the cell edge isn't counted as debris. Also used by the QC report's debris overlays (Tab 7). |
| `sc_scale_in_finalize` | boolean | `false` | When scaling is enabled (sc\_autoscale or sc\_manualscale), controls whether finalize applies it directly (writing straight to processed\_images/scaled) or defers to a separate rescale pass that reads processed\_images/unscaled. false (default): finalize writes processed\_images/unscaled and can run without waiting on scaling factors; rescale then produces processed\_images/scaled from that. Keeps an unscaled artifact around and maximizes parallelism. true: finalize waits on scaling factors and writes processed\_images/scaled directly, skipping the extra read/write pass; requires sc\_manualscale and cannot be combined with sc\_autoscale. No effect if scaling is disabled. |
| `sc_publish_unscaled` | boolean | `true` | Publish the unscaled processed images (rr\_\_processed\_images/unscaled) written by finalize when sc\_scale\_in\_finalize is false. Disabling this saves storage - the unscaled images are still written to the work directory and used internally (e.g. by rescale), just not copied into rn\_publish\_dir. No effect when sc\_scale\_in\_finalize is true, since finalize then writes straight to processed\_images/scaled instead. |

## Cellprofiler

Guide: [Understanding output](understanding-output.md#features)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `cpr_label` | string | `normal` | Resource label for the CellProfiler process. |
| `cpr_conda_env` | string | *site-specific path* | Conda environment used for CellProfiler. Since CellProfiler 5 this can be the same environment as `rn_conda_env`. |
| `cpr_plugins` | string | `$projectDir/bin/cellprofiler/plugins` | Folder with CellProfiler plugins. Defaults to `bin/cellprofiler/plugins` in the pipeline repository. |
| `cpr_run` | boolean | `true` | Execute cellprofiler |
| `cpr_pipeline_2d` | string |  | cellprofiler pipeline for max projections |
| `cpr_pipeline_3d` | string |  | cellprofiler pipeline for 3d |
| `cpr_no_zip` | boolean | `false` | Do not zip cellprofiler output into one archive |
| `cpr_container` | string |  | Container for the cellprofiler enviroment |
| `cpr_publish_features_per_well` | boolean | `false` | Publish CellProfiler feature outputs (rr\_\_features/cellprofiler), written by either the cellprofiler process (cached-images path, rn\_cache\_images=true) or finalize\_and\_cellprofiler (combined, non-cached path, rn\_cache\_images=false) - whichever one actually runs. |
| `cpr_run_concat` | boolean | `true` | Aggregate each plate's per-well CellProfiler zips into one cell-level and one image-level parquet file (rr\_\_features/cellprofiler\_concat). Requires cpr\_no\_zip=false - each well's zip is self-contained, which loose per-well .txt files are not once staged together for a whole plate. |
| `cpr_merge_strategy` | string | `mean` | How to aggregate a child object's numeric columns onto its parent cell when it has a 1:many relationship (e.g. several nucleoli per cell). One of 'mean', 'median', 'sum'. Categorical (non-numeric) columns instead keep the shared value if every child row agrees, or NA if they disagree. |
| `cpr_parent_col` | string | `Parent_cell` | Column used to match a child object row to its parent cell (e.g. CellProfiler's RelateObjects module writes this as Parent\_&lt;parent object name&gt;). |
| `cpr_child_pattern` | string | `^.*_([a-zA-Z]+\d*)\.txt$` | Regex identifying a CellProfiler output file as a child object to merge onto the parent cell - the first capture group is used as the object's name. Matches everything except \_cell.txt, \_Image.txt, \_Experiment.txt and \_Object relationships.txt, which are handled separately. |

## QC report

Guide: [QC report](qc-report.md)

| Parameter | Type | Default | Description |
|---|---|---|---|
| `qc_run` | boolean | `true` | Run the QC report subworkflow. Requires rn\_cache\_images=true, since it reads the measure\_intensity parquet output produced inside finalize\_images. Tab 1 (general QC) is always shown; tabs 2, 5, 7 (registration, intensities, debris) appear whenever their source columns are present in the measurements; tabs 3, 4, 6 (flatfield, decon, scaling) only appear if the corresponding optional pipeline stage actually ran. |
| `qc_label` | string | `normal` | Resource label for the QC report's own processes (selecting/rendering debris samples and building the final HTML) - these previously hardcoded the "tiny" label, which is undersized once real images/masks are actually being loaded. |
| `qc_n_sample_registration` | integer | `10` | Number of registration images shown (click-through) in Tab 2, PER GROUP - Tab 2 shows the worst- and best-aligning fields separately, so 10 means 20 images. Fields are ranked by the percentage of their cells whose registration correlation clears sc\_registration\_thresh, so the examples are the actual extremes rather than a random sample. |
| `qc_min_cells_registration` | integer | `10` | Minimum segmented cells a field needs before it is eligible as a Tab 2 registration example. A field with 3 cells, one of which aligns, scores 33% and would otherwise crowd the worst-aligning list with sparse fields rather than genuine misalignment. |
| `qc_n_sample_decon` | integer | `10` | Number of fields used to build the before/after decon comparison images in Tab 4. The most cell-dense fields are picked (one field per well, spread across plates) - decon's effect can't be judged on a sparse field. |
| `qc_decon_crop_pct` | number | `25` | Center crop applied to each Tab 4 before/after decon image, as a % of the original width/height (100 = no crop). Decon's effect is often too subtle to see when the whole field is squeezed into a small QC thumbnail, so zooming into the middle of the field makes it easier to spot. |
| `qc_plate_format` | string | `auto` | Plate format used to lay out the Tab 1/5 per-plate heatmaps. 'auto' infers the format from the max row/col seen in the data; set explicitly to override. |
| `qc_n_sample_debris` | integer | `10` | Number of highest-debris images (per channel, by debris\_percentage) rendered as clickable examples in Tab 7 |
| `qc_min_cells_per_well` | integer | `50` | FAIL a well in rr\_\_qc/well\_qc.tsv when it has fewer segmented cells than this. Independent of qc\_min\_cells\_registration (field eligibility for registration examples) and sc\_offset\_min\_cells\_per\_well (dropping sparse control wells from the plate-offset mean), which serve other steps. |
| `qc_min_pct_registered` | number | `25` | FAIL a well when fewer than this percent of its cells clear sc\_registration\_thresh in every registration correlation column - the same rule filter\_registration\_correlation applies when selecting cells for scaling. Left blank and ignored when the run has no registration columns at all, so a single-cycle run is not penalised. |
| `qc_min_signal_ratio` | number | `1.5` | A cell counts as low signal when its qc\_signal\_stat sits below this multiple of its OWN field's ch&lt;N&gt;\_\_background\_mean. Compared per field rather than per well or plate, since background varies field to field. |
| `qc_max_pct_low_signal` | number | `25` | WARN a well when more than this percent of its cells are low signal (see qc\_min\_signal\_ratio) in any checked channel. Warn rather than fail, because a dim channel is frequently legitimate - a marker genuinely absent in that well - so it is worth surfacing without failing the well. |
| `qc_signal_stat` | string | `q95` | Per-cell statistic compared against the field background in the intensity check (e.g. median, mean). Must be a stat measure\_intensity actually computes, i.e. a ch&lt;N&gt;\_\_&lt;stat&gt; column. |
| `qc_intensity_skip_channels` | string |  | Comma-separated 0-indexed final channels to leave out of the intensity check, e.g. brightfield, where 'above background' is not a meaningful notion. Null checks every channel that has a background\_mean measurement. |
