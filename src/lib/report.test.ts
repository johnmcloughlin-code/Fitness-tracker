import { describe, expect, it } from 'vitest';
import { buildClaudeReport } from './report';
import { FIXTURE_END, FIXTURE_START, fixtureData } from './fixtures';

describe('buildClaudeReport', () => {
  const md = buildClaudeReport(fixtureData(), { start: FIXTURE_START, end: FIXTURE_END }, '2026-11-15');

  it('matches the snapshot for a 3-week fixture', () => {
    expect(md).toMatchSnapshot();
  });

  it('has every section, in order', () => {
    const order = ['# Cut Tracker report', '## Weekly summary', '## Daily', '## Strength', '## Latest body scan vs baseline', '## Flags'];
    const idx = order.map((h) => md.indexOf(h));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('computes the expected flags', () => {
    expect(md).toContain('Weeks with loss below 0.5% of bodyweight: 2026-W46');
    expect(md).toContain('Weeks with loss above 1.25% of bodyweight: 2026-W45');
    expect(md).toMatch(/Days with protein < 180 g: 29\/10 \(175 g\), 12\/11 \(175 g\)/);
    expect(md).toContain('Days with no food logged: 07/11');
    expect(md).toMatch(/Exercises down >5% est\. 1RM vs best this cut: Leg press/);
  });

  it('stays compact and has no raw food items', () => {
    const fourWeeks = buildClaudeReport(fixtureData(), { start: FIXTURE_START, end: '2026-11-22' }, '2026-11-22');
    expect(fourWeeks.split('\n').length).toBeLessThan(250);
    expect(md).not.toContain('Post-gym');
  });

  it('escapes pipes and newlines in notes', () => {
    expect(md).toContain('Slept badly / 5 h');
    expect(md).toContain('Wedding; late dinner');
  });
});
