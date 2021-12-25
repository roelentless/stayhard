import random from 'lodash/random';
import mustache from 'mustache';

let config;

function parseTemplate(templateString, ctx = {}) {
  const { activation, sites } = config;
  return mustache.render(templateString, {
    activation,
    sites,
    ctx: {
      ...ctx,
      site: location.host.split(':')[0],
    },
  });
}

async function main() {
  // Makes it difficult to detect stay hard overlay on a page in simple way.
  const stayHardOverlay = chrome.runtime.id.substring(0,16); 
  if (document.getElementById(stayHardOverlay)) return;

  const fontRegular = chrome.runtime.id+'Regular';
  const fontMedium = chrome.runtime.id+'SemiBold';
  document.fonts.add(new FontFace(fontRegular, `url('${chrome.runtime.getURL('assets/SourceCodePro-Regular.ttf')}')`));
  document.fonts.add(new FontFace(fontMedium, `url('${chrome.runtime.getURL('assets/SourceCodePro-Medium.ttf')}')`));

  const overlay = document.createElement('div');
  overlay.id = stayHardOverlay;
  overlay.style.position = 'fixed';
  overlay.style.padding = 0;
  overlay.style.margin = 0;
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.zIndex = 99999;
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = '#808080';
  overlay.style.webkitTouchCallout = 'none';
  overlay.style.webkitUserSelect = 'none';
  overlay.style.khtmlUserSelect = 'none';
  overlay.style.mozUserSelect = 'none';
  overlay.style.userSelect = 'none';
  overlay.style.cursor = 'pointer';

  const reminder = document.createElement('div');
  reminder.style.letterSpacing = '6px';
  reminder.style.fontFamily = `${fontMedium}`; 
  reminder.style.textAlign = 'center';

  const img = document.createElement('img');
  img.ondragstart = function() { return false };
  img.style.width = '500px';
  img.style.height = '333.33px';
  img.style.borderRadius = '50%';
  img.style.opacity = '0.65';
  img.draggable = 'false';

  const imgWrapper = document.createElement('div');
  imgWrapper.style.textAlign = 'center';
  imgWrapper.style.marginTop = '50px';
  imgWrapper.appendChild(img);

  const drill = document.createElement('div');
  overlay.style.fontFamily = `${fontRegular}`;
  drill.style.letterSpacing = '1px';
  drill.style.textAlign = 'center';
  // drill.style.fontWeight = '500';
  const drillDefaultFontSize = '22px';
  drill.style.fontSize = drillDefaultFontSize;
  drill.style.marginTop = '50px';

  // Wrap to limit width
  const wrapper = document.createElement('div');
  wrapper.style.maxWidth = '800px';
  // wrapper.style.border = '1px solid red';
  wrapper.style.textAlign = 'center';
  wrapper.style.margin = '0 auto';
  wrapper.style.marginTop = '50px';
  wrapper.style.fontSize = '48px';
  wrapper.style.textAlign = 'center';
  wrapper.style.color = '#000';
  // wrapper.style.fontWeight = '900';
  // wrapper.style.fontFamily = `Helvetica, Verdana, Arial`;

  // Append to overlay
  wrapper.replaceChildren(reminder, imgWrapper, drill);
  overlay.replaceChildren(wrapper);

  // Render and block as fast as we can
  document.documentElement.appendChild(overlay);

  // Hide + remove if not requested
  chrome.runtime.sendMessage({ action: "status", host: location.host }, function(res) {
    if(res.access === true) {
      overlay.style.display = 'none';
      // Doing this later avoids sorts of nasty event handling below
      setTimeout(_ => document.documentElement.removeChild(overlay), 1000);
    }
  });

  // Add click handler to remove
  let timeout, interval;
  let ctx = {};

  overlay.onmousedown = function() {
    if(!timeout) {
      drill.style.fontSize = '24px';
      ctx.holdSecondsRemaining = config.activation.holdSeconds;
      ctx.getSoftTemplate = config.personality.onGetSoft[random(0, config.personality.onGetSoft.length-1)].drill;
      drill.innerHTML = parseTemplate(ctx.getSoftTemplate, ctx);
      timeout = setTimeout(async _ => {
        // Notify background to disable on this site for a few seconds
        chrome.runtime.sendMessage({ 
            action: "hostActivated", 
            host: location.host,
          }, 
          () => document.documentElement.removeChild(overlay),
        );
      }, config.activation.holdSeconds * 1000);
      
      // Re-render content every second
      interval = setInterval(_ => {
        ctx.holdSecondsRemaining -= 1;
        drill.innerHTML = parseTemplate(ctx.getSoftTemplate, ctx);
      }, 1000);
    }
  }
  overlay.onmouseup = function() {
    if(timeout != null) {
      clearTimeout(timeout);
      clearInterval(interval);
      timeout = null;
      interval = null;
    }

    // Reset drill
    drill.innerHTML = ctx.drillParsed;
    drill.style.fontSize = drillDefaultFontSize;
  }

  // Fetch assets and build content
  const { config: config_ } = await chrome.storage.sync.get('config');
  config = config_; // Make it available in top scope;
  
  // Initialize vars which are expected to be loaded
  ctx.holdSecondsRemaining = config.activation.holdSeconds;

  // Set the content
  ctx.view = config.personality.onView[random(0, config.personality.onView.length-1)];
  ctx.drillParsed = parseTemplate(ctx.view.drill, ctx);
  reminder.innerHTML = parseTemplate(ctx.view.reminder, ctx);
  drill.innerHTML = ctx.drillParsed;
  img.src = chrome.runtime.getURL(ctx.view.img);
}
main();
