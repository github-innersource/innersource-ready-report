/**
 * @description A very simple UI interface, nothing is optimized.
 */

const fs = require('fs')
const hbs = require('handlebars')
const yaml = require('js-yaml')
const util = require('util')
const favicon = require('serve-favicon');

let path = require('path');
const express = require('express')

class policyUI {

    // eslint-disable-next-line no-useless-constructor
    constructor(router, webPath) {
        // Get an express router to expose new HTTP endpoints
        this.router = router;
        this.webPath = webPath
    }
    
    start() {
        // Use any middleware 
        this.router.use('/public', express.static(path.join(__dirname, 'public')))
        this.router.use('/js', express.static(path.join(__dirname, '../../node_modules/jquery/dist')))
        this.router.use('/js', express.static(path.join(__dirname, '../../node_modules/bootstrap/dist/js')))
        this.router.use('/js', express.static(path.join(__dirname, '../../node_modules/bootstrap/fonts')))
        this.router.use('/js', express.static(path.join(__dirname, '../../node_modules/bootstrap-autocomplete/dist/latest')))
        this.router.use('/css', express.static(path.join(__dirname, '../../node_modules/bootstrap/dist/css')))
        this.router.use(favicon(__dirname + '/public/favicon.ico'));

        // Add a new route
        this.router.get("/", (req, res) => {
            fs.readFile(__dirname + '/templates/index.hbs', 'utf8', (err, tpl) => {
                if (err) {
                    console.error(err)
                    return
                }

                var header = fs.readFileSync(__dirname + '/templates/header.html', 'utf8');
                var template = hbs.compile(tpl);
                var data = {
                    "header": header
                };
                var result = template(data);
                res.send(result)
            });
        })

        // Add a new route
        // this.router.get("/newRoute", (req, res) => {
        //     fs.readFile(__dirname + '/templates/newRoute.hbs', 'utf8', (err, tpl) => {
        //         if (err) {
        //             console.error(err)
        //             return
        //         }

        //         var header = fs.readFileSync(__dirname + '/templates/header.html', 'utf8');
        //         var template = hbs.compile(tpl)
        //         var data = {
        //             "header": header
        //         }
        //         res.send(template(data))
        //     })
        // })
    }
}

module.exports = policyUI
