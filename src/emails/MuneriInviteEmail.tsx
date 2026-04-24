import * as React from 'react';

interface Props {
  body: string;
}

export function renderMuneriInviteEmail({ body }: Props): string {
  const safeBody = body
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br/>');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Convite Muneri</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0C0A;font-family:'Georgia',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
         style="background-color:#0D0C0A;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
               style="max-width:560px;background-color:#141210;border-radius:12px;
                      border:1px solid #2A2418;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td align="center"
                style="padding:44px 40px 32px;
                       border-bottom:1px solid #2A2418;
                       background:linear-gradient(180deg,#1A1710 0%,#141210 100%);">

              <!-- Logo SVG via img — máxima compatibilidade em clientes de email -->
              <img
                src="https://muneri.nativespeak.app/icon.svg"
                alt="Muneri"
                width="72"
                height="72"
                style="display:block;margin:0 auto 20px;border:0;"/>

              <!-- Badge de exclusividade -->
              <div style="display:inline-block;
                          padding:4px 14px;
                          border:1px solid #2A2418;
                          border-radius:20px;
                          font-family:'Georgia',serif;
                          font-size:10px;letter-spacing:3px;
                          color:#8A6010;margin-bottom:20px;">
                CONVITE EXCLUSIVO
              </div>

              <!-- Headline principal -->
              <div style="font-family:'Georgia',serif;
                          font-size:22px;font-weight:normal;
                          letter-spacing:3px;color:#FBF0C8;
                          line-height:1.4;margin-bottom:10px;">
                O teu TCC, entregue.<br/>
                <span style="color:#D4A535;">Sem o caos habitual.</span>
              </div>

              <!-- Subtítulo -->
              <div style="font-family:'Georgia',serif;font-size:12px;
                          color:#7A6A4A;letter-spacing:1.5px;
                          margin-top:6px;">
                MUNERI &middot; IA PARA TRABALHOS ACAD&Eacute;MICOS
              </div>

              <!-- Divisor -->
              <div style="margin-top:20px;width:32px;height:1px;
                          background:#D4A535;opacity:0.35;
                          margin-left:auto;margin-right:auto;"></div>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:36px 40px;
                       font-size:15px;line-height:1.75;color:#D4C89A;
                       font-family:'Georgia',serif;">
              ${safeBody}
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:0 40px 36px;">
              <a href="https://muneri.nativespeak.app"
                 style="display:inline-block;
                        padding:13px 32px;
                        background:linear-gradient(135deg,#D4A535,#8A6010);
                        color:#FBF0C8;
                        font-family:'Georgia',serif;
                        font-size:14px;
                        letter-spacing:2px;
                        text-decoration:none;
                        border-radius:6px;">
                ACEDER AO MUNERI
              </a>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center"
                style="padding:20px 40px 32px;
                       border-top:1px solid #2A2418;
                       font-size:11px;color:#5A5040;
                       font-family:'Georgia',serif;letter-spacing:1px;">
              &copy; ${new Date().getFullYear()} Muneri &middot; Quelimane, Mo&ccedil;ambique<br/>
              <a href="https://muneri.nativespeak.app"
                 style="color:#8A6010;text-decoration:none;">muneri.nativespeak.app</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default function MuneriInviteEmail({ body }: Props) {
  return <div dangerouslySetInnerHTML={{ __html: renderMuneriInviteEmail({ body }) }} />;
}
