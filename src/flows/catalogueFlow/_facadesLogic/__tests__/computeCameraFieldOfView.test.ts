import { CAMERA_DISTANCE, CAMERA_FOCAL_LENGTH_MILLIMETERS, SENSOR_HEIGHT_MILLIMETERS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { computeCameraFieldOfView } from '@flows/catalogueFlow/_facadesLogic/computeCameraFieldOfView'

describe('computeCameraFieldOfView', () => {
  it('gives about 27 degrees for a 24 mm sensor behind a 50 mm lens', () => {
    expect(computeCameraFieldOfView()).toBeCloseTo(26.99, 1)
  })

  it('makes the visible world height at the camera distance match the placement maths (d * sensor / focal)', () => {
    const fieldOfViewRadians = (computeCameraFieldOfView() * Math.PI) / 180
    const visibleHeight = 2 * CAMERA_DISTANCE * Math.tan(fieldOfViewRadians / 2)

    expect(visibleHeight).toBeCloseTo((CAMERA_DISTANCE * SENSOR_HEIGHT_MILLIMETERS) / CAMERA_FOCAL_LENGTH_MILLIMETERS, 6)
  })

  it('gets wider with a shorter lens', () => {
    expect(computeCameraFieldOfView(35)).toBeGreaterThan(computeCameraFieldOfView(50))
  })
})
