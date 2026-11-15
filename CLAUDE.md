# Addy Customer Inquiry Bot

The public chat bubble and lead-funnel widgets that loan officers and lenders embed on their
own websites, so visitors (prospective borrowers) can ask questions and leave their details.
An organization configures its bot in Addy (the README says customer-dashboard) and gets a
`<script>` tag whose `id` is the bot's public ID. The scripts call the backend's
`/api/agent` routes (`public-chatbot-info` and the chat endpoints) on Cloud Run; there is no
server code here.

Plain browser JavaScript, HTML and CSS: no `package.json`, no bundler, no modules.

## How it is served

| File | Served from | Role |
|---|---|---|
| `js/bubble.js` | jsDelivr `@latest` (`/js/bubble.min.js`) | the embed: draws the bubble, fetches bot config, opens the chat |
| `js/widget.js`, `css/style.css` | jsDelivr `@latest` (`.min` variants) | inline lead-funnel widget, rendered in a `srcdoc` iframe |
| `index.html` + `js/index.js` | GitHub Pages, `live` branch (`addy-ai.github.io/customer-inquiry-bot`) | the chat window the bubble opens in an iframe |
| `widget.html`, `widget-home.html`, `testpage.html` | local only | pages for trying the embed and widgets |

jsDelivr `@latest` serves `main` (the repo has no tags), and it minifies on request, so never
commit `.min` files. Two release paths follow from this:

- **Merging to `main` is a production release** of the bubble, widget and CSS for every
  customer site that embeds them. jsDelivr caches for up to 7 days; purge at
  `https://purge.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/<path>.min.js`.
- The chat window only changes when `main` is merged into `live` (GitHub Pages builds from
  `live`). `live` currently lags `main`, so check both before assuming a fix is out.

There is no `dev` branch, no CI and no staging copy.

## Running and validating

No lint, no tests, no build. Serve the folder with any static server and open
`testpage.html` or `widget-home.html`; pass `env="local"` on the script tag so the bubble
loads `css/style.css` and `js/widget.js` from disk instead of jsDelivr. Watch the console
and network tab, and try a narrow viewport: the bubble switches layout on small screens.

## The `env` attribute

The script tag's `env` attribute (and the `env` query parameter on the chat page) picks the
backend in `getAgentApiBaseUrl`:

- `test`: Functions emulator `127.0.0.1:5003`
- `local` / `test-local`: `localhost:8080`
- `development`: backend-dev on Cloud Run, hosted chat on `devmail.addy.com`
- anything else: backend-prod, hosted chat on `app.addy.com`

`getChatBotData` in `bubble.js` falls back to `development` when the attribute is missing,
while `createChatbox` falls back to `production`. Keep that in mind before changing defaults:
customer snippets in the wild may omit the attribute.

## Worth knowing

- Everything runs on third-party sites. Keep styles inside the iframe, avoid new globals
  (`bubble.js` already sets `window.chatbotScriptLoaded`, `window.isChatbotFirstClick`,
  `window.addyAIData`), and never break the existing snippet shape (`id`, `env`, `title`).
- Bot messages are rendered as Markdown with `marked` and sanitized with DOMPurify in
  `index.html`; keep sanitizing anything shown from the API or the visitor.
- Visitor input is borrower personal data. Do not log it to the console.
