QuizTown DEV Client v2 - 최초 1회 빌드

1. 압축을 풉니다.
2. BUILD-QUIZTOWN-WINDOWS.cmd 를 더블클릭합니다.
3. 성공하면 dist 폴더에 QuizTown-Dev-1.30.0-Setup.exe 가 생성됩니다.
4. Setup.exe를 설치하면 바탕화면의 QuizTown DEV로 실행합니다.

이번 수정
- app/ 및 game/ 폴더 구조를 실제 ZIP 안에 유지
- game/index.html ↔ Electron IPC 연결
- 게임 화면 진입/이탈을 playing/lobby 상태로 Electron에 전달
- 업데이트 버전/다운로드 진행/게임 종료 후 적용 상태를 화면 우측 상단에 표시
- 게임 중 업데이트 설치 보류
- version.txt 제거, update-config.json을 버전 기준 파일로 통일
- CMD를 ASCII로 저장해 @echo off 깨짐 제거
- update 서버가 아직 정해지지 않았으므로 자동 업데이트 접속은 안전하게 비활성화

주의
- 이 파일은 개발 클라이언트를 최초 1회 만드는 Bootstrap입니다.
- 실제 dev 업데이트 서버 URL이 정해져야 이후 자동 업데이트가 활성화됩니다.
- 정식판은 별도 stable 채널로 운영합니다.
