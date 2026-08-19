import { Theme } from "./main.js";
import { paintRosterShowcase } from "./ui.js";

const originalColors = Theme.colors.bind(Theme);
Theme.colors = function(){
  const colors = originalColors();
  if(this.mode === "light") return {...colors, bg:"#EEE7D7", grid:"rgba(20,15,5,.07)", cut:"#EEE7D7"};
  return colors;
};

function repaint(){
  try { paintRosterShowcase(); } catch (_) { /* main renderer remains authoritative */ }
}

if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", repaint, {once:true});
else repaint();
window.addEventListener("resize", repaint, {passive:true});
window.addEventListener("orientationchange", ()=>setTimeout(repaint,120));
