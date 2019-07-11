import { PaymentStatus } from './common';
import { CodePipelineJob } from './lambda-event-types';
import { dnsRoot } from './env';
import services from './services';
const { cloudfront, dynamoDB, s3, codepipeline, sendgrid, github } = services;

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
  await cloudfront.cleanupDisabledDistros();
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
  switch (status) {
    case PaymentStatus.LAPSED:
      console.log(`Handling ${status} payment status for user ${userEmail}`);
      return await dynamoDB.putLapsedUser(userEmail);
    case PaymentStatus.ACTIVE:
        console.log(`Handling ${status} payment status for user ${userEmail}`);
      return await dynamoDB.deleteLapsedUser(userEmail);
    default:
      console.log(`No Handler for payment status ${status}`);
  }
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