# 🌌 Solar Explorer

실제 태양계 데이터로 물리 법칙과 수학적 관계를 탐구하는 인터랙티브 웹 서비스.
서버 없이 HTML / CSS / JavaScript(+ Plotly CDN)만으로 동작합니다.

## 기능
- 🪐 행성 탐색: 실제 AU 축척의 태양계 모형, 현재 위치, 배속 재생, 행성별 확대, 소행성대·카이퍼 벨트·오르트 구름
- 📊 데이터 비교: X/Y축 변수를 골라 Plotly 산점도로 비교
- 🧮 물리량 계산: 표면중력 g = GM/R², 탈출속도 v = √(2GM/R)
- 🔬 케플러 법칙: T² ∝ a³ 검증, T²/a³ 비교표
- 🛠 가상 행성: 질량·반지름·거리를 입력해 물리량 계산, 태양계 모형에 추가

## 파일 구성
| 파일 | 역할 |
|---|---|
| `index.html` | 페이지 구조(탭, 패널) |
| `style.css` | 디자인 |
| `script.js` | 행성 데이터, 계산, 태양계 모형, 그래프 로직 |
| `.nojekyll` | GitHub Pages가 파일을 그대로 서빙하도록 함 |

## 배포 (GitHub Pages)
1. GitHub에서 새 저장소 생성 (Public)
2. 이 폴더의 파일 전체를 저장소 루트에 업로드
3. Settings → Pages → Source: `Deploy from a branch`, Branch: `main` / `(root)` 저장
4. 잠시 후 `https://<사용자이름>.github.io/<저장소이름>/` 에서 확인

## 로컬 실행
`index.html`을 브라우저로 열면 됩니다. (Plotly를 CDN에서 불러오므로 인터넷 연결 필요)
