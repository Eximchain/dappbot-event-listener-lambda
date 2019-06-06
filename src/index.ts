'use strict';
import jobs from './jobs';
import { CodePipelineEvent, SNSEvent, SNSEventRecord } from './lambda-event-types';

type Event = CodePipelineEvent | SNSEvent;
exports.handler = async (event:Event) => {
    console.log("request: " + JSON.stringify(event));

    // CodePipeline Event
    if ('CodePipeline.job' in event){
        return jobs.postPocPipelineBuild(event['CodePipeline.job']);
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
    switch (msgBody.command) {
        case 'cleanup':
            return jobs.periodicCleanup();
        default:
            console.log(`Skipping unknown SNS command ${msgBody.command}`);
            return {};
    }
}