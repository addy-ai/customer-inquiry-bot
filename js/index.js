console.log('starting on index.js')

let chatbotName = undefined;
let chatbotAvatarURL = undefined;
let customerAvatarURL = "https://i.imgur.com/vphoLPW.png";
let customerName = "You";
let chatbotAPI = "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer";

const currentUrl = window.location.href;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const publicId = urlParams.get("publicId") || undefined;
const showHeader = urlParams.get("header") || undefined;

const chatHistory = document.querySelector("#chat-history");
const sendBtn = document.querySelector("#send-btn");
const messageInput = document.querySelector("#message-input");
const container = document.querySelector(".chatbox-container");
const header = document.querySelector(".header");

sendBtn.disabled = true;

window.onload = async function () {
    initializeBot();
}

header.addEventListener('click', function () {
    container.classList.toggle('hidden');
});

function addMessageToChat(message, type) {
    const messageElem = document.createElement("div");
    if (type == "customer") {
        messageElem.setAttribute("class", "user-message-container");
        messageElem.innerHTML = customerMessageHTML.replace("{{message}}", message);
    }
    chatHistory.append(messageElem);
}

function createBotMessageElement(message, botInfo) {
    const messageId = `bot-message-${Date.now()}`;
    const messageElem = document.createElement("div");

    messageElem.setAttribute("class", "bot-message-container");
    let innerHTML = chatbotMessageHTML.replace("{{messageId}}", messageId);
    innerHTML = innerHTML.replace("{{chatbotName}}", botInfo.name);
    innerHTML = innerHTML.replace("{{chatbotAvatarURL}}", botInfo.avatarURL);
    innerHTML = innerHTML.replace("{{message}}", message);
    messageElem.innerHTML = innerHTML;

    chatHistory.append(messageElem);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageId;
}

function initializeBot() {
    console.log('loading bot')
    const loadingView = document.querySelector(".loading-view");
    if (container) container.style.display = "none";
    if (loadingView) loadingView.style.display = "flex";

    if (!publicId) {
        showError(loadingView, "Error: Invalid Bot");
        return;
    }

    fetch(`${chatbotAPI}/bot-info-public?publicId=${publicId}`)
        .then(response => response.json())
        .then(data => {
            const botInfo = data.data;
            if (!botInfo) {
                showError(loadingView);
                return;
            }

            chatbotName = botInfo.name;
            chatbotAvatarURL = botInfo.avatarURL;

            if (loadingView) loadingView.style.display = "none";
            if (container) container.style.display = "block";
            updateHeader(botInfo);
            onSendButtonClick(publicId, botInfo);
            showBotWelcomeMessage(publicId, botInfo);
        }).catch((err) => {
            console.error("Addy AI Error: ", err);
            showError(loadingView);
        })
}

function updateHeader(botInfo) {
    if (header) {
        header.innerHTML = `<p>${botInfo.name}</p>`;
    }
    document.title = botInfo.name;
}

function showError(element, text) {
    if (element) {
        element.innerHTML = `<p>${text ? text : "Error: Chatbot not found"}</p>`;
        element.style.color = "#D2042D";
    }
}

function showBotWelcomeMessage(botPublicId, botInfo) {
    fetch(`${chatbotAPI}/bot-init?publicId=${botPublicId}`)
        .then(response => response.json())
        .then(data => {
            if (data.text) {
                createBotMessageElement(data.text, botInfo);
            }
            chatHistory.scrollTop = chatHistory.scrollHeight;
        });
}

function onSendButtonClick(publicId, botInfo) {
    sendBtn.addEventListener("click", () => {
        const message = messageInput.value;
        if (message) {
            addMessageToChat(message, "customer");
            messageInput.value = "";

            const thinkingElem = document.createElement("div");
            thinkingElem.setAttribute("class", "bot-message-container");
            let thinkingInnerHTML = chatbotThinking;
            thinkingInnerHTML = thinkingInnerHTML
                .replace("{{chatbotAvatarURL}}", botInfo.avatarURL)
                .replace("{{chatbotName}}", botInfo.name);

            setTimeout(() => {
                thinkingElem.innerHTML = thinkingInnerHTML;
                chatHistory.append(thinkingElem);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 400);

            fetch(`${chatbotAPI}/qa?user_query=${message}&publicId=${publicId}`)
                .then(response => response.json())
                .then(data => {
                    thinkingElem.style.display = "none";
                    if (data.response) {
                        createBotMessageElement(data.response, botInfo);
                    } else {
                        createBotMessageElement("Sorry, I could not understand your question", botInfo);
                    }
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }).catch((error) => {
                    thinkingElem.style.display = "none";
                    createBotMessageElement("Oops... I had a glitch :( My engineers are working on it", botInfo);
                })
        }
    });
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
            <div style="background-color: #745dde; width: 35px; height: 35px; border-radius: 50%;"></div>
        </div>
        <div class="bot-message">
            <p id="{{messageId}}">{{message}}</p>
        </div>
    </div>
`;

const chatbotThinking = `
    <div class="bot-message-container">
        <div class="bot-profile-photo">
            <div style="background-color: #745dde; width: 35px; height: 35px; border-radius: 50%;"></div>
        </div>
        <div class="bot-message">
            <p>thinking...</p>
        </div>
    </div>
`;
