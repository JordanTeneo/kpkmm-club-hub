// Keep stored role identifiers stable so existing appointments and uniqueness checks remain valid.
export const roles=[['advisor','Club Advisor','Penasihat Kelab'],['chairman','President','Presiden'],['vice-chairman','Vice President','Naib Presiden'],['secretary','Secretary','Setiausaha'],['assistant-secretary','Assistant Secretary','Penolong Setiausaha'],['treasurer','Treasurer','Bendahari'],['committee','Committee Member','Ahli Jawatankuasa'],['custom','Other role','Jawatan lain']] as const;
export function appointmentTitle(item:{role:string;role_en:string;role_ms:string},bm:boolean){
 const preset=roles.find(r=>r[0]===item.role);
 return preset&&item.role!=='custom'?preset[bm?2:1]:bm?item.role_ms:item.role_en;
}
export type Appointment={id:string;member_number:string;display_name:string;role:string;role_en:string;role_ms:string;starts:string;ends:string;is_current:boolean;cancelled:boolean;version:number};
