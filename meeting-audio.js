import {Room,RoomEvent,Track} from 'livekit-client';
export async function connectAudio({url,token,container,onStatus,onMute,onSpeakers,onDisconnect}){
 const room=new Room({adaptiveStream:true,dynacast:true,audioCaptureDefaults:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},publishDefaults:{audioPreset:{maxBitrate:24000},dtx:true,red:true}});
 room.on(RoomEvent.TrackSubscribed,(track)=>{
  if(track.kind!==Track.Kind.Audio)return;
  const element=track.attach();element.dataset.meetingAudio='';container.append(element);
  element.play().catch(()=>onStatus('Tryck på Spela upp ljud om du inte hör deltagarna.'));
 });
 room.on(RoomEvent.TrackUnsubscribed,track=>track.detach().forEach(el=>el.remove()));
 room.on(RoomEvent.ActiveSpeakersChanged,people=>onSpeakers(people.map(p=>Number(p.identity))));
 room.on(RoomEvent.Reconnecting,()=>onStatus('Ljudanslutningen återansluter…'));
 room.on(RoomEvent.Reconnected,()=>onStatus('Ljudet är anslutet igen.'));
 room.on(RoomEvent.Disconnected,()=>{onMute(false);onDisconnect();});
 let connected=false;
 try{
  await room.connect(url,token,{autoSubscribe:true});
  connected=true;onStatus('Du lyssnar. Slå på mikrofonen när du vill prata.');onMute(false);
 }catch(error){await room.disconnect();throw error;}
 return {
  async microphone(enabled){await room.localParticipant.setMicrophoneEnabled(enabled);onMute(enabled);},
  async playback(){await room.startAudio();},
  async disconnect(){if(!connected)return;connected=false;await room.disconnect();container.querySelectorAll('[data-meeting-audio]').forEach(el=>el.remove());},
  get connected(){return room.state==='connected';}
 };
}
