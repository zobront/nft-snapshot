import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import { setTimeoutAsync } from '../utils.js';

const MORALIS_TOKEN=process.env.MORALIS_TOKEN;


// options
// {
//     name: string,
//     address: string,
//     include: number[]?
//     startId: number?,
//     endId: number?,
// }
export async function getErc1155Assets(options) {
    const assets = [];

    if (options.include) {
        for (const tokenId of options.include) {
            await setTimeoutAsync(300);
            try {
                const owners = await getErc1155Owners(options.address, tokenId);
                assets.push(...owners);
            } catch (err) {
                console.log(`auto-detected end of collection at index ${tokenId-1}.`);
                break;
            }
        }
    } else {
        for (let tokenId = (options.startId ?? 1); tokenId <= (options.endId ?? 20000); tokenId++) {
            await setTimeoutAsync(300);
            try {
                const owners = await getErc1155Owners(options.address, tokenId);
                assets.push(...owners);
            } catch (err) {
                console.log(`auto-detected end of collection at index ${tokenId-1}.`);
                break;
            }
        }
    }

    return {
        name: options.name,
        assets
    };
}

async function getErc1155Owners(address, tokenId) {
    console.log(`Getting data for ${tokenId}...`);
    const url = `https://deep-index.moralis.io/api/v2/nft/${address}/${tokenId}/owners?chain=eth&format=decimal`;
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
        id: tokenId,
        owner: token.owner_of   
    }));
}

