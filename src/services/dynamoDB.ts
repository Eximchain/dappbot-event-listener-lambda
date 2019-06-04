import { PutItemInputAttributeMap, AttributeMap } from "aws-sdk/clients/dynamodb";
import { addAwsPromiseRetries, DappStates } from '../common';
import { AWS, tableName } from '../env';
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
        TableName: tableName,
        Item: item
    };

    return addAwsPromiseRetries(() => ddb.putItem(putItemParams).promise(), maxRetries);
}

function promiseGetDappItem(dappName:string) {
    let maxRetries = 5;
    let getItemParams = {
        TableName: tableName,
        Key: serializeDdbKey(dappName)
    };

    return addAwsPromiseRetries(() => ddb.getItem(getItemParams).promise(), maxRetries);
}

function promiseDeleteDappItem(dappName:string) {
    let maxRetries = 5;
    let deleteItemParams = {
        TableName: tableName,
        Key: serializeDdbKey(dappName)
    };

    return addAwsPromiseRetries(() => ddb.deleteItem(deleteItemParams).promise(), maxRetries);
}

function promiseGetItemsByOwner(ownerEmail:string) {
    let maxRetries = 5;
    let getItemParams = {
        TableName: tableName,
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

export default {
    getItem : promiseGetDappItem,
    deleteItem : promiseDeleteDappItem,
    getByOwner : promiseGetItemsByOwner,
    setDappAvailable : promiseSetDappAvailable,
    setDappFailed : promiseSetDappFailed,
    setItemBuilding : promiseSetItemBuilding,
    setItemAvailable : promiseSetItemAvailable
}