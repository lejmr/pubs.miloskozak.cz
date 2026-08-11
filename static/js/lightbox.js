// Minimal lightbox: click a content image to view it full-screen, click/Esc to close.
document.addEventListener("DOMContentLoaded", function () {
  var overlay = document.createElement("div");
  overlay.style.cssText = "display:none;position:fixed;inset:0;z-index:999;" +
    "background:rgba(0,0,0,0.85);cursor:zoom-out;align-items:center;justify-content:center;padding:2rem;";
  var big = document.createElement("img");
  big.style.cssText = "max-width:100%;max-height:100%;box-shadow:0 0 40px rgba(0,0,0,0.6);";
  overlay.appendChild(big);
  document.body.appendChild(overlay);
  function close() { overlay.style.display = "none"; big.src = ""; }
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  document.querySelectorAll("main img").forEach(function (img) {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function () {
      big.src = img.src;
      overlay.style.display = "flex";
    });
  });
});
