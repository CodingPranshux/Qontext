import * as authService from '../services/auth.service.js';

export async function postSignup(req, res, next) {
  try {
    const { email, password, tenantName } = req.body;
    if (!email || !password || !tenantName) {
      return res.status(400).json({ error: { message: 'email, password, and tenantName are required' } });
    }

    const { user, tenant } = await authService.signup({ email, password, tenantName });

    res.status(201).json({
      user: { id: user._id, email: user.email, tenantId: user.tenantId },
      tenant: { id: tenant._id, name: tenant.name },
    });
  } catch (err) {
    next(err);
  }
}

export async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'email and password are required' } });
    }

    const { token, user } = await authService.login({ email, password });

    res.status(200).json({
      token,
      user: { id: user._id, email: user.email, tenantId: user.tenantId },
    });
  } catch (err) {
    next(err);
  }
}

export async function postGoogleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: { message: 'idToken is required' } });
    }

    const { token, user } = await authService.loginWithGoogle({ idToken });

    res.status(200).json({
      token,
      user: { id: user._id, email: user.email, tenantId: user.tenantId },
    });
  } catch (err) {
    next(err);
  }
}
