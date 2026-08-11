// Live PR status badges (octicon + state) next to GitHub / Codeberg PR links.
// Unauthenticated, CORS-friendly; on any failure we render nothing.
document.addEventListener("DOMContentLoaded", function () {
  var ICONS = {
    open: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
    merged: "M5.45 5.154A4.25 4.25 0 0 0 9.25 7.5h1.378a2.251 2.251 0 1 1 0 1.5H9.25A5.734 5.734 0 0 1 5 7.123v3.505a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.95-.218ZM4.25 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm8.5-4.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 3.25a.75.75 0 1 0 0 .005V3.25Z"
  };
  var COLORS = { merged: "#79740e", open: "#076678", closed: "#9d0006" };
  function badge(el, state) {
    var wrap = document.createElement("sup");
    wrap.style.cssText = "margin-left:0.2em;font-size:0.7em;font-weight:600;white-space:nowrap;color:" +
      (COLORS[state] || "var(--fg3)");
    var path = ICONS[state === "merged" ? "merged" : "open"];
    wrap.innerHTML = '<svg viewBox="0 0 16 16" width="0.9em" height="0.9em" fill="currentColor" ' +
      'style="vertical-align:-0.1em;margin-right:0.15em"><path d="' + path + '"/></svg>' + state;
    el.after(wrap);
  }
  function apply(el, url) {
    fetch(url)
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var state = (d.merged || d.merged_at) ? "merged" : d.state;
        if (state) badge(el, state);
      })
      .catch(function () {});
  }
  document.querySelectorAll("a[href]").forEach(function (a) {
    var m = a.href.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
    if (m) return apply(a, "https://api.github.com/repos/" + m[1] + "/pulls/" + m[2]);
    m = a.href.match(/codeberg\.org\/([\w.-]+\/[\w.-]+)\/pulls\/(\d+)/);
    if (m) return apply(a, "https://codeberg.org/api/v1/repos/" + m[1] + "/pulls/" + m[2]);
  });
});
