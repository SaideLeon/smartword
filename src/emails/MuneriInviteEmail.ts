interface Props {
  body: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderMuneriInviteEmail({ body }: Props): string {
  const customParagraphs = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p style="${styles.customBody}">${escapeHtml(line)}</p>`)
    .join('');

  const customSection = customParagraphs
    ? `
      <tr>
        <td style="${styles.section}">
          <p style="${styles.sectionLabel}">MENSAGEM DO ADMIN</p>
          <hr style="${styles.divider}" />
          ${customParagraphs}
        </td>
      </tr>
    `
    : '';

  return `
<html lang="pt">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Convite Muneri</title>
  </head>
  <body style="${styles.body}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${styles.wrapperTable}">
      <tbody>
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="${styles.containerTable}">
              <tbody>
                <tr>
                  <td style="${styles.header}">
                    <p style="${styles.logo}">✦ Muneri</p>
                    <p style="${styles.logoSub}">Plataforma Académica para Estudantes Moçambicanos</p>
                  </td>
                </tr>

                <tr>
                  <td style="${styles.hero}">
                    <h1 style="${styles.heroTitle}">O teu trabalho académico,<br /><span style="color:#d4b37b">em minutos.</span></h1>
                    <p style="${styles.heroSub}">Tema → Trabalho completo em Word, formatado, com capa e referências.</p>
                    <a href="https://muneri.nativespeak.app/auth/login" style="${styles.cta}">Começar grátis →</a>
                  </td>
                </tr>

                ${customSection}

                <tr>
                  <td style="${styles.section}">
                    <p style="${styles.sectionLabel}">COMO FUNCIONA</p>
                    <hr style="${styles.divider}" />

                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${styles.stepRow}">
                      <tbody><tr><td style="${styles.stepNum}">01</td><td><p style="${styles.stepTitle}">Insere o tema</p><p style="${styles.stepDesc}">Qualquer área: Direito, Gestão, Saúde, Engenharia, Educação…</p></td></tr></tbody>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${styles.stepRow}">
                      <tbody><tr><td style="${styles.stepNum}">02</td><td><p style="${styles.stepTitle}">Indica o módulo</p><p style="${styles.stepDesc}">O Muneri calibra o tom académico e a estrutura do teu curso.</p></td></tr></tbody>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${styles.stepRow}">
                      <tbody><tr><td style="${styles.stepNum}">03</td><td><p style="${styles.stepTitle}">Descarrega o trabalho</p><p style="${styles.stepDesc}">Capa, sumário, capítulos, conclusão e referências APA — prontos.</p></td></tr></tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="${styles.eduBoxWrapper}">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${styles.eduBox}">
                      <tbody>
                        <tr>
                          <td>
                            <p style="${styles.eduLabel}">🎓 OFERTA EDUCATIVA</p>
                            <p style="${styles.eduTitle}">30 dias Premium completamente grátis</p>
                            <p style="${styles.eduDesc}">Usa a tua conta institucional (@unisced.edu.mz, @up.edu.mz, @uem.ac.mz) ao entrar com Google e o período gratuito é activado automaticamente — sem cartão de crédito.</p>
                            <a href="https://muneri.nativespeak.app/auth/login" style="${styles.ctaEdu}">Activar 30 dias grátis</a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="${styles.section}">
                    <p style="${styles.sectionLabel}">PORQUÊ O MUNERI</p>
                    <hr style="${styles.divider}" />
                    <p style="${styles.bullet}"><span style="color:#d4b37b">✦</span> Pensado para Moçambique — exemplos, dados e referências locais.</p>
                    <p style="${styles.bullet}"><span style="color:#d4b37b">✦</span> Não é só gerador de texto — revês secção a secção com IA.</p>
                    <p style="${styles.bullet}"><span style="color:#d4b37b">✦</span> Exportação Word nativa — abre no Google Docs, LibreOffice e WPS.</p>
                  </td>
                </tr>

                <tr>
                  <td style="${styles.footer}">
                    <p style="${styles.footerText}">Equipa Muneri · Quelimane, Moçambique</p>
                    <p style="${styles.footerText}"><a href="https://muneri.nativespeak.app" style="color:#d4b37b">muneri.nativespeak.app</a></p>
                    <p style="${styles.footerMuted}">Recebeste este e-mail porque o teu endereço foi indicado para acesso antecipado.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>`.trim();
}

const styles = {
  body: 'background-color:#0f0e0d;font-family:Georgia,serif;margin:0;padding:24px 0',
  wrapperTable: 'background-color:#0f0e0d',
  containerTable: 'width:600px;max-width:600px;margin:0 auto;background-color:#141210;border-radius:12px;overflow:hidden;border:1px solid #2c2721',
  header: 'background-color:#0f0e0d;padding:24px 32px 20px;border-bottom:1px solid #2c2721',
  logo: 'color:#d4b37b;font-size:20px;font-weight:bold;margin:0;letter-spacing:.05em',
  logoSub: 'color:#5a5248;font-size:10px;letter-spacing:.15em;text-transform:uppercase;margin:4px 0 0',
  hero: 'padding:36px 32px;text-align:center',
  heroTitle: 'color:#f1e8da;font-size:28px;line-height:1.3;margin:0 0 12px',
  heroSub: 'color:#8a7d6e;font-size:13px;margin:0 0 24px',
  cta: 'display:inline-block;background-color:#d4b37b;color:#0f0e0d;padding:12px 28px;border-radius:6px;font-weight:bold;font-size:13px;letter-spacing:.04em;text-decoration:none',
  section: 'padding:28px 32px',
  sectionLabel: 'color:#5a5248;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 8px',
  divider: 'border-color:#2c2721;margin:0 0 20px',
  customBody: 'color:#d6cec2;font-size:13px;line-height:1.8;margin:0 0 10px',
  stepRow: 'margin-bottom:16px',
  stepNum: 'color:#d4b37b;font-size:20px;font-weight:bold;width:40px;vertical-align:top;padding-top:2px',
  stepTitle: 'color:#f1e8da;font-size:14px;font-weight:bold;margin:0 0 2px',
  stepDesc: 'color:#8a7d6e;font-size:12px;margin:0 0 16px;line-height:1.6',
  eduBoxWrapper: 'padding:0 32px 28px',
  eduBox: 'background-color:#1a1714;border:1px solid #6ea88640;border-radius:8px',
  eduLabel: 'color:#6ea886;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:24px 24px 8px',
  eduTitle: 'color:#f1e8da;font-size:18px;font-weight:bold;margin:0 24px 10px',
  eduDesc: 'color:#8a7d6e;font-size:12px;line-height:1.7;margin:0 24px 20px',
  ctaEdu: 'display:inline-block;margin:0 24px 24px;background-color:#6ea886;color:#0f0e0d;padding:10px 24px;border-radius:6px;font-weight:bold;font-size:12px;text-decoration:none',
  bullet: 'color:#c8bfb4;font-size:13px;line-height:1.7;margin:0 0 8px',
  footer: 'padding:20px 32px 28px;text-align:center;border-top:1px solid #2c2721',
  footerText: 'color:#5a5248;font-size:12px;margin:2px 0',
  footerMuted: 'color:#5a5248;font-size:10px;margin-top:8px',
};
