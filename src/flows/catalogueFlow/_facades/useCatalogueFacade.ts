import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import type { FlashListRef } from '@shopify/flash-list'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AppState, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { createSharedValue } from '@services/sceneSync/createSharedValue'

import { CARD_HEIGHT, LIST_TOP_PADDING } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { SCENE_READY_POLL_MILLISECONDS, SCENE_READY_TIMEOUT_MILLISECONDS } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { logDiagnostic, startJavaScriptStallMonitor } from '@services/performance/diagnosticLog'
import { INITIAL_PRESS_STATE, type IPressState, endPress, startPress } from '@flows/catalogueFlow/_facadesLogic/computeCardAnimation'
import { useAdapterCatalogueCards } from '@flows/catalogueFlow/_adapters/useAdapterCatalogueCards'
import { useOpeningFacade } from '@flows/openingFlow/_facades/useOpeningFacade'
import { EOpeningPhase } from '@flows/openingFlow/_types'
import type { ICatalogueCard, ICatalogueFacade, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import useStore from '@models/mainStorage/_storeConfigured'
import type { EBoxIdentifier } from '@networking/api/MysteryBoxApi/_types'
import { ETabRoute, type TTabParamList } from '@navigation/_types'
import { INITIAL_BALANCE_IN_CENTS } from '@models/mainStorage/WalletStore/initialState'
import { formatCurrency } from '@utils/formatCurrency'
import { useGetBoxesQuery } from '@networking/requests/queries/BoxQueries/useGetBoxesQuery'
import { EStartupMark, markStartup } from '@services/performance/startupTimeline'
import { useRenderFpsMeter } from '@services/performance/useRenderFpsMeter'

// The list counts as "scrolling" until this long after its last scroll event (covers the fling).
// Back from the background after at least this long: the 3D view is rebuilt (iOS may have taken its drawing surface away).
const REBUILD_SCENE_AFTER_BACKGROUND_MILLISECONDS = 1500
// An opening in one of these phases is closed when the user leaves the Boxes tab.
const LEAVE_TAB_CLOSES_PHASES = [EOpeningPhase.Inspecting, EOpeningPhase.Ready, EOpeningPhase.Revealed]
const SCROLL_IDLE_MILLISECONDS = 250
const PRESS_RELEASE_RENDER_MILLISECONDS = 350
// Measurement builds show the live frame-rate overlay: EXPO_PUBLIC_SHOW_PERFORMANCE=1
const IS_PERFORMANCE_OVERLAY_VISIBLE = process.env.EXPO_PUBLIC_SHOW_PERFORMANCE === '1'
// Measurement builds can scroll the list up and down by themselves: EXPO_PUBLIC_AUTO_SCROLL=1
const IS_AUTO_SCROLL = process.env.EXPO_PUBLIC_AUTO_SCROLL === '1'
const AUTO_SCROLL_SWEEP_MILLISECONDS = 2400
const AUTO_SCROLL_TICK_MILLISECONDS = 16
const PERFORMANCE_SCENARIO_LABEL = IS_AUTO_SCROLL ? 'catalogue-scroll' : 'catalogue'

export const useCatalogueFacade = (): ICatalogueFacade => {
  const { t } = useTranslation()

  // ------------------------ Services ----------------------- //
  const { onRenderedFrame, renderFrameStats, isRenderPaused } = useRenderFpsMeter(PERFORMANCE_SCENARIO_LABEL)

  // ------------------------ Navigation ----------------------- //
  const navigation = useNavigation<BottomTabNavigationProp<TTabParamList, ETabRoute.Catalogue>>()
  const isScreenFocused = useIsFocused()

  // --------------------------- State ------------------------- //
  const [viewport, setViewport] = useState<ICatalogueViewport | null>(null)
  const [isScrolling, setIsScrolling] = useState<boolean>(false)
  const [isSceneReady, setIsSceneReady] = useState<boolean>(false)
  // Bumped when the app comes back after a while in the background: the 3D scene is built anew (see the effect below).
  const [sceneEpoch, setSceneEpoch] = useState<number>(0)
  const backgroundedAt = useRef<number | null>(null)
  // A finger is on a card (or just left it): the squeeze animation needs frames.
  const [isPressing, setIsPressing] = useState<boolean>(false)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const listRef = useRef<FlashListRef<ICatalogueCard> | null>(null)
  const scrollIdleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const isScrollingLogged = useRef<boolean>(false)
  // Diagnostics: when the scroll events of the current gesture arrived.
  const scrollEventTimestamps = useRef<number[]>([])

  // --------------------------- Store ------------------------- //
  const balanceInCents = useStore(state => state.balanceInCents)

  // ----------------------- Queries / mutations -------------------- //
  const { boxesData, boxesRefetch, isLoadingBoxes, isErrorBoxes } = useGetBoxesQuery()

  // -------------------------- Adapter ------------------------- //
  const cards = useAdapterCatalogueCards({ boxesData, balanceInCents })

  // ------------------------- Opening -------------------------- //
  const opening = useOpeningFacade({ boxesData, cards })
  const openingRef = useRef(opening)

  // -------------------------- Values ------------------------- //
  // Shared with the 3D scene: written on every scroll event, read on every rendered frame.
  const scrollOffset = useMemo(() => createSharedValue(0), [])
  const isRenderContinuous =
    isScrolling ||
    isPressing ||
    opening.isDragging ||
    [EOpeningPhase.Inspecting, EOpeningPhase.Purchasing, EOpeningPhase.Ready, EOpeningPhase.Opening].includes(opening.phase) ||
    // Revealed stays continuous (the light inside the box pulses) until the box has been put away.
    (opening.phase === EOpeningPhase.Revealed && !opening.isBoxPutAway)
  const pressState = useMemo(() => createSharedValue<IPressState>(INITIAL_PRESS_STATE), [])
  const sceneReadiness = useMemo(() => createSharedValue<boolean>(false), [])
  const sceneSync: ICatalogueSceneSync = useMemo(
    () => ({
      scrollOffset,
      openingScene: opening.sceneState,
      dragState: opening.dragState,
      tilt: opening.tilt,
      pressState,
      sceneReadiness,
    }),
    [scrollOffset, opening.sceneState, opening.dragState, opening.tilt, pressState, sceneReadiness],
  )

  // ------------------- Handlers -------------------------- //
  const handleListLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout

    markStartup(EStartupMark.ListVisible)

    setViewport(previous => (previous?.width === width && previous.height === height ? previous : { width, height }))
  }

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.setBlocking(event.nativeEvent.contentOffset.y)

    scrollEventTimestamps.current.push(performance.now())

    if (!isScrollingLogged.current) {
      isScrollingLogged.current = true

      logDiagnostic('scroll.start', { offset: event.nativeEvent.contentOffset.y })
    }

    setIsScrolling(true)

    clearTimeout(scrollIdleTimer.current)

    scrollIdleTimer.current = setTimeout(() => {
      isScrollingLogged.current = false

      const timestamps = scrollEventTimestamps.current
      const gaps = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]).sort((first, second) => first - second)

      logDiagnostic('scroll.end', {
        events: timestamps.length,
        medianGapMilliseconds: Math.round((gaps[Math.floor(gaps.length / 2)] ?? 0) * 10) / 10,
        p95GapMilliseconds: Math.round((gaps[Math.floor(gaps.length * 0.95)] ?? 0) * 10) / 10,
        maxGapMilliseconds: Math.round((gaps[gaps.length - 1] ?? 0) * 10) / 10,
      })

      scrollEventTimestamps.current = []

      setIsScrolling(false)
    }, SCROLL_IDLE_MILLISECONDS)
  }

  // The balance goes back to the starting one after a confirmation (the watches stay): for testing the purchases again and again.
  const handleResetBalancePress = () => {
    Alert.alert(t('catalogue.resetBalanceTitle'), t('catalogue.resetBalanceMessage', { amount: formatCurrency(INITIAL_BALANCE_IN_CENTS) }), [
      { text: t('catalogue.resetBalanceCancel'), style: 'cancel' },
      {
        text: t('catalogue.resetBalanceConfirm'),
        style: 'destructive',
        onPress: () => {
          useStore.getState().resetWallet()
        },
      },
    ])
  }

  const handleRetryPress = () => {
    void boxesRefetch()
  }

  // The box under the finger is squeezed a little until the finger lifts.
  const handleCardPressIn = (boxIdentifier: EBoxIdentifier) => {
    const cardIndex = cards.findIndex(card => card.identifier === boxIdentifier)

    pressState.setBlocking(startPress(pressState.getBlocking(), cardIndex, Date.now()))

    clearTimeout(pressTimer.current)

    setIsPressing(true)
  }

  const handleCardPressOut = () => {
    pressState.setBlocking(endPress(pressState.getBlocking(), Date.now()))

    // Keep drawing until the box has bounced back.
    clearTimeout(pressTimer.current)

    pressTimer.current = setTimeout(() => {
      setIsPressing(false)
    }, PRESS_RELEASE_RENDER_MILLISECONDS)
  }

  // ------------------- Side effects ----------------------- //
  // While a prize is shown the tab bar is not needed: Done leads back to the list.
  const isTabBarHidden = opening.phase === EOpeningPhase.Revealed

  useEffect(() => {
    navigation.setParams({ isTabBarHidden })
  }, [navigation, isTabBarHidden])

  useEffect(() => {
    if (!IS_AUTO_SCROLL || !viewport || cards.length === 0) {
      return
    }

    // Triangle wave between the top and the bottom of the list: a steady, repeatable scroll workload.
    const maximumOffset = LIST_TOP_PADDING + cards.length * CARD_HEIGHT - viewport.height
    const startedAt = Date.now()
    const autoScrollTimer = setInterval(() => {
      const phase = ((Date.now() - startedAt) / AUTO_SCROLL_SWEEP_MILLISECONDS) % 1
      const wave = phase < 0.5 ? phase * 2 : 2 - phase * 2

      listRef.current?.scrollToOffset({ offset: wave * maximumOffset, animated: false })
    }, AUTO_SCROLL_TICK_MILLISECONDS)

    return () => {
      clearInterval(autoScrollTimer)
    }
  }, [viewport, cards.length])

  useEffect(() => {
    openingRef.current = opening
  })

  // After a stay in the background the 3D view could show frozen boxes or a box left over from an opening: the drawing surface is rebuilt,
  // and the scene redraws everything from the opening state, which is the single truth.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background') {
        backgroundedAt.current = Date.now()

        return
      }

      if (nextState !== 'active' || backgroundedAt.current === null) {
        return
      }

      const awayMilliseconds = Date.now() - backgroundedAt.current

      backgroundedAt.current = null

      if (awayMilliseconds >= REBUILD_SCENE_AFTER_BACKGROUND_MILLISECONDS) {
        logDiagnostic('scene.rebuild', { awayMilliseconds })

        setSceneEpoch(previous => previous + 1)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  // The Boxes tab coming and going (e.g. a trip to the Collection and back): what the scene does around it is what is looked at.
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      logDiagnostic('tab.focus', { tab: 'catalogue' })
    })
    const unsubscribeBlur = navigation.addListener('blur', () => {
      logDiagnostic('tab.blur', { tab: 'catalogue' })

      // An opened box is put away when the tab is left: coming back to Boxes shows the list, not the box that was open.
      if (LEAVE_TAB_CLOSES_PHASES.includes(openingRef.current.phase)) {
        openingRef.current.handleBackPress()
      }
    })

    return () => {
      unsubscribeFocus()

      unsubscribeBlur()
    }
  }, [navigation])

  // Diagnostics only (a measurement build): reports every time the JavaScript thread was busy for longer than a frame.
  useEffect(() => {
    startJavaScriptStallMonitor()
  }, [])

  // The scene says when it is ready (a flag it sets in its frame loop); this watches for it. The wait is capped, so that a scene that
  // never gets ready (a model that fails to load) does not keep the loader up forever.
  useEffect(() => {
    if (isSceneReady || cards.length === 0) {
      return undefined
    }

    const waitStartedAt = Date.now()

    const pollTimer = setInterval(() => {
      const isReady = sceneReadiness.getBlocking()
      const isTimedOut = Date.now() - waitStartedAt > SCENE_READY_TIMEOUT_MILLISECONDS

      if (isReady || isTimedOut) {
        logDiagnostic('scene.ready', { isReady, isTimedOut, waitedMilliseconds: Date.now() - waitStartedAt })

        setIsSceneReady(true)
      }
    }, SCENE_READY_POLL_MILLISECONDS)

    return () => {
      clearInterval(pollTimer)
    }
  }, [isSceneReady, cards.length, sceneReadiness])

  useEffect(
    () => () => {
      clearTimeout(scrollIdleTimer.current)

      clearTimeout(pressTimer.current)
    },
    [],
  )

  return {
    titleText: t('catalogue.title'),
    balanceLabelText: t('catalogue.balanceLabel'),
    balanceInCents,
    loadingText: t('catalogue.loading'),
    errorText: t('catalogue.error'),
    retryLabelText: t('catalogue.retry'),
    resetBalanceLabelText: t('catalogue.resetBalance'),
    isLoadingBoxes,
    isSceneReady,
    sceneEpoch,
    isErrorBoxes,
    cards,
    viewport,
    listRef,
    sceneSync,
    opening,
    phaseKey: opening.phase,
    isRenderContinuous,
    isScreenFocused,
    isPerformanceOverlayVisible: IS_PERFORMANCE_OVERLAY_VISIBLE,
    onRenderedFrame,
    renderFrameStats,
    isRenderPaused,
    handleListLayout,
    handleScroll,
    handleRetryPress,
    handleResetBalancePress,
    handleCardPressIn,
    handleCardPressOut,
  }
}
