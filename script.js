const GOOGLE_APPS_SCRIPT_URL =
    "https://script.google.com/a/macros/ppeptechs.org/s/AKfycbxWtAKfpmjBt8cH0W8IDHnOpPMsDp5y58bOw0XGIupHb80iL-HQNJ6u_2bz0ELaUMSEVA/exec";


const form = document.getElementById("mtssForm");

const statusMessage =
    document.getElementById("status");

const submitButton =
    document.getElementById("submitButton");


form.addEventListener("submit", async function(event) {

    event.preventDefault();

    submitButton.disabled = true;

    submitButton.textContent = "Saving...";

    statusMessage.textContent = "";


    // Collect form information

    const data = {

        student:
            document.getElementById("student").value,

        date:
            document.getElementById("date").value,

        grade:
            document.getElementById("grade").value,

        area:
            document.getElementById("area").value,

        measure:
            document.getElementById("measure").value,

        intervention:
            document.getElementById("intervention").value,

        response:
            document.getElementById("response").value,

        notes:
            document.getElementById("notes").value,

        staff:
            document.getElementById("staff").value
    };


    try {

        await fetch(
            GOOGLE_APPS_SCRIPT_URL,
            {
                method: "POST",

                body: JSON.stringify(data)
            }
        );


        statusMessage.textContent =
            "✓ MTSS data submitted successfully.";

        statusMessage.style.color =
            "green";


        // Clear the form

        form.reset();


    } catch (error) {

        console.error(error);

        statusMessage.textContent =
            "There was a problem submitting the data.";

        statusMessage.style.color =
            "red";

    }


    submitButton.disabled = false;

    submitButton.textContent =
        "Submit MTSS Data";

});
