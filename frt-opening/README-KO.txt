FreeRunTrip 오프닝 V1
2026-11-17

확정된 디자인
흰색 배경, 검정색 FreeRunTrip 글자로고, 기존 도시/일출 그림 로고.
승인한 시안과 같은 로고 움직임과 기본 효과음. 길이는 약 2초.
효과음 파일을 나중에 연결할 수 있도록 화면 연출과 소리 재생을 분리했습니다.

이 파일 묶음은 앱에 추가할 모듈입니다.
사용자 PC의 프로젝트나 배포된 앱에 자동 설치된 상태는 아닙니다.
2026-11-16에 공유한 index.html/app.js/style.css 구조를 확인해 작성했습니다.

1. 파일 넣기

압축을 풀면 나오는 frt-opening 폴더를 프로젝트 루트에 넣습니다.
Windows 작업 위치 예: C:\projects\running-app\frt-opening
기존 index.html과 frt-opening 폴더가 같은 위치에 있어야 합니다.

frt-opening 폴더 안의 실행 파일:
  frt-opening.css       화면과 애니메이션
  frt-opening-audio.js  현재 효과음과 추후 녹음 파일 재생
  frt-opening.js        표시 시점과 종료 처리
  frt-opening-logo.webp 승인한 기존 로고
  opening-test.html     버튼을 눌러 확인하는 별도 테스트 화면

2. index.html의 <head> 수정

다음 기존 줄을 찾습니다.
<link rel="stylesheet" href="style.css" />

그 바로 아래, </head> 앞에 다음 두 줄을 추가합니다.
<link rel="preload" as="image" href="frt-opening/frt-opening-logo.webp">
<link rel="stylesheet" href="frt-opening/frt-opening.css">

3. index.html의 <body> 수정

<body> 바로 아래, 기존 홈 피드 마크업보다 앞에 다음 두 script 태그를 추가합니다.

<script src="frt-opening/frt-opening-audio.js"></script>
<script
  src="frt-opening/frt-opening.js"
  data-sound-src=""
></script>

두 script의 순서를 유지합니다. 이 위치에서는 async/defer를 붙이지 않습니다.
app.js와 style.css에는 별도의 수정이 필요하지 않습니다.

4. 동작 기준

- 같은 브라우저 탭의 세션에서 처음 열 때 한 번 표시합니다.
  sessionStorage를 이용하므로 같은 탭에서 새로고침하면 다시 표시하지 않습니다.
- 화면 잠금 후 복귀, 앱 내부 탭 이동, 뒤로가기 복귀 때 다시 시작하지 않습니다.
- 로그인/비밀번호 재설정 등 인증으로 돌아온 URL에서는 생략합니다.
- 유효한 RunTrip 복구 데이터가 있으면 생략합니다.
  기존 freeRunTripActiveRunTripV1: 접두사의 저장 항목을 읽기만 합니다.
  인증 완료 전에는 계정이 정해지지 않으므로 다른 계정의 보류된 RunTrip도
  오프닝 생략의 이유가 될 수 있습니다. 해당 기록은 수정하거나 삭제하지 않습니다.
- 일반 러닝 중 화면 잠금/복귀는 페이지를 재시작하지 않으므로 오프닝이 반복되지 않습니다.
- 종료할 때 오프닝 오버레이만 제거합니다.
  홈 이동 함수를 호출하지 않아 앱이 정한 홈/인증/복구 화면을 유지합니다.
- 이미지와 소리의 준비를 기다리느라 앱 진입이 지연되지 않습니다.
- 소리 자동 재생이 차단되면 화면 연출만 끝내고 앱을 보여줍니다.
- 페이지가 숨겨지거나 나가면 소리를 즉시 중지합니다.
- 동작 줄이기 설정에서는 이동/확대 효과를 줄입니다.

5. 나중에 녹음한 효과음 넣기

지금은 data-sound-src=""이므로 승인한 기본 효과음을 사용합니다.
녹음이 끝나면 원본 파일을 전달해 사용할 구간과 음량을 맞춘 뒤 넣으면 됩니다.
휴대폰 녹음 원본의 형식이나 길이를 지금 미리 맞출 필요는 없습니다.

예를 들어 사용할 파일을 frt-opening/opening-recorded.mp3로 준비했다면,
index.html에서 다음 한 줄만 바꿉니다.

  data-sound-src="frt-opening/opening-recorded.mp3"

이때 기본 합성 효과음 대신 녹음 파일만 재생됩니다.
나중에 같은 파일을 다시 교체하면 ?v=2처럼 버전을 붙여 캐시를 갱신할 수 있습니다.

기본 오프닝은 약 2초에 종료하면서 소리를 중지합니다.
긴 녹음은 사용할 부분을 미리 정리하거나, 필요한 경우 연출 길이도 함께 조절합니다.
원본을 보내면 그때 결정하면 됩니다.

6. 확인 순서

먼저 VS Code Live Server에서 frt-opening/opening-test.html을 엽니다.
‘소리와 함께 재생’을 눌러 로고와 효과음을 확인합니다.

그다음 index.html에 연결하고 새로운 탭에서 앱을 엽니다.
이미 같은 탭에서 본 경우에는 새로고침만으로 다시 나타나지 않을 수 있습니다.
새 탭의 세션도 복제된 경우에는 별도 테스트 화면으로 확인합니다.

권장 실제 기기 확인:
  Problems 0 → PC 화면 → iPhone Safari → commit/push → Vercel 확인
  오프닝 종료 후 홈 화면 조작, 로그인 복귀, RunTrip 복구,
  화면 잠금 후 복귀, 소리 자동 재생 차단 때의 화면 전환을 확인합니다.

제작 환경에서 코드 구문과 시작/종료·예외 경로를 확인했지만,
사용자의 실제 iPhone과 현재 전체 앱에서의 최종 검증은 필요합니다.

7. 되돌리기

index.html에 추가한 link 두 줄과 script 두 태그를 제거하면 됩니다.
앱 기록이나 계정 데이터는 이 모듈이 변경하지 않습니다.
