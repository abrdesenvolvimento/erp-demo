/** Página fixa: não recebe nem reflete parâmetros, cookies ou dados do callback. */
export function renderOAuthRecoveryPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Não foi possível validar o login</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;padding:24px 16px;background:linear-gradient(135deg,#114352,#2f6d44);color:#114352;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:100%;max-width:520px;padding:32px 24px;border-radius:20px;background:#f4f5f1;box-shadow:0 16px 40px #071d2440}
    .brand{margin:0 0 24px;color:#2f6d44;font-weight:800;letter-spacing:.12em;font-size:14px}
    h1{margin:0 0 20px;font-size:clamp(24px,6vw,32px);line-height:1.2;overflow-wrap:break-word}
    p{margin:0 0 16px;line-height:1.6}
    a{display:block;margin-top:24px;padding:14px 18px;border-radius:10px;background:#2f6d44;color:#fff;text-align:center;text-decoration:none;font-weight:650;line-height:1.5}
    a:hover{background:#114352}
    a:focus-visible{outline:3px solid #114352;outline-offset:4px}
    @media(max-width:380px){main{padding:28px 20px}}
  </style>
</head>
<body>
  <main aria-labelledby="recovery-title">
    <p class="brand">ABRWF</p>
    <h1 id="recovery-title">Não foi possível validar o login</h1>
    <p>Se estiver usando o app, tente abrir o ABRWF no navegador. Evite alternar entre app e navegador durante o login.</p>
    <p>Volte ao início e solicite um novo login. Inicie e conclua a tentativa no mesmo navegador.</p>
    <a href="/">Voltar e tentar novamente</a>
  </main>
</body>
</html>`;
}
