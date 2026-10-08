export type FeeSettings={annual:number;administration:number;renewalDiscount:number;joiningDiscount:number};
export type FeeQuote={annual:number;administration:number;discount:number;total:number};
export const defaultFees:FeeSettings={annual:15000,administration:10000,renewalDiscount:0,joiningDiscount:0};
export function feeQuote(s:FeeSettings,kind:'new'|'renewal'):FeeQuote{
 for(const n of [s.annual,s.administration,s.renewalDiscount,s.joiningDiscount])if(!Number.isSafeInteger(n)||n<0||n>1000000)throw Error('Invalid membership fee');
 const administration=kind==='new'?s.administration:0,discount=kind==='new'?s.joiningDiscount:s.renewalDiscount,total=s.annual+administration-discount;
 if(total<1)throw Error('Discount must be less than the fee');
 return {annual:s.annual,administration,discount,total};
}
export function savedFee(value:unknown,kind:'new'|'renewal'):FeeQuote{
 if(value==null)return feeQuote(defaultFees,kind);
 const q=(typeof value==='string'?JSON.parse(value):value) as FeeQuote;
 if(![q.annual,q.administration,q.discount,q.total].every(n=>Number.isSafeInteger(n)&&n>=0)||q.total!==q.annual+q.administration-q.discount||q.total<1)throw Error('Invalid fee snapshot');
 return q;
}
export const feeMoney=(sen:number)=>'RM '+(sen/100).toFixed(2);
export function feeText(q:FeeQuote){return `${feeMoney(q.annual)} + ${feeMoney(q.administration)} - ${feeMoney(q.discount)} = ${feeMoney(q.total)}`;}
