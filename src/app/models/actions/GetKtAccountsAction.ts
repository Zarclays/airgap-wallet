import { ImportAccountAction } from '@zarclays/zgap-coinlib-core/actions/GetKtAccountsAction'

import { WalletActionInfo } from '../ActionGroup'

export class AirGapGetKtAccountsAction extends ImportAccountAction {
  public readonly info: WalletActionInfo = {
    name: 'account-transaction-list.import-accounts_label',
    icon: 'add'
  }
}
