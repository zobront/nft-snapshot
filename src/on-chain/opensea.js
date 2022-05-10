import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';
import { setTimeoutAsync } from '../utils.js';

const OPENSEA_TOKEN = process.env.OPENSEA_TOKEN;
let openseaQueried = false;

// {
//     name: string, // opensea-slug
//     include: number[]?
// }
export async function getOpenseaAssets(options) {
    const assets = [];
    const osAssets = await getOpenseaAssetsInCollection(options.name);
        
    if (options.include) {
        for (const tokenId of options.include) {
            try {
                const asset = osAssets.find(a => a.token_id === tokenId);
                if (asset) {
                    assets.push(await getOpenseaOwner(asset));
                } else {
                    throw new Error(`Could not find an asset for token ID ${tokenId}`);
                }
            } catch (err) {
                console.error(err);
                continue;
            }
        }
    } else {
        for (const asset of osAssets) {
            try {
                assets.push(await getOpenseaOwner(asset));
            } catch (err) {
                console.error(err);
            }
        }
    }

    return {
        name: options.name,
        assets: assets
    }
}

async function getOpenseaAsset(address, tokenId) {
    await setTimeoutAsync(300);
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
    await setTimeoutAsync(300);

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
