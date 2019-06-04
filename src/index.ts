'use strict';
import processor from './processor';
import cleanup from './services/cleanup';
import { SQSEvent, CodePipelineEvent, SQSRecord } from './lambda-event-types';
import { ResponseOptions, DappOperations } from './common';

function methodProcessor(method:DappOperations) {
    switch(method) {
        case 'create':
            return processor.create;
        case 'update':
            return processor.update;
        case 'delete':
            return processor.delete;
        default:
            return (dappName:string) => Promise.reject({message: `Unrecognized method name ${method} for processing '${dappName}'`});
    }
}

async function processRecord(record:SQSRecord) {
    let method = record.messageAttributes.Method.stringValue as DappOperations;
    let body = JSON.parse(record.body);
    let dappName = body.DappName;

    let recordProcessor = methodProcessor(method);
    return recordProcessor(dappName);
}

type Event = SQSEvent | CodePipelineEvent;
exports.handler = async (event:Event) => {
    console.log("request: " + JSON.stringify(event));

    // Pass CodePipeline events straight to cleanup function
    if ('CodePipeline.job' in event){
        return cleanup.postPipelineCleanup(event['CodePipeline.job']);
    }

    let records = event.Records;
    let processRecordsPromise = Promise.all(records.map(processRecord));

    try {
        let result = await processRecordsPromise;
        return successResponse(result);
    } catch (err) {
        throw errorResponse(err);
    }
};

function response(result:any, opts:ResponseOptions) {
    if (opts.isErr) {
        console.log("Returning Error Response for result", result);
        throw {};
    } else {
        console.log("Returning Success Response for result", result);
        return {};
    }
}

function successResponse(result:any, opts:ResponseOptions={isCreate: false}) {
    let successOpt = {isErr: false};
    let callOpts = {...opts, ...successOpt};
    return response(result, callOpts);
}

function errorResponse(result:any, opts:ResponseOptions={isCreate: false}) {
    let errorOpt = {isErr: true};
    let callOpts = {...opts, ...errorOpt};
    return response(result, callOpts);
}