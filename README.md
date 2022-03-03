# NFT Snapshot

A script to scrape owners of a given NFT. Helpful for snapshots for airdrops, white lists, etc.

## How To Use

1) Install dependencies (ethers and csv-writer) with `npm install`.
2) Fill out the options at the top of the script:

- TOKEN_ADDRESS: Address of the token on the chain in question, formatted as "0x..."
- STARTING_TOKEN_ID: The script will start checking owners at this ID (defaults to 0).
- HIGHEST_TOKEN_ID: The script will check owners of IDs up to this number (inclusive).
- PROVIDER_ENDPOINT: A URL from Infura or Alchemy to create a JSON RPC provider.
- CHAIN_ID: The ID for the chain the NFT lives on. Defaults to Ethereum Mainnet (ID: 1).
- FORMAT: The format that you'd like the final data organized by (see section below).

3) Run from the terminal with `npm run start`. It should check approximately 200 owners per minute.

## Formats

There are two options for output formats for the data:

- tokensByOwner: Lists each owner, the count of the number of NFTs they own, and the specific IDs they own.
- ownerByTokenId: Lists all token IDs in order and the owner associated with each.