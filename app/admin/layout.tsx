import type {ReactNode} from 'react';
import {AdminNavigation} from './navigation';

export default function AdminLayout({children}:{children:ReactNode}){
 return <><AdminNavigation/>{children}</>;
}
