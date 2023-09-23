console.log('starting on index.js')

// Get Config from Iframe container's URL
const currentUrl = window.location.href;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const data = JSON.parse(decodeURIComponent(urlParams.get('data')))

// Defaults
data.avatarURL ||= "https://i.imgur.com/xoP7CyF.png";
data.name ||= "My Chatbot"
data.chatbotName ||= "Addy";
data.welcomeMessage ||= "Hello! How can I help you today?";
data.inputPlaceholder ||= "Ask me anything...";
data.quickPrompts = (data && Array.isArray(data.quickPrompts) && data.quickPrompts.length > 0)
    ? data.quickPrompts
    : [
        {id: '1', title: 'help', prompt: 'How can you help?'},
        {id: '2', title: 'order', prompt: 'Find my order.'},
        {id: '3', title: 'help', prompt: 'How can you help?'},
        {id: '4', title: 'order', prompt: 'Find my order.'},
        {id: '5', title: 'help', prompt: 'How can you help?'},
        {id: '6', title: 'order', prompt: 'Find my order.'},
        {id: '7', title: 'help', prompt: 'How can you help?'},
        {id: '8', title: 'order', prompt: 'Find my order.'},
    ];

data.primaryColor ||= "#745DDE";
data.primaryColorName ||= "Purple";

data.chatId = uuidv4();
localStorage.setItem('chatId', data.chatId);

data.primaryColor && document.documentElement.style.setProperty('--user-message-color', data.primaryColor);

console.log(data)
/*
SAMPLE DATA
avatarURL: "https://i.imgur.com/xoP7CyF.png"
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
let chatbotAPI = "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer";

const chatHistory = document.querySelector("#chat-history");
const sendBtn = document.querySelector("#send-btn");
const messageInput = document.querySelector("#message-input"); 
const header = document.querySelector(".header");
const promptContainer = document.querySelector(".auto-prompts-container");

sendBtn.disabled = true;

window.onload = async function () {
    initializeBot();
}

function addMessageToChat(message, type) {
    const messageElem = document.createElement("div");
    if (type == "customer") {
        messageElem.setAttribute("class", "user-message-container");
        messageElem.innerHTML = customerMessageHTML.replace("{{message}}", message);
    }
    chatHistory.append(messageElem);
}

function createBotMessageElement(message) {
    const messageId = `bot-message-${Date.now()}`;
    const messageElem = document.createElement("div");

    messageElem.setAttribute("class", "bot-message-container");
    let innerHTML = chatbotMessageHTML.replace("{{messageId}}", messageId);
    innerHTML = innerHTML.replace("{{chatbotName}}", data.chatbotName);
    innerHTML = innerHTML.replace("{{chatbotAvatarURL}}", data.avatarURL);
    innerHTML = innerHTML.replace("{{message}}", message);
    messageElem.innerHTML = innerHTML;

    chatHistory.append(messageElem);
    chatHistory.scrollTop = chatHistory.scrollHeight;

    return messageId;
}

function initializeBot() {
    console.log('loading bot')
    const loadingView = document.querySelector(".loading-view"); 
    if (loadingView) loadingView.style.display = "flex";

    if (!data.publicId) {
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
            autoPromptDiv.innerHTML = `<p>${prompt.prompt}</p>`;
            autoPromptsContainer.appendChild(autoPromptDiv);

            // Add event listener to each auto-prompt
            autoPromptDiv.addEventListener('click', function () {
                messageInput.value = autoPromptDiv.textContent || autoPromptDiv.innerText; // Use textContent or innerText to get only the text, not HTML
                submitText()
            });
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

function onSendButtonClick() {
    sendBtn.addEventListener("click", () => {
        console.log('clicked')
        const message = messageInput.value;
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

            fetch(`${chatbotAPI}/qa?user_query=${message}&publicId=${data.publicId}&host=${data.host}&chatId=${data.chatId}`)
                .then(response => response.json())
                .then(data => {
                    thinkingElem.style.display = "none";
                    if (data.response) {
                        createBotMessageElement(data.response);
                    } else {
                        createBotMessageElement("Sorry, I could not understand your question");
                    }
                    chatHistory.scrollTop = chatHistory.scrollHeight;
                }).catch((error) => {
                    thinkingElem.style.display = "none";
                    createBotMessageElement("Oops... I had a glitch :( My engineers are working on it");
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
