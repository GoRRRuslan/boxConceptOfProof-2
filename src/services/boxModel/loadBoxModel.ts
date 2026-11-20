import { Asset } from 'expo-asset'
import type { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Loads a bundled GLB (an `import x from '...glb'` module id) and returns its scene.
// expo-asset copies the bundled file to the app's cache, `fetch` reads it as bytes and GLTFLoader
// parses it. Three things React Native lacks are avoided on purpose:
// - Draco / KTX2 / Meshopt: they need WASM decoders in Web Workers, so the model ships uncompressed
//   (scripts/assets/optimizeBoxModel.sh).
// - GLTFLoader.load(): it expects a URL string, the module id is a number.
// - Embedded textures: GLTFLoader turns them into Blob URLs; @react-three/fiber/native patches Blob
//   and TextureLoader so these load on iOS and Android.
const modelPromiseByModule = new Map<number, Promise<Group>>()

const parseBoxModel = async (moduleIdentifier: number): Promise<Group> => {
  const asset = Asset.fromModule(moduleIdentifier)

  await asset.downloadAsync()

  const assetUri = asset.localUri ?? asset.uri
  const response = await fetch(assetUri)
  const bytes = await response.arrayBuffer()

  return new Promise<Group>((resolve, reject) => {
    new GLTFLoader().parse(
      bytes,
      '',
      gltf => {
        resolve(gltf.scene)
      },
      error => {
        reject(error instanceof Error ? error : new Error('The GLB model could not be parsed.', { cause: error }))
      },
    )
  })
}

// One load per model for the whole app run: start it with preloadBoxModel() at app start, so the
// parsed model is ready (or nearly) by the time the 3D scene mounts.
export const loadBoxModel = (moduleIdentifier: number): Promise<Group> => {
  const existing = modelPromiseByModule.get(moduleIdentifier)

  if (existing) {
    return existing
  }

  const promise = parseBoxModel(moduleIdentifier)

  modelPromiseByModule.set(moduleIdentifier, promise)

  // A failed load may be retried by the next caller.
  promise.catch(() => modelPromiseByModule.delete(moduleIdentifier))

  return promise
}

export const preloadBoxModel = (moduleIdentifier: number): void => {
  loadBoxModel(moduleIdentifier).catch(() => undefined)
}
