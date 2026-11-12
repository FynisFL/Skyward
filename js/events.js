(function(root){
'use strict';
function createBus(){
 const listeners=new Map();let sequence=0,destroyed=false;
 function remove(type,record){const a=listeners.get(type);if(!a)return false;const i=a.indexOf(record);if(i<0)return false;a.splice(i,1);if(!a.length)listeners.delete(type);return true;}
 function on(type,handler,options){
  if(destroyed)throw new Error('Skyward event bus has been destroyed');
  if(typeof type!=='string'||!type)throw new TypeError('Event type must be non-empty');
  if(typeof handler!=='function')throw new TypeError('Event handler must be a function');
  const record={handler,once:!!(options&&options.once)};if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(record);
  return()=>remove(type,record);
 }
 function once(type,handler){return on(type,handler,{once:true});}
 function emit(type,payload){
  if(destroyed)return null;
  const event={type,payload:payload===undefined?null:payload,sequence:++sequence};
  const direct=(listeners.get(type)||[]).slice(),wildcard=type==='*'?[]:(listeners.get('*')||[]).slice();
  direct.forEach(r=>{if(r.once)remove(type,r);try{r.handler(event.payload,event);}catch(e){if(root.console&&root.console.error)root.console.error('[SkywardEvents]',type,e);}});
  wildcard.forEach(r=>{if(r.once)remove('*',r);try{r.handler(event);}catch(e){if(root.console&&root.console.error)root.console.error('[SkywardEvents]',type,e);}});
  return event;
 }
 function off(type,handler){const a=listeners.get(type);if(!a)return 0;const found=a.filter(r=>r.handler===handler);found.forEach(r=>remove(type,r));return found.length;}
 function clear(type){if(type===undefined)listeners.clear();else listeners.delete(type);}
 function listenerCount(type){if(type!==undefined)return(listeners.get(type)||[]).length;let n=0;listeners.forEach(a=>{n+=a.length;});return n;}
 function destroy(){clear();destroyed=true;}
 return{on,once,off,emit,clear,listenerCount,destroy};
}
root.SkywardEvents=createBus();root.createSkywardEventBus=createBus;
if(typeof module!=='undefined'&&module.exports)module.exports={createBus};
})(typeof window!=='undefined'?window:globalThis);
