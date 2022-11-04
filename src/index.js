
const ui = require('./ui/innersourceUI.js')
const fs = require('fs')
const yaml = require('js-yaml')
const util = require('util')
const { json } = require('express')
const adapter = require('./adapters/sampleAdapter.js')

let innersourceRequirements = {}
const status = ['"+ white_check_mark +"', ':warning:']
const check_mark = "<img width='14' alt='check' src='https://user-images.githubusercontent.com/863198/194782472-79f7d7b0-2af0-4712-b3d0-01f64f99f785.png'></img>"
const warning = "<img  width='14' alt='warning' src='https://user-images.githubusercontent.com/863198/199776742-888ece59-7e88-46f4-94b6-69314505cf90.png'></img>"

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
 * @description This function transforms the YAML report into a Markdown report
 * @param {*} yaml
 * @returns markdown
 */
async function toMarkdown(context, data) {
  let markdown = ""

  // list each 'top-level' element (name)
  Object.keys(data).forEach(async (name) => {
    // don't add the 'meta-data' information to the markdown
    if (name !== "meta") {
      mdName = name.replace(/_/g, " ").toUpperCase()
      context.log.debug("name: " + mdName)
      markdown += "\n\n---\n\n"
      markdown += "### " + mdName + "\n\n"
      context.log.debug("typeof: " + typeof data[name])

      // check the object type of each element
      if (typeof data[name] == "object") {
        if (data[name] instanceof Array) {
          arr = data[name]
          for (let i = 0; i < arr.length; i++) {
            if (arr[i].compliant == true) {
              markdown += "" + check_mark + " **" + arr[i].name + "**\n"
            } else {
              markdown += "" + warning + " " + arr[i].name + "\n"
            }
          }
          markdown += "\n\n"
        } else { // it must be an 'normal' object
          // Object.keys(data[name]).forEach(async (a) => {
          if (name == "license") {
            if (data.license.compliant == true) {
              markdown += check_mark + " License Type: **" + data.license.name + "**\n\n"
            } else {
              markdown += warning + " License Type: " + data.license.name + "\n\n"
            }
          }
          // })
          markdown += "\n\n"
        }
      }

      if (typeof data[name] == "number") {
        if (name == "health") {
          if (data[name] < 100) {
            markdown += warning + " Status: " + data[name] + " % \n\n"
          } else {
            markdown += check_mark + " Status:  **" + data[name] + " %**\n\n"
          }
        } else {
          markdown += name + ": " + data[name] + "\n\n"
        }
      }

      if (typeof data[name] == "string") {
        markdown += data[name] + "\n\n"
      }
    } else {
      context.log.debug("Ignore the meta-data")
    }
  })

  markdown += "\n\n---\n\n"
  markdown += "<details><summary>Details</summary><p>\n\n```\n" + JSON.stringify(data, null, 4) + "\n```\n\n</p></details>"

  return markdown
}

/** ---------------------------------------------------------------------------
 * @description check if the repository has the required License
 * @param {*} app 
 * @returns
 */
async function checkLicense(app, context, license) {
  app.log.info("checkLicense")
  let jsonSectionReport = JSON.parse("{}")
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
    context.log.error(err)
  }

  license.indexOf(repoLicense.data.license.spdx_id) > -1 ? hasLicense = true : hasLicense = false

  jsonSectionReport.license = {}
  jsonSectionReport.license.name = repoLicense.data.license.name
  jsonSectionReport.license.key = repoLicense.data.license.key
  jsonSectionReport.license.spdx_id = repoLicense.data.license.spdx_id
  jsonSectionReport.license.compliant = hasLicense
  context.log.debug("checkLicense: " + JSON.stringify(jsonSectionReport))

  return jsonSectionReport
}

/** ---------------------------------------------------------------------------
 * @description This function checks if the repository has the required files
 * @param {*} app 
 */
async function checkForFiles(app, context, files) {
  app.log.info("checkForFiles")
  let jsonSectionReport = JSON.parse("{}")
  let response
  let compliant
  jsonSectionReport.files = []

  for (let i = 0; i < files.length; i++) {
    let fileObject = JSON.parse("{}")

    // Check if the file exists in the 'root' location
    response = await checkContent(app, context, files[i])

    if (response == 200) {
      compliant = true
    } else {
      // Check if the file exists in the '.github' location
      response = await checkContent(app, context, ".github/" + files[i])

      if (response == 200) {
        compliant = true
      } else {
        compliant = false
      }
    }
    fileObject.name = files[i]
    fileObject.compliant = compliant
    jsonSectionReport.files[i] = fileObject
  }
  context.log.debug("checkForFiles: " + JSON.stringify(jsonSectionReport))
  return jsonSectionReport
}

/** ---------------------------------------------------------------------------
 * @description Generic function to check if a file exists at a location in 
 *              the repository 
 * @param {*} fileName 
 * @returns status (200, 404 ...)
 */
async function checkContent(app, context, fileName) {
  context.log.debug("checkContent: >" + fileName + "<")
  let file

  try {
    file = await context.octokit.repos.getContent(
      {
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        path: fileName
      }
    );

  } catch (err) {
    context.log.error(err.status)
    return err.status
  }

  return file.status
}

/** ---------------------------------------------------------------------------
 * @description Check Branch-Protection compliance
 * @param {*} app
 * @param {*} context
 * @param branch_protection_rules
 */
async function branchProtection(app, context, branch_protection_rules) {
  app.log.info("Branch Protection")

  let index = 0
  let jsonSectionReport = JSON.parse("{}")
  jsonSectionReport.branch_protection = []

  const result = await context.octokit.graphql(
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

  // app.log.info("Branch Protection:" + util.inspect(result.repository.branchProtectionRules.nodes[0]))

  Object.keys(branch_protection_rules).forEach(async (ruleName) => {
    let branchProtectionObject = JSON.parse("{}")
    branchProtectionObject.name = ruleName
    branchProtectionObject.value = result.repository.branchProtectionRules.nodes[0][ruleName]
    branchProtectionObject.expected = branch_protection_rules[ruleName]

    if (branch_protection_rules[ruleName] == result.repository.branchProtectionRules.nodes[0][ruleName]) {
      branchProtectionObject.compliant = true
    }
    else {
      branchProtectionObject.compliant = false
    }

    jsonSectionReport.branch_protection[index] = branchProtectionObject
    index += 1
  })
  context.log.debug("branch_protection: " + JSON.stringify(jsonSectionReport))
  return jsonSectionReport
}

/** ---------------------------------------------------------------------------
 * 
 * @param {*} app 
 */
async function dependabot_alert_check(app, context) {
  app.log.info("Dependabot Alert Check")
  let jsonSectionReport = JSON.parse("{}")
  jsonSectionReport.dependabot_alert_check = []

  // const alerts = await context.octokit.rest.dependabot.listAlertsForRepo({
  //   owner: context.payload.repository.login,
  //   repo: context.payload.repository.name,
  // });

  // context.log.info("alerts: "+ util.inspect(alerts))
  
  jsonSectionReport.dependabot_alert_check[0] = "{ \"name\": TBD }"

  return jsonSectionReport
}

/**
 * @description run the compliance checks
 * @param {*} app 
 * @param {*} context 
 */
async function runComplianceChecks(app, context, innersourceRequirements) {
  app.log.info("runComplianceChecks")
  let res1, res2, res3, res4
  let jsonReport = JSON.parse("{}")
  let jsonReportMeta = JSON.parse("{}")
  context.log.info("META: " + util.inspect(context.payload.repository.name))
  jsonReportMeta.org = context.payload.organization.login
  jsonReportMeta.repo = context.payload.repository.name
  jsonReportMeta.owner = context.payload.repository.owner
  jsonReportMeta.full_name = context.payload.repository.full_name
  jsonReport.meta = jsonReportMeta

  jsonReport.description = "Report for Innersource compliance.\nTo re-run this report use the **slash command:** `/check`\n\n"

  if (innersourceRequirements['license']) {
    res1 = await checkLicense(app, context, innersourceRequirements['license'])
    jsonReport.license = res1.license
  }

  if (innersourceRequirements['files']) {
    res2 = await checkForFiles(app, context, innersourceRequirements['files'])
    jsonReport.files = res2.files
  }

  if (innersourceRequirements['branch_protection_rules']) {
    res3 = await branchProtection(app, context, innersourceRequirements['branch_protection_rules'])
    jsonReport.branch_protection = res3.branch_protection
  }

  if (innersourceRequirements['dependabot_alert_threshold']) {
    res4 = await dependabot_alert_check(app, context)
    jsonReport.dependabot_alert_check = res4.dependabot_alert_check
  }

  // poor man's way to count the compliance %
  const t = JSON.stringify(jsonReport).split("\"compliant\"").length - 1
  const v = JSON.stringify(jsonReport).split("\"compliant\":true").length - 1
  const h = (v / t * 100) | 0
  jsonReport.health = h

  context.log.debug("Final report: " + JSON.stringify(jsonReport))

  // ---------------------------------------------------------------------------

  adapter.execute(context, jsonReport)

  // ---------------------------------------------------------------------------

  return jsonReport
}

// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// -----------------------------------------------------------------------------

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app, { getRouter }) => {
  app.log.info("Yay, the app was loaded!");

  // --------------------------------------------------------------------------
  app.on("issue_comment.created", async (context) => {

    const comment = context.payload.comment.body
    innersourceRequirements = loadAppConfig(app)

    app.log.info("issue_comment.created: " + util.inspect(context.payload))
    if ((comment.startsWith("/check") > -1) && (context.payload.comment.user.type == "User")) {

      const report = await runComplianceChecks(app, context, innersourceRequirements)

      const issue = await context.octokit.rest.issues.createComment({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.issue.number,
        body: await toMarkdown(context, report),
      });
    }
    else {
      app.log.info("not check")
    }
  })

  // --------------------------------------------------------------------------
  app.on("repository.edited", async (context) => {

    innersourceRequirements = loadAppConfig(app)

    if (context.payload.changes.topics) {
      app.log.info("repository.edited");
      app.log.info("Topics changed");
      app.log.info("Topics: " + context.payload.repository.topics)

      const report = await runComplianceChecks(app, context, innersourceRequirements)

      app.log.debug("report: " + util.inspect(JSON.stringify(report)))
      app.log.debug("MD: " + await toMarkdown(context, report))

      const issue = await context.octokit.rest.issues.create({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        title: 'Innersource Ready Report',
        body: await toMarkdown(context, report),
      });
    }
  });

  webUI = new ui(getRouter('/innersource-onboarding-app'))
  webUI.start()

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
}