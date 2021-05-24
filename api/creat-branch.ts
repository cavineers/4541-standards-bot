/* eslint-disable @typescript-eslint/no-var-requires */
import * as core from '@actions/core';
import { GitHubRepository } from './GitHub';

interface branchParams {
    ref: string;
    sha: string;
}

export class Branches {
    private static GitHub = new GitHubRepository(core.getInput('github-token'));

    public static async creatNewBranchReference(data: branchParams) {
        core.debug('Creating new branch');
        const {
            data: { html_url, number },
        } = await this.GitHub.octokit.request(`POST /repos/{owner}/{repo}/git/refs`, {
            ...GitHubRepository.getRepo(),
            ref: data.ref,
            sha: data.sha,
        });
        console.log(`Branch created: ${html_url} (#${number})`);
        core.info(`Branch created: ${html_url} (#${number})`);
    }

    public static async createNewCommit(message: string) {
        // Retrieve data on entire repository.
        const {
            // @ts-ignore
            data: { default_branch },
        } = await this.GitHub.octokit
            .request(`GET /repos/{owner}/{repo}`, {
                ...GitHubRepository.getRepo(),
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });

        const {
            // @ts-ignore
            data: { branch },
        } = await this.GitHub.octokit
            .request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
                ...GitHubRepository.getRepo(),
                ref: `refs/heads/${default_branch}`,
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });
        const lastCommitSHA = branch.object.sha;

        // Get most recent commit on master.
        const {
            // @ts-ignore
            data: { tree },
        } = await this.GitHub.octokit
            .request('GET /repos/{owner}/{repo}/git/commits/{commit_sha}', {
                ...GitHubRepository.getRepo(),
                commit_sha: lastCommitSHA,
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });

        const lastTreeSHA = tree.sha;

        // Create a new tree.
        const {
            // @ts-ignore
            data: { sha },
        } = await this.GitHub.octokit
            .request('POST /repos/{owner}/{repo}/git/trees', {
                ...GitHubRepository.getRepo(),
                base_tree: lastTreeSHA,
                tree: [
                    {
                        //! More params might be needed.
                        mode: 100644,
                    },
                ],
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });

        const newTreeSHA = sha;

        console.log(sha);

        // Create a new commit.
        const newCommit = await this.GitHub.octokit
            .request(`POST /repos/{owner}/{repo}/git/commits`, {
                ...GitHubRepository.getRepo(),
                message: message,
                tree: newTreeSHA,
                parents: [lastCommitSHA],
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });

        // Point new commit to reference.
        await this.GitHub.octokit
            .request('PATCH /repos/{owner}/{repo}/git/refs/{ref}', {
                ...GitHubRepository.getRepo(),
                ref: `refs/heads/${default_branch}`,
                sha: (<any>newCommit).sha,
            })
            .catch((error: any) => {
                console.error(error);
                core.error(error);
            });

        // eslint-disable-next-line no-return-await
        return await (<any>newCommit).sha;
    }
}
