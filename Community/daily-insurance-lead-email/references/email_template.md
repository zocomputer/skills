# Email Template - Manus Video Promotion

## 主旨
【廣東話】Manus太貴？接近零成本取代工具，我每日都用緊！

## HTML Email

```html
<!DOCTYPE html>
<html lang="zh-HK">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; font-family: Arial, 'Microsoft JhengHei', 'PingFang HK', sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
<tr>
<td align="center" style="padding:20px 0;">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; max-width:600px;">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding:30px; text-align:center;">
<h1 style="color:#f5c842; margin:0; font-size:24px;">🦁 AI Lion 一人公司</h1>
<p style="color:#ffffff; margin:8px 0 0 0; font-size:14px; opacity:0.85;">廣東話 AI 商業策略頻道</p>
</td>
</tr>

<!-- Video Thumbnail -->
<tr>
<td style="padding:20px 20px 10px 20px; text-align:center;">
<a href="{{video_url}}" target="_blank">
<img src="cid:manus_thumbnail" alt="{{video_title}}" style="width:100%; max-width:560px; border-radius:6px; display:block; margin:0 auto;">
</a>
</td>
</tr>

<!-- Video Title & Description -->
<tr>
<td style="padding:10px 20px 20px 20px;">
<h2 style="color:#1a1a2e; margin:0 0 12px 0; font-size:20px; line-height:1.4;">
🎬 {{video_title}}
</h2>
<p style="color:#555555; font-size:15px; line-height:1.7; margin:0 0 16px 0;">
Manus 係近期好多人討論嘅 AI Agent 工具，但月費要成 $39 美金，真係唔少錢。
</p>
<p style="color:#555555; font-size:15px; line-height:1.7; margin:0 0 16px 0;">
今集我分享一個我每日都用緊嘅 <strong>接近零成本取代方案</strong>，功能一樣強大，仲唔使每月畀錢。
</p>
<p style="color:#555555; font-size:15px; line-height:1.7; margin:0 0 16px 0;">
如果你想用 AI 幫手做自動化、搵客、做 content，但又唔想畀咁多錢，呢條片一定要睇。
</p>

<!-- CTA Button -->
<table cellpadding="0" cellspacing="0" style="margin:20px auto;">
<tr>
<td style="background-color:#f5c842; border-radius:6px; text-align:center;">
<a href="{{video_url}}" target="_blank" style="display:inline-block; padding:14px 36px; color:#1a1a2e; text-decoration:none; font-size:16px; font-weight:bold;">🎥 立即觀看影片</a>
</td>
</tr>
</table>
</td>
</tr>

<!-- Divider -->
<tr>
<td style="padding:0 20px;">
<hr style="border:none; border-top:1px solid #eeeeee; margin:0;">
</td>
</tr>

<!-- Channel Info -->
<tr>
<td style="padding:20px;">
<h3 style="color:#1a1a2e; margin:0 0 12px 0; font-size:16px;">📺 關於 AI Lion一人公司</h3>
<p style="color:#555555; font-size:14px; line-height:1.6; margin:0 0 12px 0;">
我叫布Sir，Lion AI 創辦人，25+ 年 marketing 實戰經驗，近三年舉辦過百場 AI 講座及 Workshop，已培訓超過 10,000 名學員用 AI 落地變現。
</p>
<p style="color:#555555; font-size:14px; line-height:1.6; margin:0 0 12px 0;">
呢個頻道唔係齋教工具，係教 <strong>Business Model、Strategy、點樣將 AI 變成真實利潤</strong>。AI Agent、自動化工作流、一人公司建立全流程——全部廣東話、全部實戰。
</p>
<p style="color:#555555; font-size:14px; line-height:1.6; margin:0;">
📍 YouTube 頻道：<a href="{{channel_url}}" target="_blank" style="color:#f5c842; text-decoration:underline;">{{channel_url}}</a><br>
🔗 官網：<a href="{{website}}" target="_blank" style="color:#f5c842; text-decoration:underline;">{{website}}</a><br>
🏫 一人公司 2.0 課程：<a href="{{course_url}}" target="_blank" style="color:#f5c842; text-decoration:underline;">{{course_url}}</a><br>
🌐 HK AI Club：<a href="{{hkai_club}}" target="_blank" style="color:#f5c842; text-decoration:underline;">{{hkai_club}}</a>
</p>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#1a1a2e; padding:20px; text-align:center;">
<p style="color:#aaaaaa; font-size:11px; margin:0 0 4px 0;">
如有查詢，請回覆此電郵或聯絡：<a href="mailto:bruce@lion88.ai" style="color:#f5c842;">bruce@lion88.ai</a>
</p>
<p style="color:#777777; font-size:10px; margin:0;">
© 2026 AI Lion. All rights reserved.
</p>
</td>
</tr>

</table>
</td>
</tr>
</table>
</body>
</html>
```

## 變數說明
- `{{video_url}}` — YouTube 影片連結
- `{{video_title}}` — 影片標題
- `{{channel_url}}` — YouTube 頻道連結
- `{{website}}` — 官網
- `{{course_url}}` — 課程連結
- `{{hkai_club}}` — HK AI Club
- `cid:manus_thumbnail` — 內嵌圖片（影片封面）
