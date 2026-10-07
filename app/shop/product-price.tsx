import {discountedPrice} from '../../lib/shop-pricing';
export function ProductPrice({price,percent,bm}:{price:number;percent:number;bm:boolean}){
 const money=(cents:number)=>'RM '+(cents/100).toFixed(2);
 return <div className="shop-price">{percent>0&&<><small>{bm?'Harga asal':'Original price'}: <del>{money(price)}</del></small><br/></>}<strong>{money(discountedPrice(price,percent))}</strong>{percent>0&&<small> · {percent}% {bm?'diskaun':'off'}</small>}</div>;
}
