import { paintRosterShowcase } from "./ui.js";

/*
 * Title showcase lifecycle.
 * The showcase canvas must be measured only after #scTitle is visible.
 * This module is loaded with the application, so it also covers returning
 * to the title screen and resize/orientation changes. Rendering errors are
 * deliberately not swallowed.
 */
let observer = null;
let raf = 0;

function repaintIfTitleIsVisible() {
  const title = document.getElementById("scTitle");
  const canvas = document.getElementById("roster-showcase");
  if (!title || !canvas || !title.classList.contains("on")) return;

  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (title.classList.contains("on")) paintRosterShowcase();
  });
}

function installTitleLifecycle() {
  const title = document.getElementById("scTitle");
  if (!title) return;

  observer?.disconnect();
  observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === "attributes" && m.attributeName === "class")) {
      repaintIfTitleIsVisible();
    }
  });
  observer.observe(title, { attributes: true, attributeFilter: ["class"] });

  repaintIfTitleIsVisible();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installTitleLifecycle, { once: true });
} else {
  installTitleLifecycle();
}

window.addEventListener("resize", repaintIfTitleIsVisible, { passive: true });
window.addEventListener("orientationchange", repaintIfTitleIsVisible, { passive: true });
