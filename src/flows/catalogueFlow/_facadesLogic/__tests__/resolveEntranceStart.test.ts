import { ENTRANCE_NOT_STARTED, resolveEntranceStart } from '@flows/catalogueFlow/_facadesLogic/resolveEntranceStart'

describe('resolveEntranceStart', () => {
  it('starts the entrance at the first frame that has boxes', () => {
    expect(resolveEntranceStart(ENTRANCE_NOT_STARTED, 5000, 8)).toBe(5000)
  })

  it('does not start without boxes', () => {
    expect(resolveEntranceStart(ENTRANCE_NOT_STARTED, 5000, 0)).toBe(ENTRANCE_NOT_STARTED)
  })

  it('keeps the start once set', () => {
    expect(resolveEntranceStart(5000, 9000, 8)).toBe(5000)
  })
})
