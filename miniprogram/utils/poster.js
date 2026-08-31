// 趋势分享海报绘制（canvas 2d，固定浅色卡片，分享场景不受主题影响）
// 图表优先直接嵌入页面当前趋势图截图（所见即所得，含所选时间段与日期轴）

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function fmtDate(d) {
  const p = String(d).split('-');
  return p.length === 3 ? Number(p[1]) + '/' + Number(p[2]) : String(d);
}

function drawPoster(canvas, dpr, data, qrImg, chartImg) {
  const W = 750;
  const H = 1080;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 背景与卡片
  ctx.fillStyle = '#F8FAF9';
  ctx.fillRect(0, 0, W, H);
  roundRect(ctx, 40, 40, W - 80, H - 80, 32, '#FFFFFF');

  // 品牌区
  ctx.fillStyle = '#22C55E';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('轻体日记', 80, 140);
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '24px sans-serif';
  ctx.fillText('体重趋势' + (data.rangeLabel ? ' · ' + data.rangeLabel : ''), 80, 180);

  // 主数字
  ctx.fillStyle = '#1F2937';
  ctx.font = 'bold 96px sans-serif';
  const curText = String(data.currentWeight);
  ctx.fillText(curText, 80, 310);
  ctx.fillStyle = '#6B7280';
  ctx.font = '28px sans-serif';
  ctx.fillText(data.unit, 80 + curText.length * 56 + 12, 310);

  // 统计行
  ctx.fillStyle = '#6B7280';
  ctx.font = '26px sans-serif';
  ctx.fillText('已减 ' + data.totalLost + ' ' + data.unit + '    连续打卡 ' + data.streak + ' 天', 80, 360);

  // 趋势图区域
  const cx = 80, cy = 410, cw = W - 160, ch = 400;
  if (chartImg) {
    // 直接嵌入页面趋势图（含日期轴与所选时间段）
    ctx.drawImage(chartImg, cx - 20, cy - 20, cw + 40, ch);
  } else {
    drawFallbackChart(ctx, data, cx, cy, cw, ch);
  }

  // 底部：小程序码 + 标语
  const footY = H - 250;
  if (qrImg) {
    const qs = 160;
    const qx = W - 80 - qs;
    const qy = footY;
    roundRect(ctx, qx - 10, qy - 10, qs + 20, qs + 20, 20, '#F8FAF9');
    ctx.drawImage(qrImg, qx, qy, qs, qs);
    ctx.fillStyle = '#6B7280';
    ctx.font = '24px sans-serif';
    ctx.fillText('长按识别小程序码', qx - 8, qy + qs + 40);
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('每天进步一点点', 80, footY + 50);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '24px sans-serif';
    ctx.fillText('扫码开始记录你的减脂之旅', 80, footY + 95);
    ctx.fillStyle = '#22C55E';
    ctx.fillText('轻体日记 · 体重管理助手', 80, footY + 140);
  } else {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '24px sans-serif';
    ctx.fillText('每天进步一点点 · 轻体日记', 80, H - 90);
    ctx.fillStyle = '#22C55E';
    ctx.fillText('保存分享给朋友吧', W - 80 - 200, H - 90);
  }
}

// 兜底自绘图表（截图失败时）：标签错位问题已修（min 值放左下，X 轴抽稀保间距）
function drawFallbackChart(ctx, data, cx, cy, cw, ch) {
  const pts = data.points || [];
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  for (let i = 0; i < 4; i++) {
    const y = cy + (ch / 3) * i;
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(cx + cw, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  if (pts.length < 2) {
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '26px sans-serif';
    ctx.fillText('记录还不够，先打卡几天再来分享吧～', cx, cy + ch / 2);
    return;
  }
  const vals = pts.map(p => p.v);
  const min = Math.min.apply(null, vals);
  const max = Math.max.apply(null, vals);
  const span = max - min || 1;
  const xy = pts.map((p, i) => ({
    x: cx + (cw / (pts.length - 1)) * i,
    y: cy + ch - ((p.v - min) / span) * (ch - 60) - 30
  }));

  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  xy.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.fillStyle = '#22C55E';
  xy.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // Y 轴数值：都放左侧，避免与 X 轴日期相撞
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '22px sans-serif';
  ctx.fillText(max.toFixed(1), cx, cy - 8);
  ctx.fillText(min.toFixed(1), cx, cy + ch + 24);

  // X 轴日期：抽稀 + 最小间距保护
  const stepN = Math.max(1, Math.ceil(pts.length / 5));
  let lastRight = -1;
  pts.forEach((p, i) => {
    if (i % stepN !== 0 && i !== pts.length - 1) return;
    const label = fmtDate(p.d);
    const w = label.length * 12;
    let x = xy[i].x - w / 2;
    x = Math.max(cx, Math.min(x, cx + cw - w));
    if (x < lastRight + 16) return;
    ctx.fillText(label, x, cy + ch + 52);
    lastRight = x + w;
  });
}

module.exports = { drawPoster };
