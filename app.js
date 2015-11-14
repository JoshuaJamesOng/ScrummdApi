var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var loki = require('lokijs');

/**
 * Database
 */
var db = new loki('loki.json');
var activeIssue;
var issues;
var estimates;

var load = function () {
    db.loadDatabase({}, function () {
        console.log('load dbs');
        issues = db.getCollection('issues');

        estimates = db.getCollection('estimates');
        create(!issues, !estimates);
        getActiveIssue();
    });
};

var create = function (createIssues, createEstimates) {
    if (createIssues) {
        issues = db.addCollection('issues');
        console.log('created issues');
    }
    if (createEstimates) {
        estimates = db.addCollection('estimates');
        console.log('created estimates');
    }
};

var save = function () {
    db.saveDatabase();
    console.log('save dbs');
};

var getActiveIssue = function() {
    var result = issues.find({active: true});
    if (result.length > 0) {
        activeIssue = result[0];
        console.log('active issue restored');
    } else {
        console.log('No active issue');
    }
};


/**
 * Handlers
 */
var createIssue = function (req, res) {
    // Check for identifier
    var issue = req.body.issue;
    if (!issue) {
        return res.sendStatus(400);
    }

    // Check it doesn't already exist
    var results = issues.find({issue: issue});
    if (results.length > 0) {
        return res.sendStatus(409);
    }

    // Create issue
    var model = issueModel(issue, false, null);
    issues.insert(model);
    res.json(model);
};

var updateIssue = function (req, res) {
    // Check for identifier
    var issue = req.body.issue;
    if (!issue) {
        return res.sendStatus(400);
    }

    // Find issue
    var results = issues.find({issue: issue});
    if (results.length != 1) {
        return res.sendStatus(404);
    }

    // Update issue
    var model = results[0];
    model.active = !model.active;
    issues.update(model);

    if (model.active) {
        activeIssue = model;
    } else {
        activeIssue = undefined;
    }
    res.json(model);
};

var deleteIssue = function (req, res) {
    // Check for identifier
    var issue = req.body.issue;
    if (!issue) {
        return res.sendStatus(400);
    }

    // Find issue
    var results = issues.find({issue: issue});
    if (results.length != 1) {
        return res.sendStatus(404);
    }

    // Delete issue
    var model = results[0];
    issues.remove(model);
    res.json(model);
};

var getIssue = function (req, res) {
    // Check for identifier
    var issue = req.params.issue;
    if (!issue) {
        return res.sendStatus(400);
    }

    // Find issue
    var result = estimates.find({issue: issue});
    console.log(result);
    if (result.length < 1) {
        res.sendStatus(400);
    }

    // Return result
    res.json(result);
};

var submitEstimate = function (req, res) {
    // Check for session
    if (!activeIssue) {
        return res.sendStatus(404);
    }

    // Check for fields
    var estimate = req.body.estimate;
    var user = req.body.user;
    if (!estimate || !user) {
        return res.sendStatus(400);
    }

    // Update or create new estimate
    var results = estimates.find({'$and': [{user: user}, {issue: activeIssue.issue}]});
    var model = null;
    if (results.length == 1) {
        model = results[0];
        model.estimate = estimate;
        estimates.update(model);
    } else {
        model = estimateModel(user, estimate, activeIssue.issue);
        estimates.insert(model);
    }
    res.json(model);
};


/**
 * Models
 */
var estimateModel = function (user, estimate, issue) {
    return {user: user, estimate: estimate, issue: issue};
};

var issueModel = function (issue, active, estimates) {
    return {issue: issue, active: active, estimates: estimates};
};


/**
 * Config
 */
app.use(bodyParser.urlencoded({extended: true}));


/**
 * Routing
 */
app.route('/scrummd/issue').post(createIssue).put(updateIssue).delete(deleteIssue);
app.route('/scrummd/issue/:issue').get(getIssue);
app.route('/scrummd/estimate').post(submitEstimate);


/**
 * Server
 */

var server = app.listen(3000, function () {
    console.log('Scrummd api started');
    load();
});

// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
var gracefulShutdown = function() {
    console.log("Received kill signal, shutting down gracefully.");

    save();

    server.close(function() {
        console.log("Closed out remaining connections.");
        process.exit()
    });

    // if after
    setTimeout(function() {
        console.error("Could not close connections in time, forcefully shutting down");
        process.exit()
    }, 10*1000);
};

// listen for TERM signal .e.g. kill
process.on ('SIGTERM', gracefulShutdown);

// listen for INT signal e.g. Ctrl-C
process.on ('SIGINT', gracefulShutdown);