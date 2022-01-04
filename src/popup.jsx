import { h, Fragment, render } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';
import { defaultConfig } from "./config";
import duration from 'humanize-time';
import './popup.css';

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
      setConfigFeedbackClassname('font-bold p-1 text-green-500');
    } catch(err) {
      setConfigFeedback(err.message);
      setConfigFeedbackClassname('font-bold p-1 text-red-500');
    }
  });

  return (
    <div 
      class="pl-1 pr-1 bg-slate-50" 
      style={{
        width: '600px',
        height: '600px',
      }}
    >

      <div class="flex flex-row pl-1 pr-1 mt-1 relative rounded bg-green-200">
        <div class="basis-1/3">
          <div class="font-black text-base">{stats.wastedTime}</div>
          <div class="text-sm">time wasted</div>
        </div>
        <div class="basis-1/3">
          <div class="font-black text-base">{stats.nrInterceptions}</div>
          <div class="text-sm">interceptions</div>
        </div>
        <div class="basis-1/3">
          <div class="font-black text-base">{stats.nrActivations}</div>
          <div class="text-sm">times you got soft</div>
        </div>
        <div class="absolute text-xs right-1 top-0 font-bold">
          last 7 days
        </div>
      </div>

      {/* Render incognito button if not allowed yet */}
      {(!incognitoAllowed) && <button class="btn" onclick={onclickIncognito}>Allow in private mode</button>}

      <div>
        <label class="font-bold text-xs" for="config">Config (<a href="https://www.maxvancollenburg.com/write-json/" target="_blank">JSON format</a>)</label>
        <textarea 
          id="config" 
          class="block text-xs p-1 w-full font-mono"
          value={config}
          onchange={e => setConfig(e.target.value)}
          style="height: 320px;"></textarea>
        <button class="btn mt-1" onclick={onclickConfig}>Save</button> <span class={configFeedbackClassname}>{configFeedback}</span>
      </div>

      <div class="flex flex-row mt-1">
        <div class="basis-1/2">
          Visit <a href="https://github.com/ruleb/stayhard" target="blank">github.com/ruleb/stayhard</a> for more personalities, to share your personality or to see the code.
        </div>
        <div class="basis-1/2 text-emerald-500 text-xs">
          <span class="font-bold">Stay Hard</span> activates only on the sites in below config. Your data stays on your device and is never shared.
        </div>
      </div>

      <hr class="mb-2" />

      <div>
        <label class="font-bold text-xs" for="defaultConfig">Default config (for reference)</label>
        <textarea 
          id="defaultConfig"
          class="block text-xs p-1 w-full disabled: bg-gray-100 font-mono" 
          disabled
          style="height: 320px;"
          >{JSON.stringify(defaultConfig, null, 2)}</textarea>
          <button class="btn bg-rose-500 font-normal text-xs py-1 px-2 mt-1" onclick={onclickReset}>Reset Config to default</button>
      </div>

    </div>
  );
}

render(<Popup />, document.body);