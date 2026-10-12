/* FreeRunTrip 회원 인증 연결 */
(function () {
  'use strict';

  const projectUrl =
    'https://ypabpaammfsygfeulyoe.supabase.co';

  const publishableKey =
    'sb_publishable_r9SZcg8082FZ5TPxuN1pRw__iu7EIh1';

  // Supabase가 인증 URL을 정리하기 전에
  // 회원가입 인증 또는 비밀번호 재설정 접속인지 확인한다.
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));

  const value = (name) =>
    hash.get(name) || url.searchParams.get(name);

  const hasError = Boolean(
    value('error') || value('error_code')
  );

  const authType = value('type');
  const isSignup = authType === 'signup';
  const isRecovery = authType === 'recovery';

  // 만료된 재설정 링크로 돌아온 경우에도
  // 비밀번호 재설정 요청이었다는 것을 구분한다.
  const recoveryRequested =
    isRecovery ||
    url.searchParams.get('auth') === 'recovery';

  let returnKind = null;

  if (hasError) {
    returnKind = recoveryRequested
      ? 'recovery-error'
      : 'error';
  } else if (recoveryRequested) {
    returnKind = 'recovery';
  } else if (isSignup) {
    returnKind = 'signup';
  }

  // 인증 토큰은 검증하는 동안 메모리에서만 사용한다.
  // 재설정 화면은 이후 app.js에서 세션을 검증한 뒤 연다.
  window.freeRunTripAuthReturn = {
    kind: returnKind,

    accessToken:
      !hasError && (isSignup || isRecovery)
        ? hash.get('access_token')
        : null
  };

  if (!window.supabase) {
    console.error(
      'Supabase 라이브러리를 불러오지 못했습니다.'
    );
    return;
  }

  window.freeRunTripSupabase = window.supabase.createClient(
    projectUrl,
    publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();