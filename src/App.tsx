import { useState, useRef, useEffect, useCallback } from "react";

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

function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function rrectTop(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function rrectBot(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y);ctx.closePath();}

const ANN_COLORS = [
  { id:"red",    label:"Red",    hex:"#ef4444" },
  { id:"blue",   label:"Blue",   hex:"#3b82f6" },
  { id:"black",  label:"Black",  hex:"#1e293b" },
  { id:"green",  label:"Green",  hex:"#22c55e" },
  { id:"purple", label:"Purple", hex:"#a855f7" },
  { id:"pink",   label:"Pink",   hex:"#ec4899" },
  { id:"orange", label:"Orange", hex:"#f97316" },
];

const TAGS = [
  { id:"design", label:"Design change", color:"#3b82f6", bg:"#eff6ff" },
  { id:"ia",     label:"IA change",     color:"#f97316", bg:"#fff7ed" },
  { id:"new",    label:"New feature",   color:"#22c55e", bg:"#f0fdf4" },
];

function AnnotationEditor({ imageSrc, annotations, onChange, onClose, mode }) {
  const canvasRef = useRef();
  const [tool, setTool] = useState("rect");
  const [color, setColor] = useState("red");
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [scale, setScale] = useState(mode === "mobile" ? 0.5 : 1);
  const [pendingText, setPendingText] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [selected, setSelected] = useState(null);
  const [draggingAnn, setDraggingAnn] = useState(false);
  const [dragOffset, setDragOffset] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const imgRef = useRef();
  const CANVAS_W = 900;

  const getH = () => imgRef.current ? Math.round(CANVAS_W * imgRef.current.naturalHeight / imgRef.current.naturalWidth) : 600;

  const draw = useCallback(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const H = getH();
    canvas.width = CANVAS_W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, CANVAS_W, H);
    annotations.forEach((a, i) => {
      const hex = a.color ? (ANN_COLORS.find(c => c.id === a.color)?.hex || "#ef4444") : "#ef4444";
      const isSel = selected === i;
      if (a.type === "rect" || !a.type) {
        ctx.strokeStyle = hex; ctx.lineWidth = isSel ? 4 : 3;
        ctx.strokeRect(a.x*CANVAS_W, a.y*H, a.w*CANVAS_W, a.h*H);
        if (isSel) { ctx.fillStyle = "rgba(255,255,255,0.15)"; ctx.fillRect(a.x*CANVAS_W, a.y*H, a.w*CANVAS_W, a.h*H); }
      } else if (a.type === "text") {
        const fs = Math.round(CANVAS_W * 0.022);
        ctx.font = "bold " + fs + "px Arial";
        ctx.fillStyle = hex;
        ctx.fillText(a.text, a.x*CANVAS_W, a.y*H);
        if (isSel) {
          const m = ctx.measureText(a.text);
          ctx.strokeStyle = hex; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
          ctx.strokeRect(a.x*CANVAS_W-3, a.y*H-fs-2, m.width+6, fs+6);
          ctx.setLineDash([]);
        }
      }
    });
    if (drawing && start && current && tool === "rect") {
      const hex = ANN_COLORS.find(c => c.id === color)?.hex || "#ef4444";
      ctx.strokeStyle = hex; ctx.lineWidth = 3;
      ctx.strokeRect(Math.min(start.x,current.x)*CANVAS_W, Math.min(start.y,current.y)*H, Math.abs(current.x-start.x)*CANVAS_W, Math.abs(current.y-start.y)*H);
    }
  }, [annotations, drawing, start, current, imgLoaded, tool, color, selected]);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src = imageSrc;
  }, [imageSrc]);
  useEffect(() => { draw(); }, [draw]);

  const getPos = e => { const c=canvasRef.current, rect=c.getBoundingClientRect(); return {x:(e.clientX-rect.left)/rect.width,y:(e.clientY-rect.top)/rect.height}; };
  const hitTest = pos => {
    for (let i=annotations.length-1;i>=0;i--) {
      const a=annotations[i];
      if (a.type==="rect"||!a.type){if(pos.x>=a.x&&pos.x<=a.x+a.w&&pos.y>=a.y&&pos.y<=a.y+a.h)return i;}
      else if(a.type==="text"){const aw=a.text.length*0.022*0.6;if(pos.x>=a.x-0.005&&pos.x<=a.x+aw&&pos.y>=a.y-0.022-0.005&&pos.y<=a.y+0.01)return i;}
    }
    return -1;
  };
  const onMD = e => {
    const pos=getPos(e);
    if(tool==="select"){const hit=hitTest(pos);if(hit>=0){setSelected(hit);setDraggingAnn(true);const a=annotations[hit];setDragOffset({dx:pos.x-a.x,dy:pos.y-a.y});}else setSelected(null);}
    else if(tool==="rect"){setSelected(null);setDrawing(true);setStart(pos);setCurrent(pos);}
    else if(tool==="text"){setSelected(null);setPendingText(pos);setTextInput("");}
  };
  const onMM = e => {
    const pos=getPos(e);
    if(tool==="rect"&&drawing)setCurrent(pos);
    if(tool==="select"&&draggingAnn&&selected!==null&&dragOffset)onChange(annotations.map((a,i)=>i!==selected?a:{...a,x:pos.x-dragOffset.dx,y:pos.y-dragOffset.dy}));
  };
  const onMU = e => {
    if(tool==="rect"&&drawing&&start){const p=getPos(e),r={type:"rect",color,x:Math.min(start.x,p.x),y:Math.min(start.y,p.y),w:Math.abs(p.x-start.x),h:Math.abs(p.y-start.y)};if(r.w>0.01&&r.h>0.01)onChange([...annotations,r]);setDrawing(false);setStart(null);setCurrent(null);}
    if(draggingAnn){setDraggingAnn(false);setDragOffset(null);}
  };
  const addText=()=>{if(!textInput.trim()||!pendingText)return;onChange([...annotations,{type:"text",color,x:pendingText.x,y:pendingText.y,text:textInput.trim()}]);setPendingText(null);setTextInput("");};
  const saveEditText=()=>{if(!editingText)return;if(!editingText.value.trim())onChange(annotations.filter((_,i)=>i!==editingText.index));else onChange(annotations.map((a,i)=>i===editingText.index?{...a,text:editingText.value.trim()}:a));setEditingText(null);setSelected(null);};
  const deleteSelected=()=>{if(selected===null)return;onChange(annotations.filter((_,i)=>i!==selected));setSelected(null);};
  const H=imgLoaded?getH():600;
  const selAnn=selected!==null?annotations[selected]:null;
  const getCursor=()=>tool==="select"?(draggingAnn?"grabbing":"default"):tool==="text"?"text":"crosshair";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:"#0f172a"}}>
      <div style={{flexShrink:0,background:"#1e293b",padding:"10px 16px",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>Annotate Screenshot</span>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",border:"1px solid #475569",borderRadius:8,overflow:"hidden"}}>
            {[{id:"select",label:"Select"},{id:"rect",label:"Rect"},{id:"text",label:"Text"}].map(t=>(
              <button key={t.id} onClick={()=>setTool(t.id)} style={{border:"none",padding:"5px 12px",fontSize:12,fontWeight:600,cursor:"pointer",background:tool===t.id?"#f8fafc":"#0f172a",color:tool===t.id?"#1e293b":"#94a3b8"}}>{t.label}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            {ANN_COLORS.map(c=>(<button key={c.id} onClick={()=>setColor(c.id)} title={c.label} style={{width:22,height:22,borderRadius:"50%",background:c.hex,border:color===c.id?"3px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,border:"1px solid #475569",borderRadius:8,padding:"4px 8px",background:"#0f172a"}}>
            <button onClick={()=>setScale(s=>Math.max(s-0.25,0.25))} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",lineHeight:1}}>-</button>
            <span onClick={()=>setScale(1)} style={{fontSize:11,color:"#cbd5e1",fontWeight:600,cursor:"pointer",minWidth:32,textAlign:"center"}}>{Math.round(scale*100)}%</span>
            <button onClick={()=>setScale(s=>Math.min(s+0.25,3))} style={{border:"none",background:"none",cursor:"pointer",fontSize:16,color:"#94a3b8",lineHeight:1}}>+</button>
          </div>
          {selAnn&&(<div style={{display:"flex",gap:6,alignItems:"center",borderLeft:"1px solid #475569",paddingLeft:8}}>
            {selAnn.type==="text"&&<button onClick={()=>setEditingText({index:selected,value:selAnn.text})} style={{border:"1px solid #475569",background:"#0f172a",borderRadius:7,padding:"4px 10px",fontSize:12,color:"#cbd5e1",cursor:"pointer",fontWeight:600}}>Edit text</button>}
            <button onClick={deleteSelected} style={{border:"1px solid #7f1d1d",background:"#0f172a",borderRadius:7,padding:"4px 10px",fontSize:12,color:"#f87171",cursor:"pointer",fontWeight:600}}>Delete</button>
          </div>)}
          <button onClick={()=>onChange(annotations.slice(0,-1))} disabled={!annotations.length} style={{border:"1px solid #475569",background:"#0f172a",borderRadius:8,padding:"5px 10px",fontSize:12,color:annotations.length?"#cbd5e1":"#475569",cursor:annotations.length?"pointer":"default",fontWeight:600}}>Undo</button>
          <button onClick={()=>{onChange([]);setSelected(null);}} disabled={!annotations.length} style={{border:"1px solid #7f1d1d",background:"#0f172a",borderRadius:8,padding:"5px 10px",fontSize:12,color:annotations.length?"#f87171":"#7f1d1d",cursor:annotations.length?"pointer":"default",fontWeight:600}}>Clear</button>
          <button onClick={onClose} style={{border:"none",background:"#f8fafc",borderRadius:8,padding:"5px 16px",fontSize:12,color:"#1e293b",cursor:"pointer",fontWeight:700}}>Done</button>
        </div>
      </div>
      <div style={{flex:1,overflow:"auto",padding:20,display:"flex",justifyContent:"center",alignItems:"flex-start"}}>
        <div style={{position:"relative",flexShrink:0,width:Math.round(CANVAS_W*scale)+"px",height:Math.round(H*scale)+"px"}}>
          <canvas ref={canvasRef} width={CANVAS_W} height={H} onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU}
            style={{cursor:getCursor(),display:"block",width:"100%",height:"100%",borderRadius:8}}/>
          {pendingText&&(<div style={{position:"absolute",left:pendingText.x*100+"%",top:pendingText.y*100+"%",zIndex:10,display:"flex",gap:4,alignItems:"center",background:"#fff",borderRadius:8,padding:"6px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.3)",transform:"translateY(-100%)"}}>
            <input autoFocus value={textInput} onChange={e=>setTextInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")addText();if(e.key==="Escape")setPendingText(null);}} placeholder="Type text..." style={{border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",fontSize:13,outline:"none",width:160}}/>
            <button onClick={addText} style={{border:"none",background:"#1e293b",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#fff",cursor:"pointer",fontWeight:600}}>Add</button>
            <button onClick={()=>setPendingText(null)} style={{border:"none",background:"#f1f5f9",borderRadius:6,padding:"4px 8px",fontSize:12,color:"#64748b",cursor:"pointer"}}>X</button>
          </div>)}
          {editingText&&selAnn&&selAnn.type==="text"&&(<div style={{position:"absolute",left:selAnn.x*100+"%",top:selAnn.y*100+"%",zIndex:10,display:"flex",gap:4,alignItems:"center",background:"#fff",borderRadius:8,padding:"6px 8px",boxShadow:"0 4px 16px rgba(0,0,0,0.3)",transform:"translateY(-100%)"}}>
            <input autoFocus value={editingText.value} onChange={e=>setEditingText({...editingText,value:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")saveEditText();if(e.key==="Escape")setEditingText(null);}} style={{border:"1px solid #e2e8f0",borderRadius:6,padding:"4px 8px",fontSize:13,outline:"none",width:160}}/>
            <button onClick={saveEditText} style={{border:"none",background:"#1e293b",borderRadius:6,padding:"4px 10px",fontSize:12,color:"#fff",cursor:"pointer",fontWeight:600}}>Save</button>
            <button onClick={()=>setEditingText(null)} style={{border:"none",background:"#f1f5f9",borderRadius:6,padding:"4px 8px",fontSize:12,color:"#64748b",cursor:"pointer"}}>X</button>
          </div>)}
        </div>
      </div>
    </div>
  );
}

async function buildCanvas(cards, mode, appName) {
  const SCALE=3,CW=1200,GAP=28,CARD_GAP=24,LABEL_H=40,SLOT_W=(CW-GAP)/2;
  const APP_HEADER = appName ? 64 : 0;
  const pairs=[];
  for(const card of cards){const a=card.oldImg?await loadImg(card.oldImg):null,b=card.newImg?await loadImg(card.newImg):null;pairs.push([a,b]);}
  const cardImgHeights=cards.map((c,ci)=>{const[a,b]=pairs[ci];let ratio=0;if(a&&a.width>0)ratio=Math.max(ratio,a.height/a.width);if(b&&b.width>0)ratio=Math.max(ratio,b.height/b.width);return ratio>0?Math.round(SLOT_W*ratio):400;});
  const cardHeights=cards.map((c,ci)=>{let h=LABEL_H+cardImgHeights[ci];if(c.title)h+=56;if(c.subtitle)h+=44;if(c.tags&&c.tags.length)h+=44;return h;});
  const totalH=APP_HEADER+CARD_GAP+cardHeights.reduce((s,h,i)=>s+h+28+(i<cardHeights.length-1?CARD_GAP:0),0);
  const canvas=document.createElement("canvas");canvas.width=CW*SCALE;canvas.height=totalH*SCALE;
  const ctx=canvas.getContext("2d");ctx.scale(SCALE,SCALE);ctx.fillStyle="#fff";ctx.fillRect(0,0,CW,totalH);
  let y=0;
  if(appName){
    ctx.fillStyle="#1e293b";ctx.font="bold 36px Arial";ctx.textAlign="center";
    ctx.fillText(appName,CW/2,y+44);
    ctx.fillStyle="#e2e8f0";ctx.fillRect(0,y+APP_HEADER-4,CW,1);
    y+=APP_HEADER;
  }
  y+=CARD_GAP;
  for(let ci=0;ci<cards.length;ci++){
    const card=cards[ci],[imgA,imgB]=pairs[ci],imgH=cardImgHeights[ci],cardH=cardHeights[ci];
    ctx.fillStyle="#fff";rrect(ctx,0,y,CW,cardH+28,0);ctx.fill();
    ctx.fillStyle="#e2e8f0";ctx.fillRect(0,y+cardH+28,CW,1);
    if(card.title){ctx.fillStyle="#1e293b";ctx.font="bold 30px Arial";ctx.textAlign="center";ctx.fillText(card.title,CW/2,y+38);y+=56;}
    if(card.tags&&card.tags.length){
      const tagWidths=card.tags.map(tid=>{const tag=TAGS.find(t=>t.id===tid);return tag?tag.label.length*8+32:0;});
      const totalTagW=tagWidths.reduce((a,b)=>a+b,0)+(card.tags.length-1)*12;
      let tx=CW/2-totalTagW/2;
      card.tags.forEach((tid,ti)=>{const tag=TAGS.find(t=>t.id===tid);if(!tag)return;const tw=tagWidths[ti];ctx.fillStyle=tag.bg;ctx.strokeStyle=tag.color;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect(tx,y,tw,28,14);ctx.fill();ctx.stroke();ctx.fillStyle=tag.color;ctx.font="bold 12px Arial";ctx.textAlign="center";ctx.fillText(tag.label,tx+tw/2,y+18);tx+=tw+12;});
      y+=44;
    }
    const leftX=0,rightX=SLOT_W+GAP;
    for(let li=0;li<2;li++){const lx=li===0?leftX:rightX,lbl=li===0?(card.newLabel||"After"):(card.oldLabel||"Before");ctx.fillStyle="#f1f5f9";rrectTop(ctx,lx,y,SLOT_W,LABEL_H,10);ctx.fill();ctx.fillStyle="#64748b";ctx.font="bold 16px Arial";ctx.textAlign="center";ctx.fillText(lbl,lx+SLOT_W/2,y+LABEL_H/2+6);}
    y+=LABEL_H;
    const drawSlot=(img,isNone,x,anns)=>{
      ctx.save();rrectBot(ctx,x,y,SLOT_W,imgH,10);ctx.clip();ctx.fillStyle="#f8fafc";ctx.fillRect(x,y,SLOT_W,imgH);
      if(isNone||!img){ctx.fillStyle="#e2e8f0";ctx.fillRect(x,y,SLOT_W,imgH);ctx.fillStyle="#64748b";ctx.font="bold 18px Arial";ctx.textAlign="center";ctx.fillText("No previous version",x+SLOT_W/2,y+imgH/2-10);ctx.fillStyle="#94a3b8";ctx.font="14px Arial";ctx.fillText("This is a new feature",x+SLOT_W/2,y+imgH/2+16);}
      else{const s=Math.min(SLOT_W/img.width,imgH/img.height),dw=img.width*s,dh=img.height*s;ctx.drawImage(img,x+(SLOT_W-dw)/2,y+(imgH-dh)/2,dw,dh);if(anns&&anns.length){anns.forEach(a=>{const hex=a.color?(ANN_COLORS.find(c=>c.id===a.color)?.hex||"#ef4444"):"#ef4444";if(a.type==="rect"||!a.type){ctx.strokeStyle=hex;ctx.lineWidth=3;ctx.strokeRect(x+a.x*SLOT_W,y+a.y*imgH,a.w*SLOT_W,a.h*imgH);}else if(a.type==="text"){ctx.fillStyle=hex;ctx.font="bold "+Math.round(SLOT_W*0.022)+"px Arial";ctx.fillText(a.text,x+a.x*SLOT_W,y+a.y*imgH);}});}}
      ctx.restore();
    };
    drawSlot(imgB,card.newIsNew,leftX,card.newAnnotations);drawSlot(imgA,card.oldIsNew,rightX,card.oldAnnotations);
    y+=imgH;
    if(card.subtitle){ctx.fillStyle="#64748b";ctx.font="15px Arial";ctx.textAlign="center";ctx.fillText(card.subtitle,CW/2,y+28);y+=44;}
    y+=CARD_GAP+28;
  }
  return canvas;
}

async function doDownload(cards,mode,appName){
  const done=cards.filter(c=>c.done&&(c.oldImg||c.oldIsNew)&&(c.newImg||c.newIsNew));
  if(!done.length)return;
  const perPage=2,chunks=[];
  for(let i=0;i<done.length;i+=perPage)chunks.push(done.slice(i,i+perPage));
  for(let i=0;i<chunks.length;i++){
    const canvas=await buildCanvas(chunks[i],mode,appName),blob=await new Promise(res=>canvas.toBlob(res,"image/png")),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;const suffix=chunks.length>1?"-p"+(i+1):"";a.download=mode+"-comparisons"+suffix+".png";
    document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
}

const iStyle={width:"100%",boxSizing:"border-box",border:"1px solid #e2e8f0",borderRadius:8,padding:"9px 12px",fontSize:14,outline:"none",color:"#1e293b",background:"#f8fafc"};
const Lbl=({children})=><div style={{fontWeight:600,fontSize:12,color:"#374151",marginBottom:5}}>{children}</div>;
const newCard=id=>({id,title:"",subtitle:"",oldLabel:"2025",newLabel:"2026",oldImg:null,newImg:null,oldIsNew:false,newIsNew:false,oldAnnotations:[],newAnnotations:[],tags:[],done:false});

function ModeSelector({onSelect}){
  const [hovered,setHovered]=useState(null);
  const modes=[{id:"web",icon:"🖥️",label:"Web",desc:"Desktop / browser screenshots",sub:"Landscape, wide layouts"},{id:"mobile",icon:"📱",label:"Mobile",desc:"Mobile screenshots",sub:"Portrait layout"}];
  return(
    <div style={{fontFamily:"Inter,Arial,sans-serif",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 20px",background:"#f8fafc"}}>
      <div style={{textAlign:"center",marginBottom:48}}>
        <h1 style={{margin:0,fontSize:28,fontWeight:700,color:"#1e293b"}}>App Version Comparison</h1>
        <p style={{margin:"10px 0 0",color:"#94a3b8",fontSize:15}}>Compare screenshots for Web or Mobile.</p>
      </div>
      <div style={{display:"flex",gap:24,flexWrap:"wrap",justifyContent:"center",alignItems:"stretch"}}>
        {modes.map(m=>(
          <div key={m.id} onClick={()=>onSelect(m.id)} onMouseEnter={()=>setHovered(m.id)} onMouseLeave={()=>setHovered(null)}
            style={{width:220,borderRadius:16,overflow:"hidden",cursor:"pointer",boxShadow:hovered===m.id?"0 8px 24px rgba(0,0,0,0.12)":"0 2px 8px rgba(0,0,0,0.07)",transform:hovered===m.id?"translateY(-3px)":"none",transition:"all 0.2s",border:"1.5px solid",borderColor:hovered===m.id?"#94a3b8":"#e2e8f0",display:"flex",flexDirection:"column"}}>
            <div style={{background:"#e2e8f0",padding:"28px 0",textAlign:"center",flexShrink:0}}><div style={{fontSize:40}}>{m.icon}</div></div>
            <div style={{background:"#fff",padding:"18px 20px 22px",flex:1}}>
              <div style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:5}}>{m.label}</div>
              <div style={{fontSize:13,color:"#475569",fontWeight:500}}>{m.desc}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>{m.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnnotatedImage({src,annotations}){
  const canvasRef=useRef(),imgRef=useRef();
  const redraw=()=>{const canvas=canvasRef.current,img=imgRef.current;if(!canvas||!img)return;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);(annotations||[]).forEach(a=>{const hex=a.color?(ANN_COLORS.find(c=>c.id===a.color)?.hex||"#ef4444"):"#ef4444";if(a.type==="rect"||!a.type){ctx.strokeStyle=hex;ctx.lineWidth=Math.max(2,img.naturalWidth*0.003);ctx.strokeRect(a.x*img.naturalWidth,a.y*img.naturalHeight,a.w*img.naturalWidth,a.h*img.naturalHeight);}else if(a.type==="text"){ctx.fillStyle=hex;ctx.font="bold "+Math.round(img.naturalWidth*0.022)+"px Arial";ctx.fillText(a.text,a.x*img.naturalWidth,a.y*img.naturalHeight);}});};
  useEffect(()=>{const img=new window.Image();img.onload=()=>{imgRef.current=img;redraw();};img.src=src;},[src]);
  useEffect(()=>{redraw();},[annotations]);
  return <canvas ref={canvasRef} style={{width:"100%",display:"block"}}/>;
}

function UploadBox({label,image,onUpload,isNoVersion,onToggleNoVersion,annotations,onAnnotate}){
  const inputRef=useRef(),pasteRef=useRef();
  const [tab,setTab]=useState("upload"),[pasting,setPasting]=useState(false),[dragging,setDragging]=useState(false);
  const handleDrop=e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(f&&f.type.startsWith("image/"))readFile(f,onUpload);};
  const handlePaste=e=>{const items=(e.clipboardData&&e.clipboardData.items)||[];for(const item of items){if(item.type.startsWith("image/")){readFile(item.getAsFile(),v=>{onUpload(v);setTab("upload");});break;}}};
  return(
    <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
      {!image&&!isNoVersion&&(
        <div style={{display:"flex",background:"#f1f5f9",borderRadius:8,padding:3,gap:2}}>
          {["upload","paste"].map(t=>(<button key={t} onClick={()=>setTab(t)} style={{flex:1,border:"none",borderRadius:6,padding:"8px 0",fontSize:13,fontWeight:600,cursor:"pointer",background:tab===t?"#fff":"transparent",color:tab===t?"#374151":"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span>{t==="upload"?"📁":"📋"}</span><span>{t==="upload"?"Upload":"Paste"}</span></button>))}
        </div>
      )}
      {isNoVersion?(
        <div style={{width:"100%",boxSizing:"border-box",border:"2px dashed #cbd5e1",borderRadius:12,background:"#f8fafc",minHeight:220,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8}}>
          <div style={{fontSize:32}}>✨</div>
          <div style={{fontSize:13,fontWeight:600,color:"#475569"}}>No previous version</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>This is a new feature</div>
        </div>
      ):(
        <div style={{position:"relative"}}>
          <div onClick={()=>{if(image)return;if(tab==="upload")inputRef.current.click();else{setPasting(true);pasteRef.current&&pasteRef.current.focus();}}}
            onPaste={tab==="paste"?handlePaste:undefined}
            onDragOver={tab==="upload"&&!image?e=>{e.preventDefault();setDragging(true);}:undefined}
            onDragLeave={tab==="upload"&&!image?()=>setDragging(false):undefined}
            onDrop={tab==="upload"&&!image?handleDrop:undefined}
            tabIndex={tab==="paste"&&!image?0:undefined} ref={tab==="paste"?pasteRef:undefined}
            onFocus={()=>tab==="paste"&&setPasting(true)} onBlur={()=>setPasting(false)}
            style={{width:"100%",boxSizing:"border-box",border:image?"2px solid #94a3b8":(dragging||pasting)?"2px dashed #475569":"2px dashed #cbd5e1",borderRadius:12,background:image?"transparent":"#f8fafc",minHeight:220,display:"flex",alignItems:"center",justifyContent:"center",cursor:image?"default":"pointer",overflow:"hidden",transition:"all 0.2s",outline:"none"}}>
            {image?<AnnotatedImage src={image} annotations={annotations||[]}/>:(
              <div style={{textAlign:"center",color:dragging?"#475569":"#94a3b8",padding:20}}>
                <div style={{fontSize:32,marginBottom:6}}>{tab==="upload"?(dragging?"⬇️":"📁"):(pasting?"⌨️":"📋")}</div>
                <div style={{fontSize:13,fontWeight:500}}>{tab==="upload"?(dragging?"Drop to upload":"Click or drag & drop"):(pasting?"Press Ctrl+V / Cmd+V":"Click, then paste")}</div>
                <div style={{fontSize:11,marginTop:3}}>PNG, JPG, WEBP</div>
              </div>
            )}
          </div>
          {image&&(<button onClick={onAnnotate} style={{position:"absolute",bottom:8,right:8,border:"none",background:"#1e293b",borderRadius:7,padding:"6px 12px",fontSize:12,color:"#fff",cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:4,boxShadow:"0 2px 8px rgba(0,0,0,0.25)"}}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="1" width="10" height="10" rx="1" stroke="#fff" strokeWidth="1.5"/></svg>
            {annotations&&annotations.length>0?"Edit annotations ("+annotations.length+")":"Annotate"}
          </button>)}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)readFile(f,onUpload);}}/>
      {image&&!isNoVersion&&(<button onClick={()=>onUpload(null)} style={{border:"1px solid #e2e8f0",background:"#f8fafc",borderRadius:7,padding:"4px 0",fontSize:12,color:"#94a3b8",cursor:"pointer"}}>Remove</button>)}
      {!image&&(<button onClick={onToggleNoVersion} style={{border:"1px solid #e2e8f0",background:isNoVersion?"#f1f5f9":"#fff",borderRadius:7,padding:"5px 0",fontSize:12,color:isNoVersion?"#475569":"#94a3b8",cursor:"pointer",fontWeight:500}}>{isNoVersion?"Upload screenshot instead":"No previous version"}</button>)}
      <div style={{textAlign:"center",fontWeight:600,fontSize:13,color:"#475569",letterSpacing:"0.04em",background:"#f1f5f9",borderRadius:8,padding:"5px 0"}}>{label}</div>
    </div>
  );
}

function ComparisonCard({card,index,total,mode,onChange,onRemove}){
  const {title,subtitle,oldLabel,newLabel,oldImg,newImg,oldIsNew,newIsNew,oldAnnotations,newAnnotations,tags,done}=card;
  const ready=(newImg||newIsNew)&&(oldImg||oldIsNew);
  const toggleTag=id=>{const cur=tags||[];onChange({tags:cur.includes(id)?cur.filter(t=>t!==id):[...cur,id]});};
  const labelBar=lbl=>(<div style={{borderRadius:"10px 10px 0 0",background:"#f1f5f9",padding:"7px 0",textAlign:"center",fontWeight:600,fontSize:13,color:"#64748b",letterSpacing:"0.04em"}}>{lbl}</div>);
  const placeholder=()=>(<div style={{border:"1px solid #e2e8f0",borderTop:"none",borderRadius:"0 0 10px 10px",background:"#f8fafc",minHeight:160,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6}}><div style={{fontSize:28}}>✨</div><div style={{fontSize:13,fontWeight:600,color:"#475569"}}>No previous version</div><div style={{fontSize:11,color:"#94a3b8"}}>This is a new feature</div></div>);
  return(
    <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",background:"#f8fafc",borderBottom:"1px solid #e2e8f0"}}>
        <span style={{fontWeight:600,fontSize:13,color:"#64748b"}}>Comparison {index+1}</span>
        <div style={{display:"flex",gap:8}}>
          {done&&<button onClick={()=>onChange({done:false})} style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:7,padding:"4px 12px",fontSize:12,color:"#64748b",cursor:"pointer",fontWeight:600}}>Edit</button>}
          {total>1&&<button onClick={onRemove} style={{border:"1px solid #fecaca",background:"#fff",borderRadius:7,padding:"4px 12px",fontSize:12,color:"#f87171",cursor:"pointer",fontWeight:600}}>Remove</button>}
        </div>
      </div>
      <div style={{padding:20}}>
        {!done?(
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={{display:"flex",gap:12}}>
              <div style={{flex:1}}><Lbl>Title</Lbl><input value={title} onChange={e=>onChange({title:e.target.value})} placeholder="e.g. Home Screen Redesign" style={iStyle}/></div>
              <div style={{flex:1}}><Lbl>Subtitle</Lbl><input value={subtitle} onChange={e=>onChange({subtitle:e.target.value})} placeholder="e.g. Key improvements" style={iStyle}/></div>
            </div>
            <div style={{display:"flex",gap:12}}>
              <div style={{flex:1}}><Lbl>Newer version label</Lbl><input value={newLabel} onChange={e=>onChange({newLabel:e.target.value})} style={iStyle}/></div>
              <div style={{flex:1}}><Lbl>Older version label</Lbl><input value={oldLabel} onChange={e=>onChange({oldLabel:e.target.value})} style={iStyle}/></div>
            </div>
            <div>
              <Lbl>Tags</Lbl>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                {TAGS.map(t=>{const active=(tags||[]).includes(t.id);return(<button key={t.id} onClick={()=>toggleTag(t.id)} style={{border:"1.5px solid "+(active?t.color:"#e2e8f0"),borderRadius:20,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",background:active?t.bg:"#fff",color:active?t.color:"#94a3b8",transition:"all 0.15s"}}>{t.label}</button>);})}
              </div>
            </div>
            <div style={{display:"flex",gap:16}}>
              <UploadBox label={newLabel||"Newer"} image={newImg} isNoVersion={newIsNew} annotations={newAnnotations} onAnnotate={()=>onChange({_annotating:"new"})} onToggleNoVersion={()=>onChange({newIsNew:!newIsNew,newImg:null,newAnnotations:[]})} onUpload={v=>onChange({newImg:v,newAnnotations:[],done:false})}/>
              <UploadBox label={oldLabel||"Older"} image={oldImg} isNoVersion={oldIsNew} annotations={oldAnnotations} onAnnotate={()=>onChange({_annotating:"old"})} onToggleNoVersion={()=>onChange({oldIsNew:!oldIsNew,oldImg:null,oldAnnotations:[]})} onUpload={v=>onChange({oldImg:v,oldAnnotations:[],done:false})}/>
            </div>
            <button disabled={!ready} onClick={()=>onChange({done:true})} style={{background:ready?"#1e293b":"#e2e8f0",color:ready?"#fff":"#94a3b8",border:"none",borderRadius:10,padding:"13px 0",fontSize:14,fontWeight:600,cursor:ready?"pointer":"not-allowed"}}>{ready?"Generate Comparison →":"Upload both images to continue"}</button>
          </div>
        ):(
          <div>
            {title&&<h2 style={{textAlign:"center",margin:"0 0 12px",fontSize:22,fontWeight:700,color:"#1e293b"}}>{title}</h2>}
            {tags&&tags.length>0&&(<div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:14}}>{TAGS.filter(t=>(tags||[]).includes(t.id)).map(t=>(<span key={t.id} style={{border:"1.5px solid "+t.color,borderRadius:20,padding:"3px 12px",fontSize:12,fontWeight:600,background:t.bg,color:t.color}}>{t.label}</span>))}</div>)}
            <div style={{display:"flex",gap:16}}>
              <div style={{flex:1}}>{labelBar(newLabel)}{newIsNew?placeholder():(<div style={{borderRadius:"0 0 10px 10px",border:"1px solid #e2e8f0",borderTop:"none",overflow:"hidden"}}><AnnotatedImage src={newImg} annotations={newAnnotations||[]}/></div>)}</div>
              <div style={{flex:1}}>{labelBar(oldLabel)}{oldIsNew?placeholder():(<div style={{borderRadius:"0 0 10px 10px",border:"1px solid #e2e8f0",borderTop:"none",overflow:"hidden"}}><AnnotatedImage src={oldImg} annotations={oldAnnotations||[]}/></div>)}</div>
            </div>
            {subtitle&&<p style={{textAlign:"center",margin:"14px 0 0",color:"#64748b",fontSize:13}}>{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const [mode,setMode]=useState(null);
  const [appName,setAppName]=useState("");
  const [cards,setCards]=useState([newCard(1)]);
  const nextId=useRef(2);
  const [previewUrls,setPreviewUrls]=useState([]);
  const [previewIndex,setPreviewIndex]=useState(0);
  const [exporting,setExporting]=useState(false);
  const [previewing,setPreviewing]=useState(false);
  const [exportError,setExportError]=useState("");
  const [annotatingCard,setAnnotatingCard]=useState(null);

  if(!mode)return <ModeSelector onSelect={m=>{setMode(m);setCards([newCard(1)]);setPreviewUrls([]);setPreviewIndex(0);}}/>;

  const update=(id,patch)=>{
    if(patch._annotating){setAnnotatingCard({id,side:patch._annotating});return;}
    setCards(cs=>cs.map(c=>c.id===id?Object.assign({},c,patch):c));
  };
  const addCard=()=>{const last=cards[cards.length-1];setCards(cs=>[...cs,{...newCard(nextId.current++),newLabel:last?last.newLabel:"2026",oldLabel:last?last.oldLabel:"2025"}]);};
  const removeCard=id=>setCards(cs=>cs.filter(c=>c.id!==id));
  const doneCount=cards.filter(c=>c.done&&(c.oldImg||c.oldIsNew)&&(c.newImg||c.newIsNew)).length;

  const handleExport=async()=>{setExportError("");setExporting(true);try{await doDownload(cards,mode,appName);}catch(e){setExportError("Export failed: "+(e&&e.message?e.message:String(e)));}setExporting(false);};
  const handlePreview=async()=>{
    setExportError("");setPreviewing(true);
    try{
      const done=cards.filter(c=>c.done&&(c.oldImg||c.oldIsNew)&&(c.newImg||c.newIsNew));
      const perPage=2,urls=[],chunks=[];
      for(let i=0;i<done.length;i+=perPage)chunks.push(done.slice(i,i+perPage));
      for(const chunk of chunks){const canvas=await buildCanvas(chunk,mode,appName);urls.push({label:"Comparison",url:canvas.toDataURL("image/png")});}
      setPreviewUrls(urls);setPreviewIndex(0);
    }catch(e){setExportError("Preview failed: "+(e&&e.message?e.message:String(e)));}
    setPreviewing(false);
  };

  const annotCard=annotatingCard?cards.find(c=>c.id===annotatingCard.id):null;
  const annotImg=annotCard?(annotatingCard.side==="new"?annotCard.newImg:annotCard.oldImg):null;
  const annotAnns=annotCard?(annotatingCard.side==="new"?annotCard.newAnnotations:annotCard.oldAnnotations):[];

  if(annotatingCard&&annotCard&&annotImg){
    const key=annotatingCard.side==="new"?"newAnnotations":"oldAnnotations";
    return <div style={{fontFamily:"Inter,Arial,sans-serif",height:"100vh",overflow:"hidden"}}><AnnotationEditor imageSrc={annotImg} annotations={annotAnns||[]} mode={mode} onChange={v=>setCards(cs=>cs.map(c=>c.id===annotatingCard.id?Object.assign({},c,{[key]:v}):c))} onClose={()=>setAnnotatingCard(null)}/></div>;
  }

  return(
    <div style={{fontFamily:"Inter,Arial,sans-serif",maxWidth:1100,margin:"0 auto",padding:"32px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <div>
          <h1 style={{margin:0,fontSize:24,fontWeight:700,color:"#1e293b"}}>{mode==="web"?"Web":"Mobile"} Comparison Builder</h1>
          <p style={{margin:"4px 0 0",color:"#94a3b8",fontSize:13}}>{mode==="web"?"Desktop / browser screenshots":"Mobile screenshots — portrait layout"}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>{setCards([newCard(1)]);nextId.current=2;setExportError("");setPreviewUrls([]);setPreviewIndex(0);setAppName("");}}
            style={{border:"1px solid #fecaca",background:"#fff",borderRadius:10,padding:"8px 14px",fontSize:13,color:"#f87171",cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:6}}
            onMouseEnter={e=>e.currentTarget.style.background="#fef2f2"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 1.5-3.5L2 2" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 2v3h3" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Restart
          </button>
          <div style={{width:"1px",height:24,background:"#e2e8f0"}}/>
          <button onClick={()=>setMode(null)} style={{border:"1px solid #e2e8f0",background:"#fff",borderRadius:10,padding:"8px 16px",fontSize:13,color:"#64748b",cursor:"pointer",fontWeight:600}}>Change mode</button>
        </div>
      </div>

      {/* App name */}
      <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:20,marginBottom:24,boxShadow:"0 2px 12px rgba(0,0,0,0.04)"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1e293b",marginBottom:12}}>About this comparison</div>
        <div style={{maxWidth:400}}><Lbl>Name of App</Lbl><input value={appName} onChange={e=>setAppName(e.target.value)} placeholder="e.g. Zoom, Notion..." style={iStyle}/></div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:24}}>
        {cards.map((card,idx)=>(
          <ComparisonCard key={card.id} card={card} index={idx} total={cards.length} mode={mode} onChange={patch=>update(card.id,patch)} onRemove={()=>removeCard(card.id)}/>
        ))}
        <button onClick={addCard}
          onMouseEnter={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor="#94a3b8";}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.borderColor="#e2e8f0";}}
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,border:"2px dashed #e2e8f0",borderRadius:14,padding:"16px 0",background:"transparent",color:"#64748b",fontSize:15,fontWeight:600,cursor:"pointer"}}>
          <span style={{fontSize:20}}>+</span> Add Comparison
        </button>
        {exportError&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"12px 16px",color:"#ef4444",fontSize:13}}>{exportError}</div>}
        <div style={{display:"flex",gap:12}}>
          <button onClick={handlePreview} disabled={!doneCount||previewing||exporting} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#fff",color:doneCount?"#1e293b":"#94a3b8",border:"1.5px solid "+(doneCount?"#cbd5e1":"#e2e8f0"),borderRadius:14,padding:"14px 0",fontSize:15,fontWeight:600,cursor:doneCount&&!previewing&&!exporting?"pointer":"not-allowed"}}>
            {previewing?"Generating...":"Preview PNG"}
          </button>
          <button onClick={handleExport} disabled={!doneCount||exporting||previewing} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:doneCount&&!exporting?"#1e293b":"#e2e8f0",color:doneCount&&!exporting?"#fff":"#94a3b8",border:"none",borderRadius:14,padding:"14px 0",fontSize:15,fontWeight:600,cursor:doneCount&&!exporting?"pointer":"not-allowed"}}>
            {exporting?"Generating...":"Download PNG"+(doneCount>2?"s":"")}
          </button>
        </div>
      </div>

      {previewUrls.length>0&&(
        <div onClick={()=>setPreviewUrls([])} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",padding:"16px",overflowY:"auto",cursor:"pointer"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:16,padding:12,maxWidth:1200,width:"100%",boxShadow:"0 16px 48px rgba(0,0,0,0.3)",cursor:"default"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontWeight:600,fontSize:14,color:"#475569"}}>Preview (Page {previewIndex+1} of {previewUrls.length})</span>
                {previewUrls.length>1&&(<div style={{display:"flex",gap:6}}>
                  <button onClick={()=>setPreviewIndex(i=>Math.max(0,i-1))} disabled={previewIndex===0} style={{border:"1px solid #e2e8f0",background:"#f8fafc",borderRadius:7,padding:"3px 12px",fontSize:13,color:previewIndex===0?"#cbd5e1":"#475569",cursor:previewIndex===0?"default":"pointer",fontWeight:600}}>←</button>
                  <button onClick={()=>setPreviewIndex(i=>Math.min(previewUrls.length-1,i+1))} disabled={previewIndex===previewUrls.length-1} style={{border:"1px solid #e2e8f0",background:"#f8fafc",borderRadius:7,padding:"3px 12px",fontSize:13,color:previewIndex===previewUrls.length-1?"#cbd5e1":"#475569",cursor:previewIndex===previewUrls.length-1?"default":"pointer",fontWeight:600}}>→</button>
                </div>)}
              </div>
              <button onClick={()=>setPreviewUrls([])} style={{border:"1px solid #e2e8f0",background:"#f8fafc",borderRadius:8,padding:"4px 14px",fontSize:13,color:"#64748b",cursor:"pointer",fontWeight:600}}>Close</button>
            </div>
            <img src={previewUrls[previewIndex]?.url} alt="Preview" style={{width:"100%",borderRadius:8,display:"block"}}/>
          </div>
        </div>
      )}
    </div>
  );
}