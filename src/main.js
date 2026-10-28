import { GameManager } from './core/GameManager.js';

// Boot: create the single GameManager. It draws a 960x540 (16:9) logical frame; core/Display.js sizes
// and presents it on this canvas (integer / sharp scaling, resolution + fullscreen options).
const canvas = document.getElementById('game');

const game = new GameManager(canvas);
window.__game = game; // debugging / automated acceptance checks
game.start();
canvas.focus();

// ?test runs the automated acceptance playthrough (results in console + window.__testResults)
const params = new URLSearchParams(location.search);
// The Phase 1-7 suites measure solo play (balance baselines, exact hit counts); they pin it.
if (['test', 'test2', 'test3', 'test4', 'test5', 'test6', 'test7'].some((k) => params.has(k))) game.forceSolo = true;
if (params.has('test8')) import('../tests/phase8.js').then((m) => m.runPhase8(game));
if (params.has('test')) import('../tests/acceptance.js').then((m) => m.runAcceptance(game));
if (params.has('test2')) import('../tests/phase2.js').then((m) => m.runPhase2(game));
if (params.has('test3')) import('../tests/phase3.js').then((m) => m.runPhase3(game));
if (params.has('test6')) import('../tests/phase6.js').then((m) => m.runPhase6(game, { quick: params.has('quick') }));
if (params.has('test5')) import('../tests/phase5.js').then((m) => m.runPhase5(game, { quick: params.has('quick') }));
if (params.has('test7')) import('../tests/phase7.js').then((m) => m.runPhase7(game));
if (params.has('test4')) import('../tests/phase4.js').then((m) => m.runPhase4(game, { quick: params.has('quick'), botOnly: params.has('botonly') }));
