# FAQ

## Why not OME-Zarr?

OME-zarr is great, unfortunately it produces a lot of files, which was incompatible with our HPCs filesystems. At least when we initially created this pipeline. We may incorporate OME-zarr support in the future if this restriction eases.

## Why is this pipeline needed?

We largely created this to have high throughput with HPC, flexibility and reproducibility for our exact cyclic process, for which existing solutions were not quite ready at the time. There are some great initiatives out there, like Fractal, which we encourage to check out for more general image processing needs.

## Why use storeDir and not publishDir?

It has been a deliberate design choiche to use storeDir directives over publishDir. Largely this is due to have manual control over the files, which in imaging is very handy on occasion as every dataset is different and sometimes needs some manual tweaking. While using publishDir is more proper Nextflow as it is robust to parameter changes etc, it can create practical complications resulting in unncesseray re-runs. Given some parts, like deconvolution, are computationally very expensive we opted for the caching bassed tracking enabled by storeDir. This may change in the future, but we need to carefully check if caching behaviours work as expected.

This also offered us some benefits in developing, as when making changes to the pipeline code, publishDir can force re-runs, where storeDir would not, which becomes wastefull given the computational expense when (perhaps wrongly :)) actively developing and running analysis. 

## Where can I get help

If you encounter an issue, the best place is the github issue tracker. 
