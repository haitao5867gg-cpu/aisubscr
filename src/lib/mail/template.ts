/** Site colors, inlined because mail clients ignore stylesheets. */
const COLOR = {
  canvas: "#f7f9fc",
  surface: "#ffffff",
  text: "#0f172a",
  muted: "#546278",
  primary: "#3b6fe0",
  cream: "#fff7e8",
  border: "#e2e8f0",
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function mailDocument(title: string, bodyHtml: string, footer: string) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>${safeTitle}</title></head>
<body style="margin:0;padding:24px 12px;background:${COLOR.canvas};color:${COLOR.text};font-family:PingFang SC,Hiragino Sans GB,Microsoft YaHei,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${COLOR.surface};border:1px solid ${COLOR.border};border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background:${COLOR.primary};color:#ffffff;padding:16px 24px;font-size:18px;font-weight:700;">aisubscr</td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;">${safeTitle}</h1>
        <div style="font-size:15px;line-height:1.7;">${bodyHtml}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:${COLOR.cream};color:${COLOR.muted};font-size:12px;line-height:1.6;">${escapeHtml(footer)}</td>
    </tr>
  </table>
</body>
</html>`;
}

export function paragraph(text: string) {
  return `<p style="margin:0 0 12px;">${escapeHtml(text)}</p>`;
}
