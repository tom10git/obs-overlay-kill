/** Supabase Auth OTP のエラーをユーザー向け文言に変換 */
export function formatAuthOtpError(message: string, status?: number): string {
  const m = message.toLowerCase()

  if (m.includes('rate limit') || status === 429) {
    return (
      'Supabase のメール送信上限に達しています（email rate limit exceeded）。' +
      ' 同じ操作を繰り返しても届きません。' +
      ' **30〜60 分待ってから** 1 回だけ再試行してください。' +
      ' 開発者は Supabase Dashboard → Authentication → Rate Limits / SMTP 設定を確認してください。'
    )
  }

  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return '新規登録が無効になっています。管理者に Supabase の Email 設定を確認してもらってください。'
  }

  if (m.includes('redirect') || (m.includes('invalid') && m.includes('url'))) {
    return (
      'ログイン後の戻り先 URL が Supabase に登録されていません。' +
      ' Authentication → URL Configuration に http://localhost:4173/overlay を追加してください。'
    )
  }

  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'メールアドレスの形式が正しくありません。'
  }

  if (m.includes('user not found') || m.includes('not registered')) {
    return 'このメールはまだ登録されていません。「新規登録」タブから登録してください。'
  }

  if (m.includes('smtp') || m.includes('email provider')) {
    return 'メール送信設定（SMTP）に問題があります。Supabase Dashboard の Authentication → Email を確認してください。'
  }

  return `ログインリンクを送信できませんでした。（${message}）`
}
