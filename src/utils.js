import fs from 'fs';

export function setTimeoutAsync(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms));
}
    
export function writeTextAsync(path, string) {
    return new Promise(resolve => fs.writeFile(path, string, { encoding: 'utf-8' }, () => resolve()));
}

export async function timeAndExecute(callback) {
    const timeBefore = new Date().getTime();
    await callback();   
    const timeAfter = new Date().getTime();
    const timeTaken = (timeAfter - timeBefore) / 1000;
    console.log(`Script Completed. Total Run Time: ${timeTaken} Seconds`)
}
