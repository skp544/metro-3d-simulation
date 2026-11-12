import assert from "node:assert/strict";
import { test } from "node:test";
import { joinRings, osmArea } from "./environmentGeometry.ts";

test("OSM environment: reversed member ways close without invented edges; incomplete boundaries are rejected",()=>{
  const rings=joinRings([[[0,0],[10,0]],[[10,10],[10,0]],[[10,10],[0,10],[0,0]]]);
  assert.equal(rings.length,1);assert.deepEqual(rings[0][0],rings[0].at(-1));
  assert.throws(()=>joinRings([[[0,0],[10,0]],[[20,0],[20,10]]]),/Incomplete/);
});
test("OSM environment: disjoint river polygons and inner islands retain their topology",()=>{
  const geometry=osmArea({type:"relation",id:1,members:[
    {type:"way",ref:1,role:"outer",geometry:[[0,0],[10,0],[10,10],[0,10],[0,0]].map(([lon,lat])=>({lon,lat}))},
    {type:"way",ref:2,role:"outer",geometry:[[20,0],[30,0],[30,10],[20,10],[20,0]].map(([lon,lat])=>({lon,lat}))},
    {type:"way",ref:3,role:"inner",geometry:[[4,4],[6,4],[6,6],[4,6],[4,4]].map(([lon,lat])=>({lon,lat}))},
  ]});
  assert.equal(geometry?.type,"MultiPolygon");if(geometry?.type!=="MultiPolygon")assert.fail();
  assert.deepEqual(geometry.coordinates.map(p=>p.length).sort(),[1,2]);
});
