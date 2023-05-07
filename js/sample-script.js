
const SIZE = 60,
  BTN_RAD = 30,
  BG_CHAT = "purple",
  chatButtonLogo =
    '\n<svg width="80" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n      <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="#FFFFFF"></path>\n      <circle cx="10" cy="12" r="1.3" fill="#FFFFFF"></circle>\n      <circle cx="16" cy="12" r="1.3" fill="#FFFFFF"></circle>\n    </svg>\n',
  chatButtonClose =
    '\n<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="#FFFFFF" width="24" height="24">\n  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />\n</svg>\n',
  chatButton = document.createElement("div");
chatButton.setAttribute("id", "chat-bubble-button"),
  (chatButton.style.position = "fixed"),
  (chatButton.style.bottom = "20px"),
  (chatButton.style.width = "60px"),
  (chatButton.style.height = "60px"),
  (chatButton.style.borderRadius = "30px"),
  (chatButton.style.backgroundColor = BG_CHAT),
  (chatButton.style.boxShadow = "0 4px 8px 0 rgba(0, 0, 0, 0.2)"),
  (chatButton.style.cursor = "pointer"),
  (chatButton.style.zIndex = 999999999),
  (chatButton.style.transition = "all .2s ease-in-out"),
  chatButton.addEventListener("mouseenter", (t) => {
    chatButton.style.transform = "scale(1.05)";
  }),
  chatButton.addEventListener("mouseleave", (t) => {
    chatButton.style.transform = "scale(1)";
  });
const chatButtonIcon = document.createElement("div");
(chatButtonIcon.style.display = "flex"),
  (chatButtonIcon.style.alignItems = "center"),
  (chatButtonIcon.style.justifyContent = "center"),
  (chatButtonIcon.style.width = "100%"),
  (chatButtonIcon.style.height = "100%"),
  (chatButtonIcon.style.zIndex = 999999999),
  (chatButtonIcon.innerHTML = chatButtonLogo),
  chatButton.appendChild(chatButtonIcon);
const notificationBubble = document.createElement("div");
(notificationBubble.style.position = "absolute"),
  (notificationBubble.style.top = "-7px"),
  (notificationBubble.style.right = "-1px"),
  (notificationBubble.style.width = "20px"),
  (notificationBubble.style.height = "20px"),
  (notificationBubble.style.borderRadius = "50%"),
  (notificationBubble.style.backgroundColor = "red"),
  (notificationBubble.style.color = "white"),
  (notificationBubble.style.display = "flex"),
  (notificationBubble.style.alignItems = "center"),
  (notificationBubble.style.justifyContent = "center"),
  (notificationBubble.style.zIndex = 1e9),
  (notificationBubble.style.fontSize = "12px"),
  (notificationBubble.innerHTML = "1"),
  chatButton.appendChild(notificationBubble);
let firstClick = !0;
function adjustForSmallScreens() {
  window.innerHeight < 600 && (chat.style.height = "70vh");
}
chatButton.addEventListener("click", () => {
  firstClick &&
    ((notificationBubble.style.display = "none"), (firstClick = !1)),
    "none" === chat.style.display
      ? ((chat.style.display = "flex"),
        (chatButtonIcon.innerHTML = chatButtonClose))
      : ((chat.style.display = "none"),
        (chatButtonIcon.innerHTML = chatButtonLogo));
});
const chat = document.createElement("div");
chat.setAttribute("id", "chat-bubble-window"),
  (chat.style.position = "fixed"),
  (chat.style.flexDirection = "column"),
  (chat.style.justifyContent = "space-between"),
  (chat.style.bottom = "80px"),
  (chat.style.width = "85vw"),
  (chat.style.height = "70vh"),
  (chat.style.boxShadow =
    "rgba(150, 150, 150, 0.15) 0px 6px 24px 0px, rgba(150, 150, 150, 0.15) 0px 0px 0px 1px"),
  (chat.style.display = "none"),
  (chat.style.borderRadius = "10px"),
  (chat.style.zIndex = 999999999),
  (chat.style.overflow = "hidden"),
  window.addEventListener("resize", adjustForSmallScreens),
  adjustForSmallScreens();
const scriptTag = document.currentScript,
  urlBase = "https://arm.chatshape.com/",
  headers = { "Content-Type": "application/json" };
console.log(scriptTag);
let botName = scriptTag.id.substring(0, scriptTag.id.indexOf("-")).trim(),
  botID = scriptTag.id.replace(/.*?-/, "").trim();


function init() {
  (chat.innerHTML = `<iframe\n    src="https://www.chatshape.com/chatbot-i/${scriptTag.id}"\n    width="100%"\n    height="100%"\n    frameborder="0"\n    ></iframe>`),
    document.body.appendChild(chat);
  (async () => {
    const t = await fetch(urlBase + "getInit", {
        headers: headers,
        method: "POST",
        body: JSON.stringify({ name: botName, uuid: botID }),
      }),
      e = await t.json(),
      n = "" === e ? [] : e;
    chatButton.style.backgroundColor = n[2];
    n[3]
      ? ((chatButton.style.left = "20px"),
        (chatButton.style.right = "unset"),
        (chat.style.left = "20px"),
        (chat.style.right = "unset"))
      : ((chatButton.style.right = "20px"),
        (chatButton.style.left = "unset"),
        (chat.style.right = "20px"),
        (chat.style.left = "unset")),
      document.body.appendChild(chatButton);
  })();
}
console.log("botID: ", botID),
  console.log("botName: ", botName),
  "complete" === document.readyState
    ? init()
    : window.addEventListener("load", init);
const mediaQuery = window.matchMedia("(min-width: 550px)");
function handleSizeChange(t) {
  t.matches && ((chat.style.height = "600px"), (chat.style.width = "450px"));
}
mediaQuery.addEventListener("change", handleSizeChange),
  handleSizeChange(mediaQuery);

