module.exports = function(io) {
    const fs = require('fs');

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
            {"design": null, "strategy": null}
        );
    });

    let currentTaskIndex = -1;

    // keep track of logged-in users and admins
    const users = {};
    const admins = {};

    // bind behavior to a new socket.io connection
    io.on('connection', (socket) => {
        // keep track of username
        var username = null;
        
        function showDesignTask(context) {
            // retrieve the current task
            let task = experiment.tasks[experiment.assignments[username][currentTaskIndex]];
            // compute the progress percentage
            task.progress = Math.round(100*(currentTaskIndex+1)/(experiment.tasks.length+1));
            // send a socket.io show design task
            context.emit('show-design-task', task);
        }

        function showWelcomeScreen(context) {
            // send a socket.io show welcome screen
            context.emit('show-welcome-screen');
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
                "progress": progress = Math.round(100*(currentTaskIndex+1)/(experiment.tasks.length+1)),
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
            } else if (currentTaskIndex < 0) {
                // if not ready to start, show wait screen
                showWaitScreen(context);
            } else if (currentTaskIndex < experiment.tasks.length) {
                // if incomplete, show next design task
                showDesignTask(context);
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
                experiment.decisions[username][currentTaskIndex] = {
                    "design": request.design,
                    "strategy": request.strategy,
                }
                // notify admins of new decision
                Object.keys(admins).forEach(admin => {
                    showAdminScreen(admins[admin]);
                });
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
            if (username in admins && currentTaskIndex >= 0) {
                // increment the current task index
                currentTaskIndex -= 1;
                // request all clients to update content
                io.emit("update-content");
            }
        });

        // bind behavior to a socket.io advance next task
        socket.on('advance-next', () => {
            if (username in admins && currentTaskIndex < experiment.tasks.length) {
                // increment the current task index
                currentTaskIndex += 1;
                // request all clients to update content
                io.emit("update-content");
            }
        });
    });
};