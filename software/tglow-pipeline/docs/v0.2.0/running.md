# Running the pipeline

## Project layout

We recommend one folder per project, with the pipeline installed elsewhere:

```text
my_project/
├── results/          # Pipeline outputs (rn_publish_dir, default ../results)
├── workdir/          # Nextflow work directory (default ../workdir)
└── scripts/          # Launch Nextflow from here
    ├── inputs/       # Manifests, channel map, control list, CellProfiler pipeline
    ├── logs/
    └── my_run.config
```

The default paths are relative to the folder you launch from, so run
Nextflow from `scripts/`.

## Configuring a run

Put the settings of a run in a config file. Below is a starting point for a
two-cycle run with deconvolution, automatic scaling and CellProfiler. Only
`rn_manifest` is required; everything else has a default (see
[Parameters](parameters.md)).

```nextflow
params {
    // Inputs
    rn_manifest              = "inputs/manifest.tsv"
    rn_manifest_registration = "inputs/manifest_registration.tsv"
    rn_blacklist             = null

    // Output locations
    rn_publish_dir = "../results"
    rn_image_dir   = "../results/images"
    rn_decon_dir   = "../results/decon"

    // Run mode: 3D segmentation and decon, 2D CellProfiler
    rn_hybrid       = true
    rn_max_project  = false
    rn_scratch      = true
    rn_cache_images = true

    // Flatfield estimation
    ff_mode             = "POLY"
    ff_global_flatfield = true
    ff_threshold        = true
    ff_nimg             = 200
    ff_nimg_test        = 100

    // Deconvolution
    dc_run  = true
    dc_mode = "clij2_nc"
    dc_niter = 100

    // Segmentation
    cp_cell_size           = 75
    cp_nucl_size           = 60
    cp_cell_prob_threshold = 0
    cp_nucl_prob_threshold = 0
    cp_downsample          = 2

    // Scaling
    sc_autoscale    = true
    sc_channel_map  = "inputs/channel_map.tsv"
    sc_control_list = "inputs/control_list.tsv"

    // CellProfiler
    cpr_run         = true
    cpr_pipeline_2d = "inputs/cellprofiler_2d.cppipe"

    // QC report
    qc_run = true
}
```

The pipeline validates the parameters and input files at startup and stops
with an error if something is wrong, before submitting any jobs. It checks,
among other things, that:

- all parameter names exist (so typos and parameters from older versions are caught);
- the manifests have the right columns and valid channel numbers;
- combinations of options make sense, for example that `sc_control_list` is
  only used with `sc_autoscale`, and that the CellProfiler pipeline for the
  chosen mode (2D or 3D) is set and exists.

`--rn_skip_checks true` skips these checks. This is meant for testing only:
without the checks, boolean parameters given on the command line are not
converted correctly, and unknown parameters are silently ignored.

### 2D, 3D and hybrid mode

| Mode | Settings | Segmentation and deconvolution | CellProfiler and cell crops |
|---|---|---|---|
| 3D | `rn_max_project = false`, `rn_hybrid = false` | 3D | 3D |
| 2D | `rn_max_project = true` | 3D deconvolution, saved as max projections; 2D segmentation | 2D |
| Hybrid | `rn_hybrid = true` | 3D | 2D, on max projections |

Hybrid mode is required for splitting channels into nuclear and non-nuclear
signal (`mask_channels`). `rn_hybrid` overrides `rn_max_project`. Caching 3D
processed images needs a lot of disk space.

### Selecting wells

- `--rn_wells A01,B04,C12` runs only these wells, on every plate. Useful for
  a test run.
- The [blacklist](manifests-and-configuration.md#blacklist) excludes specific wells on specific plates.
- To skip a whole plate, remove it from the manifest.

### Switching steps on and off

| Step | Switch |
|---|---|
| Flatfield estimation | `ff_run`, or `ff_channels = none` per plate in the manifest |
| Deconvolution | `dc_run`, or `dc_psfs = none` per plate |
| Registration | give or omit `rn_manifest_registration` |
| Segmentation | `cp_run` (required for everything after deconvolution) |
| Processed images | `rn_cache_images` (required for scaling, QC report and cell crops) |
| Scaling | `sc_autoscale` or `sc_manualscale`, see [Scaling](scaling.md) |
| CellProfiler | `cpr_run` |
| Cell crops | `rn_make_cellcrops` |
| QC report | `qc_run` |

## Launching

With Nextflow directly:

```bash
#!/usr/bin/env bash
# Run from the scripts/ folder of your project.

# Path to main.nf of your pipeline install
NF_FILE="</path/to/tglow-pipeline/main.nf>"

# Your cluster profile, e.g. lsf, or local
PROFILE="local"

# Workflow to run: stage or run_pipeline
WORKFLOW="run_pipeline"

prefix="$(date '+%Y%m%d_%H%M')"
mkdir -p logs/${prefix}

nextflow \
  -log logs/${prefix}/${WORKFLOW}.nextflow.log \
  run ${NF_FILE} \
  -profile ${PROFILE} \
  -w ../workdir \
  -c my_run.config \
  -resume \
  --workflow ${WORKFLOW} \
  -with-report logs/${prefix}/${WORKFLOW}.nextflow.html \
  -with-trace logs/${prefix}/${WORKFLOW}.nextflow.trace
```

Or with the runner script, which does the same and submits the Nextflow
head job to the scheduler (see [Installation](installation.md)):

```bash
tglow-pipeline run_pipeline -c my_run.config
```

`--workflow` selects `stage` or `run_pipeline`. It replaces `-entry` from
earlier versions, which Nextflow 26.04 no longer supports.

For a first run on a new dataset, start with a few wells (`--rn_wells`) and
check the [QC report](qc-report.md) and the processed images before running
everything.

## Re-running and caching

The pipeline caches results in two different ways.

**Permanent cache (`storeDir`).** These folders are reused whenever their
output exists, even if parameters, inputs or the pipeline changed:

- `rn_image_dir` (staged images)
- `rn_decon_dir` (deconvolved images)
- `flatfields/`, `registration/` and `masks/` in `rn_publish_dir`

This protects the expensive steps from accidental re-runs, and lets you
replace outputs by hand, for example a flatfield. To re-run one of these steps,
rename or delete its output. For example, to re-run flatfield estimation:

```bash
cd ../results
mv flatfields flatfields_v1
```

**Tracked results (`rr__` folders).** Everything downstream of finalize
(`rr__processed_images`, `rr__features`, `rr__scaling`, `rr__cellcrops`,
`rr__qc`) is tracked by Nextflow and re-runs automatically with `-resume`
when its inputs or parameters change. After re-running a cached step, such
as the flatfields above, the downstream `rr__` results update by
themselves.

The files in the `rr__` folders are symbolic links to files in the Nextflow
work directory. **Don't delete the work directory** while you still need
these results. To free up space while keeping `-resume`, see
[Cleaning up old runs](cleaning-data.md). To make the results independent
of the work directory at the end of a project, see
[Finalizing results](finalizing-results.md).

## Monitoring progress

Both launch methods create a `logs/<date>_<time>/` folder for each run. We
strongly recommend keeping these: it makes parsing logs and debugging much
easier, and avoids overwriting log files.

- `<workflow>.nextflow.log` is the Nextflow log. A successful run ends with an
  "Execution complete" message.
- `<workflow>.nextflow.trace` lists every task with its status and hash,
  which is handy to find failed tasks.
- `<workflow>.nextflow.html` is a resource usage report.

## Debugging

Each task runs in its own work directory, named by its hash. To see why a
task failed, find its short hash in the log or trace (for example
`e4/dh29qs`), then `cd ../workdir/e4/dh29qs` and press tab to complete the
full hash. The directory contains:

- `.command.sh`: the command that was run.
- `.command.log`, `.command.err`: the output of the command.

With `rn_scratch = true` (the default), tasks run on the node's local scratch
space, so their intermediate files are not kept. Set
`rn_scratch = false` to keep them in the work directory while debugging.

To check that the pipeline wiring works after changing a config, use a stub
run (see [Installation](installation.md)).

## Allowing errors

If some tasks fail, for example CellProfiler on a few wells, and you want
the run to continue, use an "ignore errors" profile such as
`-profile lsf_ignore_errors`. Failing tasks are retried and then skipped,
while the rest of the run continues. For other schedulers, create your own
profile with `errorStrategy` set to `ignore` (see
[Installation](installation.md)).

## Tips

- You can symlink plates or wells into a new image folder to run a subset of
  the data as a separate instance.
- Use `tglow-pipeline ... -- --param value` or `nextflow ... --param value`
  to override a setting from the config for a single run.
