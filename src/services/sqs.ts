import { AWS, sqsQueue } from '../env';
import { SendMessageRequest } from 'aws-sdk/clients/sqs';
const { addAwsPromiseRetries } = require('../common');

const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

function promiseSendMessage(method:string, body:string) {
    let maxRetries = 5;
    let params:SendMessageRequest = {
        QueueUrl: sqsQueue as string,
        MessageBody: body,
        MessageAttributes: {
            Method: {
                DataType: 'String',
                StringValue: method
            }
        }
    };
    return addAwsPromiseRetries(() => sqs.sendMessage(params).promise(), maxRetries);
}

export default {
    sendMessage : promiseSendMessage
}