import { hide } from 'expo-splash-screen'
import { useEffect } from 'react'

import { theme } from '@utils/designSystem/Theme'
import { queryClient } from '@services/reactQuery/queryClient'

export const useAppFacade = () => {
  // ------------------- Side effects ----------------------- //
  useEffect(() => {
    hide()
  }, [])

  return { theme, queryClient }
}
