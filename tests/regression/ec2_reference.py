"""Independent reference calculation for the EN 1992-1-1 punching shear tests.

Shares no code with the TypeScript engine: formulas are written directly from EN 1992-1-1:2004
(6.38)-(6.43), (6.47), (6.3N), (6.6N), Table 6.1 and 6.4.5(3), and the control perimeter is integrated by
dense sampling (40 points per mm) with a ray-shadow test for openings (6.4.2(3)).
Run: python3 tests/regression/ec2_reference.py  (prints the values frozen in ec2-reference.test.ts)
"""
import math, json
def kcoef(r):
    t=[(0.5,.45),(1,.6),(2,.7),(3,.8)]
    if r<=0.5: return .45
    if r>=3: return .8
    for (r0,k0),(r1,k1) in zip(t,t[1:]):
        if r<=r1: return k0+(k1-k0)*(r-r0)/(r1-r0)
def w1(cpar,cperp,d): return cpar**2/2+cpar*cperp+4*cperp*d+16*d*d+2*math.pi*d*cpar
def resist(fck,d,rx,ry,gc=1.5,acc=1.0):
    k=min(2.0,1+math.sqrt(200/d)); rho=min(0.02,math.sqrt(rx*ry))
    vf=0.18/gc*k*(100*rho*fck)**(1/3); vmin=0.035*k**1.5*math.sqrt(fck)
    nu=0.6*(1-fck/250); fcd=acc*fck/gc; return k,rho,vf,vmin,max(vf,vmin),nu,fcd,0.4*nu*fcd
# brute-force sampling of rounded-rectangle perimeter
def sample(c1,c2,d,n_per_mm=40):
    r=2*d; hx,hy=c1/2,c2/2; pts=[]
    def line(a,b):
        L=math.dist(a,b); n=max(1,int(L*n_per_mm))
        for i in range(n):
            t=(i+.5)/n; pts.append((a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,L/n))
    def arc(c,a0):
        L=r*math.pi/2; n=max(1,int(L*n_per_mm))
        for i in range(n):
            a=a0+(i+.5)/n*math.pi/2; pts.append((c[0]+r*math.cos(a),c[1]+r*math.sin(a),L/n))
    line((-hx,-hy-r),(hx,-hy-r)); arc((hx,-hy),-math.pi/2); line((hx+r,-hy),(hx+r,hy)); arc((hx,hy),0)
    line((hx,hy+r),(-hx,hy+r)); arc((-hx,hy),math.pi/2); line((-hx-r,hy),(-hx-r,-hy)); arc((-hx,-hy),math.pi)
    return pts
def in_shadow(p,o):
    x,y=p; L=math.hypot(x,y); ux,uy=x/L,y/L
    if o['type']=='circle':
        a=o['cx']*ux+o['cy']*uy; perp=abs(o['cx']*uy-o['cy']*ux); return a>0 and perp<=o['d']/2
    x0,x1=o['cx']-o['w']/2,o['cx']+o['w']/2; y0,y1=o['cy']-o['h']/2,o['cy']+o['h']/2
    tmin,tmax=0,1e18
    for u,lo,hi in((ux,x0,x1),(uy,y0,y1)):
        if abs(u)<1e-12:
            if 0<lo or 0>hi: return False
        else:
            ta,tb=lo/u,hi/u; tmin=max(tmin,min(ta,tb)); tmax=min(tmax,max(ta,tb))
    return tmax>=tmin
def dist_to_col(o,hx,hy):
    if o['type']=='circle':
        gx=max(0,abs(o['cx'])-hx); gy=max(0,abs(o['cy'])-hy); return max(0,math.hypot(gx,gy)-o['d']/2)
    gx=max(0,abs(o['cx'])-hx-o['w']/2); gy=max(0,abs(o['cy'])-hy-o['h']/2); return math.hypot(gx,gy)
def case(name,c1,c2,d,fck,rx,ry,V,Mx,My,openings=()):
    pts=sample(c1,c2,d); hx,hy=c1/2,c2/2
    active=[o for o in openings if dist_to_col(o,hx,hy)<=6*d]
    eff=[p for p in pts if not any(in_shadow(p[:2],o) for o in active)]
    u1=sum(p[2] for p in eff); xc=sum(p[0]*p[2] for p in eff)/u1; yc=sum(p[1]*p[2] for p in eff)/u1
    W_about_X=sum(abs(p[1]-yc)*p[2] for p in eff); W_about_Y=sum(abs(p[0]-xc)*p[2] for p in eff)
    ex=My/V; ey=Mx/V; by=c1+4*d; bz=c2+4*d
    if My>0 and Mx>0: beta=1+1.8*math.sqrt((ex/bz)**2+(ey/by)**2); method='6.43'
    elif My>0: beta=1+kcoef(c1/c2)*ex*u1/W_about_Y; method='6.39'
    elif Mx>0: beta=1+kcoef(c2/c1)*ey*u1/W_about_X; method='6.39'
    else: beta=1; method='conc'
    k,rho,vf,vmin,vrdc,nu,fcd,vmax=resist(fck,d,rx,ry)
    u0=2*(c1+c2); ved=beta*V/(u1*d); ved0=beta*V/(u0*d)
    out=dict(name=name,u1=u1,xc=xc,yc=yc,WX=W_about_X,WY=W_about_Y,beta=beta,method=method,ved=ved,ved0=ved0,k=k,rho=rho,vf=vf,vmin=vmin,vrdc=vrdc,nu=nu,fcd=fcd,vmax=vmax,dcr1=ved/vrdc,dcr0=ved0/vmax,dcr=max(ved/vrdc,ved0/vmax))
    print(json.dumps({a:(round(b,6) if isinstance(b,float) else b) for a,b in out.items()}))
case("A",400,400,200,30,.01,.01,600e3,0,40e6)
case("B",500,300,180,35,.012,.008,800e3,60e6,35e6)
case("C",400,400,200,30,.01,.01,500e3,0,30e6,[dict(type='circle',cx=-700,cy=150,d=150)])
case("D",450,300,190,40,.015,.01,900e3,70e6,0,[dict(type='circle',cx=-500,cy=200,d=120),dict(type='rectangle',cx=100,cy=650,w=200,h=120),dict(type='circle',cx=2000,cy=0,d=200)])
case("E",350,350,150,25,.005,.005,300e3,0,0)
case("F",600,400,300,45,.008,.012,1500e3,90e6,0)
case("G",300,300,250,30,.002,.002,400e3,0,0)
case("H",250,250,250,30,.02,.02,2500e3,0,0)
case("I",400,400,300,35,.01,.01,900e3,0,50e6,[dict(type='rectangle',cx=900,cy=-200,w=300,h=250)])
case("J",200,200,300,20,.02,.02,1000e3,0,0)
print("closed-form W1 A:",w1(400,400,200))
