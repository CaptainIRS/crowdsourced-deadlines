const url = window.location.href;
const baseUrl = chrome.runtime.getManifest()["backend_base_url"];
console.log("Base URL is " + baseUrl);
const afterWindowLoaded = () => {
  if (url.includes("user")) {
    console.log("We are going to get course headcount");
    const courseUrl = document
      .querySelector(".nav-item[data-key='coursehome']")
      .querySelector("a").href;
    console.log("Course URL is " + courseUrl);
    const courseId = Number(
      new URLSearchParams(new URL(courseUrl).searchParams).get("id")
    );
    console.log("Course ID is " + courseId);
    const currentHeadcount = Number(
      document
        .querySelector("p[data-region='participant-count']")
        .innerText.split(" ")[0]
    );
    console.log("Headcount is " + currentHeadcount);
    let messageDiv = document.createElement("div");
    messageDiv.innerHTML = `Crowdsourced Deadlines: Updating status...`;
    messageDiv.style.color = "black";
    messageDiv.style.backgroundColor = "rgba(0, 0, 0, .03)";
    messageDiv.style.padding = "10px";
    messageDiv.style.margin = "10px 0";
    document
      .querySelector("p[data-region='participant-count']")
      .after(messageDiv);
    chrome.runtime.sendMessage(
      {
        action: "getFromBackend",
        endpoint: `/courses/${courseId}/headcount`,
      },
      (response) => {
        if (response.status === 200) {
          console.log("Headcount retrieved successfully");
          const headcount = response.data["headcount"];
          const lastSubmittedHeadcount =
            response.data["last_submitted_headcount"];
          let message;
          if (
            headcount === null &&
            lastSubmittedHeadcount !== currentHeadcount
          ) {
            message = `The headcount for this course is currently unknown. Submitted the headcount of ${currentHeadcount} to the server.`;
          } else if (
            headcount !== lastSubmittedHeadcount &&
            lastSubmittedHeadcount !== currentHeadcount
          ) {
            message = `The headcount for this course is currently known to be ${headcount}. Submitted the headcount of ${currentHeadcount} to the server.`;
          }
          if (message) {
            chrome.runtime.sendMessage(
              {
                action: "postToBackend",
                endpoint: `/courses/${courseId}/headcount`,
                data: { headcount: currentHeadcount },
              },
              (response) => {
                if (response.status === 200) {
                  console.log("Headcount submitted successfully");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: ${message}`;
                  messageDiv.style.backgroundColor = "#cfefcf";
                  messageDiv.style.color = "black";
                } else if (response.status === 403) {
                  console.log("Not logged in");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: You are not logged in. Please login to by clicking this: <a href="${baseUrl}/login" target="_blank">Login</a>.`;
                  messageDiv.style.backgroundColor = "#efcfcf";
                  messageDiv.style.color = "black";
                } else {
                  console.log("Failed to submit headcount");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: Failed to submit headcount.`;
                  messageDiv.style.backgroundColor = "#efcfcf";
                  messageDiv.style.color = "black";
                }
              }
            );
          } else {
            messageDiv.innerHTML = `Crowdsourced Deadlines: Already up to date.`;
            messageDiv.style.backgroundColor = "rgba(0, 0, 0, .03)";
            messageDiv.style.color = "black";
          }
        } else if (response.status === 403) {
          console.log("Not logged in");
          messageDiv.innerHTML = `Crowdsourced Deadlines: You are not logged in. Please login to by clicking this: <a href="${baseUrl}/login" target="_blank">Login</a>.`;
          messageDiv.style.backgroundColor = "#efcfcf";
          messageDiv.style.color = "black";
        } else {
          console.log("Failed to retrieve headcount");
          messageDiv.innerHTML = `Crowdsourced Deadlines: Failed to retrieve headcount.`;
          messageDiv.style.backgroundColor = "#efcfcf";
          messageDiv.style.color = "black";
        }
      }
    );
  } else if (url.includes("assign")) {
    console.log("We are going to get assignment deadlines");
    const currentDeadline = Date.parse(
      document
        .querySelectorAll('div[data-region="activity-dates"] > div > div')[1]
        .innerText.substring(5)
    );
    console.log("Due date and time is " + currentDeadline);
    console.log(document.querySelector("a[data-for='section_title']"));
    const courseUrl = document.querySelector(
      "a[data-for='section_title']"
    ).href;
    console.log("Course URL is " + courseUrl);
    const courseId = Number(
      new URLSearchParams(new URL(courseUrl).searchParams).get("id")
    );
    console.log("Course ID is " + courseId);
    const assignmentId = Number(
      new URLSearchParams(new URL(window.location.href).searchParams).get("id")
    );
    console.log("Assignment ID is " + assignmentId);
    let messageDiv = document.createElement("div");
    messageDiv.innerHTML = `Crowdsourced Deadlines: Updating status...`;
    messageDiv.style.color = "black";
    messageDiv.style.backgroundColor = "rgba(0, 0, 0, .03)";
    messageDiv.style.padding = "10px";
    messageDiv.style.margin = "10px 0";
    document
      .querySelector("div[data-region='activity-dates']")
      .after(messageDiv);
    chrome.runtime.sendMessage(
      {
        action: "getFromBackend",
        endpoint: `/courses/${courseId}/assignments/${assignmentId}/deadline`,
      },
      (response) => {
        if (response.status === 200) {
          console.log(
            "Deadline retrieved successfully: " + JSON.stringify(response.data)
          );
          const deadline =
            response.data["deadline"] === null
              ? null
              : new Date(response.data["deadline"]).getTime() +
                new Date().getTimezoneOffset() * 60000;
          const lastSubmittedDeadline =
            response.data["last_submitted_deadline"] === null
              ? null
              : new Date(response.data["last_submitted_deadline"]).getTime() +
                new Date().getTimezoneOffset() * 60000;
          const needHeadcount = response.data["need_headcount"];
          let headCountPrompt = "";
          if (needHeadcount) {
            headCountPrompt = `<br>Please contribute the headcount data of this course by visiting <a href="${window.location.origin}/user/index.php?id=${courseId}">the participants tab</a>.`;
          }
          let message;
          console.log(
            "Deadline is " +
              deadline +
              (deadline === null
                ? ""
                : " which is " + new Date(deadline).toLocaleString())
          );
          console.log(
            "Last submitted deadline is " +
              lastSubmittedDeadline +
              (lastSubmittedDeadline === null
                ? ""
                : " which is " +
                  new Date(lastSubmittedDeadline).toLocaleString())
          );
          console.log(
            "Current deadline is " +
              currentDeadline +
              (currentDeadline === null
                ? ""
                : " which is " + new Date(currentDeadline).toLocaleString())
          );
          if (deadline === null && lastSubmittedDeadline !== currentDeadline) {
            message = `The deadline for this assignment is currently unknown. Submitted the deadline of ${new Date(
              currentDeadline
            ).toLocaleString()} to the server.`;
          } else if (
            deadline !== lastSubmittedDeadline &&
            lastSubmittedDeadline !== currentDeadline
          ) {
            message = `The deadline for this assignment is currently known to be ${new Date(
              deadline
            ).toLocaleString()}. Submitted the deadline of ${new Date(
              currentDeadline
            ).toLocaleString()} to the server.`;
          }
          if (message) {
            chrome.runtime.sendMessage(
              {
                action: "postToBackend",
                endpoint: `/courses/${courseId}/assignments/${assignmentId}/deadline`,
                data: {
                  deadline:
                    currentDeadline - new Date().getTimezoneOffset() * 60000,
                },
              },
              (response) => {
                if (response.status === 200) {
                  console.log("Deadline submitted successfully");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: ${message}${headCountPrompt}`;
                  messageDiv.style.backgroundColor = "#cfefcf";
                  messageDiv.style.color = "black";
                } else if (response.status === 403) {
                  console.log("Not logged in");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: You are not logged in. Please login to by clicking this: <a href="${baseUrl}/login" target="_blank">Login</a>.`;
                  messageDiv.style.backgroundColor = "#efcfcf";
                  messageDiv.style.color = "black";
                } else {
                  console.log("Failed to submit deadline");
                  messageDiv.innerHTML = `Crowdsourced Deadlines: Failed to submit deadline.`;
                  messageDiv.style.backgroundColor = "#efcfcf";
                  messageDiv.style.color = "black";
                }
              }
            );
          } else {
            messageDiv.innerHTML = `Crowdsourced Deadlines: Already up to date.${headCountPrompt}`;
            messageDiv.style.backgroundColor = "rgba(0, 0, 0, .03)";
            messageDiv.style.color = "black";
          }
        } else if (response.status === 403) {
          console.log("Not logged in");
          messageDiv.innerHTML = `Crowdsourced Deadlines: You are not logged in. Please login to by clicking this: <a href="${baseUrl}/login" target="_blank">Login</a>.`;
          messageDiv.style.backgroundColor = "#efcfcf";
          messageDiv.style.color = "black";
        } else {
          console.log("Failed to retrieve deadline");
          messageDiv.innerHTML = `Crowdsourced Deadlines: Failed to retrieve deadline.`;
          messageDiv.style.backgroundColor = "#efcfcf";
          messageDiv.style.color = "black";
        }
      }
    );
  }
};

if (document.readyState !== "complete") {
  window.addEventListener("load", afterWindowLoaded);
} else {
  afterWindowLoaded();
}
