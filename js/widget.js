const scriptTag = document.currentScript;
const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
// Get the data from the parent
let data = {};
let interactiveMode = false;
let widgetId = null;
let previousQuestionsAndAnswers = [];
let interactiveSectionState = [];
let currentQuestionIndex = 0;
let lastKnownQuestionUIState = {};
let previousWidgetIframeHeight = null;
let progressSnapshots = [];

let TOTAL_EXPECTED_QUESTIONS = 15;
const USE_MOCK_DATA = false;
let mockData = {
    leadFunnelWidgetsConfig: {
        heroSection: {
            title: "John Doe",
            description: "Horizon Mortgage",
            image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face"
        },
        social: {
            facebook: {
                url: "https://facebook.com/",
                icon: "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/facebook.svg"
            },
            instagram: {
                url: "https://instagram.com/",
                icon: "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/instagram.svg"
            },
            youtube: {
                url: "https://youtube.com/",
                icon: "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/youtube.svg"
            }
        }
    },
};

let backendAPI;

window.addEventListener("load", async function () {
    data = await getChatBotData();
    if (!data) {
        console.error("Error: No data found");
        return;
    };
    // console.log("Data", data);
    let env = scriptTag.getAttribute("env") || "development";
    const mode = scriptTag.getAttribute("mode") || "widget";
    
    // Set the data object
    data.env = env;
    data.mode = mode;
    data.primaryColor = data?.leadFunnelWidgetsConfig?.primaryColor || data?.primaryColor || "#745DDE";
    
    // Initialize leadFunnelWidgetsConfig for home mode if not present
    if (mode === "home") {
        if (!data.leadFunnelWidgetsConfig) {
            data.leadFunnelWidgetsConfig = {};
        }
        
        // Use mock data for testing if enabled
        if (USE_MOCK_DATA) {
            data.leadFunnelWidgetsConfig.heroSection = mockData.leadFunnelWidgetsConfig.heroSection;
            data.leadFunnelWidgetsConfig.social = mockData.leadFunnelWidgetsConfig.social;
        }
    }
    
    // Set the CSS variable for primary color
    document.documentElement.style.setProperty('--primary-color', data.primaryColor);
    
    backendAPI = data.env == "development" ? "https://backend-dev-111911035666.us-central1.run.app" : "https://backend-prod-zquodzeuva-uc.a.run.app"

    if (data.env == "test-local") {
        backendAPI = "http://localhost:8080";
    }

    // Render home mode specific sections
    if (mode === "home") {
        renderHeroSection(data.leadFunnelWidgetsConfig?.heroSection || mockData.leadFunnelWidgetsConfig.heroSection);
        renderSocialIcons(data.leadFunnelWidgetsConfig?.social || mockData.leadFunnelWidgetsConfig.social);
    }

    // Get the widget ids to create from the scriptTag and the widget ids in the data
    const widgetIdsToRender = scriptTag.getAttribute("widgets")?.split(",") || [];
    const agentPublicId = scriptTag.id;
    initializeWidgets(widgetIdsToRender, agentPublicId);
    listenForInteractiveResponse();

    // Expose global function to programmatically trigger widgets
    window.addyTriggerWidget = function(targetWidgetId) {
        // Validate inputs
        if (!targetWidgetId || typeof targetWidgetId !== 'string') {
            console.error('[Addy Widget] Invalid widget ID provided');
            return false;
        }

        // Check if widget is in the configured list to render
        if (!widgetIdsToRender.includes(targetWidgetId)) {
            console.error(`[Addy Widget] Widget "${targetWidgetId}" is not configured for this agent. Available widgets: ${widgetIdsToRender.join(', ')}`);
            return false;
        }

        // Find the widget from the loaded data
        const widget = data.leadFunnelWidgets.find(w => w.id === targetWidgetId);
        if (!widget) {
            console.error(`[Addy Widget] Widget "${targetWidgetId}" not found in agent configuration`);
            return false;
        }

        // Set the interactive mode and widget id
        interactiveMode = true;
        widgetId = targetWidgetId;

        // Add icon image if not present
        if (!widget.iconImage) {
            widget.iconImage = iconImageLookup[targetWidgetId] || "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/home.svg";
        }

        // Trigger the widget view
        createAgentView(widget);
        
        console.log(`[Addy Widget] Successfully triggered widget: ${targetWidgetId}`);
        return true;
    };

    // Log available widgets for developers
    console.log('[Addy Widget] Loaded successfully. Available widgets:', widgetIdsToRender);
    console.log('[Addy Widget] Trigger widgets programmatically using: window.addyTriggerWidget("widget-id")');
});

const iconImageLookup = {
    "refinance": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/reload.svg",
    "buy-home": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/home.svg",
    "rates": "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/chart.svg",
}

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

function renderHeroSection(heroData) {
    if (!heroData) return;
    
    const heroContainer = document.querySelector('.addy-widget-hero-container');
    if (!heroContainer) return;
    
    heroContainer.innerHTML = `
        <div class="addy-hero-content">
            ${heroData.image ? `<img src="${heroData.image}" alt="${heroData.title || ''}" class="addy-hero-image" />` : ''}
            <div class="addy-hero-content-text">
                ${heroData.title ? `<h1 class="addy-hero-title">${heroData.title}</h1>` : ''}
                ${heroData.description ? `<p class="addy-hero-description">${heroData.description}</p>` : ''}
            </div>
        </div>
    `;
    
    // Set the hero section background to primary color
    heroContainer.style.backgroundColor = data.primaryColor;
}

function renderSocialIcons(socialData) {
    if (!socialData) return;
    
    const iconsContainer = document.querySelector('.addy-widget-icons-container');
    if (!iconsContainer) return;
    
    let socialHTML = '<div class="addy-social-icons">';
    
    Object.keys(socialData).forEach(platform => {
        const social = socialData[platform];
        if (social.url) {
            socialHTML += `
                <a href="${social.url}" target="_blank" class="addy-social-link">
                    ${social.icon ? `<img src="${social.icon}" alt="${platform}" class="addy-social-icon" />` : ''}
                    <span class="addy-social-label">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                </a>
            `;
        }
    });
    
    socialHTML += '</div>';
    iconsContainer.innerHTML = socialHTML;
}

function initializeWidgets(widgetIdsToRender, agentPublicId) {
    const styleSheetLink = scriptTag.getAttribute("env") &&
        scriptTag.getAttribute("env").includes("local") ?
        "css/style.css" :
        "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/css/style.min.css";
    
    // Inject CSS into current document (for widget cards)
    if (!document.head.querySelector(`link[href="${styleSheetLink}"]`)) {
        const linkElement = document.createElement("link");
        linkElement.setAttribute("rel", "stylesheet");
        linkElement.setAttribute("href", styleSheetLink);
        document.head.appendChild(linkElement);
    }
    
    // Try to inject CSS into parent document (for full-screen overlays)
    // Wrap in try-catch to handle cross-origin restrictions
    try {
        if (!window.parent.document.head.querySelector(`link[href="${styleSheetLink}"]`)) {
            const parentLinkElement = document.createElement("link");
            parentLinkElement.setAttribute("rel", "stylesheet");
            parentLinkElement.setAttribute("href", styleSheetLink);
            window.parent.document.head.appendChild(parentLinkElement);
        }
    } catch (error) {
        // Cross-origin restriction - parent injection failed, but current document has CSS
        console.log('[Addy Widget] Parent CSS injection skipped (cross-origin)');
    }
    // Only render the widgets that are in the widgetIdsToRender array
    data.leadFunnelWidgets.forEach(widget => {
        if (!widgetIdsToRender.includes(widget.id)) {
            return;
        }
        console.log("Widget id to render", widget.id);
        const widgetCard = createWidgetCard({...widget,
            iconImage: iconImageLookup[widget.id] || "https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/img/icons/home.svg"
        });
        // Find all elements where addy-widget-id = agentPublicId  && widgets == scriptTag.widgets
        let widgetCardContainers = document.body.querySelectorAll(`[addy-widget-id="${agentPublicId}"][widgets="${scriptTag.getAttribute("widgets")}"]`);
        // find the parent of this script tag
        const scriptTagParent = scriptTag?.parentElement;
        // If widget card containers is empty, then add script tag parent to the widget card containers
        if (widgetCardContainers.length === 0 && scriptTagParent) {
            widgetCardContainers = [scriptTagParent];
        }
        // console.log("Widget card containers", widgetCardContainers);
        widgetCardContainers.forEach(container => {
            container.appendChild(widgetCard);
            // Update the style to be horizontal flex, justify content center, align items center
            container.setAttribute("class", "addy-widget-card-container");
        });
        // Add event listener to the button
        widgetCard.querySelector("button").addEventListener("click", () => {
            interactiveMode = true;
            widgetId = widget.id;
            createAgentView(widget);
        });
    });
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

    // Add extra buttons (Calendly link and custom links)
    const extraButtonsContainer = widgetCard.querySelector('.addy-widget-extra-buttons');
    const primaryColor = data.leadFunnelWidgetsConfig?.primaryColor || data.primaryColor;

    // Helper function to apply button styles inline (so it works even before CSS is updated on CDN)
    const applyButtonStyles = (btn, bgColor) => {
        btn.style.display = 'block';
        btn.style.width = '100%';
        btn.style.padding = '0.75rem 1.5rem';
        btn.style.borderRadius = '9999px';
        btn.style.backgroundColor = bgColor;
        btn.style.color = 'white';
        btn.style.textAlign = 'center';
        btn.style.textDecoration = 'none';
        btn.style.fontSize = '1rem';
        btn.style.fontWeight = '500';
        btn.style.cursor = 'pointer';
        btn.style.boxSizing = 'border-box';
        btn.style.transition = 'transform 0.3s ease';
    };

    // Helper function to ensure URL has a protocol (prevents relative URL issues)
    const ensureAbsoluteUrl = (url) => {
        if (!url) return url;
        // If URL doesn't start with http:// or https://, prepend https://
        if (!/^https?:\/\//i.test(url)) {
            return 'https://' + url;
        }
        return url;
    };

    // Add Calendly "Book a Call" button (only if calendlyLink has actual content)
    const calendlyLink = data.leadFunnelWidgetsConfig?.calendlyLink?.trim();
    if (calendlyLink) {
        const calendlyBtn = document.createElement('a');
        calendlyBtn.href = ensureAbsoluteUrl(calendlyLink);
        calendlyBtn.target = '_blank';
        calendlyBtn.className = 'addy-widget-secondary-btn';
        applyButtonStyles(calendlyBtn, primaryColor);
        calendlyBtn.textContent = 'Book a Call';
        extraButtonsContainer.appendChild(calendlyBtn);
    }

    // Add custom links (only if both label and url have actual content)
    const customLinks = data.leadFunnelWidgetsConfig?.customLinks || [];
    customLinks.forEach(link => {
        const label = link.label?.trim();
        const url = link.url?.trim();
        if (label && url) {
            const linkBtn = document.createElement('a');
            linkBtn.href = ensureAbsoluteUrl(url);
            linkBtn.target = '_blank';
            linkBtn.className = 'addy-widget-secondary-btn';
            applyButtonStyles(linkBtn, primaryColor);
            linkBtn.textContent = label;
            extraButtonsContainer.appendChild(linkBtn);
        }
    });

    return widgetCard;
}

function closeTheView() {
    // Get agent view
    const agentView = window.parent.document.body.querySelector(".addy-agent-view");
    if (agentView) {
        // If current question is rateQuote, ask the user if they really want to exit, yes or no
        const currentQuestion = interactiveSectionState[currentQuestionIndex];
        if (currentQuestion && currentQuestion.type == "rateQuote") {
            const confirmExit = confirm("Are you sure you want to exit the quote?");
            if (!confirmExit) {
                return;
            } else {
                // User wants to exit, reset the whole question flow
                previousQuestionsAndAnswers = [];
                currentQuestionIndex = 0;
                interactiveSectionState = [];
            }
        }
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
    
    // Add fullscreen class if widget has fullScreenMode set to true
    if (widget.fullScreenMode === true) {
        agentView.classList.add("addy-agent-view-fullscreen");
    }
    
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
    progressSnapshots = [];

    // Create the content
    getNextQuestion();
    
    // Ensure progress/back button hidden initially
    const agentViewDom = window.parent.document.body.querySelector(".addy-agent-view");
    if (agentViewDom) {
        const progressText = agentViewDom.querySelector(".addy-agent-view-header-progress-text");
        const progressWrapper = agentViewDom.querySelector(".addy-agent-view-progress-bar");
        const backButton = agentViewDom.querySelector(".addy-back-button");
        if (progressText) {
            progressText.style.display = "none";
            progressText.textContent = "0%";
        }
        if (progressWrapper) {
            progressWrapper.style.display = "none";
        }
        if (backButton) {
            backButton.style.display = "none";
        }
    }
}



function handleBackButtonClick() {
    console.log("[Back] Current question index:", currentQuestionIndex, "TOTAL:", TOTAL_EXPECTED_QUESTIONS);
    // currentQuestionIndex matches data-question-index of current view
    // Can't go back if we're on the first question (index 1)
    if (currentQuestionIndex <= 1) return;

    // DOM element index for previous question (currentQuestionIndex - 1)
    const previousDOMIndex = currentQuestionIndex - 1;
    
    console.log("[Back] Looking for previous question element at DOM index", previousDOMIndex);
    const previousQuestionElement = window.parent.document.querySelector(`.addy-agent-form-section[data-question-index="${previousDOMIndex}"]`);
    
    if (previousQuestionElement) {
        // Hide all question elements
        window.parent.document.querySelectorAll('.addy-agent-form-section').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show the previous question element
        previousQuestionElement.style.display = 'flex';

        // Update currentQuestionIndex to reflect the new position
        currentQuestionIndex = previousDOMIndex;

        // Apply stored progress snapshot for this question
        applyProgressSnapshot(currentQuestionIndex);

        const progressWrapper = window.parent.document.querySelector(".addy-agent-view-progress-bar");
        const progressText = window.parent.document.querySelector(".addy-agent-view-header-progress-text");
        if (currentQuestionIndex <= 1) {
            window.parent.document.querySelector(".addy-back-button").style.display = "none";
            if (progressWrapper) {
                progressWrapper.style.display = "none";
            }
            if (progressText) {
                progressText.style.display = "none";
            }
        } else {
            window.parent.document.querySelector(".addy-back-button").style.display = "block";
            if (progressWrapper) {
                progressWrapper.style.display = "block";
            }
            if (progressText) {
                progressText.style.display = "block";
            }
        }
    } else {
        console.log("[Back] No previous question element found at DOM index", previousDOMIndex);
    }
}

function handleNextQuestion(nextQuestion, options = {}) {
    const { isCached = false } = options;
    
    // Parse nextQuestion question data as JSON if it's a string
    if (nextQuestion?.nextQuestion && typeof nextQuestion.nextQuestion == "string") {
        nextQuestion.nextQuestion = JSON.parse(nextQuestion.nextQuestion);
    }
    if (nextQuestion.type == "endOfFlow") {
        // Remove the current question element
        if (window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section")) {
            window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-form-section").remove();
        }
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
    // Store the question state at the current index (before incrementing)
    interactiveSectionState[currentQuestionIndex] = nextQuestion;
    // Increment to get the DOM index for this question
    currentQuestionIndex++;
    
    // Check if we already have a question element at this index (must check in parent document!)
    let nextQuestionElement = window.parent.document.querySelector(`.addy-agent-form-section[data-question-index="${currentQuestionIndex}"]`);
    let isNewElement = false;

    if (!nextQuestionElement) {
        // Create new question element if it doesn't exist
        isNewElement = true;
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

    // Only add event listener for NEW elements to avoid duplicate handlers
    if (isNewElement) {
        addNextButtonOnClickListener(nextQuestionElement, nextQuestion);
    }

    // Only update TOTAL_EXPECTED_QUESTIONS on FRESH API calls, not cached navigation
    // This prevents percentage jumps when navigating back and forth
    if (!isCached) {
        let numberOfQuestionsLeft = nextQuestion.nextQuestion?.numberOfQuestionsLeft;
        if (numberOfQuestionsLeft !== undefined && numberOfQuestionsLeft !== null) {
            TOTAL_EXPECTED_QUESTIONS = numberOfQuestionsLeft + currentQuestionIndex;
        }
        console.log("[Forward] Fresh API - Updated TOTAL:", TOTAL_EXPECTED_QUESTIONS);
    }
    
    console.log("[Forward] Question index:", currentQuestionIndex, "TOTAL:", TOTAL_EXPECTED_QUESTIONS, "Cached:", isCached);

    // Capture and apply progress snapshot for this question
    const progressFraction = TOTAL_EXPECTED_QUESTIONS > 0 ? currentQuestionIndex / TOTAL_EXPECTED_QUESTIONS : 0;
    const progressPercent = Math.min(100, Math.max(0, Math.round(progressFraction * 100)));
    const progressWidth = Math.min(100, Math.max(0, progressFraction * 100));
    progressSnapshots[currentQuestionIndex] = { percent: progressPercent, width: progressWidth };
    updateProgressIndicators(progressWidth, progressPercent);

    // If the previousQuestionsAndAnswers array is < 2, don't show the back button
    if (previousQuestionsAndAnswers.length < 1) {
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "none";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "none";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "none";
    } else {
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-back-button").style.display = "block";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-header-progress-text").style.display = "block";
        window.parent.document.body.querySelector(".addy-agent-view").querySelector(".addy-agent-view-progress-bar").style.display = "block";
    }
}

function updateProgressIndicators(progressWidth, progressPercent) {
    const agentView = window.parent.document.body.querySelector(".addy-agent-view");
    if (!agentView) {
        return;
    }
    const progressBar = agentView.querySelector(".addy-agent-view-progress-bar-fill");
    const progressText = agentView.querySelector(".addy-agent-view-header-progress-text");
    const progressWrapper = agentView.querySelector(".addy-agent-view-progress-bar");

    if (progressBar) {
        progressBar.style.width = `${progressWidth}%`;
        progressBar.style.backgroundColor = data.primaryColor;
    }
    if (progressText) {
        progressText.textContent = `${progressPercent}%`;
        progressText.style.display = "block";
    }
    if (progressWrapper) {
        progressWrapper.style.display = "block";
    }
}

function applyProgressSnapshot(domIndex) {
    if (domIndex === undefined || domIndex === null) {
        return;
    }
    const snapshot = progressSnapshots[domIndex];
    if (snapshot) {
        updateProgressIndicators(snapshot.width, snapshot.percent);
        return;
    }
    const fraction = TOTAL_EXPECTED_QUESTIONS > 0 ? domIndex / TOTAL_EXPECTED_QUESTIONS : 0;
    const percent = Math.min(100, Math.max(0, Math.round(fraction * 100)));
    updateProgressIndicators(Math.min(100, Math.max(0, fraction * 100)), percent);
}

function addNextButtonOnClickListener(nextQuestionElement, nextQuestion) {
    const nextButton = nextQuestionElement.querySelector(".addy-interactive-primary-button");

    if (nextButton) {
        // Mark button as having listener to prevent duplicates
        if (nextButton.hasAttribute('data-listener-added')) {
            return;
        }
        nextButton.setAttribute('data-listener-added', 'true');
        
        if (nextQuestion.type == "rateQuote") {
            // Change next button text to "Continue full application"
            nextButton.innerHTML = nextQuestion.nextQuestion.buttonText;
            // Get the simple paragraph and insert right before the next button
            const simpleParagraph = createSimpleParagraph(nextQuestion.nextQuestion.continuePrompt);
            nextQuestionElement.insertBefore(simpleParagraph, nextButton);
        }
        nextButton.addEventListener("click", () => {
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
        
        let contentHeight = iframe.contentWindow.document.body.scrollHeight + additionalHeight;
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

    // If the next question type is communicationPreferencesWithConsentCheckbox, then append the privacy policy and terms of service link
    if (nextQuestion.type == "communicationPreferencesWithConsentCheckbox") {
        const privacyPolicyAndTermsOfService = document.createElement("div");
        privacyPolicyAndTermsOfService.innerHTML = privacyPolicyAndTermsOfServiceHTML
            .replaceAll("{{privacyPolicyURL}}", data.privacyPolicyURL || "https://addy.so/privacypolicy")
            .replaceAll("{{termsOfServiceURL}}", data.termsOfServiceURL || "https://addy.so/termsofservice");
        nextQuestionElement.appendChild(privacyPolicyAndTermsOfService);
    }

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
            const question = event.data.answerSelected.question;
            const answer = event.data.answerSelected.answer;
            if (!(question && answer)) {
                console.error("No question or answer found");
                return;
            }
            
            // The current question's data index is currentQuestionIndex - 1
            // (since currentQuestionIndex is the DOM index which starts at 1)
            const currentDataIndex = currentQuestionIndex - 1;
            
            // Guard against edge case where no question is displayed yet
            if (currentDataIndex < 0) {
                console.error("[Answer] Invalid state: currentDataIndex is", currentDataIndex);
                return;
            }
            
            console.log("[Answer] Question:", question, "at dataIndex:", currentDataIndex, "DOM index:", currentQuestionIndex);
            
            // Check if answer changed by comparing with stored answer at current position
            let answerChanged = false;
            if (previousQuestionsAndAnswers[currentDataIndex]) {
                if (previousQuestionsAndAnswers[currentDataIndex].answer !== answer) {
                    answerChanged = true;
                    console.log("[Answer] Answer CHANGED from:", previousQuestionsAndAnswers[currentDataIndex].answer, "to:", answer);
                }
                previousQuestionsAndAnswers[currentDataIndex] = { question, answer };
            } else {
                // New question at this index
                previousQuestionsAndAnswers[currentDataIndex] = { question, answer };
            }
            
            // Save the last known question UI state
            lastKnownQuestionUIState[question] = event.data.answerSelected.uiState;

            // If the answer changed, clear cached states for subsequent questions
            if (answerChanged) {
                console.log("[AnswerChange] Clearing cache from dataIndex", currentDataIndex + 1, "onwards");
                
                // Clear all cached states AFTER the current question
                // Keep indices 0 through currentDataIndex
                interactiveSectionState = interactiveSectionState.slice(0, currentDataIndex + 1);
                
                // Truncate previousQuestionsAndAnswers to match
                previousQuestionsAndAnswers = previousQuestionsAndAnswers.slice(0, currentDataIndex + 1);
                
                // Trim stored progress snapshots as well
                progressSnapshots = progressSnapshots.slice(0, currentQuestionIndex + 1);
                
                // Remove DOM elements for questions after the current one
                // DOM index > currentQuestionIndex means it's after the current question
                const allQuestionElements = window.parent.document.querySelectorAll('.addy-agent-form-section');
                allQuestionElements.forEach(el => {
                    const elIndex = parseInt(el.getAttribute('data-question-index'));
                    if (elIndex > currentQuestionIndex) {
                        console.log("[AnswerChange] Removing DOM element at index", elIndex);
                        el.remove();
                    }
                });
                
                console.log("[AnswerChange] Cache size after clear:", interactiveSectionState.length);
            }
            
            // For selector type, get next question immediately
            // For other types, wait for the next button click
            if (event.data.answerSelected.type == "selector") {
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
    
    console.log("[GetNext] Current index:", currentQuestionIndex, "Checking cache at index:", currentQuestionIndex);
    
    // If we have a previously answered question at the current index, use that instead of making a new API call
    if (interactiveSectionState[currentQuestionIndex]) {
        console.log("[GetNext] Using CACHED data for next question");
        handleNextQuestion(interactiveSectionState[currentQuestionIndex], { isCached: true });
        return;
    }

    console.log("[GetNext] No cache, making API call");
    showLoader();
    const nextQuestionResponse = await makeAPICallForNextQuestion();
    if (nextQuestionResponse?.nextQuestion) {
        hideLoader();
        handleNextQuestion(nextQuestionResponse, { isCached: false });
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
    <button class="addy-widget-primary-btn" style="background-color: {{primaryColor}};">{{buttonText}}</button>
    <div class="addy-widget-extra-buttons"></div>
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
`;

const privacyPolicyAndTermsOfServiceHTML = `
    <div style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
        <a style="font-size: 13px;" href="{{privacyPolicyURL}}" target="_blank">Privacy Policy</a>
        <a style="font-size: 13px;" href="{{termsOfServiceURL}}" target="_blank">Terms of Service</a>
    </div>
`
