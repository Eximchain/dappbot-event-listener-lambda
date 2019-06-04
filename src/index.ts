'use strict';
import cleanup from './services/cleanup';
import { CodePipelineEvent } from './lambda-event-types';

type Event = CodePipelineEvent;
exports.handler = async (event:Event) => {
    console.log("request: " + JSON.stringify(event));

    // Pass CodePipeline events straight to cleanup function
    if ('CodePipeline.job' in event){
        return cleanup.postPipelineCleanup(event['CodePipeline.job']);
    }

    console.log("Doing Nothing");
    return {};
};