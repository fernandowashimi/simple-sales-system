import math
def lens(p1,p2,b):
    mx,my=(p1[0]+p2[0])/2,(p1[1]+p2[1])/2
    dx,dy=p2[0]-p1[0],p2[1]-p1[1]; L=math.hypot(dx,dy); nx,ny=-dy/L*b,dx/L*b
    f=lambda v:f"{v:.1f}"
    return f"M{f(p1[0])} {f(p1[1])}Q{f(mx+nx)} {f(my+ny)} {f(p2[0])} {f(p2[1])}Q{f(mx-nx)} {f(my-ny)} {f(p1[0])} {f(p1[1])}Z"
# mark on 256 grid, optically centred: bag slightly wider at the mouth, sprout leaves heavier for small sizes
bag='M58 118H198L188 210Q186 226 170 226H86Q70 226 68 210Z'
sprout=f'<rect x="121" y="82" width="14" height="37"/><path d="{lens((128,88),(66,52),24)}"/><path d="{lens((128,80),(194,38),26)}"/>'
def svg(name,tile,bagc,leafc,scale=1.0):
    t=f'<rect width="256" height="256" rx="56" fill="{tile}"/>' if tile else ''
    g=f'<g transform="translate(128 132) scale({scale}) translate(-128 -132)">'
    open(name,'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>Gestão de Vendas</title>{t}{g}<path d="{bag}" fill="{bagc}"/><g fill="{leafc}">{sprout}</g></g></svg>')
svg('final-symbol.svg',None,'#000','#000')
svg('app-icon.svg','#1F6B43','#F4EBD9','#B8E46E',0.78)
svg('app-icon-small.svg','#1F6B43','#F4EBD9','#B8E46E',0.9)  # tighter cut for 16-32px
