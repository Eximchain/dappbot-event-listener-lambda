import assert from 'assert';
import uuidv4 from 'uuid';
import { addAwsPromiseRetries } from '../common';
import { AWS } from '../env';
import { DistributionConfig, ListDistributionsResult, AliasList, Tag } from 'aws-sdk/clients/cloudfront';
const cloudfront = new AWS.CloudFront({apiVersion: '2018-11-05'});

function promiseGetCloudfrontDistributionConfig(distroId:string) {
    // Cleanup function may make a lot of these calls at once and needs a lot of retries
    let maxRetries = 20;
    let params = {
        Id: distroId
    }
    return addAwsPromiseRetries(() => cloudfront.getDistributionConfig(params).promise(), maxRetries);
}

function promiseDeleteCloudfrontDistribution(distroId:string, etag:string) {
    // Cleanup function may make a lot of these calls at once and needs a lot of retries
    let maxRetries = 20;
    let params = {
        Id: distroId,
        IfMatch: etag
    };
    return addAwsPromiseRetries(() => cloudfront.deleteDistribution(params).promise(), maxRetries);
}

async function deleteCloudfrontDistributionNoEtag(distroId:string) {
    let getConfigResult = await promiseGetCloudfrontDistributionConfig(distroId);
    let etag = getConfigResult.ETag;
    if (!etag) {
        return Promise.reject(`ETag for ${distroId} not found`);
    }
    return promiseDeleteCloudfrontDistribution(distroId, etag);
}

function promiseListCloudfrontDistributions(marker:string) {
    let maxRetries = 5;
    let params = marker ? { Marker: marker } : {};
    return addAwsPromiseRetries(() => cloudfront.listDistributions(params).promise(), maxRetries);
}

function promiseListTagsForCloudfrontDistribution(distroArn:string) {
    // Cleanup function may make a lot of these calls at once and needs a lot of retries
    let maxRetries = 20;
    let params = {
        Resource: distroArn
    };
    return addAwsPromiseRetries(() => cloudfront.listTagsForResource(params).promise(), maxRetries);
}

function promiseCreateCloudfrontInvalidation(distroId:string, pathPrefix:string='/') {
    let maxRetries = 5;
    let params = {
        DistributionId: distroId,
        InvalidationBatch: {
            CallerReference: uuidv4(),
            Paths: {
                Quantity: 1,
                Items: [
                    `${pathPrefix}*`
                ]
            }
        }
    };
    return addAwsPromiseRetries(() => cloudfront.createInvalidation(params).promise(), maxRetries);
}

async function getDisabledDistributions() {
    let marker = '';
    let disabledDistros:CloudfrontIdentifier[] = [];
    while (true) {
        let listDistrosResult:ListDistributionsResult = await promiseListCloudfrontDistributions(marker);
        if (!listDistrosResult.DistributionList) {
            break;
        }
        let listDistrosPage = listDistrosResult.DistributionList;
        if (!listDistrosPage.Items) {
            break;
        }

        let disabledDistroPage = listDistrosPage.Items.filter(item => item.Enabled === false)
                                                      .filter(item => item.Status === 'Deployed');

        let disabledDistroPageArns = disabledDistroPage.map(item => ({Id: item.Id, ARN: item.ARN}));
        disabledDistros = disabledDistros.concat(disabledDistroPageArns);

        if (listDistrosPage.IsTruncated) {
            marker = listDistrosPage.Marker;
        } else {
            break;
        }
    }
    return disabledDistros;
}

async function getDistroIdsForCleanup() {
    let disabledDistroIdentifiers = await getDisabledDistributions();
    let numDisabledDistros = disabledDistroIdentifiers.length;
    console.log(`Found ${numDisabledDistros} Cloudfront distributions disabled`);
    let getTagsPromises = disabledDistroIdentifiers.map(identifier => (promiseListTagsForCloudfrontDistribution(identifier.ARN)));

    let identifiersWithTags:CloudfrontIdentifierWithTags[] = [];
    for (let i = 0; i < numDisabledDistros; i++) {
        let identifier = disabledDistroIdentifiers[i];
        let tags:Tag[] | null;
        try {
            let getTagsResult = await getTagsPromises[i];
            if (getTagsResult.Tags.Items) {
                tags = getTagsResult.Tags.Items;
            } else {
                tags = null;
            }
        } catch(err) {
            tags = null;
        }
        let identifierWithTags = {Id: identifier.Id, ARN: identifier.ARN, Tags: tags};
        identifiersWithTags.push(identifierWithTags);
    }

    let identifiersForCleanup = identifiersWithTags.filter(filterIdentifiersForCleanup);
    return identifiersForCleanup.map(identifier => identifier.Id);
}

async function cleanupDisabledDistributions() {
    console.log("Cleaning up disabled Cloudfront Distributions");
    let idsForCleanup = await getDistroIdsForCleanup();
    console.log(`Found ${idsForCleanup.length} Cloudfront distributions for cleanup`);
    let deletePromises = idsForCleanup.map(deleteCloudfrontDistributionNoEtag);
    try {
        await Promise.all(deletePromises);
        console.log("All distributions cleaned up successfully");
    } catch(errs) {
        console.log("Error deleting some distributions for cleanup: ", errs);
    }
}

function filterIdentifiersForCleanup(identifier:CloudfrontIdentifierWithTags) {
    let tags = identifier.Tags;
    if (!tags) {
        return false;
    }

    let applicationDappBotTags = tags.filter(tag => tag.Key === 'Application' && tag.Value === 'DappBot');
    let managedByDappBotTags = tags.filter(tag => tag.Key === 'ManagedBy' && tag.Value === 'DappBot');
    return applicationDappBotTags.length === 1 && managedByDappBotTags.length === 1;
}

interface CloudfrontIdentifier {
    Id: string,
    ARN: string
}

interface CloudfrontIdentifierWithTags {
    Id: string,
    ARN: string,
    Tags: Tag[] | null
}

export default {
    getDistroConfig : promiseGetCloudfrontDistributionConfig,
    deleteDistro : promiseDeleteCloudfrontDistribution,
    listTags : promiseListTagsForCloudfrontDistribution,
    cleanupDisabledDistros : cleanupDisabledDistributions,
    invalidateDistroPrefix : promiseCreateCloudfrontInvalidation
};