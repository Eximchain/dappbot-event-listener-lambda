const { addAwsPromiseRetries } = require('../common');
const { AWS, r53HostedZoneId, dnsRoot } = require('../env');
const route53 = new AWS.Route53({apiVersion: '2013-04-01'});

function promiseCreateDnsRecord(dnsName:string, cloudfrontDns:string) {
    let maxRetries = 5;
    let params = {
        HostedZoneId: r53HostedZoneId,
        ChangeBatch: {
            Changes: [{
                Action: 'CREATE',
                ResourceRecordSet: {
                    AliasTarget: {
                        DNSName: cloudfrontDns, 
                        EvaluateTargetHealth: false, 
                        HostedZoneId: "Z2FDTNDATAQYW2"
                    },
                    Name: dnsName, 
                    Type: "A"
                }
            }]
        }
    }
    return addAwsPromiseRetries(() => route53.changeResourceRecordSets(params).promise(), maxRetries);
}

function promiseDeleteDnsRecord(dnsName:string, cloudfrontDns:string) {
    let maxRetries = 5;
    let params = {
        HostedZoneId: r53HostedZoneId,
        ChangeBatch: {
            Changes: [{
                Action: 'DELETE',
                ResourceRecordSet: {
                    AliasTarget: {
                        DNSName: cloudfrontDns, 
                        EvaluateTargetHealth: false, 
                        HostedZoneId: "Z2FDTNDATAQYW2"
                    }, 
                    Name: dnsName, 
                    Type: "A"
                }
            }]
        }
    }
    return addAwsPromiseRetries(() => route53.changeResourceRecordSets(params).promise(), maxRetries);
}

export default {
    createRecord : promiseCreateDnsRecord,
    deleteRecord : promiseDeleteDnsRecord
}