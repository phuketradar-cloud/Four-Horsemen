import { GameManager } from './core/GameManager.js';
import { SCREEN } from './data/config.js';

// Boot: create the single GameManager, keep the 640x480 (4:3) canvas scaled to fit the window.
const canvas = document.getElementById('game');

function fit() {
  const s = Math.min(window.innerWidth / SCREEN.w, window.innerHeight / SCREEN.h);
  const scale = s >= 1 ? Math.max(1, Math.floor(s * 4) / 4) : s; // quarter steps keep pixels mostly even
  canvas.style.width = `${Math.floor(SCREEN.w * scale)}px`;
  canvas.style.height = `${Math.floor(SCREEN.h * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

const game = new GameManager(canvas);
window.__game = game; // debugging / automated acceptance checks
game.start();
canvas.focus();

// ?test runs the automated acceptance playthrough (results in console + window.__testResults)
const params = new URLSearchParams(location.search);
if (params.has('test')) import('../tests/acceptance.js').then((m) => m.runAcceptance(game));
if (params.has('test2')) import('../tests/phase2.js').then((m) => m.runPhase2(game));
if (params.has('test3')) import('../tests/phase3.js').then((m) => m.runPhase3(game));
if (params.has('test6')) import('../tests/phase6.js').then((m) => m.runPhase6(game, { quick: params.has('quick') }));
if (params.has('test5')) import('../tests/phase5.js').then((m) => m.runPhase5(game, { quick: params.has('quick') }));
if (params.has('test4')) import('../tests/phase4.js').then((m) => m.runPhase4(game, { quick: params.has('quick'), botOnly: params.has('botonly') }));
