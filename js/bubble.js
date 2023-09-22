const CHAT_BUBBLE_SIZE = 60;
const PRIMARY_COLOR = "#745DDE";
const CHAT_ICON_SRC = "https://i.imgur.com/lgFKiDS.png";
const CHAT_CLOSE_ICON_SRC = "https://i.imgur.com/hxm4A15.png";
const scriptTag = document.currentScript;

alert('hi')

let scriptLoaded = false;

const bubble = document.createElement("div");
bubble.style.backgroundColor = PRIMARY_COLOR;
bubble.style.position = "fixed";
bubble.style.cursor = "pointer";
bubble.style.bottom = "25px";
bubble.style.right = "20px";
bubble.style.left = "none";
bubble.style.width = `${CHAT_BUBBLE_SIZE}px`;
bubble.style.height = `${CHAT_BUBBLE_SIZE}px`;
bubble.style.borderRadius = `${Math.round(CHAT_BUBBLE_SIZE / 2)}px`;
bubble.style.boxShadow = "rgba(0, 0, 0, 0.24) 0px 3px 8px";
bubble.style.display = "flex";
bubble.style.alignItems = "center";
bubble.style.justifyContent = "center";
bubble.setAttribute("id", "addy-chat-bubble");


bubble.style.zIndex = 999999999;
bubble.style.transition = "0.3s all ease";


const chatIcon = document.createElement("img");
chatIcon.setAttribute("src", CHAT_ICON_SRC);
chatIcon.style.width = "60%";
chatIcon.style.height = "60%";
chatIcon.style.objectFit = "contain";


const closeIcon = document.createElement("img");
closeIcon.setAttribute("src", CHAT_CLOSE_ICON_SRC);
closeIcon.style.width = "40%";
closeIcon.style.height = "40%";
closeIcon.style.objectFit = "contain";
closeIcon.style.display = "none"; // Do not display in first load

bubble.append(chatIcon);
bubble.append(closeIcon);

const notification = document.createElement("div");
notification.style.position = "absolute";
notification.style.top = "-7px";
notification.style.right = "-1px";
notification.style.width = "20px";
notification.style.height = "20px";
notification.style.display = "flex";
notification.style.alignItems = "center";
notification.style.justifyContent = "center";
notification.style.borderRadius = "50%";
notification.style.backgroundColor = "#FA3E3E";
notification.style.color = "#FFFFFF";
notification.style.zIndex = 99999999;
notification.style.fontSize = "12px";
notification.innerHTML = "1";
bubble.append(notification);

let isFirstClick = true;

function handleSmallScreens() {
    window.innerHeight < 600 && (chatWindow.style.height = "70vh");
}

// Event listeners
bubble.addEventListener("mouseenter", () => {
    bubble.style.transform = "scale(1.05)";
});
bubble.addEventListener("mouseleave", () => {
    bubble.style.transform = "scale(1)";
});

bubble.addEventListener("click", () => {
    if (isFirstClick) {
        isFirstClick = false;
        notification.style.display = "none";
    }

    if (chatWindow.style.display === "none") {
        chatWindow.style.display = "flex";
        chatIcon.style.display = "none";
        closeIcon.style.display = "block";
    } else {
        chatWindow.style.display = "none";
        closeIcon.style.display = "none";
        chatIcon.style.display = "block";
    }
});

const chatWindow = document.createElement("div");
chatWindow.setAttribute("id", "chat-bubble-window");
chatWindow.style.position = "fixed";
chatWindow.style.flexDirection = "column";
chatWindow.style.justifyContent = "space-between";
chatWindow.style.bottom = "95px";
chatWindow.style.width = "85vw";
chatWindow.style.height = "70vh";
chatWindow.style.boxShadow = "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px";
chatWindow.style.display = "none";
chatWindow.style.borderRadius = "10px";
chatWindow.style.zIndex = 99999999;
chatWindow.style.overflow = "hidden";
chatWindow.style.right = "20px";
chatWindow.style.left = "none";
chatWindow.style.backgroundColor = "#FFFFFF";
window.addEventListener("resize", handleSmallScreens);
handleSmallScreens();



async function initialize() {
    chatWindow.innerHTML = `<iframe
      src="https://addy-ai.github.io/customer-inquiry-bot/?publicId=${scriptTag.id}&header=none"
      width="100%"
      height="100%"
      frameborder="0"
      ></iframe>`;
    document.body.append(chatWindow);
    await getChatBotData();
}

async function getChatBotData() {
    // Make a fetch request.
    document.body.append(bubble);
}

window.addEventListener("load", async function() {
    try {
        await initialize();
        scriptLoaded = true;
        console.log("Addy AI Chatbot successfully loaded.");
    } catch (error) {
        console.error("Error:", error);
    }
});

// Use the window.onerror event handler to attempt loading the script again if an error occurs.
window.onerror = async function (message, source, lineno, colno, error) {
    if (!scriptLoaded) {
        try {
            await initialize();
            scriptLoaded = true;
            console.log("CDN script loaded successfully after an error.");
        } catch (error) {
            console.error("Error:", error);
        }
    }
};

const screenSizeQuery = window.matchMedia("(min-width: 550px)");

function handleScreenSizeChange(event) {
    if (event.matches) {
        chatWindow.style.height = "600px";
        chatWindow.style.width = "480px";
    }
}

screenSizeQuery.addEventListener("change", handleScreenSizeChange);
handleScreenSizeChange(screenSizeQuery);