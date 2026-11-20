import 'react-native-gesture-handler/jestSetup'
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock'

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext)
import '@shopify/flash-list/jestSetup'

// Tests run as on a real device (the full look); the software-renderer savings are exercised explicitly.
jest.mock('expo-device', () => ({ isDevice: true }))
