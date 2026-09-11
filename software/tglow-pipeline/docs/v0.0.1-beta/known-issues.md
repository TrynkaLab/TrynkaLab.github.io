# Known issues

> Note: This pipeline was developed and tested on Sanger's FARM-22 which has runs with IBM LSF as the scheduler, CentOS, NVIDIA A100, TeslaV100 or H100 GPUs on Cuda 12.6. Running elsewhere may require adjustments to Nextflow configuration.

## CLIJ2 non-circulant (NC)
We encountered an installation issue with  clij2-fft NC implementation which causes the decon to return blank images. If this happens, check the deconvolution jobs log, if you see the following, this is likely the issue:

```
2026-01-23 13:05:34,002 Deconvoluting field 1 channel 0

platform 0 NVIDIA CUDA
device name 0 NVIDIA A100-SXM4-80GB
2026-01-23 13:05:37,053 dtype: float32 max: 92.06897735595703
2026-01-23 13:05:37,053 Deconvoluting field 1 channel 1
Runtime error: ret returned -9999 at /home/bnorthan/code/i2k/clij/clij2-fft/native/clij2fft/clij2fft.cpp:1269
```

We have put together a fork of the clij2-fft repository with a fix that worked for us, so please see those [install](https://github.com/TrynkaLab/clij2-fft) the patched version instead if you encounter this issue. 

For more background and a discussion with the developer on the topic see:  https://github.com/clij/clij2-fft/issues/34 and https://forum.image.sc/t/issues-with-python-version-of-clij2-richardson-lucy-nc/101300

This may have been solved in newer released versions (>0.29) of clij2-fft, or may not be a problem on your system, we are not exactly sure what is causing this. 

## Issues with file permissions on multi-user enviroments
In some cases when using scratch space for finalizing images, group permissions cannot be maintained properly. This can cause crashes for reading images, as the user 1's default group may not align with user 2's default group. In this case when user 2 attempts to run the pipeline you may get crashes like:

```
2026-02-04 15:35:33,165 Writing max projection as individual files, not saving z-stacks
2026-02-04 15:35:33,165 --scaling_factors filepath is none, returning none
2026-02-04 15:35:33,165 --scaling_bias filepath is none, returning none
2026-02-04 15:35:33,165 --scaling_slope filepath is none, returning none
Traceback (most recent call last):
  File "/software/teamtrynka/installs/tglow-pipeline/dev/beta/bin/stage_cellprofiler.py", line 236, in <module>
    runner=MergeAndAlign(args)
  File "/software/teamtrynka/installs/tglow-pipeline/dev/beta/bin/stage_cellprofiler.py", line 62, in __init__
    self.provider = ProcessedImageProvider(path=args.input,
  File "/software/teamtrynka/installs/tglow-core/src/tglow/io/processed_image_provider.py", line 76, in __init__
    self.plate_reader=AICSImageReader(self.path, plates_filter=self.plates, blacklist=blacklist)
  File "/software/teamtrynka/installs/tglow-core/src/tglow/io/tglow_io.py", line 257, in __init__
    self.__build_index__()
  File "/software/teamtrynka/installs/tglow-core/src/tglow/io/tglow_io.py", line 342, in __build_index__
    filename = os.path.basename(os.path.normpath(fields[0]))
IndexError: list index out of range
```

The source of this is a permission issue on the results/images folder. To prevent this from happening when using scratch storage, set your default group prior to running with `newgrp <your_group>`. To fix it if it has already happened, run the appropriate `chown -R results <user>:<group>` to ensure this works properly. 

Alternatively, setting `rn_scratch=false` should also solve the problem for future runs, as now the workdir lives in the target filesystem which should have the right group.


## Flatfield estimation is not working well (basicpy / polynomial)
Basicpy can be sensitive to cell density and it seems to work best if you have lots of foreground signal. For sparse datasets consider fitting a global flatfield across plates (`--bp_global_flatfield`) or using alternate modes like "POLY". See the docs/parameters.md page for available parameters, and  [5 Understanding output](understanding-output.md) for more details on tweaking the settings. 

Sometimes flatfields are not that strong, making it hard to estimate them. If you are unsure after tweaking the results and looking at the validation plots if a flatfield is good or not, you can always consider to skip it for certain channels. If its hard to see, its likely not that big of a problem (but always do your own checks). As a general rule, the longer wavelengths have less of a flatfield. On the Phenix we see a very strong flatfield in the 375 somewhat of a flatfield in 488, but for 561 and 640 we need quite a lot of data to fit it.




