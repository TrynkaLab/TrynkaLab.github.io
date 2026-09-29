# Installation

> This pipeline was developed and tested on Sanger's FARM-22 cluster (IBM LSF
> scheduler, NVIDIA A100, Tesla V100 and H100 GPUs with CUDA 12.6). Running
> elsewhere will require adjustments to the Nextflow configuration. We give
> instructions as best we can, but every HPC is different.

Prerequisites:

- [Nextflow](https://www.nextflow.io/docs/latest/install.html) 26.04 or
  newer. v0.2.0 uses Nextflow's strict syntax and may not run on older versions.
- `conda` (or `mamba`) on your `PATH`. If you can't use Conda on your HPC,
  see [I cannot use Conda](#i-cannot-use-conda) below.
- For large datasets, access to GPUs for segmentation and deconvolution.

## 1. Get the pipeline

Create a central folder for the install and clone the repository. We
recommend keeping the pipeline separate from the folders where you run it, so
one install can be used for many projects.

```bash
git clone https://github.com/TrynkaLab/tglow-pipeline.git
cd tglow-pipeline
```

Make a note of the location of `main.nf`; you'll need it later:

```bash
echo "$(pwd)/main.nf"
```

## 2. Create the Conda environment

Since v0.2.0 the pipeline and CellProfiler share a single environment
(Python 3.11, CellProfiler 5). It is defined in `environment.yml` in the
repository:

```bash
conda env create -f environment.yml
conda activate tglow-gamma
```

This installs, among others, `tglow-core`, Cellpose 3.0.8, CellProfiler 5 (a
pinned nightly build), PyTorch for CUDA 12.6, and our
[patched fork of clij2-fft](https://github.com/TrynkaLab/clij2-fft) for
deconvolution. The install takes a while.

> If your GPUs need a different CUDA version, change the PyTorch
> `--extra-index-url` in `environment.yml` before creating the environment.
> See the [PyTorch install instructions](https://pytorch.org/get-started/locally/).

Check that the GPU libraries work, from an interactive session on a GPU node:

```bash
conda activate tglow-gamma
python
```

```python
# Check pyopencl is working for clij2-fft (deconvolution)
import pyopencl as cl
print(f"OpenCL devices: {len(cl.get_platforms()[0].get_devices())}")

# Check torch is working for Cellpose (segmentation)
import torch
print(f"PyTorch CUDA: {torch.cuda.is_available()}")
```

If this lists devices and prints `True` without errors, your GPU setup works.

Note down the path of the environment, which you'll need to configure Nextflow:

```bash
echo $CONDA_PREFIX
```

## 3. Configure Nextflow for your system

Nextflow is very configurable, which is great, but it can be confusing where
to change things. For a long-term or shared install, we recommend editing the
`nextflow.config` in the repository (the "project directory" in Nextflow
terms), so the settings apply to every run. You can also override any setting
in the config file of a run (`-c`). See the
[Nextflow configuration docs](https://www.nextflow.io/docs/latest/config.html)
for details.

### Set the Conda environment

Point the pipeline to the environment you created. In the repository's
`nextflow.config`, update the existing values rather than adding new ones:

```nextflow
params {
    // Environment for the pipeline processes
    rn_conda_env  = "/path/to/conda/envs/tglow-gamma"

    // Environment for CellProfiler; the same environment since v0.2.0
    cpr_conda_env = "/path/to/conda/envs/tglow-gamma"
}
```

### Set up your HPC profile and queues

> For small image sets you can skip this section and run with `-profile local`.

The pipeline comes with three profiles:

| Profile | Executor | Behaviour on errors |
|---|---|---|
| `local` | local machine | Retries failed tasks twice, then ignores them. |
| `lsf` | IBM LSF | Retries failed tasks twice, then stops the run after running tasks finish. |
| `lsf_ignore_errors` | IBM LSF | As `lsf`, but ignores tasks that keep failing and continues the run. |

For another scheduler (Slurm, SGE, ...), add a profile. The
[nf-core configs](https://nf-co.re/configs/) repository has ready-made
configurations for many institutes. Save yours as, for example,
`conf/my_profile.config` and register it in `nextflow.config`:

```nextflow
profiles {
    my_profile { includeConfig 'conf/my_profile.config' }
}
```

The resources of each process are set through labels, defined in
`conf/processes.config`. You will most likely need to update the queue names
and the GPU `clusterOptions` there. The labels use three queues:

| Queue | Labels | Use |
|---|---|---|
| `imaging` | `tiny_img`, `small_img`, `normal_img`, `long_img` | IO-heavy jobs such as staging. Can usually be your normal queue. |
| `normal` | `tiny`, `small`, `normal`, `normal_plus`, `medium`, `himem` | Regular jobs. |
| `gpu` | `gpu_short`, `gpu_small`, `gpu_normal`, `gpu_normal_plus`, `gpu_medium`, `gpu_himem` | Segmentation and deconvolution. |

There are several ways to adapt them:

1. Edit `conf/processes.config` in the repository (recommended for shared installs).
2. Override the settings with a `process {}` block in the config of a run.
3. Put your own process definitions in a separate file and include it with
   `includeConfig`. The `conf/otar3086_cub22*.config` files are examples of
   this, which move the GPU labels to another cluster.

Instead of changing labels, you can also define your own and assign them to
a step with its label parameter (for example `cp_label`, `dc_label` or
`ff_label`, see [Parameters](parameters.md)).

## 4. Check the installation

The repository includes `stub_run.sh`, which creates a small set of dummy
inputs in `.stub_run/` and runs the pipeline in Nextflow's stub mode. This
checks that Nextflow and the pipeline wiring work, without needing the Conda
environment, a GPU or real data:

```bash
./stub_run.sh run_pipeline
./stub_run.sh stage
```

The stub run does not test the tools themselves. To check a full
installation, run the pipeline on a few wells of your own data first (see
[Running the pipeline](running.md)).

## 5. Set up the runner script (optional)

The repository includes a runner script, `tglow-pipeline`, which makes
running instances easier: it creates a timestamped log folder, adds
`-resume`, reports and traces, and submits the Nextflow head job to the
scheduler. It is written for Sanger's FARM-22, so it needs editing before you
can use it. The parts to change are at the top of the script, marked:

```text
#-----------------------------------------------------------------------
#                 Update these for your installation
#-----------------------------------------------------------------------
```

Update:

1. How Nextflow is loaded (`module load ...`), and `NXF_VER`.
2. `NF_FILE`, the path to `main.nf`.
3. Environment variables such as the proxies, `NXF_OPTS` and `NXF_SINGULARITY_CACHEDIR`.
4. The defaults for queue, group and profile.
5. The submit command (`bsub ...`) near the end of the script, if you don't use LSF.

Then make the script executable and add the repository to your `PATH`, for
example in your `.bashrc`:

```bash
export PATH="$PATH:/path/to/tglow-pipeline"
```

Usage:

```text
tglow-pipeline <stage|run_pipeline> [-c <config>] [-p <profile>] [-l] [-w <workdir>]
               [-q <queue>] [-t <hours>] [-g <group>] -- [nextflow arguments]

<stage|run_pipeline>   The workflow to run
-c                     Nextflow config file for the run
-p                     Nextflow profile [local|lsf|lsf_ignore_errors] (default: lsf)
-l                     Run the Nextflow head job locally instead of submitting it
-w                     Nextflow work directory (default: ../workdir)
-q                     Queue for the Nextflow head job
-t                     Time limit for the Nextflow head job, in hours (default: 120)
-g                     LSF group for the Nextflow head job
--                     Everything after this is passed to Nextflow and overrides -c
```

Examples:

```bash
tglow-pipeline run_pipeline -c my_run.config -l

# Override settings from the config
tglow-pipeline run_pipeline -c my_run.config -- --rn_wells A01,B02,C03
```

## I cannot use Conda

If Conda is disabled on your HPC, you can build your own (Singularity/Apptainer or
Docker) container from `environment.yml` instead. Building containers is not
covered here, and we have not tested this setup. Set the container for the
pipeline and for CellProfiler (these can be the same since v0.2.0):

```nextflow
params {
    rn_container  = "/path/to/container"
    cpr_container = "/path/to/container"
}

conda.enabled = false
singularity.enabled = true
```

Background reading:

- [Nextflow process directives](https://www.nextflow.io/docs/latest/reference/process.html)
- [Nextflow configuration reference](https://www.nextflow.io/docs/latest/reference/config.html)
- [Process containers](https://www.nextflow.io/docs/latest/reference/process.html#process-container)
