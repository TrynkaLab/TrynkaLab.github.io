# Known issues

> This pipeline was developed and tested on Sanger's FARM-22 cluster (IBM LSF
> scheduler, NVIDIA A100, Tesla V100 and H100 GPUs with CUDA 12.6). Running
> elsewhere may require adjustments to the Nextflow configuration.

## Blank images after deconvolution (clij2-fft non-circulant)

We encountered an installation issue with the clij2-fft non-circulant
(`dc_mode = "clij2_nc"`) implementation that makes deconvolution return blank
images. If this happens, check the log of a deconvolution job. If you see
something like the following, this is likely the issue:

```text
2026-01-23 13:05:34,002 Deconvoluting field 1 channel 0

platform 0 NVIDIA CUDA
device name 0 NVIDIA A100-SXM4-80GB
2026-01-23 13:05:37,053 dtype: float32 max: 92.06897735595703
2026-01-23 13:05:37,053 Deconvoluting field 1 channel 1
Runtime error: ret returned -9999 at /home/bnorthan/code/i2k/clij/clij2-fft/native/clij2fft/clij2fft.cpp:1269
```

The v0.2.0 `environment.yml` installs our
[patched fork of clij2-fft](https://github.com/TrynkaLab/clij2-fft), which fixed
this for us. If you installed clij2-fft from PyPI instead and hit this error,
install the fork.

For background and a discussion with the developer see
[clij2-fft issue 34](https://github.com/clij/clij2-fft/issues/34) and
[this image.sc thread](https://forum.image.sc/t/issues-with-python-version-of-clij2-richardson-lucy-nc/101300).
Newer clij2-fft releases (after 0.29) may have solved it, or it may not
affect your system; we are not sure what causes it.

## File permissions in multi-user environments

When scratch space is used (`rn_scratch = true`, the default), group
permissions are not always kept on the output. If user 1's default group
differs from user 2's, runs by user 2 can crash while reading images, with an
error like:

```text
  File ".../tglow/io/tglow_io.py", line 342, in __build_index__
    filename = os.path.basename(os.path.normpath(fields[0]))
IndexError: list index out of range
```

This is caused by the permissions of the `images` folder. To prevent it, set
your default group before running with `newgrp <your_group>`. To fix it
after it happened, reset the ownership of the results with
`chown -R <user>:<group> <results folder>`.

Alternatively, `rn_scratch = false` avoids the problem, because the work
directory then lives on the target filesystem, which has the right group.

## Flatfield estimation does not work well

Flatfields are hard to estimate from sparse images. For sparse datasets:

- Fit on thresholded foreground (`ff_threshold = true`), or combine several
  images into one by max projection (`ff_merge_n`) to increase the density of
  foreground signal.
- Fit one flatfield across all plates of a cycle with `ff_global_flatfield = true`.
- Use the default polynomial mode (`ff_mode = "POLY"`). BaSiCPy
  (`ff_mode = "BASICPY"`) works best on dense images such as tissue sections.
- If bright debris pulls the fit, summarise the bins with
  `ff_bin_stat = "median"` or `"trimmed"` instead of the default `"mean"`.

See [Understanding output](understanding-output.md#flatfield-estimation) for
how to judge the fits.

Some flatfields are weak, which makes them hard to estimate. If you can't
tell from the evaluation plots whether a flatfield is good, consider skipping
it for that channel (leave the channel out of `ff_channels`). If the effect is
hard to see, it is likely not a big problem, but always do your own checks.
As a rule, longer wavelengths have weaker flatfields. On the Phenix we see a
very strong flatfield at 375 nm, a moderate one at 488 nm, and at 561 and 640
nm we need a lot of data to fit it.
