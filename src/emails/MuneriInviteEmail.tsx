import type { CSSProperties } from 'react';

interface Props {
  body: string;
}

export function MuneriInviteEmail({ body }: Props) {
  const customParagraphs = body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <html lang="pt">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Convite Muneri</title>
      </head>
      <body style={styles.body}>
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={styles.wrapperTable}>
          <tbody>
            <tr>
              <td align="center">
                <table role="presentation" width="600" cellPadding={0} cellSpacing={0} style={styles.containerTable}>
                  <tbody>
                    <tr>
                      <td style={styles.header}>
                        <p style={styles.logo}>✦ Muneri</p>
                        <p style={styles.logoSub}>Plataforma Académica para Estudantes Moçambicanos</p>
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.hero}>
                        <h1 style={styles.heroTitle}>
                          O teu trabalho académico,<br /><span style={{ color: '#d4b37b' }}>em minutos.</span>
                        </h1>
                        <p style={styles.heroSub}>
                          Tema → Trabalho completo em Word, formatado, com capa e referências.
                        </p>
                        <a href="https://muneri.nativespeak.app/auth/login" style={styles.cta}>
                          Começar grátis →
                        </a>
                      </td>
                    </tr>

                    {customParagraphs.length > 0 ? (
                      <tr>
                        <td style={styles.section}>
                          <p style={styles.sectionLabel}>MENSAGEM DO ADMIN</p>
                          <hr style={styles.divider} />
                          {customParagraphs.map((line, index) => (
                            <p key={`${line}-${index}`} style={styles.customBody}>
                              {line}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ) : null}

                    <tr>
                      <td style={styles.section}>
                        <p style={styles.sectionLabel}>COMO FUNCIONA</p>
                        <hr style={styles.divider} />
                        {[
                          ['01', 'Insere o tema', 'Qualquer área: Direito, Gestão, Saúde, Engenharia, Educação…'],
                          ['02', 'Indica o módulo', 'O Muneri calibra o tom académico e a estrutura do teu curso.'],
                          ['03', 'Descarrega o trabalho', 'Capa, sumário, capítulos, conclusão e referências APA — prontos.'],
                        ].map(([num, title, desc]) => (
                          <table key={num} role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={styles.stepRow}>
                            <tbody>
                              <tr>
                                <td style={styles.stepNum}>{num}</td>
                                <td>
                                  <p style={styles.stepTitle}>{title}</p>
                                  <p style={styles.stepDesc}>{desc}</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        ))}
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.eduBoxWrapper}>
                        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={styles.eduBox}>
                          <tbody>
                            <tr>
                              <td>
                                <p style={styles.eduLabel}>🎓 OFERTA EDUCATIVA</p>
                                <p style={styles.eduTitle}>30 dias Premium completamente grátis</p>
                                <p style={styles.eduDesc}>
                                  Usa a tua conta institucional (@unisced.edu.mz, @up.edu.mz, @uem.ac.mz) ao entrar com
                                  Google e o período gratuito é activado automaticamente — sem cartão de crédito.
                                </p>
                                <a href="https://muneri.nativespeak.app/auth/login" style={styles.ctaEdu}>
                                  Activar 30 dias grátis
                                </a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.section}>
                        <p style={styles.sectionLabel}>PORQUÊ O MUNERI</p>
                        <hr style={styles.divider} />
                        {[
                          'Pensado para Moçambique — exemplos, dados e referências locais.',
                          'Não é só gerador de texto — revês secção a secção com IA.',
                          'Exportação Word nativa — abre no Google Docs, LibreOffice e WPS.',
                        ].map((text, index) => (
                          <p key={`${text}-${index}`} style={styles.bullet}>
                            <span style={{ color: '#d4b37b' }}>✦</span> {text}
                          </p>
                        ))}
                      </td>
                    </tr>

                    <tr>
                      <td style={styles.footer}>
                        <p style={styles.footerText}>Equipa Muneri · Quelimane, Moçambique</p>
                        <p style={styles.footerText}>
                          <a href="https://muneri.nativespeak.app" style={{ color: '#d4b37b' }}>
                            muneri.nativespeak.app
                          </a>
                        </p>
                        <p style={styles.footerMuted}>
                          Recebeste este e-mail porque o teu endereço foi indicado para acesso antecipado.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: '#0f0e0d',
    fontFamily: 'Georgia, serif',
    margin: '0',
    padding: '24px 0',
  },
  wrapperTable: {
    backgroundColor: '#0f0e0d',
  },
  containerTable: {
    width: '600px',
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#141210',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid #2c2721',
  },
  header: {
    backgroundColor: '#0f0e0d',
    padding: '24px 32px 20px',
    borderBottom: '1px solid #2c2721',
  },
  logo: {
    color: '#d4b37b',
    fontSize: '20px',
    fontWeight: 'bold',
    margin: '0',
    letterSpacing: '0.05em',
  },
  logoSub: {
    color: '#5a5248',
    fontSize: '10px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    margin: '4px 0 0',
  },
  hero: {
    padding: '36px 32px',
    textAlign: 'center',
  },
  heroTitle: {
    color: '#f1e8da',
    fontSize: '28px',
    lineHeight: '1.3',
    margin: '0 0 12px',
  },
  heroSub: {
    color: '#8a7d6e',
    fontSize: '13px',
    margin: '0 0 24px',
  },
  cta: {
    display: 'inline-block',
    backgroundColor: '#d4b37b',
    color: '#0f0e0d',
    padding: '12px 28px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    letterSpacing: '0.04em',
    textDecoration: 'none',
  },
  section: {
    padding: '28px 32px',
  },
  sectionLabel: {
    color: '#5a5248',
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    margin: '0 0 8px',
  },
  divider: {
    borderColor: '#2c2721',
    margin: '0 0 20px',
  },
  customBody: {
    color: '#d6cec2',
    fontSize: '13px',
    lineHeight: '1.8',
    margin: '0 0 10px',
  },
  stepRow: {
    marginBottom: '16px',
  },
  stepNum: {
    color: '#d4b37b',
    fontSize: '20px',
    fontWeight: 'bold',
    width: '40px',
    verticalAlign: 'top',
    paddingTop: '2px',
  },
  stepTitle: {
    color: '#f1e8da',
    fontSize: '14px',
    fontWeight: 'bold',
    margin: '0 0 2px',
  },
  stepDesc: {
    color: '#8a7d6e',
    fontSize: '12px',
    margin: '0 0 16px',
    lineHeight: '1.6',
  },
  eduBoxWrapper: {
    padding: '0 32px 28px',
  },
  eduBox: {
    backgroundColor: '#1a1714',
    border: '1px solid #6ea88640',
    borderRadius: '8px',
  },
  eduLabel: {
    color: '#6ea886',
    fontSize: '10px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    margin: '24px 24px 8px',
  },
  eduTitle: {
    color: '#f1e8da',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0 24px 10px',
  },
  eduDesc: {
    color: '#8a7d6e',
    fontSize: '12px',
    lineHeight: '1.7',
    margin: '0 24px 20px',
  },
  ctaEdu: {
    display: 'inline-block',
    margin: '0 24px 24px',
    backgroundColor: '#6ea886',
    color: '#0f0e0d',
    padding: '10px 24px',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    textDecoration: 'none',
  },
  bullet: {
    color: '#c8bfb4',
    fontSize: '13px',
    lineHeight: '1.7',
    margin: '0 0 8px',
  },
  footer: {
    padding: '20px 32px 28px',
    textAlign: 'center',
    borderTop: '1px solid #2c2721',
  },
  footerText: {
    color: '#5a5248',
    fontSize: '12px',
    margin: '2px 0',
  },
  footerMuted: {
    color: '#5a5248',
    fontSize: '10px',
    marginTop: '8px',
  },
};
