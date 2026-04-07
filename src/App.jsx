import { useState, useRef } from "react";

const readFile = (file, cb) => {
  const r = new FileReader();
  r.onload = e => cb(e.target.result);
  r.readAsDataURL(file);
};

function loadImg(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function rrectTop(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h); ctx.lineTo(x,y+h); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}
function rrectBot(ctx,x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x,y); ctx.lineTo(x+w,y); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y); ctx.closePath();
}

async function buildCanvas(cards, mode) {
  const SCALE = 3;
  const CW = 1200, PAD = 56, GAP = 28, CARD_GAP = 56, LABEL_H = 40;
  const SLOT_W = (CW - PAD * 2 - GAP) / 2;

  const pairs = [];
  for (const card of cards) {
    const a = card.oldImg ? await loadImg(card.oldImg) : null;
    const b = card.newImg ? await loadImg(card.newImg) : null;
    pairs.push([a, b]);
  }

  let imgH = 400;
  let maxRatio = 0;
  for (const [a, b] of pairs) {
    if (a && a.width > 0) maxRatio = Math.max(maxRatio, a.height / a.width);
    if (b && b.width > 0) maxRatio = Math.max(maxRatio, b.height / b.width);
  }
  if (maxRatio > 0) imgH = Math.round(SLOT_W * maxRatio);

  const cardHeights = cards.map(c => {
    let h = LABEL_H + imgH;
    if (c.title) h += 56;
    if (c.subtitle) h += 44;
    return h;
  });
  const totalH = PAD + cardHeights.reduce((s,h,i) => s + h + (i < cardHeights.length-1 ? CARD_GAP : 0), 0) + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = CW * SCALE;
  canvas.height = totalH * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, CW, totalH);

  let y = PAD;
  for (let ci = 0; ci < cards.length; ci++) {
    const card = cards[ci];
    const [imgA, imgB] = pairs[ci];
    const cardH = cardHeights[ci];
    const cardW = CW - PAD * 2;

    ctx.fillStyle = "rgba(0,0,0,0.05)";
    rrect(ctx, PAD-8+3, y-8+4, cardW+16, cardH+16, 20); ctx.fill();
    ctx.fillStyle = "#ffffff";
    rrect(ctx, PAD-8, y-8, cardW+16, cardH+16, 20); ctx.fill();

    if (card.title) {
      ctx.fillStyle = "#1e293b";
      ctx.font = "bold 30px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(card.title, CW/2, y+38);
      y += 56;
    }

    const leftX = PAD;
    const rightX = PAD + SLOT_W + GAP;

    for (const [lx, lbl] of [[leftX, card.newLabel || "After"], [rightX, card.oldLabel || "Before"]]) {
      ctx.fillStyle = "#f1f5f9";
      rrectTop(ctx, lx, y, SLOT_W, LABEL_H, 10); ctx.fill();
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 16px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lbl, lx + SLOT_W/2, y + LABEL_H/2 + 6);
    }
    y += LABEL_H;

    const drawSlot = (img, isNoVersion, x) => {
      ctx.save();
      rrectBot(ctx, x, y, SLOT_W, imgH, 10); ctx.clip();
      ctx.fillStyle = "#f8fafc"; ctx.fillRect(x, y, SLOT_W, imgH);
      if (isNoVersion || !img) {
        ctx.fillStyle = "#e2e8f0"; ctx.fillRect(x, y, SLOT_W, imgH);
        ctx.fillStyle = "#64748b"; ctx.font = "bold 18px Arial, sans-serif"; ctx.textAlign = "center";
        ctx.fillText("No previous version", x + SLOT_W/2, y + imgH/2 - 10);
        ctx.fillStyle = "#94a3b8"; ctx.font = "14px Arial, sans-serif";
        ctx.fillText("This is a new feature", x + SLOT_W/2, y + imgH/2 + 16);
      } else {
        const s = Math.min(SLOT_W/img.width, imgH/img.height);
        ctx.drawImage(img, x+(SLOT_W-img.width*s)/2, y+(imgH-img.height*s)/2, img.width*s, img.height*s);
      }
      ctx.restore();
    };

    drawSlot(imgB, card.newIsNew, leftX);
    drawSlot(imgA, card.oldIsNew, rightX);
    y += imgH;

    if (card.subtitle) {
      ctx.fillStyle = "#64748b"; ctx.font = "15px Arial, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(card.subtitle, CW/2, y+28); y += 44;
    }
    y += CARD_GAP;
  }
  return canvas;
}

async function doDownload(cards, mode) {
  const done = cards.filter(c => c.done && (c.oldImg||c.oldIsNew) && (c.newImg||c.newIsNew));
  if (!done.length) return;
  const perFile = 3;
  const chunks = [];
  for (let i = 0; i < done.length; i += perFile) chunks.push(done.slice(i, i+perFile));
  for (let i = 0; i < chunks.length; i++) {
    const canvas = await buildCanvas(chunks[i], mode);
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = chunks.length > 1 ? "-part" + (i+1) + "of" + chunks.length : "";
    a.download = mode + "-comparisons" + suffix + ".png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// ── Shared ─────────────────────────────────────────────────────────────────────
const iStyle = { width:"100%", boxSizing:"border-box", border:"1px solid #e2e8f0", borderRadius:8, padding:"9px 12px", fontSize:14, outline:"none", color:"#1e293b", background:"#f8fafc" };
const Lbl = ({ children }) => <div style={{ fontWeight:600, fontSize:12, color:"#374151", marginBottom:5 }}>{children}</div>;
const newCard = id => ({ id, title:"", subtitle:"", oldLabel:"2025", newLabel:"2026", oldImg:null, newImg:null, oldIsNew:false, newIsNew:false, done:false });

// ── ModeSelector ───────────────────────────────────────────────────────────────
function ModeSelector({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  const modes = [
    { id:"web",    icon:"🖥️", label:"Web",    desc:"Desktop / browser screenshots", sub:"Landscape, wide layouts" },
    { id:"mobile", icon:"📱", label:"Mobile", desc:"Mobile screenshots",             sub:"Portrait layout" },
  ];
  return (
    <div style={{ fontFamily:"Inter,Arial,sans-serif", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px", background:"#f8fafc" }}>
      <div style={{ textAlign:"center", marginBottom:48 }}>
        <h1 style={{ margin:0, fontSize:28, fontWeight:700, color:"#1e293b" }}>Version Comparison Builder</h1>
        <p style={{ margin:"10px 0 0", color:"#94a3b8", fontSize:15 }}>What type of screenshots are you comparing?</p>
      </div>
      <div style={{ display:"flex", gap:24, flexWrap:"wrap", justifyContent:"center", alignItems:"stretch" }}>
        {modes.map(m => (
          <div key={m.id} onClick={() => onSelect(m.id)}
            onMouseEnter={() => setHovered(m.id)} onMouseLeave={() => setHovered(null)}
            style={{ width:220, borderRadius:16, overflow:"hidden", cursor:"pointer",
              boxShadow: hovered===m.id ? "0 8px 24px rgba(0,0,0,0.12)" : "0 2px 8px rgba(0,0,0,0.07)",
              transform: hovered===m.id ? "translateY(-3px)" : "none", transition:"all 0.2s",
              border:"1.5px solid", borderColor: hovered===m.id ? "#94a3b8" : "#e2e8f0",
              display:"flex", flexDirection:"column" }}>
            <div style={{ background:"#e2e8f0", padding:"28px 0", textAlign:"center", flexShrink:0 }}>
              <div style={{ fontSize:40 }}>{m.icon}</div>
            </div>
            <div style={{ background:"#fff", padding:"18px 20px 22px", flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16, color:"#1e293b", marginBottom:5 }}>{m.label}</div>
              <div style={{ fontSize:13, color:"#475569", fontWeight:500 }}>{m.desc}</div>
              <div style={{ fontSize:12, color:"#94a3b8", marginTop:3 }}>{m.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UploadBox ──────────────────────────────────────────────────────────────────
function UploadBox({ label, image, onUpload, isNoVersion, onToggleNoVersion }) {
  const inputRef = useRef();
  const pasteRef = useRef();
  const [tab, setTab] = useState("upload");
  const [pasting, setPasting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleDrop = e => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) readFile(file, onUpload);
  };
  const handlePaste = e => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (const item of items) {
      if (item.type.startsWith("image/")) { readFile(item.getAsFile(), v => { onUpload(v); setTab("upload"); }); break; }
    }
  };

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
      {!image && !isNoVersion && (
        <div style={{ display:"flex", background:"#f1f5f9", borderRadius:8, padding:3, gap:2, width:"100%" }}>
          {["upload","paste"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex:1, border:"none", borderRadius:6, padding:"8px 0", fontSize:13, fontWeight:600,
              cursor:"pointer", transition:"all 0.15s",
              background: tab===t ? "#fff" : "transparent",
              color: tab===t ? "#374151" : "#94a3b8",
              boxShadow: tab===t ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            }}>
              <span>{t==="upload" ? "📁" : "📋"}</span>
              <span>{t==="upload" ? "Upload" : "Paste"}</span>
            </button>
          ))}
        </div>
      )}
      {isNoVersion ? (
        <div style={{ width:"100%", boxSizing:"border-box", border:"2px dashed #cbd5e1", borderRadius:12, background:"#f8fafc", minHeight:220, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8 }}>
          <div style={{ fontSize:32 }}>✨</div>
          <div style={{ fontSize:13, fontWeight:600, color:"#475569" }}>No previous version</div>
          <div style={{ fontSize:11, color:"#94a3b8" }}>This is a new feature</div>
        </div>
      ) : (
        <div
          onClick={() => { if (image) return; if (tab==="upload") inputRef.current.click(); else { setPasting(true); pasteRef.current && pasteRef.current.focus(); } }}
          onPaste={tab==="paste" ? handlePaste : undefined}
          onDragOver={tab==="upload" && !image ? e => { e.preventDefault(); setDragging(true); } : undefined}
          onDragLeave={tab==="upload" && !image ? () => setDragging(false) : undefined}
          onDrop={tab==="upload" && !image ? handleDrop : undefined}
          tabIndex={tab==="paste" && !image ? 0 : undefined}
          ref={tab==="paste" ? pasteRef : undefined}
          onFocus={() => tab==="paste" && setPasting(true)}
          onBlur={() => setPasting(false)}
          style={{
            width:"100%", boxSizing:"border-box",
            border: image ? "2px solid #94a3b8" : (dragging||pasting) ? "2px dashed #475569" : "2px dashed #cbd5e1",
            borderRadius:12, background: image ? "transparent" : "#f8fafc",
            minHeight:220, display:"flex", alignItems:"center", justifyContent:"center",
            cursor: image ? "default" : "pointer", overflow:"hidden", transition:"all 0.2s", outline:"none",
          }}
        >
          {image ? (
            <img src={image} alt={label} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
          ) : (
            <div style={{ textAlign:"center", color: dragging ? "#475569" : "#94a3b8", padding:20 }}>
              <div style={{ fontSize:32, marginBottom:6 }}>{tab==="upload" ? (dragging ? "⬇️" : "📁") : (pasting ? "⌨️" : "📋")}</div>
              <div style={{ fontSize:13, fontWeight:500 }}>{tab==="upload" ? (dragging ? "Drop to upload" : "Click or drag & drop") : (pasting ? "Press Ctrl+V / ⌘V" : "Click, then paste")}</div>
              <div style={{ fontSize:11, marginTop:3 }}>PNG, JPG, WEBP</div>
            </div>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{ display:"none" }}
        onChange={e => { const f = e.target.files[0]; if (f) readFile(f, onUpload); }} />
      {image && !isNoVersion && (
        <button onClick={() => onUpload(null)} style={{ border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:7, padding:"4px 0", fontSize:12, color:"#94a3b8", cursor:"pointer" }}>✕ Remove</button>
      )}
      {!image && (
        <button onClick={onToggleNoVersion} style={{
          border:"1px solid #e2e8f0", background: isNoVersion ? "#f1f5f9" : "#fff",
          borderRadius:7, padding:"5px 0", fontSize:12,
          color: isNoVersion ? "#475569" : "#94a3b8", cursor:"pointer", fontWeight:500,
        }}>{isNoVersion ? "↩ Upload screenshot instead" : "✨ No previous version"}</button>
      )}
      <div style={{ textAlign:"center", fontWeight:600, fontSize:13, color:"#475569", letterSpacing:"0.04em", background:"#f1f5f9", borderRadius:8, padding:"5px 0" }}>{label}</div>
    </div>
  );
}

// ── ComparisonCard ─────────────────────────────────────────────────────────────
function ComparisonCard({ card, index, total, mode, onChange, onRemove }) {
  const { title, subtitle, oldLabel, newLabel, oldImg, newImg, oldIsNew, newIsNew, done } = card;
  const ready = (newImg||newIsNew) && (oldImg||oldIsNew);

  const labelBar = lbl => (
    <div style={{ borderRadius:"10px 10px 0 0", background:"#f1f5f9", padding:"7px 0", textAlign:"center", fontWeight:600, fontSize:13, color:"#64748b", letterSpacing:"0.04em" }}>{lbl}</div>
  );
  const placeholder = () => (
    <div style={{ border:"1px solid #e2e8f0", borderTop:"none", borderRadius:"0 0 10px 10px", background:"#f8fafc", minHeight:160, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6 }}>
      <div style={{ fontSize:28 }}>✨</div>
      <div style={{ fontSize:13, fontWeight:600, color:"#475569" }}>No previous version</div>
      <div style={{ fontSize:11, color:"#94a3b8" }}>This is a new feature</div>
    </div>
  );

  return (
    <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.04)" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
        <span style={{ fontWeight:600, fontSize:13, color:"#64748b" }}>Comparison {index+1}</span>
        <div style={{ display:"flex", gap:8 }}>
          {done && <button onClick={() => onChange({done:false})} style={{ border:"1px solid #e2e8f0", background:"#fff", borderRadius:7, padding:"4px 12px", fontSize:12, color:"#64748b", cursor:"pointer", fontWeight:600 }}>Edit</button>}
          {total>1 && <button onClick={onRemove} style={{ border:"1px solid #fecaca", background:"#fff", borderRadius:7, padding:"4px 12px", fontSize:12, color:"#f87171", cursor:"pointer", fontWeight:600 }}>Remove</button>}
        </div>
      </div>
      <div style={{ padding:20 }}>
        {!done ? (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ flex:1 }}><Lbl>Title</Lbl><input value={title} onChange={e => onChange({title:e.target.value})} placeholder="e.g. Home Screen Redesign" style={iStyle} /></div>
              <div style={{ flex:1 }}><Lbl>Subtitle</Lbl><input value={subtitle} onChange={e => onChange({subtitle:e.target.value})} placeholder="e.g. Key improvements" style={iStyle} /></div>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <div style={{ flex:1 }}><Lbl>Newer version label</Lbl><input value={newLabel} onChange={e => onChange({newLabel:e.target.value})} style={iStyle} /></div>
              <div style={{ flex:1 }}><Lbl>Older version label</Lbl><input value={oldLabel} onChange={e => onChange({oldLabel:e.target.value})} style={iStyle} /></div>
            </div>
            <div style={{ display:"flex", gap:16 }}>
              <UploadBox label={newLabel||"Newer"} image={newImg} isNoVersion={newIsNew}
                onToggleNoVersion={() => onChange({newIsNew:!newIsNew, newImg:null})}
                onUpload={v => onChange({newImg:v, done:false})} />
              <UploadBox label={oldLabel||"Older"} image={oldImg} isNoVersion={oldIsNew}
                onToggleNoVersion={() => onChange({oldIsNew:!oldIsNew, oldImg:null})}
                onUpload={v => onChange({oldImg:v, done:false})} />
            </div>
            <button disabled={!ready} onClick={() => onChange({done:true})} style={{
              background: ready ? "#1e293b" : "#e2e8f0",
              color: ready ? "#fff" : "#94a3b8", border:"none", borderRadius:10,
              padding:"13px 0", fontSize:14, fontWeight:600, cursor: ready ? "pointer" : "not-allowed",
            }}>{ready ? "Generate Comparison →" : "Upload both images to continue"}</button>
          </div>
        ) : (
          <div>
            {title && <h2 style={{ textAlign:"center", margin:"0 0 16px", fontSize:22, fontWeight:700, color:"#1e293b" }}>{title}</h2>}
            <div style={{ display:"flex", gap:16 }}>
              <div style={{ flex:1 }}>
                {labelBar(newLabel)}
                {newIsNew ? placeholder() : <img src={newImg} alt={newLabel} style={{ width:"100%", display:"block", objectFit:"contain", borderRadius:"0 0 10px 10px", border:"1px solid #e2e8f0", borderTop:"none", background:"#f8fafc" }} />}
              </div>
              <div style={{ flex:1 }}>
                {labelBar(oldLabel)}
                {oldIsNew ? placeholder() : <img src={oldImg} alt={oldLabel} style={{ width:"100%", display:"block", objectFit:"contain", borderRadius:"0 0 10px 10px", border:"1px solid #e2e8f0", borderTop:"none", background:"#f8fafc" }} />}
              </div>
            </div>
            {subtitle && <p style={{ textAlign:"center", margin:"14px 0 0", color:"#64748b", fontSize:13 }}>{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null);
  const [cards, setCards] = useState([newCard(1)]);
  const nextId = useRef(2);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [exportError, setExportError] = useState("");

  if (!mode) return <ModeSelector onSelect={m => { setMode(m); setCards([newCard(1)]); setPreviewUrl(null); }} />;

  const update = (id, patch) => setCards(cs => cs.map(c => c.id===id ? Object.assign({}, c, patch) : c));
  const addCard = () => setCards(cs => [...cs, newCard(nextId.current++)]);
  const removeCard = id => setCards(cs => cs.filter(c => c.id!==id));
  const doneCount = cards.filter(c => c.done && (c.oldImg||c.oldIsNew) && (c.newImg||c.newIsNew)).length;

  const handleExport = async () => {
    setExportError(""); setExporting(true);
    try { await doDownload(cards, mode); }
    catch(e) { setExportError("Export failed: " + (e && e.message ? e.message : String(e))); }
    setExporting(false);
  };

  const handlePreview = async () => {
    setExportError(""); setPreviewing(true);
    try {
      const done = cards.filter(c => c.done && (c.oldImg||c.oldIsNew) && (c.newImg||c.newIsNew));
      const canvas = await buildCanvas(done, mode);
      setPreviewUrl(canvas.toDataURL("image/png"));
    } catch(e) { setExportError("Preview failed: " + (e && e.message ? e.message : String(e))); }
    setPreviewing(false);
  };

  return (
    <div style={{ fontFamily:"Inter,Arial,sans-serif", maxWidth:820, margin:"0 auto", padding:"32px 20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:32 }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:700, color:"#1e293b" }}>{mode==="web" ? "Web" : "Mobile"} Comparison Builder</h1>
          <p style={{ margin:"4px 0 0", color:"#94a3b8", fontSize:13 }}>{mode==="web" ? "Desktop / browser screenshots" : "Mobile screenshots — portrait layout"}</p>
        </div>
        <button onClick={() => setMode(null)} style={{ border:"1px solid #e2e8f0", background:"#fff", borderRadius:10, padding:"8px 16px", fontSize:13, color:"#64748b", cursor:"pointer", fontWeight:600 }}>← Change mode</button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
        {cards.map((card,idx) => (
          <ComparisonCard key={card.id} card={card} index={idx} total={cards.length} mode={mode}
            onChange={patch => update(card.id, patch)} onRemove={() => removeCard(card.id)} />
        ))}
        <button onClick={addCard}
          onMouseEnter={e => { e.currentTarget.style.background="#f8fafc"; e.currentTarget.style.borderColor="#94a3b8"; }}
          onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#e2e8f0"; }}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, border:"2px dashed #e2e8f0", borderRadius:14, padding:"16px 0", background:"transparent", color:"#64748b", fontSize:15, fontWeight:600, cursor:"pointer" }}>
          <span style={{ fontSize:20 }}>+</span> Add Comparison
        </button>
        {exportError && (
          <div style={{ background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 16px", color:"#ef4444", fontSize:13 }}>{exportError}</div>
        )}
        <div style={{ display:"flex", gap:12 }}>
          <button onClick={handlePreview} disabled={!doneCount||previewing||exporting} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            background:"#fff", color: doneCount ? "#1e293b" : "#94a3b8",
            border: "1.5px solid " + (doneCount ? "#cbd5e1" : "#e2e8f0"),
            borderRadius:14, padding:"14px 0", fontSize:15, fontWeight:600,
            cursor: doneCount&&!previewing&&!exporting ? "pointer" : "not-allowed", transition:"all 0.2s",
          }}>
            {previewing ? "Generating…" : "🔍 Preview PNG"}
          </button>
          <button onClick={handleExport} disabled={!doneCount||exporting||previewing} style={{
            flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            background: doneCount&&!exporting ? "#1e293b" : "#e2e8f0",
            color: doneCount&&!exporting ? "#fff" : "#94a3b8",
            border:"none", borderRadius:14, padding:"14px 0",
            fontSize:15, fontWeight:600, cursor: doneCount&&!exporting ? "pointer" : "not-allowed", transition:"all 0.2s",
          }}>
            {exporting ? "Generating…" : ("⬇️ Download PNG" + (doneCount > 3 ? "s" : ""))}
          </button>
        </div>
      </div>

      {previewUrl && (
        <div onClick={() => setPreviewUrl(null)} style={{
          position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:1000,
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start",
          padding:"32px 16px", overflowY:"auto", cursor:"pointer",
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:16, padding:16, maxWidth:1000, width:"100%", boxShadow:"0 16px 48px rgba(0,0,0,0.3)", cursor:"default" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <span style={{ fontWeight:600, fontSize:14, color:"#475569" }}>Preview</span>
              <button onClick={() => setPreviewUrl(null)} style={{ border:"1px solid #e2e8f0", background:"#f8fafc", borderRadius:8, padding:"4px 14px", fontSize:13, color:"#64748b", cursor:"pointer", fontWeight:600 }}>✕ Close</button>
            </div>
            <img src={previewUrl} alt="Preview" style={{ width:"100%", borderRadius:8, display:"block" }} />
          </div>
        </div>
      )}
    </div>
  );
}