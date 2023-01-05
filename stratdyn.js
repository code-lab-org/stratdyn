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
    const tasks = JSON.parse(
        fs.readFileSync('./data/experimentTasks.json')
    );

    // keep track of task progression
    const tasksCompleted = {};

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
            let task = tasks[currentTaskIndex];
            // compute the progress percentage
            task.progress = Math.round(100*(currentTaskIndex+1)/tasks.length);
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
            // send a socket.io show admin screen
            context.emit('show-admin-screen', {
                "progress": progress = Math.round(100*(currentTaskIndex+1)/tasks.length),
                "users": Object.keys(users),
                "admins": Object.keys(admins)
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
            } else if (currentTaskIndex < tasks.length) {
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
                // ensure user has an entry in tasks completed
                if (! (username in tasksCompleted) ) {
                    tasksCompleted[username] = 0;
                }
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

        socket.on('submit-design-request', (request) => {
            if (username != null) {
                // increment the number of tasks completed by this user
                tasksCompleted[username] += 1;
                // record the user
                request.username = username;
                console.log(request);
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

        // bind behavior to a socket.io advance next task
        socket.on('advance-next-task', () => {
            if (username in admins) {
                // increment the current task index
                currentTaskIndex += 1;
                // request all clients to update content
                io.emit("update-content");
            }
        });
    });
};