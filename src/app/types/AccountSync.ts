import { AirGapMarketWallet } from '@zarclays/zgap-coinlib-core'

export interface AccountSync {
  wallet: AirGapMarketWallet
  groupId?: string
  groupLabel?: string
}
