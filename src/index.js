
const ui = require('./ui/innersourceUI.js')
const fs = require('fs')
const yaml = require('js-yaml')

/**
 * This function loads the app configuration from the file system
 * @param {*} app 
 */
function loadAppConfig(app) {
  try {
    // eslint-disable-next-line no-path-concat
    const configData = fs.readFileSync('./src/innersource-checklist.yml', 'utf8')
    jsonConfig = JSON.parse(JSON.stringify(yaml.load(configData), null, 4))

    app.log.info('Loading App Config file')
  } catch (err) {
    console.error('Error loading App Config file: ', err)
  }
}

/**
 * This is the main entrypoint to your Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app, { getRouter })=> {
  // Your code here
  app.log.info("Yay, the app was loaded!");

  loadAppConfig(app)
  
  app.on("repository.edited", async (context) => {
    app.log.info("repository.edited");
    if (context.payload.changes.topics) {
      app.log.info("Topics changed");
      app.log.info("Topics: " + context.payload.repository.topics)
    }
  });


  webUI = new ui(getRouter('/innersource-onboarding-app'))
  webUI.start()

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
