import { PaymentStatus } from './common';
import { CodePipelineJob } from './lambda-event-types';
import { dnsRoot } from './env';
import services from './services';
import cognito from './services/cognito';
const { cloudfront, dynamoDB, s3, sqs, codepipeline, sendgrid, github } = services;

const deleteMethodName = 'delete';

// View a sample JSON event from a CodePipeline here:
//
// https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html#actions-invoke-lambda-function-json-event-example
//
// Below function is called by index, it receives the event["CodePipeline.job"] field.

async function postPipelineBuildJob({ data, id }:CodePipelineJob) {
  const { actionConfiguration } = data;
  // TODO: Get Dapp DNS from here
  const { OwnerEmail, DestinationBucket, DappName } = JSON.parse(actionConfiguration.configuration.UserParameters);

  console.log("Successfully loaded all info to the clean function:");
  console.log(`OwnerEmail: ${OwnerEmail}; DappName: ${DappName}; DestinationBucket: ${DestinationBucket}`);

  try {
    await s3.makeObjectNoCache(DestinationBucket, 'index.html');
    await dynamoDB.setDappAvailable(DappName);
    await sendgrid.sendConfirmation(OwnerEmail, DappName, dnsNameFromDappName(DappName));
    console.log("Successfully completed all CodePipeline cleanup steps!");
    return await codepipeline.completeJob(id);
  } catch (err) {
    console.log("Error cleaning up the CodePipeline execution: ", err);
    await codepipeline.failJob(id, err);
    return await dynamoDB.setDappFailed(DappName);
  }
}

async function periodicCleanup() {
  console.log('Performing Periodic Cleanup');

  console.log('Cleaning up CloudFront Distributions');
  await cloudfront.cleanupDisabledDistros();
  console.log('Cloudfront Distribution Cleanup successful')
  
  console.log('Cleaning Up Lapsed Users');
  let potentialFailedUsers = await dynamoDB.getPotentialFailedUsers();
  console.log("Checking Potential Failed Users: ", potentialFailedUsers);
  let splitUsers = await cognito.confirmFailedUsers(potentialFailedUsers);
  console.log("Users Split by Cognito Status: ", splitUsers);
  let failedUsers = splitUsers.Failed;
  let activeUsers = splitUsers.Active;

  for (let i in activeUsers) {
    let activeUser = activeUsers[i];

    console.log('Removing non-failed user from LAPSED list: ', activeUser);
    await dynamoDB.deleteLapsedUser(activeUser);
  }

  for (let i in failedUsers) {
    let failedUser = failedUsers[i];
    await cleanDappsForUser(failedUser);
    await dynamoDB.deleteLapsedUser(failedUser);
    console.log('Successfully Cleaned Dapps for failed user: ', failedUser);
  }

  console.log('Periodic Cleanup Successful');
  return {};
}

async function enterpriseGithubCommitJob({ data, id }:CodePipelineJob) {
  console.log("Enterprise Commit Job: ", data);
  let inputArtifact = data.inputArtifacts[0];
  let artifactLocation = inputArtifact.location.s3Location;
  let artifactCredentials = data.artifactCredentials;
  const { actionConfiguration } = data;
  const { OwnerEmail, DappName, TargetRepoName, TargetRepoOwner } = JSON.parse(actionConfiguration.configuration.UserParameters);

  try {
    let artifact = await s3.downloadArtifact(artifactLocation, artifactCredentials);
    await github.commitArtifact(artifact, TargetRepoName, TargetRepoOwner);
    return await codepipeline.completeJob(id);
  } catch(err) {
    console.log("Error committing to GitHub: ", err);
    await codepipeline.failJob(id, err);
    return await dynamoDB.setDappFailed(DappName);
  }
}

async function handlePaymentStatus(userEmail:string, status:PaymentStatus) {
  console.log(`Handling ${status} payment status for user ${userEmail}`);
  switch (status) {
    case PaymentStatus.LAPSED:
      return await handleLapsedUser(userEmail);
    case PaymentStatus.ACTIVE:
      return await handleActiveUser(userEmail);
    case PaymentStatus.CANCELLED:
      return await handleCancelledUser(userEmail);
    default:
      console.log(`No Handler for payment status ${status}`);
  }
}

async function handleCancelledUser(userEmail:string) {
  const dynamoPromise = cleanDappsForUser(userEmail);
  const cognitoPromise = cognito.markUserCancelled(userEmail);
  return await Promise.all([dynamoPromise, cognitoPromise]);
}

async function handleLapsedUser(userEmail:string) {
  const dynamoPromise = dynamoDB.putLapsedUser(userEmail);
  const cognitoPromise = cognito.markUserLapsed(userEmail);
  return await Promise.all([dynamoPromise, cognitoPromise])
}

async function handleActiveUser(userEmail:string) {
  const dynamoPromise = dynamoDB.deleteLapsedUser(userEmail);
  const cognitoPromise = cognito.markUserActive(userEmail);
  return await Promise.all([dynamoPromise, cognitoPromise]);
}

async function cleanDappsForUser(userEmail:string) {
  console.log('Cleaning Dapps for user: ', userEmail);
    let dappsToClean = await dynamoDB.getDappNamesByOwner(userEmail);
    let sqsPromises = dappsToClean.map((dappName) => {
      let sqsMessageBody = {
        Method : deleteMethodName,
        DappName : dappName
      }
      return sqs.sendMessage(deleteMethodName, JSON.stringify(sqsMessageBody));
    })
    return Promise.all(sqsPromises);
}

function dnsNameFromDappName(dappName:string) {
  return dappName.concat(dnsRoot);
}

export default {
  postPipelineBuild : postPipelineBuildJob,
  enterpriseGithubCommit : enterpriseGithubCommitJob,
  periodicCleanup : periodicCleanup,
  handlePaymentStatus : handlePaymentStatus
}