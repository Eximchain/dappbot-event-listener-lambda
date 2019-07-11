'use strict';
import jobs from './jobs';
import { CodePipelineEvent, SNSEvent, SNSEventRecord } from './lambda-event-types';

type Event = CodePipelineEvent | SNSEvent;
exports.handler = async (event:Event) => {
    console.log("request: " + JSON.stringify(event));

    // CodePipeline Event
    if ('CodePipeline.job' in event) {
        let pipelineEvent = event['CodePipeline.job'];
        let userParams = JSON.parse(pipelineEvent.data.actionConfiguration.configuration.UserParameters);
        let job = userParams.Job;
        switch (job) {
            case PipelineJobs.POC_CLEANUP:
                return jobs.postPipelineBuild(pipelineEvent);
            case PipelineJobs.ENTERPRISE_GITHUB_COMMIT:
                return jobs.enterpriseGithubCommit(pipelineEvent);
            default:
                console.log(`CodePipeline Job ${job} not recognized`);
                return {};
        }
    }

    // Handle events with Records
    if (event.Records) {
        let records = event.Records;
        // SNS Events
        let snsRecords = records.filter(record => record.EventSource == 'aws:sns');
        let snsJobResults = snsRecords.map(processSnsRecord);

        return Promise.all(snsJobResults);
    }

    console.log("Doing Nothing for unrecognized event");
    return {};
};

async function processSnsRecord(record:SNSEventRecord) {
    let message = record.Sns;
    let msgBody = JSON.parse(message.Message);
    switch (msgBody.event) {
        case SNSJobs.CLEANUP:
            return jobs.periodicCleanup();
        case SNSJobs.PAYMENT_STATUS:
            return jobs.handlePaymentStatus(msgBody.email, msgBody.status);
        default:
            console.log(`Skipping unknown SNS event ${msgBody.event}`);
            return {};
    }
}

enum PipelineJobs {
    POC_CLEANUP = 'POC_CLEANUP',
    ENTERPRISE_GITHUB_COMMIT = 'ENTERPRISE_GITHUB_COMMIT'
}

enum SNSJobs {
    CLEANUP = 'CLEANUP',
    PAYMENT_STATUS = 'PAYMENT_STATUS'
}