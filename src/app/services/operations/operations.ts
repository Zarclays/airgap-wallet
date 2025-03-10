import { ProtocolService } from '@zarclays/zgap-angular-core'
import { SignPayloadRequestOutput } from '@airgap/beacon-sdk'
import {
  AirGapMarketWallet,
  FeeDefaults,
  IACMessageDefinitionObjectV3,
  IACMessageType,
  IAirGapTransaction,
  ICoinDelegateProtocol,
  ICoinProtocol,
  MainProtocolSymbols,
  SubProtocolSymbols,
  TezosBTC,
  TezosKtProtocol,
  TezosSaplingProtocol
} from '@zarclays/zgap-coinlib-core'
import { CosmosTransaction } from '@zarclays/zgap-coinlib-core/protocols/cosmos/CosmosTransaction'

import { TezosSaplingAddress } from '@zarclays/zgap-coinlib-core/protocols/tezos/sapling/TezosSaplingAddress'

import { DelegateeDetails, DelegatorAction, DelegatorDetails } from '@zarclays/zgap-coinlib-core/protocols/ICoinDelegateProtocol'
import {
  RawAeternityTransaction,
  RawBitcoinTransaction,
  RawEthereumTransaction,
  RawSubstrateTransaction,
  RawTezosTransaction
} from '@zarclays/zgap-coinlib-core/serializer/types'


import { Injectable } from '@angular/core'
import { FormBuilder } from '@angular/forms'
import { LoadingController, ToastController } from '@ionic/angular'
import BigNumber from 'bignumber.js'
import { BehaviorSubject } from 'rxjs'
import { map } from 'rxjs/operators'

import { supportsAirGapDelegation, supportsDelegation } from '../../helpers/delegation'
import {
  AirGapDelegateeDetails,
  AirGapDelegationDetails,
  AirGapDelegatorAction,
  AirGapDelegatorDetails
} from '../../interfaces/IAirGapCoinDelegateProtocol'
import { UIAccountExtendedDetails } from '../../models/widgets/display/UIAccountExtendedDetails'
import { UIAccountSummary } from '../../models/widgets/display/UIAccountSummary'
import { UIRewardList } from '../../models/widgets/display/UIRewardList'
import { UIInputText } from '../../models/widgets/input/UIInputText'
import { SaplingService } from '../sapling/sapling.service'
import { ErrorCategory, handleErrorSentry } from '../sentry-error-handler/sentry-error-handler'
export type SerializableTx =
  | RawTezosTransaction
  | RawEthereumTransaction
  | RawBitcoinTransaction
  | RawAeternityTransaction
  | CosmosTransaction
  | RawSubstrateTransaction

@Injectable({
  providedIn: 'root'
})
export class OperationsProvider {
  private readonly delegationStatuses: BehaviorSubject<Map<string, boolean>> = new BehaviorSubject(new Map())

  constructor(
    private readonly loadingController: LoadingController,
    private readonly toastController: ToastController,
    private readonly formBuilder: FormBuilder,
    private readonly protocolService: ProtocolService,
    private readonly saplingService: SaplingService
  ) {}

  public async getDelegateesSummary(wallet: AirGapMarketWallet, delegatees: string[]): Promise<UIAccountSummary[]> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    if (supportsAirGapDelegation(protocol)) {
      return protocol.createDelegateesSummary(delegatees)
    } else {
      const delegateesDetails = await Promise.all(delegatees.map((delegatee) => protocol.getDelegateeDetails(delegatee)))
      return delegateesDetails.map(
        (details) =>
          new UIAccountSummary({
            address: details.address,
            header: [details.name, ''],
            description: [details.address, '']
          })
      )
    }
  }

  public async getAccountExtendedDetails(wallet: AirGapMarketWallet): Promise<UIAccountExtendedDetails> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    if (supportsAirGapDelegation(protocol)) {
      return protocol.createAccountExtendedDetails(wallet.receivingPublicAddress)
    } else {
      return new UIAccountExtendedDetails({ items: [] })
    }
  }

  public async getCurrentDelegatees(wallet: AirGapMarketWallet): Promise<string[]> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    const current = await protocol.getCurrentDelegateesForAddress(wallet.receivingPublicAddress)
    if (current.length === 0) {
      let defaultDelegatee: string
      if (supportsAirGapDelegation(protocol)) {
        defaultDelegatee = protocol.airGapDelegatee()
      }

      return [defaultDelegatee || (await protocol.getDefaultDelegatee())]
    }
    return current
  }

  public async getDelegatorDetails(wallet: AirGapMarketWallet): Promise<DelegatorDetails> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    return protocol.getDelegatorDetailsFromAddress(wallet.receivingPublicAddress)
  }

  public async getDelegationDetails(wallet: AirGapMarketWallet, delegatees: string[]): Promise<AirGapDelegationDetails[]> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    return supportsAirGapDelegation(protocol)
      ? protocol.getExtraDelegationDetailsFromAddress(wallet.receivingPublicAddress, delegatees)
      : [await this.getDefaultDelegationDetails(protocol, wallet.receivingPublicAddress, delegatees)]
  }

  public async getRewardDisplayDetails(wallet: AirGapMarketWallet, delegatees: string[]): Promise<UIRewardList | undefined> {
    const protocol = wallet.protocol
    if (!supportsDelegation(protocol)) {
      return Promise.reject('Protocol does not support delegation.')
    }

    return supportsAirGapDelegation(protocol) ? protocol.getRewardDisplayDetails(wallet.receivingPublicAddress, delegatees) : undefined
  }

  private async getDefaultDelegationDetails(
    protocol: ICoinDelegateProtocol,
    delegator: string,
    delegatees: string[]
  ): Promise<AirGapDelegationDetails> {
    const details = await protocol.getDelegationDetailsFromAddress(delegator, delegatees)

    const [delegatorDetails, delegateesDetails] = await Promise.all([
      this.getDefaultDelegatorDetails(details.delegator, delegatees),
      this.getDefaultDelegateesDetails(details.delegatees)
    ])

    return {
      delegator: delegatorDetails,
      delegatees: delegateesDetails
    }
  }

  private async getDefaultDelegateesDetails(delegateesDetails: DelegateeDetails[]): Promise<AirGapDelegateeDetails[]> {
    return delegateesDetails.map((details) => ({
      name: '',
      ...details
    }))
  }

  private async getDefaultDelegatorDetails(delegatorDetails: DelegatorDetails, delegatees: string[]): Promise<AirGapDelegatorDetails> {
    const defaultDelegateActionTypeKeywords = ['delegate']
    const defaultUndelegateActionTypeKeywords = ['undelegate']

    const defaultMainParamNameKeywords = ['delegate', 'delegatee', 'baker', 'validator']

    return {
      ...delegatorDetails,
      delegatees: delegatorDetails.delegatees,
      mainActions: delegatorDetails.availableActions
        ? this.createDefaultMainDelegatorActions(
            delegatorDetails.availableActions,
            delegatees,
            defaultDelegateActionTypeKeywords,
            defaultUndelegateActionTypeKeywords,
            defaultMainParamNameKeywords
          )
        : []
    }
  }

  private createDefaultMainDelegatorActions(
    availableActions: DelegatorAction[],
    delegatees: string[],
    delegateActionTypeKeywords: string[],
    undelegateActionTypeKeywords: string[],
    delegateeArgKeywords: string[]
  ): AirGapDelegatorAction[] | undefined {
    return [
      this.createDefaultDelegateAction(
        availableActions,
        delegatees,
        delegateActionTypeKeywords,
        delegateeArgKeywords,
        'delegation-detail.delegate_label'
      ),
      this.createDefaultDelegateAction(
        availableActions,
        delegatees,
        undelegateActionTypeKeywords,
        delegateeArgKeywords,
        'delegation-detail.undelegate_label'
      ),
      ...this.createDefaultExtraActions(availableActions, [...delegateActionTypeKeywords, ...undelegateActionTypeKeywords])
    ].filter((action) => !!action)
  }

  private createDefaultDelegateAction(
    availableActions: DelegatorAction[],
    delegatees: string[],
    typeKeywords: any[],
    argsKeywords: string[] = [],
    label: string
  ): AirGapDelegatorAction | null {
    const action = availableActions.find((action) => typeKeywords.includes(action.type))
    if (action) {
      const paramName = action.args ? action.args.find((arg) => argsKeywords.includes(arg)) : undefined
      const args = action.args ? action.args.filter((arg) => arg !== paramName) : undefined

      const form = paramName ? this.formBuilder.group({ [paramName]: delegatees }) : undefined

      return {
        type: action.type,
        label,
        form: form,
        args: args
          ? args.map(
              (arg) =>
                new UIInputText({
                  id: arg,
                  label: arg
                })
            )
          : undefined
      }
    }

    return null
  }

  private createDefaultExtraActions(availableActions: DelegatorAction[], ignoreTypeKeywords: string[]): AirGapDelegatorAction[] {
    const extraActions = availableActions.filter((action) => !ignoreTypeKeywords.includes(action.type))

    return extraActions.map((action) => ({
      type: action.type,
      label: action.type.toString(),
      confirmLabel: action.type.toString(),
      args: action.args
        ? action.args.map(
            (arg) =>
              new UIInputText({
                id: arg,
                label: arg
              })
          )
        : undefined
    }))
  }

  public async prepareDelegatorAction(
    wallet: AirGapMarketWallet,
    type: any,
    data?: any
  ): Promise<{ airGapTxs: IAirGapTransaction[]; unsignedTx: any }> {
    if (supportsDelegation(wallet.protocol)) {
      const unsignedTx = (await wallet.protocol.prepareDelegatorActionFromPublicKey(wallet.publicKey, type, data))[0]

      const airGapTxs = await wallet.protocol.getTransactionDetails({
        publicKey: wallet.publicKey,
        transaction: unsignedTx
      })

      return { airGapTxs, unsignedTx }
    } else {
      return Promise.reject('Protocol does not support delegation.')
    }
  }

  public setDelegationStatusOfAddress(address: string, delegated: boolean) {
    this.delegationStatuses.next(this.delegationStatuses.getValue().set(address, delegated))
  }

  public async getDelegationStatusOfAddress(protocol: ICoinDelegateProtocol, address: string, refresh: boolean = false) {
    const delegationStatus = this.delegationStatuses.getValue().get(address)
    if (refresh || delegationStatus === undefined) {
      const isDelegated = await this.checkDelegated(protocol, address)
      this.setDelegationStatusOfAddress(address, isDelegated)

      return isDelegated
    } else {
      return delegationStatus
    }
  }

  public async getDelegationStatusObservableOfAddress(protocol: ICoinDelegateProtocol, address: string) {
    await this.getDelegationStatusOfAddress(protocol, address)

    return this.delegationStatuses.pipe(map((delegationStatuses) => delegationStatuses.get(address)))
  }

  public refreshAllDelegationStatuses(wallets: AirGapMarketWallet[]) {
    Array.from(this.delegationStatuses.getValue().entries()).forEach((entry) => {
      const address = entry[0]
      const wallet = wallets.find((wallet) => wallet.receivingPublicAddress === address && supportsDelegation(wallet.protocol))
      if (wallet) {
        this.getDelegationStatusOfAddress(wallet.protocol as ICoinDelegateProtocol, address, true).catch(
          handleErrorSentry(ErrorCategory.OPERATIONS_PROVIDER)
        )
      }
    })
  }

  public async prepareSignRequest(
    wallet: AirGapMarketWallet,
    serializableData: any,
    type: IACMessageType,
    generatedId: number
  ): Promise<IACMessageDefinitionObjectV3[]> {
    switch (type) {
      case IACMessageType.MessageSignRequest:
        return this.prepareMessageSignRequest(wallet, serializableData, type, generatedId)
      default:
        return this.prepareTransactionSignRequest(wallet, serializableData, type, generatedId)
    }
  }

  public async prepareTransactionSignRequest(
    wallet: AirGapMarketWallet,
    transaction: SerializableTx,
    type: IACMessageType,
    generatedId: number
  ): Promise<IACMessageDefinitionObjectV3[]> {
    const payload = {
      publicKey: wallet.publicKey,
      transaction: transaction as any, // TODO: Type
      callbackURL: 'airgap-wallet://?d='
    }
    return [
      {
        id: generatedId,
        protocol: wallet.protocol.identifier,
        type: type,
        payload: payload
      }
    ]
  }

  public async prepareMessageSignRequest(
    wallet: AirGapMarketWallet,
    request: SignPayloadRequestOutput,
    type: IACMessageType,
    generatedId: number
  ): Promise<IACMessageDefinitionObjectV3[]> {
    const payload = {
      publicKey: wallet.publicKey,
      message: request.payload,
      callbackURL: 'airgap-wallet://?d='
    }
    return [
      {
        id: generatedId,
        protocol: wallet.protocol.identifier,
        type: type,
        payload: payload
      }
    ]
  }

  public async checkDelegated(protocol: ICoinDelegateProtocol, address: string): Promise<boolean> {
    return supportsDelegation(protocol) ? protocol.isAddressDelegating(address) : false
  }

  public async prepareTransaction(
    wallet: AirGapMarketWallet,
    address: string,
    amount: BigNumber,
    fee: BigNumber,
    knownWallets: AirGapMarketWallet[],
    data?: { [key: string]: any }
  ): Promise<{ airGapTxs: IAirGapTransaction[]; unsignedTx: any }> {
    const loader = await this.getAndShowLoader()

    try {
      let unsignedTx
      // TODO: This is an UnsignedTransaction, not an IAirGapTransaction
      let airGapTxs: IAirGapTransaction[]
      if (wallet.protocol.identifier === SubProtocolSymbols.XTZ_KT) {
        const tezosKtProtocol = new TezosKtProtocol()
        unsignedTx = await tezosKtProtocol.migrateKtContract(wallet.publicKey, wallet.receivingPublicAddress) // TODO change this
        airGapTxs = await wallet.protocol.getTransactionDetails({
          publicKey: wallet.publicKey,
          transaction: unsignedTx
        })
      } else if (wallet.protocol.identifier === SubProtocolSymbols.XTZ_BTC) {
        const protocol = new TezosBTC()

        unsignedTx = await protocol.transfer(
          wallet.addresses[0],
          address,
          amount.toString(10),
          fee.toString(10), // TODO calculate how high a fee we have to set for the TezosBTC contract
          wallet.publicKey
        )

        airGapTxs = await wallet.protocol.getTransactionDetails({
          publicKey: wallet.publicKey,
          transaction: unsignedTx
        })
      } else if (wallet.protocol.identifier === MainProtocolSymbols.XTZ && TezosSaplingAddress.isZetAddress(address)) {
        const protocols: ICoinProtocol[] = (await this.protocolService.getProtocolsForAddress(address)).filter(
          (protocol: ICoinProtocol) => protocol.identifier !== MainProtocolSymbols.XTZ
        )

        if (protocols.length > 1) {
          throw new Error('More than 1 sapling protocol is supported')
        }

        const protocol: ICoinProtocol = protocols[0]

        if (!(protocol instanceof TezosSaplingProtocol)) {
          throw new Error('Invalid sapling protocol')
        }

        await this.saplingService.initSapling()
        unsignedTx = await protocol.prepareShieldTransaction(wallet.publicKey, address, amount.toString(10), fee.toString(10), {
          overrideFees: true
        })

        const knownViewingKeys: string[] = knownWallets
          .filter((wallet: AirGapMarketWallet) => wallet.protocol.identifier === protocol.identifier)
          .map((wallet: AirGapMarketWallet) => wallet.publicKey)

        airGapTxs = await protocol.getTransactionDetails(
          {
            publicKey: wallet.publicKey,
            transaction: unsignedTx
          },
          { knownViewingKeys }
        )
      } else {
        if (wallet.protocol.identifier === MainProtocolSymbols.XTZ_SHIELDED) {
          await this.saplingService.initSapling()
        }
        if (wallet.protocol.identifier === MainProtocolSymbols.BTC_SEGWIT) {
          // data could already contain "replaceByFee"
          if (!data) {
            data = {}
          }
          data.masterFingerprint = wallet.masterFingerprint
        }
        unsignedTx = await wallet.prepareTransaction([address], [amount.toString(10)], fee.toString(10), data)
        airGapTxs = await wallet.protocol.getTransactionDetails({
          publicKey: wallet.publicKey,
          transaction: unsignedTx
        })
      }

      return { airGapTxs, unsignedTx }
    } catch (error) {
      handleErrorSentry(ErrorCategory.COINLIB)(error)

      this.toastController
        .create({
          message: error.message,
          duration: 3000,
          position: 'bottom'
        })
        .then((toast) => {
          toast.present().catch(handleErrorSentry(ErrorCategory.IONIC_TOAST))
        })
      throw error
    } finally {
      this.hideLoader(loader)
    }
  }

  public async estimateMaxTransferAmount(
    wallet: AirGapMarketWallet,
    destination: string,
    fee?: BigNumber,
    data?: { [key: string]: any }
  ): Promise<BigNumber> {
    const maxAmount = await wallet.getMaxTransferValue([destination], fee ? fee.toFixed() : undefined, data)
    return new BigNumber(maxAmount)
  }

  public async estimateFees(
    wallet: AirGapMarketWallet,
    address: string,
    amount: BigNumber,
    data?: { [key: string]: any }
  ): Promise<FeeDefaults> {
    try {
      return await wallet.estimateFees([address], [amount.toFixed()], data)
    } catch (error) {
      console.error(error)
      return wallet.protocol.feeDefaults
    }
  }

  private async getAndShowLoader() {
    const loader = await this.loadingController.create({
      message: 'Preparing transaction...'
    })

    await loader.present().catch(handleErrorSentry(ErrorCategory.IONIC_LOADER))

    return loader
  }

  private hideLoader(loader: HTMLIonLoadingElement) {
    loader.dismiss().catch(handleErrorSentry(ErrorCategory.IONIC_LOADER))
  }
}
