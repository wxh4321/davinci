import { IFieldTotalConfig } from './types'
import { TotalTypes } from './constants'

export function getDefaultTotalConfig(): IFieldTotalConfig {
  return {
    totalType: TotalTypes.Default
  }
}
