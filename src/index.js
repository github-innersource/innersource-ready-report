
const ui = require('./ui/innersourceUI.js')
const fs = require('fs')
const yaml = require('js-yaml')
const util = require('util')

let innersourceRequirements = {}
let report = ""
let jsonReport = JSON.parse("{}");
const status = [':"+ white_check_mark +":', ':warning:']
const white_check_mark = "<img width='16' alt='check' src='https://user-images.githubusercontent.com/863198/194782472-79f7d7b0-2af0-4712-b3d0-01f64f99f785.png'></img>"
/** ---------------------------------------------------------------------------
 * @description This function loads the app configuration from the file system
 * @param {*} app 
 */
function loadAppConfig(app) {
  try {
    // eslint-disable-next-line no-path-concat
    const configData = fs.readFileSync('./src/innersource-checklist.yml', 'utf8')
    return JSON.parse(JSON.stringify(yaml.load(configData), null, 4))
  } catch (err) {
    console.error('Error loading App Config file: ', err)
  }
}

/** ---------------------------------------------------------------------------
 * @description Generic function to check if a file exists at a location in 
 *              the repository 
 * @param {*} fileName 
 * @returns File content or 404
 */
async function checkContent(app, context, fileName) {
  let response = ""

  try {
    const file = await context.octokit.repos.getContent(
      {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        path: fileName
      }
    );

    let buff = Buffer.from(file.data.content, 'base64')
    let text = buff.toString('utf-8')

    response = text
  } catch (err) {
    response = err.status
  }

  return response
}

/** ---------------------------------------------------------------------------
 * @description check if the repository has the required License
 * @param {*} app 
 * @returns
 */
async function checkLicense(app, context, license) {
  app.log.info("checkLicense: " + license)
  let response
  let hasLicense = false
  let repoLicense

  try {
    repoLicense = await context.octokit.licenses.getForRepo(
      {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
      }
    )
  } catch (err) {
    response = err.status
  }
  currentLicense = repoLicense.data.license.spdx_id
  app.log.info("currentLicense: " + currentLicense)
  license.indexOf(currentLicense) > -1 ? hasLicense = true : hasLicense = false

  if (hasLicense) {
    response = "|:"+ white_check_mark +":| " + license + "| " + repoLicense.data.license.spdx_id + " |\n"
  } else {
    response = "|:warning:| " + license + "| " + repoLicense.data.license.spdx_id + " |\n"
  }

  jsonReport.license = {}
  jsonReport.license.expected = license
  jsonReport.license.currentLicense = currentLicense
  jsonReport.license.compliant = hasLicense

  return response
}

/** ---------------------------------------------------------------------------
 * @description This function transforms the YAML report into a Markdown report
 * @param {*} yaml
 * @returns markdown
 */
async function yaml2markdown(app, yamlData) {
  let markdown = ""
  Object.keys(yamlData).forEach(async (name) => {
    markdown += "\n"
    mdName = name.replace(/_/g, " ").toUpperCase()
    markdown += "## " + mdName + "\n\n"

    if (name == "branch_protection_rules") {
      markdown += "| | ELEMENT | STATUS |\n"
      markdown += "|---|---|---|\n"
    }
    else {
      markdown += "| | REQUIRED | STATUS |\n"
      markdown += "|---|---|---|\n"
    }

    if (typeof yamlData[name] == "string") {
      markdown += "|:warning:| " + yamlData[name] + "| |\n"
    }
    else {
      Object.keys(yamlData[name]).forEach(async (key) => {
        if (yamlData[name][key] == true) {
          markdown += "|:"+ white_check_mark +":| " + key + "|" + util.inspect(yamlData[name][key]) + "|\n"
        }
        else {
          markdown += "|:warning:| " + key + "|" + util.inspect(yamlData[name][key]) + "|\n"
        }
      })
    }
  })

  return markdown
}

/** ---------------------------------------------------------------------------
 * @description This function checks if the repository has the required files
 * @param {*} app 
 */
async function checkForFile(app, context, fileName) {
  app.log.info("checkForFile: " + fileName)
  let response
  jsonReport.files = []

  // Check if the file exists in the 'root' location
  response = await checkContent(app, context, fileName)
  if (response == "404") {
    // Check if the file exists in the '.github' location
    response = await checkContent(app, context, ".github/" + fileName)

    if (response == "404") {
      response = "|:warning:| " + fileName + "| File Not found |\n"
      app.log.info("checkForFile: " + fileName + " found in")
    } else {
      line = response
      response = "|:"+ white_check_mark +":| " + fileName + "| .github/" + fileName + " |\n"
      app.log.info("checkForFile: " + fileName + " found in .github")
    }
  }
  else {
    line = response
    response = "|:"+ white_check_mark +":|" + fileName + "| /" + fileName + "|\n"
  }

  jsonReport.files
  return response
}

/** ---------------------------------------------------------------------------
 * 
 * @param {*} app 
 */
async function branch_protection(app, context, branch_protection_rules) {
  app.log.info("Branch Protection:" + util.inspect(branch_protection_rules))
  let response = "\n\n## Branch Protection Rules (default branch)\n\n"
  response += "|STATUS|RULE|EXPECTED|FOUND|\n|---|---|---|---|\n"

  result = await context.octokit.graphql(
    `query listBranchProtectionRule($owner: String!, $repo: String!) {
      repository( owner: $owner, name: $repo ) {
        branchProtectionRules(first:5) {
          nodes {
            allowsDeletions
            allowsForcePushes
            isAdminEnforced
            requiresApprovingReviews
            requiredApprovingReviewCount
            requiresCodeOwnerReviews
            requiresCommitSignatures
            requiresConversationResolution
            requiresLinearHistory
            requiresStatusChecks
            requiresStrictStatusChecks
            restrictsPushes
            restrictsReviewDismissals
          }
        }
      }
    }`,
    {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name
    }
  )

  app.log.info("Branch Protection:" + util.inspect(result.repository.branchProtectionRules.nodes[0]))
  jsonReport += "branch_protection:\n"
  Object.keys(branch_protection_rules).forEach(async (ruleName) => {

    if (branch_protection_rules[ruleName] == result.repository.branchProtectionRules.nodes[0][ruleName]) {
      response += "|:"+ white_check_mark +":|" + ruleName + "|" + branch_protection_rules[ruleName] + "|" + result.repository.branchProtectionRules.nodes[0][ruleName] + "|\n"
      jsonReport += "  " + ruleName + ": true\n"
    }
    else {
      response += "|:warning:|" + ruleName + "|" + branch_protection_rules[ruleName] + "|" + result.repository.branchProtectionRules.nodes[0][ruleName] + "|\n"
      jsonReport += "  " + ruleName + ": false\n"
    }
  })
  jsonReport += "\n"
  return response
}

/** ---------------------------------------------------------------------------
 * 
 * @param {*} app 
 */
async function dependabot_alert_check(app, context) {
  app.log.info("Dependabot Alert Check")
  let response = "\n\n## Dependabot Alerts\n\n"
  app.log.info("\n\n\n\n Dependabot Alert Check: " + util.inspect(context.github))

  // context.octokit.request('GET /repos/jefeish/policy-app/dependabot/alerts', {
  //   owner: context.payload.repository.owner.login,
  //   repo: context.payload.repository.name
  // })

  return response
}

/**
 * 
 * @param {*} app 
 * @param {*} context 
 */
async function runIssueReport(app, context, innersourceRequirements) {
  app.log.info("runIssueReport")
  jsonReport = {}

  report += "## License\n\n"

  report += "|STATUS|EXPECTED LICENSE|SET LICENSE|\n|---|---|---|\n"
  if (innersourceRequirements['license']) {
    report += await checkLicense(app, context, innersourceRequirements['license'])
  }

  report += "## Required Files\n\n"
  report += "|STATUS|FILE|LOCATION|\n|---|---|---|\n"

  let files = innersourceRequirements['files']
  for (let i = 0; i < files.length; i++) {
    report += await checkForFile(app, context, files[i])
  }

  if (innersourceRequirements['branch_protection_rules']) {
    report += await branch_protection(app, context, innersourceRequirements['branch_protection_rules'])
  }

  if (innersourceRequirements['dependabot_alert_check']) {
    report += await dependabot_alert_check(app, context)
  }

  return report
}

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app, { getRouter }) => {
  app.log.info("Yay, the app was loaded!");
  const yamlDoc = yaml.load(fs.readFileSync('src/sample-report.yml', "utf8"));
  const md = yaml2markdown(app, yamlDoc).then((md) => {
    app.log.info("..." + md)
  })

  // ADAPTER = app.

  // --------------------------------------------------------------------------
  app.on("issue_comment.created", async (context) => {
    app.log.info("issue_comment.created")
    const comment = context.payload.comment.body;
    report = ""
    app.log.info("issue_comment.created: " + util.inspect(context.payload))
    if ((comment.startsWith("/check") > -1) && (context.payload.comment.user.type == "User")) {
      app.log.info("check")
      await runIssueReport(app, context, innersourceRequirements)
      app.log.info("report: " + report)

      const issue = await context.octokit.rest.issues.createComment({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.issue.number,
        body: report,
      });
    }
    else {
      app.log.info("not check")
    }
  })

  // --------------------------------------------------------------------------
  app.on("repository.edited", async (context) => {

    innersourceRequirements = loadAppConfig(app)
    report = "# Innersource Ready Report\n\n"
    app.log.info("repository.edited");

    report += " An `Innersource Ready Report` has been generated for this repository. Please review the report and make any necessary changes. \n\nYou can re-run the report by creating an Issue-Comment with the content of `/check`\n\n\n"

    if (context.payload.changes.topics) {
      app.log.info("repository.edited");
      app.log.info("Topics changed");
      app.log.info("Topics: " + context.payload.repository.topics)

      await runIssueReport(app, context, innersourceRequirements)

      app.log.info("report: " + report)
      app.log.info("jsonReport: " + JSON.stringify(jsonReport))

      const issue = await context.octokit.rest.issues.create({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        title: 'Innersource Ready Report',
        body: report,
      });
    }
  });

  webUI = new ui(getRouter('/innersource-onboarding-app'))
  webUI.start()

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
