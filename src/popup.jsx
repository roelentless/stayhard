import { h, Fragment, render } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';
import { defaultConfig } from "./config";
import duration from 'humanize-time';

async function getStats() {
  const { sessions, interceptions, activations } = await chrome.storage.local.get({ sessions: [], interceptions: [], activations: [] });
  
  // Count session times
  let totalTime = 0;
  for(let session of sessions) {
    totalTime += session.end - session.start;
  }

  return {
    wastedTime: duration(totalTime*1000),
    nrInterceptions: interceptions.length,
    nrActivations: activations.length,
  };
}

const Popup = () => {
  const [config, setConfig] = useState('');
  const [configFeedback, setConfigFeedback] = useState('');
  const [incognitoAllowed, setIncognitoAllowed] = useState(true);
  const [configFeedbackClassname, setConfigFeedbackClassname] = useState('');
  const [stats, setStats] = useState('');

  useEffect(async () => {
    chrome.storage.sync.onChanged.addListener(async () => {
      const { config } = await chrome.storage.sync.get('config');
      setConfig(JSON.stringify(config, null, 2));
    });
    
    chrome.extension.isAllowedIncognitoAccess(isAllowedAccess => setIncognitoAllowed(isAllowedAccess));
    const { config } = await chrome.storage.sync.get('config');
    setConfig(JSON.stringify(config, null, 2));
    setStats(await getStats());
  }, []);

  const onclickIncognito = useCallback(() => {
    alert('Please allow private/incognito mode in the following screen.');
    chrome.tabs.create({
        url: 'chrome://extensions/?id=' + chrome.runtime.id
    });
  }, []);

  const onclickReset = useCallback(async () => {
    if(confirm("Do you want to reset the config to default settings?")) {
      await chrome.storage.sync.set({ config: defaultConfig });
    }
  });

  const onclickConfig = useCallback(async () => {
    setConfigFeedback('');
    // Validate and store
    try {
      if(!config || config == '') throw new Error('config missing');
      let deserialized = JSON.parse(config);
      await chrome.storage.sync.set({ config: deserialized });
      setConfigFeedback('saved');
      setConfigFeedbackClassname('label label-success');
    } catch(err) {
      setConfigFeedback(err.message);
      setConfigFeedbackClassname('label label-error');
    }
  });

  return (
    <div>

      <div>
        <span style="font-size: 0.7em; font-weight: bolder">In last 7 days:</span> <span style="font-weight: bolder;">{stats.wastedTime}</span> wasted, <span style="font-weight: bolder;">{stats.nrInterceptions}</span> interceptions, of which you got soft <span style="font-weight: bolder;">{stats.nrActivations}</span> times.
      </div>

      <div class="text-success" style="font-size: 0.8em;">
        <span style="font-weight: bolder;">Stay Hard</span> activates only on the sites in below config.<br/>
        Your information stays on your device and is never ever shared. You can inspect the source code.
      </div>

      {/* Render incognito button if not allowed yet */}
      {(!incognitoAllowed) && <button class="btn btn-sm btn-primary" onclick={onclickIncognito}>Allow in private mode</button>}

      <div class="form-group">
        <label class="form-label" for="config">Config (<a href="https://www.maxvancollenburg.com/write-json/" target="_blank">JSON format</a>)</label>
        <textarea 
          id="config" 
          class="form-input"
          value={config}
          onchange={e => setConfig(e.target.value)}
          style="height: 320px; padding: 1px; font-size: 14px; font-family: 'Courier New', Courier, monospace;"></textarea>
        <button class="btn btn-primary input-group-btn" onclick={onclickConfig}>Save</button> <span class={configFeedbackClassname}>{configFeedback}</span>
      </div>

      <div>
        Visit <a href="https://github.com/ruleb/stayhard" target="blank">github.com/ruleb/stayhard</a> for more personalities, to share your personality or to see the code.
      </div>
        
      <hr />

      <button class="btn btn-sm btn-error" onclick={onclickReset}>Reset Config to default</button>
      <div class="form-group">
        <label class="form-label" for="defaultConfig">Default config (for reference)</label>
        <textarea 
          id="defaultConfig"
          class="form-input" 
          disabled
          style="height: 320px; padding: 1px; font-size: 14px; font-family: 'Courier New', Courier, monospace;"
          >{JSON.stringify(defaultConfig, null, 2)}</textarea>
      </div>

    </div>
  );
}

render(<Popup />, document.body);