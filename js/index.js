
// Values to be replaced
let chatbotName = undefined;
let chatbotAvatarURL = undefined;
let customerAvatarURL = "https://i.imgur.com/vphoLPW.png";
let customerName = "You";
let chatbotAPI = "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer";

const currentUrl = window.location.href;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const publicId = (urlParams.get("publicId")) == null ? undefined :
    urlParams.get("publicId"); // public ID of chatbot
const showHeader = (urlParams.get("header")) == null ? undefined :
    urlParams.get("header");

const chatHistory = document.getElementById("chat-history");
const sendBtn = document.getElementById("send-btn");
const messageInput = document.getElementById("message-input");
const container = document.querySelector(".chat-container");
const header = document.querySelector(".header-container");

// Send button is disabled by default until input len > 1
sendBtn.disabled = true;

window.onload = async function () {
    initializeBot(); // jumpstart this bot
}

function addMessageToChat(message, type) {
    const messageElem = document.createElement("div");
    if (type == "customer") {
        messageElem.setAttribute("class", "message-customer-parent");
        messageElem.innerHTML = customerMessageHTML.replace("{{message}}", message);
    }
    chatHistory.append(messageElem);
}

function createBotMessageElement(message, botInfo) {
    const messageId = `bot-message-${Date.now()}`;
    const messageElem = document.createElement("div");

    messageElem.setAttribute("class", "message-chatbot-parent");
    let innerHTML = chatbotMessageHTML.replace("{{messageId}}", messageId);
    // Replace, name, message, avatar URL
    innerHTML = innerHTML.replace("{{chatbotName}}", botInfo.name);
    innerHTML = innerHTML.replace("{{chatbotAvatarURL}}", botInfo.avatarURL);
    innerHTML = innerHTML.replace("{{message}}", message);
    messageElem.innerHTML = innerHTML;

    chatHistory.append(messageElem);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageId;
}

function initializeBot() {
    // Show loading
    const loadingView = document.querySelector(".loading-overlay");
    const mainView = document.querySelector(".main-container");

    if (mainView) mainView.style.display = "none"; // Hide main view
    if (loadingView) loadingView.style.display = "flex"; // Show loading view

    // If no public id, show error
    if (!publicId) {
        showError(loadingView, "Error: Invalid Bot");
        return;
    }
    // Get the bot information. 
    fetch(`${chatbotAPI}/bot-info-public?publicId=${publicId}`)
        .then(response => response.json())
        .then(data => {
            const botInfo = data.data;
            if (!botInfo) {
                showError(loadingView);
                return;
            }
            // if (!botInfo.published) {
            //     // Bot not published
            //     showError(loadingView);
            //     return;
            // }
            // Bot info is available
            chatbotName = botInfo.name; // set name
            chatbotAvatarURL = botInfo.avatarURL; // set avatar URL
            
            // Show the bot view, then get first message
            if (loadingView) loadingView.style.display = "none";
            if (mainView) mainView.style.display = "block";
            updateHeader(botInfo);
            onSendButtonClick(publicId, botInfo); // Activate send button
            showBotWelcomeMessage(publicId, botInfo);
        }).catch((err) => {
            console.error("Addy AI Error: ", err);
            showError(loadingView);
        })
}

function updateHeader(botInfo) {
    if (header) {
        header.innerHTML = botInfo.name;
    }
    // Change title
    document.title = botInfo.name;
}

function checkIfBotIsPublished(botInfo, loadingView) {

}

function showError(element, text) {
    if (element) {
        element.innerHTML = text ? text : "Error: Chatbot not found"
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


            // show thinking element
            const thinkingElem = document.createElement("div");
            thinkingElem.setAttribute("class", "message-chatbot-parent");
            let thinkingInnerHTML = chatbotThinking;
            thinkingInnerHTML = thinkingInnerHTML
                .replaceAll("{{chatbotAvatarURL}}", botInfo.avatarURL);
            thinkingInnerHTML = thinkingInnerHTML.replaceAll("{{chatbotName}}", botInfo.name);
            
            setTimeout(() => {
                thinkingElem.innerHTML = thinkingInnerHTML;
                chatHistory.append(thinkingElem);
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }, 400);

            // There's an element to fetch message in
            fetch(`${chatbotAPI}/qa?user_query=${message}&publicId=${publicId}`)
                .then(response => response.json())
                .then(data => {
                    // remove thinking
                    thinkingElem.style.display = "none";
                    if (data.response) {
                        createBotMessageElement(data.response, botInfo);
                    } else {
                        createBotMessageElement("Sorry I could not understand your question", botInfo);
                    }
                    chatHistory.scrollTop = chatHistory.scrollHeight;

                }).catch((error) => {
                    thinkingElem.style.display = "none";
                    createBotMessageElement("Oops... I had a glitch :( My engineers are working on it", botInfo);

                })
        }
    });
}


// Send button only visible when input text value > 1 character
messageInput.addEventListener('input', () => {
    // Get trimmed value of input
    const trimmedValue = messageInput.value.trim();

    // Enable/disable send button based on input value
    if (trimmedValue.length > 1) {
        sendBtn.disabled = false;
    } else {
        sendBtn.disabled = true;
    }
});


const customerMessageHTML = `
    <div class="message customer">
        <div class="horizontal-flex flex-end">
            <img class="avatar" src="${customerAvatarURL}">
            <div class="text">
                <span class="name">${customerName}</span>
                <p>{{message}}</p>
            </div>
        </div>
        
    </div>

`;

const chatbotMessageHTML = `
    <div class="message chatbot">
        <img class="avatar" src="{{chatbotAvatarURL}}">
        <div class="text">
            <span class="name" id="chatbot-name">{{chatbotName}}</span>
            <p id="{{messageId}}">{{message}}</p>
        </div>
    </div>
`;

const chatbotThinking = `
    <div class="message chatbot">
        <img class="avatar" src="{{chatbotAvatarURL}}">
        <div class="text">
            <span class="name" id="chatbot-name">{{chatbotName}}</span>
            <p id="{{messageId}}">thinking...</p>
        </div>
    </div>
`;

