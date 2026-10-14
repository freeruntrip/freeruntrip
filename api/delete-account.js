import {
  createHmac,
  timingSafeEqual,
  randomBytes
} from 'node:crypto';

const projectUrl =
  'https://ypabpaammfsygfeulyoe.supabase.co';

const publishableKey =
  'sb_publishable_r9SZcg8082FZ5TPxuN1pRw__iu7EIh1';

const appOrigin =
  'https://freeruntrip.vercel.app';

const cookieName =
  '__Host-frt_delete_intent';

// 탈퇴 본인 확인은 시작 시점부터 10분 동안 유효하다.
const lifetime = 600;

function setIntentCookie(
  res,
  value,
  maxAge = lifetime
) {
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
  );
}

function signature(value, key) {
  return createHmac('sha256', key)
    .update(
      'FreeRunTrip/delete-intent/v1:' + value
    )
    .digest('base64url');
}

function readIntent(req, key) {
  try {
    const cookie = String(
      req.headers.cookie || ''
    )
      .split(';')
      .map((part) => part.trim())
      .find((part) =>
        part.startsWith(cookieName + '=')
      );

    if (!cookie) return null;

    const [payload, mac, extra] = cookie
      .slice(cookieName.length + 1)
      .split('.');

    if (
      !payload ||
      !mac ||
      extra ||
      payload.length > 2048
    ) {
      return null;
    }

    const expected = Buffer.from(
      signature(payload, key)
    );

    const actual = Buffer.from(mac);

    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const intent = JSON.parse(
      Buffer.from(
        payload,
        'base64url'
      ).toString('utf8')
    );

    const now = Math.floor(
      Date.now() / 1000
    );

    if (
      intent.v !== 1 ||
      typeof intent.userId !== 'string' ||
      typeof intent.sessionId !== 'string' ||
      !intent.sessionId ||
      !Number.isInteger(intent.startedAt) ||
      intent.startedAt > now ||
      intent.expiresAt !==
        intent.startedAt + lifetime ||
      intent.expiresAt <= now
    ) {
      return null;
    }

    return intent;
  } catch {
    return null;
  }
}

function hasGoogleIdentity(user) {
  return (
    Array.isArray(user.identities) &&
    user.identities.some(
      (identity) =>
        identity.provider === 'google'
    )
  );
}

// 반드시 /auth/v1/user에서 동일 토큰을 검증한 후 호출한다.
function verifiedClaims(token, userId) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const claims = JSON.parse(
    Buffer.from(
      parts[1],
      'base64url'
    ).toString('utf8')
  );

  if (
    claims.sub !== userId ||
    claims.iss !== `${projectUrl}/auth/v1` ||
    claims.role !== 'authenticated' ||
    typeof claims.session_id !== 'string' ||
    !claims.session_id ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Invalid claims');
  }

  return claims;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      error: '허용되지 않은 요청입니다.'
    });
  }

  // 배포된 앱에서 보내는 JSON 요청만 허용한다.
  if (
    req.headers.origin !== appOrigin ||
    !/^application\/json(?:\s*;|$)/i.test(
      String(
        req.headers['content-type'] || ''
      )
    )
  ) {
    return res.status(403).json({
      error: '앱에서 다시 시도해 주세요.'
    });
  }

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey) {
    return res.status(503).json({
      error:
        '회원 탈퇴 설정을 준비 중이에요. 잠시 후 다시 시도해 주세요.'
    });
  }

  let body;

  try {
    body =
      typeof req.body === 'string'
        ? JSON.parse(req.body)
        : req.body;
  } catch {
    return res.status(400).json({
      error: '요청 형식이 올바르지 않아요.'
    });
  }

  const action = body?.action || 'delete';

  if (
    ![
      'delete',
      'start-google',
      'verify-google',
      'cancel-google'
    ].includes(action)
  ) {
    return res.status(400).json({
      error: '요청 형식이 올바르지 않아요.'
    });
  }

  if (action === 'cancel-google') {
    setIntentCookie(res, '', 0);

    return res.status(200).json({
      cancelled: true
    });
  }

  const authorization =
    req.headers.authorization || '';

  if (
    typeof authorization !== 'string' ||
    !/^Bearer \S+$/.test(authorization)
  ) {
    return res.status(401).json({
      error: '다시 로그인한 후 시도해 주세요.'
    });
  }

  const googleDelete =
    action === 'delete' &&
    body?.method === 'google';

  if (
    action === 'delete' &&
    body?.confirm !== 'DELETE'
  ) {
    return res.status(400).json({
      error: '탈퇴 확인을 완료해 주세요.'
    });
  }

  if (
    action === 'delete' &&
    !googleDelete &&
    (
      typeof body?.password !== 'string' ||
      !body.password ||
      body.password.length > 4096
    )
  ) {
    return res.status(400).json({
      error: '현재 비밀번호를 입력해 주세요.'
    });
  }

  let temporaryToken = null;

  try {
    // 클라이언트가 지정한 ID 대신 로그인한 본인을 확인한다.
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
      return res
        .status(
          userResponse.status >= 500
            ? 503
            : 401
        )
        .json({
          error:
            '로그인 상태를 확인하지 못했어요. 다시 로그인해 주세요.'
        });
    }

    const currentUser =
      await userResponse.json();

    if (
      !currentUser.id ||
      !currentUser.email
    ) {
      return res.status(401).json({
        error: '이메일 계정을 확인하지 못했어요.'
      });
    }

    if (
      action === 'start-google' ||
      action === 'verify-google' ||
      googleDelete
    ) {
      if (!hasGoogleIdentity(currentUser)) {
        return res.status(403).json({
          error:
            '이 계정의 Google 연결을 확인하지 못했어요.'
        });
      }

      let claims;

      try {
        claims = verifiedClaims(
          authorization.slice(7),
          currentUser.id
        );
      } catch {
        return res.status(401).json({
          error:
            '인증 정보를 확인하지 못했어요. 다시 로그인해 주세요.'
        });
      }

      const now = Math.floor(
        Date.now() / 1000
      );

      if (action === 'start-google') {
        const intent = {
          v: 1,
          userId: currentUser.id,
          sessionId: claims.session_id,
          startedAt: now,
          expiresAt: now + lifetime,
          nonce: randomBytes(24)
            .toString('base64url')
        };

        const payload = Buffer.from(
          JSON.stringify(intent)
        ).toString('base64url');

        setIntentCookie(
          res,
          payload + '.' +
            signature(payload, serviceKey)
        );

        return res.status(200).json({
          started: true,
          userId: currentUser.id
        });
      }

      const intent = readIntent(
        req,
        serviceKey
      );

      // 기존 토큰의 갱신은 재인증으로 인정하지 않는다.
      // 서버의 탈퇴 요청 생성 이후 새 OAuth 인증이 필요하다.
      const recentOAuth =
        intent &&
        Array.isArray(claims.amr) &&
        claims.amr.some((entry) =>
          entry.method === 'oauth' &&
          Number.isInteger(entry.timestamp) &&
          entry.timestamp > intent.startedAt &&
          entry.timestamp <= now + 30
        );

      if (
        !intent ||
        intent.userId !== currentUser.id ||
        intent.sessionId === claims.session_id ||
        !recentOAuth
      ) {
        return res.status(403).json({
          error:
            '처음 선택한 계정으로 Google 본인 확인을 다시 진행해 주세요. 확인은 10분 동안 유효해요.'
        });
      }

      if (action === 'verify-google') {
        return res.status(200).json({
          verified: true,
          userId: currentUser.id
        });
      }
    } else {
      // 이메일 계정은 기존처럼 현재 비밀번호를 검증한다.
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
        const limited =
          verifyResponse.status === 429;

        return res
          .status(limited ? 429 : 400)
          .json({
            error: limited
              ? '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'
              : '비밀번호를 확인하지 못했어요. 입력 내용을 확인해 주세요.'
          });
      }

      const verified =
        await verifyResponse.json();

      temporaryToken =
        verified.access_token || null;

      if (
        verified.user?.id !== currentUser.id ||
        !temporaryToken
      ) {
        return res.status(403).json({
          error: '본인 확인에 실패했어요.'
        });
      }
    }

    // 최종 확인 요청에서만 실제 계정을 삭제한다.
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
        error:
          '탈퇴를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'
      });
    }

    setIntentCookie(res, '', 0);

    return res.status(200).json({
      deleted: true
    });
  } catch {
    return res.status(503).json({
      error:
        '처리 결과를 확인하지 못했어요. 다시 로그인하여 계정 상태를 확인해 주세요.'
    });
  } finally {
    // 비밀번호 검증 과정에서 발급된 임시 세션을 정리한다.
    if (temporaryToken) {
      try {
        await fetch(
          `${projectUrl}/auth/v1/logout?scope=local`,
          {
            method: 'POST',
            headers: {
              apikey: publishableKey,
              Authorization:
                `Bearer ${temporaryToken}`
            },
            signal: AbortSignal.timeout(5000)
          }
        );
      } catch {
        // 계정 삭제는 이미 완료됐을 수 있다.
      }
    }
  }
}