"use client";

type ZoneRating={zone:string;rating:number;source:string};
const COLORS=["#DBEAFE","#93C5FD","#60A5FA","#2563EB","#123A8C"];
const number=(v:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:3}).format(v||0);
export default function TvRatingChoropleth({data}:{data:ZoneRating[]}){
 const sorted=[...data].filter(x=>x.zone&&x.rating>0).sort((a,b)=>b.rating-a.rating),max=sorted[0]?.rating||0;
 const color=(v:number)=>COLORS[Math.min(COLORS.length-1,Math.floor((v/(max||1))*COLORS.length))];
 return <article className="panel tv-map-panel"><div className="panel-head"><div><h2>TV Rating Score — Zone Choropleth</h2><p>สีเข้ม = Rating สูง · แบ่งตาม Audience Segment จาก TV Rating ต้นฉบับ</p></div><span className="province-count">{sorted.length} โซน</span></div>
 {sorted.length?<><div className="province-tile-map">{sorted.map(x=><div key={x.zone} className="province-tile" style={{background:color(x.rating),color:x.rating/max>.55?"#fff":"#0b1f3a"}} title={`${x.zone}: ${number(x.rating)}`}><span>{x.zone}</span><b>{number(x.rating)}</b><small>{x.source}</small></div>)}</div><div className="map-legend"><span>ต่ำ</span>{COLORS.map(x=><i key={x} style={{background:x}}/>)}<span>สูง</span></div><p className="map-note">หมายเหตุ: BKK, Urban และ BKK &amp; Urban เป็น Segment ที่อาจทับซ้อนกันตามนิยาม Rating ของแหล่งข้อมูล</p></>:<div className="map-empty"><div className="thailand-outline">TH</div><div><strong>ยังไม่มีข้อมูล TV Rating สำหรับโซน</strong><p>เลือก Cross Platform = TV หรือเพิ่มฟิลด์ TV_Rating_15+BKK, TV_Rating_15+URBAN และ TV_Rating_15+RURAL ใน Master Data</p><small>ระบบจะไล่สีตาม Rating ของแต่ละโซนให้อัตโนมัติ</small></div></div>}
 </article>
}
