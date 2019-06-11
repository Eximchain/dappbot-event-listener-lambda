import Octokit from '@octokit/rest';
import { githubToken } from '../env';

let GITHUB_CONFIGURED = false;
let token = "";
if (githubToken && githubToken !== "") {
    token = githubToken;
    GITHUB_CONFIGURED = true;
}

const octokit = new Octokit({
    auth: token,
    userAgent: 'DappbotService v1.0'
});


async function commitArtifactToGithub(artifact:any) {
    if (!GITHUB_CONFIGURED) {
        console.log("Github Client not configured. Skipping committing artifacts to Github.");
        return;
    }
    console.log("Octokit Client: ", octokit);

    let printedAttrs = false;

    for (let [path, file] of Object.entries(artifact.files)) {
        console.log("Github Processing File: ", path);

        if (!printedAttrs) {
            for (let attr in file) {
                console.log("File Attribute: ", attr);
            }
            printedAttrs = true;
        }
    }
}

export default {
    commitArtifact : commitArtifactToGithub
}