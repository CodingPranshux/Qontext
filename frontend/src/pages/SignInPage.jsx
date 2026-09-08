import { useSearchParams } from 'react-router-dom';
import AuthPanel from '../components/AuthPanel.jsx';

/** Public sign-in/sign-up page. `?mode=signup` opens straight on the signup tab. */
function SignInPage() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  return <AuthPanel initialMode={initialMode} />;
}

export default SignInPage;
