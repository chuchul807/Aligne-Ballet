# Real-photo agreement review

This protocol is the product acceptance check for ALIGNÉ's feedback quality. It uses only photos the product owner owns or has explicit permission to use.

1. Collect owned or explicitly licensed photos for Arabesque, Attitude derrière, Retiré / Passé, À la seconde, and Tendu croisé devant. Include acceptable work, common errors, large but assessable beginner deviations, crops, occlusion, poor lighting, unsupported views, and multi-person scenes.
2. Before viewing system output, label each photo as assessable or unassessable. For each assessable photo, record up to three expected body-region and canonical direction-code pairs from [`directionCodes.ts`](directionCodes.ts); do not use displayed feedback prose as a code source.
3. Run every photo through the app with its prescribed position and supporting side. In the evaluation runner, pass the returned `AnalysisResult` to `actualTop3FromAnalysisResult(result)` and record that return value as `actualTop3`.
4. Validate each record with `labelledCaseSchema`, then run `scoreAgreement`. The adapter obtains canonical actual direction codes from its audited `ruleId` through the centralized codebook; its retained `direction` field is natural-language context only.
5. Use this minimal evaluation-runner shape:

   ```ts
   const actualTop3 = actualTop3FromAnalysisResult(result);
   const labelled = labelledCaseSchema.parse({
     id: 'owned-photo-001',
     position: 'arabesque',
     supportingSide: 'left',
     assessable: true,
     expectedTop3: ownerLabels,
     actualTop3,
   });
   const report = scoreAgreement([labelled]);
   ```

6. Accept the MVP only when at least 80% of assessable photos have two or more Top 3 matches. A match requires the same body region and normalized canonical direction code. Review unassessable photos through the separate `qualityGateRate`; a correct rejection has no Top 3 corrections.
7. In a later calibration round, replace or calibrate the initial owner labels with labels reviewed by qualified ballet teachers and retain the review provenance.

Synthetic fixtures are useful for proving deterministic rule behavior, but they cannot satisfy this human-agreement release criterion. They do not substitute for the owned/licensed, pre-labelled real-photo set.
