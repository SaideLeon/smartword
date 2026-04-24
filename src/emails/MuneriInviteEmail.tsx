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
          <tr>
            <td align="center"
                style="padding:40px 40px 28px;
                       border-bottom:1px solid #2A2418;">
              <span style="font-family:'Georgia',serif;font-size:26px;font-weight:normal;
                           letter-spacing:6px;color:#D4A535;">TRABALHO ACADÉMICO AUTOMÁTICO COM O MUNERI IA</span>
              <div style="margin-top:8px;width:40px;height:1px;background:#D4A535;
                          opacity:0.4;margin-left:auto;margin-right:auto;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;
                       font-size:15px;line-height:1.75;color:#D4C89A;
                       font-family:'Georgia',serif;">
              ${safeBody}
            </td>
          </tr>
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
          <tr>
            <td align="center"
                style="padding:20px 40px 32px;
                       border-top:1px solid #2A2418;
                       font-size:11px;color:#5A5040;
                       font-family:'Georgia',serif;letter-spacing:1px;">
              © ${new Date().getFullYear()} Muneri · Quelimane, Moçambique<br/>
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
