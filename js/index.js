// console.log('starting on index.js')

// Get Config from Iframe container's URL
const currentUrl = window.location.href;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const data = JSON.parse(decodeURIComponent(urlParams.get('data')))
let suggestedPromptClicked = null;
let interactiveMode = false;
let interactiveIntent = null;
let previousQuestionsAndAnswers = [];

// Defaults
// console.log(queryString);
// console.log(data)
data.avatarURL ||= "https://i.imgur.com/9VBT3XI.png";
data.name ||= "My Chatbot"
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

data.chatId = uuidv4();

data.primaryColor && document.documentElement.style.setProperty('--user-message-color', data.primaryColor);

// console.log(data)
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
let customerAvatarURL = "https://i.imgur.com/WjAIvVp.png";
let customerName = "You";
let chatbotAPI = data.env == "development" ? "https://us-central1-addy-ai-dev.cloudfunctions.net/businessInference/infer" : "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer";
let backendAPI = data.env == "development" ? "https://backend-dev-111911035666.us-central1.run.app" : "https://backend-prod-zquodzeuva-uc.a.run.app"
// backendAPI = "http://localhost:8080"; // For local development TODO: Remove this before deploying
const chatHistory = document.querySelector("#chat-history");
const sendBtn = document.querySelector("#send-btn");
const messageInput = document.querySelector("#message-input");
const header = document.querySelector(".header");
const promptContainer = document.querySelector(".auto-prompts-container");

sendBtn.disabled = true;

window.onload = async function () {
    initializeBot();
    listenForInteractiveResponse();
}

function addMessageToChat(message, type) {
    const messageElem = document.createElement("div");
    if (type == "customer") {
        messageElem.setAttribute("class", "user-message-container");
        messageElem.innerHTML = customerMessageHTML.replace("{{message}}", message);
    }
    chatHistory.append(messageElem);
}

function createBotMessageElement(message, interactive=false, interactiveData=null) {
    const messageId = `bot-message-${Date.now()}`;
    let messageElem = document.createElement("div");
    messageElem.setAttribute("class", "bot-message-container");
    
    const formattedMessage = marked.parse(message);

    if (interactive && interactiveData) {
        interactiveMode = true;
        interactiveIntent = interactiveData.intent;
        messageElem = createInteractiveBotMessageElement(messageElem, interactiveData);
    }

    let innerHTML = chatbotMessageHTML.replace("{{messageId}}", messageId);
    innerHTML = innerHTML.replace("{{chatbotName}}", data.chatbotName);
    innerHTML = innerHTML.replace("{{chatbotAvatarURL}}", data.avatarURL);
    innerHTML = innerHTML.replace("{{message}}", formattedMessage);
    
    // Create a temporary container to parse the HTML
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = innerHTML;
    
    // Find the bot-message div in the temporary container
    const botMessageDiv = tempContainer.querySelector('.bot-message');
    if (botMessageDiv) {
        // Move all children from messageElem to the bot-message div
        while (messageElem.firstChild) {
            botMessageDiv.appendChild(messageElem.firstChild);
        }
    }
    
    // Set the final HTML
    messageElem.innerHTML = tempContainer.innerHTML;

    chatHistory.append(messageElem);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    if (interactive) {
        // Get the iframe and set up load event
        const iframe = messageElem.querySelector("iframe");
        updateIframeHeightToItsContent(iframe, interactiveData);
        addNextButtonOnClickListener(messageElem);
    }

    return messageId;
}

function addNextButtonOnClickListener(messageElem) {
    const nextButton = messageElem.querySelector(".addy-interactive-primary-button");
    if (nextButton) {
        nextButton.addEventListener("click", () => getNextQuestion());
    }
}

function updateIframeHeightToItsContent(iframe, interactiveData) {
    if (!iframe) return;
    iframe.addEventListener('load', async () => {
        const contentHeight = iframe.contentWindow.document.body.scrollHeight + (interactiveData?.type == "textInput" ? 20 : 5);
        iframe.style.height = `${contentHeight}px`;
    });
}

function createInteractiveBotMessageElement(div, interactiveData) {
    if (interactiveData?.nextQuestion && typeof interactiveData.nextQuestion == "string") {
        interactiveData.nextQuestion = JSON.parse(interactiveData.nextQuestion);
    }
    // console.log("Interactive data", interactiveData);
    if (interactiveData.intent == interactiveIntent) {
        if (!interactiveData?.nextQuestion?.question) {
            return div;
        }

        // Create a parent div to contain all interactive elements
        const interactiveContainer = document.createElement("div");
        interactiveContainer.setAttribute("class", "addy-interactive-container");

        // Create the div to contain the question text
        const questionTextDiv = document.createElement("div");
        questionTextDiv.setAttribute("class", "addy-interactive-question-text");
        questionTextDiv.innerHTML = interactiveData?.nextQuestion?.question;

        // Create an iframe to display the question ui
        const iframe = document.createElement("iframe");
        iframe.setAttribute("class", "addy-interactive-iframe");
        // Now set the srcdoc after the handler is in place
        iframe.setAttribute("srcdoc", interactiveData.uiComponent
            .replaceAll("F3F4F6", "FFFFFF")
            .replaceAll("EEF1F5", "FFFFFF")
        );

        // Append question and iframe to the container
        interactiveContainer.appendChild(questionTextDiv);
        interactiveContainer.appendChild(iframe);

        // If it's not a selector, then add a next button
        if (interactiveData?.type != "selector") {
            const nextButton = document.createElement("button");
            nextButton.setAttribute("class", "addy-interactive-primary-button");
            nextButton.innerHTML = "Next";
            nextButton.style.backgroundColor = data.primaryColor;
            nextButton.style.marginBottom = "10px";

            interactiveContainer.appendChild(nextButton);
        }
        // Append the container to the main div
        div.appendChild(interactiveContainer);
    }
    return div;
}

function listenForInteractiveResponse() {
    // Window listen for postMessage
    window.addEventListener("message", (event) => {
        if (event.data.answerSelected) {
            const question = event.data.answerSelected.question;
            const answer = event.data.answerSelected.answer;
            if (!(question && answer)) {
                console.error("No question or answer found");
                return;
            }
            // Find the question in the previousQuestionsAndAnswers array or add it if it doesn't exist
            const questionIndex = previousQuestionsAndAnswers.findIndex(q => q.question == question);
            if (questionIndex == -1) {
                previousQuestionsAndAnswers.push({question, answer});
            } else {
                previousQuestionsAndAnswers[questionIndex].answer = answer;
            }
            if (event.data.answerSelected.type == "selector") {
                getNextQuestion(event.data.answerSelected);
            }
        }
    });
}

async function getNextQuestion() {
    // If it's selector, then get next question instantly without waiting to click on next button
    const nextQuestionResponse = await makeAPICallForNextQuestion();
    if (nextQuestionResponse?.nextQuestion) {
        createBotMessageElement("", true, {...nextQuestionResponse,
            "intent": interactiveIntent
        });
    }
    
}

async function makeAPICallForNextQuestion() {
    const payload = {
        uid: "chatbot-website",
        agentPublicId: data.publicId,
        previousQuestionsAndAnswers: previousQuestionsAndAnswers,
    };
    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
    const response = await fetch(backendAPI + "/api/loan-pricing-agent/get-next-question", requestOptions)
        .then(response => response.json())
        .then(data => {
            return data;
        })
        .catch(error => {
            console.error("Error making API call for next question", error);
        });
    return response;
}

function initializeBot() {
    const loadingView = document.querySelector(".loading-view");
    if (loadingView) loadingView.style.display = "flex";

    if (!data.publicId && !data.host) {
        showError(loadingView, "Error: Invalid Bot");
        return;
    }

    // Update input placeholder
    if (messageInput) messageInput.placeholder = data.inputPlaceholder;
    let submitText = () => {
        promptContainer.style.display = 'none';
        sendBtn.disabled = false;
        sendBtn.click(); // Programmatically click the send button
        sendBtn.disabled = true;
    }

    const autoPromptsContainer = document.querySelector('.auto-prompts-container');
    if (autoPromptsContainer && data.quickPrompts) {
        autoPromptsContainer.innerHTML = '';
        data.quickPrompts.forEach(prompt => {
            const autoPromptDiv = document.createElement('div');
            autoPromptDiv.className = 'auto-prompt';
            autoPromptDiv.innerHTML = `<p>${prompt.title}</p>`;
            autoPromptsContainer.appendChild(autoPromptDiv);

            // Add event listener to each auto-prompt
            let autoFillPrompt = (e) => {
                e.preventDefault();
                suggestedPromptClicked = prompt;
                messageInput.value = prompt.title || autoPromptDiv.innerText; // Use textContent or innerText to get only the text, not HTML
                submitText()
            }
            autoPromptDiv.addEventListener('click', autoFillPrompt);
            autoPromptDiv.addEventListener('touchend', autoFillPrompt);
        });
    }
    document.getElementById('message-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            submitText()
        }})

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

async function onSendButtonClick() {
    let btnClicked = async (e) => {
        e.preventDefault();
        let message = messageInput.value;
        
        if (message) {
            addMessageToChat(message, "customer");
            messageInput.value = "";

            const thinkingElem = document.createElement("div");
            thinkingElem.setAttribute("class", "bot-message-container");
            let thinkingInnerHTML = chatbotThinking;
            thinkingInnerHTML = thinkingInnerHTML
                .replace("{{chatbotAvatarURL}}", data.avatarURL)
                .replace("{{chatbotName}}", data.chatbotName);

            setTimeout(() => {
                thinkingElem.innerHTML = thinkingInnerHTML;
                chatHistory.append(thinkingElem);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 400);

            const messageToSendToBackend = suggestedPromptClicked ? suggestedPromptClicked.prompt : message;
            suggestedPromptClicked = null; // Reset the suggested prompt clicked

            const payload = {
              requestParams: {
                user_prompt: messageToSendToBackend,
              },
              uid: "chatbot-website",
              email: "chatbot-website",
              chatId: data.chatId,
              promptId: "addy-assistant-001-website",
              subscription: "unlimited",
              name: "name",
              customInstructions: [],
              isClient: true,
              appID: "noId",
              host: "hostName",
              clientHostname: "clientHostname",
              publicId: data.publicId,
              selectedText: "",
              isOldSendMessage: false,
            };

            const requestOptions = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            };

            // const ENDPOINT = GlobalVariables.getCloudRunAPIURL() + Assistant.getEndpoints().qaStream;
            // fetch(`${chatbotAPI}/qa?user_query=${message}&publicId=${data.publicId}&host=${data.host}&chatId=${data.chatId}`)

            const ENDPOINT = backendAPI + "/api/thread/chat-stream";
            const response = await fetch(ENDPOINT, requestOptions)
                .then(async response => {
                    if (!response.body) throw new Error("No response body");

                    // Clone the response so we can read it twice
                    const clonedResponse = response.clone();
                    
                    // First try to read as JSON
                    try {
                        const responseData = await response.json();
                        if (responseData?.intent == interactiveIntent) {
                            return responseData;
                        }
                    } catch (error) {
                        console.error("Error getting response data", error);
                        // If JSON parsing fails, proceed with stream reading
                    }
                    
                    // If we get here, either JSON parsing failed or it wasn't a loan application
                    // Read the stream from the cloned response
                    const reader = clonedResponse.body.getReader();
                    const decoder = new TextDecoder();
                    let fullResponse = "";

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        
                        const str = decoder.decode(value, { stream: true });
                        fullResponse += str;
                    }

                    return fullResponse;
                })
                .then(fullResponse => {
                    
                    thinkingElem.style.display = "none";

                    // If the response is for the loan pricing agent, show the response
                    if (fullResponse?.intent == interactiveIntent) {
                        createBotMessageElement("", true, fullResponse);
                        return;
                    }
                    
                    try {
                      // Safely split JSON objects using newlines or another reliable delimiter
                      const jsonStrings = fullResponse
                        .trim()
                        .split("}{")
                        .map((str, index, arr) => {
                          // Add missing brackets back
                          if (index === 0) return str + "}";
                          if (index === arr.length - 1) return "{" + str;
                          return "{" + str + "}";
                        });

                      // Parse each JSON object safely
                      const responses = jsonStrings
                        .map((json) => {
                          try {
                            return JSON.parse(json);
                          } catch (e) {
                            console.error("JSON parse error:", e, json);
                            return null;
                          }
                        })
                        .filter(Boolean); // Remove null values

                      // Find the last response where finished is true
                      const lastFinishedResponse = responses
                        .reverse()
                        .find((data) => data.finished === true);

                      if (lastFinishedResponse) {
                        createBotMessageElement(lastFinishedResponse.response);
                      } else {
                        createBotMessageElement(
                          "Oops. No completed response found."
                        );
                      }
                    } catch (error) {
                        createBotMessageElement("Oops... I had a glitch :( My engineers are working on it");
                    }

                    chatHistory.scrollTop = chatHistory.scrollHeight;
                })
                .catch(error => {
                    thinkingElem.style.display = "none";
                    console.error(error)
                    createBotMessageElement("Oops... I had a glitch :( My engineers are working on it");
                });


            // const response = await fetch(ENDPOINT, requestOptions)
            //     .then(response => response.json())
            //     .then(data => {
            //         thinkingElem.style.display = "none";
            //         console.log(data);
            //         if (data.response) {
            //             createBotMessageElement(data.response);
            //         } else {
            //             createBotMessageElement("Sorry, I could not understand your question");
            //         }
            //         chatHistory.scrollTop = chatHistory.scrollHeight;
            //     }).catch((error) => {
            //         thinkingElem.style.display = "none";
            //         createBotMessageElement("Oops... I had a glitch :( My engineers are working on it");
            //     })
        }
    }
    sendBtn.addEventListener("touchend", btnClicked );
    sendBtn.addEventListener('click', btnClicked);
}

messageInput.addEventListener('input', () => {
    const trimmedValue = messageInput.value.trim();
    sendBtn.disabled = trimmedValue.length <= 1;
});

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
            <p id="{{messageId}}">{{message}}</p>
        </div>
    </div>
`;

const chatbotThinking = `
    <div class="bot-message-container">
        <div class="bot-profile-photo">
            <img src="{{chatbotAvatarURL}}" alt="chatbot"/>
        </div>
        <div class="bot-message">
            <p>thinking...</p>
        </div>
    </div>
`;
