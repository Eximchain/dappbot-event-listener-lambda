// Provided automagically by AWS
export const awsRegion = process.env.AWS_REGION as string;
export const lambdaFxnName = process.env.AWS_LAMBDA_FUNCTION_NAME as string;

// Provided to us via Terraform
export const dappTableName = process.env.DAPP_TABLE as string;
export const lapsedUsersTableName = process.env.LAPSED_USERS_TABLE as string;
export const r53HostedZoneId = process.env.R53_HOSTED_ZONE_ID as string;
export const dnsRoot = process.env.DNS_ROOT as string;
export const codebuildId = process.env.CODEBUILD_ID as string;
export const pipelineRoleArn = process.env.PIPELINE_ROLE_ARN as string;
export const kmsKeyName = process.env.KMS_KEY_NAME as string;
export const artifactBucket = process.env.ARTIFACT_BUCKET as string;
export const dappseedBucket = process.env.DAPPSEED_BUCKET as string;
export const wildcardCertArn = process.env.WILDCARD_CERT_ARN as string;
export const cognitoUserPoolId = process.env.COGNITO_USER_POOL as string;
export const sendgridApiKey = process.env.SENDGRID_API_KEY as string;
export const githubToken = process.env.GITHUB_TOKEN as string;
export const sqsQueue = process.env.SQS_QUEUE as string;
export const segmentWriteKey = process.env.SEGMENT_NODEJS_WRITE_KEY as string;
export const apiUrl = process.env.API_URL as string;

const paymentLapsedGracePeriodHrsStr = process.env.PAYMENT_LAPSED_GRACE_PERIOD_HRS as string;
export const paymentLapsedGracePeriodHrs = Number(paymentLapsedGracePeriodHrsStr);

import AWSUnconfigured from 'aws-sdk';
export const AWS = AWSUnconfigured;
AWS.config.update({region: awsRegion});

export default { 
    AWS, awsRegion, dappTableName, r53HostedZoneId, dnsRoot, codebuildId, 
    lambdaFxnName, pipelineRoleArn, kmsKeyName, artifactBucket, 
    dappseedBucket, wildcardCertArn, cognitoUserPoolId, sendgridApiKey, githubToken
};