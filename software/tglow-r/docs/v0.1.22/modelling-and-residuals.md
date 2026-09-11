# A note on statistical assumptions and pvalues

Depending on the feature input space, residuals may be very non-normal and heteroskedastic. The package does not explicitly account for this. We recommend in cases where your distributions are non continuous non-normal to always validate results with a more appropriate modelling approach if possible. However, this mainly applies to p-values produced, generally speaking, effect sizes produced by standard linear models can still be useful. We do recommend when modelling on the single cell level to always apply mixed models accounting for the well the cells derive from as a random effect.

# Modelling linear effects with OLS

Features can be modelled using least squares regression using the function `calculate_lm()` which takes a TglowDataset, a vector of predictors, and an optional formula of how the predictors should relate (defaults to additive). It will then fit the least squares fit on this model for each feature in the specified assay. Note NA's are not tolerated in the design matrix so these are removed. Any NA's in the feature space will result in NA's in the output. The implementation is optimized to re-use components from the design matrix, which makes it quick and scalable to millions of cells, but also hard to do a pairwise NA removal. It is on the list to look at how to implement this, in the meantime you can either write a simple wrapper with `lm` or `lm.fit` or pre-remove NA's for the whole dataset.

## Correcting for factors in the featurespace

Using functions `correct_lm()` and `correct_lm_per_featuregroup()` it is possible to create a new assay which has the effects of certain covariates regressed out.

# Modelling linear effects using mixed effects models

Very similar to `calculate_lm()` the function `calculate_lmm()` calculates a mixed effects model instead. This can be a good option to model single cell level effects and get accurate pvalues as the underlying data structure can be better accounted for. The tradeoff is computational cost. The function `calculate_lmm()` calls `lmerTest::lmer()` to run the model. Instead of using the pvalues from `lmerTest::lmer()` its also possible to perform a likelihood ratio test by setting `formula.null`.

## Correcting for factors in the featurespace with mixed models

It is currently not possible to do this with mixed models.
