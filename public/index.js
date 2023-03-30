$(document).ready(function() {
    // establish socket.io connection
    var socket = io();

    // bind behavior to clicks on table row (tr) elements contained within the design table body
    $("#design tbody").on("click", "tr", (event) => {
        if (
            !$("#design .spinner-border").hasClass("d-none") 
            || !$("#collabBelief").prop("disabled")
        ) {
            // do not make changes if waiting
            return;
        }
        if ($(event.currentTarget).hasClass("table-active")) {
            // clicked row is currently marked as "active"; deactivate it
            $(event.currentTarget).removeClass("table-active");
            // disable the design submission button
            $("#design-button").prop("disabled", true);
            // remove the background from collaborative and individual icons
            $("#design-collaborative, #design-individual").removeClass("bg-warning-subtle");
        } else {
            // deactivate all sibling rows of the clicked row
            $(event.currentTarget).siblings().removeClass("table-active");
            // activate clicked row
            $(event.currentTarget).addClass("table-active");
            // enable the design submission button
            $("#design-button").prop("disabled", false);
            if($(event.currentTarget).data("strategy") == "collaborative") {
                // add the background to the collaborative icon
                $("#design-collaborative").addClass("bg-warning-subtle");
                // remove the background from the individual icon
                $("#design-individual").removeClass("bg-warning-subtle");
            } else {
                // remove the background from the collaborative icon
                $("#design-collaborative").removeClass("bg-warning-subtle");
                // add the background to the individual icon
                $("#design-individual").addClass("bg-warning-subtle");
            }
        }
    });

    // bind behavior to clicks on robot
    $("#robot-button").on("click", () => {
        // currentDesignTask.options[$(event.currentTarget).index()].upside
        // currentDesignTask.options[$(event.currentTarget).index()].downside
        // currentDesignTask.options[3].upside
        // currentDesignTask.options[3].downside
        let stagUpside = parseInt(currentDesignTask.options[0].upside, 10)
        let stagDownside = parseInt(currentDesignTask.options[0].downside, 10)
        let hareUpside = parseInt(currentDesignTask.options[3].upside, 10)
        let hareDownside = parseInt(currentDesignTask.options[3].downside, 10)
        let normDevLossMath = ((hareUpside - stagDownside)/(hareUpside - stagDownside + stagUpside - hareDownside)*100)
        let normDevLoss = normDevLossMath.toFixed(0)
        $("#robot-modal .modal-body p").text(
            "Minimum required probability for collaboration= " + " " + "%" + normDevLoss  + 
            " and your partner's estimated sentiment towards collaboration= " + "%" + partnerCollabBelief
        );
        $("#robot-modal").modal("show");
        console.log(currentDesignTask);
    });


    // bind behavior to login form submissions
    $("#login-form").on("submit", (event) => {
        // send a socket.io login request with the username and passcode
        socket.emit("login-request", { "username": $("#username-input").val(), "passcode": $("#passcode-input").val() });
        // bypass the default form submission process
        event.preventDefault();
    });

    // bind behavior to the socket.io login response
    socket.on("login-response", (username) => {
        if (username) {
            // response contains a valid username; user is logged in
            // unset invalid flags on form inputs
            $("#username-input, #passcode-input").removeClass("is-invalid");
            // hide the login button
            $("#login-button").addClass("d-none");
            // unhide the logout text
            $("#logout-text").removeClass("d-none");
            // set the logout text to the logged-in username
            $("#logout-username").text(username);
            // hide the login modal dialog
            $("#login-modal").modal('hide');
        } else {
            // response does NOT contain a valid username; user is not logged in
            // set invalid flags on form inputs
            $("#username-input, #passcode-input").addClass("is-invalid");
        }
    });

    // bind behavior to clicks on the logout link
    $("#logout-username").on("click", () => {
        // send a socket.io request to logout
        socket.emit("logout-request");
    });

    // bind behavior to clicks on the design button
    $("#design-button").on("click", () => {
        // show spinner on button and update text
        $("#design .spinner-border").removeClass("d-none");
        $("#design .design-button-label").text("Waiting...");
        // disable editing and remove table hover
        $("#design-button").prop("disabled", true);
        $("#design table").removeClass("table-hover");
        // send a socket.io request to submit the design
        socket.emit("submit-decision", {
            "task": $("#design .task-label").text(),
            "design": $("#design .table-active .design-label").text(),
            "strategy": $("#design .table-active").data("strategy"),
            "upside": parseInt($("#design .table-active .design-upside").text()),
            "downside": parseInt($("#design .table-active .design-downside").text()),
        });
    });

    var currentDesignTask = null;

    // bind behavior to the socket.io show design task
    socket.on("show-design-task", (response) => {
        // hide the welcome, admin, wait, and thank-you screens
        $("#welcome, #admin, #wait, #thank-you, #main-survey, #demographics-survey, #main-postsurvey").collapse("hide");
        // show the design interface
        $("#design").collapse("show");
        // hide spinner on button and update text
        $("#design .spinner-border").addClass("d-none");
        $("#design .design-button-label").text("Confirm Decision");
        // remove active status from any table rows
        $("#design tbody tr").removeClass("table-active");
        // remove background from collaborative and individual icons
        $("#design-collaborative, #design-individual").removeClass("bg-warning-subtle");
        // enable the design button and enable table hover
        $("#design-button").prop("disabled", true);
        $("#design table").addClass("table-hover");
        // enable slider and button
        $("#collabBelief-form button:submit").prop("disabled", false);
        $("#collabBelief").prop("disabled", false);
        // disable editing and remove table hover
        $("#design-button").prop("disabled", true);
        $("#design table").removeClass("table-hover");
        // disable robot button
        $("#robot-button").prop("disabled", true);
        // reset partner collab belief value
        if(response.showRobot) {
            $("#robot").removeClass("d-none");
        } else {
            $("#robot").addClass("d-none");
        }
        partnerCollabBelief = null;

        // set the progress bar to the correct value
        $("#design .progress").attr("aria-valuenow", response.progress);
        $("#design .progress-bar").css("width", response.progress + "%");

        // set the task label
        $("#design .task-label").text(response.label);

        // save the current design task
        currentDesignTask = response;

        // update the design attributes for each option
        $("#design tbody tr").each((index, element) => {
            let option = response.options[index];
            $(element).find(".design-label").html(option.label.replace(" ", "&nbsp;"));
            $(element).find("img").attr("src", "images/" + option.image + ".png");
            $(element).find(".design-upside").text(option.upside);
            $(element).find(".design-downside").text(option.downside);
        });
    });


    // bind behavior to collabBelief slider form submissions
    $("#collabBelief-form").on("submit", (event) => {
        // send a socket.io collabBelief survey submit with the responses
        socket.emit("submit-collabBelief", {
            "collabBelief": parseInt($("#collabBelief").val()),
        });
        $("#collabBelief-form button:submit").prop("disabled", true);
        //$("#collabBelief-form button:submit .spinner-border").removeClass("d-none");
        // disable collabBelief slider after click to submission button
        $("#collabBelief").prop("disabled", true);
        // enable editing and remove table hover
        $("#design-button").prop("disabled", false);
        $("#design table").addClass("table-hover");
        if(partnerCollabBelief !== null) {
            // enable robot button
            $("#robot-button").prop("disabled", false);
        }
        // bypass the default form submission process
        event.preventDefault();
    });

    var partnerCollabBelief = null;

    // bind behavior to the socket.io show design task
    socket.on("update-collab-belief", (response) => {
        partnerCollabBelief = response.collabBelief;
        console.log(response.collabBelief);
        if($("#collabBelief").prop("disabled")) {
            // enable robot button
            $("#robot-button").prop("disabled", false);
        }
    });

    // bind behavior to clicks on the logout link
    $("#next-button").on("click", () => {
        // send a socket.io request to advance to the next task
        socket.emit("advance-next");
    });

    // bind behavior to clicks on the logout link
    $("#prev-button").on("click", () => {
        // send a socket.io request to advance to the next task
        socket.emit("return-prev");
    });

    // bind behavior to the socket.io logout response
    socket.on("logout-response", () => {
        // show the login button
        $("#login-button").removeClass("d-none");
        // hide the logout text
        $("#logout-text").addClass("d-none");
        // reset the logout username to blank
        $("#logout-username").text("");
    });

    // bind behavior to the socket.io show welcome screen
    socket.on("show-welcome-screen", (response) => {
        // hide the wait, design and thank you screens
        $("#admin, #wait, #design, #thank-you, #main-survey, #main-postsurvey, #demographics-survey").collapse("hide");
        // show the welcome screen
        $("#welcome").collapse("show");
    });

    // bind behavior to the socket.io show demographics survey screen
    socket.on("show-demographics-survey-screen", (response) => {
        // hide the wait, design and thank you and main survey screens
        $("#admin, #wait, #design, #thank-you, #welcome, #main-survey, #main-postsurvey").collapse("hide");
        $("#demographics-survey-form input").prop("disabled", false);
        $("#demographics-survey-form button:submit").prop("disabled", false);
        $("#demographics-survey-form button:submit .spinner-border").addClass("d-none");
        // show the demographics survey screen
        $("#demographics-survey").collapse("show");
    });

    // bind behavior to demographics survey form submissions
    $("#demographics-survey-form").on("submit", (event) => {
        // send a socket.io demographics survey submit with the responses
        socket.emit("submit-demographics-survey", {
            "demographics-survey-q1": $("input:radio[name=demographics-survey-q1]:checked").val(),
            "demographics-survey-q2": $("#demographics-survey-q2").val(),
            "demographics-survey-q3": $("#demographics-survey-q3").val(),
            "demographics-survey-q4": $("#demographics-survey-q3").val(),
            "demographics-survey-q5": $("#demographics-survey-q3").val(),
            "demographics-survey-q6": $("input:radio[name=demographics-survey-q6]:checked").val(),
            "demographics-survey-q7": $("input:radio[name=demographics-survey-q7]:checked").val()
        });
        $("#demographics-survey-form button:submit").prop("disabled", true);
        $("#demographics-survey-form button:submit .spinner-border").removeClass("d-none");
        // bypass the default form submission process
        event.preventDefault();
    });


    // bind behavior to the socket.io show survey screen
    socket.on("show-survey-screen", (response) => {
        // hide the wait, design and thank you screens
        $("#admin, #wait, #design, #thank-you, #welcome, #demographics-survey, #main-postsurvey").collapse("hide");
        $("#survey-form input").prop("disabled", false);
        $("#survey-form button:submit").prop("disabled", false);
        $("#survey-form button:submit .spinner-border").addClass("d-none");
        // show the welcome screen
        $("#main-survey").collapse("show");
    });

    // bind behavior to survey form submissions
    $("#survey-form").on("submit", (event) => {
        // send a socket.io survey submit with the responses
        socket.emit("submit-survey", {
            "q1t2": parseInt($("#survey-q1t2").val()),
            "q2r3": parseInt($("#survey-q2r3").val()),
            "q3c1": parseInt($("#survey-q3c1").val()),
            "q4r2": parseInt($("#survey-q4r2").val()),
            "q5t1": parseInt($("#survey-q5t1").val()),
            "q6r1": parseInt($("#survey-q6r1").val()),
            "q7c3": parseInt($("#survey-q7c3").val()),
            "q8t3": parseInt($("#survey-q8t3").val()),
            "q9c2": parseInt($("#survey-q9c2").val())
        });
        $("#survey-form input").prop("disabled", true);
        $("#survey-form button:submit").prop("disabled", true);
        $("#survey-form button:submit .spinner-border").removeClass("d-none");
        // bypass the default form submission process
        event.preventDefault();
    });

    // bind behavior to the socket.io post show post survey screen
    socket.on("show-postsurvey-screen", (response) => {
        // hide the wait, design and thank you, demogragraphics and main survey screens
        $("#admin, #wait, #design, #thank-you, #welcome, #demographics-survey, #main-survey").collapse("hide");
        $("#postsurvey-form input").prop("disabled", false);
        $("#postsurvey-form button:submit").prop("disabled", false);
        $("#postsurvey-form button:submit .spinner-border").addClass("d-none");
        // show the welcome screen
        $("#main-postsurvey").collapse("show");
    });

    // bind behavior to post survey form submissions
    $("#postsurvey-form").on("submit", (event) => {
        // send a socket.io post survey submit with the responses
        socket.emit("submit-postsurvey", {
            "q1c2": parseInt($("#postsurvey-q1c2").val()),
            "q2r1": parseInt($("#postsurvey-q2r1").val()),
            "q3t3": parseInt($("#postsurvey-q3t3").val()),
            "q4r2": parseInt($("#postsurvey-q4r2").val()),
            "q5t1": parseInt($("#postsurvey-q5t1").val()),
            "q6c3": parseInt($("#postsurvey-q6c3").val()),
            "q7t2": parseInt($("#postsurvey-q7t2").val()),
            "q8c1": parseInt($("#postsurvey-q8c1").val()),
            "q9r3": parseInt($("#postsurvey-q9r3").val())
        });
        $("#postsurvey-form input").prop("disabled", true);
        $("#postsurvey-form button:submit").prop("disabled", true);
        $("#postsurvey-form button:submit .spinner-border").removeClass("d-none");
        // bypass the default form submission process
        event.preventDefault();
    });
    

    // bind behavior to the socket.io show admin screen
    socket.on("show-admin-screen", (response) => {
        // hide the wait, design and thank you screens
        $("#welcome, #wait, #design, #thank-you, #main-survey, #demographics-survey, #main-postsurvey").collapse("hide");
        // show the admin screen
        $("#admin").collapse("show");
        // set the progress bar to the correct value
        $("#admin .progress").attr("aria-valuenow", response.progress);
        $("#admin .progress-bar").css("width", response.progress + "%");
        // reset table rows
        $("#admin tbody").empty();
        // update button state
        $("#prev-button").prop("disabled", response.progress <= -1);
        $("#next-button").prop("disabled", response.progress >= 100);
        // update user status table
        let users = Object.keys(response.decisions);
        users.forEach((user) => {
            let row = (
                "<tr><th scope='row'>" 
                + (
                    response.decisions[user].online ? 
                    "<i class='bi-person-fill-check text-success me-1'></i>" :
                    "<i class='bi-person-slash text-danger me-1'></i>"
                ) + user
                + "</th>"
            );
            if (response.decisions[user]) {
                row += (
                     "<td>" + response.decisions[user].task + "</td>"
                     + "<td>" + (
                        response.decisions[user].design ?
                        response.decisions[user].design : ""
                     ) + "</td>"
                     + "<td>" + (
                        response.decisions[user].strategy ?
                        (
                            response.decisions[user].strategy=="collaborative" ? 
                            "<span class='text-success'><i class='bi-c-circle-fill'></i> collaborative</span>" : 
                            "<span class='text-danger'><i class='bi-info-circle-fill'></i> individual</span>"
                        ) : ""
                    ) + "</td>"
                );
            } else {
                row += "<td></td><td></td><td></td>";
            }
            row += "</tr>"
            $("#admin tbody").append($(row));
        });
    });

    // bind behavior to the socket.io show wait screen
    socket.on("show-wait-screen", (response) => {
        // hide the welcome, admin, design, and thank you screens
        $("#welcome, #admin, #design, #thank-you, #main-survey, #demographics-survey, #main-postsurvey").collapse("hide");
        // show the wait screen
        $("#wait").collapse("show");
    });

    // bind behavior to the socket.io update content
    socket.on("update-content", (response) => {
        socket.emit("content-request");
    });



    // bind behavior to the socket.io show thank you screen
    socket.on("show-thank-you-screen", (response) => {
        // hide the admin, wait, design and welcome screens
        $("#admin, #wait, #design, #welcome, #main-survey, #demographics-survey, #main-postsurvey").collapse("hide");
        // show the welcome screen
        $("#thank-you").collapse("show");
    });
});

