import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Warm-up Login - Cold Start Fix', () => {
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

    it('should have retry logic in OAuth callback', () => {
      const oauthPath = path.resolve(__dirname, '../../server/_core/oauth.ts');
      const content = fs.readFileSync(oauthPath, 'utf-8');
      
      // Should parse retry count from query
      expect(content).toContain('retryCount');
      // Should redirect to login on failure (up to 2 retries)
      expect(content).toContain('retryCount < 2');
      // Should show error page after max retries
      expect(content).toContain('Erro ao fazer login');
    });
  });

  describe('Client: warmUpAndLogin function', () => {
    it('should export warmUpAndLogin from const.ts', () => {
      const constPath = path.resolve(__dirname, '../../client/src/const.ts');
      const content = fs.readFileSync(constPath, 'utf-8');
      
      expect(content).toContain('export const warmUpAndLogin');
    });

    it('warmUpAndLogin should ping /api/ping before redirecting', () => {
      const constPath = path.resolve(__dirname, '../../client/src/const.ts');
      const content = fs.readFileSync(constPath, 'utf-8');
      
      // Should fetch /api/ping
      expect(content).toContain("fetch('/api/ping'");
      // Should have timeout (8s)
      expect(content).toContain('8000');
      // Should still redirect even if ping fails
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
