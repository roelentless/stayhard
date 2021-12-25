import { defaultConfig } from "./config";

async function reloadConfig() {
  const { config } = await chrome.storage.sync.get('config');
  document.getElementById('config').value = JSON.stringify(config, null, 2);
}

async function loadConfigArea() {
  const configEl = document.getElementById('config');
  const configBtn = document.getElementById('configBtn');
  configBtn.onclick = async function () {
    document.getElementById('configFeedback').innerHTML = '';
    // Validate and store
    try {
      if(configEl.value == '') throw new Error('config missing');
      let deserialized = JSON.parse(configEl.value);
      // console.log({ saved: deserialized });
      await chrome.storage.sync.set({ config: deserialized });
      document.getElementById('configFeedback').innerHTML = 'saved';
      document.getElementById('configFeedback').className = 'label label-success';
      configEl.value = JSON.stringify(deserialized, null, 2);
    } catch(err) {
      document.getElementById('configFeedback').innerHTML = err.message;
      document.getElementById('configFeedback').className = 'label label-error';
    }
  }

  document.getElementById('resetConfig').onclick = async function() {
    if(confirm("Do you want to reset the config?")) {
      await chrome.storage.sync.set({ config: defaultConfig });
      await reloadConfig();
    }
  }

  document.getElementById('defaultConfig').value = JSON.stringify(defaultConfig, null, 2);

  document.getElementById('incognito').onclick = function() {
    chrome.extension.isAllowedIncognitoAccess(function(isAllowedAccess) {
        if (isAllowedAccess) return; // Great, we've got access
        alert('Please allow private/incognito mode in the following screen.');
        chrome.tabs.create({
            url: 'chrome://extensions/?id=' + chrome.runtime.id
        });
    });
  }

  chrome.extension.isAllowedIncognitoAccess(function(isAllowedAccess) {
    if(isAllowedAccess) {
      document.getElementById('incognito').parentElement.removeChild(document.getElementById('incognito'));
    }
  });
}

async function main() {
  await reloadConfig();
  await loadConfigArea();
}
main();