const backendBaseUrl = chrome.runtime.getManifest()["backend_base_url"];

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Message received");
  console.log(request);
  if (request.action === "getFromBackend") {
    fetch(`${backendBaseUrl}${request.endpoint}`, {
      mode: "cors",
    })
      .then((response) => {
        if (response.ok) {
          response.json().then((data) => {
            sendResponse({
              status: 200,
              data: data,
            });
          });
        } else {
          sendResponse({
            status: response.status,
          });
        }
      })
      .catch(() => {
        sendResponse({ status: 500 });
      });
  } else if (request.action === "postToBackend") {
    fetch(`${backendBaseUrl}${request.endpoint}`, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.data),
    })
      .then((response) => {
        if (response.ok) {
          response.json().then((data) => {
            sendResponse({
              status: 200,
              data: data,
            });
          });
        } else {
          sendResponse({
            status: response.status,
          });
        }
      })
      .catch(() => {
        sendResponse({ status: 500 });
      });
  }
  return true;
});
