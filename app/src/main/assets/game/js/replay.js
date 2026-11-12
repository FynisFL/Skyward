(function(root){
'use strict';
const MAX_FRAMES=120000,MAX_INPUTS=50000,MAX_EVENTS=100000;
let mode='idle',tape=null,frameIndex=0,inputIndex=0,eventIndex=0,currentFrame=0,inFrame=false,divergences=[];
function clone(value){if(value===undefined)return null;try{const s=JSON.stringify(value);if(s===undefined)return null;if(s.length>12000)return{truncated:true,preview:s.slice(0,12000)};return JSON.parse(s);}catch(e){return{unserializable:true};}}
function start(seed,metadata){tape={version:1,seed:Number(seed)>>>0,metadata:clone(metadata||{}),frames:[],inputs:[],events:[],outcome:null,finished:false};mode='record';frameIndex=inputIndex=eventIndex=currentFrame=0;inFrame=false;divergences=[];return getTape();}
const isRecording=()=>mode==='record',isPlaying=()=>mode==='playback',isReady=()=>mode==='ready';
function recordInput(action,data){if(mode!=='record'||!tape||tape.inputs.length>=MAX_INPUTS)return false;tape.inputs.push({frame:inFrame?currentFrame:tape.frames.length,action:String(action),data:clone(data||{})});return true;}
function beginFrame(dt){if(mode!=='record'||!tape)return false;if(tape.frames.length>=MAX_FRAMES){tape.truncated=true;return false;}currentFrame=tape.frames.length;inFrame=true;tape.frames.push(Math.max(0,Math.min(.06,Number(dt)||0)));return true;}
function endFrame(){inFrame=false;}
function recordEvent(type,payload){
 const value=clone(payload);
 if(mode==='record'&&tape&&tape.events.length<MAX_EVENTS){tape.events.push({frame:inFrame?currentFrame:tape.frames.length,type:String(type),payload:value});return true;}
 if(mode==='playback'&&tape){const expected=tape.events[eventIndex++],actual={frame:currentFrame,type:String(type),payload:value};if(!expected||expected.frame!==actual.frame||expected.type!==actual.type||JSON.stringify(expected.payload)!==JSON.stringify(actual.payload))divergences.push({expected:expected||null,actual});return true;}
 return false;
}
function load(input){const parsed=typeof input==='string'?JSON.parse(input):input;if(!parsed||parsed.version!==1||!Array.isArray(parsed.frames)||!Array.isArray(parsed.inputs)||!Array.isArray(parsed.events)||!Number.isFinite(Number(parsed.seed)))throw new TypeError('Invalid Skyward replay tape');if(parsed.frames.length>MAX_FRAMES||parsed.inputs.length>MAX_INPUTS||parsed.events.length>MAX_EVENTS)throw new RangeError('Replay tape exceeds safety limits');tape=clone(parsed);mode='ready';frameIndex=inputIndex=eventIndex=currentFrame=0;inFrame=false;divergences=[];return getTape();}
function getTape(){return tape?clone(tape):null;}
function startPlayback(){if(mode!=='ready'||!tape)throw new Error('Load a replay tape before playback');mode='playback';frameIndex=inputIndex=eventIndex=currentFrame=0;inFrame=false;divergences=[];return status();}
function nextFrame(){if(mode!=='playback'||!tape)return null;if(frameIndex>=tape.frames.length){stopPlayback();return null;}currentFrame=frameIndex;return{index:frameIndex,dt:tape.frames[frameIndex++]};}
function drainInputsForFrame(index){if(mode!=='playback'||!tape)return[];const due=[];while(inputIndex<tape.inputs.length&&tape.inputs[inputIndex].frame<=index)due.push(clone(tape.inputs[inputIndex++]));return due;}
function compareRemaining(){if(tape)while(eventIndex<tape.events.length)divergences.push({expected:clone(tape.events[eventIndex++]),actual:null});}
function stopPlayback(){if(mode==='playback'){compareRemaining();mode='idle';inFrame=false;}return status();}
function status(){return{mode,seed:tape?tape.seed:null,frames:tape?tape.frames.length:0,inputs:tape?tape.inputs.length:0,events:tape?tape.events.length:0,playbackFrame:frameIndex,eventCursor:eventIndex,divergences:divergences.length,finished:!!(tape&&tape.finished),truncated:!!(tape&&tape.truncated)};}
function finish(outcome){if(mode==='record'&&tape){tape.outcome=clone(outcome||{});tape.finished=true;mode='idle';inFrame=false;return status();}if(mode==='playback')return stopPlayback();return status();}
const api={start,load,getTape,export:()=>tape?JSON.stringify(tape):null,startPlayback,nextFrame,drainInputsForFrame,recordInput,recordEvent,beginFrame,endFrame,finish,stopPlayback,isRecording,isPlaying,isReady,status};
root.SkywardReplay=api;
if(root.SkywardEvents&&typeof root.SkywardEvents.on==='function')root.SkywardEvents.on('*',e=>api.recordEvent(e.type,e.payload));
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
