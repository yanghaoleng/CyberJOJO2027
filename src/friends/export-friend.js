function wrap(context, value, width, maxLines = 5) {
  const lines = []; let line = "";
  for (const char of value) { if (context.measureText(line + char).width > width) { lines.push(line); line = char; } else line += char; }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}
export async function exportFriendCard(friend) {
  const url = URL.createObjectURL(friend.portraitBlob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1500;
    const context = canvas.getContext("2d");
    context.fillStyle = "#f7eedf"; context.fillRect(0, 0, 1080, 1500);
    context.fillStyle = "#26382c"; context.fillRect(38, 38, 1004, 60);
    context.fillStyle = "#fff8e9"; context.font = "24px sans-serif"; context.fillText("CYBERJOJO 2027  /  叫叫的朋友", 66, 78);
    context.save(); context.beginPath(); context.roundRect(38, 126, 1004, 750, 24); context.clip();
    const scale = Math.max(1004 / image.naturalWidth, 750 / image.naturalHeight);
    context.drawImage(image, 38 + (1004 - image.naturalWidth * scale) / 2, 126 + (750 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale); context.restore();
    context.fillStyle = "#9c7550"; context.font = "22px sans-serif"; context.fillText("HELLO, MY FRIEND", 64, 938);
    context.fillStyle = "#253629"; context.font = "bold 72px sans-serif";
    let nameSize = 72; while (context.measureText(friend.name).width > 936 && nameSize > 32) { nameSize -= 2; context.font = `bold ${nameSize}px sans-serif`; }
    context.fillText(friend.name, 64, 1032);
    context.fillStyle = "#7f786b"; context.font = "30px sans-serif"; context.fillText(friend.kind || "一个特别的朋友", 66, 1092);
    context.fillStyle = "#495043"; context.font = "32px sans-serif";
    wrap(context, friend.childDescription || "我们的小故事，从今天开始。", 940, 5).forEach((line, index) => context.fillText(line, 66, 1170 + index * 44));
    context.strokeStyle = "#cebfaa"; context.beginPath(); context.moveTo(64, 1410); context.lineTo(1016, 1410); context.stroke();
    context.fillStyle = "#7f786b"; context.font = "24px sans-serif"; context.fillText(`认识于 ${new Date(friend.createdAt).toLocaleDateString("zh-CN")}`, 64, 1458);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("图片没有导出成功")), "image/png"));
    const output = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = output; anchor.download = `${friend.name.replace(/[\\/:*?"<>|]/g, "")}-朋友名片.png`; anchor.click(); setTimeout(() => URL.revokeObjectURL(output), 1000);
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
