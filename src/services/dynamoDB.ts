import Dapp from '@eximchain/dappbot-types/spec/dapp';
import { PutItemInputAttributeMap, AttributeMap } from "aws-sdk/clients/dynamodb";
import { addAwsPromiseRetries } from '../common';
import { AWS, dappTableName, lapsedUsersTableName, paymentLapsedGracePeriodHrs } from '../env';
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

interface DappUpdateTime {
    DappName: string
    UpdatedAt: Date
}

function serializeDdbKey(dappName:string) {
    let keyItem = {
        'DappName': {S: dappName}
    };
    return keyItem;
}

async function promiseSetDappAvailable(dappName:string) {
    let dbResponse = await promiseGetDappItem(dappName);
    let dbItem = dbResponse.Item as AttributeMap;
    dbItem.State.S = Dapp.States.AVAILABLE;

    return promisePutRawDappItem(dbItem);
}

async function promiseSetDappFailed(dappName:string) {
    let dbResponse = await promiseGetDappItem(dappName);
    let dbItem = dbResponse.Item as AttributeMap;
    dbItem.State.S = Dapp.States.FAILED;

    return promisePutRawDappItem(dbItem);
}

function promiseSetItemBuilding(dbItem:PutItemInputAttributeMap, cloudfrontDistroId?:string, cloudfrontDns?:string) {
    if (cloudfrontDistroId) {
        dbItem.CloudfrontDistributionId = {S: cloudfrontDistroId};
    }
    if (cloudfrontDns) {
        dbItem.CloudfrontDnsName = {S: cloudfrontDns};
    }

    dbItem.State.S = Dapp.States.BUILDING_DAPP;

    return promisePutRawDappItem(dbItem);
}

// TODO: Combine with SetDapp method
function promiseSetItemAvailable(dbItem:PutItemInputAttributeMap) {
    dbItem.State.S = Dapp.States.AVAILABLE;

    return promisePutRawDappItem(dbItem);
}

function promisePutRawDappItem(item:PutItemInputAttributeMap) {
    let maxRetries = 5;
    let putItemParams = {
        TableName: dappTableName,
        Item: item
    };

    return addAwsPromiseRetries(() => ddb.putItem(putItemParams).promise(), maxRetries);
}

function promiseGetDappItem(dappName:string) {
    let maxRetries = 5;
    let getItemParams = {
        TableName: dappTableName,
        Key: serializeDdbKey(dappName)
    };

    return addAwsPromiseRetries(() => ddb.getItem(getItemParams).promise(), maxRetries);
}

function promiseDeleteDappItem(dappName:string) {
    let maxRetries = 5;
    let deleteItemParams = {
        TableName: dappTableName,
        Key: serializeDdbKey(dappName)
    };

    return addAwsPromiseRetries(() => ddb.deleteItem(deleteItemParams).promise(), maxRetries);
}

function promiseGetItemsByOwner(ownerEmail:string) {
    let maxRetries = 5;
    let getItemParams = {
        TableName: dappTableName,
        IndexName: 'OwnerEmailIndex',
        ExpressionAttributeNames: {
            "#OE": "OwnerEmail"
        }, 
        ExpressionAttributeValues: {
            ":e": {
                S: ownerEmail
            }
        }, 
        KeyConditionExpression: "#OE = :e", 
        Select: 'ALL_PROJECTED_ATTRIBUTES'
    };

    return addAwsPromiseRetries(() => ddb.query(getItemParams).promise(), maxRetries);
}

async function getDappNamesByOwner(owner:string):Promise<string[]> {
    let dappList:string[] = [];
    let itemsByOwnerResponse = await promiseGetItemsByOwner(owner);
    let itemsByOwner = itemsByOwnerResponse.Items;
    if (!itemsByOwner) {
        return dappList;
    }
    for (let i in itemsByOwner) {
        let item = itemsByOwner[i];
        let dappName = item.DappName.S as string;
        dappList.push(dappName);
    }
    return dappList;
}

async function getDappUpdateTimesByOwner(owner:string):Promise<DappUpdateTime[]> {
    let dappList:DappUpdateTime[] = [];
    let itemsByOwnerResponse = await promiseGetItemsByOwner(owner);
    let itemsByOwner = itemsByOwnerResponse.Items;
    if (!itemsByOwner) {
        return dappList;
    }
    for (let i in itemsByOwner) {
        let item = itemsByOwner[i];
        let dappName = item.DappName.S as string;
        let updatedAt = new Date(item.UpdatedAt.S as string);
        dappList.push({DappName: dappName, UpdatedAt: updatedAt});
    }
    return dappList;
}

function serializeLapsedUserItem(userEmail:string) {
    let now = new Date().toISOString();
    // Required Params
    let item:PutItemInputAttributeMap = {
        'UserEmail' : {S: userEmail},
        'LapsedAt' : {S: now}
    };
    return item;
}

function serializeLapsedUserKey(userEmail:string) {
    let key:PutItemInputAttributeMap = {
        'UserEmail' : {S: userEmail}
    };
    return key;
}

function promisePutLapsedUser(lapsedUser:string) {
    let maxRetries = 5;
    let putItemParams = {
        TableName: lapsedUsersTableName,
        Item: serializeLapsedUserItem(lapsedUser)
    };

    return addAwsPromiseRetries(() => ddb.putItem(putItemParams).promise(), maxRetries);
}

function promiseDeleteLapsedUser(lapsedUser:string) {
    let maxRetries = 5;
    let deleteItemParams = {
        TableName: lapsedUsersTableName,
        Key: serializeLapsedUserKey(lapsedUser)
    };

    return addAwsPromiseRetries(() => ddb.deleteItem(deleteItemParams).promise(), maxRetries);
}

function promiseScanLapsedUsers() {
    let maxRetries = 5;
    let scanParams = {
        TableName: lapsedUsersTableName
    };

    return addAwsPromiseRetries(() => ddb.scan(scanParams).promise(), maxRetries);
}

async function getPotentialFailedUsers():Promise<string[]> {
    let response = await promiseScanLapsedUsers();

    let potentialLapsedUsers:string[] = [];
    let items = response.Items;
    if (!items) {
        return [];
    }

    for (let i in items) {
        let item = items[i];

        let userEmail:string = item.UserEmail.S as string;
        let lapsedAtIsoString:string = item.LapsedAt.S as string;

        let lapsedAt = Date.parse(lapsedAtIsoString);
        let now = Date.now();
        let msSinceLapse = now - lapsedAt;
        let hrsSinceLapse = msToHrs(msSinceLapse);

        if (hrsSinceLapse > paymentLapsedGracePeriodHrs) {
            potentialLapsedUsers.push(userEmail);
        }
    }
    return potentialLapsedUsers;
}

function msToHrs(millis:number) {
    // 1000 ms / s
    // 60 s / min
    // 60 min / hr
    return millis / (60*60*1000);
}

export default {
    getItem : promiseGetDappItem,
    deleteItem : promiseDeleteDappItem,
    getByOwner : promiseGetItemsByOwner,
    setDappAvailable : promiseSetDappAvailable,
    setDappFailed : promiseSetDappFailed,
    setItemBuilding : promiseSetItemBuilding,
    setItemAvailable : promiseSetItemAvailable,
    putLapsedUser : promisePutLapsedUser,
    deleteLapsedUser : promiseDeleteLapsedUser,
    getPotentialFailedUsers : getPotentialFailedUsers,
    getDappNamesByOwner : getDappNamesByOwner,
    getDappUpdateTimesByOwner : getDappUpdateTimesByOwner
}