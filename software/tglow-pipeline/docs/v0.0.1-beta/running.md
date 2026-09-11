# Configuring the pipeline

### Executing the pipeline

The pipeline can be configured through creating a config file

Basic invocation (adjust paths and options as needed):

```
params {
    // IO parameters
    rn_manifest = "inputs/manifest.tsv"
    rn_manifest_registration = "inputs/manifest_registration.tsv"
    rn_blacklist = null
    
    // Controls the output directories
    rn_publish_dir = "../results"
    rn_image_dir = "../images"
    rn_decon_dir = "../results/decon"

    // Run parameters
    rn_max_project = false
    rn_hybrid = true
    rn_scratch = false
    rn_cache_images = true
    
    // Scaling and normalization parameters
    rn_manualscale = null
    rn_scale_slope = null
    rn_scale_bias = null
    rn_wells = null

    // Background prediction parameters
    bp_mode = "POLY"
    bp_threshold = true
    bp_global_flatfield = true
    bp_nimg = 4
    bp_merge_n = 1
    bp_nimg_test = 4
    bp_pseudoreplicates = 0
    bp_pseudoreplicates_test = 0

    // Deconvolution parameters
    dc_run = true
    dc_mode = "clij2_nc"
    dc_niter = 100
    dc_psf_subsample_z = 8

    // Cellpose  parameters
    cp_cell_prob_threshold = -4
    cp_nucl_prob_threshold = 2
    cp_downsample = 2
    
    // Cellprofiler
    cpr_run=true
    cpr_pipeline_3d = null
    cpr_pipeline_2d = "inputs/cellprofiler_example.cppipe"
}

```


A farily minimal execute script could look like this, but a more fully featured option can be found under 'tglow-pipeline' in the root.

```bash
#!/usr/bin/env bash


# This assumes:
# - You are in the 'scripts' working directory
# - You have updated the example.config with paths to conda environments
# - The necessary dependencies are installed and accessible
# - You have setup and configured your run exectutor and profile.
# - Nextflow is available in your PATH
# If any of this does not make sense, please see the wiki

timestamp_folder_name() {
  date '+%Y%m%d_%H%M'
}

# CHANGE ME:
# Path to your main.nf file
NF_FILE="</path/to/your/pipeline/main.nf>"

# CHANGE ME:
# Name of your cluster profile. e.g. lsf, slurm, sge etc.
# Use local for local execution
PROFILE="local"

# Pipeline workflow to run, one of stage | run_pipeline
WORKFLOW="run_pipeline"

# This is just extra to keep logs organized
prefix="$(timestamp_folder_name)"
mkdir -p logs/${prefix}
    
nextflow \
-log logs/${prefix}/${WORKFLOW}.nextflow.log \
run ${NF_FILE} \
-profile ${PROFILE} \
-w ../workdir \
-c inputs/example.config
-resume \
-entry ${WORKFLOW} \
-with-report logs/${prefix}/${WORKFLOW}.nextflow.html \
-with-trace logs/${prefix}/${WORKFLOW}.nextflow.trace \
```


See [parameters.md](https://github.com/TrynkaLab/tglow-pipeline/blob/main/docs/parameters.md) for all configuration parameters.


## Tips

- You can symlink plates/wells to use as input which can be handy for organizing pipeline runs or analyzing subsets of data in a seperate instance

## Monitoring progress

If running with these scripts, a `logs/<date>_<HH:MM>` folder is created. I strongly reccomend keeping this as it makes it
much easier to parse logs, debug and avoids over-writing of log files. 

Nextflow logs to `.nextflow.log`. The latest run is always in `.nextflow.log` (older logs get appended with numbers).

If successful, `.nextflow.log` will finish with an "Execution complete" message.

This script will also produce a `.nextflow.trace` upon completion, which can be handy to find failed / completed jobs and their hash.


## Wrapper scripts

The repo contains example wrapper scripts that place logs in `./logs`. See `examples/nextflow` in the repo for wrappers.

## Debugging
Each Nextflow process has a work directory named by its hash. To find a jobs specific log output and see why if failed, find the short hash of the job that failed like `e4/dh29qs`, cd into '../workdir/e4/dh29qs' then press tab to complete to the full hash and press enter. This will take you into the workdir for that specific job.

If a process crashes, inspect the workdir and the `.command.log` / `.command.sh` files to reproduce the failure locally. For debugging set `rn_scratch=false` to keep staging folders on shared storage instead of on the local nodes scratch space.

## Allowing errors

If CellProfiler crashes and you want the pipeline to continue, run with an ignore-errors profile (e.g. `-profile lsf_ignore_errors`) so Nextflow retires failing tasks 3 times but instead of crashing the main runner, it keeps the run active and submits new jobs. You may need to create your own  'ignore errors' profile, see the install instructions for details on creating a profile. 
