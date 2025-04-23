const scriptTag = document.currentScript;
window.chatbotScriptLoaded = false;
window.isChatbotFirstClick = true;

// console.log("Bubble script loaded");

// 0. Init the steps
window.addEventListener("load", async function () {
    try {
        // 1. Get info for bubble and chatbox
        let data = await getChatBotData();
        // console.log("data fetched", data);
        if (!data) {
            // Some error occured
            console.error("Error: No data found");
            return;
        }
        // console.table({ data })

        // 2. Create Chatbox and append to body
        let chatbox = createChatbox(data);
        // console.log("Chatbox created");

        // 3. Create Bubble Components and append to body, to toggle chatbox
        createBubbleComponents(chatbox, data);
        // console.log("Bubble components created");

        chatbotScriptLoaded = true;
        // console.log("Addy AI Chatbot successfully loaded.");
    } catch (error) {
        console.error("Error:", error);
    }
});

// 1. Retrieve Business Information passing scriptTag.id, location.host, and a retrieved or created uuid to Backend.
async function getChatBotData() {
    let env = scriptTag?.getAttribute("env") || "development";
    let backend = url = window.location.host === ''
        ? "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer/bot-info-public"
        : "https://us-central1-hey-addy-chatgpt.cloudfunctions.net/businessInference/infer/bot-info-public"
    if (env == "development") {
        backend = "https://us-central1-addy-ai-dev.cloudfunctions.net/businessInference/infer/bot-info-public";
    }
    if (env == "test") {
        backend = "http://127.0.0.1:5003/addy-ai-dev/us-central1/businessInference/infer/bot-info-public";
    }
    if (env == "test-local") {
        backend = "http://localhost:8080/embeddingsInference/infer/bot-info-public";
    }
    // backend =
    //   "http://127.0.0.1:5003/addy-ai-dev/us-central1/businessInference/infer/bot-info-public";
    const publicId = scriptTag.id;
    const host = window.location.host;
    const data = await fetch(`${backend}/?publicId=${publicId}&host=${host}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    })
    .then((response) => response.json())
    .then(data => { 
        if (!data.success) throw new Error("Error: No data found");
        const dataWithWidgets = {
            ...data?.data?.config,
            leadFunnelWidgets: data?.data?.leadFunnelWidgets,
            leadFunnelWidgetsConfig: data?.data?.leadFunnelWidgetsConfig,
        }
        return dataWithWidgets;
    })
    .catch((error) => {
        console.error("Error", error);
        return undefined;
    });
    
    if (!data) return undefined;
    data.primaryColor ||= "#745DDE";
    data.primaryColorName ||= "Purple";
    data.publicId = scriptTag.id;
    data.host = window.location.host;
    data.env = env;
    return data;
}

function createWidgetView(data) {

    let widgetView = document.createElement("div");
    widgetView.setAttribute("id", "widgetView");

    const widgetIframe = document.createElement("iframe");
    widgetIframe.setAttribute("id", "widgetIframe");
    widgetIframe.setAttribute("class", "addy-interactive-iframe");
    widgetIframe.style.width = "100%";
    widgetIframe.style.paddingTop = "30px";
    widgetIframe.style.paddingBottom = "30px";
    // console.log("Widget iframe created", widgetIframe);
  
    widgetIframe.style.border = "none";

    const styleSheetLink = scriptTag.getAttribute("env") &&
        scriptTag.getAttribute("env").includes("local") ?
        "css/style.css" :
        "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/css/style.min.css";

    const widgetJSLink = scriptTag.getAttribute("env") &&
        scriptTag.getAttribute("env").includes("local") ?
        "js/widget.js" :
        "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/js/widget.min.js";

    let htmlCode = widgetIframeHTML;
    htmlCode = htmlCode.replace("{{styleSheetLink}}", styleSheetLink);
    htmlCode = htmlCode.replace("{{widgetJSLink}}", widgetJSLink);
    
    widgetIframe.setAttribute("srcdoc", htmlCode);
    // if env is development, use the local css file
    
    window.addyAIData = data;
    // console.log("Widget iframe set", widgetIframe);
    widgetView.append(widgetIframe);
    // console.log("Widget view appended", widgetView);
    // Get the container where addy-widget-id is set to the scriptTag.id
    const widgetContainer = document.querySelector(`[addy-widget-id="${scriptTag.id}"]`);
    // console.log("Widget container found", widgetContainer);
    if (!widgetContainer) {
        console.error("Widget container not found");
        return;
    }
    widgetContainer.append(widgetView);
    // console.log("Widget container appended", widgetContainer);
    // After widget is loaded, set the iframe height to fit the content
    widgetIframe.onload = () => {
        // console.log("Widget iframe loaded");
        // get the actual scroll height of the contents of the iframe
        updateIframeHeightToItsContent(widgetIframe);
    }   
}

// When the widget is resized, update the iframe height to fit the content
window.addEventListener("resize", () => {
    const widgetIframe = document.getElementById("widgetIframe");
    updateIframeHeightToItsContent(widgetIframe);
});

function updateIframeHeightToItsContent(iframe) {
    const scrollHeight = iframe.contentWindow.document.body.scrollHeight;
    iframe.style.height = `${scrollHeight + 200}px`;
}

// 2. Create the Chatbox which is shown on-click
function createChatbox(data) {
    let slug = `?publicId=${scriptTag.id}&header=none&data=${encodeURIComponent(JSON.stringify(data))}`
    const url = window.location.host === ''
        ? `file://${window.location.pathname.replace('testpage.html', 'index.html')}${slug}`
        : `https://addy-ai.github.io/customer-inquiry-bot/${slug}`;

    /*
    console.table({host:window.location.host, path:window.location.pathname, url, 'scriptTag': scriptTag.id}) 
    // console.log({url}) */
    const chatBox = document.createElement("div");
    chatBox.setAttribute("id", "chatBubbleWindow");
    Object.assign(chatBox.style, {
        position: "fixed",
        zIndex: 99999999,
        bottom: "95px",
        right: "20px",
        left: "none",
        display: "none",
        boxShadow: "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px",
        overflow: "hidden",
        height: window.innerHeight < 600 ? "70vh": "600px",
        width: window.innerWidth < 1000 ? "90vw" : "500px",
        borderRadius: '20px',
    });

    chatBox.innerHTML = `<iframe src="${url}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    document.body.append(chatBox);

    function handleSmallScreens() {
        window.innerHeight < 600 && (chatBox.style.height = "70vh");
    }

    window.addEventListener("resize", handleSmallScreens);
    handleSmallScreens();

    const screenSizeQuery = window.matchMedia("(min-width: 550px)");

    function handleScreenSizeChange(event) {
        if (event.matches) {
            chatBox.style.height = window.innerHeight < 600 ? "70vh": "600px";
            chatBox.style.width = window.innerWidth < 1000 ? "90vw" : "500px";
        }
    }
    screenSizeQuery.addEventListener("change", handleScreenSizeChange);
    handleScreenSizeChange(screenSizeQuery);
    return chatBox;
}
function createNotification() {
    const notification = document.createElement("div");
    notification.innerHTML = "1";
    Object.assign(notification.style, {
        position: "absolute",
        top: "-7px",
        right: "-1px",
        width: "20px",
        height: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        backgroundColor: "#FA3E3E",
        color: "#FFFFFF",
        zIndex: 99999999,
        fontSize: "12px"
    });
    return notification
}
function createCloseIcon() {
    const closeIcon = document.createElement("img");
    closeIcon.setAttribute("src", "https://i.imgur.com/hxm4A15.png");
    Object.assign(closeIcon.style, {
        width: "40%",
        height: "40%",
        objectFit: "contain",
        display: "none"
    });
    return closeIcon
}
function createChatIcon() {
    const chatIcon = document.createElement("img");
    chatIcon.setAttribute("src", "https://i.imgur.com/lgFKiDS.png");
    Object.assign(chatIcon.style, {
        width: "60%",
        height: "60%",
        objectFit: "contain"
    });
    return chatIcon
}
function createBubble(data) {
    const CHAT_BUBBLE_SIZE = 60;

    const bubble = document.createElement("div");
    bubble.setAttribute("id", "addy-chat-bubble");
    Object.assign(bubble.style, {
        backgroundColor: data.primaryColor,
        position: "fixed",
        cursor: "pointer",
        bottom: "25px",
        right: "20px",
        left: "none",
        width: `${CHAT_BUBBLE_SIZE}px`,
        height: `${CHAT_BUBBLE_SIZE}px`,
        borderRadius: `${Math.round(CHAT_BUBBLE_SIZE / 2)}px`,
        boxShadow: "rgba(0, 0, 0, 0.24) 0px 3px 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 999999999,
        transition: "0.3s all ease"
    });
    return bubble
}

function updateWidgetDimensions(widget, data) {
    if (!widget) return;
   
    widget.style.width = (window.innerWidth < 1000) ? "90vw" : "500px",
    widget.style.height = (window.innerHeight < 600) ? "70vh": "600px";
}

// 3. Create the Bubble Components which are shown on-start
function createBubbleComponents(chatbox, data) {
    // console.log({ chatbox })
    let bubble = createBubble(data);

    let chatIcon = createChatIcon(); bubble.append(chatIcon);
    let closeIcon = createCloseIcon(); bubble.append(closeIcon);
    let notification = createNotification(); bubble.append(notification);
    document.body.append(bubble);

    // Event listeners
    bubble.addEventListener("mouseenter", () => { bubble.style.transform = "scale(1.05)"; });
    bubble.addEventListener("mouseleave", () => { bubble.style.transform = "scale(1)"; });
    let toggleView = (e) => { 
        e.preventDefault();
        updateWidgetDimensions(chatbox, data);
        // chatbox.style.width = "90vw";
        {
            if (isChatbotFirstClick) {
                isChatbotFirstClick = false;
                notification.style.display = "none";
            }
            if (chatbox.style.display === "none") {
                chatbox.style.display = "flex";
                chatIcon.style.display = "none";
                closeIcon.style.display = "block";
            } else {
                chatbox.style.display = "none";
                closeIcon.style.display = "none";
                chatIcon.style.display = "block";
            }
        }
    }
    
    bubble.addEventListener('touchend', toggleView);
    bubble.addEventListener('click', toggleView);
    
}

const widgetIframeHTML = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <title>Addy AI Widget</title>
    <link rel="stylesheet" href="{{styleSheetLink}}">
</head> 

<body>
    <div class="addy-widget-container">

        <div></div>
        <div class="addy-widget-card-container">

        </div>
    </div>
    
    <script type="text/javascript" src="{{widgetJSLink}}"></script>
</body>
</html>
`