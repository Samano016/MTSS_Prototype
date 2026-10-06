/* =========================================
   GOOGLE APPS SCRIPT CONNECTION
========================================= */

const GOOGLE_APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbynQpVX05iuqvqCnTMr4Ado5xIv_Rh0gmlK8HkEbvYZKXpVLFxnwrMtvVmNQBcxG7sI/exec";



/* =========================================
   PAGE NAVIGATION
========================================= */

const navButtons =
    document.querySelectorAll(".nav-button");

const pages =
    document.querySelectorAll(".page");

const pageTitle =
    document.getElementById("pageTitle");


const pageNames = {

    dashboard: "Dashboard",

    students: "My Students",

    "data-entry": "Data Entry",

    cases: "MTSS Cases",

    communication: "Communication Log",

    reports: "Reports"

};



function showPage(pageName) {

    /*
     * Hide every page
     */

    pages.forEach(function(page) {

        page.classList.remove("active-page");

    });


    /*
     * Show selected page
     */

    const selectedPage =
        document.getElementById(pageName);


    if (selectedPage) {

        selectedPage.classList.add("active-page");

    }


    /*
     * Update sidebar buttons
     */

    navButtons.forEach(function(button) {

        button.classList.remove("active");

        if (
            button.dataset.page === pageName
        ) {

            button.classList.add("active");

        }

    });


    /*
     * Update page title
     */

    if (pageTitle) {

        pageTitle.textContent =
            pageNames[pageName] || "MTSS Platform";

    }


    /*
     * Scroll back to top
     */

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}



/* =========================================
   SIDEBAR BUTTONS
========================================= */

navButtons.forEach(function(button) {

    button.addEventListener(
        "click",
        function() {

            const pageName =
                button.dataset.page;

            showPage(pageName);

        }
    );

});



/* =========================================
   INTERNAL PAGE BUTTONS
========================================= */

const pageTargetButtons =
    document.querySelectorAll(
        "[data-page-target]"
    );


pageTargetButtons.forEach(function(button) {

    button.addEventListener(
        "click",
        function() {

            const target =
                button.dataset.pageTarget;

            showPage(target);

        }
    );

});



/* =========================================
   STUDENT SEARCH
========================================= */

const studentSearch =
    document.getElementById("studentSearch");

const tierFilter =
    document.getElementById("tierFilter");

const gradeFilter =
    document.getElementById("gradeFilter");


function filterStudents() {

    const search =
        studentSearch
            ? studentSearch.value.toLowerCase()
            : "";

    const tier =
        tierFilter
            ? tierFilter.value
            : "all";

    const grade =
        gradeFilter
            ? gradeFilter.value
            : "all";


    const rows =
        document.querySelectorAll(
            "#studentTable tr"
        );


    rows.forEach(function(row) {

        const name =
            row.dataset.name
                ? row.dataset.name.toLowerCase()
                : "";

        const rowTier =
            row.dataset.tier || "";

        const rowGrade =
            row.dataset.grade || "";


        const matchesSearch =
            name.includes(search);

        const matchesTier =
            tier === "all" ||
            rowTier === tier;

        const matchesGrade =
            grade === "all" ||
            rowGrade === grade;


        if (
            matchesSearch &&
            matchesTier &&
            matchesGrade
        ) {

            row.style.display = "";

        } else {

            row.style.display = "none";

        }

    });

}


if (studentSearch) {

    studentSearch.addEventListener(
        "input",
        filterStudents
    );

}


if (tierFilter) {

    tierFilter.addEventListener(
        "change",
        filterStudents
    );

}


if (gradeFilter) {

    gradeFilter.addEventListener(
        "change",
        filterStudents
    );

}



/* =========================================
   SET TODAY'S DATE
========================================= */

const dateInput =
    document.getElementById("date");


if (dateInput) {

    const today =
        new Date()
            .toISOString()
            .split("T")[0];

    dateInput.value = today;

}



/* =========================================
   MTSS DATA FORM
========================================= */

const mtssForm =
    document.getElementById("mtssForm");

const submitButton =
    document.getElementById("submitButton");

const statusMessage =
    document.getElementById("status");



if (mtssForm) {

    mtssForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();


            /*
             * Get form values
             */

            const student =
                document.getElementById("student").value;

            const date =
                document.getElementById("date").value;

            const grade =
                document.getElementById("grade").value;

            const area =
                document.getElementById("area").value;

            const measure =
                document.getElementById("measure").value;

            const intervention =
                document.getElementById("intervention").value;

            const response =
                document.getElementById("response").value;

            const notes =
                document.getElementById("notes").value;

            const staff =
                document.getElementById("staff").value;



            /*
             * Basic validation
             */

            if (!student) {

                showStatus(
                    "Please enter a student name.",
                    "error"
                );

                return;

            }


            if (!date) {

                showStatus(
                    "Please select a date.",
                    "error"
                );

                return;

            }


            if (!area) {

                showStatus(
                    "Please select an MTSS area.",
                    "error"
                );

                return;

            }



            /*
             * Disable button
             */

            submitButton.disabled = true;

            submitButton.textContent =
                "Saving...";



            /*
             * Create hidden form
             *
             * This avoids depending on a
             * CORS response from Apps Script.
             */

            const hiddenForm =
                document.createElement("form");


            hiddenForm.method = "POST";

            hiddenForm.action =
                GOOGLE_APPS_SCRIPT_URL;

            hiddenForm.target =
                "mtssSubmissionFrame";

            hiddenForm.style.display =
                "none";



            /*
             * Add fields
             */

            addHiddenField(
                hiddenForm,
                "student",
                student
            );


            addHiddenField(
                hiddenForm,
                "date",
                date
            );


            addHiddenField(
                hiddenForm,
                "grade",
                grade
            );


            addHiddenField(
                hiddenForm,
                "area",
                area
            );


            addHiddenField(
                hiddenForm,
                "measure",
                measure
            );


            addHiddenField(
                hiddenForm,
                "intervention",
                intervention
            );


            addHiddenField(
                hiddenForm,
                "response",
                response
            );


            addHiddenField(
                hiddenForm,
                "notes",
                notes
            );


            addHiddenField(
                hiddenForm,
                "staff",
                staff
            );



            /*
             * Add form to page
             */

            document.body.appendChild(
                hiddenForm
            );



            /*
             * Submit
             */

            hiddenForm.submit();



            /*
             * Remove temporary form
             */

            setTimeout(function() {

                hiddenForm.remove();

            }, 2000);



            /*
             * Show success message
             *
             * We can't read the Apps Script
             * response because this is a
             * cross-origin submission.
             */

            showStatus(
                "✓ Data submitted. Check the Google Sheet to confirm the entry.",
                "success"
            );


            /*
             * Reset form
             */

            mtssForm.reset();


            /*
             * Restore today's date
             */

            if (dateInput) {

                const today =
                    new Date()
                        .toISOString()
                        .split("T")[0];

                dateInput.value = today;

            }


            /*
             * Re-enable button
             */

            setTimeout(function() {

                submitButton.disabled = false;

                submitButton.textContent =
                    "Submit MTSS Data";

            }, 1000);

        }
    );

}



/* =========================================
   HELPER: HIDDEN FIELD
========================================= */

function addHiddenField(
    form,
    name,
    value
) {

    const input =
        document.createElement("input");


    input.type = "hidden";

    input.name = name;

    input.value = value || "";


    form.appendChild(input);

}



/* =========================================
   STATUS MESSAGE
========================================= */

function showStatus(
    message,
    type
) {

    if (!statusMessage) {
        return;
    }


    statusMessage.textContent =
        message;


    if (type === "success") {

        statusMessage.style.color =
            "#159447";

    } else {

        statusMessage.style.color =
            "#dc2626";

    }

}



/* =========================================
   INITIAL PAGE
========================================= */

showPage("dashboard");
