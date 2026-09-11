
# Guided tutorial


> This assumes you have successfully installed the pipeline and nextflow is available on your PATH. If you haven't, please follow the install instructions before doing this!

## Performing a test run

Create a new folder and download the example data
```bash
mkdir tglow_example
cd tglow_example

# Download the example data from BioStudies
# https://www.ebi.ac.uk/biostudies/studies/S-BSST2652
wget https://ftp.ebi.ac.uk/pub/databases/biostudies/S-BSST/652/S-BSST2652/Files/TEST_DATA/pipeline_testdata_v1.zip

# Unzip it
unzip pipeline_testdata_v1.zip

# cd into the example scripts folder
cd pipeline_testdata/scripts

# Make sure the script is exectutable
chmod 750 run_pipeline.sh
```

Open the file 'run_pipeline.sh' and update the `NF_FILE` parameter with the path to the pipelines main.nf file.
If you have setup a cluster profile during the install process, you can update the `PROFILE` argument using that profile. By default it will run locally. 
Save the file, and make sure it has execute permission. The execute the pipeline script as follows.

```bash
./run_pipeline.sh
```

And if all is well, it should run and complete. If you are running on your own large dataset, I would reccomend performing a test run with a couple of wells (configurable with `rn_wells`) just to see if all is working as expected before you start a full run. You can also test specific steps by enabling and disabling the `cp_run`, `dc_run`, `cpr_run` and `bp_run` options.

## Evalutate the results
The next step is to evaluate the results and diagnose any issues. The basic checklist looks as follows:
1. Check the flatfields look sensible
2. Check the deconvolution worked as intended
3. Check the masks fit the data well

This can usually be done by downloading the processed images for your test wells and inspecting them in an image viewer like Napari.

Once you have identfied areas of improvement, update the config file and re-run the instance.

## Re-running
If you re-run, make sure to re-name or remove the downstream results folders, otherwise the pipeline will not re-execute processes for which the output already exsits (exception being indexing steps on the cellcrops and processed images). For example, if we want to re-run flatfields:

```
cd ../results

# Moving the output will force a re-run
mv flatfields flatfields_v1

# We also need to move any downstream processes that use the flatfields
mv cellcrops cellcrops_v1
mv processed_images processed_images_v1
mv features features_v1
```

This was a deliberate design choice to allow for more fine grained control, see the FAQ page for more details.  


## Editing the confiuration

You can update the configuration through the file 'inputs/example.config' or by creating your own config file entirely. Below a couple of examples are given how how changing parameters impacts pipeline usage. Because the pipeline uses storeDir, Nextflow will only check if the output files are there, this means you will need to manually manage the chain of IO. For instance, if you decide not to use flatfields, you will need to delete or rename any upstream results such as the `results/processed_images` and `results/features` or `results/cellrcrops`. This may seem cubmersome, but in practice its quite quick to re-name or remove the output. This was a concious decision to enable more manual control, for more details see the FAQ. 


### Updating flatfields
In this case, we have too few images for getting a reliable flatfield estimate, except for channel 2 which looks decent even with just four images. This is because this is the 375 channel in which the flatfield is quite strong. You can edit the manifest and set bp_channels to only include channel 2, in which case the pipeline will skip flatfield estimation for the other channels. 


### Specifiying specific wells to skip
By default we have disabled the blacklist (by setting it too null). Now we want to re-run skipping well D15 from the second plate. To do so, you can provide `rn_blacklist=inputs/blacklist.tsv`. This will remove this well from the list of jobs to consider as well as for the image sampling done during flatfield estimation. You can add as many plate & well combinations as you want. 

> Note: if you do not remove old results from blacklisted wells manually, they will remain in the results folder. The pipeline will not remove them. 


### Specifiying specific wells to run
To select only specific wells, you can use the `rn_wells` option, which takes a comma seperated list of wells to run. It will filter these wells over all plates. So for instance `rn_wells=D15,B04,C12` will select only these 3 wells over all plates. If you want to skip a full plate, you need to edit the manifest and remove the entry there. 

### Tweaking cellpose
It is likely cellpose arguments will need some tweaking for your images. We directly expose the main cellpose settings with the tag `cp_` and refer to the cellpose documentation for more details on what these do. In brief and rough order of importance:
1. Make sure the cell and nucelus sizes are appropriate. They are set as pixels
2. Update the prob_threshold
3. Update the flow_threshold
4. Update cp_min_cell_area and cp_min_nucl_area if the defaults don't work

Note that the cp_downsample automatically updates the cell and nucleus sizes and minimal areas, so set this in terms of the original image dimensions.

To evaluate the goodness of fit, you can download the images in Napari and inspect them, or use a manual gold standard mask to evaluate the quality. We don't currently have a pipeline option for segmentation validation built in.






