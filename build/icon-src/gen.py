import math
def lens(p1,p2,b):
    mx,my=(p1[0]+p2[0])/2,(p1[1]+p2[1])/2
    dx,dy=p2[0]-p1[0],p2[1]-p1[1]; L=math.hypot(dx,dy); nx,ny=-dy/L*b,dx/L*b
    f=lambda v:f"{v:.1f}"
    return f"M{f(p1[0])} {f(p1[1])}Q{f(mx+nx)} {f(my+ny)} {f(p2[0])} {f(p2[1])}Q{f(mx-nx)} {f(my-ny)} {f(p1[0])} {f(p1[1])}Z"
def svg(body,name):
    open(name,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">{body}</svg>')
# A: folha-etiqueta (leaf shaped price tag with hole)
svg(f'<path fill-rule="evenodd" d="{lens((52,204),(208,48),70)} M184 72m-15 0a15 15 0 1 0 30 0a15 15 0 1 0 -30 0Z"/>'
    f'<path d="M52 204 L34 222" stroke="#000" stroke-width="12" stroke-linecap="round"/>','a-symbol.svg')
# B: sacola com broto
svg(f'<rect x="60" y="112" width="136" height="112" rx="18"/>'
    f'<rect x="122" y="70" width="12" height="46" rx="6"/>'
    f'<path d="{lens((128,84),(70,48),20)}"/><path d="{lens((128,76),(190,36),22)}"/>','b-symbol.svg')
# C: fruta-pizza (fruit as a pie chart, a slice out)
c=(128,148); r=82; a=math.radians(-30); px,py=c[0]+r*math.cos(a),c[1]+r*math.sin(a)
svg(f'<path d="M{c[0]} {c[1]}L{px:.1f} {py:.1f}A{r} {r} 0 1 1 {c[0]} {c[1]-r}Z"/>'
    f'<path d="M{c[0]+7} {c[1]-12}L{c[0]+7} {c[1]-r-12}A{r} {r} 0 0 1 {px+7:.1f} {py-12:.1f}Z"/>'
    f'<path d="{lens((124,62),(80,24),18)}"/>','c-symbol.svg')
