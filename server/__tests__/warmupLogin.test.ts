import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Warm-up Login & Cookie Fix', () => {
  describe('Server: /api/ping endpoint', () => {
    it('should have /api/ping endpoint registered in oauth.ts', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      expect(content).toContain('app.get("/api/ping"');
      expect(content).toContain('res.status(200).send("pong")');
    });

    it('should have /api/oauth/health endpoint registered', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      expect(content).toContain('app.get("/api/oauth/health"');
      expect(content).toContain('status: "ok"');
    });

    it('should have trust proxy enabled', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      expect(content).toContain("app.set('trust proxy', true)");
    });

    it('should have retry logic in OAuth callback using state-based URL recovery', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      // Should parse retry count from query
      expect(content).toContain('retryCount');
      // Should redirect to login on failure (up to 2 retries)
      expect(content).toContain('retryCount < 2');
      // Should use state parameter to recover public URL (NOT req.get('host'))
      expect(content).toContain("Buffer.from(state, 'base64')");
      expect(content).toContain('publicRedirectUri');
      // Should NOT use req.get('host') for retry URL
      expect(content).not.toContain("const origin = `${req.protocol}://${req.get('host')}`");
      // Should show error page after max retries
      expect(content).toContain('Erro ao fazer login');
    });

    it('should use getCanonicalOrigin for origin detection', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      expect(content).toContain('getCanonicalOrigin');
      expect(content).toContain('canonicalOrigin');
    });
  });

  describe('Server: Cookie configuration', () => {
    it('should use sameSite lax instead of none', () => {
      const cookiesPath = path.resolve(__dirname, '../../server/_core/cookies.ts');
      const content = fs.readFileSync(cookiesPath, 'utf-8');
      
      // Should use "lax" for sameSite
      expect(content).toContain('sameSite: "lax"');
      // Should NOT use "none" (which requires secure:true)
      expect(content).not.toContain('sameSite: "none"');
    });

    it('should export getCanonicalOrigin helper', () => {
      const cookiesPath = path.resolve(__dirname, '../../server/_core/cookies.ts');
      const content = fs.readFileSync(cookiesPath, 'utf-8');
      
      expect(content).toContain('export function getCanonicalOrigin');
      // Should check x-forwarded-host
      expect(content).toContain('x-forwarded-host');
      // Should have fallbacks for origin and referer
      expect(content).toContain('req.headers["origin"]');
      expect(content).toContain('req.headers["referer"]');
    });
  });

  describe('Client: warmUpAndLogin function', () => {
    it('should export warmUpAndLogin from const.ts', () => {
      const constPath = path.resolve(__dirname, '../../client/src/const.ts');
      const content = fs.readFileSync(constPath, 'utf-8');
      
      expect(content).toContain('export const warmUpAndLogin');
    });

    it('warmUpAndLogin should retry ping up to 3 times', () => {
      const constPath = path.resolve(__dirname, '../../client/src/const.ts');
      const content = fs.readFileSync(constPath, 'utf-8');
      
      // Should fetch /api/ping
      expect(content).toContain("fetch('/api/ping'");
      // Should have retry loop (3 attempts)
      expect(content).toContain('attempt < 3');
      // Should still redirect even if all pings fail
      expect(content).toContain('window.location.href = loginUrl');
    });

    it('DashboardLayout should use warmUpAndLogin instead of direct redirect', () => {
      const layoutPath = path.resolve(__dirname, '../../client/src/components/DashboardLayout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf-8');
      
      // Should import warmUpAndLogin
      expect(content).toContain('warmUpAndLogin');
      // Should NOT use getLoginUrl for redirect
      expect(content).not.toContain('window.location.href = getLoginUrl()');
    });

    it('main.tsx should use warmUpAndLogin for unauthorized redirect', () => {
      const mainPath = path.resolve(__dirname, '../../client/src/main.tsx');
      const content = fs.readFileSync(mainPath, 'utf-8');
      
      // Should import warmUpAndLogin
      expect(content).toContain('warmUpAndLogin');
      // Should call warmUpAndLogin() on unauthorized
      expect(content).toContain('warmUpAndLogin()');
      // Should NOT use getLoginUrl directly
      expect(content).not.toContain('window.location.href = getLoginUrl()');
    });
  });
});
