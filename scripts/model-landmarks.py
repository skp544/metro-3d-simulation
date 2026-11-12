"""Original low-poly architectural interpretations. Run in Blender (live MCP or --background).
Only the NCR_Landmarks collection is replaced; unrelated objects and the active file are preserved.
Exports metre-scale, Z-up Blender sources / Y-up GLBs with base origin and local X frontage.
"""
import bpy, math, json, os
from mathutils import Vector
from math import sin, cos, pi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models', 'landmarks')
os.makedirs(OUT, exist_ok=True)
data = json.load(open(os.path.join(ROOT, 'data', 'processed', 'landmarks.geojson'), encoding='utf8'))
old_selection = list(bpy.context.selected_objects)
old_active = bpy.context.view_layer.objects.active
old = bpy.data.collections.get('NCR_Landmarks')
if old:
    for obj in list(old.all_objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(old)
work = bpy.data.collections.new('NCR_Landmarks')
bpy.context.scene.collection.children.link(work)
current = None

def mat(name, color, metal=0):
    m = bpy.data.materials.get('NCR_'+name) or bpy.data.materials.new('NCR_'+name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = .83
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*color, 1)
    return m

stone = mat('Sandstone', (.65,.43,.25))
light = mat('LightStone', (.83,.67,.47))
red = mat('RedSandstone', (.55,.20,.13))
darkred = mat('CarvedBands', (.31,.10,.065))
marble = mat('Marble', (.94,.94,.89))
shadow = mat('Recess', (.17,.20,.20))
glass = mat('Skylight', (.29,.47,.53), .25)

def link(obj, material):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    current.objects.link(obj)
    obj.data.materials.append(material)
    return obj

def mesh(name, verts, faces, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    current.objects.link(ob)
    me.materials.append(material)
    return ob

def box(name, xyz, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz)
    ob = link(bpy.context.object, material)
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return ob

def cylinder(name, x,y,z, r, depth, material, vertices=48, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r, radius2=r if r2 is None else r2, depth=depth, location=(x,y,z+depth/2))
    ob=link(bpy.context.object, material); ob.name=name
    return ob

def ring(name, z, radius, height, material, x=0,y=0):
    return cylinder(name,x,y,z,radius,height,material,64)

def arch(name, width, spring, radius, top, depth, material, y=0):
    # Solid wall above a real semicircular opening (not a painted black patch).
    n=32; v=[]; faces=[]
    for i in range(n+1):
        a=pi-pi*i/n; x=radius*cos(a); z=spring+radius*sin(a)
        v.extend([(x,y-depth/2,z),(x,y-depth/2,top),(x,y+depth/2,z),(x,y+depth/2,top)])
    for i in range(n):
        a=i*4; b=a+4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    faces.extend([(0,1,3,2),(n*4,n*4+2,n*4+3,n*4+1)])
    mesh(name,v,faces,material)
    for side in [-1,1]:
        box(name+' pier',(side*(width/2+radius)/2,y,top/2),((width/2-radius),depth,top),material)

def arch_trim(radius, spring, y, depth, material, thickness=.6):
    for i in range(24):
        a=i*pi/24; b=(i+1)*pi/24
        verts=[(r*cos(t),yy,spring+r*sin(t)) for yy in [y-depth/2,y+depth/2] for r,t in [(radius,a),(radius,b),(radius+thickness,b),(radius+thickness,a)]]
        mesh('Radial arch stones',verts,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(3,2,6,7)],material)

def india_gate():
    box('Stepped plinth',(0,0,.3),(28,18,.6),stone)
    box('Upper plinth',(0,0,.75),(27,17,.3),light)
    arch('Main vaulted arch',26,18,5.7,32,14,stone)
    for y in [-7.2,7.2]:
        arch_trim(5.7,18,y,.5,light,.75)
        for side in [-1,1]:
            for x in [7.1,11.8]:
                box('Engaged pilaster',(side*x,y,15),(1.0,.7,27.8),light)
                box('Pilaster base',(side*x,y,2),(1.5,1.0,2),stone)
                box('Pilaster capital',(side*x,y,29),(1.6,1.0,1.2),light)
            for z in [6,10,14,18,22,26]:
                box('Stone courses',(side*9.4,y+.04,z),(3.0,.12,.10),stone)
    for z,w,d,h in [(31.9,27,15,.7),(32.6,28,16,.6),(33.2,27.4,15.5,.6),(34,24,14,1),(37.1,24,14,5.2),(40,26,15,.65),(40.6,24.8,14.5,.5)]:
        box('Entablature and attic',(0,0,z),(w,d,h),light if z<34 or z>39 else stone)
    # Recessed inscription panels; letter forms are original geometry, not a photograph texture.
    for y,rot in [(-7.04,pi/2),(7.04,-pi/2)]:
        curve=bpy.data.curves.new('INDIA inscription','FONT'); curve.body='INDIA'; curve.align_x='CENTER'; curve.size=1.35; curve.extrude=.018
        ob=bpy.data.objects.new('INDIA inscription',curve); current.objects.link(ob); ob.location=(0,y,36.9); ob.rotation_euler=(rot,0,0); curve.materials.append(darkred)
        bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    ring('Crown bowl base',41,1.5,.35,stone)
    cylinder('Crown bowl',0,0,41.35,1.5,.65,light,r2=2.1)

def qutb():
    ring('Base plinth',0,7.16,.7,red)
    heights=[.7,29,45,57,65,72.5]; radii=[7.16,5.25,3.95,3.05,2.15,1.375]
    for level in range(5):
        z0,z1=heights[level:level+2]; r0,r1=radii[level:level+2]
        v=[]; n=192
        for z,r in [(z0,r0),(z1,r1)]:
            for i in range(n):
                a=2*pi*i/n; flute=(.19 if level<3 else .06)*cos(24*a)
                v.append(((r+flute)*cos(a),(r+flute)*sin(a),z))
        faces=[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        faces.extend([tuple(range(n-1,-1,-1)),tuple(range(n,2*n))])
        mesh('Fluted storey '+str(level+1),v,faces,marble if level==3 else red)
        for z in [z0+1.5,z0+2.1,(z0+z1)/2]:
            r=r0+(r1-r0)*(z-z0)/(z1-z0)
            ring('Carved calligraphy band (simplified)',z,r+.20,.36,darkred if level<3 else light)
        if level<4:
            for i in range(24):
                a=2*pi*i/24
                ob=box('Balcony stone bracket',((r1+.3)*cos(a),(r1+.3)*sin(a),z1-1.0),(.5,1.2,1.0),light)
                ob.rotation_euler.z=a-pi/2
            ring('Balcony corbel',z1-.6,r1+.65,.35,light)
            ring('Balcony projecting lip',z1-.25,r1+1,.35,light)
            # Open parapet: balusters rather than a solid tube.
            for i in range(48):
                a=2*pi*i/48
                cylinder('Balcony baluster',(r1+.8)*cos(a),(r1+.8)*sin(a),z1+.1,.09,.8,light,6)
            ring('Balcony rail',z1+.9,r1+.95,.16,light)

def petal(angle, r0, r1, z1, bulge, width, material):
    # Pointed double-curved shell, split into small quads for a readable faceted marble surface.
    v=[]; nu=16; nv=10
    for i in range(nu+1):
        t=i/nu; r=r0*(1-t)+r1*t+bulge*sin(pi*t)
        w=width*(sin(pi*t)**.72)
        for j in range(nv+1):
            s=2*j/nv-1; aa=angle+s*w/max(r,1)
            z=1.2+(z1-1.2)*t+3*sin(pi*t)*(1-s*s)
            v.append((r*cos(aa),r*sin(aa),z))
    faces=[]
    for i in range(nu):
        for j in range(nv):
            a=i*(nv+1)+j; faces.append((a,a+1,a+nv+2,a+nv+1))
    ob=mesh('Marble petal shell',v,faces,material)
    solid=ob.modifiers.new('Shell thickness','SOLIDIFY'); solid.thickness=.28
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.modifier_apply(modifier=solid.name); ob.select_set(False)

def lotus():
    ring('Nine-sided terrace',0,34,.8,light)
    cylinder('Hall shadow',0,0,.8,15,9,shadow,72)
    for i in range(9):
        a=2*pi*i/9
        petal(a,19,4,34,8,5.8,marble)
        petal(a+pi/9,26,20,26,5,9.8,marble)
        petal(a,25,34,11,1,9.0,marble)
    ring('Central skylight',31.5,4,1.0,glass)

def dome(x,y,z,r):
    # Low Mughal dome, lathed over an octagonal pavilion.
    v=[]; rows=8; n=32
    for j in range(rows+1):
        t=j/rows*pi/2; rr=r*cos(t)
        for i in range(n):
            a=2*pi*i/n; v.append((x+rr*cos(a),y+rr*sin(a),z+r*.7*sin(t)))
    mesh('Chhatri dome',v,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rows) for i in range(n)],marble)
    cylinder('Dome finial',x,y,z+r*.7,.16,1.3,light,12,r2=0)

def red_fort():
    box('Gate plinth',(0,0,.3),(49,21,.6),red)
    arch('Gate central vaulted passage',31,10,4.5,23,17,red)
    for y in [-8.6,8.6]:
        arch_trim(4.5,10,y,.5,light,.5)
        box('Gate upper cornice',(0,y,23),(34,1.4,.7),light)
        for x in [-10,0,10]:
            box('Upper inset panel',(x,y,20),(4,.2,2),darkred)
    for x in [-17,17]:
        cylinder('Octagonal gate bastion',x,0,.6,7.3,23,red,8)
        cylinder('Bastion cornice',x,0,23.5,7.8,.65,light,8)
        for i in range(8):
            a=2*pi*i/8
            cylinder('Chhatri slender column',x+4*cos(a),4*sin(a),24.2,.28,4.3,light,8)
        cylinder('Chhatri eaves',x,0,28.5,5.8,.5,marble,8)
        dome(x,0,29,4)
        for y in [-5.3,5.3]:
            for z in [7,13,19]: box('Bastion recessed slit',(x,y,z),(.5,.3,1.8),darkred)
    for x in range(-14,15,2):
        for y in [-8,8]:
            box('Crenellation',(x,y,24.2),(1.2,1.4,1.8),red)
            cylinder('Merlon pointed cap',x,y,25.1,.7,.8,red,4,r2=0)
    for x in [-10,-5,0,5,10]:
        cylinder('Upper arcade pillar',x,0,24,.18,3,light,8)
    box('Upper arcade canopy',(0,0,27),(22,4,.5),marble)
    for x in [-9,-6,-3,0,3,6,9]:
        cylinder('Roof small cupola base',x,0,27.3,.7,1,marble,12)
        dome(x,0,28.3,.8)
    cylinder('Flag mast',0,-4,26,.1,6.4,light,12)
    for i,m in enumerate([mat('FlagSaffron',(1,.40,.08)),marble,mat('FlagGreen',(.06,.36,.15))]):
        box('Flag stripe',(1,-4,31.9-i*.4),(2,.05,.4),m)

# Proportions below are nominal architectural/sculptural interpretations of cited photographs.
# Geographic location, overall footprint extents and sourced total heights come from the dataset.
def sphere(name, xyz, size, material, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=xyz)
    ob=link(bpy.context.object, material); ob.name=name; ob.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in ob.data.polygons: p.use_smooth=True
    return ob

def limb(name, a, b, radius, material, r2=None):
    a,b=Vector(a),Vector(b); direction=b-a
    ob=cylinder(name,0,0,0,radius,direction.length,material,20,r2)
    ob.location=(a+b)/2; ob.rotation_euler=direction.to_track_quat('Z','Y').to_euler()
    return ob

def tube(name, points, radius, material):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.bevel_depth=radius; cu.bevel_resolution=2; cu.resolution_u=12
    spline=cu.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for p,co in zip(spline.bezier_points,points): p.co=co; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu); current.objects.link(ob); cu.materials.append(material)
    bpy.context.view_layer.objects.active=ob; ob.select_set(True); bpy.ops.object.convert(target='MESH'); ob.select_set(False)
    return ob

def stupa(name,x,y,z,r,height,material):
    n=64; rows=16; verts=[]
    for j in range(rows+1):
        t=j/rows*pi/2
        for i in range(n):
            a=i*2*pi/n; verts.append((x+r*cos(t)*cos(a),y+r*cos(t)*sin(a),z+height*sin(t)))
    ob=mesh(name,verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(rows) for i in range(n)],material)
    for p in ob.data.polygons:p.use_smooth=True

def balustrade(name,x,y,z,width):
    box(name+' coping',(x,y,z+1.1),(width,.5,.28),light)
    for i in range(int(width/1.7)+1):
        box(name+' baluster',(x-width/2+i*1.7,y,z+.5),(.20,.35,1),light)

def palace_windows(x,y,z,width,count,material=shadow):
    for i in range(count):
        xx=x-width/2+(i+.5)*width/count
        box('Deep window recess',(xx,y,z),(1.55,.2,2.7),material)
        box('Window lintel',(xx,y-.15,z+1.55),(2.1,.5,.3),light)
        box('Window mullion',(xx,y-.15,z),(.13,.25,2.7),light)

def rashtrapati():
    # Four surrounding wings leave genuine open courtyards around the central block.
    box('Palace base',(0,0,.8),(198,170,1.6),red)
    for x in [-75,75]:
        box('Courtyard longitudinal wing',(x,0,11),(42,164,20),stone)
        for y in [-82,82]:
            box('Red sandstone foundation',(x,y,3.7),(42,.6,4),red)
            box('Projecting chhajja',(x,y,20),(45,2,1),light)
            for z in [7,14]:palace_windows(x,y-.4,z,37,10)
    for y in [-64,64]:
        # Leave the centre of the east-facing facade open for the recessed ceremonial portico.
        spans=[(-65,64),(65,64)] if y<0 else [(0,194)]
        for x,width in spans:
            box('Cross wing',(x,y,11),(width,36,20),stone)
            box('Cross wing cornice',(x,y,21.3),(width+2,38,1.5),light)
            for z in [7,14]:palace_windows(x,y-18.3,z,width-6,max(1,int(width/5.5)))
    box('Central ceremonial block',(0,0,13),(56,78,24),stone)
    box('Central red lower course',(0,-39.1,5),(56,.5,6),red)
    # Long colonnaded entrance, with clear gaps between columns.
    for x in range(-24,25,4):
        cylinder('Delhi order portico column',x,-49,3.5,.65,18,light,16)
        box('Column capital',(x,-49,21.6),(1.8,1.8,.7),light)
    box('Portico entablature',(0,-49,23),(60,13,2.2),light)
    box('Portico shadow ceiling',(0,-44,21.8),(55,15,.35),shadow)
    for i in range(10):box('Broad ceremonial step',(0,-61-i*.9,3.2-i*.28),(61+i*.35,1.15,.5),light)
    for z,r,h in [(25,19,1.5),(26.5,16,9),(35.5,19,1.1),(36.6,17.8,.8)]:
        cylinder('Central dome drum',0,0,z,r,h,stone if z<35 else light,64)
    # Sanchi-inspired railing surrounding the copper dome.
    for i in range(48):
        a=2*pi*i/48;cylinder('Dome railing post',18*cos(a),18*sin(a),36.9,.17,2.2,light,8)
    cylinder('Dome railing cornice',0,0,39,18.3,.28,light,64)
    copper=mat('DomeCopper',(.38,.29,.20),.3)
    stupa('Copper central stupa dome',0,0,37,16,13.5,copper)
    cylinder('Dome crown',0,0,50.5,1.9,1,light,24)
    cylinder('Flagpole',0,0,51.5,.10,3.5,light,12)
    for i,m in enumerate([mat('FlagSaffron',(1,.40,.08)),marble,mat('FlagGreen',(.06,.36,.15))]):box('Indian flag stripe',(1.2,0,54.5-i*.34),(2.4,.06,.34),m)
    for x in [-37,37]:
        for y in [-32,32]:
            cylinder('Chhatri podium',x,y,24,5.6,.8,light,16)
            for i in range(8):
                a=i*pi/4;cylinder('Chhatri column',x+3.7*cos(a),y+3.7*sin(a),24.8,.22,4.1,light,8)
            cylinder('Chhatri eaves',x,y,28.9,5.8,.5,light,32)
            stupa('Palace chhatri',x,y,29.4,4.8,3.4,stone)
            cylinder('Chhatri finial',x,y,32.8,.18,1.1,light,8,r2=0)
    for x in [-75,75]:
        for y in [-82,82]:balustrade('Wing parapet',x,y,22,40)

def supreme_court():
    courtred=mat('CourtSandstone',(.59,.31,.22)); cream=mat('CourtCream',(.86,.79,.66))
    # Broad original central beam and low symmetrical wings, rather than the modern annexe.
    box('Original central wing',(0,12,7),(232,22,14),cream)
    for x in [-102,102]:
        box('Side wing',(x,26,6.7),(28,125,13.4),cream)
        box('Side wing red plinth',(x,26,2),(29,126,4),courtred)
        box('Side wing cornice',(x,26,13.6),(30,128,.6),courtred)
        for y in range(-30,83,8):
            for z in [6.5,10.5]:box('Wing recessed window',(x-14.1,y,z),(.2,2.8,2.2),shadow)
    box('Centre court block',(0,0,8),(47,45,16),cream)
    for side in [-1,1]:
        for x in range(30,101,5):
            xx=side*x;cylinder('Colonnaded verandah',xx,-4,2,.42,10.3,cream,12)
            box('Verandah capitals',(xx,-4,12.3),(1.2,1.3,.5),cream)
            for z in [5,9]:box('Courthouse recessed window',(xx,1,z),(2,.2,2.5),shadow)
        box('Long red verandah fascia',(side*65,-4,13.6),(82,7,1.2),courtred)
    box('Main portico roof',(0,-25,15),(49,13,2),courtred)
    for x in [-20,-12,-4,4,12,20]:
        cylinder('Main entrance pillar',x,-25,2,.65,12,cream,16)
    for i in range(8):box('Entrance stair',(0,-33-i*1.2,2-i*.22),(48+i*.5,1.3,.35),cream)
    cylinder('Dome drum',0,0,12,14,3.8,cream,64)
    cylinder('Red dome rim',0,0,15.8,14.7,.5,courtred,64)
    stupa('Supreme Court cream dome',0,0,16.3,13.5,10.2,cream)
    cylinder('Dome finial',0,0,26.5,.35,1.1,cream,16,r2=0)
    for x in [-22,22]:
        cylinder('Small roof pavilion',x,0,16,3,3,cream,16)
        stupa('Small roof cupola',x,0,19,3.3,2.3,cream)
    # Original geometric inscription, not a distributed photograph.
    cu=bpy.data.curves.new('Court inscription','FONT');cu.body='SUPREME COURT OF INDIA';cu.align_x='CENTER';cu.size=1.6;cu.extrude=.012
    ob=bpy.data.objects.new('Court inscription',cu);current.objects.link(ob);ob.location=(0,-31.55,14.5);ob.rotation_euler=(pi/2,0,0);cu.materials.append(cream)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.select_set(False)

def hanuman():
    orange=mat('HanumanVermilion',(.86,.23,.065)); face=mat('HanumanFace',(.94,.40,.16)); gold=mat('HanumanGold',(.87,.60,.16),.3); cloth=mat('HanumanDhoti',(.65,.045,.025)); black=mat('HanumanEyes',(.045,.028,.015)); white=mat('HanumanTilak',(.96,.91,.75))
    box('Shrine pedestal',(0,0,.65),(9,7,1.3),red)
    box('Pedestal cornice',(0,0,1.5),(9.5,7.5,.4),gold)
    # Feet and strongly planted legs; a simplified sculptural pose.
    for s in [-1,1]:
        sphere('Foot',(s*1.65,-.75,2.1),(1.3,2.2,.75),orange)
        limb('Shin',(s*1.6,0,2.4),(s*1.8,.15,8.3),1.15,orange,1.45)
        sphere('Knee',(s*1.8,0,8.3),(1.45,1.35,1.5),orange)
        limb('Thigh',(s*1.8,.15,8.3),(s*1.2,.3,13.4),1.5,orange,1.8)
        cylinder('Gold anklet',s*1.6,0,2.8,1.26,.45,gold,24)
    sphere('Dhoti hips',(0,.2,13.1),(3.6,2.1,3.4),cloth)
    for i in range(-3,4):
        ob=box('Dhoti pleat',(i*.74,-1.9,11.4),(.38,.28,5.1-abs(i)*.3),gold if abs(i)==3 else orange);ob.rotation_euler.y=i*.06
    sphere('Torso',(0,.15,18.3),(4,2.15,5.2),orange,32,20)
    sphere('Waist sash',(0,.05,14.2),(3.8,2.35,.65),gold)
    for s in [-1,1]:
        sphere('Shoulder',(s*3.3,.1,21.1),(1.7,1.7,1.9),orange)
        limb('Upper arm',(s*3.5,.1,21),(s*5,-.8,17.8),1.25,orange,1.05)
        sphere('Elbow',(s*5,-.8,17.8),(1.12,1.12,1.12),orange)
        limb('Forearm at chest',(s*5,-.8,17.8),(s*1.4,-2.6,20.2),1,orange,.8)
        sphere('Hand at heart',(s*1.4,-2.6,20.2),(.9,.65,1.2),face)
        for i in range(4):limb('Chest holding fingers',(s*(.8+i*.31),-3.1,19.8),(s*(.75+i*.31),-3.12,20.7),.13,face)
        sphere('Wrist ornament',(s*2.1,-2.3,19.8),(.95,.85,.55),gold)
        sphere('Upper arm ornament',(s*3.85,-.2,20.1),(1.36,1.35,.5),gold)
    # Necklace and chest panel evoke the familiar heart-revealing gesture, kept closed and static.
    tube('Gold necklace',[(-2.8,-1.65,22),(-2,-2.3,18.6),(0,-2.55,17.3),(2,-2.3,18.6),(2.8,-1.65,22)],.20,gold)
    sphere('Chest pendant',(0,-2.65,18),(.55,.15,.72),gold)
    cylinder('Neck',0,.1,22,1.3,2.1,orange,24)
    sphere('Head',(0,0,25.7),(2.3,1.9,2.7),orange,32,20)
    for s in [-1,1]:
        sphere('Ear',(s*2.3,-.05,25.5),(.65,.5,1.1),orange)
        sphere('Gold earring',(s*2.5,-.3,24.6),(.34,.22,.55),gold)
        sphere('Eye white',(s*.86,-1.72,26.25),(.55,.19,.32),white)
        sphere('Eye pupil',(s*.80,-1.9,26.25),(.19,.09,.22),black)
        limb('Dark brow',(s*.35,-1.86,26.75),(s*1.38,-1.67,26.8),.14,black)
    sphere('Monkey muzzle',(0,-1.66,24.7),(1.55,.85,.9),face)
    sphere('Nose',(0,-2,25.45),(.65,.54,.42),orange)
    tube('Mouth',[(-.85,-2.27,24.5),(0,-2.48,24.32),(.85,-2.27,24.5)],.075,black)
    for x in [-.28,.28]:box('Vertical forehead tilak',(x,-1.9,27.1),(.16,.1,.9),white)
    box('Tilak centre',(0,-1.97,26.95),(.12,.1,.45),cloth)
    cylinder('Crown base',0,0,27.7,2.45,.7,gold,40)
    cylinder('Crown taper',0,0,28.4,2.3,2.8,gold,40,r2=.65)
    for i in range(12):
        a=i*2*pi/12;cylinder('Crown fluted peak',1.8*cos(a),1.8*sin(a),28.8,.2,1.9,light,8,r2=.07)
    sphere('Crown jewel',(0,-2.35,28.2),(.45,.18,.6),cloth)
    sphere('Crown finial',(0,0,31.4),(.55,.55,.7),gold)
    # Gada and curved tail are part of the sculptural silhouette, not invented map features.
    cylinder('Gada shaft',-6,1.1,2.0,.34,20,gold,20)
    sphere('Gada head',(-6,1.1,23.8),(2.3,2.3,3),gold,24,16)
    for z in [22.2,23.7,25.2]:cylinder('Gada carved band',-6,1.1,z,2.36,.2,light,32)
    cylinder('Gada tip',-6,1.1,26.6,.5,1.1,gold,16,r2=.1)
    tube('Upcurled tail',[(1.5,1.8,13),(4.6,2.4,11.5),(6.1,2.9,14),(6.4,3.0,20),(5.4,3,24),(4.3,3,23.4)],.5,orange)

# Additional originals: sourced retail silhouettes and nominal architectural details.
# Planar mall/site meshes use modelFootprints, already projected by projection.ts.
def signed_area(points):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))/2

def footprint_solid(name, parts, height, material):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='2D';curve.fill_mode='BOTH';curve.resolution_u=1;curve.extrude=height/2
    for part in parts:
        for is_hole,source in [(False,part['outer'])]+[(True,h) for h in part['holes']]:
            points=[tuple(p) for p in source[:-1]]
            if (signed_area(points)>0)==is_hole:points.reverse()
            spline=curve.splines.new('POLY');spline.points.add(len(points)-1)
            for v,(x,y) in zip(spline.points,points):v.co=(x,y,0,1)
            spline.use_cyclic_u=True
    ob=bpy.data.objects.new(name,curve);current.objects.link(ob);ob.location.z=height/2;curve.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');ob.select_set(False)
    return ob

def perimeter(name,points,z,height,width,material):
    for a,b in zip(points,points[1:]):
        length=math.hypot(b[0]-a[0],b[1]-a[1])
        if length<.03:continue
        ob=box(name,((a[0]+b[0])/2,(a[1]+b[1])/2,z+height/2),(length,width,height),material)
        ob.rotation_euler.z=math.atan2(b[1]-a[1],b[0]-a[0])

def site_outline(p):
    material=mat('ZooSiteHighlight',(.22,.51,.28)) if p['category']=='zoo' else mat('RetailSiteHighlight',(.48,.30,.66))
    for part in p['modelFootprints']:
        # Open contour, not an invented wall, building or habitat plan.
        perimeter('Mapped site outline (nominal highlight)',part['outer'],0,p['heightM'],2.0,material)

def mall(p):
    colors={'select-citywalk':(.78,.68,.52),'dlf-avenue':(.67,.56,.45),'dlf-promenade':(.79,.73,.64),'dlf-emporio':(.89,.84,.73),'ambience-vasant-kunj':(.65,.65,.60),'pacific-nsp':(.72,.68,.59)}
    facade=mat('Retail_'+p['id'],colors[p['id']]);roof=mat('RetailRoof',(.42,.44,.45));glazing=mat('RetailGlazing',(.20,.36,.42),.25)
    height=p['heightM'];footprint_solid('Source mall silhouette',p['modelFootprints'],height-.6,facade)
    for part in p['modelFootprints']:
        for points in [part['outer']]+part['holes']:
            perimeter('Roof cornice',points,height-.6,.6,.45,light)
            for floor in range(4):
                z=2.8+floor*(height-4)/4
                perimeter('Nominal continuous glazing band',points,z,2.2,.16,glazing)
                perimeter('Nominal floor fascia',points,z+2.2,.3,.3,marble)
            for a,b in zip(points,points[1:]):
                length=math.hypot(b[0]-a[0],b[1]-a[1]);count=int(length/7)
                for i in range(1,count+1):
                    t=i/(count+1);box('Nominal facade mullion',(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,height*.48),(.28,.28,height*.88),light)
    # Text is original mesh lettering, not a downloaded logo or texture.
    part=max(p['modelFootprints'],key=lambda q:abs(signed_area([tuple(a) for a in q['outer']])))
    a,b=max(zip(part['outer'],part['outer'][1:]),key=lambda ab:math.dist(ab[0],ab[1]))
    angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=math.dist(a,b)
    curve=bpy.data.curves.new('Original retail name lettering','FONT');curve.body=p['name'].split(' · ')[0].replace('Nexus ','').upper();curve.align_x='CENTER';curve.size=min(3.5,length/max(10,len(curve.body)*.7));curve.extrude=.035
    ob=bpy.data.objects.new('Retail sign (nominal placement)',curve);current.objects.link(ob);curve.materials.append(marble)
    ob.location=((a[0]+b[0])/2+sin(angle)*.35,(a[1]+b[1])/2-cos(angle)*.35,height-3.1);ob.rotation_euler=(pi/2,0,angle)
    bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.convert(target='MESH');ob.select_set(False)

def onion_dome(x,y,z,r,height,material):
    profile=[(0,1),(.12,1.10),(.34,1.15),(.56,1.02),(.76,.72),(.90,.36),(1,.035)]
    verts=[];n=48
    for h,radius in profile:
        for i in range(n):
            a=2*pi*i/n;verts.append((x+r*radius*cos(a),y+r*radius*sin(a),z+height*h))
    mesh('Onion dome',verts,[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)],material)
    cylinder('Dome finial',x,y,z+height,.12,height*.13,light,12,r2=.01)

def arched_panel(name,x,y,z,width,height,material,sidewall=False):
    profile=[(-width/2,-height/2),(width/2,-height/2)]
    profile += [(width/2*cos(pi*i/16),height/2-width/2+width/2*sin(pi*i/16)) for i in range(17)]
    vertices=[(x,y+u,z+v) if sidewall else (x+u,y,z+v) for u,v in profile]
    mesh(name,vertices,[tuple(range(len(vertices)))],material)

def tomb(safdarjung=False):
    box('Mapped plinth',(0,0,1.5),(100,100,3),red)
    box('Plinth cornice',(0,0,3.2),(98,98,.4),light)
    size=70 if safdarjung else 62
    box('Mausoleum central chamber',(0,0,13),(size,size,20),red)
    box('Mausoleum stone cornice',(0,0,23.3),(size+3,size+3,.7),light)
    for side in [-1,1]:
        for a in [-.34,-.17,0,.17,.34]:
            for z in [9,18]:
                x=a*size
                arched_panel('Pale arch surround',x,side*(size/2+.12),z,6,6.5,light)
                arched_panel('Recessed arched opening',x,side*(size/2+.36),z,4.4,5.4,shadow)
                arched_panel('Side arch surround',side*(size/2+.12),x,z,6,6.5,light,True)
                arched_panel('Side arched opening',side*(size/2+.36),x,z,4.4,5.4,shadow,True)
    cylinder('Dome drum',0,0,24,15,4,marble if safdarjung else red,48)
    onion_dome(0,0,28,16,18,light if safdarjung else marble)
    for x in [-size*.43,size*.43]:
        for y in [-size*.43,size*.43]:
            cylinder('Corner pavilion drum',x,y,23.5,4.5,3,red,8)
            for i in range(8):
                a=i*pi/4;cylinder('Chhatri column',x+3.6*cos(a),y+3.6*sin(a),26.5,.22,4,light,8)
            cylinder('Chhatri projecting eave',x,y,30.5,5.2,.4,light,16)
            dome(x,y,31,4.6)
    for a in range(-40,41,8):
        for side in [-1,1]:box('Plinth arcade recess',(a,side*50.05,1.6),(4,.12,1.8),shadow)

def purana_gate():
    rubble=mat('PuranaRubble',(.45,.34,.25))
    arch('Bara Darwaza vaulted entrance',32,9,4.4,18,16,rubble)
    for x in [-19,19]:
        cylinder('Gate octagonal bastion',x,0,0,6.9,18,rubble,8)
        for z in [5,11,16]:cylinder('Bastion stone band',x,0,z,7,.35,red,8)
        cylinder('Bastion parapet',x,0,18,7.25,1,red,8)
        for i in range(8):
            a=i*pi/4;box('Merlon',(x+6.7*cos(a),6.7*sin(a),19.6),(1.4,1.4,1.2),red)
    for y in [-8.05,8.05]:
        arch_trim(4.4,9,y,.35,red,.8)
        for x in [-10,10]:
            box('Stone inset arch panel',(x,y,13),(3.5,.3,5),shadow)
        box('Gate upper cornice',(0,y,18.4),(33,.8,.7),light)
    for x in range(-14,15,3):box('Gate battlement',(x,0,19.2),(1.4,16,1.4),red)

def in_ring(p,ring):
    hit=False;x,y=p
    for a,b in zip(ring,ring[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:hit=not hit
    return hit

def mosque(p):
    # Exact source ring/courtyard. Ornament stands on the west prayer-hall band.
    parts=p['modelFootprints'];footprint_solid('Mapped mosque and open courtyard',parts,10,red)
    yaw=p['yaw'];east=(cos(yaw),-sin(yaw));north=(sin(yaw),cos(yaw))
    all_points=[q for part in parts for q in part['outer']]
    es=[q[0]*east[0]+q[1]*east[1] for q in all_points];ns=[q[0]*north[0]+q[1]*north[1] for q in all_points]
    def at(frac,western_corner=False):
        n=min(ns)+(max(ns)-min(ns))*frac
        candidates=[]
        for i in range(80):
            e=min(es)+(max(es)-min(es))*(i+.5)/80;q=(e*east[0]+n*north[0],e*east[1]+n*north[1])
            if any(in_ring(q,part['outer']) and not any(in_ring(q,h) for h in part['holes']) for part in parts):candidates.append(q)
            elif candidates:break
        return candidates[min(1,len(candidates)-1) if western_corner else len(candidates)//2] if candidates else all_points[0]
    for fraction,r in [(.28,7),(.5,9),(.72,7)]:
        x,y=at(fraction);cylinder('Prayer hall dome drum',x,y,10,r,3,marble,40);onion_dome(x,y,13,r,10,marble)
    for fraction in [.08,.92]:
        x,y=at(fraction,True);cylinder('Minaret shaft',x,y,0,2.3,34,red,24,r2=1.4)
        for z in [12,24,32]:cylinder('Minaret balcony',x,y,z,2.7,.5,marble,24)
        for i in range(8):
            a=i*pi/4;cylinder('Minaret pavilion column',x+1.5*cos(a),y+1.5*sin(a),34,.13,3,light,8)
        onion_dome(x,y,37,1.8,2.6,marble)
    for part in parts:
        perimeter('Courtyard stone cornice',part['outer'],9.6,.4,.25,light)
        for hole in part['holes']:perimeter('Open courtyard cornice',hole,9.6,.4,.25,light)

def akshardham():
    pink=mat('AkshardhamPinkStone',(.78,.58,.43))
    for z,w,d in [(1,106,96),(3,100,90),(5,94,84)]:box('Stepped mandir plinth',(0,0,z),(w,d,2),pink)
    box('Mandir carved base',(0,0,10),(86,76,8),pink)
    for x in [-30,0,30]:
        for y in [-24,0,24]:
            central=x==0 and y==0;r=12 if central else 8.4;z=23 if central else 18
            cylinder('Mandapa polygonal drum',x,y,14,r*1.15,z-14,pink,16)
            for i in range(12):
                a=2*pi*i/12;cylinder('Mandapa column',x+(r+1)*cos(a),y+(r+1)*sin(a),10,.55,8,light,12)
            for level in range(5):
                t=level/5;cylinder('Tiered dome stone course',x,y,z+level*2,r*(1-t*.7),2.1,pink,48,r2=r*(1-(t+.2)*.7))
            onion_dome(x,y,z+9,r*.35,4 if central else 2.5,light)
    for x in range(-39,40,6):
        for side in [-1,1]:
            cylinder('Exterior carved column',x,side*35,6,.6,8,light,12)
            box('Carved wall niche',(x,side*38.2,10),(2.6,.25,4),shadow)
    for x in [-39,39]:
        for y in range(-30,31,6):cylinder('Side colonnade',x,y,6,.6,8,light,12)

def samrat():
    brick=mat('ObservatoryOchre',(.70,.28,.16))
    verts=[(x,y,z) for x in [-1.3,1.3] for y,z in [(-11,0),(11,16),(11,0)]]
    mesh('Triangular Samrat gnomon',verts,[(0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(0,2,5,3)],brick)
    for i in range(32):
        t=i/32;box('Nominal stair tread',(0,-11+22*t,16*t+.2),(2.8,.7,.4),light)
    for side in [-1,1]:
        points=[]
        for i in range(49):
            a=-pi/2+pi*i/48;points.append((side*(2+7*cos(a)),7*sin(a)))
        perimeter('Quadrant retaining arc',points,0,5,.8,brick)
        perimeter('Quadrant pale scale',points,5,.3,.9,light)
    for x in [-7,7]:box('Quadrant plinth',(x,0,.15),(11,20,.3),brick)

def raj_ghat():
    black=mat('MemorialBlackStone',(.045,.05,.045));gold=mat('MemorialFlame',(.97,.47,.08))
    box('Memorial base',(0,0,.1),(10,10,.2),light)
    box('Black stone memorial',(0,0,.6),(8,8,.8),black)
    box('Slab upper lip',(0,0,1.05),(8.2,8.2,.1),black)
    cylinder('Flame holder',0,3.2,1.1,.28,.12,stone,24)
    sphere('Simplified eternal flame',(0,3.2,1.4),(.17,.17,.3),gold,16,8)

def baoli():
    masonry=mat('BaoliMasonry',(.51,.43,.31))
    box('Cutaway illustration base',(0,0,.15),(73,14,.3),masonry)
    for side in [-1,1]:
        box('Open well side wall',(0,side*6.6,4),(73,.8,8),masonry)
        for z in [2,4.5,7]:
            for x in [-27,-17,-7,3,13,23]:
                box('Recessed arcade opening',(x,side*6.13,z),(5,.12,1.7),shadow)
                box('Arcade stone lintel',(x,side*6.0,z+.9),(5.8,.3,.25),light)
                for dx in [-2.9,2.9]:box('Arcade pier',(x+dx,side*6.0,z),(.5,.5,2),masonry)
    for i in range(44):
        x=-35+i*1.25;h=7.5*(1-i/44)+.35
        box('Nominal descending stone step',(x,0,h/2),(1.25,11.5,h),masonry)
        box('Step worn nosing',(x+.55,0,h),( .15,11.5,.08),light)
    box('Well end wall',(35.8,0,4),(.9,14,8),masonry)

def new_place(p):
    if p['geometryRole']=='site':site_outline(p)
    elif p['category']=='mall':mall(p)
    elif p['id']=='humayuns-tomb':tomb()
    elif p['id']=='safdarjung-tomb':tomb(True)
    elif p['id']=='purana-qila':purana_gate()
    elif p['id']=='jama-masjid':mosque(p)
    elif p['id']=='akshardham':akshardham()
    elif p['id']=='jantar-mantar':samrat()
    elif p['id']=='raj-ghat':raj_ghat()
    elif p['id']=='agrasen-ki-baoli':baoli()
    else:raise ValueError('Missing place model: '+p['id'])

builders={'india-gate':india_gate,'lotus-temple':lotus,'qutb-minar':qutb,'red-fort':red_fort,'rashtrapati-bhavan':rashtrapati,'supreme-court':supreme_court,'hanuman-jhandewalan':hanuman}
report=[]
workshop_x=0
for f in data['features']:
    p=f['properties']; current=bpy.data.collections.new('NCR_'+p['id']); work.children.link(current)
    bpy.ops.object.select_all(action='DESELECT')
    if p['id'] in builders:builders[p['id']]()
    else:new_place(p)
    objs=list(current.objects)
    corners=[o.matrix_world @ Vector(v) for o in objs for v in o.bound_box]
    # Refresh matrices after construction before measuring / exporting.
    bpy.context.view_layer.update()
    corners=[o.matrix_world @ Vector(v) for o in objs for v in o.bound_box]
    mn=Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    mx=Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    target=(p['widthM'],p['depthM'],p['heightM']) if p['id']!='qutb-minar' else (14.32,14.32,72.5)
    geographic=p['id'] not in builders and (p['category']=='mall' or p['geometryRole']=='site' or p['id']=='jama-masjid')
    scale=Vector((1,1,target[2]/(mx.z-mn.z))) if geographic else Vector(tuple(target[i]/(mx[i]-mn[i]) for i in range(3)))
    centre=Vector((0,0,mn.z)) if geographic else Vector(((mx.x+mn.x)/2,(mx.y+mn.y)/2,mn.z))
    for ob in objs:
        for v in ob.data.vertices:
            world=ob.matrix_world @ v.co
            v.co=Vector(((world.x-centre.x)*scale.x,(world.y-centre.y)*scale.y,(world.z-centre.z)*scale.z))
        ob.matrix_world.identity()
        ob.select_set(True)
    bpy.context.view_layer.objects.active=objs[0]
    bpy.ops.object.join()
    ob=bpy.context.object; ob.name='NCR_'+p['id']
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,p['id']+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_extras=True)
    triangles=sum(len(poly.vertices)-2 for poly in ob.data.polygons)
    report.append({'id':p['id'],'triangles':triangles,'sizeM':target,'bytes':os.path.getsize(os.path.join(OUT,p['id']+'.glb'))})
    ob.select_set(False)
    # Place source objects apart for workshop inspection, after the origin-centred exports.
    workshop_x += target[0]/2 + 40
    ob.location.x=workshop_x
    workshop_x += target[0]/2

# Library write preserves the user's active .blend path and does not save their unrelated objects.
source_dir=os.path.join(ROOT,'assets','landmarks')
os.makedirs(source_dir,exist_ok=True)
bpy.data.libraries.write(os.path.join(source_dir,'landmarks.blend'),{work},fake_user=True)
with open(os.path.join(OUT,'manifest.json'),'w',encoding='utf8') as file:
    json.dump({'license':'CC0-1.0','author':'Original procedural models authored for NCR Rail','source':'scripts/model-landmarks.py','approximate':True,'axis':'GLB +X frontage, +Y up; base origin; metre units','models':report},file,indent=2)
for ob in old_selection:
    if ob.name in bpy.context.view_layer.objects: ob.select_set(True)
if old_active and old_active.name in bpy.context.view_layer.objects: bpy.context.view_layer.objects.active=old_active
print(json.dumps(report))
