import { AirGapCoinWallet, AirGapMarketWallet, ICoinProtocol } from '@zarclays/zgap-coinlib-core'
import { Action } from '@zarclays/zgap-coinlib-core/actions/Action'
import { ImportAccountAction, ImportAccoutActionContext } from '@zarclays/zgap-coinlib-core/actions/GetKtAccountsAction'
import { LinkedAction } from '@zarclays/zgap-coinlib-core/actions/LinkedAction'
import { SimpleAction } from '@zarclays/zgap-coinlib-core/actions/SimpleAction'
import { CosmosDelegationActionType } from '@zarclays/zgap-coinlib-core/protocols/cosmos/CosmosProtocol'
import { SubProtocolType } from '@zarclays/zgap-coinlib-core/protocols/ICoinSubProtocol'
import { MainProtocolSymbols, SubProtocolSymbols } from '@zarclays/zgap-coinlib-core'

import { AccountTransactionListPage } from '../pages/account-transaction-list/account-transaction-list'
import { DataServiceKey } from '../services/data/data.service'
import { ErrorCategory, handleErrorSentry } from '../services/sentry-error-handler/sentry-error-handler'

import { AddTokenAction, AddTokenActionContext } from './actions/AddTokenAction'
import { ButtonAction, ButtonActionContext } from './actions/ButtonAction'
import { AirGapDelegatorAction, AirGapDelegatorActionContext } from './actions/DelegatorAction'
import { AirGapTezosMigrateAction } from './actions/TezosMigrateAction'
import { FundAccountAction } from './actions/FundAccountAction'
import { CollectiblesAction } from './actions/CollectiblesAction'

interface DelegatorButtonActionContext extends ButtonActionContext {
  type: any
  data?: any
}

export interface WalletActionInfo {
  name: string
  icon: string
}

export class ActionGroup {
  constructor(private readonly callerContext: AccountTransactionListPage) {}

  public async getActions(): Promise<Action<any, any>[]> {
    const actionMap: Map<string, () => Promise<Action<any, any>[]>> = new Map()
    actionMap.set(MainProtocolSymbols.XTZ, async () => {
      return this.getTezosActions()
    })
    actionMap.set(SubProtocolSymbols.XTZ_KT, async () => {
      return this.getTezosKTActions()
    })
    actionMap.set(MainProtocolSymbols.XTZ_SHIELDED, async () => {
      return this.getTezosShieldedTezActions()
    })
    actionMap.set(MainProtocolSymbols.ETH, async () => {
      return this.getEthereumActions()
    })
    actionMap.set(MainProtocolSymbols.COSMOS, async () => {
      return this.getCosmosActions()
    })
    actionMap.set(MainProtocolSymbols.POLKADOT, async () => {
      return this.getPolkadotActions()
    })
    actionMap.set(MainProtocolSymbols.KUSAMA, async () => {
      return this.getKusamaActions()
    })
    actionMap.set(MainProtocolSymbols.MOONBASE, async () => {
      return this.getMoonbeamActions()
    })
    actionMap.set(MainProtocolSymbols.MOONRIVER, async () => {
      return this.getMoonbeamActions()
    })

    const actionFunction: () => Promise<Action<any, any>[]> | undefined = actionMap.get(this.callerContext.protocolIdentifier)

    return actionFunction ? actionFunction() : []
  }

  private getTezosActions(): Action<any, any>[] {
    const delegateButtonAction = this.createDelegateButtonAction()

    const collectiblesButton = new ButtonAction(
      { name: 'account-transaction-list.collectibles_label', icon: 'images', identifier: 'collectibles-action' },
      () => {
        return new CollectiblesAction({ wallet: this.callerContext.wallet, router: this.callerContext.router })
      }
    )

    //TODO: Move logic to sub-account-add.ts
    const addTokenButtonAction = new ButtonAction(
      { name: 'account-transaction-list.add-tokens_label', icon: 'add', identifier: 'add-tokens' },
      () => {
        const prepareAddTokenActionContext = new SimpleAction(() => {
          return new Promise<AddTokenActionContext>(async (resolve) => {
            const info = {
              subProtocolType: SubProtocolType.TOKEN,
              wallet: this.callerContext.wallet,
              actionCallback: resolve
            }
            this.callerContext.dataService.setData(DataServiceKey.DETAIL, info)
            this.callerContext.router
              .navigateByUrl(
                `/sub-account-add/${DataServiceKey.DETAIL}/${info.wallet.publicKey}/${info.wallet.protocol.identifier}/${info.wallet.addressIndex}/${info.subProtocolType}`
              )
              .catch(handleErrorSentry(ErrorCategory.NAVIGATION))
          })
        })
        const addTokenAction = new LinkedAction(prepareAddTokenActionContext, AddTokenAction)
        addTokenAction.onComplete = async (): Promise<void> => {
          addTokenAction.getLinkedAction().context.location.navigateRoot('')
        }

        return addTokenAction
      }
    )

    return [delegateButtonAction, collectiblesButton, addTokenButtonAction]
  }

  public getImportAccountsAction(): ButtonAction<string[], ImportAccoutActionContext> {
    const importButtonAction: ButtonAction<string[], ImportAccoutActionContext> = new ButtonAction(
      { name: 'account-transaction-list.import-accounts_label', icon: 'add-outline', identifier: 'import-accounts' },
      () => {
        const importAccountAction: ImportAccountAction = new ImportAccountAction({ publicKey: this.callerContext.wallet.publicKey })
        importAccountAction.onComplete = async (ktAddresses: string[]): Promise<void> => {
          if (ktAddresses.length === 0) {
            this.callerContext.showToast('No accounts to import.')
          } else {
            for (const [index] of ktAddresses.entries()) {
              await this.addKtAddress(this.callerContext.wallet, index, ktAddresses)
            }

            this.callerContext.router.navigateByUrl('/').catch(handleErrorSentry(ErrorCategory.NAVIGATION))
            this.callerContext.showToast('Accounts imported')
          }
        }
        return importAccountAction
      }
    )
    return importButtonAction
  }

  private getTezosKTActions(): Action<any, any>[] {
    const migrateAction: ButtonAction<void, void> = new ButtonAction(
      { name: 'account-transaction-list.migrate_label', icon: 'return-right', identifier: 'migrate-action' },
      () => {
        const action = new AirGapTezosMigrateAction({
          wallet: this.callerContext.wallet,
          alertCtrl: this.callerContext.alertCtrl,
          translateService: this.callerContext.translateService,
          protocolService: this.callerContext.protocolService,
          dataService: this.callerContext.dataService,
          router: this.callerContext.router
        })

        return action
      }
    )
    return [migrateAction]
  }

  private getTezosShieldedTezActions(): Action<any, any>[] {
    const fundAction: ButtonAction<void, void> = new ButtonAction(
      { name: 'account-transaction-list.fund_label', icon: 'logo-usd', identifier: 'fund-action' },
      () => {
        const action = new FundAccountAction({
          wallet: this.callerContext.wallet,
          accountProvider: this.callerContext.accountProvider,
          dataService: this.callerContext.dataService,
          router: this.callerContext.router
        })

        return action
      }
    )

    return [fundAction]
  }

  private async getCosmosActions(): Promise<Action<any, any>[]> {
    const delegateButtonAction = this.createDelegateButtonAction()
    const extraDelegatorButtonActions = await this.createDelegatorButtonActions({
      type: CosmosDelegationActionType.WITHDRAW_ALL_REWARDS,
      name: 'account-transaction-list.claim_rewards_label',
      icon: 'logo-usd',
      identifier: 'claim-rewards'
    })

    return [delegateButtonAction, ...extraDelegatorButtonActions]
  }

  private getEthereumActions(): Action<any, any>[] {
    const addTokenButtonAction: ButtonAction<void, void> = new ButtonAction(
      { name: 'account-transaction-list.add-tokens_label', icon: 'add-outline', identifier: 'add-tokens' },
      () => {
        const prepareAddTokenActionContext: SimpleAction<AddTokenActionContext> = new SimpleAction(() => {
          return new Promise<AddTokenActionContext>(async (resolve) => {
            const info = {
              subProtocolType: SubProtocolType.TOKEN,
              wallet: this.callerContext.wallet,
              actionCallback: resolve
            }
            this.callerContext.dataService.setData(DataServiceKey.DETAIL, info)
            this.callerContext.router
              .navigateByUrl(
                `/sub-account-add/${DataServiceKey.DETAIL}/${info.wallet.publicKey}/${info.wallet.protocol.identifier}/${info.wallet.addressIndex}/${info.subProtocolType}`
              )
              .catch(handleErrorSentry(ErrorCategory.NAVIGATION))
          })
        })
        const addTokenAction: LinkedAction<void, AddTokenActionContext> = new LinkedAction(prepareAddTokenActionContext, AddTokenAction)
        addTokenAction.onComplete = async (): Promise<void> => {
          addTokenAction.getLinkedAction().context.location.navigateRoot('')
        }

        return addTokenAction
      }
    )

    return [addTokenButtonAction]
  }

  private getPolkadotActions(): Action<any, any>[] {
    const delegateButtonAction = this.createDelegateButtonAction()

    return [delegateButtonAction]
  }

  private getKusamaActions(): Action<any, any>[] {
    const delegateButtonAction = this.createDelegateButtonAction()

    return [delegateButtonAction]
  }

  private getMoonbeamActions(): Action<any, any>[] {
    const delegateButtonAction = this.createDelegateButtonAction()

    return [delegateButtonAction]
  }

  private async addKtAddress(xtzWallet: AirGapMarketWallet, index: number, ktAddresses: string[]): Promise<AirGapMarketWallet> {
    let wallet = this.callerContext.accountProvider.walletByPublicKeyAndProtocolAndAddressIndex(
      xtzWallet.publicKey,
      SubProtocolSymbols.XTZ_KT,
      index
    )

    if (wallet) {
      return wallet
    }

    const xtzWalletGroup = this.callerContext.accountProvider.findWalletGroup(xtzWallet)
    const protocol: ICoinProtocol = await this.callerContext.protocolService.getProtocol(SubProtocolSymbols.XTZ_KT)

    wallet = new AirGapCoinWallet(
      protocol,
      xtzWallet.publicKey,
      xtzWallet.isExtendedPublicKey,
      xtzWallet.derivationPath,
      xtzWallet.masterFingerprint,
      xtzWallet.status,
      xtzWallet.priceService,
      index
    )
    wallet.addresses = ktAddresses
    await wallet.synchronize().catch(handleErrorSentry(ErrorCategory.COINLIB))
    const walletAddInfos = [
      {
        walletToAdd: wallet,
        groupId: xtzWalletGroup !== undefined ? xtzWalletGroup.id : undefined,
        groupLabel: xtzWalletGroup !== undefined ? xtzWalletGroup.label : undefined
      }
    ]
    await this.callerContext.accountProvider.addWallets(walletAddInfos).catch(handleErrorSentry(ErrorCategory.WALLET_PROVIDER))

    return wallet
  }

  private createDelegateButtonAction(): ButtonAction<void, void> {
    return new ButtonAction({ name: 'account-transaction-list.delegate_label', icon: 'logo-usd', identifier: 'delegate-action' }, () => {
      return new SimpleAction(() => {
        return new Promise<void>((resolve) => {
          const info = {
            wallet: this.callerContext.wallet
          }
          this.callerContext.dataService.setData(DataServiceKey.DETAIL, info)
          this.callerContext.router
            .navigateByUrl(
              `/delegation-detail/${DataServiceKey.DETAIL}/${this.callerContext.wallet.publicKey}/${this.callerContext.wallet.protocol.identifier}/${this.callerContext.wallet.addressIndex}`
            )
            .catch(handleErrorSentry(ErrorCategory.NAVIGATION))

          resolve()
        })
      })
    })
  }

  private async createDelegatorButtonActions(
    ...contexts: DelegatorButtonActionContext[]
  ): Promise<ButtonAction<void, AirGapDelegatorActionContext>[]> {
    try {
      const delegatorDetails = await this.callerContext.operationsProvider.getDelegatorDetails(this.callerContext.wallet)

      if (delegatorDetails.availableActions) {
        const availableActionTypes = delegatorDetails.availableActions.map((action) => action.type)
        return contexts
          .filter((context) => availableActionTypes.includes(context.type))
          .map((context) => {
            return new ButtonAction<void, AirGapDelegatorActionContext>(context, () => {
              return new AirGapDelegatorAction({
                wallet: this.callerContext.wallet,
                type: context.type,
                data: context.data,
                toastController: this.callerContext.toastController,
                loadingController: this.callerContext.loadingController,
                operationsProvider: this.callerContext.operationsProvider,
                dataService: this.callerContext.dataService,
                accountService: this.callerContext.accountProvider
              })
            })
          })
      }
    } catch (error) {
      console.warn(error)
    }

    return []
  }
}
