# Wan2.2 Animate 工作流：帧率体系、节点参数与实战配置

基于 `D:\ComfyUI工作流\wan2.2 ani.json`（117 节点 / 8 分组 / 158 连线）的完整解读。

---

## 一、先厘清一个概念：这个工作流里有 5 个不同的"帧率"

很多人调不动视频速度，是因为把下面 5 件事都当成"帧率"了：

| # | 名称 | 载体 | 作用 | 当前值 |
|---|---|---|---|---|
| 1 | **源帧率 force_rate** | `VHS_LoadVideo` #63 | 把驱动视频重采样到多少 fps 再喂给网络。**决定动作总帧数 = 时长 × force_rate** | 16 |
| 2 | **动作帧率 / 首帧率** | `SimpleMath+` #224 `a*16` | 把"每段帧数"换算成"这一段代表多少秒"，只用于轮数计算 | 16 |
| 3 | **采样帧率** | `WanAnimateToVideo` length | 每个 batch 一次生成多少帧（时间维长度） | 77 |
| 4 | **插帧倍率 multiplier** | `INTConstant` #223 → `RIFE VFI` #222 | 生成完再把帧数翻倍，等效提升播放帧率 | 2 |
| 5 | **输出帧率 frame_rate** | 11 个 `VHS_VideoCombine` | 只影响写进 mp4 的 fps 和时间轴长度，**丢帧/重复帧不会重新生成** | 16（即最终实际 32fps） |

> 关键关系：`最终播放 fps = 输出 frame_rate × (multiplier 是否被并入)`
> 当前配置：RIFE 把 16fps 的 48 帧变成 96 帧，若 `VHS_VideoCombine` 仍写 16 → 视频被拉慢成 2 倍时长（慢动作）；要得到自然的 32fps 播放，**必须把对应的 `VHS_VideoCombine.frame_rate` 改成 16×2=32**。

---

## 二、逐节点参数详解与调法

### 1. 驱动视频入口 `VHS_LoadVideo`（#63）
- `video` / `choose video to upload`：驱动视频。换成你自己的视频时，用它上传。
- `force_rate`：**最重要的帧率旋钮**。16 = 每秒抽 16 帧。改成 24 则同一个 2 分 20 秒视频会产出 3360 帧、轮数 +50%，耗时线性上升；改成 12 则更快但动作会顿。
- `skip_first_frames`：从头丢掉多少帧。当前 **81**（≈5 秒），用来跳过片头黑屏/水印。
- `frame_load_cap`：0 = 不截断，全部读入。**长视频建议改成实际需要的帧数**，避免一次性把上千帧塞进内存。
- `select_every_nth`：抽帧步长。等价于降低帧率（2 = 取一帧隔一帧）。
- `custom_width/height`：0 = 原始尺寸。这里不用改，后面统一 resize。
- 输出：`IMAGE`（驱动帧）、`frame_count`（**总帧数，轮数计算的输入 a**）、`audio`（原音轨，被若干 `trim_to_audio=true` 的输出节点使用）、`video_info`。

### 2. 尺寸统一 `ImageResizeKJv2`（#64/#227/#228/#301/#302/#346，共 6 个）
`[832, 480, "lanczos", "crop", "0,0,0", "bottom", 16, "cpu"]`
- `width/height`：**实际生成分辨率在这里**（不一定是 832×480，见第四节）。6 个节点必须**同时改**，否则姿态/面部/参考图尺度不一致会导致人物错位、抖动。
- `upscale_method`：lanczos 画质最好；追求速度换 bilinear。
- `keep_proportion`：`crop`（裁切填满）/ `pad`（加边，不裁人）。驱动视频比例和生成比例差得多时用 `pad` 更安全。
- `crop_position`：`bottom`（保下）/ `center`（保中）。竖屏人物建议 `center`。
- `divisible_by`：16，Wan 的 VAE 下采样要求，**不要改成非 16**。
- `device`：cpu / cuda。cuda 更快但吃显存。

### 3. 姿态与面部 `OpenposePreprocessor` ×4、`PixelPerfectResolution`（#152/#309）
- `PixelPerfectResolution`：`[216|336, 64, "Just Resize"]` — 把参考图的短边吸附到 64 的倍数，保证预处理分辨率"像素完美"。`216/336` 是目标短边，改成 512 可提升姿态/人脸精度（更吃显存）。
- `OpenposePreprocessor`：`detect_hand`/`detect_body`/`detect_face` 三个开关。**做全身舞建议三个全开**；只做半身可关 hand 省算力。
- `GetImageRangeFromBatch`（#205 `[0,72]`、#206 `[0,77]`、#296/#300/#335 `[0,1]`）：从整段取窗口。`[0,72]` 是"取 72 帧"，`[0,1]` 是"取 1 帧首帧"。**这里的 72/77 是编码器窗口，不要随便动**，要改的是 #212。

### 4. 核心生成 `WanAnimateToVideo`（#182 / #196）
`[640, 640, 77, 1, 5, 0]` = `width, height, length, batch_size, continue_motion_max_frames, video_frame_offset`
- `width/height`：内部潜空间尺寸，**跟随上游接线**（被 `ImageResizeKJv2` 的 width/height 驱动），通常不用手改。
- `length=77`：**一次生成的帧数（4n+1 的约定）**。77 帧 × 16fps ≈ 4.8 秒/段。
- `continue_motion_max_frames=5`：**续帧重叠帧数**。上一段结尾的 5 帧作为下一段的"运动上下文"。调大更连贯但更慢更吃显存；调小会段落感强。
- `video_frame_offset=0`：由循环自动喂入的偏移量，**手改无效**。
- `#182` 不接 `continue_motion`（第一段），`#196` 接（后续所有段）。

### 5. 采样 `KSampler`（#183 / #192）
`[seed, "randomize", steps=6, cfg=3, sampler="lcm", scheduler="simple", denoise=1]`
- `steps=6`：因为挂了 `lightx2v cfg_step_distill` 蒸馏 LoRA，6 步就够。**去掉这个 LoRA 就要改回 20~30 步**。
- `cfg=3`：蒸馏 LoRA 下的推荐值；若画面"糊/灰"可升到 4~5。
- 两个 KSampler 的 `seed` 建议：要保持两段风格一致，把两个都改成 `fixed` 并填同一个种子。

### 6. 循环与轮数计算（`For / 循环生成` 组）
数据链：
```
VHS_LoadVideo.frame_count ──a──┐
每段视频帧数 #212 (53) ──b──→ MathExpression #261: ceil((a-b)/(c-5))
跳过帧     #214 (0)   ──c──┘        where c 实际接的是 #212
```
- **#212 `每段视频帧数 = 53`**：**最常调的旋钮**。它 = 每轮"有效产出帧数 48" + 5 帧重叠。想让单段更长就调大（要满足 4n+1，如 53/77/101），代价是单段耗时上升。
- **#214 `跳过帧 = 0`**：从第几帧开始生成，与 `VHS_LoadVideo.skip_first_frames` 是两个不同的跳过（后者在读入阶段）。
- `easy forLoopStart` #259：`total` 接 #261 的轮数，`initial_value1=1` 是起始序号。
- `easy forLoopEnd` #265 + `easy compare` #315 `a < b`：终止判断。
- `SimpleMath+` #292/#341 `a-5`：把"段长-5"作为推进量；#314 `a-b` 算剩余帧。
- `easy showAnything`：`总需轮次`、`当前轮次` 监视器，**调参时看这两个数字**。

### 7. 插帧 `RIFE VFI`（#222）+ `INTConstant multiplier`（#223 = 2）
- `multiplier`：插帧倍率。2 = 翻倍（16→32fps 等效）。
- `clear_cache_after_n_frames=2`：显存紧张可降到 1。
- `fast_mode=true`、`ensemble=true`：质量/速度平衡，默认保留。
- **不想要插帧**：把 #223 改成 1，或直接 bypass #222。
- 插帧是**耗时大户**（约翻倍），长视频可只在最终成片段落启用。

### 8. 输出 `VHS_VideoCombine` ×11
- `frame_rate`：**唯一决定播放速度的参数**。当前 16。
  - 16fps + RIFE×2 → 成片应为 **32**（否则变慢动作）
  - 16fps 不插帧 → 16 正常，24 轻微加速
- `crf`：画质。5≈无损（文件巨大）、19 良好、40 文件小但糊。当前三种混用，**建议长视频统一 19**。
- `filename_prefix`：`wan2.2/animate` 会落到 `output/wan2.2/animate_00001.mp4`。
- `trim_to_audio=true`：把驱动视频原声一并输出（需源视频有音轨）。`format=h264-mp4` 才能带音频。
- `save_output`：置 true 才会在队列完成后自动保留。

### 9. 已 bypass 的节点（mode=4）
`#221 FastWan_T2V LoRA`、`#347 PusaV1 LoRA`、`#348 Wan2.2-Fun-InP LoRA`、`#323/#324 Upscale Model Loader + ImageUpscaleWithModelBatched(RealESRGAN_x2)`。
- 想启用 RealESRGAN 二次放大：右键 `#323`/`#324` → **Mode: Always（取消 bypass）**，并把 `#324` 的 `per_batch` 调到 1~2 防爆显存。
- 想换风格/加速：启用 `#221`（FastWan，T2V 加速 LoRA，**只适合纯文生视频，做 Animate 会破坏动作一致性，慎用**）。

---

## 三、情景复现：2 分 20 秒驱动视频 + 1 张参考图

### 3.1 帧数与轮数计算（保持 16fps）

**驱动视频：2 分 20 秒 = 140 秒**

```text
force_rate = 16 fps
总帧数 a  = 140 × 16 = 2240 帧
每段帧数 b = 53（有效 48 帧 + 5 帧重叠）
轮数      = ceil((2240 - 53) / (53 - 5)) = ceil(2187 / 48) = ceil(45.56) = 46 轮
```

**输出时长核对**：46 轮 × 48 帧 = 2208 帧；2208 ÷ 16 = **138 秒**（末段重叠造成的几秒误差属正常）。

**耗时估算**（16GB 级显卡、832×480、6 步）：

| 阶段 | 单轮 | 46 轮 |
|---|---|---|
| WanAnimateToVideo + KSampler | ≈ 20~25 秒 | **15~19 分钟** |
| RIFE ×2 插帧 | ≈ 5~8 秒 | 4~6 分钟 |
| **合计** | — | **约 20~25 分钟** |

> 想缩短：把 `force_rate` 降到 12（总帧数 1680 → 35 轮，减 24%），或把 #212 调到 77（单段更长，轮数降到 31，但单轮更慢）。二者总耗时接近，**降 force_rate 才是真正的净收益**。

### 3.2 各节点该怎么改（照抄即可）

| 节点 | 当前值 | 改成 | 理由 |
|---|---|---|---|
| `VHS_LoadVideo` #63 | force_rate 16, skip 81, cap 0 | force_rate **16**；skip **0**（新视频无片头）；frame_load_cap **2240** | 限制内存，明确总量 |
| `每段视频帧数` #212 | 53 | **53**（保时间）或 **77**（保质量/少接缝） | 决定轮数与单段时长 |
| `跳过帧` #214 | 0 | **0** | 从头开始 |
| `ImageResizeKJv2` ×6 | 832×480 | **832×480**（快速）/ **720×1280**（竖屏高质量） | 6 个必须同步改 |
| `multiplier` #223 | 2 | **2**（要丝滑）或 **1**（要省时间） | 插帧倍率 |
| `RIFE VFI` #222 | multiplier 接 #223 | 同上 | — |
| `KSampler` #183/#192 | seed randomize | 改 **fixed + 同一种子** | 避免两段风格跳变 |
| `VHS_VideoCombine` | frame_rate 16, crf 5/19/40 | frame_rate **32**（配 RIFE×2）, crf **19** | 速度正确 + 体积可控 |
| `WanAnimateToVideo` #196 | continue_motion_max_frames 5 | 第一轮先保 **5**，出现接缝再升到 9 | 提升连贯性 |

**推荐起步配置（稳）**：`force_rate=16 / #212=53 / 832×480 / multiplier=2 / 输出 32fps / crf=19`
**质量优先**：`force_rate=24 / #212=77 / 720×1280 / multiplier=2 / 输出 48fps / crf=19`（耗时约为起步配置的 3 倍）

### 3.3 参考图要给多大比例、怎么裁

**结论：参考图按"最终生成画幅"准备，比例必须等于生成宽高比。**

- 本工作流驱动视频被统一为 **832×480 ≈ 1.733 : 1（横向）**，所以参照图也应给 **≈16:9 横向**。
- 实操只要抓两点：
  1. **比例对齐**：832×480 的画布里，人物**全身（头顶到脚踝）占画面高度的 65%~80%，居中，左右留白**。你上传的 `ds鲸鱼娘17.png.jpg` 是 829×1280（≈0.65:1 竖版全身体），**直接上传会被 `ImageResizeKJv2(keep_proportion=crop, crop_position=bottom)` 从底部裁掉一半** —— 这就是"人物被切"的主因。
  2. **两种正确做法**
     - **做法 A（推荐，省事）**：图片原样上传，把 `#64` 等 6 个 `ImageResizeKJv2` 改成 `keep_proportion = pad`、`pad_color = 255,255,255`，并把生成尺寸改成竖屏 **720×1280**。这样人物完整、背景补白，与驱动视频的人物尺度也对得上。
     - **做法 B（质量最好）**：预先手工裁成 16:9 —— 以这张图为参照，**保留头部到膝盖上方**（约 y=0 ~ y=880 的区间），左右补白到 832×480 比例（即裁成 829×466 左右的横条无法容纳全身，**竖屏人物做横屏全身体需要缩到画面高度 70% 以下**），或用 PS 把人物缩到 70% 后居中放到 1664×960 白底上。
  3. **人物在参照图里的绝对尺寸建议**：短边 ≥ 768px（约 832×480 的短边 480 的 1.6 倍），头部占比约画面高度的 1/8~1/6 —— 脸太小会导致 `OpenposePreprocessor` 与面部对齐失败、脸部闪烁。

**一句话**：竖版全身立绘 → 要么把工作流改成 720×1280 竖屏 + `pad`，要么把立绘缩到横向画幅高度的 70% 居中留白；**不要原图直塞横向 832×480 的 crop 模式**。

---

## 四、提示词分析与批改（针对 `ds鲸鱼娘17.png.jpg`）

### 4.1 现状诊断（原正向提示词）

```text
The character is dancing, jiggling boob, big boob, pink lips, soft and bouncing boobs, mouth closed smile,
little smile with mouth closed, anime,
sakikotogawa_bandori, long hair, hair ribbon, yellow eyes black ribbon, yellow eyes, light blue hair, braid,
sidelock, ribbon, long hair, white blouse, togawa sakiko, braid, black neck ribbon, white collared shirt,
buttons, frilled shirt, grey plaid skirt, black shoe, white short sock,
on the street, city, in the day, only 1 girl,
```

| 问题 | 说明 | 批改 |
|---|---|---|
| ❌ **角色特征与参考图完全不符** | 提示词写的是 `sakikotogawa_bandori`（户山香澄系乐队少女：**浅蓝发 / 黄眼 / 白衬衫 / 灰格裙**），而你的图是**深蓝发 / 紫眼 / 深蓝冬季毛领大衣** | **删掉整套错配 tag**，换成图中真实特征 |
| ❌ **遗漏图中关键识别特征** | 图中 `鲸鱼耳鳍`、`鲸鱼尾巴`、`金色雪花纹`、`白色毛边`、`蓝白缎带` 都没写 | 补上，否则模型会自由发挥 |
| ❌ 身体特征词重复且权重失衡 | `jiggling boob / big boob / soft and bouncing boobs` 三连；`long hair`、`braid` 各出现 2 次 | 去重，最多保留 1 个 |
| ❌ 背景冲突 | `on the street, city, in the day` 与"参考图白底"冲突；负向里还有 `snow` | 做动作迁移时**背景由驱动视频决定**，删掉场景词 |
| ❌ 负向里 `snow` 会破坏画面 | 角色本身是 **雪主题设计**（雪花纹、毛边、冬季），负向禁雪会与外观矛盾 | **删掉 `snow`** |
| ⚠️ 冗余重复 | 负向 `色调艳丽`×6、`过曝`×5 | 各保留 1 次即可（重复词在 CLIP 里并非线性加权） |
| ⚠️ 缺通用质量词 | 正向无质量增强词 | 加 `masterpiece, best quality, very aesthetic, detailed face, detailed eyes` |
| ⚠️ 缺动态描述 | 只有 `is dancing`，与驱动视频动作不匹配 | 按驱动视频实际动作改写 |

### 4.2 批改后的正向提示词（直接可用）

```text
masterpiece, best quality, very aesthetic, highly detailed, 1girl, solo,
whale girl, navy blue hair, very long wavy hair, purple eyes, ahoge, whale-fin ears, whale tail,
white fur-trimmed hood, dark blue winter coat, blue ribbon bow, white mittens, white tights,
blue lace-up boots, pom-pom ornament, snowflake pattern, whale print pattern,
full body, dancing, energetic movement, smooth motion, swaying hair, cloth flutter,
```
> 单张参考图 + Animate 模式下，**背景/构图词一律不写**（由驱动视频接管）。角色词控制在 25 个 tag 以内效果最好，别堆 60 个。

### 4.3 批改后的负向提示词

```text
色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 风格, 作品, 画作, 整体发灰,
最差质量, 低质量, JPEG压缩残留, 丑陋的, 残缺的, 多余的手指, 画得不好的手部, 画得不好的脸部,
畸形的, 毁容的, 形态畸形的肢体, 手指融合, 静止不动的画面, 杂乱的背景, 三条腿, 背景人很多, 倒着走,
multiple finger, fused finger, extra limbs, missing limbs, bad anatomy,
lips painted with lipstick, boobs flying up, motion blur, inconsistent face, flicker, morphing,
```
> **已删去 `snow`**（与角色设计冲突），并把 `静止不动的画面` 保留（对视频质量帮助大）。`motion blur / flicker / morphing` 是视频生成专用的负向，能显著减少 Animate 常见的脸部抖动与形态漂移。

### 4.4 从 `ds鲸鱼娘17.png.jpg` 提取的 tag 清单（存 `ds_whale_girl_tags.txt`）

```text
Character: whale girl / 鲸鱼娘
Hair:      navy blue hair, very long hair, wavy hair, hair between eyes, ahoge, sidelocks
Eyes:      purple eyes, thick eyelashes
Head:      whale-fin ears, blue ribbon bow on head, fur hood trim
Outfit:    dark blue winter coat, white fluffy fur trim, white fur collar, blue ribbon bow, white mittens,
           whale print on mitten, snowflake embroidery, whale print pattern, blue lace-up boots, pom-pom on boots,
           white tights, white frilled skirt hem
Body:      whale tail (dark blue, fin-like), flat chest
Style:     anime, official art style, soft lighting, 1girl, solo
```

### 4.5 采样建议（配合上面的提示词）
- `cfg=3` 保持；如果角色脸不像参考图 → 优先**提高参考图里脸部的像素占比**（见 3.3），而不是加权重。
- 若画面出现"鲸鱼尾巴乱飘" → 在负向加 `multiple tails, deformed tail`。

---

## 五、去背景完整方案（`wan2.2_ani_nobg.json`）

### 5.1 原工作流里的背景现状
| 位置 | 现状 | 结论 |
|---|---|---|
| 参照图链路 | `LoadImage #57` → **`InspyrenetRembg #361`** → `ImageResizeKJv2 #346` → `WanAnimateToVideo.reference_image` | **已经抠过**，背景不污染角色 |
| 生成链路 | `WanAnimateToVideo.background_video`、`.character_mask` **均未接线** | 驱动视频背景**原样保留**在成片里 |
| 已启用的 `InspyrenetRembg` 只有 1 个 | 只作用于参照图 | 成片没有去背景 |

### 5.2 改版工作流已生成
`wan2.2_ani_nobg.json`：在**两个 `VAEDecode`（#189 / #194）之后各插入一个 `InspyrenetRembg`**（新节点 #723 / #724），
把原先从 `VAEDecode` 出去的所有下游连接（#190、#266、#196 链、#294 等，共 4 条）全部改接过去。
这样**每一帧生成结果在编码前都被抠图**，成片不再带驱动视频背景。

同时顺手做的两处安全修正（原文件的问题）：
- 11 个 `VHS_VideoCombine` 的 `frame_rate` 统一改 **32**（配合 RIFE×2，修正原来的慢动作 bug）
- `crf` 统一 **19**（原来 5/19/40 混用）
- 循环监视器 `easy showAnything` 初值清空

> ⚠️ 改版时踩到的一个真实坑（值得记住）：ComfyUI 里 **link id 与 node id 共用同一个数字空间**，原文件 link id 已用到 721。
> 新增节点时如果沿用 `last_node_id + 1`（=366），就会和已有的 link id 撞号，导致把"链接"当成"节点"改写而报错。
> 改版脚本已改为 `next_id = max(所有 node id, 所有 link id) + 1`，并做了悬挂连线校验。

### 5.3 使用与代价
- 载入 `wan2.2_ani_nobg.json`，其余参数（帧率/尺寸/轮数）按第三节设置，直接排队即可。
- **耗时**：抠图约 30~60 帧/秒（3060 级、480p）→ 2200 帧约 **1~2 分钟**；720p 约 5~10 分钟。
- **显存**：每帧多一份显存占用，若 OOM 就降低分辨率先跑通。
- **透明度**：`InspyrenetRembg` 输出带 alpha，但 **`h264-mp4` 不支持 alpha，透明区会被编码成黑色**。
  - 想要白底：在抠图后面接一个白底合成（如 `ImageConcanate` 垫白，或另建纯白 `EmptyImage` 走 `ImageCompositeMasked`），也可以导出后丢进剪辑软件/SHANA/AE 加白底，成本最低。
  - 想要真透明：改用支持 alpha 的输出（webm/vp9）或在剪辑软件里用 alpha 通道。
- **抖边处理**：抠像边缘逐帧抖动是 Rembg 类节点的通病。若明显，两个办法：
  1. 把 `RIFE VFI` 放在抠图**之前**（先插帧再抠，边缘更稳，但更慢）；
  2. 用 `VHS_VideoCombine` 的 `pix_fmt` 试 `yuv420p` 之外的选择，或在后期做边缘羽化。

### 5.4 更省算力的替代方案（方案 B）
不让每一帧都过抠图，而是**改造驱动视频**：
1. 先把驱动视频过一次抠图 + 白底/绿底合成，导出一个"纯背景版驱动视频"；
2. 用它替换 `VHS_LoadVideo #63` 的输入。

优点：生成阶段零额外开销。缺点：预处理要多跑一遍视频。
若驱动视频里人物一直全身可见、背景简单，方案 B 的性价比更高。

