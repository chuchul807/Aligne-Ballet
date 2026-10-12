import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import type { BodyRegion, Observation } from '../domain/types';
import { ARABESQUE_RULES } from '../rules/arabesqueRules';
import { ATTITUDE_RULES } from '../rules/attitudeRules';
import { COMMON_RULES } from '../rules/commonRules';
import { RETIRE_RULES } from '../rules/retireRules';
import { A_LA_SECONDE_RULES } from '../rules/aLaSecondeRules';
import { TENDU_CROISE_RULES } from '../rules/tenduCroiseRules';
import { FEEDBACK_COPY, isSafeFeedbackText } from './copy';
import { composeFeedback, type AssessmentCoverage } from './composeFeedback';
import { Disclaimer } from '../ui/Disclaimer';

const regions: readonly BodyRegion[] = [
  'supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet',
];

const allRegionsAssessable: AssessmentCoverage = {
  'supporting-leg': 'assessable',
  'working-leg': 'assessable',
  pelvis: 'assessable',
  torso: 'assessable',
  'shoulders-arms': 'assessable',
  head: 'assessable',
  feet: 'assessable',
};

function observation(overrides: Partial<Extract<Observation, { assessability: 'assessable' }>>): Observation {
  return {
    id: 'observation-id',
    ruleId: 'pelvis-unlevel',
    dedupeKey: overrides.dedupeKey ?? overrides.ruleId ?? 'pelvis-level',
    region: 'pelvis',
    priority: 'structure',
    confidence: 'high',
    evidence: [],
    annotation: [],
    assessability: 'assessable',
    issue: 'Visible issue.',
    action: 'Correct it.',
    direction: 'correct it',
    severity: 0.5,
    ...overrides,
  };
}

describe('composeFeedback', () => {
  it('orders stability before structure before line and returns at most three', () => {
    const lineIssue = observation({ id: 'line', ruleId: 'shoulders-unlevel', priority: 'line', severity: 1 });
    const structureIssue = observation({ id: 'structure', ruleId: 'pelvis-unlevel', priority: 'structure', severity: 0 });
    const stabilityIssue = observation({ id: 'stability', ruleId: 'supporting-knee-bent', priority: 'stability', severity: 0 });
    const secondLineIssue = observation({ id: 'second-line', ruleId: 'head-extreme-lateral-tilt', region: 'head', priority: 'line', severity: 0 });

    const summary = composeFeedback([lineIssue, structureIssue, stabilityIssue, secondLineIssue], allRegionsAssessable);

    expect(summary.topCorrections.map((item) => item.priority)).toEqual(['stability', 'structure', 'line']);
    expect(summary.topCorrections.map((item) => item.direction)).toEqual(['correct it', 'correct it', 'correct it']);
  });

  it('uses severity then rule ID as stable tie breakers', () => {
    const lowerSeverity = observation({ id: 'a', ruleId: 'supporting-knee-bent', dedupeKey: 'a', priority: 'stability', severity: 0.1 });
    const higherSeverity = observation({ id: 'b', ruleId: 'torso-off-support', dedupeKey: 'b', region: 'torso', priority: 'stability', severity: 0.9 });
    const sameSeverityLaterRule = observation({ id: 'c', ruleId: 'torso-off-support', dedupeKey: 'c', region: 'torso', priority: 'stability', severity: 0.9 });

    const summary = composeFeedback([sameSeverityLaterRule, lowerSeverity, higherSeverity], allRegionsAssessable);

    expect(summary.topCorrections.map((item) => item.observationId)).toEqual(['c', 'b', 'a']);
  });

  it('orders different rule IDs alphabetically when priority and severity tie', () => {
    const laterRule = observation({ id: 'later', ruleId: 'torso-off-support', region: 'torso', priority: 'stability', severity: 0.5 });
    const earlierRule = observation({ id: 'earlier', ruleId: 'supporting-knee-bent', priority: 'stability', severity: 0.5 });

    const summary = composeFeedback([laterRule, earlierRule], allRegionsAssessable);

    expect(summary.topCorrections.map((item) => item.observationId)).toEqual(['earlier', 'later']);
  });

  it('withholds medium and low confidence and marks their regions as insufficient evidence', () => {
    const mediumPelvisIssue = observation({ id: 'medium', confidence: 'medium' });
    const lowShoulderIssue = observation({ id: 'low', ruleId: 'shoulders-unlevel', region: 'shoulders-arms', priority: 'line', confidence: 'low' });

    const summary = composeFeedback([mediumPelvisIssue, lowShoulderIssue], allRegionsAssessable);

    expect(summary.topCorrections).toEqual([]);
    expect(summary.topCorrections.some((item) => item.observationId === lowShoulderIssue.id)).toBe(false);
    expect(summary.fullBodyReview.find((section) => section.region === 'pelvis')).toMatchObject({
      status: 'unassessable',
      items: [{ text: 'Not enough evidence in this photo to recommend a change.' }],
    });
  });

  it('reports actionable findings, clear regions, and unassessable regions separately', () => {
    const summary = composeFeedback(
      [observation({ id: 'pelvis-finding' }), observation({ id: 'low-head', ruleId: 'head-extreme-lateral-tilt', region: 'head', priority: 'line', confidence: 'low' })],
      { ...allRegionsAssessable, feet: 'unassessable' },
    );

    expect(summary.fullBodyReview.find((section) => section.region === 'pelvis')).toMatchObject({ status: 'finding', items: [{ observationId: 'pelvis-finding' }] });
    expect(summary.fullBodyReview.find((section) => section.region === 'head')).toMatchObject({ status: 'unassessable', items: [{ text: 'Not enough evidence in this photo to recommend a change.' }] });
    expect(summary.fullBodyReview.find((section) => section.region === 'feet')).toMatchObject({ status: 'unassessable', items: [{ text: 'Unable to assess this area reliably because the joint may be obscured or inconsistent.' }] });
  });

  it('covers every exported rule with high and medium approved copy', () => {
    const ruleIds = [
      ...COMMON_RULES,
      ...ARABESQUE_RULES,
      ...ATTITUDE_RULES,
      ...RETIRE_RULES,
      ...A_LA_SECONDE_RULES,
      ...TENDU_CROISE_RULES,
    ].map((rule) => rule.id);
    expect(Object.keys(FEEDBACK_COPY).sort()).toEqual([...ruleIds].sort());
    for (const ruleId of ruleIds) {
      expect((FEEDBACK_COPY as Record<string, { high: string; medium: string }>)[ruleId]).toEqual({ high: expect.any(String), medium: expect.any(String) });
    }
  });

  it('keeps user-facing copy free of prohibited medical and numeric language', () => {
    const userFacingCopy = [
      ...Object.values(FEEDBACK_COPY).flatMap((variants) => [variants.high, variants.medium]),
      'No visible issue found in this view.',
      'Unable to assess this area reliably because the joint may be obscured or inconsistent.',
      'Not enough evidence in this photo to recommend a change.',
      'This feedback supports practice and does not replace guidance from a qualified ballet teacher.',
    ];

    for (const text of userFacingCopy) {
      expect(isSafeFeedbackText(text)).toBe(true);
    }
  });

  it.each([
    '30 degrees',
    '20 percent',
    'degree',
    'percentages',
    'Use ° for this angle.',
    'Confidence: %.',
  ])('rejects forbidden numeric or unit language: %s', (text) => {
    expect(isSafeFeedbackText(text)).toBe(false);
  });

  it.each([
    'Lengthen your working leg back and slightly upward.',
    'No visible issue found in this view.',
  ])('allows safe feedback text: %s', (text) => {
    expect(isSafeFeedbackText(text)).toBe(true);
  });

  it('renders the approved practice disclaimer', () => {
    render(createElement(Disclaimer));
    expect(screen.getByText('This feedback supports practice and does not replace guidance from a qualified ballet teacher.')).toBeInTheDocument();
  });
});
