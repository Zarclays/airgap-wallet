import { FormGroup } from '@angular/forms'
import { SafeUrl } from '@angular/platform-browser'
import { ICoinDelegateProtocol } from '@zarclays/zgap-coinlib-core'
import { DelegateeDetails, DelegatorDetails } from '@zarclays/zgap-coinlib-core/protocols/ICoinDelegateProtocol'
import BigNumber from 'bignumber.js'

import { UIAccountExtendedDetails } from '../models/widgets/display/UIAccountExtendedDetails'
import { UIAccountSummary } from '../models/widgets/display/UIAccountSummary'
import { UIAlert } from '../models/widgets/display/UIAlert'
import { UIRewardList } from '../models/widgets/display/UIRewardList'
import { UIInputWidget } from '../models/widgets/UIInputWidget'
import { UIWidget } from '../models/widgets/UIWidget'

export interface AirGapDelegateeUsageDetails {
  usage: BigNumber
  current: BigNumber
  total: BigNumber
}

export interface AirGapDelegatorAction {
  type: any
  form?: FormGroup
  label: string
  confirmLabel?: string
  iconName?: string
  args?: UIInputWidget<any>[]
  description?: string
  disabled?: boolean
}

export interface AirGapDelegateeDetails extends DelegateeDetails {
  logo?: string | SafeUrl
  usageDetails?: AirGapDelegateeUsageDetails
  displayDetails?: UIWidget[]
}

export interface AirGapDelegatorDetails extends DelegatorDetails {
  mainActions?: AirGapDelegatorAction[]
  secondaryActions?: AirGapDelegatorAction[]
  displayDetails?: UIWidget[]
}

export interface AirGapDelegationDetails {
  delegator: AirGapDelegatorDetails
  delegatees: AirGapDelegateeDetails[]
  alerts?: UIAlert[]
}

export interface IAirGapCoinDelegateProtocol extends ICoinDelegateProtocol {
  airGapDelegatee(): string | undefined

  delegateeLabel: string
  delegateeLabelPlural: string
  supportsMultipleDelegations: boolean

  getRewardDisplayDetails(delegator: string, delegatees: string[]): Promise<UIRewardList | undefined>
  getExtraDelegationDetailsFromAddress(delegator: string, delegatees: string[]): Promise<AirGapDelegationDetails[]>
  createDelegateesSummary(delegatees: string[]): Promise<UIAccountSummary[]>
  createAccountExtendedDetails(address: string): Promise<UIAccountExtendedDetails>
}
