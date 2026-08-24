# Startsidans demo-galleri (parkerat 2026-08-17)

Vigge vill inte visa 10h-strömmens klipp (visar en tredjeparts-avatar). När han
lämnar en godkänd exempelvideo:

1. Rendera webbkopior på VPS: 540×960, `-preset slow -crf 27`, ljud
   `asetrate=48000*0.86,aresample=48000,atempo=1.1628` (pitch ned) → `/opt/viggeclips/public/demo/clipN.mp4` + poster `clipN.jpg`,
   plus `phone.mp4` (400×712, `-an`, crf 30) för telefonen.
2. Telefonen i index.html: byt `<span class="film"></span>` mot
   `<video class="film real" src="/demo/phone.mp4" poster="/demo/clip1.jpg" muted autoplay loop playsinline preload="metadata" aria-hidden="true"></video>`
   + CSS `.phone video.film.real{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:none;background:#0a0c0e}`
   och sätt `hidden` på #pcap/#pwave (skripten hoppar dem när hidden).
3. Galleri-sektionen ("What comes out") + CSS (.gallery/.gclip) finns i git-historik
   för index.html (commit 2026-08-17) — fyra <figure class="gclip"><video controls …>.
4. Walkthrough-korten (#dgrid) kan få bakgrundsbild igen via `img:` i CLIPS.
