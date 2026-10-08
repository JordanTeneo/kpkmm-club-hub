export function PaymentRecordLink({id,bm}:{id?:string;bm:boolean}){
 return id?<p><a href={`/admin/payments/${id}?file=invoice&lang=${bm?'ms':'en'}`}>{bm?'Muat turun invois':'Download invoice'}</a> · <a href={`/admin/payments/${id}?file=receipt`}>{bm?'Resit bayaran':'Payment receipt'}</a></p>:null;
}
