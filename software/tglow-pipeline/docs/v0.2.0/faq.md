# FAQ

## Why not OME-Zarr?

OME-Zarr is great, but it produces a very large number of files, which was
incompatible with our HPC filesystems when we built this pipeline. We may
add OME-Zarr support in the future if this restriction eases.

## Why is this pipeline needed?

We built it for high throughput on HPC, flexibility and reproducibility for
our cyclic imaging process, for which existing solutions were not quite ready
at the time. There are great initiatives out there, like
[Fractal](https://fractal-analytics-platform.github.io/), which we encourage
you to check out for more general image processing needs.

## Why do some steps use storeDir and others publishDir?

The early steps (staging, flatfield estimation, registration, segmentation
and deconvolution) are computationally expensive, and imaging data often
needs some manual tweaking, such as replacing a flatfield or re-running a
single plate. These steps use Nextflow's `storeDir`: if the output exists,
it is reused, even when parameters or the pipeline code change. This gives
full manual control and avoids expensive re-runs, but you must remove
outputs yourself to force a re-run.

Everything downstream of finalize is cheaper and depends on many inputs, so
since v0.2.0 it uses `publishDir`, in folders prefixed `rr__`. Nextflow
tracks these through its work directory and `-resume`, and re-runs them
automatically when their inputs change. See
[Re-running and caching](running.md#re-running-and-caching).

## Where can I get help?

If you encounter an issue, the best place is the
[GitHub issue tracker](https://github.com/TrynkaLab/tglow-pipeline/issues).
