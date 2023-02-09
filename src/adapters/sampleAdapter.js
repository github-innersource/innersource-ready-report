// -----------------------------------------------------------------
// This is a sample adapter that can be used as a template for
// creating new adapters. It is not intended to be used as-is.  
//
// The adapter is called by the main function in index.js. The
// main function passes the context and data to the adapter.
// The adapter is responsible for processing the data and
// returning a result.
//
// The adapter creates an Innersource Ready Report (IRR) for a
// repository. The IRR is stored in a GitHub repository. The
// repository is specified in the .env file.
// In addition, the adapter creates an accumulated IRR for all
// repositories. The accumulated IRR is also stored in the
// GitHub repository.
//
// -----------------------------------------------------------------
const util = require('util')

exports.execute = async function (context, data) {
    context.log.info("Running sampleAdapter")
    require('dotenv').config();
    let report = ''
    const org = process.env.ADAPTER_ORG
    const repo = process.env.ADAPTER_REPO
    const repo_path = process.env.ADAPTER_REPO_PATH + "/" + context.payload.repository.name + "_irr.json"
    const buff = Buffer.from(JSON.stringify(data, null, 4))
    const base64data = buff.toString('base64')
    let check_content

    // get the accumulated IRR JSON from the repo
    getAccumulatedIRR(context).then((accumulated_irr) => {

        // base64 decode the content
        const buf = Buffer.from(accumulated_irr.content, 'base64')
        const accumulated_irr_content = JSON.parse(buf.toString())
        let irrObject = {}

        context.log.info("accumulated_irr_content: " + util.inspect(accumulated_irr_content, false, null, true /* enable colors */))
        irrObject.name = context.payload.repository.name
        irrObject.description = context.payload.repository.description
        irrObject.stars = context.payload.repository.stargazers_count
        irrObject.forked = context.payload.repository.forks_count
        irrObject.issues = context.payload.repository.open_issues_count
        irrObject.compatible = data.status.modular_health < 100 ? false : true
        irrObject.languages = data.meta.languages
        irrObject.status = data.status
        irrObject.url = context.payload.repository.html_url

        context.log.debug("sampleAdapter:irrObject: " + util.inspect(irrObject, false, null, true /* enable colors */))

        let no_irr_for_repo = true

        // turn bsae64 encoded content into a json object
        const content = JSON.parse(Buffer.from(accumulated_irr.content, 'base64').toString())

        //if the content array is empty, add the irrObject to it
        if (content.length == 0) {
            context.log.info("accumulated_irr_content is empty, adding repo: '" + context.payload.repository.name + "' to accumulated_irr_content...")
            content.push(irrObject)
        }
        else {
            //iterate over the content and find the repo-name
            for (let i = 0; i < content.length; i++) {
                if (content[i].name == context.payload.repository.name) {
                    context.log.info("found repo in accumulated_irr: " + content[i].name)
                    content[i] = irrObject
                    no_irr_for_repo = false
                    break
                }
            }

            if (no_irr_for_repo) {
                context.log.info("accumulated_irr_content did not contain '" + context.payload.repository.name + "'")
                context.log.info("adding repo: '" + context.payload.repository.name + "' to accumulated_irr_content...")
                content.push(irrObject)
            }
        }

        context.log.info("writing new content back to accumulated_irr.json: " + util.inspect(content, false, null, true /* enable colors */))
        const repo_path = process.env.ADAPTER_REPO_PATH + "/" + "accumulated_irr.json"
        context.octokit.rest.repos.createOrUpdateFileContents({
            "owner": org,
            "repo": repo,
            "path": repo_path,
            "message": "repo ready report",
            "content": Buffer.from(JSON.stringify(content, null, 4)).toString('base64'),
            "committer.name": context.payload.sender.login,
            "committer.email": context.payload.sender.login + "@github.com",
            "author.name": context.payload.sender.login,
            "author.email": context.payload.sender.login + "@github.com",
            "sha": accumulated_irr.sha
        })
    })

    try {
        check_content = await context.octokit.rest.repos.getContent({
            "owner": org,
            "repo": repo,
            "path": repo_path,
        });
    } catch (err) {
        // file does not exist
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
        return Date();
    }
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

    context.log.debug("sampleAdapter:" + report)
    return Date();
};


// function to get the accumulated IRR JSON from the repo
async function getAccumulatedIRR(context) {
    context.log.info("Running sampleAdapter:getAccumulatedIRR")
    require('dotenv').config();
    const org = process.env.ADAPTER_ORG
    const repo = process.env.ADAPTER_REPO
    const repo_path = process.env.ADAPTER_REPO_PATH + "/accumulated_irr.json"
    let check_content

    context.log.info("repo_path: " + repo_path)

    try {
        check_content = await context.octokit.rest.repos.getContent({
            "owner": org,
            "repo": repo,
            "path": repo_path,
        });
    } catch (err) {
        // file does not exist, create the file
        context.log.info("accumulated_irr.json does not exist, creating it now..." + err )
        check_content = await context.octokit.rest.repos.createOrUpdateFileContents({
            "owner": org,
            "repo": repo,
            "path": repo_path,
            "message": "accumulated innersource ready report",
            "content": Buffer.from(JSON.stringify([], null, 4)).toString('base64'), // empty array
            "committer.name": context.payload.sender.login,
        })
    }

    return check_content.data
}