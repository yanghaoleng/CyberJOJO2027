# Rive 替换验证与直接删除清单 · 2026-09-11

基于赛博叫叫 2027 当前代码（14ec07b）及本次下载的 48n / 4KM 文件。这里的“可删”指从本项目专用 Rive 导出副本删除对应状态机、时间轴，保留其余时间轴与画面对象；资源页会相应减少这些预览选项。当前没有实际删除 Rive 内部内容。

## 替换结果

- **叫叫 48n：不能直接替换。** 文件可以加载，但默认画面、出场、普通表情、叠加说话口型时都没有五官。Canvas 与 WebGL2 2.40.1 均复现，启动原状态机也没有恢复。保留当前正常叫叫。运行结果不能判定源工程里究竟是图层隐藏、图形遗漏还是导出问题，需要回源工程修复后重新导出。
- 48n 从旧版 99 条变成 47 条时间轴，缺少 4 条功能接口，当前喂食适配器检测到 mouth=false、chewing=false；还少了 14 条原有随机表情。体积从 10,399,115 降至 6,448,754 字节，但当前画面和能力有损失。
- **绿豆 4KM：已完成本地替换。** 两种渲染器下五官与说话口型正常，88 条时间轴及状态机输入名单与旧版一致；当前保留的 40 条时间轴均已抽帧检查。资源页可载入 88 条动画和 1 个状态机，文件来源及缓存版本已更新，构建通过。1,632,399 → 1,465,175 字节，减少约 10.2%。绿豆当前仍不提供喂食，本次文件也没有叫叫的 4 个喂食控制节点。
- 本次为本地替换验证，**尚未提交、推送或部署**。

源文件：[叫叫 48n](https://rive.mikeywa.site/48n)、[绿豆 4KM](https://rive.mikeywa.site/4KM)。

## 叫叫 48n：直接删除 1 个状态机 + 26 条时间轴

先删除 **ai叫叫动画状态机**（连同其全部输入、状态与转换），再删除以下时间轴。主相机不启用这个状态机，也不写入它的输入；以下 26 条没有进入当前业务播放池。

- `Phone`
- `Empty`
- `Exit_Normal 2`
- `Exit_Normal`
- `Thinking_Normal_loop`
- `Thinking_Normal_NEW`
- `Thinking_Normal_in`
- `Listening_Normal_NEW`
- `Listening_Normal`
- `Start_Answer`
- `NoTracking`
- `FaceTracking_X_max`
- `FaceTracking_X_min`
- `FaceTracking_Y_max`
- `FaceTracking_Y_min`
- `IPadSize_max`
- `IPadSize_min`
- `Talking_Empty`
- `eyeball_track_Y`
- `eyeball_track_X`
- `face_track_Y`
- `face_track_X`
- `eyeball_Y`
- `eyeball_X`
- `face_Y`
- `face_X`

这份文件删除后剩 21 条，但它本来就缺功能，**不能把剩 21 条当成合格交付版**。

必须补回以下 4 条，并恢复完整五官：

- `Talking_Normal_close`：叫叫喂食闭嘴、复位；缺失时现有适配器同时禁用张嘴和咀嚼。
- `TalkingEmotion_Expectation`：进入玩法。
- `TalkingEmotion_Frighten`：受惊反应。
- `TalkingEmotion_Sure`：OK 手势回应。

若要保持当前叫叫的随机表情种类，还需从旧版补回下列 14 条；这些不属于“未使用可删”项：

- `TalkingEmotion_Normal_无调整`
- `TalkingEmotion_Regret`
- `TalkingEmotion_Grievance`
- `TalkingEmotion_Think_v2`
- `TalkingEmotion_Concerned`
- `TalkingEmotion_Focused_v2`
- `TalkingEmotion_Happy_v2`
- `TalkingEmotion_Amazed`
- `TalkingEmotion_Superexcited`
- `TalkingEmotion_Entangled`
- `TalkingEmotion_Excited_v2`
- `TalkingEmotion_Envy`
- `TalkingEmotion_Surprised_v2`
- `TalkingEmotion_Curious_v2`

补回上述 18 条后，保留总数为 39 条，与当前叫叫的实际使用范围一致。仅补 4 条接口则为 25 条，随机表现会比当前减少。

## 绿豆 4KM：直接删除 1 个状态机 + 48 条时间轴

先删除 **ai绿豆动画状态机**（连同其全部输入、状态与转换），再删除下列 48 条。删除后保留 40 条，保持当前随机表情种类。

- `Phone`
- `TalkingEmotion_Silent_表情`
- `Empty`
- `Talking_Empty`
- `TalkingEmotion_Doubt_表情`
- `TalkingEmotion_Surprised_表情`
- `TalkingEmotion_Encourage_表情`
- `眨眼`
- `Start_Answer`
- `Listening_Normal`
- `Listening_Normal_NEW`
- `Thinking_Normal_in`
- `Thinking_Normal_loop`
- `Thinking_Normal_NEW`
- `Exit_Normal`
- `Exit_Normal 2`
- `TalkingEmotion_Witty_表情`
- `TalkingEmotion_Sad_表情`
- `TalkingEmotion_Expectation_表情`
- `TalkingEmotion_Concerned_表情`
- `TalkingEmotion_Excited_表情`
- `TalkingEmotion_Serious_表情`
- `TalkingEmotion_Naughty\u200c_表情`
- `NoTracking`
- `TalkingEmotion_Naughty2_表情`
- `TalkingEmotion_Focused_表情`
- `TalkingEmotion_Focused2_表情`
- `TalkingEmotion_Think_表情`
- `IPadSize_max`
- `IPadSize_min`
- `TalkingEmotion_Think2_表情`
- `TalkingEmotion_Happy_表情`
- `TalkingEmotion_Happy2_表情`
- `TalkingEmotion_Proud2_表情`
- `TalkingEmotion_Proud_表情`
- `TalkingEmotion_Praise_表情`
- `TalkingEmotion_Praise2_表情`
- `TalkingEmotion_Curious_表情`
- `TalkingEmotion_Superexcited_表情`
- `TalkingEmotion_Curious2_表情`
- `TalkingEmotion_Confused_表情`
- `TalkingEmotion_Low_表情`
- `TalkingEmotion_Smile_表情`
- `TalkingEmotion_Frighten_表情`
- `TalkingEmotion_Amazed_表情`
- `TalkingEmotion_Sure_表情`
- `TalkingEmotion_Entangled_表情`
- `TalkingEmotion_Shake_表情`

注：`TalkingEmotion_Naughty\u200c_表情` 中的 `\u200c` 是显式标注，原名在 Naughty 后实际含一个不可见的 U+200C 字符；按原文件完整名称定位，仅删除带“_表情”后缀的这一条，保留不带后缀的动作。

## 不要误删的内容

两角色统一保留以下 13 条接口（叫叫新文件缺的 4 条需要补回）。绿豆的 `Talking_Normal_close` 当前由共用适配器读取，为保持现有接口本轮保留。

- `Ipad`
- `Start_Dial`
- `Talking_Normal`
- `Talking_Normal_close`
- `TalkingEmotion_Normal`
- `TalkingEmotion_Expectation`
- `TalkingEmotion_Think`
- `TalkingEmotion_Praise`
- `TalkingEmotion_Happy`
- `TalkingEmotion_Surprised`
- `TalkingEmotion_Frighten`
- `TalkingEmotion_Curious`
- `TalkingEmotion_Sure`

- 所有其他以 `TalkingEmotion` 开头、且不以“表情”结尾的现存时间轴都保留：当前代码会自动将它们放入随机播放池。带 v2、2、beifen、无调整的名称也不能仅凭名字删除。
- `Ipad` 用于所有设备的构图，iPhone 也使用它；可删除的是 `Phone`。
- 叫叫保留 `controller_eyeball_location`、`controller_faceq`、`IP_CJ_mouth_Y`、`IP_CJ_mouth1` 四个节点和导出名称，保留其父子层级、约束和被控制的五官图形。
- 保留 `Talking_Normal` 在 0.5 秒的张嘴姿态、`Talking_Normal_close` 在 0 秒的闭嘴姿态。不要在精简时改变这两个采样点的含义。
- 本清单不授权按同名去删图层、骨骼、约束、图片或字体。删除时间轴不等于删除被它控制的画面对象。精简后的导出文件仍需重新检查出场、表情、说话和叫叫喂食，再替换线上资源。

## 如果从当前正常叫叫旧版精简：用这份 60 条清单

当前继续使用的叫叫文件 SHA-256 以 `203a6f99` 开头，共 99 条时间轴。删除 **ai叫叫动画状态机** 和下列 60 条，剩下 39 条，保留现有功能及随机表情。**此清单与上面的 48n 清单是两个不同版本，不要把数量相加。**

- `Phone`
- `TalkingEmotion_Smile_表情`
- `TalkingEmotion_Beckoning_表情`
- `TalkingEmotion_Focused_表情`
- `TalkingEmotion_Think_表情`
- `TalkingEmotion_Happy_表情`
- `TalkingEmotion_Silent_表情`
- `TalkingEmotion_Serious_表情`
- `TalkingEmotion_Proud_表情`
- `Empty`
- `TalkingEmotion_Doubt_表情`
- `TalkingEmotion_Excited_表情`
- `TalkingEmotion_Curious_表情`
- `TalkingEmotion_Surprised_表情`
- `TalkingEmotion_Encourage_表情`
- `TalkingEmotion_Praise_表情`
- `TalkingEmotion_Shake_表情`
- `TalkingEmotion_Nervous_表情`
- `TalkingEmotion_Sad_表情`
- `Listening_Normal_无调整`
- `NoTracking`
- `FaceTracking_X_max`
- `FaceTracking_X_min`
- `FaceTracking_Y_max`
- `FaceTracking_Y_min`
- `IPadSize_max`
- `IPadSize_min`
- `Talking_Empty`
- `eyeball_track_Y`
- `eyeball_track_X`
- `Start_Answer`
- `TalkingEmotion_Expectation_表情`
- `face_track_Y`
- `Listening_Normal`
- `TalkingEmotion_Think_v2_表情`
- `TalkingEmotion_Regret_表情`
- `Listening_Normal_NEW`
- `face_track_X`
- `TalkingEmotion_Concerned_表情`
- `eyeball_Y`
- `Thinking_Normal_in`
- `TalkingEmotion_Focused_v2_表情`
- `Thinking_Normal_loop`
- `TalkingEmotion_Grievance_表情`
- `Thinking_Normal_NEW`
- `eyeball_X`
- `TalkingEmotion_Amazed_表情`
- `TalkingEmotion_Happy_v2_表情`
- `face_Y`
- `TalkingEmotion_Excited_v2_表情`
- `TalkingEmotion_Entangled_表情`
- `face_X`
- `Exit_Normal`
- `TalkingEmotion_Superexcited_表情`
- `TalkingEmotion_Surprised_v2_表情`
- `TalkingEmotion_Sure_表情`
- `Exit_Normal 2`
- `TalkingEmotion_Curious_v2_表情`
- `TalkingEmotion_Frighten_表情`
- `TalkingEmotion_Envy_表情`

## 文件校验

- 叫叫 48n：`159b2797c12c283d1b3565dc03c49d774932578265955cdb39bac22b29bce1a5`。
- 绿豆 4KM：`b7105cd123574ff3e611d2364296a37927a14d9807db845756edc612870ea6db`。
