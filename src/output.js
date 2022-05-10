import csvWriter from 'csv-writer';
const createCsvWriter = csvWriter.createObjectCsvWriter;
import { writeTextAsync } from './utils.js';

export async function writeAssets(output, format) {
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

async function writeOwnerByTokenId(name, assets) {
    const ownerByTokenIdWriter = createCsvWriter({
        path: `out/${name}.csv`,
        header: [
            {id: 'id', title: 'Token ID'},
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
            {id: 'ids', title: 'Token IDs'},
        ]
    });

    const idsByOwner = {}

    for (const asset of assets) {
        asset.owner in idsByOwner ? idsByOwner[asset.owner].push(asset.id) : idsByOwner[asset.owner] = [ asset.id ];
    }

    const outputData = Object.keys(idsByOwner).map(address => ({ address, count: idsByOwner[address].length, ids: idsByOwner[address] }))
    await tokensByOwnerWriter.writeRecords(outputData)
}
