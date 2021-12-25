import { enrichConfig } from './config';

let config;
let activations = {};
let initialized = false;

function matchListGenerator(sites) {
  const res = [];
  for(let s of sites) {
    // Overload all the subdomains and root domain
    s = `*://*.${s}`;
    // Prepare the wildcard pattern
    if(s[s.length-1] !== '/') {
      s = `${s}/`;
    }
    res.push(`${s}*`);
  }
  return res;
}

async function refreshConfig() {
  // First ensure the config
  const { config: config_ } = await chrome.storage.sync.get({ config: {} });
  const { config: enrichedConfig, changed } = enrichConfig(config_);
  config = enrichedConfig;
  if(changed) {
    await chrome.storage.sync.set({ config });
  }
  
  // Clear content script
  // This doesn't work
  // await chrome.scripting.unregisterContentScripts();

  // Re-register content scripts
  // console.log(matchListGenerator(sites));

  const upsertCall = ( initialized ? chrome.scripting.updateContentScripts : chrome.scripting.registerContentScripts );
  const p = upsertCall([
    { 
      id: 'overlay',
      js: ['content.js'],
      matches: matchListGenerator(config.sites),
      // matches: ['<all_urls>'], // Great for testing
      runAt: 'document_start',
    }
  ])
  initialized = true;
  await p;
}

// Reload on config changes
chrome.storage.sync.onChanged.addListener(async () => {
  await refreshConfig();
});

// Message listener
chrome.runtime.onMessage.addListener(function(payload, sender, sendResponse) {
  // console.log(payload, sender, sendResponse);
  
  // Message handlers
  if(payload.action === 'status') {
    sendResponse({
      access: (activations[payload.host] >= Date.now()-config.activation.timeSeconds*1000)
    });
  } else if(payload.action === 'hostActivated') {
    activations[payload.host] = Date.now();
    sendResponse({});
  } else if(payload.action === 'reloadUnpacked') {
    sendResponse({});
    setTimeout(_ => chrome.runtime.reload(), 30);
  } else if(payload.action === 'debug') {
    sendResponse({});
    console.log(payload);
  }
  
  // Required to call sendResponse !!

  // if want to call sendResponse async !!!
  // return true
});

// Initialize application
async function main() {
  await refreshConfig();
}
main();
