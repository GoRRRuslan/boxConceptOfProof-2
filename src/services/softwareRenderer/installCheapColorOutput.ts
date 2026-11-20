import { ShaderChunk } from 'three'

// On the software renderer (iOS Simulator) the linear -> sRGB conversion at the end of every fragment shader is one of the
// costliest things: it calls pow() per colour channel per pixel. This swaps it for x^(7/16) built from four square roots
// (sqrt is cheap, 7/16 = 0.4375 is close to the 1/2.4 exponent of sRGB), so every pixel gets cheaper and the colours stay
// within a few percent of the correct ones. Call it once, before the first shader is compiled.
const CHEAP_COLOUR_OUTPUT = /* glsl */ `
vec3 linearColor = max(gl_FragColor.rgb, vec3(0.0));
vec3 root2 = sqrt(linearColor);
vec3 root4 = sqrt(root2);
vec3 root8 = sqrt(root4);
vec3 root16 = sqrt(root8);

gl_FragColor.rgb = max(1.055 * root4 * root8 * root16 - 0.055, vec3(0.0));
`

export const installCheapColorOutput = (): void => {
  Reflect.set(ShaderChunk, 'colorspace_fragment', CHEAP_COLOUR_OUTPUT)
}
