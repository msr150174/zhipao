import json

SRC = r"D:\ComfyUI工作流\wan2.2 ani.json"
DST = r"C:\Users\msr150174\Documents\deepseek-harness\default-workspace\wan2.2_ani_nobg.json"

d = json.load(open(SRC, encoding="utf-8"))
nodes = d["nodes"]
byid = {n["id"]: n for n in nodes}

max_link = max(l[0] for l in d["links"])
existing_ids = set(byid)
# 关键：ComfyUI 里 link id 与 node id 共用数字空间，历史 link 已经用到 721。
# 因此新 node id 必须避开「已有 node id」和「已有 link id」两个集合，
# 否则改写 link 时会把自己新建的节点当成 link 处理（这正是上一版崩溃的原因）。
link_ids_taken = set(l[0] for l in d["links"])
next_id = max(max(byid), max_link) + 1
assert next_id not in existing_ids and next_id not in link_ids_taken

# --- 1. 为每个 VAEDecode 新建一个 InspyrenetRembg（接在其后面） ---
vaedecode_to_rembg = {}   # vaedecode id -> new rembg node id
new_nodes = []
for src_id in (189, 194):
    next_id += 1
    src = byid[src_id]
    n = {
        "id": next_id,
        "type": "InspyrenetRembg",
        "pos": [src["pos"][0] + 400, src["pos"][1] + 40],
        "size": [300, 78],
        "flags": {},
        "order": src.get("order", 0) + 1,
        "mode": 0,
        "inputs": [{"label": "image", "name": "image", "type": "IMAGE", "link": None}],
        "outputs": [
            {"label": "IMAGE", "name": "IMAGE", "type": "IMAGE", "links": []},
            {"label": "MASK", "name": "MASK", "type": "MASK", "links": None},
        ],
        "properties": {
            "Node name for S&R": "InspyrenetRembg",
            "cnr_id": "comfyui-inspyrenet-rembg",
            "ver": "1.0.0",
        },
        "widgets_values": ["default"],
    }
    vaedecode_to_rembg[src_id] = n["id"]
    new_nodes.append(n)

new_ids = set(vaedecode_to_rembg.values())
assert not (new_ids & existing_ids), "node id collision"
assert not (new_ids & set(l[0] for l in d["links"])), "id overlaps a link id"

# --- 2. 把 VAEDecode 的所有下游 link 改接到对应 rembg 节点 ---
for l in d["links"]:
    if l[1] in vaedecode_to_rembg:          # l[1] 是源节点 id；vaedecode_to_rembg 的键也是节点 id
        l[1] = vaedecode_to_rembg[l[1]]
        l[2] = 0                             # IMAGE 输出槽

# --- 3. 重建受影响节点的 outputs[0].links ---
# 注意：新建节点尚未进入 byid，直接按 id 建立统一索引
all_by_id = {n["id"]: n for n in nodes + new_nodes}
for nid in list(vaedecode_to_rembg) + list(new_ids):
    all_by_id[nid]["outputs"][0]["links"] = []
for l in d["links"]:
    if l[1] in vaedecode_to_rembg or l[1] in new_ids:
        o = all_by_id[l[1]]["outputs"][0]
        o["links"] = (o.get("links") or []) + [l[0]]

# --- 4. 新增 VAEDecode -> rembg 的连接 ---
for src_id, nid in vaedecode_to_rembg.items():
    max_link += 1
    d["links"].append([max_link, src_id, 0, nid, 0, "IMAGE"])
    all_by_id[nid]["inputs"][0]["link"] = max_link
    o = all_by_id[src_id]["outputs"][0]
    o["links"] = (o.get("links") or []) + [max_link]

nodes.extend(new_nodes)
d["nodes"] = nodes
d["last_node_id"] = next_id
d["last_link_id"] = max_link

# --- 5. 输出帧率按 RIFE×2 修正 + crf 统一 + 循环监视器清空 ---
for n in nodes:
    if n["type"] == "VHS_VideoCombine" and isinstance(n.get("widgets_values"), dict):
        n["widgets_values"]["frame_rate"] = 32
        n["widgets_values"]["crf"] = 19
    if n["type"] == "easy showAnything":
        n["widgets_values"] = [""]

json.dump(d, open(DST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

# --- 校验 ---
chk = json.load(open(DST, encoding="utf-8"))
ids = [n["id"] for n in chk["nodes"]]
assert len(ids) == len(set(ids)), "dup node id"
lids = [l[0] for l in chk["links"]]
assert len(lids) == len(set(lids)), "dup link id"
b2 = {n["id"]: n for n in chk["nodes"]}
lset = set(lids)
for l in chk["links"]:
    assert l[1] in b2, f"link {l[0]} bad src {l[1]}"
    assert l[3] in b2, f"link {l[0]} bad dst {l[3]}"
for n in chk["nodes"]:
    for i in n.get("inputs") or []:
        if i.get("link") is not None:
            assert i["link"] in lset, f"node {n['id']} input {i['name']} dangling {i['link']}"
    for o in n.get("outputs") or []:
        for lid in o.get("links") or []:
            assert lid in lset, f"node {n['id']} output {o['name']} dangling {lid}"
# 确认 VAEDecode 只连到 rembg
for l in chk["links"]:
    if l[1] in (189, 194):
        assert l[3] in new_ids, f"VAEDecode {l[1]} still feeds {l[3]} directly"
print("OK  nodes:", len(chk["nodes"]), " links:", len(chk["links"]))
print("VAEDecode -> rembg:", vaedecode_to_rembg)
print("re-attached downstream links:", sum(1 for l in chk["links"] if l[1] in new_ids))
