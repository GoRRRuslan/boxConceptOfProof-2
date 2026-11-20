const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// 3D models are bundled as assets
config.resolver.assetExts = [...config.resolver.assetExts, 'glb', 'gltf']

// three.js: always use the WebGPU build (it contains the whole core too), always the ES module build, for `import` and `require` alike. The CommonJS entry
// (build/three.cjs) is deprecated and calls `process.emitWarning`, which React Native does not have,
// and @react-three/fiber's CommonJS build requires it. Resolving both to one file also guarantees a
// single copy of three.js in the bundle.
const threeModulePath = path.join(__dirname, 'node_modules/three/build/three.webgpu.js')
const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeModulePath }
  }

  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
