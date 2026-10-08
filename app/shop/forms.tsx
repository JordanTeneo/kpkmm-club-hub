'use client';
import {useUiText} from '../ui-language';

import { useActionState, type ReactNode } from 'react';
import type { Result } from './actions';
export function ShopForm({action,children,label,confirm}:{action:(state:Result,form:FormData)=>Promise<Result>;children:ReactNode;label:string;confirm?:string}) {
 const ui = useUiText();

  const [state,submit,pending]=useActionState(action,{});
  return <form action={submit} onSubmit={e=>{if(confirm&&!window.confirm(ui(confirm)))e.preventDefault();}}><fieldset disabled={pending}>{children}<button type="submit">{pending?ui('Saving… / Menyimpan…'):ui(label)}</button></fieldset>{state.error&&<p className="shop-error" role="alert">{ui(state.error)}</p>}{state.success&&<><p role="status">{ui(state.success)}</p>{state.successHref&&state.successLabel&&<p><a className="shop-link" href={state.successHref}>{ui(state.successLabel)}</a></p>}</>}</form>;
}
