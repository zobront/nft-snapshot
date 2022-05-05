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

async function ownerByTokenId(contract, startId, endId) {
    const ownerByTokenIdWriter = createCsvWriter({
        path: 'ownerByTokenId.csv',
        header: [
          {id: 'id', title: 'ID'},
          {id: 'address', title: 'Address'},
        ]
    });

    for (let i = startId; i <= endId; i++) {
        try {
            if (i % 100 == 0) console.log(`Checkpoint: ${i}`)
            const owner = await contract.ownerOf(i);            
            dbData = [{ id: i, address: owner }];
            await ownerByTokenIdWriter.writeRecords(dbData)
        } catch (err) {
            console.log(`Token ${i} Error:`)
            console.log(err)
            dbData = [{ id: i, address: 'ERROR' }];
            await ownerByTokenIdWriter.writeRecords(dbData)
        }
    }
}

async function tokensByOwner(contract, startId, endId) {
    const tokensByOwnerWriter = createCsvWriter({
        path: 'tokensByOwner.csv',
        header: [
            {id: 'address', title: 'Address'},
            {id: 'count', title: 'Count'},
            {id: 'ids', title: 'IDs'},
        ]
    });

    console.log(contract);

    const idsByOwner = {}
    for (let i = startId; i <= endId; i++) {
        try {
            if (i % 100 == 0) console.log(`Checkpoint: ${i}`)
            const owner = await contract.ownerOf(i);
            owner in idsByOwner ? idsByOwner[owner].push(i) : idsByOwner[owner] = [i]
        } catch (err) {
            'Errors' in idsByOwner ? idsByOwner['Errors'].push(i) : idsByOwner['Errors'] = [i]
            console.log(`Token ${i} Error:`)
            console.log(err)
        }
    }
    const outputData = Object.keys(idsByOwner).map(address => ({ address, count: idsByOwner[address].length, ids: idsByOwner[address] }))
    await tokensByOwnerWriter.writeRecords(outputData)
}

function getContract(address) {
    const provider = new ethers.providers.JsonRpcProvider(PROVIDER_ENDPOINT, CHAIN_ID);
    const abi = ["function ownerOf (uint256) view returns (address)"];
    return new ethers.Contract(address, abi, provider);
}

async function main(format, contract, startId, endId) {
    const timeBefore = new Date().getTime();
    
    if (format == "tokensByOwner") {
        await tokensByOwner(contract, startId, endId)
    } else if (format == "ownerByTokenId") {
        await ownerByTokenId(contract, startId, endId)
    } else {
        console.log("Invalid format. Please use 'tokensByOwner' or 'ownerByToken'.")
    }
    
    const timeAfter = new Date().getTime();
    const timeTaken = (timeAfter - timeBefore) / 1000;
    console.log(`Script Completed. Total Run Time: ${timeTaken} Seconds`)
}

async function getOpenseaAssets(slug, array = undefined, next = undefined) {
    if (openseaQueried) {
        await new Promise(resolve => setTimeout(() => resolve(), 300));
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
    array.push(...assetsBody.assets);
    
    if (assetsBody.next) {
        return getOpenseaAssets(slug, array, assetsBody.next);
    } else {
        return array;
    }
}

yargs(hideBin(process.argv))
.option({
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
        ['address']: {
            alias: 'a',
            desc: 'the contract address for the collection',
            type: 'string',
            required: true,
        }
    },
    (args) => {
        const contract = getContract(args.address);
        main(args.format, contract, +args.startIndex, +args.endIndex);
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
        const assets = await getOpenseaAssets(args.slug);
        console.log(assets);
    }
)
.argv;
