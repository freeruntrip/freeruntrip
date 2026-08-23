export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    response.setHeader(
      'Allow',
      'POST'
    );

    return response.status(405).json({
      error: 'Method Not Allowed'
    });
  }

  const text =
    String(
      request.body?.text || ''
    ).trim();

  if (!text) {
    return response.status(400).json({
      error:
        '음성으로 변환할 문장이 없습니다.'
    });
  }

  const apiKey =
    process.env.TYPECAST_API_KEY;

  const voiceId =
    process.env.TYPECAST_EUNSOL_VOICE_ID;

  if (!apiKey) {
    console.error(
      'TYPECAST_API_KEY 환경변수가 없습니다.'
    );

    return response.status(500).json({
      error:
        'Typecast API 설정이 완료되지 않았습니다.'
    });
  }

  if (!voiceId) {
    console.error(
      'TYPECAST_EUNSOL_VOICE_ID 환경변수가 없습니다.'
    );

    return response.status(500).json({
      error:
        'Typecast 은솔 Voice ID 설정이 없습니다.'
    });
  }

  try {
    const typecastResponse =
      await fetch(
        'https://api.typecast.ai/v1/text-to-speech',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'X-API-KEY':
              apiKey
          },

          body: JSON.stringify({
            text: text,

            model:
              'ssfm-v30',

            voice_id:
              voiceId
          })
        }
      );

    if (!typecastResponse.ok) {
      const errorText =
        await typecastResponse.text();

      console.error(
        'Typecast TTS 요청 실패:',
        typecastResponse.status,
        errorText
      );

      return response.status(502).json({
        error:
          'Typecast 음성 생성에 실패했습니다.'
      });
    }

    const audioBuffer =
      Buffer.from(
        await typecastResponse.arrayBuffer()
      );

    response.setHeader(
      'Content-Type',
      typecastResponse.headers.get(
        'content-type'
      ) ||
        'audio/mpeg'
    );

    response.setHeader(
      'Cache-Control',
      'no-store'
    );

    return response
      .status(200)
      .send(audioBuffer);
  } catch (error) {
    console.error(
      'FreeRunTrip Typecast TTS 오류:',
      error
    );

    return response.status(500).json({
      error:
        '음성 안내를 생성하는 중 오류가 발생했습니다.'
    });
  }
}