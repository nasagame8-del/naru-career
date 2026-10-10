"use client";
import { useId, useRef, useState } from "react";
import { TYPE_SKILLS } from "./type-skills";
import { RESULT_HEADLINES } from "../_lib/matching";
import QuestCharacter from "./QuestCharacter";
import type { TypeInfo } from "../_lib/data";
const TABS = ["特徴", "強み", "向いている仕事", "キャリアアドバイス"];
export default function StatusDetails({typeId,typeInfo}:{typeId:number;typeInfo:TypeInfo}) {
 const [active,setActive]=useState(0);
 const id=useId();
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 return <section className="rpg-status" aria-label="ステータス詳細">
   <div className="rpg-tabs" role="tablist" aria-label="タイプの詳細">{TABS.map((tab,index)=><button key={tab} ref={el=>{buttons.current[index]=el;}} id={`${id}-tab-${index}`} role="tab" aria-selected={active===index} aria-controls={`${id}-panel`} tabIndex={active===index?0:-1} onClick={()=>setActive(index)} onKeyDown={event=>{
     let next=index;
     if(event.key==='ArrowRight') next=(index+1)%4;
     else if(event.key==='ArrowLeft') next=(index+3)%4;
     else if(event.key==='Home') next=0;
     else if(event.key==='End') next=3;
     else return;
     event.preventDefault();setActive(next);buttons.current[next]?.focus();
   }}>{tab}</button>)}</div>
   <div className="rpg-status-paper paper" id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${active}`} tabIndex={0}>
     <h2>ステータス</h2><div className="rpg-status-profile"><QuestCharacter id={typeId}/><div><small>基本情報</small><h3>{typeInfo.name}</h3><p>{RESULT_HEADLINES[typeId].join("")}</p></div></div>
     <h3>{TABS[active]}</h3>
     {active===0 && <><p>{typeInfo.desc}</p><h4>向いている環境</h4><p>{typeInfo.goodEnv}</p><h4>消耗しやすい環境</h4><p>{typeInfo.badEnv}</p></>}
     {active===1 && <><div className="rpg-skill-tags">{TYPE_SKILLS[typeId].map(skill=><span key={skill}>{skill}</span>)}</div><p>{typeInfo.desc}</p><h4>力を発揮しやすい環境</h4><p>{typeInfo.goodEnv}</p></>}
     {active===2 && <><div className="rpg-job-tags">{typeInfo.strength.split("・").map(job=><span key={job}>{job}</span>)}</div><p>{typeInfo.careerTip}</p></>}
     {active===3 && <p>{typeInfo.careerTip}</p>}
   </div>
 </section>;
}
