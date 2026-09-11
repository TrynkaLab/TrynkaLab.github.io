# Installation

> Note: This pipeline was developed and tested on Sanger's FARM-22 which has runs with IBM LSF as the scheduler, CentOS, NVIDIA A100/TeslaV100/H100 GPUs on Cuda 12.6. Running elsewhere will require adjustments to Nextflow configuration. A best attempt is made to provide instructions, but every HPC is different.

Prerequisites: install Nextflow (>= 25.04.6) and ensure `conda` is on your PATH. If Conda is unavailable on your HPC, follow the "I cannot use conda, what do I do?" section below for container alternatives.

Create a centralized folder for the install and clone the repository. We recommend keeping the pipeline repository separate from the instance where you will run the pipeline to enable cross-dataset reuse.

```bash
git clone https://github.com/TrynkaLab/tglow-pipeline.git
```

Make a note of the location of `main.nf`; you'll need it later.
```bash
echo "$(pwd)/tglow-pipeline/main.nf"
```

Next, set up the Conda environments used by Nextflow to run pipeline processes and the Python library for the pipeline. The pipeline requires two environments due to dependency incompatibilities: one for the core pipeline and one for CellProfiler. This may change in future updates.

## 1. Setting up the environments

We need to create two Conda environments which contain the software the pipeline uses. Two separate environments are required because of dependency incompatibilities and to make pip installs more manageable. Create one for CellProfiler (Python 3.9, includes `wxPython` via Conda) and one for the core TGlow pipeline functions (Python 3.10).

> Note: We opted for this approach because it offers more control, especially for hardware-dependent GPU installs, rather than letting Nextflow create the Conda environments directly.

### Pipeline environment

> Note: On our compute we had an issue with CLIJ2-fft which required some tweaks. See [known issues](known-issues.md) for more details on how to fix the install of CLIJ2-fft if you get blank images after deconvolution.

Activate the pipeline environment and install the required pip packages:

```bash
conda create -n tglow python==3.10

conda activate tglow

pip install tglow-core clij2-fft RedLionfish cellpose==3.0.8 h5py
```

This will attempt to automatically install the required torch for your GPU, as GPU installs can be tricky, make sure to check it installed correctly by running the following on a GPU-enabled interactive session:

```bash
python
```
Then in the python shell:
```python
# Check pyopencl is working for CLIJ2-fft
import pyopencl as cl
print(f"OpenCL devs: {len(cl.get_platforms()[0].get_devices())}")

# Check torch is working for CellPose
import torch
print(f"PyTorch CUDA: {torch.cuda.is_available()}")
```
If it throws no errors and lists devices, your GPU should be properly configured.

> If the above doesn't automatically work, make sure to run `pip uninstall pytorch` prior to trying to re-install. Then follow the PyTorch install instructions: https://pytorch.org/get-started/locally/. I would reccomend the pip install wherever possible.


Next, note down the install path of the Conda environment, as this will need to be provided to Nextflow during configuration:
```bash
# List the path to the tglow environment
echo $CONDA_PREFIX
```

> Note: tglow-core depends on BaSiCPy which has some restrictive dependencies. We also use AICSImageIO which is being superseded by BioIO; we'll port to that in the future to ease dependency issues. CellProfiler is currently somewhat out-of-date and may not run on newer Python versions required by packages such as PyTorch.


### CellProfiler environment
This environment installs CellProfiler. The order in which you call the commands may matter because of dependency conflicts, but this shouldn't affect pipeline execution.

> Note: The install is a little heavy and takes a couple of minutes. In future we may write a more lightweight headless wrapper using `cellprofiler-core` to avoid installing `wxPython` through Conda.

```bash
conda deactivate

conda create -n cellprofiler python==3.9.19 wxPython
conda activate cellprofiler

# Install this first
pip install tglow-core

# Install CellProfiler 4.2.8
# Your mileage may vary with v5; the process is finicky.
pip install cellprofiler==4.2.8

```

> Note: You may see `ERROR: pip's dependency resolver does not currently take into account all the packages that are installed.`. This is expected for this environment and should not affect `tglow-core` usage. Future updates to CellProfiler may resolve these constraints.

Keep track of the install path of the Conda environment, as this will need to be provided to Nextflow during configuration.

```bash

# List the path to the CellProfiler environment
echo $CONDA_PREFIX
```

## 2. Configure global Nextflow settings
To ensure the pipeline runs smoothly on your configuration, there are a couple of settings that need to be updated for Nextflow to mesh well with your configuration. Nextflow is very configurable, which is great, but its also confusing where to update things sometimes. If you are installing the pipeline for longer term or shared use, I would reccomend editing some things in the repo's nextflow.config ('project directory' in NF lingo), which should mean these settings are used for all runs, but you can also use the instance config file (-c) to override any defaults set in nextflow.config. 

More details on configurating Nextflow see: https://www.nextflow.io/docs/latest/config.html

### Setting the conda enviroments

Next, update your configuration so the params block updates the values for these parameters.

> Note: If you are editing the main nextflow.config in the install folder, make sure to update the existing paths to these variables rather then adding new ones.

```nextflow
params {
    // Container for main pipeline functions 
    tg_conda_env=</path/to/conda1>
    
    // Container for cellprofiler
    cpr_conda_env=</path/to/conda2>
}
```

### Setup your HPC configuration & profiles
> If you are running locally for small imagesets, you can skip this and use `-profile local`

#### Updating process definitions (queues)
Not all HPC configurations are the same, to be able to use them, you may need to update the process defintions. Process requirements are handled in the pipeline through labels. A full list can be found in conf/processes.config. 


##### Option 1: Update the existing labels
With a find-replace it should be quick to update. Its likely you will need to update the 'queue' arguments to match your HPC config and the 'clusterOptions' for the GPU tags. Updating the GPU process is only needed if you are using GPU proccess (which is a good idea).

There are a couple of ways you can do this:

1. Update the conf/processes.config in the repo directly (reccomended for multi-user installs)
2. Override the settings 'conf/processes.config' by adding a 'process {}' block to your instance config file
3. Create a new config file with your process definitions and including (sourcing) it in your instance config file (-c)

The currently configured queue names are:
- 'imaging': Can likely be updated to a 'normal' queue, does not need anything special
- 'normal': For normal jobs <12 hours
- 'gpu-normal': For normal jobs <12 hours with GPU support

Labels follow a rough naming scheme from tiny, small, normal, normal_plus, medium, himem with flavour '_img' for the imaging queue and flavour 'gpu_' for GPU jobs. 

##### Option 2: Create new labels
You can also create your own process labels instead of updating the existing ones. The label a process runs with can be configured through the `params.<process>_label` configuration parameter. Just add your own labels to the `process{}` nextflow block in your configuration, and update it with the label configuration.


#### Updating exectuter & profile
You can find Nextflow profile configurations for most major research institutes here: https://nf-co.re/configs/ 

To add a profile to the pipeline you save the file in the conf folder, for instance 'conf/my_profile.config'. You can then add a profiles{} block to your run config (or add my_profile to the main nextflow.config).

```nextflow
profile {
    my_profile { includeConfig 'conf/my_profile.config' }
}
```

See more details on configuration of Nextflow here: https://www.nextflow.io/docs/latest/config.html


## 3. Adapt the main runner script (optional)

The pipeline comes bundled with a runner script, which is fully optional, but makes running instances much easier. However, at the moment its geared towards the Sanger's farm22 compute, so needs a few updates to work with different configurations. 

The bits you need to configure are at the start and end of the script, tagged by and anotated with inline comments.

```
#-----------------------------------------------------------------------
#                 Update these for your installation
#-----------------------------------------------------------------------
```

To use the script, you will need to update it to:

 1. Update sourcing of nextflow "module load HGI/common/nextflow/25.04.6"
 2. Update the path to the 'main.nf' file in this repo
 3. Update any enviroment variables like 'NXF_SINGULARITY_CACHEDIR'
 4. Update the submit command if you don't have the LSF scheduler but something else replace the submit command for your scheduler at 'CMD="bsub -n 1 '


Then you can make sure the script is executable and add the repo folder to your path in your bashrc
```bash
export PATH="$PATH:/path/to/repo/tglow-pipeline"
```

You can then use this script to submit runs directly as follows:
```bash
tglow-pipeline run_pipeline -c my_config.config -l
```

Script usage:
```
Usage: 
tglow-pipeline <stage|run_pipeline> [-c <file.nf>] [-p <profile>] [-l] -- [nextflow pipeline args]

<stage|run_pipeline>            The workflow to run
-c                              <path/to/config.nf> Nextflow config file for the run
-p                              <profile> Nextflow profile for the run [local|lsf|lsf_ignore_errors]
-l                              Run nextflow locally instead of submitting to oversubscribed
-- The rest is passed to nextlfow and overrides -c

Examples:
tglow-pipeline run_pipeline -c conf.nf -l

# Override settings in conf.nf
tglow-pipeline run_pipeline -c conf.nf -- --rn_manifest rn_manifest.tsv --rn_wells A1,B2,C3
```

## 4. Run the guided example to test your install

Next, I would reccomend to run the [guided example](guided-example.md) to test if your installation and configuration is working properly and there are no issues.


# I cannot use conda, what do I do?
If you cannot use Conda on your HPC system if its disabled, it may be possible to build your own (singularity) containers instead and installing the pip packages listed above, but creating these containers is currently not covered by these install instructions, and as of writing this I have not tested this. Please see https://www.nextflow.io/docs/latest/reference/config.html for more details on available options in Nextflow. Once you have created your two containers you can set them in your config file by populating:

```nextflow
params {
    // Container for main pipeline functions 
    tg_container=</path/to/container>
    
    // Container for cellprofiler
    cpr_container=</path/to/container>
}
```

and setting:

```nextflow
conda.enabled = false
singularity.enabled = true
```

**Background reading**
- https://www.nextflow.io/docs/latest/process.html#directives
- https://www.nextflow.io/docs/latest/reference/config.html
- https://www.nextflow.io/docs/latest/reference/process.html#process-container 


