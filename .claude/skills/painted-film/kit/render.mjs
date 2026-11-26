#!/usr/bin/env node
// render.mjs (painted-film kit): index.html → frames in headless Chrome → H.264, then the sound mix from the page.
//   node render.mjs --stills 1,5.5,9      PNG stills + out/stills/contact.png (5 across)
//   node render.mjs                       full render → out/<folder>.mp4
//   node render.mjs --audio               redo only the mix over out/video.mp4
//   node render.mjs --until 8             only the first 8 s
// The page sets window.DURATION, window.renderAt(t), window.READY, and window.MIX:
//   { lines: [{id, t}],                                  voice files vo/<id>.wav, already levelled to -21 dB
//     beds:  [{file, from, to, mean}],                    looped room tone, set to `mean` dBFS
//     cues:  [{file, t, peak}] }                          effects, each set by its own peak to `peak` dBFS
//     step: 12, fps: 30 }                                 optional: picture steps per second, output frame rate
// Paths in MIX are relative to this folder. Uses puppeteer-core from STUDIO (default ~/Desktop/motion_graphis_decoyreport)
// and the system Chrome. Only frames where the 12 fps step changes are rendered; the rest are copies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = process.env.STUDIO || path.join(os.homedir(), 'Desktop/motion_graphis_decoyreport');
const puppeteer = createRequire(path.join(STUDIO, 'package.json'))('puppeteer-core');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.join(ROOT, 'out'); fs.mkdirSync(OUT, { recursive: true });
const NAME = process.env.NAME || path.basename(ROOT);
let FPS = 30, STEP = 12;   // output frame rate, and how often the picture changes (window.MIX.fps / .step override)

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname), f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(0);
await once(server, 'listening');
const URL0 = `http://127.0.0.1:${server.address().port}/index.html`;

let browser;
async function openPage() {
  browser ||= await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errors.push(m.text()));
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto(URL0);
  await page.waitForFunction('window.READY === true', { timeout: 120000 }).catch(() => errors.push('never READY'));
  if (errors.length) throw new Error('page errors:\n' + errors.join('\n'));
  page._errors = errors;
  return page;
}
const grab = (page, t, type) => page.evaluate(async (t, type) => { await window.renderAt(t); return document.querySelector('canvas').toDataURL(type, .93); }, t, type)
  .then(u => Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
const vol = (file, key) => +spawnSync('ffmpeg', ['-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' }).stderr.match(new RegExp(key + '_volume: (-?[\\d.]+)'))[1];

function mix(M, dur) {
  const inputs = [], filters = [], labels = [];
  const add = (file, delay, gain, extra = '') => {
    const f = path.resolve(ROOT, file); if (!fs.existsSync(f)) throw new Error('missing sound ' + f);
    const k = inputs.length / 2 + 1; inputs.push('-i', f); const d = Math.round(delay * 1000);
    filters.push(`[${k}:a]aresample=48000,aformat=channel_layouts=stereo${extra},volume=${gain.toFixed(4)},adelay=${d}|${d}[a${k}]`); labels.push(`[a${k}]`);
  };
  for (const L of M.lines || []) add(`vo/${L.id}.wav`, L.t, 1.0);
  for (const b of M.beds || []) { const to = Math.min(b.to ?? dur, dur), from = b.from || 0; add(b.file, from, 10 ** (((b.mean ?? -46) - vol(path.resolve(ROOT, b.file), 'mean')) / 20), `,aloop=loop=-1:size=2e9,atrim=0:${to - from},afade=t=in:d=${from ? 0.4 : 0.05},afade=t=out:st=${Math.max(0, to - from - 0.5)}:d=0.5`); }
  for (const c of M.cues || []) add(c.file, c.t, 10 ** (((c.peak ?? -26) - vol(path.resolve(ROOT, c.file), 'max')) / 20));
  if (!labels.length) { fs.copyFileSync(path.join(OUT, 'video.mp4'), path.join(OUT, NAME + '.mp4')); return; }
  filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,atrim=0:${dur},loudnorm=I=-14:TP=-1.5:LRA=7[mix]`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(OUT, 'video.mp4'), ...inputs, '-filter_complex', filters.join(';'),
    '-map', '0:v', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', path.join(OUT, NAME + '.mp4')], { stdio: 'inherit' });
}

try {
  const page = await openPage();
  let { dur, M } = await page.evaluate(() => ({ dur: window.DURATION, M: window.MIX || {} }));
  if (opt('--until')) dur = Math.min(dur, +opt('--until'));
  FPS = M.fps || FPS; STEP = M.step || STEP;
  if (opt('--stills')) {
    const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    const ts = opt('--stills').split(',').map(Number);
    // render every 12 fps step up to each still, in order, so snapshots and state are built as in the real render
    let last = 0;
    for (const [i, t] of ts.entries()) {
      if (args.includes('--fast')) last = t; else for (let s = last; s < t; s += 1 / STEP) await page.evaluate(async s => { await window.renderAt(s); }, s);
      last = t; fs.writeFileSync(path.join(dir, `s${String(i).padStart(2, '0')}.png`), await grab(page, t, 'image/png'));
    }
    const cols = Math.min(5, ts.length);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '1', '-i', path.join(dir, 's%02d.png'), '-vf', `scale=432:768,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6:color=white`, '-frames:v', '1', path.join(dir, 'contact.png')]);
    console.log('stills →', path.join(dir, 'contact.png'));
  } else {
    if (!args.includes('--audio')) {
      const N = Math.round(dur * FPS), t0 = Date.now();
      const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), path.join(OUT, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
      let last = null;
      for (let i = 0; i < N; i++) {
        const t = i / FPS, step = Math.floor(t * STEP + 1e-6);
        if (!last || last.step !== step) last = { step, buf: await grab(page, t, 'image/jpeg') };
        if (!ff.stdin.write(last.buf)) await once(ff.stdin, 'drain');
        if (i % 90 === 0) process.stdout.write(`\r${i}/${N} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
      ff.stdin.end(); await once(ff, 'close'); console.log(`\nvideo ${N} frames`);
    }
    mix(M, dur);
    console.log('→', path.join(OUT, NAME + '.mp4'));
  }
} finally { await browser?.close(); server.close(); }
