const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
// Get the data from the parent
const data = window?.parent?.addyAIData;
let interactiveMode = false;
let widgetId = null;
let previousQuestionsAndAnswers = [];
let interactiveSectionState = [];
let currentQuestionIndex = 0;
let lastKnownQuestionUIState = {};
let previousWidgetIframeHeight = null;

const TOTAL_EXPECTED_QUESTIONS = 15;

let backendAPI = data.env == "development" ? "https://backend-dev-111911035666.us-central1.run.app" : "https://backend-prod-zquodzeuva-uc.a.run.app"

if (data.env == "test-local") {
    backendAPI = "http://localhost:8080";
}

data.primaryColor = data?.leadFunnelWidgetsConfig?.primaryColor ||
    data?.primaryColor || "#745DDE";

window.addEventListener("load", async function () {
    initializeWidgets();
    listenForInteractiveResponse();
});

const iconImageLookup = {
    "refinance": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/reload.svg",
    "buy-home": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/home.svg",
    "rates": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/chart.svg",
}

function initializeWidgets() {
    data.leadFunnelWidgets.forEach(widget => {
        const widgetCard = createWidgetCard({...widget,
            iconImage: iconImageLookup[widget.id] || "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/home.svg"
        });
        document.body.querySelector(".addy-widget-card-container").appendChild(widgetCard);
        // Add event listener to the button
        widgetCard.querySelector("button").addEventListener("click", () => {
            interactiveMode = true;
            widgetId = widget.id;
            createAgentView(widget);
        });
    });
    // Add widget styles to the window.parent.document.body
    let widgetStylesContent = widgetStyles;
    // Replace all ; with ' !important;` To overide parent styles
    // !important is not allowed inside @keyframes, so we need to remove it
    console.log("Widget styles content", widgetStylesContent);
    window.parent.document.head.appendChild(document.createElement("style")).textContent = widgetStylesContent;
}

function startFullScreenInteractiveMode(agentView) {
    // Create an overlay, add to window.parent.document.body z-index,
    // and then append the agent view to the overlay
    const overlay = document.createElement("div");
    overlay.setAttribute("class", "addy-agent-view-overlay");
    window.parent.document.body.appendChild(overlay);

    // Append the agent view to the overlay
    overlay.appendChild(agentView);
}

function endFullScreenInteractiveMode() {
    // I feel like this could be useful one day
}

function createWidgetCard(widget) {
    let widgetCard = document.createElement("div");
    widgetCard.setAttribute("class", "addy-widget-card-parent");
    
    // Create a copy of the template
    let template = widgetCardHTMLTemplate.replaceAll("{{primaryColor}}", data.primaryColor);
    
    // Replace all occurrences of {{key}} with the corresponding value
    Object.keys(widget).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, widget[key]);
    });
    
    widgetCard.innerHTML = template;
    return widgetCard;
}

function closeTheView() {
    // Get agent view
    const agentView = window.parent.document.body.querySelector(".addy-agent-view");
    if (agentView) {
        // Remove the overlay
        const overlay = window.parent.document.body.querySelector(".addy-agent-view-overlay");
        if (overlay) {
            overlay.remove();
        }
        agentView.remove();
        endFullScreenInteractiveMode();
    }
}

async function createAgentView(widget) {
    // Create a full screen overlay with a close button at the top right
    // The overlay should be scrollable and have the class "addy-custom-scroll"
    let agentView = document.createElement("div");
    agentView.setAttribute("class", "addy-agent-view");
    agentView.innerHTML = `
        <div class="addy-agent-view-header-container">
            <button class="addy-close-button">
                <img src="https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/close.svg" />
            </button>
        </div>
    `;
    // Create a header which will have a progress bar and then right below will
    // be a back button to go back to the previous question.
    // Back button should be disabled if the user is on the first question.
    let header = document.createElement("div");
    header.setAttribute("class", "addy-agent-view-header");
    header.innerHTML = `
        <div class="addy-agent-view-progress-bar">
            <div class="addy-agent-view-progress-bar-fill" style="background-color: ${data.primaryColor};"></div>
        </div>
        <div class="addy-agent-view-header-back-button-container">
            <button class="addy-back-button">
                <img width="22" height="22" src="https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/back.svg" />
            </button>
            <!-- Three dots loader -->
            <div class="addy-three-dots-loader">
                <div class="dot-pulse"></div>
            </div>
            <p class="addy-agent-view-header-progress-text">0%</p>
        </div>
    `;
    let agentViewContent = document.createElement("div");
    agentViewContent.setAttribute("class", "addy-agent-view-content");

    agentViewContent.appendChild(header);

    agentView.appendChild(agentViewContent);
    // Get close button and create the action to close the agent view
    let closeButton = agentView.querySelector(".addy-close-button");
    closeButton.addEventListener("click", () => {
        closeTheView();
    });
    
    // Add back button click listener
    let backButton = agentView.querySelector(".addy-back-button");
    backButton.addEventListener("click", handleBackButtonClick);

    // document.body.appendChild(agentView);
    startFullScreenInteractiveMode(agentView);

    // Reset the current question index
    currentQuestionIndex = 0;
    interactiveSectionState = [];

    // Create the content
    getNextQuestion();
}



function handleBackButtonClick() {
    console.log("Handling back button click, current question index", currentQuestionIndex);
    if (currentQuestionIndex <= 0) return;

    // Get the previous question element using currentQuestionIndex - 1
    const previousQuestionElement = window.parent.document.querySelector(`.addy-agent-form-section[data-question-index="${currentQuestionIndex - 1}"]`);
    console.log("Looking for previous question element at index", currentQuestionIndex - 1);
    
    if (previousQuestionElement) {
        // console.log("Found previous question element", previousQuestionElement);
        // Hide all question elements
        window.parent.document.querySelectorAll('.addy-agent-form-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the previous question element
        previousQuestionElement.style.display = 'flex';

        // Decrement the current question index before calling handleNextQuestion
        currentQuestionIndex--;
        console.log("Decremented to new question index", currentQuestionIndex);
        
        // Don't increment the currentQuestionIndex in handleNextQuestion when going back
        window.isGoingBack = true;
        
        // Call handleNextQuestion with the stored state for this index
        if (interactiveSectionState[currentQuestionIndex]) {
            handleNextQuestion(interactiveSectionState[currentQuestionIndex]);
        }
        
        // Update progress bar and text
        const progressBar = window.parent.document.querySelector(".addy-agent-view-progress-bar-fill");
        const progressText = window.parent.document.querySelector(".addy-agent-view-header-progress-text");
        const progress = (currentQuestionIndex / TOTAL_EXPECTED_QUESTIONS) * 100;
        progressBar.style.width = `${progress}%`;
        progressBar.style.backgroundColor = data.primaryColor;
        progressText.textContent = `${Math.round(progress)}%`;
        
        // If we're back at the first question, hide the back button and progress text
        console.log("Current question index", currentQuestionIndex);
        if (currentQuestionIndex === 1) {
            console.log("Hiding back button and progress text");
            window.parent.document.querySelector(".addy-back-button").style.display = "none";
            progressText.style.display = "none";
            window.parent.document.querySelector(".addy-agent-view-progress-bar").style.display = "none";
        }
    } else {
        console.log("No previous question element found at index", currentQuestionIndex - 1);
    }
}

function handleNextQuestion(nextQuestion) {
    if (nextQuestion.type == "endOfFlow") {
        // Remove the current question element
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section").remove();
        // Get the last ".addy-agent-form-section" element and hide it
        const lastQuestionElement = window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section:last-child");
        if (lastQuestionElement) {
            lastQuestionElement.style.display = "none";
        }
        // Create success screen
        const successScreen = createSuccessScreen(nextQuestion);
        // Close button on click listener
        successScreen.querySelector(".addy-interactive-primary-button").addEventListener("click", () => {
            closeTheView();
        });
        
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-content").appendChild(successScreen);
        return;
    }    
    // Store the question state
    interactiveSectionState[currentQuestionIndex] = nextQuestion;
    
    // Only increment the current question index if we're not going back
    if (!window.isGoingBack) {
        currentQuestionIndex++;
    }
    
    // Check if we already have a question element at this index
    let nextQuestionElement = document.querySelector(`.addy-agent-form-section[data-question-index="${currentQuestionIndex}"]`);
    
    if (!nextQuestionElement) {
        // Create new question element if it doesn't exist
        nextQuestionElement = createNextQuestionElement(nextQuestion);
        nextQuestionElement.setAttribute('data-question-index', currentQuestionIndex);
        // "addy-agent-view" is now in the window.parent.document.body
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-content").appendChild(nextQuestionElement);
    }
    
    // Hide all question elements
    window.parent.document.querySelectorAll('.addy-agent-form-section').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show the current question element
    nextQuestionElement.style.display = 'flex';

    // Adjust the iframe height to fit the content
    const iframe = nextQuestionElement.querySelector(".addy-interactive-iframe");
    updateIframeHeightToItsContent(iframe, nextQuestion);

    // Add the next button on click listener
    addNextButtonOnClickListener(nextQuestionElement, nextQuestion);

    // Update progress bar and text
    const progressBar = window.parent.document.querySelector(".addy-agent-view-progress-bar-fill");
    const progressText = window.parent.document.querySelector(".addy-agent-view-header-progress-text");
    const progress = (currentQuestionIndex / TOTAL_EXPECTED_QUESTIONS) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.style.backgroundColor = data.primaryColor;
    progressText.textContent = `${Math.round(progress)}%`;

    // If the previousQuestionsAndAnswers array is < 2, don't show the back button
    if (previousQuestionsAndAnswers.length < 1) {
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "none";
        // Hide the progress text
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "none";
        // Hide the progress bar
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "none";
    } else {
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "block";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "block";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "block";
    }
    
    window.isGoingBack = false;
}

function addNextButtonOnClickListener(nextQuestionElement, nextQuestion) {
    const nextButton = nextQuestionElement.querySelector(".addy-interactive-primary-button");

    if (nextButton) {
        // console.log("Adding next button on click listener");
        if (nextQuestion.type == "rateQuote") {
            // Change next button text to "Continue full application"
            nextButton.innerHTML = nextQuestion.nextQuestion.buttonText;
            // Get the simple paragraph and insert right before the next button
            const simpleParagraph = createSimpleParagraph(nextQuestion.nextQuestion.continuePrompt);
            nextQuestionElement.insertBefore(simpleParagraph, nextButton);
        }
        nextButton.addEventListener("click", () => {
            // Remove the old click listener to prevent multiple bindings
            nextButton.removeEventListener("click", () => getNextQuestion());
            if (nextQuestion.type == "rateQuote") {
                // Redirect to the redirectUrl in new tab
                window.open(nextQuestion.nextQuestion.redirectUrl, "_blank");
            } else {
                getNextQuestion();
            }
        });
    }
}

function createSimpleParagraph(text) {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = text;
    paragraph.setAttribute("class", "addy-simple-paragraph");
    return paragraph;
}

function updateIframeHeightToItsContent(iframe, interactiveData) {
    if (!iframe) {
        return;
    };
    iframe.addEventListener('load', async () => {
        let additionalHeight = interactiveData?.type == "textInput" ? 20 : 20;
        if (interactiveData?.type == "rateQuote") {
            additionalHeight = 5;
        }
        
        const contentHeight = iframe.contentWindow.document.body.scrollHeight + additionalHeight;
        iframe.style.height = `${contentHeight}px`;
    });
}

function createNextQuestionElement(nextQuestion) {
    let nextQuestionElement = document.createElement("div");
    nextQuestionElement.setAttribute("class", "addy-agent-form-section");
    
    let questionData = nextQuestion?.nextQuestion;
    if (!questionData) {
        throw new Error("No question data found");
    }
    // If questionData is a string, parse it
    if (typeof questionData == "string") {
        questionData = JSON.parse(questionData);
    }
    // Question data found, create 
    // This is interactive mode
    let innerHTML = nextQuestionHTMLTemplate
        .replaceAll("{{question}}", questionData.question);

    nextQuestionElement.innerHTML = innerHTML;

    // Create the iframe to load the answer capture ui
    let iframe = document.createElement("iframe");
    iframe.setAttribute("class", "addy-interactive-iframe");
    // set border to none
    iframe.style.border = "none";
    iframe.setAttribute("srcdoc", nextQuestion.uiComponent);
    nextQuestionElement.appendChild(iframe);

    // Create a button if needed
    if (nextQuestion.type != "selector") {
        let nextButton = document.createElement("button");
        nextButton.setAttribute("class", "addy-interactive-primary-button");
        nextButton.innerHTML = "Next";
        nextButton.style.backgroundColor = data.primaryColor;
        nextButton.style.marginBottom = "10px";
        nextButton.style.marginTop = "20px";
        nextQuestionElement.appendChild(nextButton);
    }

    return nextQuestionElement;
}

function listenForInteractiveResponse() {
    // Add the listener to the parent window
    window.parent.addEventListener("message", (event) => {
        if (event.data.answerSelected) {
            // console.log("Answer selected", event.data.answerSelected);
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
            // Save the last known question UI state as the iframe srcdoc state
            lastKnownQuestionUIState[question] = event.data.answerSelected.uiState;

            // console.log("Previous questions and answers", previousQuestionsAndAnswers);
            
            // For selector type, get next question immediately
            // For other types, wait for the next button click
            if (event.data.answerSelected.type == "selector") {
                // console.log("Selector type, getting next question immediately");
                getNextQuestion();
            }
        }
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getNextQuestion() {
    // Have a little delay for better user experience
    await sleep(300);
    // If we have a previously answered question at the current index, use that instead of making a new API call
    if (interactiveSectionState[currentQuestionIndex]) {
        handleNextQuestion(interactiveSectionState[currentQuestionIndex]);
        return;
    }

    // If it's selector, then get next question instantly without waiting to click on next button
    // console.log("Getting next question");
    showLoader();
    const nextQuestionResponse = await makeAPICallForNextQuestion();
    // console.log("Next question response", nextQuestionResponse);
    if (nextQuestionResponse?.nextQuestion) {
        hideLoader();
        handleNextQuestion(nextQuestionResponse);
    }
}

function showLoader() {
    // Show the three dots loader
    const threeDotsLoader = window.parent.document.body.querySelector(".addy-three-dots-loader");
    if (threeDotsLoader) {
        threeDotsLoader.style.display = "flex";
    }
    // Hide agent form section
    const agentFormSections = window.parent.document.body.querySelectorAll(".addy-agent-form-section");
    if (agentFormSections) {
        agentFormSections.forEach(section => {
            section.style.visibility = "hidden";
        });
    }
}

function hideLoader() {
    // Hide the three dots loader
    const threeDotsLoader = window.parent.document.body.querySelector(".addy-three-dots-loader");
    if (threeDotsLoader) {
        threeDotsLoader.style.display = "none";
    }
    // Show agent form section
    const agentFormSections = window.parent.document.body.querySelectorAll(".addy-agent-form-section");
    if (agentFormSections) {
        agentFormSections.forEach(section => {
            section.style.visibility = "visible";
        });
    }
}

async function makeAPICallForNextQuestion() {
    const payload = {
        uid: "chatbot-website",
        agentPublicId: data.publicId,
        previousQuestionsAndAnswers: previousQuestionsAndAnswers,
        widgetId: widgetId,
    };
    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    };
    const response = await fetch(backendAPI + "/api/loan-pricing-agent/get-next-question", requestOptions)
        .then(response => {
            if (!response.ok) {
                if (response.status === 500) {
                    alert("Sorry something went wrong, please check your answer and try again.");
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            return data;
        })
        .catch(error => {
            console.error("Error making API call for next question", error);
        });
    return response;
}

function createSuccessScreen(nextQuestion) {
    // Parse next question as JSON
    if (typeof nextQuestion.nextQuestion == "string") {
        nextQuestion.nextQuestion = JSON.parse(nextQuestion.nextQuestion);
    }
    const successScreen = document.createElement("div");
    successScreen.setAttribute("class", "addy-agent-form-section addy-agent-success-screen");
    successScreen.innerHTML = successScreenHTML
        .replaceAll("{{title}}", nextQuestion.nextQuestion.title)
        .replaceAll("{{message}}", nextQuestion.nextQuestion.message)
        .replaceAll("{{closeButtonText}}", nextQuestion.nextQuestion.closeButtonText)
        .replaceAll("{{checkIcon}}", "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/check_green.svg");
    // Update the close button primary color
    successScreen.querySelector(".addy-interactive-primary-button").style.backgroundColor = data.primaryColor;
    return successScreen;
}

const widgetCardHTMLTemplate = `
<div class="addy-widget-card">
    <div class="addy-widget-card-header">
      <img src="{{iconImage}}" />
      <h2>{{name}}</h2>
    </div>
    
    <p>{{description}}</p>
    <button style="background-color: {{primaryColor}};">{{buttonText}}</button>
  </div>
`

const nextQuestionHTMLTemplate = `
    <div class="addy-agent-form-section-header">
        <!-- <img src="{{chatbotAvatarURL}}" /> -->
        <h2 class="addy-agent-form-section-question">{{question}}</h2>
    </div>
`

const successScreenHTML = `
    <div class="addy-agent-form-section-header" style="display: flex; flex-direction: column; align-items: center;">
        <div class="addy-agent-form-section-header-avatar-container" style="display: flex; gap: 15px; align-items: start; flex-direction: column; align-items: center;">
            <img width="30" height="30" src="{{checkIcon}}" />
            <h2 class="addy-agent-form-section-question" style="text-align: center; margin-top: 0px;">{{title}}</h2>
        </div>

        <p style="margin-bottom: 30px; margin-top: 0px; text-align: center; max-width: 80%;">{{message}}</p>

        <button class="addy-interactive-primary-button" style="max-width: 80%;">
            {{closeButtonText}}
        </button>
    </div>
`

const widgetStyles = `
    label {
        font-family: "Inter", sans-serif !important;
    }
    .addy-agent-view-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(5px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 99999;
    }

    .addy-agent-view {
        width: 90%;
        height: 87%;
        max-width: 600px;
        max-height: 800px;
        background-color: #FFFFFF;
        border-radius: 20px;
        padding: 25px;
        box-shadow: 0 0 10px 0 rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .addy-close-button {
        background-color: transparent !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 20px !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 50% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0px !important;
        box-shadow: none !important;
    }

    .addy-close-button:hover {
        background-color: rgba(0, 0, 0, 0.1) !important;
        transition: 0.3s all ease !important;
    }

    .addy-agent-view-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        flex: 1;
    }

    .addy-agent-view-header-container {
        display: flex;
        justify-content: flex-end;
        width: 100%;
    }

    .addy-back-button {
        background-color: transparent !important;
        border: none !important;
        cursor: pointer !important;
        font-size: 20px !important;
        width: 50px !important;
        height: 50px !important;
        border-radius: 50% !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0px !important;
        display: none;
        box-shadow: none !important;
    }

    .addy-back-button:hover {
        background-color: rgba(0, 0, 0, 0.1) !important;
        transition: 0.3s all ease !important;
    }
    .addy-agent-view-header-back-button-container {
        width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
    }

    .addy-agent-view-header-progress-text {
        font-size: 14px;
        color: #111;
        display: none;
        font-family: "Inter", sans-serif;
    }

    .addy-agent-view-header {
        width: 100%;
        max-width: 800px;
    }

    .addy-agent-view-progress-bar {
        width: 100%;
        height: 5px;
        background-color: rgb(242, 242, 242);
        border-radius: 4px;
        margin-bottom: 15px;
        overflow: hidden;
        position: relative;
        /* box-shadow: inset 0 1px 2px rgba(0,0,0,0.1); */
        display: block;
        display: none;
    }

    .addy-agent-view-progress-bar-fill {
        width: 0%;
        height: 100%;
        transition: width 0.3s ease-in-out;
        position: absolute;
        left: 0;
        top: 0;
        border-radius: 4px;
        display: block;
    }

    .addy-agent-view-header-progress-bar {
        width: 100%;
        height: 4px;
        background-color: #f0f0f0;
        border-radius: 2px;
        margin-bottom: 15px;
        overflow: hidden;
    }

    .addy-agent-view-header-progress-bar-fill {
        width: 0%;
        height: 100%;
        transition: width 0.3s ease-in-out;
    }

    .addy-agent-form-section {
        flex-direction: column;
        align-items: center;
        width: 100%;
    }

    .addy-agent-form-section-question {
        max-width: 500px;
        font-family: "Inter", sans-serif !important;
        color: #111 !important;
        font-size: 26px !important;
        line-height: 36px !important;
        text-align: center !important;
        letter-spacing: 0.025em !important;
    }

    .addy-interactive-primary-button {
        width: 100%;
        padding: 13px 15px;
        border-radius: 99999px;
        color: white;
        cursor: pointer;
        border: none;
        font-size: 16px;
        border: 2px solid transparent;
    }

    .addy-interactive-primary-button:hover {
        /* Make slightly bigger */
        transform: scale(1.02);
        transition: 0.3s all ease;
    }

    .addy-interactive-container {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .addy-interactive-iframe {
        width: 100%;
    }

    .addy-three-dots-loader {
        position: fixed;
        top: 50%;
        left: 50%;
        display: flex;
    }


    /**
     * ==============================================
     * Dot Pulse
     * ==============================================
     */
    .dot-pulse {
    position: relative;
    left: -9999px;
    width: 10px;
    height: 10px;
    border-radius: 5px;
    background-color: ${data.primaryColor};
    color: ${data.primaryColor};
    box-shadow: 9999px 0 0 -5px;
    animation: dot-pulse 1.5s infinite linear;
    animation-delay: 0.25s;
    }
    .dot-pulse::before, .dot-pulse::after {
    content: "";
    display: inline-block;
    position: absolute;
    top: 0;
    width: 10px;
    height: 10px;
    border-radius: 5px;
    background-color: ${data.primaryColor};
    color: ${data.primaryColor};
    }
    .dot-pulse::before {
    box-shadow: 9984px 0 0 -5px;
    animation: dot-pulse-before 1.5s infinite linear;
    animation-delay: 0s;
    }
    .dot-pulse::after {
    box-shadow: 10014px 0 0 -5px;
    animation: dot-pulse-after 1.5s infinite linear;
    animation-delay: 0.5s;
    }
    .addy-simple-paragraph {
        font-family: "Inter", sans-serif !important;
        color: #111 !important;
        font-size: 16px !important;
        line-height: 14px !important;
        margin: 10px !important;
    }

    @keyframes dot-pulse-before {
    0% {
        box-shadow: 9984px 0 0 -5px;
    }
    30% {
        box-shadow: 9984px 0 0 2px;
    }
    60%, 100% {
        box-shadow: 9984px 0 0 -5px;
    }
    }
    @keyframes dot-pulse {
    0% {
        box-shadow: 9999px 0 0 -5px;
    }
    30% {
        box-shadow: 9999px 0 0 2px;
    }
    60%, 100% {
        box-shadow: 9999px 0 0 -5px;
    }
    }
    @keyframes dot-pulse-after {
    0% {
        box-shadow: 10014px 0 0 -5px;
    }
    30% {
        box-shadow: 10014px 0 0 2px;
    }
    60%, 100% {
        box-shadow: 10014px 0 0 -5px;
    }
    }
`