export function readDiscount(value:unknown){
 const raw=String(value??'').trim();
 const percent=Number(raw);
 if(!/^\d{1,2}$/.test(raw)||!Number.isInteger(percent)||percent<0||percent>99)throw Error('Enter a whole-number discount from 0 to 99%. / Masukkan diskaun nombor bulat dari 0 hingga 99%.');
 return percent;
}
export function discountedPrice(price:number,percent:number){
 if(!Number.isSafeInteger(price)||price<1||!Number.isInteger(percent)||percent<0||percent>99)throw Error('Invalid product pricing.');
 const result=Math.round(price*(100-percent)/100);
 if(result<1)throw Error('The discounted price must be at least RM 0.01. / Harga selepas diskaun mestilah sekurang-kurangnya RM 0.01.');
 return result;
}
