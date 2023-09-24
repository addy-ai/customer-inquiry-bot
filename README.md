# Customer Inquiry Bot by Addy AI

The live branch is what gets deployed on GitHub Pages.
Merge to live branch to auto deploy


- should be an iframe so our css rules and stuff don't mix with the users'.
- Configured within customer-dashboard. 
- User given a widget script tag.
- script tag droped in customer's website.
- We use JSDeliver to package our assets directly from the github repo.
- - example tag: `<script src="https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/js/bubble.min.js" id="e096846f-cc30-402b-948a-83c5dbcd6b2c" title="embed"></script>`
- using id we can grab the org's ai kb
- we generate a userId for the session for inf storage

# Questions
- Why an iframe?

- - Backend requests must be send from the Github Host from an Iframe. Pass window.top as well.