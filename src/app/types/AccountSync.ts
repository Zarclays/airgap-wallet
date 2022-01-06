import { AirGapMarketWallet } from '@zarclays/zgap-coinlib-core'
import { InteractionSetting } from '../models/AirGapMarketWalletGroup'

export interface AccountSync {
  wallet: AirGapMarketWallet
  groupId?: string
  groupLabel?: string
  interactionSetting?: InteractionSetting
}
