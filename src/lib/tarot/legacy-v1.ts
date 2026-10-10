/** Tarot of Fortune: symbolic entertainment, not prediction or wagering advice. */
export type Element = 'wood'|'fire'|'earth'|'metal'|'water';
export type Topic = 'luck'|'career'|'love'|'money'|'wellbeing'|'general';
export type Orientation = 'upright'|'reversed';
export interface Card { id:number; name:string; fusion:string; element:Element; upright:string; reversed:string; digits:readonly number[] }
// Original creative five-element correspondences, not canonical tarot correspondences.
const raw: [string,string,Element,string,string][] = [
['The Fool','The Wanderer','wood','new beginnings and curiosity','impulsiveness and missing preparation'],
['The Magician','Celestial Alchemist','fire','initiative and resourcefulness','scattered focus and overconfidence'],
['High Priestess','Moon Oracle','water','intuition and careful observation','hidden assumptions and uncertainty'],
['The Empress','Jade Empress','earth','growth and nurturing','overextension and neglect of boundaries'],
['The Emperor','Dragon Emperor','metal','structure and responsibility','rigidity and excessive control'],
['The Hierophant','Heavenly Master','earth','learning and tradition','questioning inherited expectations'],
['The Lovers','Red Thread','fire','values and meaningful choices','misalignment and indecision'],
['The Chariot','Dragon Chariot','wood','direction and discipline','rushing without coordination'],
['Strength','Guardian Tiger','fire','patience and inner courage','self-doubt and drained energy'],
['The Hermit','Mountain Sage','earth','reflection and perspective','isolation and avoidance'],
['Wheel of Fortune','Zodiac Wheel','metal','change and cycles','resistance to uncertainty'],
['Justice','Karmic Scales','metal','fairness and accountability','unexamined bias and imbalance'],
['The Hanged Man','Suspended Lotus','water','pause and reframing','stagnation and unnecessary sacrifice'],
['Death','Phoenix Rebirth','fire','transformation and closure','clinging to an old chapter'],
['Temperance','Yin–Yang Harmony','water','moderation and integration','excess and loss of balance'],
['The Devil','Golden Chains','metal','recognizing attachments','compulsion and limiting patterns'],
['The Tower','Thunder Pagoda','fire','reassessment after disruption','denial of needed change'],
['The Star','Celestial Lantern','water','hope and renewal','discouragement and fading confidence'],
['The Moon','Moonlit Lake','water','ambiguity and imagination','confusion and unfounded fears'],
['The Sun','Golden Sun','fire','clarity and joy','temporary doubt and unrealistic optimism'],
['Judgement','Awakening Bell','metal','review and awakening','hesitation to act on lessons'],
['The World','Heavenly Mandala','earth','completion and integration','unfinished business and delayed closure']
];
export const CARDS: readonly Card[] = raw.map(([name,fusion,element,upright,reversed],id)=>({id,name,fusion,element,upright,reversed,digits:[id%10,Math.floor(id/10),({wood:3,fire:9,earth:5,metal:6,water:1} as const)[element]]}));
export interface Question { id:string; text:string; topic:Topic; positions:readonly string[]; numbers:boolean }
export const QUESTIONS:readonly Question[] = [
{id:'luck_today',text:'What does my luck symbolize today?',topic:'luck',positions:['Theme'],numbers:true},
{id:'career',text:'What should I reflect on in my career?',topic:'career',positions:['Situation','Challenge','Guidance'],numbers:false},
{id:'love',text:'What can I learn about my relationships?',topic:'love',positions:['Self','Connection','Guidance'],numbers:false},
{id:'money',text:'What should I consider about money?',topic:'money',positions:['Present','Influence','Next step'],numbers:false},
{id:'wellbeing',text:'What supports my wellbeing?',topic:'wellbeing',positions:['Current needs','Balance','Self-care'],numbers:false},
{id:'month',text:'What themes might guide my month?',topic:'general',positions:['Foundation','Opportunity','Challenge','Support','Reflection'],numbers:false}
];
export type RandomBytes = (length:number)=>Uint8Array;
function randInt(max:number,bytes:RandomBytes):number {if(!Number.isSafeInteger(max)||max<=0||max>65536)throw Error('invalid max');const limit=65536-(65536%max);for(;;){const b=bytes(2);if(b.length!==2)throw Error('invalid random source');const n=(b[0]<<8)|b[1];if(n<limit)return n%max;}}
export function shuffleDeck(bytes:RandomBytes):number[]{const ids=CARDS.map(c=>c.id);for(let i=ids.length-1;i>0;i--){const j=randInt(i+1,bytes);[ids[i],ids[j]]=[ids[j],ids[i]];}return ids;}
export interface Draw { cardId:number; orientation:Orientation; position:string }
export function drawCards(questionId:string,bytes:RandomBytes):Draw[]{const q=QUESTIONS.find(x=>x.id===questionId);if(!q)throw Error('unknown question');return shuffleDeck(bytes).slice(0,q.positions.length).map((cardId,i)=>({cardId,position:q.positions[i],orientation:randInt(2,bytes)===0?'upright':'reversed'}));}
const produces:Record<Element,Element>={wood:'fire',fire:'earth',earth:'metal',metal:'water',water:'wood'};
const controls:Record<Element,Element>={wood:'earth',earth:'water',water:'fire',fire:'metal',metal:'wood'};
const topicLens:Record<Topic,string>={luck:'Treat chance with perspective; no card predicts a draw.',career:'Consider concrete skills, collaboration, and choices.',love:'Respect communication, consent, and mutual needs.',money:'Use a budget and avoid decisions based on omens.',wellbeing:'Focus on supportive habits; cards cannot diagnose or predict health.',general:'Use the symbols as prompts for reflection.'};
function relationship(a:Element,b:Element):string {if(a===b)return 'These cards repeat an element, emphasizing a recurring theme.';if(produces[a]===b||produces[b]===a)return 'Their elements form a generating relationship, suggesting continuity and support.';if(controls[a]===b||controls[b]===a)return 'Their elements form a controlling relationship, suggesting tension to balance.';return 'Their contrasting elements invite a broader perspective.';}
const combos:[number,number,string][]=[[10,19,'Change and clarity appear together; remain flexible without assuming a guaranteed outcome.'],[9,19,'Quiet reflection and outward confidence can complement one another.'],[13,17,'Closure and renewed hope may belong to the same story.'],[15,14,'Attachments and moderation call for thoughtful boundaries.'],[16,4,'A disrupted structure may benefit from deliberate rebuilding.']];
export interface Reading { version:'1.0'; questionId:string; draws:Draw[]; interpretation:string; fourD?:string[]; toto?:number[][] }
export function interpretDraw(questionId:string,draws:Draw[]):string {const q=QUESTIONS.find(x=>x.id===questionId);if(!q)throw Error('unknown question');if(draws.length!==q.positions.length)throw Error('wrong spread size');if(new Set(draws.map(d=>d.cardId)).size!==draws.length)throw Error('duplicate cards');const cards=draws.map((d,i)=>{if(d.position!==q.positions[i]||!['upright','reversed'].includes(d.orientation))throw Error('invalid draw');const c=CARDS[d.cardId];if(!c)throw Error('invalid card');return c;});const lines=draws.map((d,i)=>`${d.position}: ${cards[i].name} (${d.orientation}) — ${cards[i][d.orientation]}.`);for(let i=1;i<cards.length;i++)lines.push(relationship(cards[i-1].element,cards[i].element));for(const [a,b,message] of combos)if(cards.some(c=>c.id===a)&&cards.some(c=>c.id===b))lines.push(message);lines.push(topicLens[q.topic]);return lines.join(' ');}
// Uniform number generation: tarot attributes are retained as thematic metadata, not used to bias odds.
export function generateNumbers(bytes:RandomBytes,fourDCount=3,totoCount=2):{fourD:string[],toto:number[][]}{if(!Number.isInteger(fourDCount)||fourDCount<0||fourDCount>20||!Number.isInteger(totoCount)||totoCount<0||totoCount>20)throw Error('invalid counts');const fourD:string[]=[];const seen4=new Set<string>();while(fourD.length<fourDCount){const n=String(randInt(10000,bytes)).padStart(4,'0');if(!seen4.has(n)){seen4.add(n);fourD.push(n);}}const toto:number[][]=[];const seenT=new Set<string>();while(toto.length<totoCount){const pool=Array.from({length:49},(_,i)=>i+1);for(let i=0;i<6;i++){const j=i+randInt(49-i,bytes);[pool[i],pool[j]]=[pool[j],pool[i]];}const nums=pool.slice(0,6).sort((a,b)=>a-b);const key=nums.join(',');if(!seenT.has(key)){seenT.add(key);toto.push(nums);}}return {fourD,toto};}
export function createReading(questionId:string,bytes:RandomBytes,includeNumbers=false):Reading {const draws=drawCards(questionId,bytes);const interpretation=interpretDraw(questionId,draws);const q=QUESTIONS.find(x=>x.id===questionId)!;const numbers=includeNumbers&&q.numbers?generateNumbers(bytes):undefined;return {version:'1.0',questionId,draws,interpretation,...numbers};}
