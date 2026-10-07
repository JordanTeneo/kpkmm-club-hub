export type ShopAddress={address:string;addressLine:string;postcode:string;state:string;mailingCountry:string};
export function readShopCustomer(form:FormData){
 const read=(key:string)=>String(form.get(key)||'').trim();
 const name=read('name'),phone=read('phone'),email=read('email').toLowerCase();
 const address:ShopAddress={address:read('address'),addressLine:read('address'),postcode:read('postcode'),state:read('state'),mailingCountry:read('mailingCountry')};
 if(name.length<2||name.length>100||!/^[+0-9 ()-]{7,30}$/.test(phone)||email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter your full name, mobile number and valid email. / Masukkan nama penuh, nombor telefon bimbit dan e-mel yang sah.');
 if(address.address.length<10||address.address.length>1000||!address.postcode||address.postcode.length>20||!address.state||address.state.length>100||!address.mailingCountry||address.mailingCountry.length>80||(address.mailingCountry.toLowerCase()==='malaysia'&&!/^\d{5}$/.test(address.postcode)))throw Error('Enter your address, postcode, state and country. / Masukkan alamat, poskod, negeri dan negara.');
 return {name,phone,email,address};
}
