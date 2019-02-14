import { Component } from '@angular/core'
import { NavController, NavParams } from 'ionic-angular'
import { TezosKtProtocol, AirGapMarketWallet, EncodedType, SyncProtocolUtils } from 'airgap-coin-lib'
import { SubAccountProvider } from '../../providers/account/sub-account.provider'
import { handleErrorSentry, ErrorCategory } from '../../providers/sentry-error-handler/sentry-error-handler'
import { InteractionSelectionPage } from '../interaction-selection/interaction-selection'

enum SubAccountType {
  TOKEN = 'token',
  ACCOUNT = 'account'
}

interface IAccountWrapper {
  selected: boolean
  wallet: AirGapMarketWallet
}

@Component({
  selector: 'page-add-sub-account',
  templateUrl: 'add-sub-account.html'
})
export class AddSubAccountPage {
  private subAccountType: SubAccountType
  private wallet: AirGapMarketWallet
  public subAccounts: IAccountWrapper[] = []

  constructor(public navCtrl: NavController, public navParams: NavParams, private subAccountProvider: SubAccountProvider) {
    this.wallet = this.navParams.get('wallet')

    // TODO: Make generic
    if (this.wallet.protocolIdentifier === 'xtz') {
      this.subAccountType = SubAccountType.ACCOUNT

      const protocol = new TezosKtProtocol()
      protocol
        .getAddressesFromPublicKey(this.wallet.publicKey)
        .then(res => {
          res.forEach((_value, index) => {
            const wallet = new AirGapMarketWallet(
              'xtz-kt',
              this.wallet.publicKey,
              this.wallet.isExtendedPublicKey,
              this.wallet.derivationPath,
              index
            )
            const exists = this.subAccountProvider.walletExists(wallet)
            if (!exists) {
              wallet.addresses = res
              wallet.synchronize()
              this.subAccounts.push({ selected: false, wallet: wallet })
            }
          })
        })
        .catch(console.error)
    } else {
      this.subAccountType = SubAccountType.TOKEN
      this.wallet.coinProtocol.subProtocols.forEach(protocol => {
        const wallet = new AirGapMarketWallet(
          protocol.identifier,
          this.wallet.publicKey,
          this.wallet.isExtendedPublicKey,
          this.wallet.derivationPath
        )
        const exists = this.subAccountProvider.walletExists(wallet)
        if (!exists) {
          wallet.addresses = this.wallet.addresses
          wallet.synchronize()
          this.subAccounts.push({ selected: false, wallet: wallet })
        }
      })
    }
  }

  toggleAccount(account: IAccountWrapper) {
    account.selected = !account.selected
  }

  addSubAccounts() {
    console.log(this.subAccounts.filter(account => account.selected).map(account => account.wallet))
    this.subAccounts
      .filter(account => account.selected)
      .map(account => account.wallet)
      .forEach(wallet => {
        this.subAccountProvider.addWallet(wallet).catch(handleErrorSentry(ErrorCategory.WALLET_PROVIDER))
      })
    this.navCtrl.pop()
  }

  async prepareOriginate() {
    console.log(this.wallet)
    const protocol = new TezosKtProtocol()
    const originateTx = await protocol.originate(this.wallet.publicKey)

    /*
    console.log(
      protocol.getTransactionDetails({
        publicKey: this.wallet.publicKey,
        transaction: originateTx,
        callback: 'airgap-wallet://?d='
      })
    )
*/
    const syncProtocol = new SyncProtocolUtils()
    const serializedTx = await syncProtocol.serialize({
      version: 1,
      protocol: this.wallet.coinProtocol.identifier,
      type: EncodedType.UNSIGNED_TRANSACTION,
      payload: {
        publicKey: this.wallet.publicKey,
        transaction: originateTx,
        callback: 'airgap-wallet://?d='
      }
    })

    this.navCtrl
      .push(InteractionSelectionPage, {
        wallet: this.wallet,
        airGapTx: originateTx,
        data: 'airgap-vault://?d=' + serializedTx
      })
      .catch(handleErrorSentry(ErrorCategory.NAVIGATION))

    console.log('originate', originateTx)
  }
}
