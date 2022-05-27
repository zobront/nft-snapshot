#!/usr/bin/env node
import fs from 'fs';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import moment from 'moment';
import { timeAndExecute } from './utils.js';
import { 
    getErc721Assets,
    getErc1155Assets,
    getOpenseaAssets,
    automate,
} from './on-chain/index.js';
import { writeAssets } from './output.js';

yargs(hideBin(process.argv))
.option({
    ['format']: {
        alias: 'f',
        desc: 'format for the results (tokensByOwner or idsByOwner)',
        type: 'string',
        default: 'json'
    }
})
.command(
    'erc721', 
    'snapshot a vanilla ERC 721 contract', 
    {
        ['name']: {
            alias: 'n',
            desc: 'the name of this collection',
            type: 'string',
            required: true,
        },
        ['address']: {
            alias: 'a',
            desc: 'the contract address for the collection',
            type: 'string',
            required: true,
        },
        ['startId']: {
            alias: 's',
            desc: 'start tokenId (numeric) for the collection',
            type: 'number',
            default: 1,
        },
        ['endId']: {
            alias: 'e',
            desc: 'end tokenId (numeric, inclusive) for the collection',
            type: 'number',
            default: 20000,
        },
    },
    async (args) => {
        timeAndExecute(async () => {
            const output = await getErc721Assets({
                name: args.name,
                address: args.address,
                startId: args.startId && +args.startId, 
                endId: args.endId && +args.endId
            });
            await writeAssets(output, args.format);
        });
    }
)
.command(
    'erc1155', 
    'snapshot a vanilla ERC ERC 1155 contract', 
    {
        ['name']: {
            alias: 'n',
            desc: 'the name of this collection',
            type: 'string',
            required: true,
        },
        ['address']: {
            alias: 'a',
            desc: 'the contract address for the collection',
            type: 'string',
            required: true,
        },
        ['startId']: {
            alias: 's',
            desc: 'start tokenId (numeric) for the collection',
            type: 'number',
            default: 1,
        },
        ['endId']: {
            alias: 'e',
            desc: 'end tokenId (numeric, inclusive) for the collection',
            type: 'number',
            default: 20000,
        },
    },
    async (args) => {
        timeAndExecute(async () => {
            const output = await getErc1155Assets({
                name: args.name,
                address: args.address,
                startId: args.startId && +args.startId, 
                endId: args.endId && +args.endId
            });
            await writeAssets(output, args.format);
        });
    }
)
.command(
    'opensea', 
    'snapshot an OpenSea shared storefront collection', 
    {
        ['slug']: {
            alias: 'S',
            desc: 'The opensea slug for the collection',
            type: 'string',
            required: true,
        }
    }, 
    async (args) => {
        timeAndExecute(async () => {
            const output = await getOpenseaAssets({ name: args.slug })
            writeAssets(output, args.format);
        });
    }
)
.command(
    'automate',
    'use a scan-config to build auto-scanning functionality',
    {
        ['config']: {
            alias: 'c',
            desc: 'The path to the scan configuration',
            type: 'string',
            default: './automate.json'
        }
    },
    async (args) => {
        timeAndExecute(async () => {
            const options = JSON.parse(fs.readFileSync(args.config, { encoding: 'utf-8' }));
            options.combine = options.combine ?? true;
            const allCollections = await automate(options);
            if (options.combine) {
                const output = {
                    name: moment().format(),
                    assets: allCollections,
                };
                writeAssets(output, 'json');
            } else {
                for (const collectionName in allCollections) {
                    const assets = allCollections[collectionName];
                    writeAssets(
                        {
                            name: collectionName,
                            assets,
                        }, 
                        'json'
                    );
                }
            }
        });
    }
)
.help()
.argv;
