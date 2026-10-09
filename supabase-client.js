/* FreeRunTrip 회원 인증 연결 */
(function () {
  'use strict';

  const projectUrl =
    'https://ypabpaammfsygfeulyoe.supabase.co';

  const publishableKey =
    'sb_publishable_r9SZcg8082FZ5TPxuN1pRw__iu7EIh1';

  // Supabase가 인증 URL을 정리하기 전에
  // 이번 접속이 회원가입 인증 결과인지 확인한다.
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.slice(1));

  const value = (name) =>
    hash.get(name) || url.searchParams.get(name);

  const hasError = Boolean(
    value('error') || value('error_code')
  );

  const isSignup = value('type') === 'signup';

  // 인증 토큰은 검증하는 동안 메모리에서만 사용한다.
  window.freeRunTripAuthReturn = {
    kind: hasError
      ? 'error'
      : isSignup
        ? 'signup'
        : null,

    accessToken:
      isSignup && !hasError
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