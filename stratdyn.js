module.exports = function(io) {
    const fs = require('fs');
    var _ = require('lodash');

    // read the admin credentials from file
    const adminCredentials = JSON.parse(
        fs.readFileSync('./data/adminCredentials.json')
    );

    // read the user credentials from file
    const userCredentials = JSON.parse(
        fs.readFileSync('./data/userCredentials.json')
    );

    // read the user credentials from file
    const experiment = JSON.parse(
        fs.readFileSync('./data/experiment.json')
    );

    // define space to save decisions
    experiment.decisions = {};
    Object.keys(experiment.assignments).forEach((user) => {
        experiment.decisions[user] = Array(experiment.tasks.length).fill(
            {"design": null, "strategy": null, "collabBelief": null}
        );
    });

    let currentTaskIndex = -3;

    let showMediator = false;
    let showRobot= true;

    let timestamp = Math.floor(new Date().getTime() / 1000);

    let taskLogFile = "task_trial" + '.csv';
    let preSurveyLogFile = "presurvey_trial" + '.csv';
    //let postSurveyLogFile = timestamp + '-post.csv';
    let postSurveyLogFile = "postsurvey_trial" + '.csv';
    let demographicsSurveyLogFile = "demographics_survey_trial" + '.csv';

    fs.writeFile(
        taskLogFile, 
        "timestamp" + "," + "username" + "," + "partner" + "," + "task" + "," + "design" + "," + "strategy" + "," + "collabBelief" + "\r\n",
        err => {
            if (err) {
                console.error(err);
            }
        }
    );

    fs.writeFile(
        preSurveyLogFile, 
        "timestamp" + "," + "username" + "," + "q1t2" + "," + "q2r3" + "," + "q3c1" + "," + "q4r2" + 
        "," + "q5t1" + "," + "q6r1" + "," + "q7c3" + "," + "q8t3" + "," + "q9c2" + "\r\n",
        err => {
            if (err) {
                console.error(err);
            }
        }
    );

    fs.writeFile(
        postSurveyLogFile, 
        "timestamp" + "," + "username" + "," + "q1c2" + "," + "q2r1" + "," + "q3t3" + "," + "q4r2" + 
        "," + "q5t1" + "," + "q6c3" + "," + "q7t2" + "," + "q8c1" + "," + "q9r3" + "\r\n",
        err => {
            if (err) {
                console.error(err);
            }
        }
    );

    fs.writeFile(
        demographicsSurveyLogFile, 
        "timestamp" + "," + "username" + "," + "demographics-survey-q1" + "," + "demographics-survey-q2"
         + "," + "demographics-survey-q3" + "," + "demographics-survey-q4" + 
        "," + "demographics-survey-q5" + "," + "demographics-survey-q63" + 
        "," + "demographics-survey-q7" + "\r\n",
        err => {
            if (err) {
                console.error(err);
            }
        }
    );


    // keep track of logged-in users and admins
    const users = {};
    const admins = {};

    // bind behavior to a new socket.io connection
    io.on('connection', (socket) => {
        // keep track of username
        var username = null;
        
        function showDesignTask(context) {
            // retrieve the current task and work with a cloned copy
            let task = JSON.parse(
                JSON.stringify(
                    experiment.tasks[experiment.assignments[username][currentTaskIndex]]
                )
            );
            task.partner = experiment.partners[username];
            // clone partner task to avoid circular reference
            task.partnerTask = JSON.parse(
                JSON.stringify(
                    experiment.tasks[experiment.assignments[task.partner][currentTaskIndex]]
                )
            );
            task.showMediator = showMediator;
            task.showRobot = showRobot;
            // compute the progress percentage
            task.progress = Math.round(100*(currentTaskIndex+1)/(experiment.tasks.length+1));
            // send a socket.io show design task
            context.emit('show-design-task', task);
        }

        function showWelcomeScreen(context) {
            // send a socket.io show welcome screen
            context.emit('show-welcome-screen');
        }

        function showDemographicsSurveyScreen(context) {
            // send a socket.io show demographics survey screen
            context.emit('show-demographics-survey-screen');
        }

        function showSurveyScreen(context) {
            // send a socket.io show survey screen
            context.emit('show-survey-screen');
        }

        function showPostSurveyScreen(context) {
            // send a socket.io show post survey screen
            context.emit('show-postsurvey-screen');
        }

        function showWaitScreen(context) {
            // send a socket.io show wait screen
            context.emit('show-wait-screen');
        }

        function showThankYouScreen(context) {
            // send a socket.io show thank you screen
            context.emit('show-thank-you-screen');
        }

        function showAdminScreen(context) {
            let decisions = {};
            Object.keys(experiment.decisions).forEach((user) => {
                if (currentTaskIndex >= 0 && currentTaskIndex < experiment.tasks.length) {
                    decisions[user] = {
                        "online": user in users,
                        "task": experiment.tasks[experiment.assignments[user][currentTaskIndex]].label,
                        "design": experiment.decisions[user][currentTaskIndex].design,
                        "strategy": experiment.decisions[user][currentTaskIndex].strategy
                    };
                } else {
                    decisions[user] = null;
                }
            });
            // send a socket.io show admin screen
            context.emit('show-admin-screen', {
                "progress": progress = Math.round(100*(currentTaskIndex+2)/(experiment.tasks.length+3)),
                "decisions": decisions
            });
        }

        function showContent(context) {
            if (username == null) {
                // if not logged in, show welcome screen
                showWelcomeScreen(context);
            } else if (username in admins) {
                // if admin logged in, show admin screen
                showAdminScreen(context);
            } else if (currentTaskIndex < -2) {
                // if not ready to start, show wait screen
                showWaitScreen(context);
            } else if (currentTaskIndex < -1) {
                // if not ready to start, show demographics survey screen
                showDemographicsSurveyScreen(context);
            } else if (currentTaskIndex < 0) {
                // if not ready to start, show survey screen
                showSurveyScreen(context)            
            } else if (currentTaskIndex < experiment.tasks.length) {
                // if incomplete, show next design task
                showDesignTask(context);
            } else if (currentTaskIndex == experiment.tasks.length) {
                // if complete, show next post survey
                showPostSurveyScreen(context);
            } else {
                // if complete, show thank you screen
                showThankYouScreen(context);
            }
        }

        // bind behavior to a socket.io login request
        socket.on('login-request', (request) => {
            // check if username and passcode patch admin or user credential
            if (
                request.hasOwnProperty('username') 
                && request.username in adminCredentials
                && request.hasOwnProperty('passcode')
                && request.passcode == adminCredentials[request.username]
            ) {
                // authentication successful; update the authenticated username
                username = request.username;
                // register admin socket
                admins[username] = socket;
            } else if (
                request.hasOwnProperty('username') 
                && request.username in userCredentials
                && request.hasOwnProperty('passcode')
                && request.passcode == userCredentials[request.username]
            ) {
                // authentication successful; update the authenticated username
                username = request.username;
                // register user socket
                users[username] = socket;
                // notify admins of new user
                Object.keys(admins).forEach(admin => {
                    showAdminScreen(admins[admin]);
                });
            } else {
                // authentication NOT successful
                username = null;
            }
            // send a socket.io login response message
            socket.emit('login-response', username);
            showContent(socket);
        });

        // bind behavior to a socket.io content request
        socket.on('content-request', () => {
            showContent(socket)
        });

        socket.on('submit-decision', (request) => {
            if (username != null) {
                // save the task decision
                experiment.decisions[username][currentTaskIndex].design = request.design;
                experiment.decisions[username][currentTaskIndex].strategy = request.strategy;

                console.log({
                    "user": username,
                    "design": request.design,
                    "strategy": request.strategy,
                });
                // notify admins of new decision
                Object.keys(admins).forEach(admin => {
                    showAdminScreen(admins[admin]);
                });
                let task = experiment.tasks[experiment.assignments[username][currentTaskIndex]];
                fs.appendFile(
                    taskLogFile, 
                    Date.now() + "," + username + "," + experiment.partners[username] + "," + task.label + "," + request.design + "," + request.strategy + "," + experiment.decisions[username][currentTaskIndex].collabBelief + "\r\n",
                    err => {
                        if (err) {
                          console.error(err);
                        }
                    }
                );
                // TODO change to log file
                console.log(
                    username + "\t"
                    + experiment.partners[username] + "\t"
                    + experiment.tasks[experiment.assignments[username][currentTaskIndex]].label + "\t"
                    + request.design + "\t"
                    + request.strategy + "\t"
                    + experiment.decisions[username][currentTaskIndex].collabBelief + "\t"
                )
            }
        });

        socket.on('submit-collabBelief', (request) => {
            if (username != null) {
                console.log({
                    "user": username,
                    "results": request
                });
                experiment.decisions[username][currentTaskIndex].collabBelief = request.collabBelief;
                // send the updated collab belief to the partner
                let partner = experiment.partners[username];
                if (partner != null) {
                    users[partner].emit(
                        "update-collab-belief", 
                        {"collabBelief": request.collabBelief}
                    );
                }
                console.log(request)
                console.log(username + "\t"
                + experiment.tasks[experiment.assignments[username][currentTaskIndex]].label + "\t"
                + request.collabBelief + "\t"
                )
            }
        });

        
        socket.on('submit-survey', (request) => {
            if (username != null) {
                console.log({
                    "user": username,
                    "results": request
                });
                console.log(request)
                // TODO change to log file
                console.log(
                    username + "\t" 
                    + request["q1t2"] + "\t" 
                    + request["q2r3"] + "\t"
                    + request["q3c1"] + "\t"
                    + request["q4r2"] + "\t"
                    + request["q5t1"] + "\t"
                    + request["q6r1"] + "\t"
                    + request["q7c3"] + "\t"
                    + request["q8t3"] + "\t"
                    + request["q9c2"]
                );

                fs.appendFile(
                    preSurveyLogFile, 
                    Date.now() + "," + username + "," + request["q1t2"] + "," + request["q2r3"] + 
                    "," +  request["q3c1"] + "," +request["q4r2"] + "," + request["q5t1"] + "," + 
                    "," + request["q6r1"] + "," + request["q7c3"] + "," + request["q8t3"]  + "," + 
                    request["q9c2"] +  "\r\n",
                    err => {
                        if (err) {
                          console.error(err);
                        }
                    }
                );
            }
        });


        socket.on('submit-postsurvey', (request) => {
            if (username != null) {
                console.log({
                    "user": username,
                    "results": request
                });
                console.log(request)
                // TODO change to log file
                console.log(
                    username + "\t" 
                    + request["q1c2"] + "\t" 
                    + request["q2r1"] + "\t"
                    + request["q3t3"] + "\t"
                    + request["q4r2"] + "\t"
                    + request["q5t1"] + "\t"
                    + request["q6c3"] + "\t"
                    + request["q7t2"] + "\t"
                    + request["q8c1"] + "\t"
                    + request["q9r3"]
                );
                fs.appendFile(
                    postSurveyLogFile, 
                    Date.now() + "," + username + "," + request["q1c2"] + "," + request["q2r1"] + 
                    "," +  request["q3t3"] + "," +request["q4r2"] + "," + request["q5t1"] + "," + 
                    "," + request["q6c3"] + "," + request["q7t2"] + "," + request["q8c1"]  + "," + 
                    request["q9r3"] +  "\r\n",
                    err => {
                        if (err) {
                          console.error(err);
                        }
                    }
                );
            }
        });

        socket.on('submit-demographics-survey', (request) => {
            if (username != null) {
                console.log({
                    "user": username,
                    "results": request
                });
                console.log(request)
                // TODO change to log file
                console.log(
                    username + "\t" 
                    + request["demographics-survey-q1"] + "\t" 
                    + request["demographics-survey-q2"] + "\t"
                    + request["demographics-survey-q3"] + "\t"
                    + request["demographics-survey-q4"] + "\t"
                    + request["demographics-survey-q5"] + "\t"
                    + request["demographics-survey-q6"] + "\t"
                    + request["demographics-survey-q7"] 
                );
                fs.appendFile(
                    demographicsSurveyLogFile, 
                    Date.now() + "," + username + "," + request["demographics-survey-q1"] + "," + 
                    request["demographics-survey-q2"] + "," +  request["demographics-survey-q3"] + 
                    "," +request["demographics-survey-q4"] + "," + request["demographics-survey-q5"] + 
                    ","  + request["demographics-survey-q6"] + "," + request["demographics-survey-q7"]  +  
                    "\r\n",
                    err => {
                        if (err) {
                          console.error(err);
                        }
                    }
                );
            }
        });

        // bind behavior to a socket.io logout request
        socket.on('logout-request', () => {
            if (username in users) {
                // remove user socket
                delete users[username];
            } else if (username in admins) {
                // remove admin socket
                delete admins[username];
            }
            // reset the username
            username = null;
            // send a socket.io logout response
            socket.emit('logout-response');
            // show the next content
            showContent(socket);
            // notify admins of logout
            Object.keys(admins).forEach(admin => {
                showAdminScreen(admins[admin]);
            });
        });

        // bind behavior to a socket.io return prev task
        socket.on('return-prev', () => {
            if (username in admins && currentTaskIndex >= -1) {
                // increment the current task index
                currentTaskIndex -= 1;
                // request all clients to update content
                io.emit("update-content");
            }
        });

        // bind behavior to a socket.io advance next task
        socket.on('advance-next', () => {
            if (username in admins && currentTaskIndex < experiment.tasks.length+1) {
                // increment the current task index
                currentTaskIndex += 1;
                // request all clients to update content
                io.emit("update-content");
            }
        });
    });
};