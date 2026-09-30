# Cleaning up old runs

Every run adds task directories to the Nextflow work directory
(`../workdir` by default). After a few rounds of tuning parameters, most of
it belongs to runs you no longer need, and it can take up a lot of space and file numbers.
`nextflow clean` removes the work directories of old runs, while keeping
what the latest run needs, so you can still continue with `-resume`.

## What is safe to remove

The pipeline stores its results in two ways (see
[Re-running and caching](running.md#re-running-and-caching)):

- **Permanent cache folders** (`rn_image_dir`, `rn_decon_dir`, and
  `flatfields/`, `registration/` and `masks/` in `rn_publish_dir`) contain real
  files, outside the work directory. Cleaning does not affect them.
- **`rr__` folders** contain symbolic links into the work directory. If you
  remove the task directories they point to, the links break and the results
  are gone.

So clean up only runs whose `rr__` results you no longer need. In practice,
that means keeping the latest successful run and removing the rest.

## Keeping the latest successful run

Run the commands below from the folder you launch the pipeline from (the
`scripts/` folder in the [recommended layout](running.md#project-layout)).
Nextflow keeps its run history in the `.nextflow/` folder there.

### 1. Find the run to keep

List the runs of this folder:

```bash
nextflow log
```

```text
TIMESTAMP            DURATION  RUN NAME          STATUS  REVISION ID  SESSION ID                            COMMAND
2026-09-20 10:12:03  2h 3m     happy_curie       OK      a1b2c3d4e5   0f5c...                               nextflow run ... --workflow stage
2026-09-22 09:40:11  14h 5m    angry_lovelace    ERR     a1b2c3d4e5   7e2a...                               nextflow run ... --workflow run_pipeline
2026-09-24 08:02:45  11h 51m   silly_hopper      OK      a1b2c3d4e5   7e2a...                               nextflow run ... --workflow run_pipeline
2026-09-26 16:30:20  5m 12s    tiny_babbage      ERR     a1b2c3d4e5   7e2a...                               nextflow run ... --workflow run_pipeline
```

Pick the most recent `run_pipeline` run. If the latest run has status `OK`, it is safe to run `nextflow clean` with `-but`. if the status is `ERR` A failed run (like
`tiny_babbage` above) can already have replaced some links in the `rr__`
folders with links to its own tasks, which cleaning would then remove. 

In general best practice is to, re-run with `-resume` until the latest run succeeds, and keep that one as this will resolve any staging issues that may occur.

### 2. Check what would be removed

`-n` shows what `nextflow clean` would delete, without deleting anything:

```bash
nextflow clean -n -but silly_hopper
```

`-but <run>` selects every run except the one you name. Tasks that the kept
run reused from earlier runs (shown as cached in its trace) belong to it as
well, and are not removed.

To remove only runs from before a certain run, and keep that run and
everything after it, use `-before <run>` instead of `-but <run>`.

### 3. Clean

When the list looks right, run the same command with `-f` (force) instead of `-n`:

```bash
nextflow clean -f -but silly_hopper
```

This removes the task directories of the other runs and their entries in
the run history.

### 4. Resume as usual

The kept run is now the latest run in the history, so `-resume` continues
from it:

```bash
tglow-pipeline run_pipeline -c my_run.config
```

To resume from a specific run instead, pass its session ID:
`-resume <session id>`. This currently is not implemented in the tglow-pipeline script, so will require a manual override. 

## Tips

- **If in doubt, always do a dry run (`-n`) first.** Cleaning can't be undone.
- **Stage runs** use only permanent cache folders, so their task directories
  can be cleaned without losing the staged images.
- **Keep the history.** Add `-k` (`-keep-logs`) to delete the task files
  but keep the runs listed in `nextflow log`.
- **Several projects in one work directory.** `nextflow clean` only knows
  about the runs in the history of the folder you run it from. Tasks started
  from other launch folders are never removed, so running each project from
  its own folder with its own work directory keeps things simple.
- **Check the result.** After cleaning, `find -L ../results/rr__* -type l`
  lists broken links. It should print nothing. If this does list things, you want to remove the listed items and re-run the pipeline with -resume, 

When the project is finished and you don't need `-resume` any more, you can
make the results independent of the work directory and remove it entirely,
see [Finalizing results](finalizing-results.md).

See the [Nextflow CLI reference](https://www.nextflow.io/docs/latest/reference/cli.html#clean)
for all options of `nextflow clean`.
