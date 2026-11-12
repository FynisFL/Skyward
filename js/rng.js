(function(root){
'use strict';
const NAMES=['gameplay','ai','weapon','vfx','cosmetic','audio','texture'];
const FALLBACK=0x6d2b79f5;
let seed=FALLBACK,states=Object.create(null);
function hash(value){
 if(typeof value==='number'&&Number.isFinite(value))return(value>>>0)||FALLBACK;
 const s=String(value==null?'':value);let h=2166136261;
 for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
 return(h>>>0)||FALLBACK;
}
function ensure(name){const k=NAMES.indexOf(name)>=0?name:'cosmetic';if(states[k]===undefined)states[k]=hash(seed+':'+k);return k;}
function reset(value){seed=hash(value);states=Object.create(null);NAMES.forEach(ensure);return seed;}
function random(name){const k=ensure(name||'cosmetic');let x=states[k]>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;x>>>=0;if(!x)x=FALLBACK;states[k]=x;return x/4294967296;}
function range(name,min,max){return min+random(name)*(max-min);}
function int(name,min,max){return Math.floor(range(name,min,max+1));}
function choose(name,values){return Array.isArray(values)&&values.length?values[int(name,0,values.length-1)]:undefined;}
function shuffle(name,values){const out=Array.isArray(values)?values.slice():[];for(let i=out.length-1;i>0;i--){const j=int(name,0,i),t=out[i];out[i]=out[j];out[j]=t;}return out;}
function createSeed(){
 try{if(root.crypto&&typeof root.crypto.getRandomValues==='function'){const a=new Uint32Array(1);root.crypto.getRandomValues(a);return(a[0]>>>0)||FALLBACK;}}catch(e){}
 const p=root.performance&&typeof root.performance.now==='function'?Math.floor(root.performance.now()*1000)>>>0:0;
 return hash((Date.now()>>>0)^p^0xa511e9b3);
}
function getConfiguredSeed(){
 if(root.__SKYWARD_SEED__!==undefined&&root.__SKYWARD_SEED__!==null)return root.__SKYWARD_SEED__;
 try{const p=new URLSearchParams(root.location?root.location.search:'');if(p.has('seed'))return p.get('seed');}catch(e){}
 return null;
}
function snapshot(){const streams={};NAMES.forEach(n=>{streams[n]=states[n]>>>0;});return{version:1,seed:seed>>>0,streams};}
function restore(data){
 if(!data||data.version!==1||!Number.isFinite(Number(data.seed))||!data.streams)throw new TypeError('Invalid Skyward RNG snapshot');
 reset(Number(data.seed));NAMES.forEach(n=>{const v=Number(data.streams[n]);if(Number.isFinite(v))states[n]=(v>>>0)||FALLBACK;});return snapshot();
}
const api={version:1,streamNames:NAMES.slice(),reset,random,range,int,choose,shuffle,createSeed,getConfiguredSeed,getSeed:()=>seed>>>0,snapshot,restore};
root.SkywardRNG=api;const configured=getConfiguredSeed();reset(configured===null?createSeed():configured);
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
