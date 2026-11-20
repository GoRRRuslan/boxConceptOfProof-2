import { createSharedValue } from '@services/sceneSync/createSharedValue'

describe('createSharedValue', () => {
  it('returns the initial value and the last written value', () => {
    const sharedValue = createSharedValue(3)

    expect(sharedValue.getBlocking()).toBe(3)

    sharedValue.setBlocking(7)

    expect(sharedValue.getBlocking()).toBe(7)
  })
})
