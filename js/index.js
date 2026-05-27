// console.log('starting on index.js')

// Get Config from Iframe container's URL
const currentUrl = window.location.href;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
let data = JSON.parse(decodeURIComponent(urlParams.get("data")));
let env = urlParams.get("env");
let suggestedPromptClicked = null;

function getAgentApiBaseUrl(env) {
  if (env === "test") {
    return "http://127.0.0.1:5003/addy-ai-dev/us-central1/api/agent";
  }
  if (env === "test-local" || env === "local") {
    return "http://localhost:8080/api/agent";
  }
  if (env === "development") {
    return "https://backend-dev-u5fn3il7zq-uc.a.run.app/api/agent";
  }
  return "https://backend-prod-zquodzeuva-uc.a.run.app/api/agent";
}

console.log("Data from URL", data)

let customerAvatarURL = "https://i.imgur.com/WjAIvVp.png";
let customerName = "You";
let chatbotAPI =
  data?.env == "test"
    ? "http://127.0.0.1:5003/addy-ai-dev/us-central1"
    : (data?.env == "development" || env == "development")
    ? "https://us-central1-addy-ai-dev.cloudfunctions.net/businessInference/infer"
    : "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer";
let backendAPI =
  data?.env == "test"
    ? "http://127.0.0.1:5003/addy-ai-dev/us-central1"
    : (data?.env == "development" || env == "development")
    ? "https://backend-dev-111911035666.us-central1.run.app"
    : "https://backend-prod-zquodzeuva-uc.a.run.app";

if (data?.env == "test-local" || env == "test-local") {
  backendAPI = "http://localhost:8080";
}

let isStreamingResponse = false;
const STREAMING_LINK_PLACEHOLDER_TEXT = "Preparing link...";
const thinkingDotsMarkup =
  '<span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

function sanitizeHTML(html) {
  if (window.DOMPurify) {
    return window.DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "rel"],
    });
  }
  return html;
}

function markdownToSafeHtml(markdownText, hideIncompleteStreamingLinks = false) {
  if (!markdownText) return "";
  let processedText = String(markdownText);
  if (hideIncompleteStreamingLinks) {
    processedText = processedText.replace(
      /\[([^\]]+)\]\(([^)]*)$/g,
      `[${STREAMING_LINK_PLACEHOLDER_TEXT}](#)`
    );
  }
  const html = marked.parse(processedText, {
    breaks: true,
    gfm: true,
  });
  return sanitizeHTML(html);
}

function setStreamingState(isStreaming) {
  isStreamingResponse = isStreaming;
  const inputContainer = document.querySelector(".input-container");
  if (inputContainer) inputContainer.classList.toggle("is-streaming", isStreaming);
  if (messageInput) messageInput.disabled = isStreaming;
  if (sendBtn) sendBtn.disabled = isStreaming || messageInput.value.trim().length <= 1;
}

// Initialize everything after window loads
window.onload = async function() {
    try {
        if (!data) {
            // Fetch the data from the backend
            const publicId = urlParams.get("publicId");
            if (!publicId) {
                console.error("No publicId found in URL, cannot load chatbot")
                return;
            }
            data = await getChatBotData(publicId);
            console.log("Data from API", data);
        }

        if (!data) {
            console.error("No chatbot data to load")
            return;
        }

        // Defaults
        data.avatarURL ||= data.appImageURL || "https://i.imgur.com/9VBT3XI.png";
        data.appImageURL ||= data.avatarURL;
        data.name ||= "My Chatbot";
        data.chatbotName ||= "Addy";
        data.welcomeMessage ||= "Hello! How can I help you today?";
        data.inputPlaceholder ||= "Ask me anything...";
        data.quickPrompts =
          data &&
          Array.isArray(data.suggestedQuestions) &&
          data.suggestedQuestions.length > 0
            ? data.suggestedQuestions
            : [];

        data.primaryColor ||= "#745DDE";
        data.primaryColorName ||= "Purple";
        data.env ||= env || "production";

        data.chatId = "website-chatbot-" + uuidv4();

        data.primaryColor &&
          document.documentElement.style.setProperty(
            "--user-message-color",
            data.primaryColor
          );

        console.log("Data now ready, initializing bot")
        initializeBot();
    } catch (error) {
        console.error("Error initializing chatbot:", error);
    }
};

/*
SAMPLE DATA
avatarURL: "https://i.imgur.com/9VBT3XI.png"
chatId: "92b1dc1f-2bdb-4eec-be75-c9c30a72d1b0"
chatbotName: "Addy"
host: ""
inputPlaceholder : "Ask me anything..."
name : "TEST Chatbot"
primaryColor : "#ee00ff"
primaryColorName : "Purple"
publicId : "2f05807d-4939-4e6e-be9b-680a3af9a7d2"
published : false
quickPrompts : [
    {id: '1', title: 'help', prompt: 'How can you help?'},
    {id: '2', title: 'order', prompt: 'Find my order.'}
]
welcomeMessage : "Hello! How can I help you today?"
*/

//backendAPI = "http://127.0.0.1:5003/addy-ai-dev/us-central1";
const chatHistory = document.querySelector("#chat-history");
const sendBtn = document.querySelector("#send-btn");
const messageInput = document.querySelector("#message-input");
const header = document.querySelector(".header");
const promptContainer = document.querySelector(".auto-prompts-container");

sendBtn.disabled = true;

async function getUserData() {
    let browserInfo = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenWidth: window.outerWidth,
      screenHeight: window.outerHeight,
      referrerUrl: document.referrer,
      currentPageUrl: window.location.href,
      currentHostname: window.location.hostname,
      networkConnection: navigator.connection
        ? navigator.connection.effectiveType
        : "unknown",
    };
    // Get IP and Location from ip-api.com
    let locationInfo = await fetch("http://ip-api.com/json/")
      .then((response) => response.json())
      .catch((error) => ({ error: "Could not fetch IP info" }));
  
    return { ...browserInfo, ip: locationInfo };
}


function addMessageToChat(message, type) {
  const messageElem = document.createElement("div");
  if (type == "customer") {
    messageElem.setAttribute("class", "user-message-container");
    messageElem.innerHTML = customerMessageHTML.replace("{{message}}", escapeHTML(message));
  }
  chatHistory.append(messageElem);
}


function createBotMessageElement(message) {
  const messageId = `bot-message-${Date.now()}`;
  const messageElem = document.createElement("div");

  messageElem.setAttribute("class", "bot-message-container");

  //   const formattedMessage = marked.parse(message);

  let innerHTML = chatbotMessageHTML.replace("{{messageId}}", messageId);
  innerHTML = innerHTML.replace("{{chatbotName}}", data.chatbotName);
  innerHTML = innerHTML.replace("{{chatbotAvatarURL}}", data.avatarURL);
  innerHTML = innerHTML.replace("{{message}}", message === "..." ? thinkingDotsMarkup : markdownToSafeHtml(message));
  messageElem.innerHTML = innerHTML;

  chatHistory.append(messageElem);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  return messageId;
}
const renderer = new marked.Renderer();
renderer.paragraph = function (text) {
  return text;
};


function convertMarkdownToHTML(text) {
  return markdownToSafeHtml(text);
}

function appendBotMessageElement(message, messageId, isStreaming = false) {
  const messageElem = document.getElementById(messageId);

  // Convert objects to JSON string for better debugging
  if (messageElem) {
    try {
      if (typeof message === "object" && message.emailString) {
        messageElem.innerHTML = markdownToSafeHtml(message.emailString);
        return; // Stop further execution since we've replaced the message
      }
    } catch (error) {
      console.log(error);
    }
    if (message.includes("documents-fetched")) {
      return;
    }
    messageElem.innerHTML = markdownToSafeHtml(message, isStreaming);
    messageElem.querySelectorAll("a").forEach((link) => {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }
}

function initializeBot() {
  // console.log('loading bot')
  const loadingView = document.querySelector(".loading-view");
  if (loadingView) loadingView.style.display = "flex";

  if (!data.publicId && !data.host) {
    showError(loadingView, "Error: Invalid Bot");
    return;
  }

  // Update input placeholder
  if (messageInput) messageInput.placeholder = data.inputPlaceholder;
  let submitText = () => {
    promptContainer.style.display = "none";
    sendBtn.disabled = false;
    sendBtn.click(); // Programmatically click the send button
    sendBtn.disabled = true;
  };

  const autoPromptsContainer = document.querySelector(
    ".auto-prompts-container"
  );
  if (autoPromptsContainer && data.quickPrompts) {
    autoPromptsContainer.innerHTML = "";
    data.quickPrompts.forEach((prompt) => {
      const autoPromptDiv = document.createElement("div");
      autoPromptDiv.className = "auto-prompt";
      autoPromptDiv.innerHTML = `<p>${prompt.title}</p>`;
      autoPromptsContainer.appendChild(autoPromptDiv);

      // Add event listener to each auto-prompt
      let autoFillPrompt = (e) => {
        e.preventDefault();
        suggestedPromptClicked = prompt;
        messageInput.value = prompt.title || autoPromptDiv.innerText; // Use textContent or innerText to get only the text, not HTML
        submitText();
      };
      autoPromptDiv.addEventListener("click", autoFillPrompt);
      autoPromptDiv.addEventListener("touchend", autoFillPrompt);
    });
  }
  document
    .getElementById("message-input")
    .addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.keyCode === 13) {
        submitText();
      }
    });

  if (loadingView) loadingView.style.display = "none";
  updateHeader();
  onSendButtonClick();
  showBotWelcomeMessage();
}

function updateHeader() {
  if (header) {
    header.innerHTML = `<p>${data.chatbotName}</p>`;
  }
  document.title = data.chatbotName;
}

function showError(element, text) {
  if (element) {
    element.innerHTML = `<p>${text ? text : "Error: Chatbot not found"}</p>`;
    element.style.color = "#D2042D";
  }
}

function showBotWelcomeMessage() {
  createBotMessageElement(data.welcomeMessage);
}

function isJsonString(str) {
  try {
    JSON.parse(str);
  } catch (e) {
    //   console.error("Error parsing JSON string", str, e);
    return false;
  }
  return true;
}

function cleanEmailString(emailString) {
  // emailString = emailString.replace(/\n/g, "");
  // emailString = emailString.replace(/\\n\\n/g, "\n\n");
  emailString = emailString.replace(/\\n/g, "\n");
  emailString = emailString.replace(/\\t/g, "\t");
  emailString = emailString.replace(/#/g, "");
  emailString = emailString.trim(); // Remove leading "\n\n" characters
  return {
    subject: "",
    emailString: emailString,
  };
}

function getJSONArray(str) {
  try {
    const parsedData = JSON.parse(str);
    // return the actual array
    return parsedData;
  } catch (e) {
    //   console.error("Error parsing JSON array", str, e);
    return false;
  }
}

async function onSendButtonClick() {

  let btnClicked = async (e) => {
    e.preventDefault();
    // console.log('clicked')
    if (isStreamingResponse) return;
    let message = messageInput.value.trim();

    if (message) {
      addMessageToChat(message, "customer");
      messageInput.value = "";
      setStreamingState(true);

      const messageToSendToBackend = suggestedPromptClicked
        ? suggestedPromptClicked.prompt
        : message;
      suggestedPromptClicked = null; // Reset the suggested prompt clicked

      const messageId = createBotMessageElement("...");
      const ENDPOINT = `${getAgentApiBaseUrl(data.env || env)}/public-query-stream`;

      await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: data.publicId,
          chatId: data.chatId,
          query: messageToSendToBackend,
        }),
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("Unable to stream chatbot response");
          if (!response.body) throw new Error("No response body");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let fullMessage = "";

          const processEvent = (rawEvent) => {
            const lines = rawEvent.split(/\r?\n/);
            const eventName =
              lines
                .find((line) => line.startsWith("event:"))
                ?.replace("event:", "")
                .trim() || "message";
            const dataLines = lines
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.replace(/^data:\s?/, ""));

            if (!dataLines.length) return;

            let payload;
            try {
              payload = JSON.parse(dataLines.join("\n"));
            } catch {
              return;
            }

            if (eventName === "chunk" && payload.content) {
              fullMessage += payload.content;
              appendBotMessageElement(fullMessage, messageId, true);
            } else if (eventName === "final_response" && payload.content && !fullMessage) {
              fullMessage = payload.content;
              appendBotMessageElement(fullMessage, messageId, false);
            } else if (eventName === "error") {
              appendBotMessageElement(
                payload.message || payload.content || "Unable to process this request.",
                messageId,
                false
              );
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";
            events.forEach((eventText) => {
              if (eventText.trim() && !eventText.trim().startsWith(":")) {
                processEvent(eventText);
              }
            });
          }

          if (buffer.trim() && !buffer.trim().startsWith(":")) {
            processEvent(buffer);
          }

          if (fullMessage) {
            appendBotMessageElement(fullMessage, messageId, false);
          }

          return "";
        })
        .catch((error) => {
          console.error(error);
          appendBotMessageElement(
            "Oops... I had a glitch :( My engineers are working on it",
            messageId,
            false
          );
        })
        .finally(() => {
          setStreamingState(false);
        });
    }
  };
  sendBtn.addEventListener("touchend", btnClicked);
  sendBtn.addEventListener("click", btnClicked);
}

messageInput.addEventListener("input", () => {
  const trimmedValue = messageInput.value.trim();
  sendBtn.disabled = isStreamingResponse || trimmedValue.length <= 1;
});

async function getChatBotData(publicId) {
    const host = window.location.host;
    const response = await fetch(`${getAgentApiBaseUrl(env)}/public-chatbot-info/?publicId=${publicId}&host=${host}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then((response) => {
        return response.json()
    })
    .then(data => { 
        if (!data.success) throw new Error("Error: No data found");
        const dataWithWidgets = {
            ...data?.data?.config,
            name: data?.data?.name,
            avatarURL: data?.data?.avatarURL,
            leadFunnelWidgets: data?.data?.leadFunnelWidgets,
            leadFunnelWidgetsConfig: data?.data?.leadFunnelWidgetsConfig,
        }
        return dataWithWidgets;
    })
    .catch((error) => {
        console.error("Error", error);
        return undefined;
    });
    
    if (!response) return undefined;
    response.primaryColor ||= "#745DDE";
    response.primaryColorName ||= "Purple";
    response.publicId = publicId;
    response.host = window.location.host || "local";
    response.env = env || response?.env;
    return response;
}

// Update the class names and structure to match the new CSS
const customerMessageHTML = `
    <div class="user-message-container">
        <div class="user-profile-photo">
            <img src="${customerAvatarURL}" alt="You" width="35" height="35"/>
        </div>
        <div class="user-message">
            <p>{{message}}</p>
        </div>
    </div>
`;

const chatbotMessageHTML = `
    <div class="bot-message-container">
        <div class="bot-profile-photo">
            <img src="{{chatbotAvatarURL}}" alt="chatbot"/>
        </div>
        <div class="bot-message">
            <div id="{{messageId}}" class="bot-message-content">{{message}}</div>
        </div>
    </div>
`;

const chatbotThinking = `
    <div class="bot-message-container">
        <div class="bot-profile-photo">
            <img src="{{chatbotAvatarURL}}" alt="chatbot"/>
        </div>
        <div class="bot-message">
            ${thinkingDotsMarkup}
        </div>
    </div>
`;
