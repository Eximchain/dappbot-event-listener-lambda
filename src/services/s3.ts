import shell from 'shelljs';
import fs from 'fs';
// @ts-ignore Alas, there are no published bindings for node-zip.
import zip from 'node-zip';

import { 
    defaultTags, dappNameTag, dappOwnerTag, addAwsPromiseRetries, 
    DappSeedArgs, ResourceTag
} from '../common';
import { AWS, awsRegion, dappseedBucket } from '../env';
import { loadingPageHtml } from './loadingPageHtml';
import { ListObjectsOutput, ObjectKey } from 'aws-sdk/clients/s3';
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

function promiseCreateS3Bucket(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName,
        ACL: 'public-read'
    };
    return addAwsPromiseRetries(() => s3.createBucket(params).promise(), maxRetries);
}

function promiseDeleteS3Bucket(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName
    };
    return addAwsPromiseRetries(() => s3.deleteBucket(params).promise(), maxRetries);
}

function promiseListS3Objects(bucketName:string):Promise<ListObjectsOutput> {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName
    };
    return addAwsPromiseRetries(() => s3.listObjects(params).promise(), maxRetries);
}

function promiseEmptyS3Bucket(bucketName:string) {
    let maxDeleteRetries = 5;
    console.log("Emptying S3 bucket ", bucketName)
    // TODO: Does this have issues with the limit of list objects?
    return promiseListS3Objects(bucketName).then(function(result) {
        console.log("List S3 Objects Success", result);
        // Contents can be undefined, ensure there's always an array to map over
        result.Contents = result.Contents || [];
        let deletePromises = result.Contents.map((obj)=>{
            let params = {
                Bucket: bucketName,
                Key: obj.Key as ObjectKey
            };
            return addAwsPromiseRetries(() => s3.deleteObject(params).promise(), maxDeleteRetries)
        })
        let retPromise = Promise.all(deletePromises);
        console.log("Returning promise", retPromise, "With deletePromises", deletePromises)
        return retPromise;
    })
    .catch(function(err) {
        console.log("Error", err);
        return Promise.reject(err);
    });
}

function promiseSetS3BucketPublicReadable(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName,
        Policy : JSON.stringify({
            "Version":"2012-10-17",
            "Statement":[{
            "Sid":"PublicReadGetObject",
                  "Effect":"Allow",
              "Principal": "*",
                "Action":["s3:GetObject"],
                "Resource":[`arn:aws:s3:::${bucketName}/*`]
              }
            ]
        })
    };
    return addAwsPromiseRetries(() => s3.putBucketPolicy(params).promise(), maxRetries);
}


function promiseConfigureS3BucketStaticWebsite(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName,
        WebsiteConfiguration: {
            ErrorDocument: {
                Key: 'index.html'
            },
            IndexDocument: {
                Suffix: 'index.html'
            }
        }
    };
    return addAwsPromiseRetries(() => s3.putBucketWebsite(params).promise(), maxRetries);
}

function promiseEnableS3BucketCORS(bucketName:string, dappDNS:string) {
    let maxRetries = 5;
    let params = {
        Bucket : bucketName,
        CORSConfiguration : {
            CORSRules : [
                {
                    "AllowedHeaders": ["Authorization"],
                    "AllowedOrigins": [`https://${dappDNS}`],
                    "AllowedMethods": ["GET"],
                    MaxAgeSeconds   : 3000
                }
            ]
        }
    }
    return addAwsPromiseRetries(() => s3.putBucketCors(params).promise(), maxRetries);
}

function promiseGetS3BucketWebsiteConfig(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName
    };
    return addAwsPromiseRetries(() => s3.getBucketWebsite(params).promise(), maxRetries);
}

function promisePutDappseed({ dappName, web3URL, guardianURL, abi, addr, cdnURL }:DappSeedArgs) {
    shell.cd('/tmp');
    const dappZip = new zip();
    const abiObj = typeof abi === 'string' ? JSON.parse(abi) : abi;
    dappZip.file('Contract.json', JSON.stringify(abiObj, undefined, 2));
    dappZip.file('config.json', JSON.stringify({
        contract_name : dappName,
        contract_addr : addr,
        contract_path : './Contract.json',
        web3URL, guardianURL, cdnURL:`https://${cdnURL}`
    }, undefined, 2));
    fs.writeFileSync('./dappseed.zip', dappZip.generate({base64:false,compression:'DEFLATE'}), 'binary')
    const zipData = fs.readFileSync('./dappseed.zip');

    let maxRetries = 5;
    let params = {
        Bucket : dappseedBucket,
        ACL: 'private',
        Key: `${dappName}/dappseed.zip`,
        Body: zipData
    };
    return addAwsPromiseRetries(() => s3.putObject(params).promise(), maxRetries);
}

function promisePutS3LoadingPage(bucketName:string) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName,
        ACL: 'public-read',
        ContentType: 'text/html',
        Key: 'index.html',
        Body: loadingPageHtml,
        CacheControl: 'max-age=0'
    };
    return addAwsPromiseRetries(() => s3.putObject(params).promise(), maxRetries);
}

async function promiseMakeObjectNoCache(bucketName:string, objectKey:string) {
    let maxRetries = 5;
    const indexObject = await promiseGetS3Object(bucketName, objectKey);
    const putParams = {
        Bucket : bucketName,
        ACL : 'public-read',
        ContentType: indexObject.ContentType,
        Key : objectKey,
        Body : indexObject.Body,
        CacheControl: 'max-age=0'
    }
    return addAwsPromiseRetries(() => s3.putObject(putParams).promise(), maxRetries);
}

function promisePutBucketTags(bucketName:string, tags:ResourceTag[]) {
    let maxRetries = 5;
    let params = {
        Bucket: bucketName,
        Tagging: {
            TagSet: tags
        }
    };
    return addAwsPromiseRetries(() => s3.putBucketTagging(params).promise(), maxRetries);
}

function promiseCreateS3BucketWithTags(bucketName:string, dappName:string, dappOwner:string) {
    console.log("Creating S3 bucket ", bucketName)
    return promiseCreateS3Bucket(bucketName).then(function(result) {
        console.log("Create S3 Bucket Success", result);
        let extraTags = [dappNameTag(dappName), dappOwnerTag(dappOwner)];
        let bucketTags = defaultTags.concat(extraTags);
        console.log("Applying Default Bucket Tags", defaultTags)
        return promisePutBucketTags(bucketName, bucketTags);
    })
    .catch(function(err) {
        console.log("Error", err);
        return Promise.reject(err);
    });
}

function promiseGetS3Object(bucketName:string, objectKey:string) {
    let maxRetries = 5;
    const params = {
        Bucket : bucketName,
        Key : objectKey
    }
    return addAwsPromiseRetries(() => s3.getObject(params).promise(), maxRetries);
}

function getS3BucketEndpoint(bucketName:string) {
    return bucketName.concat(".s3.").concat(awsRegion).concat(".amazonaws.com");
}

export default {
    getBucketWebsite : promiseGetS3BucketWebsiteConfig,
    configureBucketWebsite : promiseConfigureS3BucketStaticWebsite,
    setBucketPublic : promiseSetS3BucketPublicReadable,
    putLoadingPage : promisePutS3LoadingPage,
    putDappseed : promisePutDappseed,
    createBucketWithTags : promiseCreateS3BucketWithTags,
    deleteBucket : promiseDeleteS3Bucket,
    emptyBucket : promiseEmptyS3Bucket,
    listObjects : promiseListS3Objects,
    getObject : promiseGetS3Object,
    makeObjectNoCache : promiseMakeObjectNoCache,
    enableBucketCors : promiseEnableS3BucketCORS,
    bucketEndpoint : getS3BucketEndpoint
}