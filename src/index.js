
const ui = require('./ui/innersourceUI.js')
const fs = require('fs')
const yaml = require('js-yaml')
const util = require('util')
let innersourceRequirements = {}
let report = ""

/**
 * This function loads the app configuration from the file system
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

/**
 * Generic function to check if a file exists in the repository
 * @param {*} fileName 
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

    let buff = Buffer.from(file.data.content, 'base64');
    let text = buff.toString('utf-8');

    response = text
  } catch (err) {
    response = err.status
  }

  return response
}

/**
 * 
 * @param {*} app 
 */
async function checkForFile(app, context, fileName) {
  app.log.info("checkForFile: " + fileName)
  let response
  let line

  response = await checkContent(app, context, fileName)
  if (response == "404") {
    response = await checkContent(app, context, ".github/" + fileName)
    if (response == "404") {
      response = "|:warning:| " + fileName + "| File Not found |\n"
    } else {
      line = response
      response = "|:white_check_mark:| " + fileName + "| .github/" + fileName + " |\n"
    }
  }
  else {
    line = response
    response = "|:white_check_mark:|" + fileName + "| /" + fileName + "|\n"
  }

  return response
}

/**
 * 
 * @param {*} app 
 */
async function branch_protection(app, context, branch_protection_rules) {
  app.log.info("Branch Protection:" + util.inspect(branch_protection_rules))
  let response = "\n\n## Branch Protection Rules (default branch)\n\n"
  response += "|STATUS|RULE|EXPECTED|FOUND|\n|---|---|---|---|\n"

  Object.keys(branch_protection_rules).forEach(async (ruleName) => {
    response += "|:white_check_mark:|" + ruleName + "|" + branch_protection_rules[ruleName] + "||\n"
    app.log.info("rule:" + branch_protection_rules[ruleName])
  })

  return response
}

/**
 * 
 * @param {*} app 
 */
async function dependabot_alert_check(app, context) {
  app.log.info("Dependabot Alert Check")
  let response = "\n\n## Dependabot Alerts\n\n"
  return response
}

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app, { getRouter }) => {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  app.on("repository.edited", async (context) => {

    innersourceRequirements = loadAppConfig(app)
    report = "# Innersource Ready Report\n\n## Required Files\n\n"
    app.log.info("repository.edited");

    if (context.payload.changes.topics) {
      app.log.info("repository.edited");
      app.log.info("Topics changed");
      app.log.info("Topics: " + context.payload.repository.topics)

      report += "\n\n|STATUS|FILE|LOCATION|\n|---|---|---|\n"
      if (innersourceRequirements['license']) {
        report += await checkForFile(app, context, "LICENSE")
      }

      if (innersourceRequirements['code_of_conduct'] === true) {
        report += await checkForFile(app, context, "CODE_OF_CONDUCT")
      }

      if (innersourceRequirements['codeowners'] === true) {
        report += await checkForFile(app, context, "CODEOWNERS")
      }

      if (innersourceRequirements['contributing'] === true) {
        report += await checkForFile(app, context, "CONTRIBUTING")
      }

      if (innersourceRequirements['readme'] === true) {
        report += await checkForFile(app, context, "README.md")
      }

      if (innersourceRequirements['branch_protection_rules']) {
        report += await branch_protection(app, context, innersourceRequirements['branch_protection_rules'])
      }

      if (innersourceRequirements['dependabot_alert_check'] === true) {
        report += await dependabot_alert_check(app, context)
      }

      app.log.info("report: " + report)

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
