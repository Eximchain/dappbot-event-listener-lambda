import { CodePipelineJob } from './lambda-event-types';
import { dnsRoot } from './env';
import services from './services';
const { dynamoDB, s3, codepipeline, sendgrid } = services;

// View a sample JSON event from a CodePipeline here:
//
// https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html#actions-invoke-lambda-function-json-event-example
//
// Below function is called by index, it receives the event["CodePipeline.job"] field.

async function postPipelineBuildJob({ data, id }:CodePipelineJob) {
  const { actionConfiguration } = data;
  // TODO: Get Dapp DNS from here
  const { OwnerEmail, DestinationBucket, DappName } = JSON.parse(actionConfiguration.configuration.UserParameters) 

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
  // TODO
  return {};
}

function dnsNameFromDappName(dappName:string) {
  return dappName.concat(dnsRoot);
}

export default {
  postPipelineBuild : postPipelineBuildJob,
  periodicCleanup : periodicCleanup
}