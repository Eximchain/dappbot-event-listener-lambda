import { AWS, cognitoUserPoolId } from '../env';
import { PaymentStatus } from '@eximchain/dappbot-types/spec/user';
import { freeTierStripePlan } from '@eximchain/dappbot-types/spec/methods/payment';
import { addAwsPromiseRetries } from '../common';
import { AttributeType } from 'aws-sdk/clients/cognitoidentityserviceprovider';
const cognito = new AWS.CognitoIdentityServiceProvider({apiVersion: '2016-04-18'});

const paymentStatusAttrName = 'custom:payment_status';
const dappLimitAttrNames = [
    'custom:standard_limit',
    'custom:professional_limit',
    'custom:enterprise_limit'
];

function promiseAdminGetUser(cognitoUsername:string) {
    let maxRetries = 5;
    let params = {
        UserPoolId: cognitoUserPoolId,
        Username: cognitoUsername
    };
    return addAwsPromiseRetries(() => cognito.adminGetUser(params).promise(), maxRetries);
}

function promiseAdminUpdateUserAttributes(cognitoUsername:string, userAttributes: AttributeType[]) {
    let maxRetries = 5;
    let params = {
        UserPoolId: cognitoUserPoolId,
        Username: cognitoUsername,
        UserAttributes: userAttributes
    };
    return addAwsPromiseRetries(() => cognito.adminUpdateUserAttributes(params).promise(), maxRetries);
}

async function markUserActive(cognitoUsername:string) {
    return await setPaymentStatus(cognitoUsername, PaymentStatus.ACTIVE);
}

async function markUserActiveFreeTier(cognitoUsername:string) {
    return await limitsToFreeTierAndSetPaymentStatus(cognitoUsername, PaymentStatus.ACTIVE);
}

async function markUserFailed(cognitoUsername:string) {
    return await zeroLimitsAndSetPaymentStatus(cognitoUsername, PaymentStatus.FAILED);
}

async function markUserCancelled(cognitoUsername:string) {
    return await zeroLimitsAndSetPaymentStatus(cognitoUsername, PaymentStatus.CANCELLED);
}

async function markUserLapsed(cognitoUsername:string) {
    return await setPaymentStatus(cognitoUsername, PaymentStatus.LAPSED);
}

async function setPaymentStatus(cognitoUsername:string, paymentStatus:PaymentStatus) {
    let userAttributes:AttributeType[] = [{
        Name : paymentStatusAttrName,
        Value : paymentStatus
    }]
    return await promiseAdminUpdateUserAttributes(cognitoUsername, userAttributes);
}

async function zeroLimitsAndSetPaymentStatus(cognitoUsername:string, paymentStatus:PaymentStatus) {
    let userAttributes:AttributeType[] = [];
    dappLimitAttrNames.forEach(attrName => userAttributes.push({Name: attrName, Value: '0'}));

    let updatedPaymentStatusAttr:AttributeType = {
        Name: paymentStatusAttrName,
        Value: paymentStatus
    }
    userAttributes.push(updatedPaymentStatusAttr);
    console.log(`Marking user '${cognitoUsername}' ${paymentStatus} in cognito and setting limits to 0`);
    return await promiseAdminUpdateUserAttributes(cognitoUsername, userAttributes);
}

function freeTierLimitFromCognitoAttrName(attrName:string) {
    switch (attrName) {
        case 'custom:standard_limit':
            return freeTierStripePlan().standard.toString();
        case 'custom:professional_limit':
            return freeTierStripePlan().professional.toString();
        case 'custom:enterprise_limit':
            return freeTierStripePlan().enterprise.toString();
        default:
            return '0';
    }
}

async function limitsToFreeTierAndSetPaymentStatus(cognitoUsername:string, paymentStatus:PaymentStatus) {
    let userAttributes:AttributeType[] = [];
    dappLimitAttrNames.forEach(attrName => userAttributes.push({Name: attrName, Value: freeTierLimitFromCognitoAttrName(attrName)}));

    let updatedPaymentStatusAttr:AttributeType = {
        Name: paymentStatusAttrName,
        Value: paymentStatus
    }
    userAttributes.push(updatedPaymentStatusAttr);
    console.log(`Marking user '${cognitoUsername}' ${paymentStatus} in cognito and setting limits to free tier`);
    return await promiseAdminUpdateUserAttributes(cognitoUsername, userAttributes);
}

async function confirmFailedUsers(potentialFailedUsers:string[]):Promise<UserSplit> {
    let splitUsers = await splitPotentialFailedUsers(potentialFailedUsers);
    let failedUsers = splitUsers.Failed;
    await markUsersFreeTier(failedUsers);
    return splitUsers;
}

async function splitPotentialFailedUsers(potentialFailedUsers:string[]):Promise<UserSplit> {
    let activeUsers:string[] = [];
    let failedUsers:string[] = [];
    for (let i in potentialFailedUsers) {
        let potentialFailedUser = potentialFailedUsers[i];

        let response = await promiseAdminGetUser(potentialFailedUser);
        let userAttrs:AttributeType[];
        if (response.UserAttributes) {
            userAttrs = response.UserAttributes;
        } else {
            userAttrs = [];
        }
        let filteredAttrs = userAttrs.filter((item) => item.Name === paymentStatusAttrName);

        if (filteredAttrs.length === 0) {
            console.log(`No payment_status attribute found for user ${potentialFailedUser}`);
            continue;
        } else if (filteredAttrs.length > 1) {
            console.log(`Multiple payment_status attributes found for user ${potentialFailedUser}`, filteredAttrs);
            continue;
        }

        let paymentStatus = filteredAttrs[0].Value;
        switch (paymentStatus) {
            case PaymentStatus.LAPSED:
            case PaymentStatus.FAILED:
            case PaymentStatus.CANCELLED:
                failedUsers.push(potentialFailedUser);
                break;
            case PaymentStatus.ACTIVE:
                activeUsers.push(potentialFailedUser);
                break;
            default:
                console.log(`Unrecognized Payment Status: ${paymentStatus}`);
                break;
        }
    }
    return {Failed: failedUsers, Active: activeUsers};
}

async function markFailedUsers(failedUsers:string[]) {
    // Set limits to free tier and mark active instead
    for (let i in failedUsers) {
        let user = failedUsers[i];
        await markUserFailed(user)
    }
}

async function markUsersFreeTier(users:string[]) {
    // Set limits to free tier and mark active instead
    for (let i in users) {
        let user = users[i];
        await markUserActiveFreeTier(user)
    }
}

interface UserSplit {
    Failed: string[],
    Active: string[]
}

export default {
    confirmFailedUsers, markUserCancelled, markUserLapsed, markUserActive
}