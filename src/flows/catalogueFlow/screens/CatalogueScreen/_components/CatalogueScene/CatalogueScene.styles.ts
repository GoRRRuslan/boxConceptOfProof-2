import { ScaledSheet } from 'react-native-size-matters'

// The canvas is laid out `scale` times the size of the area it fills (so its GL drawing buffer gets
// `scale` times the pixels per side) and stretched back to full size with a transform.
export const makeStyles = (renderResolutionScale: number) =>
  ScaledSheet.create({
    scaledLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: `${100 * renderResolutionScale}%`,
      height: `${100 * renderResolutionScale}%`,
      transformOrigin: 'top left',
      transform: [{ scale: 1 / renderResolutionScale }],
    },
    canvas: {
      flex: 1,
    },
  })
