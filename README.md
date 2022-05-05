# NFT Snapshot

A script to scrape owners of a given NFT. Helpful for snapshots for airdrops, white lists, etc.

## How To Use

1) Install dependencies (ethers and csv-writer) with `npm install`.
2) Create a file in the root of the project named .env
3) Open .env, and create the following contents. Make sure all of the settings are appropriate.
- PROVIDER_ENDPOINT: A URL from Infura or Alchemy to create a JSON RPC provider.
- CHAIN_ID: The ID for the chain the NFT lives on (defaults to Ethereum Mainnet, ID: 1).

Example File:
```
PROVIDER_ENDPOINT="https://..."
CHAIN_ID=1
```
You can optionally provide these in the command line (export PROVIDER_ENDPOINT="https://...")

4) Optionally install the package globally on your system with `npm i -g ./`
5) Use example scripts below to run the script

## Example Scripts

To query a self-custody collection (a typical NFT collection underneath a known ERC 721 address):
```
nftsnap erc -a yourtokenaddress --startIndex 0 --endIndex 9999
```

To query an OpenSea shared storefront collection. More info from OpenSea on [collection slugs](https://docs.opensea.io/reference/collection-model):
```
nftsnap opensea --slug your-collection-slug
```

## Formats

There are two options for output formats for the data:

- tokensByOwner: Lists each owner, the count of the number of NFTs they own, and the specific IDs they own.
- ownerByTokenId: Lists all token IDs in order and the owner associated with each.
