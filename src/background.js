import { matchPattern } from 'browser-extension-url-match';
import { defaultConfig, enrichConfig } from './config';

let config;
const pid = self.crypto.getRandomValues(new Uint32Array(1))[0].toString(16);

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

let matchList, matchers;
async function refreshConfig() {
  // First ensure the config
  const { config: config_ } = await chrome.storage.sync.get({ config: {} });
  const { config: enrichedConfig, changed } = enrichConfig(config_);
  config = enrichedConfig;
  if(changed) {
    await chrome.storage.sync.set({ config });
  }

  // Re-register content scripts
  // console.log(matchListGenerator(config.sites), initialized);
  matchList = matchListGenerator(config.sites.map(s => s.filter));
  matchers = matchList.map(p => matchPattern(p));
  // console.log({ matchList, matchers });
  
  // Clear content script
  // This doesn't work, this whole api is broken.
  // await chrome.scripting.unregisterContentScripts();
  const scriptKey = 'stayhardoverlay';
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [scriptKey ]});

  // Upsert new
  const upsertCall = ( (registered && registered.length > 0) ? chrome.scripting.updateContentScripts : chrome.scripting.registerContentScripts );
  const p = upsertCall([
    { 
      id: scriptKey,
      js: ['content.js'],
      matches: matchList,
      // matches: ['<all_urls>'], // Great for testing
      runAt: 'document_start',
    }
  ]);

  await p;
}

// Reload on config changes
chrome.storage.sync.onChanged.addListener(async () => {
  await refreshConfig();
});

async function onInstalled() {
  // Migration from 0.1.2 to 0.1.3
  const { activations } = await chrome.storage.local.get({ activations: [] });
  if(!(activations instanceof Array)) {
    await chrome.storage.local.set({ activations: [] });
  }

  // Migration from 0.1.0 to 0.1.6
  let { config } = await chrome.storage.sync.get({ config: {} });
  if(config.sites.find(s => typeof s === 'string')) {
    config.sites = config.sites.map(s => {
      if(typeof s === 'string') {
        const dflt = defaultConfig.sites.find(d => d.filter === s);
        if(dflt) return dflt;
        return { filter: s };
      }
    })
    await chrome.storage.sync.set({ config });
  }
}
chrome.runtime.onInstalled.addListener(onInstalled);

// Message listener
chrome.runtime.onMessage.addListener(function(payload, sender, sendResponse) {
  // console.log(payload, sender, sendResponse);
  (async () => {
    // Message handlers
    if(payload.action === 'status') {
      let access = false;

      // First check if there is an override long-press exception on the DNS
      const { activationTimes, softRoutineStatuses } = (await chrome.storage.local.get({ activationTimes: {}, softRoutineStatuses: {} }));
      const lastActivationTime = activationTimes[payload.host];
      if(lastActivationTime && lastActivationTime >= Date.now()-config.activation.timeSeconds*1000) {
        access = true;

      } else { // Else check if the site is part of a routine and not blocked.
        // Validate the strategy of a DNS isn't hard
        const matchIdx = getFilterableMatchIdx(payload.origin, -1, 0);
        const siteConfig = (matchIdx >= 0 ? config.sites[matchIdx] : null);
        const hardBlocked = (siteConfig && siteConfig.strategy === "hard");
        if(!hardBlocked) {
          // See if any soft routines are active
          for(let routine of config.softRoutines) {
            const time = softRoutineStatuses[routine.label];
            if(time && Date.now()-time <= routine.duration*1000) {
              access = true;
              // TODO: analytics on event
              break;
            }
          }
        }
      }
      sendResponse({ access });

    } else if(payload.action === 'hostActivated') {
      let { activationTimes, activations } = (await chrome.storage.local.get({ activationTimes: {}, activations: [] }));
      activationTimes[payload.host] = Date.now();
      activations.push({ host: payload.host, ts: unix() });
      const t = sessionAutoClearTime();
      if(activations[0].ts < t) activations = activations.filter(d => d.ts > t);
      await chrome.storage.local.set({ activationTimes, activations });
      sendResponse({});

    } else if(payload.action === 'interception') {
      let { interceptions } = (await chrome.storage.local.get({ interceptions: [] }));
      interceptions.push({ host: payload.host, ts: unix() });
      const t = sessionAutoClearTime();
      if(interceptions[0].ts < t) interceptions = interceptions.filter(d => d.ts > t);
      await chrome.storage.local.set({ interceptions });
      sendResponse({});

    } else if(payload.action === "startSoftRoutine") {
      let { softRoutineStatuses } = (await chrome.storage.local.get({ softRoutineStatuses: {} }));
      softRoutineStatuses[payload.routine.label] = Date.now();
      await chrome.storage.local.set({ softRoutineStatuses });
      sendResponse({});

    } else {
      console.warn(payload);
      throw new Error('Unknown message, required sendResponse not called.');
    }
  })();

  // if want to call sendResponse async !!!
  return true
});

function getFilterableMatchIdx(url, parentFrameId, frameId) {
  if(url.substr(0,6) === 'chrome') return -1; // Don't check on chrome pages, causes an error.
  if(parentFrameId !== -1 || frameId !== 0) return -1; // Only react to tab urls, not the embedded content.

  return matchers.findIndex(m => m.match(url));
}

async function navigationHandler(details) {
  const idx = getFilterableMatchIdx(details.url, details.parentFrameId, details.frameId);
  if(idx < 0) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['./content.js'],
    });
  } catch (err) {
    console.error('caught', err);
  }
}

function unix() {
  return Math.round(Date.now()/1000);
}

function sessionAutoClearTime() {
 return unix()-86400*7;
}

async function endAnyActiveSession() {
  const { activeSession } = await chrome.storage.local.get({ activeSession: null });
  if(!activeSession) return;
  let endTime = unix();

  // Handle broken sessions with a best-effort estimation of 30s
  if(activeSession.pid !== pid) {
    endTime = activeSession.start + 30;
  }

  let { sessions } = await chrome.storage.local.get({ sessions: [] });
  sessions.push({ 
    start: activeSession.start,
    pattern: activeSession.pattern,
    end: endTime,
  });

  // Cleanup sessions (TODO aggregate and track day counters, don't keep data)
  const t = sessionAutoClearTime();
  if(sessions[0].end < t) sessions = sessions.filter(s => s.end > t);

  // console.log({ sessions });
  await chrome.storage.local.set({ sessions, activeSession: null });
}

// TODO this is not yet correct
// Nice to have: time spent distribution in browser.
async function handleWindowOnFocusChanged(windowId) {
  // console.log('onFocusChanged', windowId);
  // First check if user stopped, changed or continued a session.
  // End any ongoing tracking
  if(windowId === chrome.windows.WINDOW_ID_NONE) {
    // Using other application
    // console.log('unfocused');
    await endAnyActiveSession();
  } else {
    // Lookup the tab which is focused
    const window = await chrome.windows.get(windowId, { populate: true });
    if(!window || !window.tabs) {
      await endAnyActiveSession();
      return;
    } 
    const activeTab = window.tabs.filter(t => t.active)[0];
    if(!activeTab) {
      await endAnyActiveSession();
      return;
    }
    
    await handleActiveTab(activeTab);
  }
}

async function handleActiveTab(tab) {
  // Check if it's a match, if not: end any active session.
  const match = matchers.find(m => m.match(tab.url));
  if(match == null) {
    await endAnyActiveSession();
    return;
  }

  // If we have a match, create/switch or continue session.
  let { activeSession } = await chrome.storage.local.get({ activeSession: null });
  if(activeSession && activeSession.pattern !== match.pattern) {
    await endAnyActiveSession();
    // Switch session
    await chrome.storage.local.set({ activeSession: { pid: pid, pattern: match.pattern, start: unix(), tabId: tab.id }});
  } else if (!activeSession) {
    // Start new session
    await chrome.storage.local.set({ activeSession: { pid: pid, pattern: match.pattern, start: unix(), tabId: tab.id }});
  }
  // console.log('session started');
}

async function handleTabsOnActivated({ tabId, windowId }) {
  const activeTab = await chrome.tabs.get(tabId);
  await handleActiveTab(activeTab);
}

async function handleTabsOnRemoved(tabId, { isWindowClosing, windowId }) {
  // If we have an active session on this tab, we close it.
  const { activeSession } = await chrome.storage.local.get({ activeSession: { } });
  if(activeSession?.tabId === tabId) {
    await endAnyActiveSession();
  };
}

async function sessionHandler(details) {
  const tab = await chrome.tabs.get(details.tabId);
  if(tab.active) {
    await handleActiveTab(tab);
  }
}

// Initialize application
async function main() {
  await refreshConfig();

  // Backup interceptors (registerContentScript doesn't work in incognito)
  chrome.webNavigation.onBeforeNavigate.addListener(navigationHandler); 
  chrome.webNavigation.onCommitted.addListener(navigationHandler);
  chrome.webNavigation.onCommitted.addListener(sessionHandler);

  // Track time counters
  chrome.windows.onFocusChanged.addListener(handleWindowOnFocusChanged);
  chrome.tabs.onActivated.addListener(handleTabsOnActivated);
  chrome.tabs.onRemoved.addListener(handleTabsOnRemoved);
}
main();
