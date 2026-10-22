import {currentStaff} from '../staff-auth';
import Dashboard from './dashboard';
import StaffWelcome from './welcome';
export const dynamic='force-dynamic';
export default async function Page(){const who=await currentStaff();return who?<Dashboard who={who}/>:<StaffWelcome/>}
