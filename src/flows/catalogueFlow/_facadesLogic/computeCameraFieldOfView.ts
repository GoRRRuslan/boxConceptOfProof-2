import { CAMERA_FOCAL_LENGTH_MILLIMETERS, SENSOR_HEIGHT_MILLIMETERS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'

// Vertical field of view in DEGREES (what three.js' PerspectiveCamera wants) of the "24 mm sensor,
// 50 mm lens" camera that the placement maths (computeBoxPose, computeOpeningPose) assumes.
export const computeCameraFieldOfView = (
  focalLengthMillimeters: number = CAMERA_FOCAL_LENGTH_MILLIMETERS,
  sensorHeightMillimeters: number = SENSOR_HEIGHT_MILLIMETERS,
): number => (2 * Math.atan(sensorHeightMillimeters / (2 * focalLengthMillimeters)) * 180) / Math.PI
