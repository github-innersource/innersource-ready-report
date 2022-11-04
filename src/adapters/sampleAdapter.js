const util = require('util')

exports.execute = async function (context, data) {
    require('dotenv').config();
    let report = ''
    const org = process.env.ADAPTER_ORG
    const repo = process.env.ADAPTER_REPO
    const repo_path = process.env.ADAPTER_REPO_PATH +"/"+ context.payload.repository.name +"_irr.json"
    const buff = Buffer.from(JSON.stringify(data, null, 4))
    const base64data = buff.toString('base64')

    const check_content = await context.octokit.rest.repos.getContent({
        "owner": org,
        "repo": repo,
        "path": repo_path,
    });

    if (check_content.status == 200) {

        report = await context.octokit.rest.repos.createOrUpdateFileContents({
            "owner": org,
            "repo": repo,
            "path": repo_path,
            "message": "repo ready report",
            "content": base64data,
            "committer.name": context.payload.sender.login,
            "committer.email": context.payload.sender.login + "@github.com",
            "author.name": context.payload.sender.login,
            "author.email": context.payload.sender.login + "@github.com",
            "sha": check_content.data.sha
        })
    }
    else {
        report = await context.octokit.rest.repos.createOrUpdateFileContents({
            "owner": org,
            "repo": repo,
            "path": repo_path,
            "message": "repo ready report",
            "content": base64data,
            "committer.name": context.payload.sender.login,
            "committer.email": context.payload.sender.login + "@github.com",
            "author.name": context.payload.sender.login,
            "author.email": context.payload.sender.login + "@github.com"
        })
    }
    context.log.info("sampleAdapter:"+ report)
    return Date();
};