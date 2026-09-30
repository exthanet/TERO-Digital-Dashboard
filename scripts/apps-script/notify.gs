/**
 * TERO Dashboard: sends the daily sync email.
 *
 * Setup (once, in the Google account that sends the mail):
 * 1. https://script.google.com → New project → paste this file.
 * 2. Project Settings → Script Properties → add NOTIFY_TOKEN = a long random
 *    string (the same value goes into the GitHub secret NOTIFY_TOKEN).
 * 3. Deploy → New deployment → type "Web app" · Execute as: Me ·
 *    Who has access: Anyone → Deploy → allow the permissions →
 *    copy the Web app URL into the GitHub secret NOTIFY_WEBHOOK_URL.
 *
 * The sync POSTs { token, to[], subject, html, text }. Requests without the
 * right token are refused; at most 10 recipients per mail.
 */
function doPost(e) {
  var out = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  try {
    var expected = PropertiesService.getScriptProperties().getProperty("NOTIFY_TOKEN");
    var body = JSON.parse(e.postData.contents);
    if (!expected || body.token !== expected) return out({ ok: false, error: "unauthorized" });
    var to = (body.to || []).filter(function (a) {
      return /^[^\s@,;<>]+@[^\s@,;<>]+\.[a-z]{2,}$/i.test(a);
    }).slice(0, 10);
    if (!to.length) return out({ ok: false, error: "no recipients" });
    MailApp.sendEmail({
      to: to.join(","),
      subject: String(body.subject || "TERO Dashboard sync").slice(0, 200),
      htmlBody: String(body.html || ""),
      body: String(body.text || ""),
      name: "TERO Dashboard",
    });
    return out({ ok: true, sent: to.length });
  } catch (err) {
    return out({ ok: false, error: String(err).slice(0, 200) });
  }
}
