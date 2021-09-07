# ZGap Wallet

<p align="left">
    <img src="./banner.png" />
</p>

> Self custody made simple and secure. Protect your crypto and store your private keys offline.

[ZGap](https://zgapwallet.zarclays.com) is a crypto wallet system that lets you secure cypto assets with one secret on an offline device. The [ZGap Vault](https://github.com/zarclays/zgap-vault) application is installed on a dedicated device that has no connection to any network, thus it is air gapped. The ZGap Wallet is installed on your everyday smartphone.

## Description

ZGap Wallet has an overview of all accounts with their respective balances and transaction histories. ZGap Wallet never touches your secret data stored in the ZGap Vault. It is responsible for creating and broadcasting transactions. The prepared transaction is sent to the secure Vault over QR codes, where it is securely signed and sent back.

ZGap Wallet is a hybrid application (using the same codebase for Android and iOS). Created using ZGap's protocol agnostic `airgap-coin-lib` library to interact with different protocols and our own secure storage implementation.

<p align="left">
    <img src="./devices.png" />
</p>

## Download

- [Google Play](https://play.google.com/store/apps/details?id=com.zgap.wallet)
- [App Store](https://itunes.apple.com/us/app/zgap-wallet/id1420996542?l=de&ls=1&mt=8)

## Features

- Portfolio overview of accounts synced from ZGap Vault
- Communication with the Vault application over QR codes if installed on a second device or app switching if installed on the same device
- Create transactions for all supported currencies like Aeternity, Bitcoin, Ethereum, Tezos, Cosmos, Kusama, Polkadot, Groestlcoin etc.
- Broadcast signed transactions
- Transaction history for each account

## Build

First follow the steps below to install the dependencies:

```bash
$ npm install -g @capacitor/cli
$ npm install
```

Run locally in browser:

```bash
$ npm run start
```

Build and open native project

```bash
$ npm run build
$ npx cap sync
```

You can now open the native iOS or Android projects in XCode or Android Studio respectively.

```bash
$ npx cap open ios
$ npx cap open android
```

## Testing

To run the unit tests:

```bash
$ npm test
```

## Disclosing Security Vulnerabilities

If you discover a security vulnerability within this application, please send an e-mail to hi@airgap.it. All security vulnerabilities will be promptly addressed.

## Contributing

Before integrating a new feature, please quickly reach out to us in an issue so we can discuss and coordinate the change.

- If you find any bugs, submit an [issue](../../issues) or open [pull-request](../../pulls).
- If you want to integrate a new blockchain, please read the contributing guidelines in the [airgap-coin-lib](https://github.com/zarclays/zgap-coin-lib) project.
- Engage with other users and developers on the [ZGap Discord](https://discord.gg/gnWqCQsteh).

## Related Projects

- [ZGap Wallet](https://github.com/zarclays/zgap-wallet)
- [zgap-coin-lib](https://github.com/zarclays/zgap-coin-lib)



