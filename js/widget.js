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
    "refinance": "./img/icons/reload.svg",
    "buy-a-home": "./img/icons/home.svg",
    "rates": "./img/icons/chart.svg",
}

function initializeWidgets() {
    data.leadFunnelWidgets.forEach(widget => {
        const widgetCard = createWidgetCard({...widget,
            iconImage: iconImageLookup[widget.id] || "./img/icons/home.svg"
        });
        document.body.querySelector(".addy-widget-card-container").appendChild(widgetCard);
        // Add event listener to the button
        widgetCard.querySelector("button").addEventListener("click", () => {
            interactiveMode = true;
            widgetId = widget.id;
            createAgentView(widget);
        });
    });
}

function startFullScreenInteractiveMode() {
    // Get the widgetIframe parent element
    const widgetIframeParent = window.parent.document.querySelector("#widgetIframe").parentElement;
    widgetIframeParent.style.height = "100vh";
    widgetIframeParent.style.width = "100vw";
    widgetIframeParent.style.position = "fixed";
    widgetIframeParent.style.top = "0";
    widgetIframeParent.style.left = "0";
    widgetIframeParent.style.backgroundColor = "#FFFFFF";
}

function endFullScreenInteractiveMode() {
    const widgetIframeParent = window.parent.document.querySelector("#widgetIframe").parentElement;
    widgetIframeParent.style.height = "unset";
    widgetIframeParent.style.width = "unset";
    widgetIframeParent.style.position = "unset";
    widgetIframeParent.style.top = "unset";
    widgetIframeParent.style.left = "unset";
    widgetIframeParent.style.backgroundColor = "unset";
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
    const agentView = document.body.querySelector(".addy-agent-view");
    if (agentView) {
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
        <button class="addy-close-button">
            <img src="./img/icons/close.svg" />
        </button>
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
                <img width="22" height="22" src="./img/icons/back.svg" />
            </button>

            <p class="addy-agent-view-header-progress-text">0%</p>
        </div>
    `;

    agentView.appendChild(header);
    // Get close button and create the action to close the agent view
    let closeButton = agentView.querySelector(".addy-close-button");
    closeButton.addEventListener("click", () => {
        closeTheView();
    });
    
    // Add back button click listener
    let backButton = agentView.querySelector(".addy-back-button");
    backButton.addEventListener("click", handleBackButtonClick);
    
    document.body.appendChild(agentView);
    startFullScreenInteractiveMode();

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
    const previousQuestionElement = document.querySelector(`.addy-agent-form-section[data-question-index="${currentQuestionIndex - 1}"]`);
    console.log("Looking for previous question element at index", currentQuestionIndex - 1);
    
    if (previousQuestionElement) {
        console.log("Found previous question element", previousQuestionElement);
        // Hide all question elements
        document.querySelectorAll('.addy-agent-form-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the previous question element
        previousQuestionElement.style.display = 'block';

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
        const progressBar = document.querySelector(".addy-agent-view-progress-bar-fill");
        const progressText = document.querySelector(".addy-agent-view-header-progress-text");
        const progress = (currentQuestionIndex / TOTAL_EXPECTED_QUESTIONS) * 100;
        progressBar.style.width = `${progress}%`;
        progressBar.style.backgroundColor = data.primaryColor;
        progressText.textContent = `${Math.round(progress)}%`;
        
        // If we're back at the first question, hide the back button and progress text
        console.log("Current question index", currentQuestionIndex);
        if (currentQuestionIndex === 1) {
            console.log("Hiding back button and progress text");
            document.querySelector(".addy-back-button").style.display = "none";
            progressText.style.display = "none";
            document.querySelector(".addy-agent-view-progress-bar").style.display = "none";
        }
    } else {
        console.log("No previous question element found at index", currentQuestionIndex - 1);
    }
}

function handleNextQuestion(nextQuestion) {
    if (nextQuestion.type == "endOfFlow") {
        // Remove the current question element
        document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section").remove();
        // Get the last ".addy-agent-form-section" element and hide it
        const lastQuestionElement = document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section:last-child");
        lastQuestionElement.style.display = "none";
        // Create success screen
        const successScreen = createSuccessScreen(nextQuestion);
        document.body.querySelector(".addy-agent-view").appendChild(successScreen);
        // Close button on click listener
        successScreen.querySelector(".addy-interactive-primary-button").addEventListener("click", () => {
            closeTheView();
        });
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
        document.body.querySelector(".addy-agent-view").appendChild(nextQuestionElement);
    }
    
    // Hide all question elements
    document.querySelectorAll('.addy-agent-form-section').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show the current question element
    nextQuestionElement.style.display = 'block';

    // Adjust the iframe height to fit the content
    const iframe = nextQuestionElement.querySelector(".addy-interactive-iframe");
    updateIframeHeightToItsContent(iframe, nextQuestion);

    // Add the next button on click listener
    addNextButtonOnClickListener(nextQuestionElement);

    // Update progress bar and text
    const progressBar = document.querySelector(".addy-agent-view-progress-bar-fill");
    const progressText = document.querySelector(".addy-agent-view-header-progress-text");
    const progress = (currentQuestionIndex / TOTAL_EXPECTED_QUESTIONS) * 100;
    progressBar.style.width = `${progress}%`;
    progressBar.style.backgroundColor = data.primaryColor;
    progressText.textContent = `${Math.round(progress)}%`;

    // If the previousQuestionsAndAnswers array is < 2, don't show the back button
    if (previousQuestionsAndAnswers.length < 1) {
        document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "none";
        // Hide the progress text
        document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "none";
        // Hide the progress bar
        document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "none";
    } else {
        document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "block";
        document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "block";
        document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "block";
    }
    
    window.isGoingBack = false;
}

function addNextButtonOnClickListener(nextQuestionElement) {
    const nextButton = nextQuestionElement.querySelector(".addy-interactive-primary-button");
    if (nextButton) {
        // console.log("Adding next button on click listener");
        nextButton.addEventListener("click", () => {
            // Remove the old click listener to prevent multiple bindings
            nextButton.removeEventListener("click", () => getNextQuestion());
            getNextQuestion();
        });
    }
}

function updateIframeHeightToItsContent(iframe, interactiveData) {
    if (!iframe) return;
    iframe.addEventListener('load', async () => {
        const contentHeight = iframe.contentWindow.document.body.scrollHeight + (interactiveData?.type == "textInput" ? 20 : 5);
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
    questionData = JSON.parse(questionData);
    // Question data found, create 
    // This is interactive mode
    let innerHTML = nextQuestionHTMLTemplate
        .replaceAll("{{question}}", questionData.question);

    nextQuestionElement.innerHTML = innerHTML;

    // Create the iframe to load the answer capture ui
    let iframe = document.createElement("iframe");
    iframe.setAttribute("class", "addy-interactive-iframe");
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
    // Window listen for postMessage
    window.addEventListener("message", (event) => {
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
                getNextQuestion();
            }
        }
    });
}

async function getNextQuestion() {
    // If we have a previously answered question at the current index, use that instead of making a new API call
    if (interactiveSectionState[currentQuestionIndex]) {
        handleNextQuestion(interactiveSectionState[currentQuestionIndex]);
        return;
    }

    // If it's selector, then get next question instantly without waiting to click on next button
    // console.log("Getting next question");
    const nextQuestionResponse = await makeAPICallForNextQuestion();
    // console.log("Next question response", nextQuestionResponse);
    if (nextQuestionResponse?.nextQuestion) {
        handleNextQuestion(nextQuestionResponse);
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
        .replaceAll("{{checkIcon}}", "./img/icons/check_green.svg");
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
    <div class="addy-agent-form-section-header">
        <div class="addy-agent-form-section-header-avatar-container" style="display: flex; gap: 15px; align-items: start;">
            <img width="30" height="30" src="{{checkIcon}}" />
            <h2 class="addy-agent-form-section-question" style="text-align: left; margin-top: 0px;">{{title}}</h2>
        </div>

        <p style="margin-bottom: 30px; margin-top: 0px; text-align: center;">{{message}}</p>

        <button class="addy-interactive-primary-button">
            {{closeButtonText}}
        </button>
    </div>
`