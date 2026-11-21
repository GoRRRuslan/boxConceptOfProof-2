import 'react-native-gesture-handler/jestSetup'
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)
import '@shopify/flash-list/jestSetup'

// No native file system in the tests: the saved state does not exist and writing it does nothing.
jest.mock('expo-file-system', () => ({
  Paths: { document: 'document' },
  File: class {
    exists = false

    create = jest.fn()

    textSync() {
      return ''
    }

    writeSync = jest.fn()
  },
}))
