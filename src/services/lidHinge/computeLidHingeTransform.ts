type ILidHingeVector = [number, number, number]

// Hinge parameters from docs/MODEL.md (model space, +X rotation axis).
export const LID_HINGE_PIVOT: ILidHingeVector = [0, 0.914876, 0.359181]
export const LID_FULLY_OPEN_ANGLE_DEGREES = 115

export interface ILidHingeTransform {
  rotate: ILidHingeVector
  translate: ILidHingeVector
}

// A rotation about a pivot equals: rotate about the origin, then translate by (pivot - R * pivot).
// three.js applies scale -> rotate -> translate to a node, so the result maps directly onto position/rotation.
export const computeLidHingeTransform = (angleDegrees: number): ILidHingeTransform => {
  const [, pivotY, pivotZ] = LID_HINGE_PIVOT
  const angleRadians = (angleDegrees * Math.PI) / 180
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const rotatedPivotY = pivotY * cosine - pivotZ * sine
  const rotatedPivotZ = pivotY * sine + pivotZ * cosine

  return {
    rotate: [angleRadians, 0, 0],
    translate: [0, pivotY - rotatedPivotY, pivotZ - rotatedPivotZ],
  }
}
