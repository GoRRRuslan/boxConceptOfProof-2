import { EStartupMark, markStartup } from '@services/performance/startupTimeline'
import 'react-native-gesture-handler'
import 'react-native-get-random-values'
import '@i18next/i18init'
import { registerRootComponent } from 'expo'

import App from '@app/App'
import boxModelSource from '@assets/models/box.glb'
import { preloadBoxModel } from '@services/boxModel/loadBoxModel'

markStartup(EStartupMark.AppStart)

preloadBoxModel(boxModelSource)

registerRootComponent(App)
