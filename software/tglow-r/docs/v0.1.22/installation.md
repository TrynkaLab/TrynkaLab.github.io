# Installation from source

> NOTE: For Sanger farm22 users see instructions below

This will install the latest development version, we don't yet have a release, but for stability you can checkout a specific commit using the `ref` argument in `remotes::install_git()`

If you need to build some dependencies from source, make sure there is a BLAS/LAPACK, nlopt (nlopt), libxml2 (igraph) lib available if it isn't already, otherwise dependencies likely will not install. However this will depend heavily on your setup. Below is a minimal example using conda.

```bash
conda install -c conda-forge blas lapack nlopt libxml2
conda install R
```

Then launch R

```r
if (!requireNamespace("remotes", quietly = TRUE)) {
  install.packages("remotes")
}
remotes::install_git("https://github.com/TrynkaLab/tglow-r.git")
```

This unlocks all of the core functionality

#### Installing suggested packages

There are several suggested packages that enable additional functionality relating to visualizing images. These are outlined below.

##### ggrastr - Rasterizing large plots

To enable rasterization of plots with many points (this is fully optional, and plotting will work without it)

```bash
# Optional if installing ggrastr to enable rasterization of plots with many points
conda install -c conda-forge r-ragg
```

Then launch R

```r
install.packages("ggrastr")
```

##### EBImage and ggiraph - Visualizing cells and Interactive plots

To enable visualizing images and making interactive plots EBImage, hdf5r, png, base64enc and ggiraph packages are required

```r
install.packages("png")
install.packages("base64enc")
install.packages("ggiraph")
install.packages("hdf5r")

if (!requireNamespace("BiocManager", quietly = TRUE)) {
   install.packages("BiocManager")
}
BiocManager::install("EBImage")
```

For detailed install instructions for ggiraph see: https://davidgohel.github.io/ggiraph/

# Installing on Sanger farm22 - latest dev version

A version compatible with the tglow-r softpack module comes pre-installed in `/software/teamtrynka/installs/tglow-rlibs` and can be loaded as such.

#### Option 1: Using pre-installed version (recommended)

> NOTE: The version here changes often at the moment, so might not be the most stable.

```bash
module load HGI/softpack/groups/cell_activation_tc/tglow-r/10
```

Then launch R.

```r
library(tglowr, lib="/software/teamtrynka/installs/tglow-rlibs")
```

#### Option 2: Installing into your personal library from git

Alternatively you can install if using R from the headnode or jammy64 directly through gitlab. This module should have all dependencies pre-installed.

```bash
module load HGI/softpack/groups/cell_activation_tc/tglow-r/10
```

Then launch R.

```r
install.packages("remotes")
remotes::install_git("https://github.com/TrynkaLab/tglow-r.git")
```
