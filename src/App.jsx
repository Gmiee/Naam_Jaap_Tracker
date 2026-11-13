import React, { useEffect, useMemo, useState } from "react";
import { Activity, Bell, BookOpen, Check, ChevronDown, Cloud, CloudOff, Download, Flame, History, Moon, Plus, RotateCcw, Settings, Sun, Target, Upload, Vibrate, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const MISSION = 80000000;
const STORAGE_KEY = "naam-jaap-mission-v1";
const API_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
const fmt = n => new Intl.NumberFormat("en-IN").format(Number(n || 0));
const readable = n => n >= 10000000 ? `${(n/10000000).toFixed(2).replace(/\.00$/,"")} Crore` : n >= 100000 ? `${(n/100000).toFixed(2).replace(/\.00$/,"")} Lakh` : fmt(n);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dateLabel = key => new Date(`${key}T00:00:00`).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
const initial = { total:0, dailyGoal:1008, history:[], pending:[], updatedAt:null, haptics:true, theme:"light" };
function loadState(){ try { return {...initial,...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}; } catch { return initial; } }

function App(){
  const [data,setData] = useState(loadState);
  const [manual,setManual] = useState("");
  const [goalInput,setGoalInput] = useState(String(data.dailyGoal));
  const [editTotal,setEditTotal] = useState(String(data.total));
  const [toast,setToast] = useState("");
  const [tab,setTab] = useState("mission");
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [syncing,setSyncing] = useState(false);
  const [syncStatus,setSyncStatus] = useState(API_URL ? "ready" : "offline");
  const [showModal,setShowModal] = useState(false);
  const today = todayKey();

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY,JSON.stringify(data)); },[data]);
  useEffect(()=>{ document.documentElement.dataset.theme=data.theme; },[data.theme]);
  useEffect(()=>{ setEditTotal(String(data.total)); },[data.total]);

  const dailyMap = useMemo(()=>{
    const map={};
    data.history.forEach(x=>{map[x.date]=(map[x.date]||0)+Number(x.count||0);});
    return map;
  },[data.history]);
  const todayCount = dailyMap[today] || 0;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;
  const yesterdayCount = dailyMap[yesterdayKey] || 0;
  const remaining = Math.max(0,MISSION-data.total);
  const overall = Math.min(100,data.total/MISSION*100);
  const dailyPct = Math.min(100,todayCount/Math.max(1,data.dailyGoal)*100);
  const bestDay = Math.max(0,...Object.values(dailyMap));
  const dates = Object.keys(dailyMap).sort();
  const streak = useMemo(()=>{
    let n=0, d=new Date();
    if(!dailyMap[today]) d.setDate(d.getDate()-1);
    while(true){const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; if(!dailyMap[k]) break; n++; d.setDate(d.getDate()-1);}
    return n;
  },[dailyMap,today]);
  const milestones=[100000,500000,1000000,5000000,10000000,25000000,50000000,80000000];
  const nextMilestone=milestones.find(x=>x>data.total)||MISSION;
  const phases=[{name:"Foundation",end:5000000,purpose:"Build consistency and discipline"},{name:"Momentum",end:20000000,purpose:"Turn daily practice into a steady habit"},{name:"Dedication",end:50000000,purpose:"Deepen your commitment"},{name:"Completion",end:MISSION,purpose:"Continue steadily towards the mission"}];
  const phase=phases.find(p=>data.total<p.end)||phases[3];
  const previousEnd=phases[phases.indexOf(phase)-1]?.end||0;
  const phasePct=Math.min(100,Math.max(0,(data.total-previousEnd)/(phase.end-previousEnd)*100));

  function notify(message){setToast(message);window.clearTimeout(notify.timer);notify.timer=window.setTimeout(()=>setToast(""),2600);}
  function addCount(amount=1){
    const count=Math.floor(Number(amount));
    if(!Number.isFinite(count)||count<1){notify("Enter a valid count.");return;}
    const entry={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,date:todayKey(),time:new Date().toISOString(),count,source:count===1?"tap":"manual"};
    setData(prev=>({...prev,total:prev.total+count,history:[...prev.history,entry],pending:[...prev.pending,entry],updatedAt:new Date().toISOString()}));
    if(data.haptics && navigator.vibrate) navigator.vibrate(12);
    if(Math.floor((data.total+count)/100000)>Math.floor(data.total/100000)) setShowModal(true);
  }
  function undoLast(){
    const last=[...data.history].reverse().find(x=>x.date===today);
    if(!last){notify("No count to undo today.");return;}
    setData(prev=>({...prev,total:Math.max(0,prev.total-last.count),history:prev.history.filter(x=>x.id!==last.id),pending:prev.pending.filter(x=>x.id!==last.id),updatedAt:new Date().toISOString()}));
    notify("Last entry removed.");
  }
  function saveGoal(){const n=Math.floor(Number(goalInput));if(n<1){notify("Daily goal must be at least 1.");return;}setData(p=>({...p,dailyGoal:n}));notify("Daily goal saved.");}
  function updateTotal(){const n=Math.floor(Number(editTotal));if(!Number.isFinite(n)||n<0){notify("Enter a valid total.");return;}const diff=n-data.total;const entry={id:crypto.randomUUID?.()||String(Date.now()),date:todayKey(),time:new Date().toISOString(),count:diff,source:"adjustment"};setData(p=>({...p,total:n,history:diff?[...p.history,entry]:p.history,pending:diff?[...p.pending,entry]:p.pending,updatedAt:new Date().toISOString()}));notify("Total updated.");}
  async function syncToSheets(){
    if(!API_URL){notify("Add your Apps Script URL in .env first.");setSyncStatus("offline");return;}
    if(!data.pending.length){notify("Everything is already queued for sync.");return;}
    setSyncing(true);setSyncStatus("syncing");
    try{
      // Apps Script accepts text/plain POST. no-cors avoids preflight; the browser cannot read its response.
      // Entries remain locally stored until you verify that they appear in your Sheet.
      await fetch(API_URL,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"append",records:data.pending})});
      setSyncStatus("sent");
      notify("Sync request sent. Verify the rows in Google Sheets.");
    }catch(e){setSyncStatus("error");notify("Could not send sync request. Your local data is safe.");}
    finally{setSyncing(false);}
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`naam-jaap-backup-${today}.json`;a.click();URL.revokeObjectURL(a.href);
  }
  function exportCSV(){
    const rows=[["ID","Date","Time","Count","Source"],...data.history.map(x=>[x.id,x.date,x.time,x.count,x.source])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="naam-jaap-history.csv";a.click();URL.revokeObjectURL(a.href);
  }
  function importBackup(file){
    if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const incoming=JSON.parse(reader.result);if(!Array.isArray(incoming.history)||typeof incoming.total!=="number")throw Error();setData(p=>({...p,...incoming,pending:incoming.history}));notify("Backup imported.");}catch{notify("Invalid backup file.");}};reader.readAsText(file);
  }
  function resetAll(){if(!confirm("Reset all local Jaap data? Export a backup first. This cannot be undone."))return;setData({...initial,theme:data.theme});notify("Counter reset.");}
  const chartData=dates.slice(-14).map(date=>({date:new Date(date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short"}),count:dailyMap[date]}));
  const syncLabel=syncStatus==="ready"?"Google Sheets ready":syncStatus==="syncing"?"Sending…":syncStatus==="sent"?"Request sent — verify Sheet":syncStatus==="error"?"Sync failed":"Local storage only";

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark">ॐ</span><span>Naam Jap <small>8 Crore Mission</small></span></a>
      <div className="top-actions"><span className={`sync-pill ${syncStatus}`}><span className="status-dot"/>{syncLabel}</span><button className="icon-btn" aria-label="Toggle theme" onClick={()=>setData(p=>({...p,theme:p.theme==="light"?"dark":"light"}))}>{data.theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button><button className="icon-btn" aria-label="Settings" onClick={()=>setSettingsOpen(v=>!v)}><Settings size={18}/></button></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">A JOURNEY OF FAITH & CONSISTENCY</p><h1>8 Crore Naam Jap <em>Mission</em></h1><p className="tagline">One tap. One Naam. One step closer to your mission.</p></div>
        <div className="mission-progress"><div className="progress-meta"><span>MISSION PROGRESS</span><strong>{overall.toFixed(4)}%</strong></div><div className="progress-track"><div className="progress-fill" style={{width:`${overall}%`}}/></div><div className="progress-meta muted"><span>{fmt(data.total)} completed</span><span>Target · 8,00,00,000</span></div></div>
      </section>

      <nav className="tabs"><button className={tab==="mission"?"active":""} onClick={()=>setTab("mission")}><Activity size={16}/> Mission</button><button className={tab==="analytics"?"active":""} onClick={()=>setTab("analytics")}><Target size={16}/> Analytics</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}><History size={16}/> History</button></nav>

      {tab==="mission"&&<>
        <section className="main-grid">
          <article className="counter-card">
            <div className="card-head"><div><p className="eyebrow">TOTAL COMPLETED</p><h2>{readable(data.total)}</h2><p className="subtle">{fmt(data.total)} Naam Jap</p></div><span className="target-chip"><Target size={14}/> 8 Crore target</span></div>
            <button className="tap-button" onClick={()=>addCount(1)} aria-label="Add one Naam Jap"><span className="tap-plus"><Plus size={24}/></span><strong>+1 Naam Jap</strong><small>TAP TO COUNT</small></button>
            <div className="manual-row"><input type="number" min="1" step="1" inputMode="numeric" placeholder="Enter count (e.g. 108)" value={manual} onChange={e=>setManual(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(addCount(manual),setManual(""))}/><button className="secondary-btn" onClick={()=>{addCount(manual);setManual("");}}>Add count</button></div>
            <div className="counter-footer"><span><Flame size={15}/> {streak} day streak</span><button onClick={undoLast}><RotateCcw size={14}/> Undo last</button></div>
          </article>
          <article className="today-card">
            <div className="card-head"><div><p className="eyebrow">TODAY · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</p><h2>{fmt(todayCount)}</h2><p className="subtle">Naam Jap completed today</p></div><span className="sun-icon">☀</span></div>
            <div className="daily-progress"><div className="progress-meta"><span>DAILY GOAL</span><strong>{dailyPct.toFixed(0)}%</strong></div><div className="progress-track"><div className="progress-fill green" style={{width:`${dailyPct}%`}}/></div><div className="progress-meta muted"><span>{fmt(todayCount)} completed</span><span>{fmt(data.dailyGoal)} goal</span></div></div>
            <div className="quote"><span>“</span><p>One Naam at a time. One step closer to your mission.</p></div>
            <div className="today-bottom"><span>Yesterday <strong>{fmt(yesterdayCount)}</strong></span><span>Best day <strong>{fmt(bestDay)}</strong></span></div>
          </article>
        </section>
        <section className="stats-grid">
          <Stat label="Total completed" value={readable(data.total)} icon={<BookOpen/>}/>
          <Stat label="Remaining" value={readable(remaining)} icon={<Target/>}/>
          <Stat label="Current phase" value={phase.name} icon={<Flame/>}/>
          <Stat label="Next milestone" value={readable(nextMilestone)} icon={<Check/>}/>
          <Stat label="Daily goal" value={fmt(data.dailyGoal)} icon={<Activity/>}/>
          <Stat label="Current streak" value={`${streak} days`} icon={<Flame/>}/>
        </section>
        <section className="two-col">
          <article className="panel"><div className="panel-title"><div><p className="eyebrow">PHASE PROGRESS</p><h3>{phase.name}</h3></div><span className="soft-chip">{readable(previousEnd)} – {readable(phase.end)}</span></div><p className="subtle">{phase.purpose}</p><div className="progress-track phase-track"><div className="progress-fill blue" style={{width:`${phasePct}%`}}/></div><div className="progress-meta muted"><span>{phasePct.toFixed(1)}% of phase</span><span>{readable(phase.end-data.total)} to go</span></div><div className="milestone-note"><span>Next milestone</span><strong>{readable(nextMilestone)} <small>({fmt(nextMilestone)})</small></strong></div></article>
          <article className="panel"><div className="panel-title"><div><p className="eyebrow">DAILY DISCIPLINE</p><h3>Daily goal</h3></div><span className="soft-chip">Personal target</span></div><label className="field-label">Set your daily goal</label><div className="input-action"><input type="number" min="1" value={goalInput} onChange={e=>setGoalInput(e.target.value)}/><button className="primary-btn" onClick={saveGoal}>Save goal</button></div><p className="subtle small-gap">{fmt(todayCount)} Naam Jap completed today.</p></article>
        </section>
      </>}

      {tab==="analytics"&&<section className="panel analytics-panel"><div className="panel-title"><div><p className="eyebrow">YOUR CONSISTENCY</p><h3>Daily activity</h3></div><span className="soft-chip">Last 14 active days</span></div>{chartData.length?<div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="jaapFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c56a2a" stopOpacity={0.28}/><stop offset="95%" stopColor="#c56a2a" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/><XAxis dataKey="date" tick={{fill:"var(--muted)",fontSize:12}} axisLine={false} tickLine={false}/><YAxis tick={{fill:"var(--muted)",fontSize:12}} axisLine={false} tickLine={false} width={52}/><Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12}}/><Area type="monotone" dataKey="count" stroke="#c56a2a" strokeWidth={2.5} fill="url(#jaapFill)"/></AreaChart></ResponsiveContainer></div>:<Empty text="Your daily activity will appear here after your first Jaap."/>}<div className="analytics-stats"><Stat label="Best day" value={fmt(bestDay)}/><Stat label="Active days" value={String(dates.length)}/><Stat label="Current streak" value={`${streak} days`}/></div></section>}

      {tab==="history"&&<section className="panel"><div className="panel-title"><div><p className="eyebrow">YOUR RECORD</p><h3>Naam Jap history</h3></div><button className="secondary-btn compact" onClick={exportCSV}><Download size={15}/> Export CSV</button></div>{data.history.length?<div className="history-list">{[...data.history].reverse().slice(0,100).map(item=><div className="history-item" key={item.id}><div className="history-date"><strong>{dateLabel(item.date)}</strong><small>{new Date(item.time).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})} · {item.source}</small></div><strong className={item.count<0?"negative":""}>{item.count>0?"+":""}{fmt(item.count)}</strong></div>)}</div>:<Empty text="No records yet. Your Jaap entries will appear here."/>}</section>}

      {settingsOpen&&<section className="panel settings-panel"><div className="panel-title"><div><p className="eyebrow">PREFERENCES & BACKUP</p><h3>Settings</h3></div><button className="icon-btn" onClick={()=>setSettingsOpen(false)}><X size={18}/></button></div><div className="settings-grid"><div><label className="field-label">Correct total count</label><div className="input-action"><input type="number" min="0" value={editTotal} onChange={e=>setEditTotal(e.target.value)}/><button className="primary-btn" onClick={updateTotal}>Update</button></div></div><div><label className="field-label">Backup & restore</label><div className="button-row"><button className="secondary-btn" onClick={exportBackup}><Download size={15}/> Backup JSON</button><label className="secondary-btn file-label"><Upload size={15}/> Import<input type="file" accept="application/json" onChange={e=>importBackup(e.target.files?.[0])}/></label></div></div><div><label className="field-label">Google Sheets</label><p className="subtle small-gap">{API_URL?"Apps Script URL configured.":"No Apps Script URL configured yet."} Local data is always saved on this device.</p><button className="secondary-btn" disabled={!API_URL||syncing||!data.pending.length} onClick={syncToSheets}><Cloud size={15}/> {syncing?"Sending…":`Send ${data.pending.length} pending records`}</button></div><div><label className="toggle-line"><input type="checkbox" checked={data.haptics} onChange={e=>setData(p=>({...p,haptics:e.target.checked}))}/> Sound / vibration feedback</label></div><div><button className="danger-btn" onClick={resetAll}>Reset all local data</button></div></div></section>}
    </main>
    <footer><span>ॐ &nbsp; Every Naam is a step forward.</span><span>Saved on this device · {data.updatedAt?new Date(data.updatedAt).toLocaleString("en-IN"):"Not started"}</span></footer>
    {toast&&<div className="toast" role="status">{toast}</div>}
    {showModal&&<div className="modal-backdrop" onClick={()=>setShowModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-symbol">✦</div><p className="eyebrow">MILESTONE COMPLETED</p><h2>A beautiful step forward</h2><p>You have crossed another 1 lakh Naam Jap milestone. Keep going steadily.</p><button className="primary-btn" onClick={()=>setShowModal(false)}>Continue Jaap</button></div></div>}
  </div>;
}
function Stat({label,value,icon}){return <article className="stat-card">{icon&&<span className="stat-icon">{icon}</span>}<span>{label}</span><strong>{value}</strong></article>}
function Empty({text}){return <div className="empty-state"><BookOpen size={26}/><p>{text}</p></div>}
export default App;