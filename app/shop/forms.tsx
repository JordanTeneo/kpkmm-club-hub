'use client';
import { useActionState, type ReactNode } from 'react';
import type { Result } from './actions';
export function ShopForm({action,children,label,confirm}:{action:(state:Result,form:FormData)=>Promise<Result>;children:ReactNode;label:string;confirm?:string}) {
  const [state,submit,pending]=useActionState(action,{});
  return <form action={submit} onSubmit={e=>{if(confirm&&!window.confirm(confirm))e.preventDefault();}}><fieldset disabled={pending}>{children}<button type="submit">{pending?'Saving… / Menyimpan…':label}</button></fieldset>{state.error&&<p className="shop-error" role="alert">{state.error}</p>}{state.success&&<p role="status">{state.success}</p>}</form>;
}
