# A note on statistical assumptions and pvalues

Depending on the feature input space, residuals may be very non-normal and heteroskedastic. The package does not explicitly account for this. We recommend in cases where your distributions are non continuous non-normal to always validate results with a more appropriate modelling approach if possible. However, this mainly applies to p-values produced, generally speaking, effect sizes produced by standard linear models can still be useful. We do recommend when modelling on the single cell level to always apply mixed models accounting for the well the cells derive from as a random effect.

The examples below use `data(tglow_example)`. Its `@image.meta` has the columns `drug` (`DMSO` or `drug`), `dose`, `donor` (`D1`-`D3`) and `well`, which are used as covariates. Note that in this example the drug is only applied in donor `D2`.

```r
library(tglowr)
data(tglow_example)
tglow <- scale_dataset(tglow, assay="raw")
```

# Modelling linear effects with OLS

Features can be modelled using least squares regression using the function `calculate_lm()`. It fits the model for each feature in the specified assay.

```r
calculate_lm(dataset, assay, slot, covariates, formula=NULL, formula.null=NULL, grouping=NULL, ...)
```

- `assay` and `slot` are required and define the responses.
- `covariates` are the predictors. They can be columns in `@meta`, `@image.meta` or features in an assay (by default the same assay and slot, set with `assay.covar` and `slot.covar`).
- `formula` defaults to an additive model of all covariates. The formula has no response, for example `~ drug + donor`. Pass a formula object; a character string works but gives a warning.

```r
res <- calculate_lm(tglow, assay="raw", slot="scale.data",
                    covariates=c("drug", "donor"),
                    formula=~ drug + donor)

res$coef["cell_AreaShape_Area", ]
res$pval["cell_AreaShape_Area", ]
head(res$model.stats)
```

The result is a list of class `tglowlm` with:

- `coef`, `se`, `pval`: matrices with one row per feature and one column per model term.
- `model.stats`: a data.frame per feature with `r2`, `adj.r2`, `f-stat`, `p-value`, `df`, `rss`, `tss` and `ll` (log-likelihood, only calculated when `formula.null` is set).
- `df`: residual degrees of freedom.
- `mse`: mean squared error per feature.

Note NA's are not tolerated in the design matrix so these are removed, with a warning saying how many objects were dropped. Any NA's in the feature space will result in NA's in the output. The implementation is optimized to re-use components from the design matrix, which makes it quick and scalable to millions of cells, but also hard to do a pairwise NA removal. It is on the list to look at how to implement this, in the meantime you can either write a simple wrapper with `lm` or `lm.fit` or pre-remove NA's for the whole dataset.

## Likelihood ratio tests

Set `formula.null` to test the full model against a reduced model. The null model must be nested in the full model, so every term in `formula.null` must also be in `formula`. The results are added as `res$lrt`, a data.frame per feature with `ll.full`, `ll.red`, `lrt.chisqr`, `lrt.chisqr.pval`, `lrt.f`, `lrt.f.pval` and `df`. The F-test is more accurate for small sample sizes. An intercept-only null model (`formula.null=~ 1`) is allowed; its own `f-stat` and `p-value` in `model.stats` are NA.

```r
# Test the effect of drug, accounting for donor
res <- calculate_lm(tglow, assay="raw", slot="scale.data",
                    covariates=c("drug", "donor"),
                    formula=~ drug + donor,
                    formula.null=~ donor)

head(res$lrt[order(res$lrt$lrt.f.pval), ])
```

## Grouping

`grouping` is a vector of length `nrow(dataset)`. A separate model is fit for each group, and the result is a list with one `tglowlm` per group. `rescale.group=TRUE` re-centers and re-scales the features within each group before fitting (default `FALSE`).

```r
donor <- getDataByObject(tglow, "donor")
res <- calculate_lm(tglow, assay="raw", slot="scale.data",
                    covariates=c("drug", "cell_AreaShape_Area"),
                    formula=~ drug + cell_AreaShape_Area,
                    grouping=donor)

names(res)        # "D2" "D3" "D1"
res$D2$coef
```

Terms that are constant within a group (here `drug` in `D1` and `D3`) are dropped from that group's model with a warning. With `formula.null`, the LRT degrees of freedom use the columns that were actually fitted. If the full model has no extra parameters left after dropping, that group's LRT is NA, with a warning.

## Correcting for factors in the featurespace

Using functions `correct_lm()` and `correct_lm_per_featuregroup()` it is possible to create a new assay which has the effects of certain covariates regressed out. The residuals are stored in the `data` slot of the new assay and `scale.data` is filled automatically with the scaled residuals.

`correct_lm()` corrects all features for the same covariates. The output assay is called `<assay>.lm.corrected` (set with `assay.out`).

```r
tglow <- correct_lm(tglow, assay="raw", slot="scale.data", covariates="donor")
tglow$raw.lm.corrected
```

`covariates.dont.use` fits the model with these covariates but does not remove their effect from the residuals. For example, to remove the donor effect while keeping the drug effect:

```r
tglow <- correct_lm(tglow, assay="raw", slot="scale.data",
                    covariates=c("drug", "donor"),
                    covariates.dont.use="drug",
                    assay.out="raw.donor.corrected")
```

`correct_lm_per_featuregroup()` corrects different groups of features for different covariates. `covariates.group` is a named list: each name is a grep pattern selecting features, and each value is the covariates to correct those features for. The patterns must select non-overlapping features, and a covariate is not regressed against itself. Features not selected by any pattern are NA in the output. The output assay is called `<assay>.lm.corrected.featuregroup`. Set `na.rm=TRUE` to drop objects with NA covariates for a group, otherwise NA's give an error.

```r
# Correct cell features for cell area and nucleus features for nucleus area
tglow <- correct_lm_per_featuregroup(tglow, assay="raw", slot="scale.data",
                                     covariates.group=list(
                                       "^cell_"="cell_AreaShape_Area",
                                       "^nucl_"="nucl_AreaShape_Area"),
                                     slot.covar="data",
                                     na.rm=TRUE)
tglow$raw.lm.corrected.featuregroup
```

# Modelling linear effects using mixed effects models

Very similar to `calculate_lm()` the function `calculate_lmm()` calculates a mixed effects model instead. This can be a good option to model single cell level effects and get accurate pvalues as the underlying data structure can be better accounted for. The tradeoff is computational cost, so in practice you may want to run it on a subset of features. The function `calculate_lmm()` calls `lmerTest::lmer()` to run the model.

Unlike `calculate_lm()`, the formula is passed as a character string without the response. A formula object is converted with a warning. Note that `rescale.group` defaults to `TRUE` here, unlike `calculate_lm()`.

```r
# A small subset of features to keep it fast
tglow.sub <- tglow[, c("cell_AreaShape_Area", "cell_AreaShape_Perimeter", "cell_AreaShape_Eccentricity")]

res <- calculate_lmm(tglow.sub, assay="raw", slot="scale.data",
                     covariates=c("drug", "well"),
                     formula="~ drug + (1|well)")

res$coef
res$pval          # lmerTest p-values
res$model.stats   # r2_cond, r2_marg, singular_reff
```

Instead of using the pvalues from `lmerTest::lmer()` its also possible to perform a likelihood ratio test by setting `formula.null`. It is passed through `...` to `lmm_matrix()`. The LRT results are added to `model.stats` (`lrt_chisqr`, `lrt_p-value`, `lrt_df`, plus `r2_cond_null`, `r2_marg_null` and `singular_reff_null` for the null model), next to the lmerTest p-values in `pval`.

::: warning Use refit=TRUE when testing fixed effects
`refit` defaults to `FALSE`, which compares the REML fits. REML likelihoods are not comparable between models with different fixed effects, so the test is not valid in that case (on `tglow_example` it returns a chi-square of 0 and a p-value of 1). Set `refit=TRUE` to refit both models with maximum likelihood when the null model drops fixed effects.
:::

```r
res <- calculate_lmm(tglow.sub, assay="raw", slot="scale.data",
                     covariates=c("drug", "well"),
                     formula="~ drug + (1|well)",
                     formula.null="~ (1|well)",
                     refit=TRUE)

res$model.stats[, c("lrt_chisqr", "lrt_p-value", "lrt_df")]
```

Singular fits are not reported as warnings. Check the `singular_reff` (and `singular_reff_null`) columns in `model.stats`. Many singular fits suggest the random effect structure is too complex for the data.

## Correcting for factors in the featurespace with mixed models

There is no `correct_lmm()` wrapper. To get the residuals of a mixed model, set `residuals.only=TRUE`, which `calculate_lmm()` passes on to `lmm_matrix()`. This returns a matrix of residuals with one row per object and one column per feature.

```r
resid <- calculate_lmm(tglow.sub, assay="raw", slot="scale.data",
                       covariates=c("drug", "well"),
                       formula="~ drug + (1|well)",
                       residuals.only=TRUE)
```

You can add this matrix as a new assay yourself, see [operations on a TglowDataset](operations-on-tglowdataset.md).
