# 健康监护概念演示

## 官网三个层次

1. 持续指标跟踪：6 岁儿童的 7 天模拟运动、膳食摄入估算、睡眠、户外自然光曲线。每图提供来源、单位、范围、日期与可展开的原始数据表。
2. 趋势与专业解读：结合公开指南解答每个趋势。日均活动 60 分钟，但仅 4/7 天达到 60 分钟；日均睡眠 8.6 小时，6/7 晚不足 9 小时。膳食日均估算 1,384 千卡只作饮食记录演示，不用固定热量判断儿童营养。户外日均约 46 分钟不等于紫外线剂量，不换算为维生素 D 水平或健康评分。
3. 特殊场景警告：剧烈活动、早餐待确认，并加入孩子主动表达头晕乏力，作为疑似低血糖等不适风险的情境示例。普通手表、手环、心率和饮食记录不用于确诊。提醒停止运动、由成年人立即陪同评估，持续或加重时就医，意识或呼吸异常时立即呼叫急救。

## 相册最新模拟记录

继续与真实本机数据隔离。示例展示心率、活动时长、身高、体重与孩子自述不适，不把早餐缺失记录当成没吃过。语音更新为叫叫音色的 `health-emergency-reminder.mp3`，以停止运动、请身边大人帮助为主，不引导不适时继续活动。

家长 Push 仅显示“已向家长发送紧急通知”，旁边注明“模拟状态”。去掉详细通知弹窗与发送体验按钮；实际没有注册推送或发送家长消息。真实健康连接器、持续监护和远程推送尚未上线。

## 内容依据

- CDC 6—17 岁儿童每日活动建议：https://www.cdc.gov/physical-activity-basics/guidelines/children.html
- CDC 6—12 岁睡眠 9—12 小时建议：https://www.cdc.gov/sleep/about/index.html
- AAP 家庭健康饮食：https://www.healthychildren.org/English/healthy-living/nutrition/Pages/Healthy-Active-Living-for-Families.aspx
- AAP 户外、防晒与高温防护：https://www.healthychildren.org/English/safety-prevention/at-play/Pages/Sun-Safety-and-Protection-Tips.aspx
- NIDDK 低血糖说明：https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia
- 叫叫台词与音色沿用钉钉权威「叫叫-IP设定资料」节点 `vy20BglGWOeD5vNmH1eKbR0mJA7depqY` 及既有语音配置。

## 验证

`src/library-demo-data.test.js` 检查排序、来源、不确定性和紧急通知模拟文案；`scripts/qa/health-demo.mjs` 检查桌面/移动相册的模拟隔离、实际音频播放与失败重试、简化通知状态、官网 4 张趋势图与对应解读、原始数据统计一致性及布局。相机/语音连接使用浏览器模拟，未进行真实健康设备接入或真实远程推送测试。
