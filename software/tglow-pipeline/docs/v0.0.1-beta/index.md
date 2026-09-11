---
title: Trynka Lab
titleSuffix: '| tglow-pipeline'
---

# Introduction

This wiki contains information on how to install, stage, configure and run the `tglow-pipeline`  for analysing HCI imaging plates.

Primary pages:

1. [Installation](installation.md)
2. [Setup & staging data](staging-data.md)
3. [Manifests & configuration](manifests-and-configuration.md)
4. [Configuring & running the pipeline](running.md)
5. [Understanding outputs](understanding-output.md)
6. [Analysing features in R](analyzing-features-in-r.md)
7. [Guided example run](guided-example.md)

Additional resources: [FAQ](faq.md) · [Known issues](known-issues.md) · [Options reference](https://github.com/TrynkaLab/tglow-pipeline/blob/main/docs/parameters.md)

## Design notes

- The Nextflow pipeline runs in two main stages: `stage` (prepare data) and `run_pipeline` (processing).
- Most processes rely on Nextflow `storeDir` as a persistent cache between runs. If outputs exist in the store, tasks are not re-run; remove or re-name store entries to force re-execution.
- Parallelisation is done per-well to avoid many short tasks with high overhead (Conda activation, Python startup).
- The pipeline is field-aware and can handle missing fields across cycles or plates.
- The pipeline does not perform stitching. If you need stitched images, stitch before running the pipeline and disable flatfield estimation, which does not work on pre-stitched images.


