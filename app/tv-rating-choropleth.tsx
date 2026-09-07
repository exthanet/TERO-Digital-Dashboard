"use client";

type ProvinceRating={province:string;rating:number};
const COLORS=["#DBEAFE","#93C5FD","#60A5FA","#2563EB","#123A8C"];
const number=(v:number)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:3}).format(v||0);
export default function TvRatingChoropleth({data}:{data:ProvinceRating[]}){
 const sorted=[...data].filter(x=>x.province&&x.rating>0).sort((a,b)=>b.rating-a.rating),max=sorted[0]?.rating||0;
 const color=(v:number)=>COLORS[Math.min(COLORS.length-1,Math.floor((v/(max||1))*COLORS.length))];
 return <article className="panel tv-map-panel"><div className="panel-head"><div><h2>TV Rating Score — Choropleth Map</h2><p>สีเข้ม = Rating สูง · รองรับฟิลด์ Province / จังหวัด + TV_Rating_Total</p></div><span className="province-count">{sorted.length} จังหวัด</span></div>
 {sorted.length?<><div className="province-tile-map">{sorted.map(x=><div key={x.province} className="province-tile" style={{background:color(x.rating),color:x.rating/max>.55?"#fff":"#0b1f3a"}} title={`${x.province}: ${number(x.rating)}`}><span>{x.province}</span><b>{number(x.rating)}</b></div>)}</div><div className="map-legend"><span>ต่ำ</span>{COLORS.map(x=><i key={x} style={{background:x}}/>)}<span>สูง</span></div></>:<div className="map-empty"><div className="thailand-outline">TH</div><div><strong>ยังไม่มีข้อมูล Rating ระดับจังหวัด</strong><p>Master Data ปัจจุบันมีเพียง BKK, Urban และ Rural ซึ่งเป็นกลุ่มผู้ชม ไม่ใช่จังหวัด จึงไม่กระจายตัวเลขลงแผนที่โดยคาดเดา</p><small>เมื่อเพิ่มคอลัมน์ <b>Province</b> หรือ <b>จังหวัด</b> ระบบจะไล่สีอัตโนมัติตาม TV_Rating_Total</small></div></div>}
 </article>
}
