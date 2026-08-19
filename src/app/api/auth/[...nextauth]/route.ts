import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

/* One auth configuration, defined in lib/auth.ts and mounted here.
   It previously declared a second, cut-down set of options inline; because
   getServerSession() in lib/auth.ts was passed the *other* set, the role
   claim never reached the session and every signed-in user fell back to
   the default role. */

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
