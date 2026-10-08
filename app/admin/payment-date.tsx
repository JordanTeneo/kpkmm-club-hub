import {malaysiaDate} from '../../lib/membership-payments';
export function PaymentDate({bm,required=true}:{bm:boolean;required?:boolean}){
 return <label>{bm?'Tarikh bayaran bank (wajib untuk kelulusan baharu)':'Bank payment date (required for new approval)'}<input type="date" name="paidOn" min="2000-01-01" max={malaysiaDate()} required={required}/><small>{bm?'Seperti pada resit. Digunakan untuk jumlah bayaran tahunan; bukan tarikh kelulusan.':'As shown on the receipt. Used for payment-year totals; this is not the approval date.'}</small></label>;
}
