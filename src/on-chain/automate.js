import { 
    getErc721Assets,
    getErc1155Assets,
    getOpenseaAssets,
} from './index.js';

// options
// {
//     combine: boolean?,
//     exclude: string[]?,
//     collections: {
//         name: string,
//         type: string,
//         ...options //see options for the desired data source
//     }
// }
// returns an object containing keys of collection name, and values of assets
export async function automate(options) {
    options.combine = options.combine ?? true;
    const allCollections = {};
    for (const collectionOptions of options.collections) {
        if (options.exclude && options.exclude.includes(collectionOptions.name)) {
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
        let collection = {};
        switch(collectionOptions.type) {
            case 'opensea':
                console.log(`automating ${collectionOptions.name}, a(n) ${collectionOptions.type} collection...`);
                collection = await getOpenseaAssets(collectionOptions);
                break;
            case 'erc721':
                console.log(`automating ${collectionOptions.name}, an ${collectionOptions.type} collection...`)
                collection = await getErc721Assets(collectionOptions);
                break;
            case 'erc1155':
                console.log(`automating ${collectionOptions.name}, an ${collectionOptions.type} collection...`)
                collection = await getErc1155Assets(collectionOptions);
                break;
            default:
                throw new Error(`Unexpected collection type ${collectionOptions.type}`);
        }
        console.log(`${collection.name} has ${collection.assets.length} assets.`);
        allCollections[collection.name] = collection.assets;
    }
    return allCollections;
}
