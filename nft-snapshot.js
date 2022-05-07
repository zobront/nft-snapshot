#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ethers from 'ethers';
import fs from 'fs';
import csvWriter from 'csv-writer';
import moment from 'moment';
const createCsvWriter = csvWriter.createObjectCsvWriter;

const PROVIDER_ENDPOINT = process.env.PROVIDER_ENDPOINT; // SEE README
const CHAIN_ID = +process.env.CHAIN_ID;
const OPENSEA_TOKEN = process.env.OPENSEA_TOKEN;
const MORALIS_TOKEN=process.env.MORALIS_TOKEN;
let openseaQueried = false;

function setTimeoutAsync(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

function writeTextAsync(path, string) {
    return new Promise(resolve => fs.writeFile(path, string, { encoding: 'utf-8' }, () => resolve()));
}

function getContract(address) {
    const provider = new ethers.providers.JsonRpcProvider(PROVIDER_ENDPOINT, CHAIN_ID);
    const abi = ["function ownerOf (uint256) view returns (address)"];
    return new ethers.Contract(address, abi, provider);
}

// options
// {
//     address: string,
//     include: number[]?
//     startIndex: number?,
//     endIndex: number?,
// }
async function getErc721Assets(options) {
    const contract = getContract(options.address);

    const assets = [];

    if (options.include) {
        for (const index of options.include) {
            try {
                assets.push(await getErc721Owner(contract, index));
            } catch(err) {
                console.error(`Token ${id} Error:`);
                console.error(err.reason);
                continue;
            }
        }
    } else {
        for (let index = (options.startIndex ?? 1); index <= (options.endIndex ?? 20000); index++) {
            try {
                assets.push(await getErc721Owner(contract, index));
                
            } catch (err) {
                if (err && err.reason && err.reason.includes('nonexistent token')) {
                    console.log(`auto-detected end of collection at index ${index-1}.`);
                    break;
                } else {
                    console.error(`Token ${index} Error:`);
                    console.error(err.reason);
                    continue;
                }
            }
        }
    }

    return assets; 
}

async function getErc721Owner(contract, index) {
    console.log(`Getting data for ${index}...`);
    return {
        id: index,
        owner: await contract.ownerOf(index),
    }
}

// options
// {
//     address: string,
//     include: number[]?
//     startIndex: number?,
//     endIndex: number?,
// }
async function getErc1155Assets(options) {
    const assets = [];

    if (options.include) {
        for (const index of options.include) {
            await setTimeoutAsync(300);
            try {
                assets.push(...getErc1155Owners(options.address, index));
            } catch (err) {
                console.log(`auto-detected end of collection at index ${id-1}.`);
                break;
            }
        }
    } else {
        for (let index = (options.startIndex ?? 1); index <= (options.endIndex ?? 20000); index++) {
            await setTimeoutAsync(300);
            try {
                const owners = await getErc1155Owners(options.address, index);
                assets.push(...owners);
            } catch (err) {
                console.log(`auto-detected end of collection at index ${index-1}.`);
                break;
            }
        }
    }

    return assets; 
}

async function getErc1155Owners(address, index) {
    console.log(`Getting data for ${index}...`);
    const url = `https://deep-index.moralis.io/api/v2/nft/${address}/${index}/owners?chain=eth&format=decimal`;
    const headers = {
        'Accept': 'application/json',
        'X-API-KEY': MORALIS_TOKEN,
        'Content-Type': 'application/json',
    }
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(response.statusText);
    }
    const ownerQuery = await response.json();
    return ownerQuery.result.map(token => ({
        index,
        owner: token.owner_of   
    }));
}

// {
//     name: string, // opensea-slug
//     include: number[]?
// }
async function getOpenseaAssets(options) {
    const array = [];
    const assets = await getOpenseaAssetsInCollection(options.name);
        
    if (options.include) {
        for (const index of options.include) {
            try {
                const asset = assets.find(a => a.token_id === index);
                if (asset) {
                    array.push(await getOpenseaOwner(asset));
                } else {
                    throw new Error(`Could not find an asset for index ${index}`);
                }
            } catch (err) {
                console.error(err);
                continue;
            }
        }
    } else {
        for (const asset of assets) {
            try {
                array.push(await getOpenseaOwner(asset));
            } catch (err) {
                console.error(err);
            }
        }
    }

    return array;
}

async function getOpenseaAsset(address, tokenId) {
    if (openseaQueried) {
        await setTimeoutAsync(300);
    }

    openseaQueried = true;

    const url = `https://api.opensea.io/api/v1/asset/${address}/${tokenId}`;
    const headers = {
        'X-API-KEY': OPENSEA_TOKEN
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    return await response.json();
}

async function getOpenseaAssetsInCollection(slug, array = undefined, next = undefined) {
    if (openseaQueried) {
        await setTimeoutAsync(300);
    }

    openseaQueried = true;

    if (!array) {
        array = [];
    }

    const url = `https://api.opensea.io/api/v1/assets?collection_slug=${slug}&limit=50${next ? `&next=${next}` : ''}`;
    const headers = {
        'X-API-KEY': OPENSEA_TOKEN
    };


    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(response.statusText);
    }

    const assetsBody = await response.json();
    console.log(`Received ${assetsBody.assets.length} assets`);
    array.push(...assetsBody.assets);

    if (assetsBody.next) {
        return getOpenseaAssets(slug, array, assetsBody.next);
    } else {
        return array;
    }
}

async function getOpenseaOwner(asset) {
    // return {
    //     id: asset.id,
    //     owner: asset.owner.address
    // };

    // HACK: OpenSea's API does not return owner properly. Both the Assets and Asset endpoints return null.
    // The solution is currently to hit each asset individually, and extract the owner from top_ownerships.
    // This requires N+1 requests, and is not ideal. I have an open issue with the OpenSea API team.
    const address = asset.asset_contract.address;
    const tokenId = asset.token_id;
    console.log(`Getting data for ${tokenId}...`);
    const hackAsset = await getOpenseaAsset(address, tokenId);
    if (hackAsset.top_ownerships.length !== 1) {
        throw new Error(`Unexpected: Contract ${address} id ${tokenId} has ${hackAsset.top_ownerships.length} owners.`);
    }
    return {
        id: hackAsset.id,
        owner: hackAsset.top_ownerships[0].owner.address,
    };
}

async function writeOwnerByTokenId(name, assets) {
    const ownerByTokenIdWriter = createCsvWriter({
        path: `out/${name}.csv`,
        header: [
            {id: 'id', title: 'ID'},
            {id: 'owner', title: 'Owner'},
        ]
    });

    try {
        await ownerByTokenIdWriter.writeRecords(assets);
    } catch (err) {
        console.log('Failed writing CSV:', err);
    }
}

async function writeTokensByOwner(name, assets) {
    const tokensByOwnerWriter = createCsvWriter({
        path: `out/${name}.csv`,
        header: [
            {id: 'address', title: 'Address'},
            {id: 'count', title: 'Count'},
            {id: 'ids', title: 'IDs'},
        ]
    });

    const idsByOwner = {}

    for (const asset of assets) {
        asset.owner in idsByOwner ? idsByOwner[asset.owner].push(asset.id) : idsByOwner[asset.owner] = [ asset.id ];
    }

    const outputData = Object.keys(idsByOwner).map(address => ({ address, count: idsByOwner[address].length, ids: idsByOwner[address] }))
    await tokensByOwnerWriter.writeRecords(outputData)
}

async function timeAndExecute(callback) {
    const timeBefore = new Date().getTime();
    await callback();   
    const timeAfter = new Date().getTime();
    const timeTaken = (timeAfter - timeBefore) / 1000;
    console.log(`Script Completed. Total Run Time: ${timeTaken} Seconds`)
}

async function writeAssets(output, format) {
    console.log(`Writing assets in the format ${format}...`);
    switch (format) {
        case "json":
            await writeTextAsync(`./out/${output.name}.json`, JSON.stringify(output.assets, null, 4));
            break;
            case "tokensByOwner":
            await writeTokensByOwner(output.name ?? 'tokensByOwner', output.assets);
            break;
        case "ownerByTokenId":
            await writeOwnerByTokenId(output.name  ?? 'ownerByTokenId', output.assets);
            break;
        default:
            console.log(`Invalid format. ${format}.`)
    }
}

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
        ['startIndex']: {
            alias: 's',
            desc: 'start index (numeric) for the collection',
            type: 'number',
            default: 1,
        },
        ['endIndex']: {
            alias: 'e',
            desc: 'end index (numeric) for the collection',
            type: 'number',
            default: 20000,
        },
    },
    async (args) => {
        timeAndExecute(async () => {
            const assets = await getErc721Assets({
                address: args.address,
                startIndex: +args.startIndex, 
                endIndex: +args.endIndex
            });
            const output = {
                name: args.name,
                assets
            };
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
        ['startIndex']: {
            alias: 's',
            desc: 'start index (numeric) for the collection',
            type: 'number',
            default: 1,
        },
        ['endIndex']: {
            alias: 'e',
            desc: 'end index (numeric) for the collection',
            type: 'number',
            default: 20000,
        },
    },
    async (args) => {
        timeAndExecute(async () => {
            const assets = await getErc1155Assets({
                address: args.address,
                startIndex: +args.startIndex, 
                endIndex: +args.endIndex
            });
            const output = {
                name: args.name,
                assets
            };
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
            const assets = (await getOpenseaAssets({ name: args.slug }))
            .map(asset => ({
                id: asset.id,
                owner: asset.owner
            }));
            const output = {
                name: args.slug,
                assets
            };
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
            const config = JSON.parse(fs.readFileSync(args.config, { encoding: 'utf-8' }));
            config.combine = config.combine ?? true;
            const allAssets = {};
            for (const collectionOptions of config.collections) {
                if (config.exclude && config.exclude.includes(collectionOptions.name)) {
                    console.log(`skipping ${collectionOptions.name}...`);
                    continue;
                }
                if (!collectionOptions.name) {
                    console.log('cannot automate a collection with no name.');
                    continue;
                }
                if (!collectionOptions.type) {
                    console.log('cannot automate a collection with no type.');
                    continue;
                }
                let assets = [];
                switch(collectionOptions.type) {
                    case 'opensea':
                        console.log(`automating ${collectionOptions.name}, a(n) ${collectionOptions.type} collection...`);
                        assets = (await getOpenseaAssets(collectionOptions))
                        .map(asset => ({
                            id: asset.id,
                            owner: asset.owner
                        }));
                        break;
                    case 'erc721':
                        console.log(`automating ${collectionOptions.name}, an ${collectionOptions.type} collection...`)
                        assets = await getErc721Assets(collectionOptions);
                        break;
                    case 'erc1155':
                        console.log(`automating ${collectionOptions.name}, an ${collectionOptions.type} collection...`)
                        assets = await getErc1155Assets(collectionOptions);
                        break;
                    default:
                        throw new Error(`Unexpected collection type ${collectionOptions.type}`);
                }
                if (config.combine) {
                    allAssets[collectionOptions.name] = assets;
                } else {
                    const output = {
                        name: collectionOptions.name,
                        assets,
                    };
                    await writeAssets(output, args.format);
                }
            }
            if (config.combine) {
                const output = {
                    name: moment().format(),
                    assets: allAssets
                };
                writeAssets(output, 'json');
            }
        });
    }
)
.help()
.argv;
