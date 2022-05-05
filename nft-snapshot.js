#!/usr/bin/env node
import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ethers from 'ethers';
import csvWriter from 'csv-writer';
const createCsvWriter = csvWriter.createObjectCsvWriter;

const PROVIDER_ENDPOINT = process.env.PROVIDER_ENDPOINT; // SEE README
const CHAIN_ID = +process.env.CHAIN_ID;
const OPENSEA_TOKEN = process.env.OPENSEA_TOKEN;
let openseaQueried = false;

function waitMs(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}

function getContract(address) {
    const provider = new ethers.providers.JsonRpcProvider(PROVIDER_ENDPOINT, CHAIN_ID);
    const abi = ["function ownerOf (uint256) view returns (address)"];
    return new ethers.Contract(address, abi, provider);
}

async function getErcAssets(contract, startId, endId) {
    const assets = [];

    for (let id = startId; id <= endId; id++) {
        try {
            if (id % 100 == 0) console.log(`Checkpoint: ${id}`)
            assets.push( {
                id,
                owner: await contract.ownerOf(id)
            });
        } catch (err) {
            console.log(`Token ${id} Error:`, err);
            assets.push( {
                id,
                owner: 'ERROR'
            });
        }
    }

    return assets; 
}

async function getOpenseaAsset(address, tokenId) {
    if (openseaQueried) {
        await waitMs(300);
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

async function getOpenseaAssets(slug, array = undefined, next = undefined) {
    if (openseaQueried) {
        await waitMs(300);
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
    for (const asset of assetsBody.assets) {
        console.log(`Getting data for ${asset.id}...`);
        const address = asset.asset_contract.address;
        const tokenId = asset.token_id;
        const hackAsset = await getOpenseaAsset(address, tokenId);
        if (hackAsset.top_ownerships.length !== 1) {
            console.log(`Unexpected: Contract ${address} id ${tokenId} has ${hackAsset.top_ownerships.length} owners.`);
            continue;
        }
        array.push({
            id: hackAsset.id,
            owner: hackAsset.top_ownerships[0].owner.address,
        });
    }
    // array.push(...assetsBody.assets.map(asset => ({
    //     id: asset.id,
    //     owner: asset.owner.address,
    // })));
    
    if (assetsBody.next) {
        return getOpenseaAssets(slug, array, assetsBody.next);
    } else {
        return array;
    }
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

async function writeAssets(name, assets, format) {
    timeAndExecute(async () => {
        switch (format) {
            case "tokensByOwner":
                await writeTokensByOwner(name ?? 'tokensByOwner', assets);
                break;
            case "ownerByTokenId":
                await writeOwnerByTokenId(name  ?? 'ownerByTokenId', assets);
                break;
            default:
                console.log("Invalid format. Please use 'tokensByOwner' or 'ownerByToken'.")
        }
    });
}

yargs(hideBin(process.argv))
.option({
    ['format']: {
        alias: 'f',
        desc: 'format for the results (tokensByOwner or idsByOwner)',
        type: 'string',
        default: 'tokensByOwner'
    }
})
.command(
    'erc', 
    'snapshot a vanilla ERC 721 or ERC 1155 contract', 
    {
        ['name']: {
            alias: 'n',
            desc: 'the name of this collection',
            type: 'string',
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
            required: true,
        },
        ['endIndex']: {
            alias: 'e',
            desc: 'end index (numeric) for the collection',
            type: 'number',
            required: true,
        },
    },
    async (args) => {
        const contract = getContract(args.address);
        const assets = await getErcAssets(contract, +args.startIndex, +args.endIndex);
        await writeAssets(name, assets, args.format);
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
        const assets = (await getOpenseaAssets(args.slug))
        .map(asset => ({
            id: asset.id,
            owner: asset.owner
        }));
        writeAssets(args.slug, assets, args.format);
    }
)
.argv;
