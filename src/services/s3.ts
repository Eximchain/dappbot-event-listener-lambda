import { addAwsPromiseRetries, ResourceTag } from '../common';
import { AWS, awsRegion } from '../env';
import { ListObjectsOutput, ObjectKey } from 'aws-sdk/clients/s3';
const s3 = new AWS.S3({apiVersion: '2006-03-01'});

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
    deleteBucket : promiseDeleteS3Bucket,
    emptyBucket : promiseEmptyS3Bucket,
    listObjects : promiseListS3Objects,
    getObject : promiseGetS3Object,
    makeObjectNoCache : promiseMakeObjectNoCache,
    enableBucketCors : promiseEnableS3BucketCORS,
    bucketEndpoint : getS3BucketEndpoint
}