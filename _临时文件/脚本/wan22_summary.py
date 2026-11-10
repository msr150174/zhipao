import json, collections, io, sys

p = r"D:\ComfyUI工作流\wan2.2 ani.json"
d = json.load(open(p, encoding="utf-8"))
nodes = d["nodes"]
out = []
w = out.append

w(f"id={d.get('id')} revision={d.get('revision')} last_node_id={d.get('last_node_id')} last_link_id={d.get('last_link_id')}")
w(f"total nodes={len(nodes)}  groups={len(d.get('groups',[]))}  links={len(d.get('links',[]))}")
modes = collections.Counter(n.get('mode',0) for n in nodes)
w(f"modes (0=normal,2=muted,4=bypass): {dict(modes)}")

# node types excluding muted/bypassed
active = [n for n in nodes if n.get('mode',0)==0]
w("")
w("== node types (all / active) ==")
c_all = collections.Counter(n['type'] for n in nodes)
c_act = collections.Counter(n['type'] for n in active)
for t,c in c_all.most_common():
    w(f"  {t}: {c}" + (f"  (active {c_act[t]})" if c_act[t]!=c else ""))

w("")
w("== muted / bypassed nodes ==")
for n in nodes:
    if n.get('mode',0)!=0:
        w(f"  #{n['id']} {n['type']} mode={n['mode']} title={n.get('title','')!r}")

w("")
w("== key parameters ==")
KEY = {"KSampler","KSamplerAdvanced","SamplerCustomAdvanced","WanImageToVideo","WanFirstLastFrameToVideo",
       "EmptyLatentImage","EmptyHunyuanLatentVideo","EmptyLatentVideo","ModelSamplingSD3","LoraLoaderModelOnly",
       "LoraLoader","CLIPTextEncode","UNETLoader","CheckpointLoaderSimple","VAELoader","ImageResizeKJ",
       "CreateVideo","SaveVideo","VHS_VideoCombine","LoadImage","ImageScale","ImageScaleBy","UpscaleModelLoader",
       "ImageUpscaleWithModel","RIFE VFI","BasicScheduler","ModelSamplingFlux","CFGGuider","TorchCompileModel",
       "WanVideoVAELoader","Power Lora Loader (rgthree)"}
def short(v, n=200):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s)<=n else s[:n]+"..."
for n in sorted(nodes, key=lambda x: x['id']):
    if n['type'] in KEY:
        w(f"  #{n['id']:<4} {n['type']:<28} {n.get('title','')}  wv={short(n.get('widgets_values'))}")

w("")
w("== model files referenced ==")
files = collections.defaultdict(set)
for n in nodes:
    for m in (n.get('properties',{}) or {}).get('models',[]) or []:
        files[m.get('directory','?')].add(m.get('name','?'))
    wv = n.get('widgets_values')
    t = n['type']
    if isinstance(wv, list) and wv:
        if 'Loader' in t or 'Load' in t or t=='UpscaleModelLoader':
            for v in wv:
                if isinstance(v,str) and ('.safetensors' in v or '.ckpt' in v or '.pth' in v or '.pt' in v or '.gguf' in v):
                    files[t].add(v)
for k in sorted(files):
    for v in sorted(files[k]):
        w(f"  [{k}] {v}")

w("")
w("== groups ==")
for g in d.get('groups',[]):
    w(f"  {g.get('title')!r} bounding={g.get('bounding')}")

w("")
w("== node titles (custom names) ==")
for n in sorted(nodes, key=lambda x: x['id']):
    if n.get('title'):
        w(f"  #{n['id']} {n['type']} -> {n['title']!r}")

txt = "\n".join(out)
open(r"C:\Users\msr150174\Documents\deepseek-harness\default-workspace\wan22_summary.txt","w",encoding="utf-8").write(txt)
print(txt)
