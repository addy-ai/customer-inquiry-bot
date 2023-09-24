# Customer Inquiry Bot by Addy AI

The live branch is what gets deployed on GitHub Pages.
Merge to live branch to auto deploy


- should be an iframe so our css rules and stuff don't mix with the users'.
- Configured within customer-dashboard. 
- User given a widget script tag.
- script tag droped in customer's website.
- We use JSDelivr to package our assets directly from the github repo.
- - example tag: `<script src="https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/js/bubble.min.js" id="e096846f-cc30-402b-948a-83c5dbcd6b2c" title="embed"></script>`
- using id we can grab the org's ai kb
- we generate a userId for the session for inf storage

# Force Reload JSDelivr Script
The primary purpose of CDN is to not have realtime updates so it's more performant, so it cahces the files. These files can be cached for up to 7 days. However you can force JSDelivr to load the latest files and purge the cache by going to https://www.jsdelivr.com/tools/purge
and entering the URL to the script: https://cdn.jsdelivr.net/gh/addy-ai/customer-inquiry-bot@latest/js/bubble.min.js

Then purge -- This will clean up JSDelivr's cache and serve the latest file

# Questions
- Why an iframe?

- - Backend requests must be send from the Github Host from an Iframe. Pass window.top as well.