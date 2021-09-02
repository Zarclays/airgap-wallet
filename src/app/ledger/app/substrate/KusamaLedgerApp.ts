import { newKusamaApp, SubstrateApp } from '@zondax/ledger-polkadot'
import { KusamaProtocol, SubstrateNetwork, SubstrateProtocol } from '@zarclays/zgap-coinlib-core'

import { SubstrateLedgerApp } from './SubstrateLedgerApp'

export class KusamaLedgerApp extends SubstrateLedgerApp<SubstrateNetwork.KUSAMA> {
  protected readonly protocol: SubstrateProtocol<SubstrateNetwork.KUSAMA> = new KusamaProtocol()

  protected getApp(): SubstrateApp {
    return newKusamaApp(this.connection.transport)
  }
}
