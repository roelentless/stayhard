import { h, Fragment, render } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';
import random from 'lodash/random';
import mustache from 'mustache';
import dayjs from 'dayjs';

// TODO: watch the history api for changes to URL to capture single page apps.
// TODO: when entering applications via deeplink from a referer app, it can be assumed user is in "workflow", which should not show blocker. Only muscle memory should trigger the overlay, or when user continues after the page.
// TODO: set a new text every 1.5 seconds while pressing down.
// TODO: define time-period exceptions to the list are active. Eg: during work, techcrunch is allowed.
// TODO: use ufti instead of preact in a dull moment.
// TODO: mobile extension for safari/chrome.

let root;
let config;

// Makes it difficult to detect stay hard overlay on a page in simple way.
function overlayId() {
  return chrome.runtime.id.substring(0,16);
}

const fontRegular = overlayId()+'Regular';
const fontMedium = overlayId()+'SemiBold';

function parseTemplate(templateString, ctx = {}) {
  const { activation, sites } = config;
  return mustache.render(templateString, {
    activation,
    sites: sites.map(s => s.filter),
    ctx: {
      ...ctx,
      site: location.host.split(':')[0],
    },
  });
}

let timeout, interval;
let ctx = {};

const Overlay = () => {
  const drillDefaultFontSize = '22px';

  const [visibility, setVisibility] = useState('block');
  const [drillSize, setDrillSize] = useState(drillDefaultFontSize);
  const [drillHtml, setDrillHtml] = useState(undefined);
  const [reminderHtml, setReminderHtml] = useState(undefined);
  const [imgSrc, setImgSrc] = useState(undefined);
  const [softRoutineStatuses, setSoftRoutineStatuses] = useState({});
  const [routineFeedback, setRoutineFeedback] = useState('');

  function removeOverlay() {
    setVisibility('none');
    setTimeout(() => {
      document.documentElement.removeChild(root.__e);
      root = null;
    }, 1000);
  }

  // Start countdown when pressing down and schedule release
  const onmousedown = useCallback(e => {
    if(!timeout) {
      if(e.target.tagName.toUpperCase() === 'BUTTON') return; // make sure the "Only this page" doesn't flash
      setDrillSize('24px');
      ctx.holdSecondsRemaining = config.activation.holdSeconds;
      ctx.getSoftTemplate = config.personality.onGetSoft[random(0, config.personality.onGetSoft.length-1)].drill;
      setDrillHtml(parseTemplate(ctx.getSoftTemplate, ctx))
      timeout = setTimeout(() => {
          // Notify background to disable on this site for a few seconds
          chrome.runtime.sendMessage({ 
              action: "hostActivated", 
              host: location.host,
            }, 
            () => removeOverlay(),
          );
        }, 
        config.activation.holdSeconds * 1000,
      );
      
      // Re-render content every second
      interval = setInterval(_ => {
        ctx.holdSecondsRemaining -= 1;
        setDrillHtml(parseTemplate(ctx.getSoftTemplate, ctx))
      }, 1000);
    }
  });

  // Release and abort countdown on releasing mouse
  const onmouseup = useCallback(() => {
    if(timeout != null) {
      clearTimeout(timeout);
      clearInterval(interval);
      timeout = null;
      interval = null;
    }

    // Reset drill
    setDrillHtml(ctx.drillParsed);
    setDrillSize(drillDefaultFontSize);
  });

  // Hide && remove when in allowlist
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "status", host: location.host, origin: location.origin }, function(res) {
      if(res.access === true) {
        removeOverlay();
      } else {
        chrome.runtime.sendMessage({ action: 'interception', host: location.host, origin: location.origin }, function() {
          // No action required.
        });
      }
    });
  }, []);

  // Fetch assets and set content async to ensure we are blocking on first render
  useEffect(async () => {
    const { config: config_ } = await chrome.storage.sync.get('config');
    config = config_; // Make it available in top scope;
    
    // Initialize vars which are expected to be loaded
    ctx.holdSecondsRemaining = config.activation.holdSeconds;

    // Set the content
    ctx.view = config.personality.onView[random(0, config.personality.onView.length-1)];
    ctx.drillParsed = parseTemplate(ctx.view.drill, ctx);

    setReminderHtml(parseTemplate(ctx.view.reminder, ctx));
    setDrillHtml(ctx.drillParsed);
    setImgSrc(chrome.runtime.getURL(ctx.view.img));
  }, []);

  // Enable a routine. This function can only be called if the routine is allowed.
  const startSoftRoutine = (routine, disabled) => {
    // Show feedback if needed
    setRoutineFeedback('');
    if(disabled) {
      const resetTime = dayjs(softRoutineStatuses[routine.label] + routine.resetTime*1000);
      setRoutineFeedback(`${routine.label} is burned, resets on: ${resetTime.format()}`)

      return;
    }

    // When not disabled: load
    removeOverlay();
    chrome.runtime.sendMessage({ action: 'startSoftRoutine', href: location.href, path: location.pathname, routine }, function() {
      // No action required.
    });
  }

  useEffect(() => {
    (async () => {
      let { softRoutineStatuses } = (await chrome.storage.local.get({ softRoutineStatuses: {} }));
      setSoftRoutineStatuses(softRoutineStatuses)
    })();
  }, []);

  return (
    <div 
      id={overlayId()} 
      onmousedown={onmousedown}
      onmouseup={onmouseup}
      style={{
        display: visibility,
        position: 'fixed',
        padding: 0,
        margin: 0,
        top: 0,
        left: 0,
        zIndex: 99999,
        width: '100%',
        height: '100%',
        backgroundColor: '#808080',
        webkitTouchCallout: 'none',
        webkitUserSelect: 'none',
        khtmlUserSelect: 'none',
        mozUserSelect: 'none',
        userSelect: 'none',
        cursor: 'pointer',
        fontFamily: `${fontRegular}`,
      }}
    >

      {/* Wrapper */}
      <div style={{
          maxWidth: '800px',
          // border: '1px solid red',
          textAlign: 'center',
          margin: '0 auto',
          marginTop: '50px',
          fontSize: '48px',
          color: '#000',
        }}>

        {/* Reminder */}
        <div 
          style={{
            letterSpacing: '6px',
            fontFamily: `${fontMedium}`,
            textAlign: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: reminderHtml }}
        ></div>

        {/* Image */}
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
          <img 
            draggable={false}
            ondragstart={() => false} 
            src={imgSrc}
            style={{
              margin: '0 auto',
              width: '500px',
              height: '333.33px',
              borderRadius: '50%',
              boxShadow: '0 0 12px 10px rgba(255,255,255,0.5)',
              webkitBoxShadow: '0 0 12px 10px rgba(255,255,255,0.5)',
              mozBoxShadow: '0 0 12px 10px rgba(255,255,255,0.5)',
              opacity: '0.65',
            }}></img>
        </div>

        {/* Drill */}
        <div 
          style={{
            letterSpacing: '1px',
            textAlign: 'center',
            fontSize: drillSize,
            marginTop: '50px',
          }} 
          dangerouslySetInnerHTML={{ __html: drillHtml }}
        ></div>
      </div>

      {/* Soft routines */}
      <div 
        style={{
          position: 'absolute',
          letterSpacing: '1px',
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          bottom: '50px',
          width: '600px',
          textAlign: 'center',
        }}>
          <div style={{marginBottom: '10px'}}>{routineFeedback}</div>

          {config && config.softRoutines && config.softRoutines.map(routine => {
            // Make button disabled if burned
            const time = softRoutineStatuses[routine.label];
            let disabled = false;
            if(time && (Date.now()-time) < routine.resetTime*1000) {
              disabled = true;
            }

            return (
              <button 
                onclick={() => startSoftRoutine(routine, disabled)}
                style={{
                  backgroundColor: 'transparent',
                  borderRadius: '5px',
                  border: '1px dashed #000',
                  padding: '6px 12px',
                  marginRight: '6px',
                  userSelect: 'none',
                  cursor: 'pointer',
                  opacity: disabled ? '0.3' : '1.0',
                }}>{routine.label}</button>
            )
          })}
      </div>
    </div>
  )
}

async function main() {
  if (document.getElementById(overlayId())) return;
  
  if(!document.fonts.check('16px '+fontRegular)) {
    document.fonts.add(new FontFace(fontRegular, `url('${chrome.runtime.getURL('assets/SourceCodePro-Regular.ttf')}')`));
    document.fonts.add(new FontFace(fontMedium, `url('${chrome.runtime.getURL('assets/SourceCodePro-Medium.ttf')}')`));
  }

  // Render and block as fast as we can
  root = <Overlay />;
  render(root, document.documentElement);
}
main();