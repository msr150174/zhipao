import json, collections

p = r"D:\ComfyUI工作流\wan2.2 ani.json"
d = json.load(open(p, encoding="utf-8"))
nodes = {n["id"]: n for n in d["nodes"]}

out=[]
w=out.append

def fmt(n, full=False):
    wv = n.get("widgets_values")
    s = json.dumps(wv, ensure_ascii=False)
    if not full and len(s)>400: s=s[:400]+"..."
    ins = ", ".join(f"{i.get('name')}<-{'link' if i.get('link') is not None else '-'}" for i in n.get("inputs",[]) or [])
    outs = ", ".join(str(o.get("name")) for o in n.get("outputs",[]) or [])
    return (f"#{n['id']} [{n['type']}] title={n.get('title','')!r} mode={n.get('mode',0)}\n"
            f"    widgets={s}\n    in: {ins}\n    out: {outs}")

for n in sorted(d["nodes"], key=lambda x: x["id"]):
    if n["type"] in {"WanAnimateToVideo","KSampler","ImageResizeKJv2","easy forLoopStart","easy forLoopEnd",
                     "VHS_LoadVideo","LoadImage","ImageUpscaleWithModelBatched","RIFE VFI","TrimVideoLatent",
                     "ModelSamplingSD3","OpenposePreprocessor","InspyrenetRembg","PixelPerfectResolution",
                     "GetImageRangeFromBatch","GetImageSizeAndCount","INTConstant","MathExpression|pysssss",
                     "SimpleMath+","ImageConcanate","ImageBatchMulti","easy compare","LayerUtility: If ",
                     "Number to Int","CLIPTextEncode","VAEDecode","UNETLoader","CLIPLoader"}:
        w(fmt(n))

# link map
links = {l[0]: l for l in d.get("links",[])}
w("\n== links summary (origin -> target) ==")
for lid,l in sorted(links.items()):
    src = nodes.get(l[1]); dst = nodes.get(l[3])
    w(f"  link {lid}: #{l[1]}({src['type'] if src else '?'})[{l[2]}] -> #{l[3]}({dst['type'] if dst else '?'})[{l[4]}]")

open(r"C:\Users\msr150174\Documents\deepseek-harness\default-workspace\wan22_detail.txt","w",encoding="utf-8").write("\n".join(out))
print("ok", len("\n".join(out)))
