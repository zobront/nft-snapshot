const ethers = require("ethers")
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const TOKEN_ADDRESS; // INSERT
const HIGHEST_TOKEN_ID; // INSERT
const PROVIDER_ENDPOINT; // INSERT
const CHAIN_ID = 1;
const FORMAT = "tokensByOwner"; // options: "tokensByOwner" or "ownerByTokenId"

const provider = new ethers.providers.JsonRpcProvider(PROVIDER_ENDPOINT, CHAIN_ID);
const abi = ["function ownerOf (uint256) view returns (address)"];
const contract = new ethers.Contract(TOKEN_ADDRESS, abi, provider);

async function ownerByTokenId() {
    const ownerByTokenIdWriter = createCsvWriter({
        path: 'ownerByTokenId.csv',
        header: [
          {id: 'id', title: 'ID'},
          {id: 'address', title: 'Address'},
        ]
    });

    for (let i = 0; i <= HIGHEST_TOKEN_ID; i++) {
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

async function tokensByOwner() {
    const tokensByOwnerWriter = createCsvWriter({
        path: 'tokensByOwner.csv',
        header: [
            {id: 'address', title: 'Address'},
            {id: 'count', title: 'Count'},
            {id: 'ids', title: 'IDs'},
        ]
    });

    const idsByOwner = {}
    for (let i = 1; i <= HIGHEST_TOKEN_ID; i++) {
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

async function main(format = "tokensByOwner") {
    const timeBefore = new Date().getTime();
    if (format == "tokensByOwner") {
        await tokensByOwner()
    } else if (format == "ownerByTokenId") {
        await ownerByTokenId()
    } else {
        console.log("Invalid format. Please use 'tokensByOwner' or 'ownerByToken'.")
    }
    
    const timeAfter = new Date().getTime();
    const timeTaken = (timeAfter - timeBefore) / 1000;
    console.log(`Script Completed. Total Run Time: ${timeTaken} Seconds`)
}

main(FORMAT)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });