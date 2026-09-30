# Finalizing results

The files in the `rr__` folders are symbolic links into the Nextflow work
directory. As long as you are still running the pipeline this is what you
want: results update automatically, and `-resume` reuses finished tasks. But
it also means the results disappear if the work directory is removed, and the
work directory usually holds a lot of intermediate files you don't need.

When a project is finished, make a deep copy of the `rr__` folders, in which
every link is replaced by the file it points to. The copy no longer depends
on the work directory, which you can then remove.

::: danger This ends -resume for the project
After the work directory is removed, Nextflow can't reuse any finished
task. A later run with `-resume` recalculates everything downstream of
finalize (processed images, measurements, scaling, CellProfiler, cell crops
and the QC report). The permanent cache folders (images, deconvolution,
flatfields, registration and masks) are not affected and are still reused.

Only finalize when you are done with the project, or accept that a future
run has to redo those steps.
:::

## What to copy

| Folder | Stored as | Action |
|---|---|---|
| `rr__processed_images`, `rr__features`, `rr__scaling`, `rr__cellcrops`, `rr__qc` | symbolic links into the work directory | Deep copy. |
| `images/`, `decon/`, `flatfields/`, `registration/`, `masks/` | real files | Nothing to do; already independent of the work directory. |

## 1. Check the space you need

The deep copy takes as much space as the files the links point to. Check
the size of the linked files first:

```bash
du -shL ../results/rr__*
```

`-L` follows the links, so this is the real size of the data. Consider
leaving out folders you don't need to keep, for example
`rr__processed_images/unscaled` when the scaled images are what you use.

## 2. Make the deep copy

Copy the `rr__` folders into a new folder with `rsync`:

```bash
mkdir -p ../results_final
rsync -rP --copy-links ../results/rr__* ../results_final/
```

- `-r` copies the folders recursively.
- `-P` shows progress and keeps partially copied files.
- If the copy is interrupted, run the command again with `--size-only`
  added. Without it, rsync copies every file again, because `-r` doesn't
  preserve modification times.
- `--copy-links` replaces every symbolic link by a copy of the file it points to.

For large projects, run this as a job on your cluster or in a `screen` or
`tmux` session, since it can take hours.

## 3. Check the copy

Before removing anything, check that the copy is complete and contains no
links:

```bash
# Should print nothing: no links left in the copy
find ../results_final -type l

# Should print nothing: every file in the original has a copy of the same size
rsync -rn --copy-links --size-only --itemize-changes ../results/rr__* ../results_final/

# The sizes should match the du -shL output from step 1
du -sh ../results_final/rr__*
```

If the second command lists files, run the copy from step 2 again with `--size-only`.

## 4. Remove the work directory

Once the copy checks out, remove the work directory and the original,
now useless, `rr__` link folders:

```bash
rm -rf ../workdir
rm -rf ../results/rr__*
```

Optionally move the copies back, so all results are in one place again:

```bash
mv ../results_final/rr__* ../results/
rmdir ../results_final
```

The run history in the `.nextflow/` folder of your launch folder now refers
to tasks that no longer exist. Remove it too (`rm -rf .nextflow`) if you
won't run the pipeline in this project again. The Nextflow logs, reports and
traces in `logs/` are separate files and stay available.

## If you need to run the pipeline again

The finalized folders are regular files. If you start a new run with the
same `rn_publish_dir`, Nextflow publishes the new results over them as links
into the new work directory. To keep the finalized results unchanged, move
them out of `rn_publish_dir` first. Leave the permanent cache folders
(`flatfields/`, `registration/`, `masks/`, and the image folders) where they
are, so the new run can reuse them.

If you only want to free up space during a project, while keeping
`-resume`, clean up old runs instead, see [Cleaning up old runs](cleaning-data.md).
