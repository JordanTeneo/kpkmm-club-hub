export const defaultReminderSettings = {
  dailyLimit: 20,
  intervalMonths: 1,
  subject: 'KPKMM — membership renewal reminder',
  message: 'Dear {name},\n\nYou are eligible to renew your KPKMM membership for {year}. The annual fee is RM150. If you have already paid, please contact the committee before paying again.\n\nSmall Cars, Big Spirit!\nKPKMM Committee',
};
export function reminderConfig(value:unknown){
  const v=(value&&typeof value==='object'?value:{}) as Partial<typeof defaultReminderSettings>;
  return {...defaultReminderSettings,...v,
    dailyLimit:Number.isInteger(v.dailyLimit)&&v.dailyLimit!>=1&&v.dailyLimit!<=20?v.dailyLimit!:20,
    intervalMonths:Number.isInteger(v.intervalMonths)&&v.intervalMonths!>=1&&v.intervalMonths!<=12?v.intervalMonths!:1,
    subject:typeof v.subject==='string'&&v.subject.trim()?v.subject:defaultReminderSettings.subject,
    message:typeof v.message==='string'&&v.message.trim()?v.message:defaultReminderSettings.message};
}
export function validateReminderSettings(form:FormData){
  const startDate=String(form.get('startDate')||''),dailyLimit=Number(form.get('dailyLimit')),intervalMonths=Number(form.get('intervalMonths'));
  const subject=String(form.get('subject')||'').trim(),message=String(form.get('message')||'').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(startDate)||!Number.isFinite(Date.parse(startDate))||new Date(startDate).toISOString().slice(0,10)!==startDate)throw Error('date');
  if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>20||!Number.isInteger(intervalMonths)||intervalMonths<1||intervalMonths>12)throw Error('limits');
  if(!subject||subject.length>150||/[\r\n]/.test(subject)||!message||message.length>5000)throw Error('message');
  if(/\{(?!name\}|year\})[^}]*\}/.test(subject+' '+message))throw Error('placeholder');
  return {startDate,config:{dailyLimit,intervalMonths,subject,message}};
}
export function reminderText(template:string,name:string,year:number){
  return template.replace(/\{(name|year)\}/g,(_,key)=>key==='name'?name:String(year));
}
