# Rive 精简盘点 · 2026-09-11

结论：当前主相机通过代码直接播放时间轴，不使用 Rive 状态机及其输入；喂食的眼神、头部、张嘴和咀嚼由代码叠加节点姿态。资源陈列页可手动预览全部动画/状态机，这是预览能力，不是业务依赖。

本次读取仓库原始二进制，并在项目锁定的 Canvas 2.40.1 运行时枚举画板、时间轴、状态机、输入和内嵌资源。线上资源清单 SHA-256 与本地两文件相同，线上代码为 `14ec07b238a1a8fc14831604ecfd1e1f4e0a1a19`。未修改或重新导出 Rive；以下是针对本项目导出副本的候选清单，不判定其他产品对原文件的依赖。

## 建议的两轮精简

| 文件 | 当前时间轴 | 状态机 | 保留当前随机表情的第一轮 | 更精简的第二轮 |
| --- | ---: | ---: | --- | --- |
| 叫叫 | 99 | 1 | 保留 39 条，60 条未调用候选 | 保守保留 13 条；额外 26 条可选 |
| 绿豆 | 88 | 1 | 保留 40 条，48 条未调用候选 | 保守保留同样 13 条；额外 27 条可选 |

先保留源工程备份，在本项目专用导出副本清理状态机和未调用时间轴。第二轮只在接受随机表情种类减少时进行；这两轮数字是时间轴数量，不能换算成文件体积降幅。删除前检查编辑器中的状态机、约束和组件引用；导出后需逐项播放和叠加回归，才可替换线上文件。

## 13 条保守保留清单

| 时间轴原名 | 当前用途 |
| --- | --- |
| `Ipad` | 构图定位；所有设备都会叠加，并应用末帧，手机也不能改成 Phone。 |
| `Start_Dial` | 首次出场及自动轮播。 |
| `Talking_Normal` | 语音口型；叫叫喂食还采样 0.5 秒处的张嘴姿态。 |
| `Talking_Normal_close` | 叫叫喂食采样 0 秒闭嘴姿态并用于复位；绿豆共用适配器加载时也读取，但当前不支持喂食，可先为统一接口保留。 |
| `TalkingEmotion_Normal` | 退出玩法后的普通状态；资源页默认预览。 |
| `TalkingEmotion_Expectation` | 进入玩法时的期待动作。 |
| `TalkingEmotion_Think` | 思考回应及优先轮播。 |
| `TalkingEmotion_Praise` | 点击夸夸、点赞手势、语音/AI 反应。 |
| `TalkingEmotion_Happy` | 开心、比耶、比心及 AI 反应。 |
| `TalkingEmotion_Surprised` | 惊讶反应。 |
| `TalkingEmotion_Frighten` | 受惊反应。 |
| `TalkingEmotion_Curious` | 好奇反应。 |
| `TalkingEmotion_Sure` | OK 手势回应。 |

这 13 条是两份文件统一的保守交付接口，不是绿豆理论上的绝对最小值：`Talking_Normal_close` 在绿豆适配器初始化时被读取，但当前喂食仅开放叫叫；如果单独做绿豆极简版，可进一步评估移除此项。其他 12 条有实际播放用途。

## 不能误删的自动轮播

`src/App.jsx:2224` 动态收集所有以 `TalkingEmotion` 开头且不以 `表情` 结尾的时间轴，`src/App.jsx:2321` 在当前动画停止/循环后随机切换。带 `_v2`、`2`、`beifen`、`无调整` 的名称仍可能进入播放池，不能仅因名字像备份就判为未使用。删掉下文“可选”动画会减少随机表现；保留明确调用的 13 条时，当前动态池会适应剩余名单。

## 状态机与输入

### 叫叫：`ai叫叫动画状态机`

主相机未启用此状态机，也没有写入下列输入。项目专用导出副本中可作为清理候选；移除后资源页不再提供此状态机的预览选项。

| 输入原名 | 类型 |
| --- | --- |
| `FaceTracking_switch` | Boolean |
| `CanvasSize` | Number |
| `FaceTracking_Y` | Number |
| `FaceTracking_X` | Number |
| `TalkingEmotion` | Number |
| `TalkingEmotion_switch` | Trigger |
| `StateSwitching` | Boolean |
| `SpecialTrigger` | Number |
| `Talk` | Boolean |
| `v2` | Trigger |
| `v1` | Trigger |

### 绿豆：`ai绿豆动画状态机`

主相机未启用此状态机，也没有写入下列输入。项目专用导出副本中可作为清理候选；移除后资源页不再提供此状态机的预览选项。

| 输入原名 | 类型 |
| --- | --- |
| `CanvasSize` | Number |
| `TalkingEmotion` | Number |
| `TalkingEmotion_switch` | Trigger |
| `StateSwitching` | Boolean |
| `SpecialTrigger` | Number |
| `Talk` | Boolean |
| `v2` | Trigger |
| `v1` | Trigger |

## 各文件的完整分类

### 叫叫 · `jiaojiao.riv`

- 文件：10,399,115 字节，约 9.92 MiB。
- 单一画板：`叫叫`，2048 × 1664，`frameOrigin=true`。
- SHA-256：`203a6f992698be770a4b49fb42f2632f095cef22490fa426bf933ed37c929233`。

**可选：当前参与自动轮播的额外 26 条**

```text
TalkingEmotion_Smile
TalkingEmotion_Beckoning
TalkingEmotion_Focused
TalkingEmotion_Silent
TalkingEmotion_Serious
TalkingEmotion_Proud
TalkingEmotion_Doubt
TalkingEmotion_Excited
TalkingEmotion_Encourage
TalkingEmotion_Shake
TalkingEmotion_Nervous
TalkingEmotion_Sad
TalkingEmotion_Normal_无调整
TalkingEmotion_Regret
TalkingEmotion_Grievance
TalkingEmotion_Think_v2
TalkingEmotion_Concerned
TalkingEmotion_Focused_v2
TalkingEmotion_Happy_v2
TalkingEmotion_Amazed
TalkingEmotion_Superexcited
TalkingEmotion_Entangled
TalkingEmotion_Excited_v2
TalkingEmotion_Envy
TalkingEmotion_Surprised_v2
TalkingEmotion_Curious_v2
```

**未调用候选：表情姿态 33 条**

这些带“表情”后缀的时间轴被主应用的筛选规则明确排除；若保留原状态机，则不能忽略其内部依赖。

```text
TalkingEmotion_Smile_表情
TalkingEmotion_Beckoning_表情
TalkingEmotion_Focused_表情
TalkingEmotion_Think_表情
TalkingEmotion_Happy_表情
TalkingEmotion_Silent_表情
TalkingEmotion_Serious_表情
TalkingEmotion_Proud_表情
TalkingEmotion_Doubt_表情
TalkingEmotion_Excited_表情
TalkingEmotion_Curious_表情
TalkingEmotion_Surprised_表情
TalkingEmotion_Encourage_表情
TalkingEmotion_Praise_表情
TalkingEmotion_Shake_表情
TalkingEmotion_Nervous_表情
TalkingEmotion_Sad_表情
TalkingEmotion_Expectation_表情
TalkingEmotion_Think_v2_表情
TalkingEmotion_Regret_表情
TalkingEmotion_Concerned_表情
TalkingEmotion_Focused_v2_表情
TalkingEmotion_Grievance_表情
TalkingEmotion_Amazed_表情
TalkingEmotion_Happy_v2_表情
TalkingEmotion_Excited_v2_表情
TalkingEmotion_Entangled_表情
TalkingEmotion_Superexcited_表情
TalkingEmotion_Surprised_v2_表情
TalkingEmotion_Sure_表情
TalkingEmotion_Curious_v2_表情
TalkingEmotion_Frighten_表情
TalkingEmotion_Envy_表情
```

**未调用候选：其他时间轴**

```text
Phone
Empty
Listening_Normal_无调整
NoTracking
FaceTracking_X_max
FaceTracking_X_min
FaceTracking_Y_max
FaceTracking_Y_min
IPadSize_max
IPadSize_min
Talking_Empty
eyeball_track_Y
eyeball_track_X
Start_Answer
face_track_Y
Listening_Normal
Listening_Normal_NEW
face_track_X
eyeball_Y
Thinking_Normal_in
Thinking_Normal_loop
Thinking_Normal_NEW
eyeball_X
face_Y
face_X
Exit_Normal
Exit_Normal 2
```

### 绿豆 · `lvdou.riv`

- 文件：1,632,399 字节，约 1.56 MiB。
- 单一画板：`绿豆`，2048 × 1664，`frameOrigin=true`。
- SHA-256：`cb114cd3107aecf2cf9d5ee71d5f9a3f688dd2379c8ae6394862bac4b00de4fe`。

**可选：当前参与自动轮播的额外 27 条**

```text
TalkingEmotion_Normalbeifen
TalkingEmotion_Silent
TalkingEmotion_Doubt
TalkingEmotion_Encourage
TalkingEmotion_Normal_2
TalkingEmotion_Witty
TalkingEmotion_Sad
TalkingEmotion_Concerned
TalkingEmotion_Excited
TalkingEmotion_Serious
TalkingEmotion_Naughty‌
TalkingEmotion_Naughty2
TalkingEmotion_Focused
TalkingEmotion_Focused2
TalkingEmotion_Think2
TalkingEmotion_Happy2
TalkingEmotion_Proud2
TalkingEmotion_Proud
TalkingEmotion_Praise2
TalkingEmotion_Superexcited
TalkingEmotion_Curious2
TalkingEmotion_Confused
TalkingEmotion_Low
TalkingEmotion_Smile
TalkingEmotion_Amazed
TalkingEmotion_Entangled
TalkingEmotion_Shake
```

**未调用候选：表情姿态 33 条**

这些带“表情”后缀的时间轴被主应用的筛选规则明确排除；若保留原状态机，则不能忽略其内部依赖。

```text
TalkingEmotion_Silent_表情
TalkingEmotion_Doubt_表情
TalkingEmotion_Surprised_表情
TalkingEmotion_Encourage_表情
TalkingEmotion_Witty_表情
TalkingEmotion_Sad_表情
TalkingEmotion_Expectation_表情
TalkingEmotion_Concerned_表情
TalkingEmotion_Excited_表情
TalkingEmotion_Serious_表情
TalkingEmotion_Naughty‌_表情
TalkingEmotion_Naughty2_表情
TalkingEmotion_Focused_表情
TalkingEmotion_Focused2_表情
TalkingEmotion_Think_表情
TalkingEmotion_Think2_表情
TalkingEmotion_Happy_表情
TalkingEmotion_Happy2_表情
TalkingEmotion_Proud2_表情
TalkingEmotion_Proud_表情
TalkingEmotion_Praise_表情
TalkingEmotion_Praise2_表情
TalkingEmotion_Curious_表情
TalkingEmotion_Superexcited_表情
TalkingEmotion_Curious2_表情
TalkingEmotion_Confused_表情
TalkingEmotion_Low_表情
TalkingEmotion_Smile_表情
TalkingEmotion_Frighten_表情
TalkingEmotion_Amazed_表情
TalkingEmotion_Sure_表情
TalkingEmotion_Entangled_表情
TalkingEmotion_Shake_表情
```

**未调用候选：其他时间轴**

```text
Phone
Empty
Talking_Empty
眨眼
Start_Answer
Listening_Normal
Listening_Normal_NEW
Thinking_Normal_in
Thinking_Normal_loop
Thinking_Normal_NEW
Exit_Normal
Exit_Normal 2
NoTracking
IPadSize_max
IPadSize_min
```

注意：`TalkingEmotion_Naughty‌` 含 U+200C 零宽字符。上方名单保留了原名，重命名应统一处理，不要误以为两条同名。

## 节点、坐标及关键帧约定

叫叫以下 4 个节点通过名称直接查找，必须保留节点及 Export name：

```text
controller_eyeball_location
controller_faceq
IP_CJ_mouth_Y
IP_CJ_mouth1
```

分别用于眼球、头部、嘴部缩放和嘴位命中定位。绿豆当前文件没有这些节点，不能用改名方式“清理”叫叫的对应节点。

`Talking_Normal` 的 0.5 秒姿态用于张嘴；`Talking_Normal_close` 的 0 秒姿态用于闭嘴。`Ipad` 在播放时会被采样到末帧作为定位基准，即使是 iPhone 也在使用。不要随意裁掉这些采样点、改变有效播放区间、移除动作自身的姿态关键帧、改变画板大小/原点或对象父子层级。

当前没有单独名为“咀嚼”的 Rive 时间轴：咀嚼使用嘴部节点缩放与头部轻动计算，不要为了找“咀嚼动画”而保留未调用的听说状态机。

## 文件减重优先级

运行时资源加载器统计到：叫叫只有一个 260 字节的内嵌图片；绿豆只有一个 18,092 字节的内嵌图片；没有回调到字体或音频资产。它们不是当前文件体积的大头。优先检查冗余时间轴、重复关键帧、复杂矢量/骨骼数据，再考虑导出名称；暂未对二进制中的关键帧/几何分别做字节归因，也没有预测精简后的体积。

只保留业务需要的节点名称可以减少导出数据，但上述 4 个查找节点不能关闭名称导出。其余节点本体仍可能是角色图形或绑定依赖，不能把“不导出名称”等同于“删除节点”。

## 精简文件交付后应验证

1. 首次加载、角色切换、封面和相机自动轮播。
2. 点击夸夸、点赞、比耶、OK、比心；语音/AI 的六种反应。
3. 语音口型叠加与停止；进入玩法的期待和退出后的普通状态。
4. 叫叫喂食：眼神/头部跟随、张嘴、咀嚼、复位及嘴位命中。
5. 手机/平板横竖屏构图、照片/录像动画定格、资源页剩余动画预览。
6. 两文件体积对比、资源清单及版本缓存更新。

## 依据

- `src/App.jsx:342`：语音和手势明确调用表。
- `src/App.jsx:381`：定位、默认动画、口型约定。
- `src/App.jsx:2224`：动态时间轴筛选。
- `src/App.jsx:2298`：叠加 Ipad 与当前动作，定位末帧。
- `src/App.jsx:2321`：自动随机轮播。
- `src/App.jsx:3476`：玩法进入/退出动作。
- `src/character-interaction.js:49`：命名节点和开闭嘴姿态。
- `src/assets-gallery/AssetsGallery.jsx:62`：资源页列出全部动画/状态机。
- [Rive 导出名称规则](https://rive.app/docs/editor/exporting/exporting-for-runtime)。
- [Rive 文件优化建议](https://rive.app/docs/getting-started/best-practices)。
