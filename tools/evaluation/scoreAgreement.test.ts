import { describe, expect, it } from 'vitest';
import { scoreAgreement } from './scoreAgreement';

const caseWithTwoMatches = {
  id: 'arabesque-two-matches',
  position: 'arabesque' as const,
  supportingSide: 'left' as const,
  assessable: true,
  expectedTop3: [
    { region: 'working-leg' as const, direction: 'lift-working-leg' },
    { region: 'pelvis' as const, direction: 'level-pelvis' },
    { region: 'torso' as const, direction: 'lengthen-torso' },
  ],
  actualTop3: [
    { region: 'pelvis' as const, direction: ' LEVEL_PELVIS ' },
    { region: 'working-leg' as const, direction: 'lift working leg' },
    { region: 'feet' as const, direction: 'point-feet' },
  ],
};

describe('scoreAgreement', () => {
  it('counts a photo as matched when two of three normalized region-and-direction pairs agree', () => {
    const report = scoreAgreement([caseWithTwoMatches]);

    expect(report).toMatchObject({
      assessableCount: 1,
      matchedCount: 1,
      rate: 1,
      passesTarget: true,
    });
  });

  it('uses the inclusive 80 percent release target', () => {
    const cases = Array.from({ length: 10 }, (_, index) => ({
      ...caseWithTwoMatches,
      id: `case-${index}`,
      actualTop3: index < 8 ? caseWithTwoMatches.actualTop3 : [{ region: 'feet' as const, direction: 'point-feet' }],
    }));

    const report = scoreAgreement(cases);

    expect(report.rate).toBe(0.8);
    expect(report.passesTarget).toBe(true);
  });

  it('excludes unassessable photos from agreement and reports their quality-gate accuracy separately', () => {
    const report = scoreAgreement([
      caseWithTwoMatches,
      { ...caseWithTwoMatches, id: 'rejected-correctly', assessable: false, actualTop3: [] },
      { ...caseWithTwoMatches, id: 'rejected-incorrectly', assessable: false, actualTop3: [{ region: 'pelvis', direction: 'level-pelvis' }] },
    ]);

    expect(report).toMatchObject({
      assessableCount: 1,
      matchedCount: 1,
      unassessableCount: 2,
      correctlyRejectedCount: 1,
      qualityGateRate: 0.5,
    });
  });

  it('does not let duplicate labels count as two matches', () => {
    const report = scoreAgreement([{
      ...caseWithTwoMatches,
      actualTop3: [
        { region: 'pelvis', direction: 'level-pelvis' },
        { region: 'pelvis', direction: 'level-pelvis' },
      ],
    }]);

    expect(report).toMatchObject({ matchedCount: 0, rate: 0, passesTarget: false });
  });

  it('has no passing primary rate or quality-gate rate when its denominator is zero', () => {
    const report = scoreAgreement([]);

    expect(report).toMatchObject({ assessableCount: 0, rate: 0, passesTarget: false, unassessableCount: 0, qualityGateRate: null });
  });

  it('keeps the primary gate false while calculating an unassessable quality-gate rate without assessable photos', () => {
    const report = scoreAgreement([{ ...caseWithTwoMatches, assessable: false, actualTop3: [] }]);

    expect(report).toMatchObject({ assessableCount: 0, rate: 0, passesTarget: false, unassessableCount: 1, qualityGateRate: 1 });
  });
});
