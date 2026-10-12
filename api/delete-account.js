export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  const projectUrl =
    'https://ypabpaammfsygfeulyoe.supabase.co';

  const publishableKey =
    'sb_publishable_r9SZcg8082FZ5TPxuN1pRw__iu7EIh1';

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(503).json({
      error: '회원 탈퇴 설정을 준비 중이에요. 잠시 후 다시 시도해 주세요.'
    });
  }

  const authorization = req.headers.authorization || '';

  if (
    typeof authorization !== 'string' ||
    !/^Bearer \S+$/.test(authorization)
  ) {
    return res.status(401).json({
      error: '다시 로그인한 후 시도해 주세요.'
    });
  }

  let body;

  try {
    body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;
  } catch {
    return res.status(400).json({
      error: '요청 형식이 올바르지 않아요.'
    });
  }

  if (
    body?.confirm !== 'DELETE' ||
    typeof body.password !== 'string' ||
    !body.password ||
    body.password.length > 4096
  ) {
    return res.status(400).json({
      error: '비밀번호와 탈퇴 확인을 입력해 주세요.'
    });
  }

  try {
    // 전달받은 사용자 ID 대신 서버에서 로그인한 본인을 확인한다.
    const userResponse = await fetch(
      `${projectUrl}/auth/v1/user`,
      {
        headers: {
          apikey: publishableKey,
          Authorization: authorization
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!userResponse.ok) {
      return res.status(userResponse.status >= 500 ? 503 : 401)
        .json({
          error: '로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.'
        });
    }

    const currentUser = await userResponse.json();

    if (!currentUser.id || !currentUser.email) {
      return res.status(401).json({
        error: '이메일 계정을 확인하지 못했어요.'
      });
    }

    // 서버에서 현재 비밀번호를 검증한다.
    const verifyResponse = await fetch(
      `${projectUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: currentUser.email,
          password: body.password
        }),
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!verifyResponse.ok) {
      const limited = verifyResponse.status === 429;

      return res.status(limited ? 429 : 400).json({
        error: limited
          ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
          : '비밀번호를 확인하지 못했어요. 입력 내용을 확인해 주세요.'
      });
    }

    const verified = await verifyResponse.json();

    if (
      verified.user?.id !== currentUser.id ||
      !verified.access_token
    ) {
      return res.status(403).json({
        error: '본인 확인에 실패했어요.'
      });
    }

    try {
      const deleteResponse = await fetch(
        `${projectUrl}/auth/v1/admin/users/${
          encodeURIComponent(currentUser.id)
        }`,
        {
          method: 'DELETE',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            should_soft_delete: false
          }),
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!deleteResponse.ok) {
        return res.status(503).json({
          error: '탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
        });
      }

      return res.status(200).json({ deleted: true });
    } finally {
      // 비밀번호 검증 과정에서 발급된 임시 세션을 정리한다.
      try {
        await fetch(
          `${projectUrl}/auth/v1/logout?scope=local`,
          {
            method: 'POST',
            headers: {
              apikey: publishableKey,
              Authorization: `Bearer ${verified.access_token}`
            },
            signal: AbortSignal.timeout(5000)
          }
        );
      } catch {
        // 삭제 결과와 별개로 임시 세션 정리 실패는 노출하지 않는다.
      }
    }
  } catch {
    return res.status(503).json({
      error:
        '처리 결과를 확인하지 못했어요. 다시 로그인하여 계정 상태를 확인해 주세요.'
    });
  }
}