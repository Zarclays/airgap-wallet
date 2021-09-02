import {
  AppInfoPlugin,
  APP_INFO_PLUGIN,
  APP_PLUGIN,
  AddressService,
  ExternalAliasResolver,
  IACMessageTransport,
  LanguageService,
  ProtocolService,
  SerializerService,
  SPLASH_SCREEN_PLUGIN,
  STATUS_BAR_PLUGIN
} from '@zarclays/zgap-angular-core'
import {
  AirGapMarketWallet,
  generateId,
  IACMessageType,
  IAirGapTransaction,
  ICoinProtocol,
  ICoinSubProtocol,
  MainProtocolSymbols,
  NetworkType,
  TezblockBlockExplorer,
  TezosKtProtocol,
  TezosNetwork,
  TezosProtocol,
  TezosProtocolNetwork,
  TezosProtocolNetworkExtras,
  TezosProtocolOptions,
  TezosSaplingExternalMethodProvider,
  TezosShieldedTezProtocol
} from '@zarclays/zgap-coinlib-core'
import {
  TezosSaplingProtocolOptions,
  TezosShieldedTezProtocolConfig
} from '@zarclays/zgap-coinlib-core/protocols/tezos/sapling/TezosSaplingProtocolOptions'
import { HttpClient } from '@angular/common/http'
import { TezosDomains } from '@zarclays/zgap-coinlib-core/protocols/tezos/domains/TezosDomains'
import { AfterViewInit, Component, Inject, NgZone } from '@angular/core'
import { Router } from '@angular/router'
import { AppPlugin, AppUrlOpen, SplashScreenPlugin, StatusBarPlugin, StatusBarStyle } from '@capacitor/core'
import { Config, Platform } from '@ionic/angular'
import { TranslateService } from '@ngx-translate/core'
import { Subscription } from 'rxjs'

import { AccountProvider } from './services/account/account.provider'
import { DataService, DataServiceKey } from './services/data/data.service'
import { IACService } from './services/iac/iac.service'
import { PushProvider } from './services/push/push'
import { SaplingNativeService } from './services/sapling-native/sapling-native.service'
import { ErrorCategory, handleErrorSentry, setSentryRelease, setSentryUser } from './services/sentry-error-handler/sentry-error-handler'
import { WalletStorageKey, WalletStorageService } from './services/storage/storage'
import { generateGUID } from './utils/utils'
import { WalletconnectService } from './services/walletconnect/walletconnect.service'

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html'
})
export class AppComponent implements AfterViewInit {
  public isMobile: boolean = false
  public isElectron: boolean = false

  constructor(
    private readonly platform: Platform,
    private readonly translate: TranslateService,
    private readonly languageService: LanguageService,
    private readonly iacService: IACService,
    private readonly protocolService: ProtocolService,
    private readonly storageProvider: WalletStorageService,
    private readonly accountProvider: AccountProvider,
    private readonly addressService: AddressService,
    private readonly serializerService: SerializerService,
    private readonly pushProvider: PushProvider,
    private readonly walletconnectService: WalletconnectService,
    private readonly router: Router,
    private readonly dataService: DataService,
    private readonly config: Config,
    private readonly ngZone: NgZone,
    private readonly httpClient: HttpClient,
    private readonly saplingNativeService: SaplingNativeService,
    @Inject(APP_PLUGIN) private readonly app: AppPlugin,
    @Inject(APP_INFO_PLUGIN) private readonly appInfo: AppInfoPlugin,
    @Inject(SPLASH_SCREEN_PLUGIN) private readonly splashScreen: SplashScreenPlugin,
    @Inject(STATUS_BAR_PLUGIN) private readonly statusBar: StatusBarPlugin
  ) {
    this.initializeApp().catch(handleErrorSentry(ErrorCategory.OTHER))
    this.isMobile = this.platform.is('mobile')
    this.isElectron = this.platform.is('electron')
  }

  public async initializeApp(): Promise<void> {
    await Promise.all([this.initializeTranslations(), this.platform.ready(), this.initializeProtocols(), this.initializeWalletConnect()])

    if (this.platform.is('hybrid')) {
      await Promise.all([
        this.statusBar.setStyle({ style: StatusBarStyle.Light }),
        this.statusBar.setBackgroundColor({ color: '#FFFFFF' }),
        this.splashScreen.hide(),

        this.pushProvider.initPush()
      ])

      this.appInfo
        .get()
        .then((appInfo: { appName: string; packageName: string; versionName: string; versionCode: number }) => {
          setSentryRelease(`app_${appInfo.versionName}`)
        })
        .catch(handleErrorSentry(ErrorCategory.CORDOVA_PLUGIN))
    }

    let userId: string = await this.storageProvider.get(WalletStorageKey.USER_ID)
    if (!userId) {
      userId = generateGUID()
      this.storageProvider.set(WalletStorageKey.USER_ID, userId).catch(handleErrorSentry(ErrorCategory.STORAGE))
    }
    setSentryUser(userId)

    const url: URL = new URL(location.href)

    if (url.searchParams.get('rawUnsignedTx')) {
      // Wait until wallets are initialized
      // TODO: Use wallet changed observable?
      const sub: Subscription = this.accountProvider.wallets$.subscribe(async () => {
        await this.walletDeeplink()
        if (sub) {
          sub.unsubscribe()
        }
      })
    }
  }

  public async ngAfterViewInit(): Promise<void> {
    await this.platform.ready()
    if (this.platform.is('ios')) {
      this.translate.get(['back-button']).subscribe((translated: { [key: string]: string | undefined }) => {
        const back: string = translated['back-button']
        this.config.set('backButtonText', back)
      })
    }
    if (this.platform.is('hybrid')) {
      this.app.addListener('appUrlOpen', (data: AppUrlOpen) => {
        this.ngZone.run(() => {
          if (data.url === 'airgap-wallet://' || data.url === 'https://wallet.airgap.it' || data.url === 'https://wallet.airgap.it/') {
            // Ignore empty deeplinks
            return
          }
          this.iacService.handleRequest(data.url, IACMessageTransport.DEEPLINK).catch(handleErrorSentry(ErrorCategory.SCHEME_ROUTING))
        })
      })
    }
  }

  // TODO: Move to provider
  public async walletDeeplink(): Promise<void> {
    const url: URL = new URL(location.href)
    const publicKey: string = url.searchParams.get('publicKey')
    const rawUnsignedTx: unknown = JSON.parse(url.searchParams.get('rawUnsignedTx'))
    const identifier: string = url.searchParams.get('identifier')

    const wallet: AirGapMarketWallet = this.accountProvider.walletByPublicKeyAndProtocolAndAddressIndex(publicKey, identifier)
    const airGapTxs: IAirGapTransaction[] = await wallet.protocol.getTransactionDetails({
      publicKey: wallet.publicKey,
      transaction: rawUnsignedTx
    })

    const serializedTx: string | string[] = await this.serializerService.serialize([
      {
        id: generateId(8),
        protocol: wallet.protocol.identifier,
        type: IACMessageType.TransactionSignRequest,
        payload: {
          publicKey: wallet.publicKey,
          transaction: rawUnsignedTx as any,
          callbackURL: 'airgap-wallet://?d='
        }
      }
    ])

    const info = {
      wallet,
      airGapTxs,
      data: serializedTx
    }
    this.dataService.setData(DataServiceKey.TRANSACTION, info)
    this.router.navigateByUrl(`/transaction-qr/${DataServiceKey.TRANSACTION}`).catch(handleErrorSentry(ErrorCategory.NAVIGATION))
  }

  private async initializeTranslations(): Promise<void> {
    return this.languageService.init({
      supportedLanguages: ['en', 'de', 'zh-cn'],
      defaultLanguage: 'en'
    })
  }
  private async initializeWalletConnect(): Promise<void> {
    this.walletconnectService.initWalletConnect()
  }

  private async initializeProtocols(): Promise<void> {
    const edonetNetwork: TezosProtocolNetwork = new TezosProtocolNetwork(
      'Edonet',
      NetworkType.TESTNET,
      'https://tezos-edonet-node.prod.gke.papers.tech',
      new TezblockBlockExplorer('https//edonet.tezblock.io'),
      new TezosProtocolNetworkExtras(
        TezosNetwork.EDONET,
        'https://tezos-edonet-conseil.prod.gke.papers.tech',
        TezosNetwork.EDONET,
        'airgap00391'
      )
    )
    const edonetProtocol: TezosProtocol = new TezosProtocol(new TezosProtocolOptions(edonetNetwork))

    const florencenetNetwork: TezosProtocolNetwork = new TezosProtocolNetwork(
      'Florencenet',
      NetworkType.TESTNET,
      'https://tezos-florencenet-node.prod.gke.papers.tech',
      new TezblockBlockExplorer('https//florencenet.tezblock.io'),
      new TezosProtocolNetworkExtras(
        TezosNetwork.FLORENCENET,
        'https://tezos-florencenet-conseil.prod.gke.papers.tech',
        TezosNetwork.FLORENCENET,
        'airgap00391'
      )
    )
    const florencenetProtocol: TezosProtocol = new TezosProtocol(new TezosProtocolOptions(florencenetNetwork))

    const granadanetNetwork: TezosProtocolNetwork = new TezosProtocolNetwork(
      'Granadanet',
      NetworkType.TESTNET,
      'https://tezos-granadanet-node.prod.gke.papers.tech',
      new TezblockBlockExplorer('https//granadanet.tezblock.io'),
      new TezosProtocolNetworkExtras(
        TezosNetwork.GRANADANET,
        'https://tezos-granadanet-conseil.prod.gke.papers.tech',
        TezosNetwork.MAINNET,
        'airgap00391'
      )
    )

    const granadanetProtocol: TezosProtocol = new TezosProtocol(new TezosProtocolOptions(granadanetNetwork))

    const externalMethodProvider: TezosSaplingExternalMethodProvider | undefined =
      await this.saplingNativeService.createExternalMethodProvider()

    const shieldedTezProtocol: TezosShieldedTezProtocol = new TezosShieldedTezProtocol(
      new TezosSaplingProtocolOptions(
        florencenetNetwork,
        new TezosShieldedTezProtocolConfig(undefined, undefined, undefined, externalMethodProvider)
      )
    )

    this.protocolService.init({
      extraActiveProtocols: [
        edonetProtocol, 
        florencenetProtocol,
        granadanetProtocol,
        shieldedTezProtocol
      ],
      extraPassiveSubProtocols: [[granadanetProtocol, new TezosKtProtocol(new TezosProtocolOptions(granadanetNetwork))]]
    })

    await this.initializeTezosDomains()
    await shieldedTezProtocol.initParameters(await this.getSaplingParams('spend'), await this.getSaplingParams('output'))
  }

  private async getSaplingParams(type: 'spend' | 'output'): Promise<Buffer> {
    if (this.platform.is('hybrid')) {
      // Sapling params are read and used in a native plugin, there's no need to read them in the Ionic part
      return Buffer.alloc(0)
    }

    const params: ArrayBuffer = await this.httpClient
      .get(`./assets/sapling/sapling-${type}.params`, { responseType: 'arraybuffer' })
      .toPromise()

    return Buffer.from(params)
  }

  private async initializeTezosDomains(): Promise<void> {
    const tezosDomainsAddresses: Record<TezosNetwork, string | undefined> = {
      [TezosNetwork.MAINNET]: 'KT1GBZmSxmnKJXGMdMLbugPfLyUPmuLSMwKS',
      [TezosNetwork.EDONET]: 'KT1JJbWfW8CHUY95hG9iq2CEMma1RiKhMHDR',
      [TezosNetwork.FLORENCENET]: 'KT1PfBfkfUuvQRN8zuCAyp5MHjNrQqgevS9p',
      [TezosNetwork.GRANADANET]: ''
    }

    const tezosNetworks: TezosProtocolNetwork[] = (await this.protocolService.getNetworksForProtocol(
      MainProtocolSymbols.XTZ
    )) as TezosProtocolNetwork[]

    const tezosDomainsWithNetwork: [TezosProtocolNetwork, TezosDomains][] = tezosNetworks
      .map((network: TezosProtocolNetwork) => {
        const contractAddress: string | undefined = tezosDomainsAddresses[network.extras.network]

        return contractAddress !== undefined
          ? ([network, new TezosDomains(network, contractAddress)] as [TezosProtocolNetwork, TezosDomains])
          : undefined
      })
      .filter((tezosDomainsWithNetwork: [TezosProtocolNetwork, TezosDomains] | undefined) => tezosDomainsWithNetwork !== undefined)

    await Promise.all(
      tezosDomainsWithNetwork.map(async ([network, tezosDomains]: [TezosProtocolNetwork, TezosDomains]) => {
        const externalAliasResolver: ExternalAliasResolver = {
          validateReceiver: async (receiver: string): Promise<boolean> => (await tezosDomains.nameToAddress(receiver)) !== undefined,
          resolveAlias: tezosDomains.nameToAddress.bind(tezosDomains),
          getAlias: tezosDomains.addressToName.bind(tezosDomains)
        }

        const [tezosProtocol, tezosSubProtocols]: [ICoinProtocol, ICoinSubProtocol[]] = await Promise.all([
          this.protocolService.getProtocol(MainProtocolSymbols.XTZ, network),
          this.protocolService.getSubProtocols(MainProtocolSymbols.XTZ, network)
        ])

        this.addressService.registerExternalAliasResolver(externalAliasResolver, tezosProtocol)
        tezosSubProtocols.forEach((subProtocol: ICoinSubProtocol) => {
          this.addressService.registerExternalAliasResolver(externalAliasResolver, subProtocol)
        })
      })
    )
  }
}
