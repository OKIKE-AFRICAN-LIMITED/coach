/**
 * OKIKE Multi-Platform Embeddable Agent Widget (v1.0)
 * Drop onto any OKIKE website:
 * <script src="https://your-domain.com/okike-widget.js"
 *   data-api-url="http://localhost:8000"
 *   data-api-key="YOUR_OKIKE_PLATFORM_API_KEY"
 *   data-user-id="YOUR_SUPABASE_USER_ID"
 *   data-platform="okike-web">
 * </script>
 */
(function () {
  if (window.__OKIKE_WIDGET_LOADED__) return;
  window.__OKIKE_WIDGET_LOADED__ = true;

  var script = document.currentScript || document.querySelector('script[src*="okike-widget.js"]');
  var apiUrl = (script && script.getAttribute("data-api-url")) || "https://coach-4waf.onrender.com";
  var apiKey = (script && script.getAttribute("data-api-key")) || "okike-live-secret-2026";
  var userId = (script && script.getAttribute("data-user-id")) || "3206f2b2-c05d-485c-9361-ee0946a7efb1";
  var platform = (script && script.getAttribute("data-platform")) || window.location.hostname || "okikeenterprises.com";

  var container = document.createElement("div");
  container.id = "okike-ziri-widget";
  container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:999999;font-family:system-ui,-apple-system,sans-serif;";

  var panel = document.createElement("div");
  panel.style.cssText =
    "display:none;width:340px;height:440px;background:#0F111A;border:1px solid rgba(212,175,55,0.4);border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.7);flex-direction:column;overflow:hidden;margin-bottom:12px;color:#F3F4F6;";

  panel.innerHTML =
    '<div style="padding:14px 16px;background:#141624;border-bottom:1px solid #1F2336;display:flex;align-items:center;justify-content:space-between;">' +
    '<div><strong style="color:#E5C185;font-size:13px;letter-spacing:0.05em;">COACH ZIRI · OKIKE AI</strong><div style="font-size:11px;color:#8A8F9E;">Connected to ' +
    platform +
    "</div></div>" +
    '<button id="okike-close-btn" style="background:none;border:none;color:#8A8F9E;cursor:pointer;font-size:16px;">✕</button>' +
    "</div>" +
    '<div id="okike-messages" style="flex:1;padding:14px;overflow-y:auto;font-size:12px;line-height:1.5;display:flex;flex-direction:column;gap:10px;">' +
    '<div style="background:#141624;border:1px solid #1F2336;padding:10px 12px;border-radius:12px;color:#E5C185;">Hi! I\'m Coach Ziri, connected via the OKIKE Engine. How can I help?</div>' +
    "</div>" +
    '<form id="okike-form" style="padding:10px;border-top:1px solid #1F2336;display:flex;gap:8px;background:#0F111A;">' +
    '<input id="okike-input" type="text" placeholder="Ask Coach Ziri..." style="flex:1;background:#141624;border:1px solid #1F2336;border-radius:10px;padding:8px 12px;color:#fff;font-size:12px;outline:none;" />' +
    '<button type="submit" style="background:linear-gradient(135deg,#D4AF37,#AA7C11);color:#050507;border:none;border-radius:10px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer;">Send</button>' +
    "</form>";

  var btn = document.createElement("button");
  btn.style.cssText =
    "height:52px;padding:0 18px;border-radius:999px;background:linear-gradient(135deg,#D4AF37,#AA7C11);color:#050507;font-weight:700;font-size:13px;border:none;box-shadow:0 8px 25px rgba(212,175,55,0.35);cursor:pointer;display:flex;align-items:center;gap:8px;margin-left:auto;";
  btn.innerHTML = "<span>✦ Coach Ziri</span>";

  container.appendChild(panel);
  container.appendChild(btn);
  document.body.appendChild(container);

  btn.addEventListener("click", function () {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });

  panel.querySelector("#okike-close-btn").addEventListener("click", function () {
    panel.style.display = "none";
  });

  var form = panel.querySelector("#okike-form");
  var input = panel.querySelector("#okike-input");
  var msgs = panel.querySelector("#okike-messages");

  function appendBubble(text, isUser) {
    var div = document.createElement("div");
    div.style.cssText = isUser
      ? "align-self:flex-end;background:#D4AF37;color:#050507;font-weight:600;padding:8px 12px;border-radius:12px;max-width:85%;"
      : "align-self:flex-start;background:#141624;border:1px solid #1F2336;color:#F3F4F6;padding:8px 12px;border-radius:12px;max-width:85%;";
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = "";
    appendBubble(text, true);

    fetch(apiUrl.replace(/\/$/, "") + "/v1/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Okike-Key": apiKey,
        "X-Okike-User-Id": userId,
      },
      body: JSON.stringify({
        message: text,
        platform: platform,
      }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        appendBubble(data.reply || data.detail || "Done.", false);
      })
      .catch(function () {
        appendBubble("Could not reach OKIKE Python Engine at " + apiUrl, false);
      });
  });
})();

