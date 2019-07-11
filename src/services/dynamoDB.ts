import { PutItemInputAttributeMap, AttributeMap } from "aws-sdk/clients/dynamodb";
import { addAwsPromiseRetries, DappStates } from '../common';
import { AWS, dappTableName, lapsedUsersTableName } from '../env';
const ddb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

function serializeDdbKey(dappName:string) {
    let keyItem = {
        'DappName': {S: dappName}
    };
    return keyItem;
}

async function promiseSetDappAvailable(dappName:string) {
    let dbResponse = await promiseGetDappItem(dappName);
    let dbItem = dbResponse.Item as AttributeMap;
    dbItem.State.S = DappStates.AVAILABLE;

    return promisePutRawDappItem(dbItem);
}

async function promiseSetDappFailed(dappName:string) {
    let dbResponse = await promiseGetDappItem(dappName);
    let dbItem = dbResponse.Item as AttributeMap;
    dbItem.State.S = DappStates.FAILED;

    return promisePutRawDappItem(dbItem);
}

function promiseSetItemBuilding(dbItem:PutItemInputAttributeMap, cloudfrontDistroId?:string, cloudfrontDns?:string) {
    if (cloudfrontDistroId) {
        dbItem.CloudfrontDistributionId = {S: cloudfrontDistroId};
    }
    if (cloudfrontDns) {
        dbItem.CloudfrontDnsName = {S: cloudfrontDns};
    }

    dbItem.State.S = DappStates.BUILDING_DAPP;

    return promisePutRawDappItem(dbItem);
}

// TODO: Combine with SetDapp method
function promiseSetItemAvailable(dbItem:PutItemInputAttributeMap) {
    dbItem.State.S = DappStates.AVAILABLE;

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

export default {
    getItem : promiseGetDappItem,
    deleteItem : promiseDeleteDappItem,
    getByOwner : promiseGetItemsByOwner,
    setDappAvailable : promiseSetDappAvailable,
    setDappFailed : promiseSetDappFailed,
    setItemBuilding : promiseSetItemBuilding,
    setItemAvailable : promiseSetItemAvailable,
    putLapsedUser : promisePutLapsedUser,
    deleteLapsedUser : promiseDeleteLapsedUser
}