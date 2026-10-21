import { createCoverageMap, type FileCoverageData } from 'istanbul-lib-coverage'
import { describe, expect, it } from 'vitest'
import { mergeFrontendCoverage } from '../../scripts/coverage-merge'

const location = (line: number) => ({
  start: { line, column: 0 },
  end: { line, column: 10 },
})
function file(): FileCoverageData {
  return {
    path: '/project/src/example.ts',
    statementMap: { 0: location(1), 1: location(2) },
    s: { 0: 0, 1: 0 },
    fnMap: {},
    f: {},
    branchMap: {
      0: {
        type: 'if',
        line: 1,
        loc: location(1),
        locations: [location(1), location(2)],
      },
    },
    b: { 0: [0, 0] },
  }
}

describe('combined frontend coverage', () => {
  it('preserves Vitest branch locations omitted by browser source-map remapping', () => {
    const unit = file()
    unit.b[0] = [0, 4]
    const browser = file()
    browser.branchMap[0].locations = [location(1)]
    browser.b[0] = [2]

    const combined = mergeFrontendCoverage(
      { [unit.path]: unit },
      { [browser.path]: browser },
    )

    expect(combined[unit.path].b[0]).toEqual([2, 4])
    expect(
      createCoverageMap(combined).getCoverageSummary().branches,
    ).toMatchObject({ total: 2, covered: 2 })
  })

  it('combines complementary executions into one source file rather than averaging percentages', () => {
    const unit = file()
    unit.s[0] = 1
    const browser = file()
    browser.s[1] = 1

    const combined = mergeFrontendCoverage(
      { [unit.path]: unit },
      { [browser.path]: browser },
    )

    expect(Object.keys(combined)).toEqual([unit.path])
    expect(
      createCoverageMap(combined).getCoverageSummary().statements,
    ).toMatchObject({ total: 2, covered: 2, pct: 100 })
  })

  it('rejects incompatible maps that would silently lose browser branches', () => {
    const unit = file()
    unit.branchMap[0].locations = [location(1)]
    unit.b[0] = [0]
    const browser = file()
    browser.b[0] = [1, 1]

    expect(() =>
      mergeFrontendCoverage({ [unit.path]: unit }, { [browser.path]: browser }),
    ).toThrow('Coverage merge lost branches data')
  })
})
