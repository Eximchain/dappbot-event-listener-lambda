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
const masterRefName = 'heads/master';


async function commitArtifactToGithub(artifact:any, targetRepoName:string, targetRepoOwner:string) {
    if (!GITHUB_CONFIGURED) {
        console.log("Github Client not configured. Skipping committing artifacts to Github.");
        return;
    }

    let masterRef = await getMasterRef(targetRepoName, targetRepoOwner);
    let headCommit = await getCommit(targetRepoName, targetRepoOwner, masterRef.object.sha);

    let blobs:Map<string, GithubBlob> = new Map();
    for (let [filePath, fileObj] of Object.entries(artifact.files)) {
        let file = fileObj as NodeZipFile;
        let fileContent = fileAsBase64(file);

        let blob = await createBlob(targetRepoName, targetRepoOwner, fileContent);
        blobs.set(filePath, blob);
        await sleep(250);
    }
    console.log("All blobs created");

    let treeItems:TreeItem[] = [];
    blobs.forEach((blob, filePath, map) => (
        treeItems.push({
            path: filePath,
            sha: blob.sha,
            type: 'blob',
            mode: '100644'
        })
    ));

    let newTree = await createNewTree(targetRepoName, targetRepoOwner, headCommit.tree.sha, treeItems);
    let newCommit = await createCommit(targetRepoName, targetRepoOwner, newTree.sha, masterRef.object.sha);
    await pushCommit(targetRepoName, targetRepoOwner, newCommit.sha);
}

function fileAsBase64(file:NodeZipFile) {
    return file.asNodeBuffer().toString('base64');
}

async function createBlob(repoName:string, repoOwner:string, base64Content:string):Promise<GithubBlob> {
    let params = {
        owner: repoOwner,
        repo: repoName,
        content: base64Content,
        encoding: 'base64'
    };

    let response = await octokit.git.createBlob(params);
    console.log("Created blob", response);
    return response.data;
}

async function getMasterRef(repoName:string, repoOwner:string) {
    let params = {
        owner: repoOwner,
        repo: repoName,
        ref: masterRefName
    };
    
    let response = await octokit.git.getRef(params);
    console.log("Got Reference: ", response);
    return response.data;
}

async function getCommit(repoName:string, repoOwner:string, commitSha:string) {
    let params = {
        owner: repoOwner,
        repo: repoName,
        commit_sha: commitSha
    };

    let response = await octokit.git.getCommit(params);
    console.log("Got Commit: ", response);
    return response.data;
}

async function createNewTree(repoName:string, repoOwner:string, baseTreeSha:string, treeItems:TreeItem[]) {
    let params = {
        owner: repoOwner,
        repo: repoName,
        tree: treeItems,
        base_tree: baseTreeSha
    };

    let response = await octokit.git.createTree(params);
    console.log("Created new tree: ", response);
    return response.data;
}

async function createCommit(repoName:string, repoOwner:string, treeSha:string, parentSha:string) {
    let params = {
        owner: repoOwner,
        repo: repoName,
        message: 'Source Commit by DappBot Enterprise',
        tree: treeSha,
        parents: [parentSha]
    };

    let response = await octokit.git.createCommit(params);
    console.log("Created new commit: ", response);
    return response.data;
}

async function pushCommit(repoName:string, repoOwner:string, commitSha:string) {
    let params = {
        owner: repoOwner,
        repo: repoName,
        ref: masterRefName,
        sha: commitSha
    };

    let response = await octokit.git.updateRef(params);
    console.log("Pushed new commit: ", response);
    return response.data;
}

interface GithubBlob {
    sha: string,
    url: string
}

interface TreeItem {
    path: string,
    type: 'blob' | 'tree' | 'commit' | undefined,
    sha: string,
    mode: '100644' | '100755' | '040000' | '160000' | '120000' | undefined
}

// Bare minimum interface for our purposes. Could be fleshed out more.
interface NodeZipFile {
    asNodeBuffer: () => Buffer
}

async function sleep(ms:number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    commitArtifact : commitArtifactToGithub
}