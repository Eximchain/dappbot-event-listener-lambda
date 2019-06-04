// SQS
// https://docs.aws.amazon.com/lambda/latest/dg/invoking-lambda-function.html#supported-event-source-sqs
export interface SQSRecord {
  messageId: string;
  receiptHandle: string;
  body: string;
  attributes: SQSRecordAttributes;
  messageAttributes: SQSMessageAttributes;
  md5OfBody: string;
  eventSource: string;
  eventSourceARN: string;
  awsRegion: string;
}

export interface SQSEvent {
  Records: SQSRecord[];
}

export interface SQSRecordAttributes {
  ApproximateReceiveCount: string;
  SentTimestamp: string;
  SenderId: string;
  ApproximateFirstReceiveTimestamp: string;
}

export type SQSMessageAttributeDataType = 'String' | 'Number' | 'Binary' | string;

export interface SQSMessageAttribute {
  stringValue?: string;
  binaryValue?: string;
  stringListValues: never[]; // Not implemented. Reserved for future use.
  binaryListValues: never[]; // Not implemented. Reserved for future use.
  dataType: SQSMessageAttributeDataType;
}

export interface SQSMessageAttributes {
  [name: string]: SQSMessageAttribute;
}

/**
 * CodePipeline events
 * https://docs.aws.amazon.com/codepipeline/latest/userguide/actions-invoke-lambda-function.html
 */
export interface S3ArtifactLocation {
  bucketName: string;
  objectKey: string;
}
export interface S3ArtifactStore {
  type: 'S3';
  s3Location: S3ArtifactLocation;
}

export type ArtifactLocation = S3ArtifactStore;

export interface Artifact {
  name: string;
  revision: string | null;
  location: ArtifactLocation;
}

export interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface EncryptionKey {
  type: string;
  id: string;
}

export interface CodePipelineJob {
  id: string;
  accountId: string;
  data: {
      actionConfiguration: {
          configuration: {
              FunctionName: string;
              UserParameters: string;
          }
      };
      inputArtifacts: Artifact[];
      outputArtifacts: Artifact[];
      artifactCredentials: Credentials;
      encryptionKey?: EncryptionKey & { type: 'KMS' };
      continuationToken?: string;
  };
};

export interface CodePipelineEvent {
  "CodePipeline.job": CodePipelineJob
};

