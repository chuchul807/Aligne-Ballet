# Real-photo agreement review

This protocol is the product acceptance check for ALIGNÉ's feedback quality. It uses only photos the product owner owns or has explicit permission to use.

1. Collect photos for Arabesque, Attitude derrière, and Retiré / Passé. Include acceptable work, common errors, large but assessable beginner deviations, crops, occlusion, poor lighting, unsupported views, and multi-person scenes.
2. Before seeing app output, label each photo as assessable or unassessable and, for assessable photos, record up to three expected corrections as body-region and direction codes.
3. Run each photo through the app with its prescribed position and supporting side. In the evaluation runner, pass the returned `AnalysisResult` to `actualTop3FromAnalysisResult(result)` and record that return value as `actualTop3`. Do not reconstruct directions from the displayed sentence.
4. Direction codes come directly from the triggered rule's `Observation.direction`, retained in `AnalysisResult.topCorrections[].direction`. The paired `ruleId` is retained for audit, but agreement uses only the body region plus normalized direction code.
5. Validate each record with `labelledCaseSchema`, then pass the records to `scoreAgreement`.
6. A minimal evaluation-runner shape is:

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

7. Accept the MVP only when at least 80% of assessable photos have two or more Top 3 matches. A match requires the same body region and the same normalized direction code.
8. Review unassessable photos through the separate `qualityGateRate`; a correct rejection has no Top 3 corrections.
9. In a later calibration round, replace or calibrate the initial owner labels with labels reviewed by qualified ballet teachers and retain the review provenance.

Synthetic fixtures are useful for proving deterministic rule behavior, but they cannot satisfy this human-agreement release criterion. They do not substitute for the owned/licensed, pre-labelled real-photo set.
