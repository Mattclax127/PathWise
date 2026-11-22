/**
 * Stand-in vector artwork for the island map: oblique 2.5D landmarks, sky and sea, and the shared symbols.
 * All strings are static constants written here, never user data, so they are safe to inject as SVG markup.
 * Each landmark is drawn in its own box (ART_BOXES) so a painted image of the same box can replace it later.
 */
type Pal = { f: string; s: string; t: string; k: string };

/** Landmark art boxes [x, y, width, height] in map units, in stage order. */
export const ART_BOXES: ReadonlyArray<readonly [number, number, number, number]> = [[40,574,220,116],[435,546,220,116],[420,89,220,116],[753,69,220,116],[973,579,220,116],[1243,32,234,116]];

export const DEFS_SVG = String.raw`<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9e9f4"/><stop offset="1" stop-color="#72cadb"/></linearGradient>
<linearGradient id="isle" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#e5f4d9"/><stop offset="1" stop-color="#c7e6be"/></linearGradient>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>

<linearGradient id="ocean2" x1="0" y1="0" x2="0.9" y2="1"><stop stop-color="#b9edf2"/><stop offset=".55" stop-color="#7ed6de"/><stop offset="1" stop-color="#52bfcf"/></linearGradient>
<linearGradient id="grass2" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e5f5bb"/><stop offset=".5" stop-color="#c5e5a5"/><stop offset="1" stop-color="#add6a1"/></linearGradient>
<linearGradient id="bush2" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#70bf73"/><stop offset="1" stop-color="#358963"/></linearGradient>
<linearGradient id="palmLeaf" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#7ed27c"/><stop offset="1" stop-color="#287d5f"/></linearGradient>
<linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b1dbe7"/><stop offset="1" stop-color="#5d96af"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c9f3f5"/><stop offset="1" stop-color="#64b7c8"/></linearGradient>
<linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#fff7e5"/><stop offset="1" stop-color="#eddbb7"/></linearGradient>
<filter id="softshadow" x="-40%" y="-40%" width="190%" height="190%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#336878" flood-opacity=".22"/></filter>
<linearGradient id="glF" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8f7fa"/><stop offset=".6" stop-color="#8fd0dc"/><stop offset="1" stop-color="#5aa6bd"/></linearGradient><linearGradient id="glS" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#79bccd"/><stop offset="1" stop-color="#4a8fa8"/></linearGradient>
<symbol id="palm" viewBox="-35 -68 70 86" overflow="visible">
 <ellipse cx="5" cy="13" rx="22" ry="6" fill="#5b9b7b" opacity=".27"/>
 <path d="M-2 9 Q-6 -12 0 -47" stroke="#986949" stroke-width="8" fill="none" stroke-linecap="round"/>
 <path d="M0 -48 Q-33 -63 -34 -37 Q-14 -46 0 -44Z M0 -48 Q30 -64 34 -37 Q16 -47 0 -44Z M0 -48 Q-30 -38 -27 -14 Q-12 -34 0 -44Z M0 -48 Q32 -37 27 -14 Q12 -35 0 -44Z M0 -48 Q-12 -79 -3 -65 Q4 -50 0 -44Z M0 -48 Q17 -76 14 -60 Q11 -50 0 -44Z" fill="url(#palmLeaf)" stroke="#327b5e" stroke-width="1.2"/>
 <circle cx="0" cy="-44" r="4" fill="#d3a36a"/>
</symbol>
<symbol id="tree" viewBox="-30 -62 60 80" overflow="visible"><ellipse cx="0" cy="12" rx="21" ry="6" fill="#5b9b7b" opacity=".23"/><path d="M0 8V-33" stroke="#9b7858" stroke-width="7" stroke-linecap="round"/><circle cx="-13" cy="-33" r="18" fill="#67b66c"/><circle cx="12" cy="-34" r="20" fill="#489f68"/><circle cx="-2" cy="-48" r="22" fill="#7dc37d"/><path d="M-17 -46Q-5 -63 10 -57" fill="none" stroke="#b0dd95" stroke-width="5" stroke-linecap="round"/></symbol>
<symbol id="shrub" viewBox="-25 -18 50 36"><ellipse cy="12" rx="23" ry="5" fill="#5b9b7b" opacity=".25"/><circle cx="-10" cy="-2" r="12" fill="#4d9d6c"/><circle cx="2" cy="-9" r="15" fill="#75c582"/><circle cx="14" cy="-1" r="12" fill="#399066"/><circle cx="-4" cy="-11" r="3" fill="#a8e59b"/><circle cx="8" cy="-13" r="3" fill="#a8e59b"/></symbol>
<symbol id="flower" viewBox="-15 -18 30 36"><path d="M0 15 L0 -2" stroke="#499467" stroke-width="3"/><ellipse cx="-5" cy="7" rx="5" ry="2" fill="#599d70" transform="rotate(35 -5 7)"/><g fill="#f89ab0"><circle cx="-5" cy="-8" r="5"/><circle cx="5" cy="-8" r="5"/><circle cx="0" cy="-13" r="5"/><circle cx="0" cy="-3" r="5"/></g><circle cx="0" cy="-8" r="3" fill="#ffe187"/></symbol>
<symbol id="stone" viewBox="-25 -20 50 35"><ellipse cy="10" rx="20" ry="5" fill="#65a189" opacity=".27"/><path d="M-20 6L-12 -8L7 -13L23 3L15 11L-13 11Z" fill="#b9c7b4" stroke="#8ca99e" stroke-width="2"/><path d="M-12 -8L7 -13L11 -1L-4 1Z" fill="#e1e6cc" opacity=".7"/></symbol>
<!-- Landmark art symbols: designed to sit to the SIDE of the fixed road, not in it. -->
<symbol id="art-start" viewBox="0 0 220 116">
 <ellipse cx="109" cy="100" rx="83" ry="13" fill="#4b9a76" opacity=".21"/>
 <ellipse cx="108" cy="93" rx="84" ry="19" fill="#f5e0b7" stroke="#d8bf90" stroke-width="4"/>
 <path d="M41 82V38 M176 82V38" stroke="#9a7c61" stroke-width="10" stroke-linecap="round"/><path d="M37 44 Q109 -13 180 44" fill="none" stroke="#e9ba78" stroke-width="19" stroke-linecap="round"/><path d="M35 44 Q109 -14 182 44" fill="none" stroke="#fff3d2" stroke-width="8" stroke-linecap="round"/>
 <path d="M93 49 L109 57L126 49" fill="none" stroke="#42a7a1" stroke-width="6" stroke-linecap="round"/>
 <circle cx="42" cy="89" r="13" fill="#6ebd74"/><circle cx="178" cy="89" r="13" fill="#6ebd74"/>
</symbol>
<symbol id="art-employer" viewBox="0 0 220 116">
 <ellipse cx="109" cy="103" rx="85" ry="11" fill="#457e81" opacity=".2"/>
 <rect x="46" y="41" width="127" height="60" rx="5" fill="url(#wall)" stroke="#beab8c" stroke-width="3"/>
 <path d="M39 43 L54 25H170L185 43Z" fill="#7ab9bd" stroke="#467f94" stroke-width="3"/>
 <rect x="41" y="41" width="136" height="22" rx="3" fill="#fff" stroke="#6d91a7" stroke-width="2"/>
 <path d="M41 42h17v21H41z M75 42h17v21H75z M109 42h17v21h-17z M143 42h17v21h-17z" fill="#58afd0"/>
 <rect x="59" y="68" width="47" height="33" rx="2" fill="url(#glass)" stroke="#7fa4a7" stroke-width="2"/><path d="M83 68v33" stroke="#ecf8f7" stroke-width="3"/>
 <rect x="125" y="68" width="34" height="33" fill="#7cc7d0" stroke="#7fa4a7" stroke-width="2"/>
 <path d="M135 77h15m-7 -7v22" stroke="#edf7f3" stroke-width="3" opacity=".8"/><circle cx="34" cy="92" r="12" fill="#5caa72"/><circle cx="183" cy="92" r="12" fill="#5caa72"/>
</symbol>
<symbol id="art-sponsor" viewBox="0 0 220 116">
 <ellipse cx="110" cy="105" rx="82" ry="10" fill="#457e81" opacity=".2"/>
 <rect x="58" y="26" width="111" height="73" rx="4" fill="#f5fcf8" stroke="#89b4bb" stroke-width="3"/>
 <rect x="54" y="21" width="120" height="11" rx="4" fill="#7eabb8"/>
 <rect x="77" y="34" width="74" height="52" fill="url(#glass)" stroke="#64a5b2" stroke-width="2"/>
 <path d="M95 34v52m18 -52v52m18 -52v52 M77 49h74M77 67h74" stroke="#f4ffff" stroke-width="3"/>
 <rect x="100" y="73" width="28" height="26" fill="#346d85"/><path d="M114 73v26" stroke="#a4dce5" stroke-width="2"/>
 <rect x="43" y="90" width="16" height="10" rx="3" fill="#74b88b"/><rect x="169" y="90" width="18" height="10" rx="3" fill="#74b88b"/>
</symbol>
<symbol id="art-documents" viewBox="0 0 220 116">
 <ellipse cx="110" cy="105" rx="85" ry="10" fill="#457e81" opacity=".2"/>
 <rect x="47" y="48" width="132" height="53" rx="4" fill="url(#wall)" stroke="#c3ae92" stroke-width="3"/>
 <path d="M38 51L62 33H166L190 51Z" fill="#78a7bb" stroke="#527e9c" stroke-width="3"/>
 <path d="M64 37L110 12L166 37" fill="none" stroke="#b7d0d4" stroke-width="9" stroke-linecap="round"/>
 <rect x="89" y="64" width="42" height="37" rx="4" fill="#4b879c"/>
 <rect x="95" y="60" width="30" height="35" rx="2" fill="#fffdf4" transform="rotate(-4 110 78)"/>
 <path d="M101 70h16M101 76h16M101 82h11" stroke="#75b2c1" stroke-width="3" stroke-linecap="round"/>
 <rect x="57" y="62" width="22" height="22" fill="#a6d5db"/><rect x="141" y="62" width="22" height="22" fill="#a6d5db"/>
 <circle cx="30" cy="93" r="13" fill="#6bb985"/><circle cx="190" cy="93" r="13" fill="#6bb985"/>
</symbol>
<symbol id="art-visa" viewBox="0 0 220 116">
 <ellipse cx="113" cy="105" rx="94" ry="9" fill="#457e81" opacity=".18"/>
 <rect x="42" y="52" width="119" height="49" rx="3" fill="url(#wall)" stroke="#c1ae92" stroke-width="3"/>
 <path d="M36 52 L55 36H151L168 52Z" fill="#9fc1cc" stroke="#618fa1" stroke-width="3"/>
 <rect x="64" y="63" width="27" height="22" rx="2" fill="#90c9d5"/><rect x="107" y="61" width="29" height="40" fill="#41889d"/>
 <rect x="166" y="79" width="27" height="22" rx="2" fill="#e9f5f1" stroke="#6da2ac" stroke-width="3"/>
 <path d="M177 78V32" stroke="#89969d" stroke-width="3"/>
 <path d="M178 33l22 5-22 7Z" fill="#ed8f7f"/>
 <path d="M160 80H198" stroke="#db7365" stroke-width="5"/>
</symbol>
<symbol id="art-arrival" viewBox="0 0 230 116">
 <ellipse cx="114" cy="102" rx="99" ry="11" fill="#457e81" opacity=".2"/>
 <rect x="33" y="58" width="28" height="43" rx="3" fill="#85c3d1"/><rect x="64" y="36" width="30" height="65" rx="3" fill="#528fad"/><rect x="98" y="50" width="22" height="51" rx="3" fill="#8fbec8"/><rect x="124" y="28" width="34" height="73" rx="4" fill="#6aa4b7"/><rect x="162" y="49" width="29" height="52" rx="3" fill="#a7d2d4"/>
 <path d="M44 68h8m-8 9h8m29 -25h9m-9 11h9m-9 11h9m51 -33h14m-14 11h14m-14 11h14m-14 11h14m25 -14h10m-10 11h10" stroke="#ebf7e8" stroke-width="4"/>
 <path d="M17 95Q114 83 210 95L210 107H17Z" fill="#f5d4a3" stroke="#d9b480" stroke-width="3"/>
 <path d="M202 89V32" stroke="#677e92" stroke-width="4"/><path d="M204 34h-30v22h30Z" fill="#fff" stroke="#2d516b" stroke-width="1"/>
 <path d="M174 34h10v11h-10z M194 34h10v11h-10z M184 45h10v11h-10z" fill="#234c62"/>
</symbol>
`;

export const BACKGROUND_SVG = String.raw`<rect width="1600" height="900" fill="url(#ocean2)"/>
 <g stroke="#edfffc" stroke-width="3" stroke-linecap="round" opacity=".34" fill="none">
  <path d="M25 180q36 -12 80 0M1460 697q52 -13 99 0M20 830q44 -17 88 0M1430 816q40 -14 82 -1M32 362q33 -12 61 0M1469 500q35 -12 78 -1"/>
 </g>
 <path d="M 70 750 C 78 610 26 445 150 330 C 230 250 180 115 405 80 C 648 35 786 65 1021 57 C 1311 24 1498 64 1549 212 C 1590 329 1533 473 1510 661 C 1487 812 1226 852 1012 838 C 796 855 655 833 445 849 C 255 878 105 843 70 750Z" fill="#4698a6" opacity=".31" transform="translate(0 20)"/>
 <path d="M 70 750 C 78 610 26 445 150 330 C 230 250 180 115 405 80 C 648 35 786 65 1021 57 C 1311 24 1498 64 1549 212 C 1590 329 1533 473 1510 661 C 1487 812 1226 852 1012 838 C 796 855 655 833 445 849 C 255 878 105 843 70 750Z" fill="#f7e4b4" stroke="#fff3d9" stroke-width="8"/>
 <path d="M 91 738 C 94 602 55 448 174 346 C 244 269 206 140 419 110 C 662 67 790 94 1030 83 C 1314 53 1465 95 1524 226 C 1566 335 1504 483 1481 645 C 1457 789 1218 825 1011 811 C 792 829 659 804 451 822 C 263 845 119 821 91 738Z" fill="url(#grass2)"/>
 <path d="M185 315Q330 207 557 196T1043 178Q1280 147 1440 259" fill="none" stroke="#9cca8d" stroke-width="20" opacity=".20"/>
 <path d="M145 660Q391 551 656 652T1260 666" fill="none" stroke="#82bc83" stroke-width="30" opacity=".10"/>
 <path d="M783 585q80 -78 146 0t-16 144q-72 44 -146 -10t16 -134Z" fill="#79d6d3" stroke="#b4eae0" stroke-width="8" opacity=".85"/>
 <path d="M804 630q40 -25 78 0M823 682q32 -14 59 0" fill="none" stroke="#dbf8eb" stroke-width="5" opacity=".9" stroke-linecap="round"/>
 <path d="M1432 748Q1495 747 1516 706" stroke="#f8e3b8" stroke-width="50" fill="none" opacity=".7"/>`;

const poly=(pts: number[][], fill: string, stroke = '#8a7a5c', sw = 1.5): string=>`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
const rct=(x: number, y: number, w: number, h: number, fill: string, r = 2, stroke = 'none', sw = 0): string=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const box=(x: number, y: number, w: number, h: number, d: number, c: Pal): string=>poly([[x+w,y],[x+w+d,y-d*.5],[x+w+d,y+h-d*.5],[x+w,y+h]],c.s,c.k)+rct(x,y,w,h,c.f,0,c.k,1.5)+poly([[x,y],[x+d,y-d*.5],[x+w+d,y-d*.5],[x+w,y]],c.t,c.k);
const shadow=(cx: number, cy: number, rx: number, ry: number): string=>`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2f6f66" opacity=".22"/>`;
const win=(x: number, y: number, w: number, h: number, f = 'url(#glF)'): string=>rct(x,y,w,h,f,2,'#5d8f9c',1.2)+`<path d="M${x+3} ${y+h-3}L${x+w*.55} ${y+3}" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/>`;
const STONE={f:'#f4e8d0',s:'#d9c59c',t:'#fff7e4',k:'#b9a47c'},GLASS={f:'url(#glF)',s:'url(#glS)',t:'#e6fbfc',k:'#4f8796'},WALL={f:'#fff4de',s:'#e5cfa6',t:'#9fcfd1',k:'#b9a47c'};
const potted=(x: number, y: number): string=>`<ellipse cx="${x}" cy="${y+2}" rx="9" ry="3" fill="#2f6f66" opacity=".2"/>${rct(x-5,y-8,10,10,'#d98d6a',2)}<circle cx="${x}" cy="${y-13}" r="9" fill="#58b36f"/><circle cx="${x-4}" cy="${y-17}" r="5" fill="#8fdc93"/>`;
const L: Array<() => string> = [
()=>shadow(130,130,112,17)+`<ellipse cx="130" cy="112" rx="108" ry="28" fill="#f0d9ab" stroke="#d3b682" stroke-width="3"/><ellipse cx="130" cy="110" rx="84" ry="20" fill="#e9cf9f"/><ellipse cx="130" cy="110" rx="58" ry="13" fill="none" stroke="#d3b682" stroke-width="2.5"/><path d="M130 98v24M104 110h52" stroke="#cdae78" stroke-width="3" stroke-linecap="round"/><circle cx="130" cy="110" r="6" fill="#35AF94"/>`
 +box(52,42,20,66,12,STONE)+box(172,42,20,66,12,STONE)+box(46,24,152,22,12,{f:'#f6e6c4',s:'#d9c08f',t:'#fff4d6',k:'#b9a47c'})+rct(58,40,126,6,'#35AF94',2)+rct(62,28,118,6,'#FFC85A',3)
 +`<path d="M198 26V-4" stroke="#7a6a58" stroke-width="3"/><path d="M198 -4l26 7-26 8Z" fill="#FF8670"/>`+potted(34,120)+potted(226,122),
()=>shadow(120,150,128,15)+box(30,72,150,70,42,WALL)+rct(30,62,150,12,'#fff',0,'#b9a47c',1.5)+poly([[180,62],[222,41],[222,45],[180,74]],'#e5cfa6','#b9a47c',1)
 +win(44,86,40,40)+win(126,86,40,40)+rct(92,84,28,58,'#2f6f8a',3,'#1d4a5f',1.5)+rct(96,90,20,48,'url(#glF)',2)
 +[0,1,2,3,4,5].map((i) => poly([[40+i*20,76],[60+i*20,76],[64+i*20,98],[44+i*20,98]],i%2?'#fff':'#3d7fd1','#2b5f9e',1)).join('')
 +rct(78,56,56,17,'#1f4e79',4,'#14284B',1.5)+rct(97,60,18,10,'none',2,'#fff',2)+`<path d="M101 60v-3h10v3" stroke="#fff" stroke-width="2" fill="none"/>`
 +`<path d="M232 146V114" stroke="#8a6b52" stroke-width="3"/><ellipse cx="232" cy="110" rx="26" ry="9" fill="#ff8670"/><ellipse cx="232" cy="107" rx="18" ry="6" fill="#ffb8a7" opacity=".8"/><ellipse cx="232" cy="150" rx="18" ry="5" fill="#8a6b52" opacity=".3"/>`+potted(22,146)+potted(204,148),
()=>shadow(140,166,130,16)+box(36,128,176,34,40,STONE)+box(80,24,104,112,46,GLASS)
 +[0,1,2,3,4,5,6].map((i) => `<path d="M80 ${38+i*15}H184" stroke="#e9ffff" stroke-width="2" opacity=".85"/>`).join('')+[0,1,2,3,4].map((i) => `<path d="M${100+i*20} 24V136" stroke="#e9ffff" stroke-width="2" opacity=".7"/>`).join('')
 +rct(80,16,104,12,'#3478F6',2,'#2457b8',1.5)+rct(86,19,92,3,'#9cc4ff',1)+`<path d="M132 16V-6" stroke="#7a8a97" stroke-width="3"/><circle cx="132" cy="-8" r="4" fill="#FF8670"/>`
 +rct(108,140,48,20,'#2f6f8a',3,'#1d4a5f',1.5)+poly([[100,140],[164,140],[172,132],[108,132]],'#3478F6','#2457b8',1.5)+potted(46,164)+potted(240,166),
()=>shadow(130,166,128,16)+box(40,98,176,56,42,STONE)+poly([[30,98],[128,52],[226,98]],'#f0e2c2','#b9a47c',1.5)+poly([[128,52],[170,31],[268,77],[226,98]],'#9fbfca','#5d8791',1.5)
 +[0,1,2,3,4].map((i) => rct(52+i*34,104,12,44,'#fffaf0',2,'#b9a47c',1.2)+rct(49+i*34,100,18,5,'#e6d8b8',1)+rct(49+i*34,148,18,5,'#e6d8b8',1)).join('')
 +rct(106,112,44,36,'#2f6f8a',4,'#1d4a5f',1.5)+`<circle cx="128" cy="76" r="9" fill="#3478F6" stroke="#b9a47c" stroke-width="2"/><path d="M123 76l4 4 7-8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
 +[0,1,2].map((i) => rct(96-i*6,150+i*4,64+i*12,4,'#efe0c0',1,'#b9a47c',1)).join('')
 +`<g transform="rotate(5 262 128)">${rct(236,92,50,66,'#fffdf5',5,'#6d91a7',2.5)}${rct(252,86,18,10,'#6d91a7',3)}${[0,1,2].map((i) => `<path d="M246 ${108+i*16}l5 5 8-9" stroke="#35AF94" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M264 ${110+i*16}h14" stroke="#9fb5c3" stroke-width="3" stroke-linecap="round"/>`).join('')}</g>`,
()=>shadow(125,138,120,12)+box(20,66,118,54,34,{f:'#f6ecd6',s:'#dcc9a0',t:'#a9bfc6',k:'#b9a47c'})+win(30,78,34,28)+rct(76,76,26,44,'#2f6f8a',3,'#1d4a5f',1.5)+rct(80,80,18,36,'url(#glF)',2)
 +poly([[10,64],[152,64],[170,50],[28,50]],'#4a8fa8','#2f6a80',1.5)+rct(14,64,6,56,'#e6d8b8',1)+rct(128,64,6,56,'#e6d8b8',1)
 +box(168,84,34,38,16,{f:'#eaf6f5',s:'#c5ddd9',t:'#fff',k:'#8aa7a5'})+win(174,92,22,16)
 +`<g transform="rotate(-16 202 92)">${[0,1,2,3,4].map((i) => rct(202+i*9,89,9,6,i%2?'#fff':'#e04b3a',0,'#7a2a20',.8)).join('')}</g>`+rct(198,92,5,30,'#7a8a97',1)
 +[0,1,2,3].map((i) => `<path d="M${30+i*30} 132V118" stroke="#7a8a97" stroke-width="3"/><circle cx="${30+i*30}" cy="116" r="3" fill="#FFC85A"/>`+(i<3?`<path d="M${30+i*30} 118Q${45+i*30} 126 ${60+i*30} 118" stroke="#b33a3a" stroke-width="2.5" fill="none"/>`:'')).join('')
 +`<path d="M228 126V10" stroke="#7a8a97" stroke-width="3.5"/><circle cx="228" cy="8" r="4" fill="#FFC85A"/>`+rct(230,12,30,22,'#fff',1,'#6d91a7',1)+rct(230,12,15,22,'#3d7fd1',0)+rct(245,12,15,11,'#c9dff5',0),
()=>shadow(165,152,150,13)+`<path d="M10 128Q165 112 320 128L320 150Q165 162 10 150Z" fill="#f7dcaa" stroke="#dcb77f" stroke-width="3"/>`
 +[[46,78,30,50,14],[84,42,34,86,16],[128,64,28,64,12],[166,20,40,108,18],[214,56,32,72,14]].map(([x, y, w, h, d], i) => box(x,y,w,h,d,{f:i%2?'url(#glF)':'#8ec2d4',s:i%2?'url(#glS)':'#5f9bb3',t:'#e6fbfc',k:'#4f7f93'})+Array.from({length:Math.floor(h/14)},(_: unknown, r: number) => `<path d="M${x+3} ${y+8+r*14}h${w-6}" stroke="#fff" stroke-width="2" opacity=".6"/>`).join('')).join('')
 +`<g transform="translate(18 120) scale(.8)"><use href="#palm" x="-35" y="-68" width="70" height="86"/></g>`
 +`<ellipse cx="274" cy="130" rx="38" ry="11" fill="#fff0c0" stroke="#e0b868" stroke-width="3"/><circle cx="274" cy="92" r="46" fill="#ffe27a" opacity=".38"/><path d="M274 128V54" stroke="#6a7a88" stroke-width="4"/>`
 +Array.from({length:12},(_: unknown, i: number) => rct(278+(i%4)*8,56+Math.floor(i/4)*8,8,8,(i+Math.floor(i/4))%2?'#14284B':'#fff',0,'#14284B',.5)).join('')
 +`<g transform="translate(70 12)" fill="#fff" stroke="#8aa7b8" stroke-width="1.5"><path d="M0 8l28-4 8-6 3 1-5 8 22 1-3 3-22 0 5 8-3 1-8-6-25-2Z"/></g>`];

/** Oblique 2.5D landmark set (previous style). Kept as an alternative; not rendered. */
export const LANDMARK_SVG_OBLIQUE: string[] = L.map((fn) => fn());

/** Flat symbol landmarks from the approved simple prototype, one per stage, drawn at each box origin. */
const ART_IDS = ["start", "employer", "sponsor", "documents", "visa", "arrival"] as const;
export const LANDMARK_SVG: string[] = ART_IDS.map((id, i) => `<use href="#art-${id}" x="0" y="0" width="${ART_BOXES[i][2]}" height="${ART_BOXES[i][3]}" filter="url(#softshadow)"/>`);
