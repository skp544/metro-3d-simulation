// Immutable OSM context snapshots, separate from the rail dataset. Resume skips completed requests.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const stations = (await read('data/processed/metro_stations.geojson')).features;
const landmarks = (await read('data/processed/landmarks.geojson')).features;
const lines = await read('data/processed/metro_lines.geojson');
const coordinates = lines.features.flatMap(f => f.geometry.coordinates.flat(Infinity));
const pairs = []; for (let i=0;i<coordinates.length;i+=2) pairs.push([coordinates[i],coordinates[i+1]]);
const west=Math.min(...pairs.map(p=>p[0]))-.035, east=Math.max(...pairs.map(p=>p[0]))+.035;
const south=Math.min(...pairs.map(p=>p[1]))-.035, north=Math.max(...pairs.map(p=>p[1]))+.035;
const bbox=[south,west,north,east].join(',');
const day = new Date().toISOString().slice(0,10);
const dir=`data/raw/environment/${day}`; await mkdir(dir,{recursive:true});
const requests=[];
// Background land cover and Yamuna water polygons / multipolygons, over the network's actual bounds.
requests.push(['land-water', `(way["landuse"](${bbox});relation["landuse"]["type"="multipolygon"](${bbox});way["natural"~"^(water|wood|scrub|grassland|sand)$"](${bbox});relation["natural"~"^(water|wood|scrub|grassland|sand)$"]["type"="multipolygon"](${bbox});way["waterway"="riverbank"](${bbox});relation["waterway"="riverbank"](${bbox});way["leisure"~"^(park|garden|pitch|playground|golf_course)$"](${bbox}););out body geom;`]);
requests.push(['arterial-roads', `way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$"](${bbox});out body geom;`]);
// 650 m neighbourhoods overlap at typical station spacings, replacing the old isolated 300 m patches.
for(let i=0;i<stations.length;i+=36){
  const clauses=stations.slice(i,i+36).map(f=>{const [lng,lat]=f.geometry.coordinates; return `way["building"](around:650,${lat},${lng});way["highway"~"^(residential|unclassified|service|pedestrian|footway|path|living_street)$"](around:800,${lat},${lng});`;}).join('\n');
  requests.push([`neighbourhood-${String(i/36).padStart(2,'0')}`,`(${clauses});out body geom;`]);
}
for(const f of landmarks){
  const [lng,lat]=f.geometry.coordinates, dy=2300/111320, dx=dy/Math.cos(lat*Math.PI/180);
  const b=[lat-dy,lng-dx,lat+dy,lng+dx].join(',');
  requests.push([`landmark-${f.properties.id}`,`(way["building"](${b});way["highway"](${b}););out body geom;`]);
}
requests.sort((a,b)=>(a[0].startsWith('landmark')?0:a[0].startsWith('neighbourhood')?1:2)-(b[0].startsWith('landmark')?0:b[0].startsWith('neighbourhood')?1:2));
const endpoints=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
for(const [id,body] of requests.filter(([id])=>!process.argv[2]||id.includes(process.argv[2]))){
  const path=`${dir}/${id}.json`; try{await access(path);console.log(`Reuse ${id}`);continue;}catch{}
  const query=`[out:json][timeout:90][maxsize:268435456];${body}`;
  let result,endpoint;
  for(let attempt=0;attempt<4;attempt++){
    endpoint=endpoints[attempt%endpoints.length];
    try{
      console.log(`Fetching ${id} (${attempt+1})`);
      const response=await fetch(endpoint,{method:'POST',headers:{'User-Agent':'NCR-Rail-Environment/1.0','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(110000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      result=await response.json();if(result.remark)throw new Error(result.remark);
      break;
    }catch(e){console.log(`${id}: ${e.message}`);if(attempt===3)throw e;await new Promise(r=>setTimeout(r,5000*(attempt+1)));}
  }
  await writeFile(path,JSON.stringify({fetchedAt:new Date().toISOString(),endpoint,query,scope:id,...result}),{flag:'wx'});
  console.log(`Saved ${id}: ${result.elements.length} elements`);
}
console.log(`Environment capture complete: ${dir}`);
