"""Build local, source-attributed historical lists and municipal map paths.
Requires cached official inventories and SCB RegSO 2025, plus shapely.
No requests are made when a member opens the journey page.
"""
import json, math, hashlib
from pathlib import Path
from collections import defaultdict
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union

root=Path(__file__).resolve().parent.parent
inventory=json.loads((root.parent/'outputs/VDK-hall-club-inventory-2026-11-26.json').read_text(encoding='utf-8'))
base=json.loads((root/'data-catalogs/journey-2026-27.json').read_text(encoding='utf-8'))
geo=json.loads((root.parent/'outputs/VDK-scb-journey-regso.json').read_text(encoding='utf-8'))
names=dict(zip(['1715','1730','1737','1760','1761','1762','1763','1764','1765','1766','1780','1781','1782','1783','1784','1785','1862','1883','1492','1460'],['Kil','Eda','Torsby','Storfors','Hammarö','Munkfors','Forshaga','Grums','Årjäng','Sunne','Karlstad','Kristinehamn','Filipstad','Hagfors','Arvika','Säffle','Degerfors','Karlskoga','Åmål','Bengtsfors']))
groups=defaultdict(list)
for f in geo['features']:groups[f['properties']['kommunkod']].append(shape(f['geometry']))
polys={code:unary_union(parts) for code,parts in groups.items()}
bounds=unary_union(list(polys.values())).bounds
west,south,east,north=bounds;cos=math.cos(math.radians(59.7));scale=min(610/((east-west)*cos),770/(north-south))
def project(lon,lat):return [round(25+(lon-west)*cos*scale,2),round(25+(north-lat)*scale,2)]
def path(poly):
 parts=list(poly.geoms) if poly.geom_type=='MultiPolygon' else [poly];out=[]
 for part in parts:
  for ring in [part.exterior,*part.interiors]:
   ps=[project(*p) for p in ring.coords];out.append('M'+'L'.join(f'{x},{y}' for x,y in ps)+'Z')
 return ''.join(out)
municipalities=[]
for code,poly in polys.items():
 simple=poly.simplify(.0012,preserve_topology=True);center=poly.representative_point()
 municipalities.append(dict(id=code,name=names[code],path=path(simple),label=project(center.x,center.y)))
def municipality(h):
 if h.get('lat') and h.get('lng'):
  p=Point(h['lng'],h['lat']);found=next((c for c,g in polys.items() if g.covers(p)),None)
  if found:return found
 cities={'Vallargärdet':'1780','Skåre':'1780','Karlstad':'1780','Arvika':'1784','Skoghall':'1761','Hammarö':'1761','Åmål':'1492','Billingsfors':'1460','Dals-Långed':'1460','Karlskoga':'1883','Degerfors':'1862','Koppom':'1730','Charlottenberg':'1730','Åmotfors':'1730','Deje':'1763','Forshaga':'1763','Filipstad':'1782','Lesjöfors':'1782','Nykroppa':'1782','Hagfors':'1783','Ekshärad':'1783','Kil':'1715','Fagerås':'1715','Tolita':'1715','Kristinehamn':'1781','Munkfors':'1762','Torsby':'1737','Sysslebäck':'1737','Sunne':'1766','Säffle':'1785','Årjäng':'1765','Molkom':'1780','Vålberg':'1780','Väse':'1780','Skattkärr':'1780','Grums':'1764','Storfors':'1760'}
 return cities.get(h.get('city'))
def norm(s):return ' '.join(s.casefold().split())
aliases={'strandhallen':'strandhallen arvika','asp byggmaskiner arena':'asp arena','hammarö arena a':'hammarö arena','karlbergshallen a':'karlbergshallen a karlskoga','karlbergshallen b':'karlbergshallen b karlskoga','karlbergshallen':'karlbergshallen åmål','skattkärrskolan':'skattkärrsskolan','sparbankshallen':'sparbankshallen sunne','ga-hallen':'ga-hallen, sysslebäck'}
hallnames={norm(h['name']) for h in base['halls']};halls=[]
for h in base['halls']:
 v=dict(h)
 if h['id']==4874:
  cached=root.parent/'outputs/VDK-vallargardet-geocode.json'
  if cached.exists():
   position=json.loads(cached.read_text(encoding='utf-8'))[0];v['lat']=float(position['lat']);v['lng']=float(position['lon']);v['locationSource']='OpenStreetMap, geokodad skoladress Diamantvägen 12';v['locationNote']='Ungefärlig position vid Vallargärdets skola.'
 v['key']=str(h['id']);v['scope']='active';v['municipality']=municipality(v)
 if v.get('lat') and v.get('lng'):v['point']=project(v['lng'],v['lat'])
 halls.append(v)
for name,city,*_ in inventory['halls']['rows']:
 n=aliases.get(norm(name),norm(name))
 if n in hallnames:continue
 hallnames.add(n);v=dict(key='history:hall:'+hashlib.sha256(n.encode()).hexdigest()[:12],name=name,city=city,scope='legends',reviewNote='Historisk hallförteckning. Aktuell matchanvändning inte bekräftad.',municipality=municipality(dict(city=city)))
 halls.append(v)
clubnames={norm(c['name']) for c in base['clubs']};clubs=[dict(c,key=str(c['id']),scope='active') for c in base['clubs']]
for name,rf,active in inventory['clubs']['rows']:
 n={'åmotsfors if':'åmotfors if'}.get(norm(name),norm(name))
 if n in clubnames:continue
 clubnames.add(n);clubs.append(dict(key='history:club:'+rf,name=name,scope='legends',reviewNote='Historisk förening.' if active=='Nej' else 'Finns i föreningsregistret, men aktuell tävlingsverksamhet är inte bekräftad.',sourceActive=active=='Ja'))
for key,name,source in [('mb87','MB87','Namn uppgivet av VDK.'),('tosse','Tösse IF','https://bohuslan-dalsland.svenskfotboll.se/nyheter/2026/besok-his-tosse-if/')]:
 if norm(name) not in clubnames:clubs.append(dict(key='history:club:'+key,name=name,scope='legends',reviewNote='Historiskt innebandynamn.',source=source))
for c in clubs:
 if c.get('lat') and c.get('lng'):c['point']=project(c['lng'],c['lat']);c['municipality']=municipality(c)
# Municipality headings from the official club history, cached once during review.
# Reuse existing catalogue identities; this does not add or approve new names.
source=root.parent/'outputs/VDK-journey-club-municipalities.json'
if source.exists():
 by_name={};by_rf={};codes={v:k for k,v in names.items()}
 for section in json.loads(source.read_text(encoding='utf-8')):
  code=codes.get(section['heading'])
  if not code:continue
  for row in section['rows']:
   if len(row)<2:continue
   by_name[norm(row[0])]=code;by_rf[row[1]]=code
 for c in clubs:
  code=by_name.get(norm(c['name'])) or (by_rf.get(c['key'].removeprefix('history:club:')) if c['key'].startswith('history:club:') else None)
  if c['key']=='history:club:tosse':code='1492'
  if c['key']=='4039':
   code='1780';c['locationNote']='Ulvsby i Karlstads kommun. Verifierad hemmaarena saknas i underlaget.'
  if code:c['municipality']=code
data=dict(version='journey-history-1',season=base['season'],halls=halls,clubs=clubs,municipalities=[dict(id=m['id'],name=m['name']) for m in municipalities],sources=[inventory['halls']['url'],inventory['clubs']['url'],'https://www.scb.se/vara-tjanster/oppna-data/oppna-geodata/regso/'])
(root/'data-catalogs/journey-history.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
mapdata=dict(width=660,height=round(50+(north-south)*scale),municipalities=municipalities,source='SCB RegSO 2025, sammanslaget per kommun',sourceUrl=data['sources'][-1])
(root/'journey-map-data.js').write_text('export const journeyMapData='+json.dumps(mapdata,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(json.dumps(dict(halls=len(halls),clubs=len(clubs),municipalities=len(municipalities),unmapped=[h['name'] for h in halls if h['scope']=='active' and not h.get('municipality')]),ensure_ascii=False))
