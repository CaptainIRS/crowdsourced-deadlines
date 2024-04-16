const baseUrl = chrome.runtime.getManifest()["backend_base_url"];
document.addEventListener("DOMContentLoaded", function () {
  fetch(`${baseUrl}/profile`)
    .then((response) => {
      if (response.ok) {
        return response.json();
      } else if (response.status === 403) {
        document.getElementById("login-button").style.display = "block";
        document.getElementById("logout-button").style.display = "none";
        document.getElementById("calendar-button").style.display = "none";
        throw new Error("You are not logged in. Please login to continue.");
      } else {
        document.getElementById("login-button").style.display = "none";
        document.getElementById("logout-button").style.display = "none";
        document.getElementById("calendar-button").style.display = "none";
        throw new Error(
          "An error occurred when connecting to the server. Please try again later."
        );
      }
    })
    .then((data) => {
      const userId = data["user_id"];
      document.getElementById("status").innerHTML = `Logged in as ${userId}.`;
      document.getElementById("login-button").style.display = "none";
      document.getElementById("logout-button").style.display = "block";
      document.getElementById("calendar-button").style.display = "block";
    })
    .catch(
      (error) =>
        (document.getElementById("status").innerHTML =
          error.message || "An error occurred.")
    );
});

let cal, prevListener, nextListener;
let calOptions = {
  data: {
    source: `${baseUrl}/deadlines/verified`,
    requestInit: {
      credentials: "include",
      mode: "cors",
      method: "GET",
      cache: "no-cache",
    },
    type: "json",
    x: "date",
    y: (d) => +d["headcount"],
    groupY: "min",
  },
  verticalOrientation: false,
  range: 1,
  itemSelector: "#calendar",
  date: {
    start: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
  },
  scale: { color: { type: "diverging", scheme: "PRGn" } },
  domain: {
    type: "month",
    label: { position: "top" },
  },
  subDomain: {
    type: "xDay",
    radius: 4,
    width: 20,
    height: 20,
    label: "D",
  },
};
const drawCal = () => {
  if (cal) {
    document
      .getElementById("prev-button")
      .removeEventListener("click", prevListener);
    document
      .getElementById("next-button")
      .removeEventListener("click", nextListener);
    cal.destroy();
  }
  cal = new CalHeatmap();
  cal.paint(calOptions);
  prevListener = () => {
    cal.previous();
  };
  nextListener = () => {
    cal.next();
  };
  document
    .getElementById("prev-button")
    .addEventListener("click", prevListener);
  document
    .getElementById("next-button")
    .addEventListener("click", nextListener);
  document.getElementById("calendar-container").style.display = "block";
  document.getElementById("index-container").style.display = "none";
};

document.getElementById("calendar-button").addEventListener("click", () => {
  chrome.runtime.sendMessage(
    {
      action: "getFromBackend",
      endpoint: "/deadlines/verified",
    },
    (response) => {
      if (response.status === 200) {
        calOptions.data.source = response.data["heatmap"];
        calOptions.scale.color.domain = [0, response.data["max_headcount"]];
        drawCal();
      }
    }
  );
});

document.getElementById("login-button").addEventListener("click", () => {
  window.open(`${baseUrl}/login`, "_blank");
});

document.getElementById("logout-button").addEventListener("click", () => {
  window.open(`${baseUrl}/logout`, "_blank");
});

document.getElementById("back-button").addEventListener("click", () => {
  document.getElementById("calendar-container").style.display = "none";
  document.getElementById("index-container").style.display = "block";
});

document
  .getElementById("show-unverified-checkbox")
  .addEventListener("change", () => {
    if (cal) {
      chrome.runtime.sendMessage(
        {
          action: "getFromBackend",
          endpoint: `/deadlines/${
            document.getElementById("show-unverified-checkbox").checked
              ? "unverified"
              : "verified"
          }`,
        },
        (response) => {
          if (response.status === 200) {
            calOptions.data.source = response.data["heatmap"];
            calOptions.scale.color.domain = [0, response.data["max_headcount"]];
            drawCal();
          }
        }
      );
    }
  });
