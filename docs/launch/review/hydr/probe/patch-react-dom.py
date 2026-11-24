"""Makes the react-dom chunk log at the hydration mismatch throw (used by hyd3.mjs, served through a Playwright route).
usage: python3 patch-react-dom.py <a9b5e390-....js from .next/static/chunks> <out.js>
In the minified chunk `function rD(e){var n=Error(i(418,...` is throwOnHydrationMismatch(fiber). The patch logs, before the
throw: the fiber's host/component ancestors, the next hydratable DOM node and its parent (HYDR418), and the JS call stack and
first child (HYDR418S / HYDR418C). Names (rD, rN) are the minified names of that build; adjust for another build."""
import sys
s = open(sys.argv[1]).read()
old = "function rD(e){var n=Error(i(418,"
assert s.count(old) == 1, "pattern not found"
patch = ('function rD(e){try{var __s=[];for(var __f=e;__f&&__s.length<16;__f=__f.return)__s.push((typeof __f.type==="string"?__f.type:'
         '(__f.type&&(__f.type.displayName||__f.type.name))||("tag"+__f.tag)));console.log("HYDR418 "+JSON.stringify({stack:__s,tag:e.tag,'
         'type:typeof e.type==="string"?e.type:null,next:rN&&(rN.outerHTML||rN.textContent||"").slice(0,300),nextName:rN&&rN.nodeName,'
         'nextParent:rN&&rN.parentNode&&rN.parentNode.nodeName}));console.log("HYDR418S "+String(new Error().stack).split("\\n").slice(1,7).join(" | "))}'
         'catch(_){}var n=Error(i(418,')
open(sys.argv[2], "w").write(s.replace(old, patch))
