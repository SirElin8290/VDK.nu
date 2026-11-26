import L from 'leaflet';
export async function mountMap(el,initial,onSelect){
 let css=document.querySelector('#journey-map-css');if(!css){css=document.createElement('link');css.id='journey-map-css';css.rel='stylesheet';css.href='./assets/journey/leaflet.css';document.head.append(css);}
 if(!css.sheet)await new Promise((resolve,reject)=>{css.addEventListener('load',resolve,{once:true});css.addEventListener('error',reject,{once:true});});
 if(!el.isConnected)throw Error('Kartan har stängts');
 const map=L.map(el,{scrollWheelZoom:false}).setView([59.7,13.3],7),markers=L.layerGroup().addTo(map);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
 function update(rows){markers.clearLayers();const groups=new Map();for(const x of rows){if(!x.lat||!x.lng)continue;const key=x.lat+','+x.lng;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(x);}const bounds=[];for(const xs of groups.values()){const x=xs[0],all=xs.every(v=>v.visited),some=xs.some(v=>v.visited);bounds.push([x.lat,x.lng]);const popup=document.createElement('div');for(const row of xs){const b=document.createElement('button');b.type='button';b.className='journey-map-choice';b.textContent=(row.visited?'✓ ':'○ ')+row.name;b.addEventListener('click',()=>onSelect(row.id));popup.append(b);}L.marker([x.lat,x.lng],{title:xs.map(v=>v.name).join(', '),icon:L.divIcon({className:'journey-pin '+(all?'visited':some?'partial':''),html:'<span>'+ (xs.length>1?xs.length:all?'✓':'○')+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).bindPopup(popup).addTo(markers);}if(bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:11,animate:false});}
 update(initial);requestAnimationFrame(()=>map.invalidateSize());return {update,remove:()=>map.remove()};
}
